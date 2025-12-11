/**
 * 退款服务
 * 负责处理退款申请、状态跟踪和审计
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { PaymentProviderFactory, ProviderType } from '@/shared/payments';
import { pointsService } from '@/shared/services/points';
import { PaymentChannel, RefundStatus, PaymentStatus } from './types';

export interface RefundRequest {
  paymentId: string;
  refundAmount: number;
  refundReason: string;
  applyUserId: string;
  operatorId?: string;
  extra?: any;
}

export interface RefundResponse {
  success: boolean;
  refundId: string;
  refundNo: string;
  channelRefundId?: string;
  status: RefundStatus;
  message: string;
  errors?: string[];
}

export interface RefundQuery {
  refundId?: string;
  refundNo?: string;
  paymentId?: string;
  status?: RefundStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
}

export interface RefundStatistics {
  totalCount: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  processingCount: number;
  processingAmount: number;
  successCount: number;
  successAmount: number;
  failedCount: number;
  failedAmount: number;
}

/**
 * 退款服务类
 */
export class RefundService {
  private static instance: RefundService;
  private readonly LOCK_EXPIRE_MINUTES = 30;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): RefundService {
    if (!RefundService.instance) {
      RefundService.instance = new RefundService();
    }
    return RefundService.instance;
  }

  /**
   * 创建退款订单
   */
  public async createRefundOrder(request: RefundRequest): Promise<RefundResponse> {
    const startTime = Date.now();

    try {
      // 1. 查找支付记录
      const paymentRecord = await this.findPaymentById(request.paymentId);
      if (!paymentRecord) {
        return {
          success: false,
          refundId: '',
          refundNo: '',
          status: RefundStatus.FAILED,
          message: '支付记录不存在',
          errors: ['支付记录不存在']
        };
      }

      // 2. 验证退款条件
      const validation = await this.validateRefundRequest(paymentRecord, request);
      if (!validation.isValid) {
        return {
          success: false,
          refundId: '',
          refundNo: '',
          status: RefundStatus.FAILED,
          message: validation.message,
          errors: validation.errors
        };
      }

      // 3. 获取退款锁（防止重复退款）
      const lockResult = await this.acquireRefundLock(request);
      if (!lockResult.success) {
        return {
          success: false,
          refundId: '',
          refundNo: '',
          status: RefundStatus.FAILED,
          message: lockResult.message,
          errors: [lockResult.message]
        };
      }

      // 4. 创建退款记录
      const refundRecord = await this.createRefundRecord(paymentRecord, request);

      // 5. 处理渠道退款
      const channelRefundResponse = await this.processChannelRefund(refundRecord, paymentRecord);

      // 6. 更新退款状态
      if (channelRefundResponse.success) {
        await this.updateRefundStatus(refundRecord.id, {
          status: RefundStatus.PROCESSING,
          channelRefundId: channelRefundResponse.channelRefundId,
          channelResponse: JSON.stringify(channelRefundResponse)
        });
      } else {
        await this.updateRefundStatus(refundRecord.id, {
          status: RefundStatus.FAILED,
          failedReason: channelRefundResponse.message,
          channelResponse: JSON.stringify(channelRefundResponse)
        });
      }

      // 7. 记录日志
      await this.logRefundAction(refundRecord.id, 'CREATE', request.applyUserId, {
        request,
        response: channelRefundResponse,
        duration: Date.now() - startTime
      });

      // 8. 释放退款锁
      await this.releaseRefundLock(request.paymentId);

      return {
        success: channelRefundResponse.success,
        refundId: refundRecord.id,
        refundNo: refundRecord.refundNo,
        channelRefundId: channelRefundResponse.channelRefundId,
        status: refundRecord.status,
        message: channelRefundResponse.message ||
          (channelRefundResponse.success ? '退款申请成功' : '退款申请失败'),
        errors: channelRefundResponse.success ? undefined :
          [channelRefundResponse.message || '退款申请失败']
      };

    } catch (error) {
      logger.error('创建退款订单失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      // 释放锁
      try {
        await this.releaseRefundLock(request.paymentId);
      } catch (e) {
        logger.error('释放退款锁失败', { error: e });
      }

      return {
        success: false,
        refundId: '',
        refundNo: '',
        status: RefundStatus.FAILED,
        message: '创建退款订单失败: ' + (error instanceof Error ? error.message : '未知错误'),
        errors: [error instanceof Error ? error.message : '未知错误']
      };
    }
  }

  /**
   * 查询退款状态
   */
  public async queryRefundStatus(refundId: string): Promise<any> {
    try {
      const refundRecord = await prisma.paymentRefunds.findUnique({
        where: { id: refundId },
        include: {
          payment: {
            include: {
              users: {
                select: {
                  id: true,
                  nickname: true,
                  phone: true
                }
              }
            }
          }
        }
      });

      if (!refundRecord) {
        throw new Error('退款记录不存在');
      }

      // 如果退款已完成，直接返回
      if (refundRecord.status === RefundStatus.SUCCESS ||
          refundRecord.status === RefundStatus.FAILED) {
        return {
          success: true,
          refund: refundRecord
        };
      }

      // 如果是处理中状态，查询渠道状态
      if (refundRecord.status === RefundStatus.PROCESSING &&
          refundRecord.payment.paymentChannel !== PaymentChannel.POINTS) {

        const channelStatus = await this.queryChannelRefundStatus(refundRecord);

        if (channelStatus.success) {
          const newStatus = this.mapChannelRefundStatus(channelStatus.status);

          // 更新本地状态
          if (newStatus !== refundRecord.status) {
            await this.updateRefundStatus(refundRecord.id, {
              status: newStatus,
              refundedAt: newStatus === RefundStatus.SUCCESS ? new Date() : undefined
            });
          }
        }
      }

      // 重新获取记录
      const updatedRecord = await prisma.paymentRefunds.findUnique({
        where: { id: refundId },
        include: {
          payment: {
            include: {
              users: {
                select: {
                  id: true,
                  nickname: true,
                  phone: true
                }
              }
            }
          }
        }
      });

      return {
        success: true,
        refund: updatedRecord
      };

    } catch (error) {
      logger.error('查询退款状态失败', {
        refundId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取退款列表
   */
  public async getRefundList(query: RefundQuery): Promise<any> {
    try {
      const where: any = {};

      if (query.refundId) {
        where.id = query.refundId;
      }
      if (query.refundNo) {
        where.refundNo = query.refundNo;
      }
      if (query.paymentId) {
        where.paymentId = query.paymentId;
      }
      if (query.status) {
        where.status = query.status;
      }
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) {
          where.createdAt.gte = query.startDate;
        }
        if (query.endDate) {
          where.createdAt.lte = query.endDate;
        }
      }

      const page = query.page || 1;
      const perPage = Math.min(query.perPage || 20, 100);
      const skip = (page - 1) * perPage;

      const [records, total] = await Promise.all([
        prisma.paymentRefunds.findMany({
          where,
          include: {
            payment: {
              select: {
                id: true,
                paymentNo: true,
                amount: true,
                paymentChannel: true,
                users: {
                  select: {
                    id: true,
                    nickname: true,
                    phone: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: perPage
        }),
        prisma.paymentRefunds.count({ where })
      ]);

      return {
        success: true,
        data: {
          records,
          pagination: {
            page,
            perPage,
            total,
            totalPages: Math.ceil(total / perPage)
          }
        }
      };

    } catch (error) {
      logger.error('获取退款列表失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取退款统计
   */
  public async getRefundStatistics(query?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<RefundStatistics> {
    try {
      const where: any = {};

      if (query?.startDate || query?.endDate) {
        where.createdAt = {};
        if (query?.startDate) {
          where.createdAt.gte = query.startDate;
        }
        if (query?.endDate) {
          where.createdAt.lte = query.endDate;
        }
      }

      // 获取总统计
      const [totalStats, statusStats] = await Promise.all([
        // 总数量和总金额
        prisma.paymentRefunds.aggregate({
          where,
          _count: { id: true },
          _sum: { refundAmount: true }
        }),
        // 按状态分组统计
        prisma.paymentRefunds.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
          _sum: { refundAmount: true }
        })
      ]);

      // 解析状态统计
      const statsMap = new Map(
        statusStats.map(item => [
          item.status,
          {
            count: item._count.id,
            amount: item._sum.refundAmount || 0
          }
        ])
      );

      return {
        totalCount: totalStats._count.id,
        totalAmount: totalStats._sum.refundAmount || 0,
        pendingCount: statsMap.get('PENDING')?.count || 0,
        pendingAmount: statsMap.get('PENDING')?.amount || 0,
        processingCount: statsMap.get('PROCESSING')?.count || 0,
        processingAmount: statsMap.get('PROCESSING')?.amount || 0,
        successCount: statsMap.get('SUCCESS')?.count || 0,
        successAmount: statsMap.get('SUCCESS')?.amount || 0,
        failedCount: statsMap.get('FAILED')?.count || 0,
        failedAmount: statsMap.get('FAILED')?.amount || 0
      };

    } catch (error) {
      logger.error('获取退款统计失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // ===== 私有方法 =====

  /**
   * 生成退款单号
   */
  private generateRefundNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `REF${timestamp}${random}`.toUpperCase();
  }

  /**
   * 查找支付记录
   */
  private async findPaymentById(paymentId: string): Promise<any> {
    return await prisma.paymentRecords.findUnique({
      where: { id: paymentId },
      include: {
        refunds: true
      }
    });
  }

  /**
   * 验证退款请求
   */
  private async validateRefundRequest(
    paymentRecord: any,
    request: RefundRequest
  ): Promise<{isValid: boolean, message: string, errors: string[]}> {
    const errors: string[] = [];

    // 检查支付状态
    if (paymentRecord.status !== PaymentStatus.PAID) {
      errors.push('只能对已支付的订单进行退款');
    }

    // 检查退款金额
    if (request.refundAmount <= 0) {
      errors.push('退款金额必须大于0');
    }
    if (request.refundAmount > paymentRecord.amount) {
      errors.push('退款金额不能超过支付金额');
    }

    // 检查是否已有退款记录
    const existingRefunds = paymentRecord.refunds || [];
    const totalRefunded = existingRefunds.reduce((sum: number, refund: any) => {
      return refund.status === RefundStatus.SUCCESS ? sum + refund.refundAmount : sum;
    }, 0);

    if (totalRefunded + request.refundAmount > paymentRecord.amount) {
      errors.push('退款金额加上已退款金额不能超过支付金额');
    }

    return {
      isValid: errors.length === 0,
      message: errors.join('; '),
      errors
    };
  }

  /**
   * 获取退款锁
   */
  private async acquireRefundLock(request: RefundRequest): Promise<{success: boolean, message: string}> {
    try {
      const lockKey = `refund:${request.paymentId}`;

      // 检查是否已有活跃的锁
      const existingLock = await prisma.paymentLocks.findFirst({
        where: {
          lockKey,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      });

      if (existingLock) {
        return {
          success: false,
          message: '存在未完成的退款申请，请勿重复提交'
        };
      }

      // 创建新的退款锁
      await prisma.paymentLocks.create({
        data: {
          lockKey,
          orderId: '', // 退款申请没有orderId
          userId: request.applyUserId,
          amount: request.refundAmount,
          expiresAt: new Date(Date.now() + this.LOCK_EXPIRE_MINUTES * 60 * 1000)
        }
      });

      return { success: true, message: '' };

    } catch (error) {
      logger.error('获取退款锁失败', { request, error });
      return {
        success: false,
        message: '系统繁忙，请稍后重试'
      };
    }
  }

  /**
   * 释放退款锁
   */
  private async releaseRefundLock(paymentId: string): Promise<void> {
    const lockKey = `refund:${paymentId}`;

    await prisma.paymentLocks.updateMany({
      where: {
        lockKey,
        isActive: true
      },
      data: {
        isActive: false
      }
    });
  }

  /**
   * 创建退款记录
   */
  private async createRefundRecord(paymentRecord: any, request: RefundRequest): Promise<any> {
    const refundNo = this.generateRefundNo();

    return await prisma.paymentRefunds.create({
      data: {
        refundNo,
        paymentId: request.paymentId,
        refundAmount: request.refundAmount,
        refundReason: request.refundReason,
        applyUserId: request.applyUserId,
        status: RefundStatus.PENDING,
        extra: request.extra ? JSON.stringify(request.extra) : null
      }
    });
  }

  /**
   * 处理渠道退款
   */
  private async processChannelRefund(refundRecord: any, paymentRecord: any): Promise<any> {
    try {
      if (paymentRecord.paymentChannel === PaymentChannel.POINTS) {
        // 通券退款处理
        const refundResult = await pointsService.credit({
          userId: paymentRecord.userId,
          points: refundRecord.refundAmount,
          description: `退款返还 - ${refundRecord.refundNo}`
        });

        return {
          success: refundResult.success,
          channelRefundId: refundResult.data?.transactionId,
          message: refundResult.message ||
            (refundResult.success ? '通券退款成功' : '通券退款失败')
        };
      } else {
        // 第三方支付渠道退款
        const provider = PaymentProviderFactory.createProvider(
          paymentRecord.paymentChannel as ProviderType
        );

        const refundRequest = {
          orderId: paymentRecord.paymentNo,
          refundAmount: refundRecord.refundAmount,
          totalAmount: paymentRecord.amount,
          reason: refundRecord.refundReason,
          refundId: refundRecord.refundNo,
          extra: refundRecord.extra ? JSON.parse(refundRecord.extra) : undefined
        };

        return await provider.createRefund(refundRequest);
      }
    } catch (error) {
      logger.error('处理渠道退款失败', {
        refundRecord,
        paymentRecord,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : '退款处理失败'
      };
    }
  }

  /**
   * 更新退款状态
   */
  private async updateRefundStatus(refundId: string, updateData: any): Promise<void> {
    await prisma.paymentRefunds.update({
      where: { id: refundId },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });
  }

  /**
   * 查询渠道退款状态
   */
  private async queryChannelRefundStatus(refundRecord: any): Promise<any> {
    try {
      if (refundRecord.payment.paymentChannel === PaymentChannel.POINTS) {
        // 通券退款状态查询
        return {
          success: true,
          status: refundRecord.status === RefundStatus.SUCCESS ? 'SUCCESS' : 'FAILED'
        };
      } else {
        // 第三方支付渠道状态查询
        const provider = PaymentProviderFactory.createProvider(
          refundRecord.payment.paymentChannel as ProviderType
        );

        return await provider.queryRefund(
          refundRecord.payment.paymentNo,
          refundRecord.refundNo
        );
      }
    } catch (error) {
      logger.error('查询渠道退款状态失败', {
        refundRecord,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        status: 'FAILED',
        message: error instanceof Error ? error.message : '查询失败'
      };
    }
  }

  /**
   * 映射渠道退款状态
   */
  private mapChannelRefundStatus(channelStatus: string): RefundStatus {
    const statusMap: Record<string, RefundStatus> = {
      'SUCCESS': RefundStatus.SUCCESS,
      'SUCCESSFUL': RefundStatus.SUCCESS,
      'FAILED': RefundStatus.FAILED,
      'CLOSED': RefundStatus.FAILED,
      'PROCESSING': RefundStatus.PROCESSING,
      'PENDING': RefundStatus.PENDING
    };

    return statusMap[channelStatus] || RefundStatus.FAILED;
  }

  /**
   * 记录退款操作日志
   */
  private async logRefundAction(
    refundId: string,
    action: string,
    userId?: string,
    data?: any
  ): Promise<void> {
    try {
      await prisma.paymentLogs.create({
        data: {
          paymentId: '', // 退款记录没有直接的paymentId
          action: action as any,
          description: this.getActionDescription(action),
          operatorId: userId,
          requestData: data ? JSON.stringify(data) : null,
          extra: data ? JSON.stringify({
            refundId,
            duration: data.duration
          }) : null
        }
      });

    } catch (error) {
      logger.error('记录退款操作日志失败', {
        refundId,
        action,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 获取操作描述
   */
  private getActionDescription(action: string): string {
    const descriptions: Record<string, string> = {
      'CREATE': '创建退款申请',
      'QUERY': '查询退款状态',
      'SUCCESS': '退款成功',
      'FAILED': '退款失败',
      'CANCEL': '取消退款',
      'PROCESS': '退款处理中'
    };

    return descriptions[action] || action;
  }
}

// 导出单例实例
export const refundService = RefundService.getInstance();