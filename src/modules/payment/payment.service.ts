/**
 * 中道商城支付服务 - 核心主控制器
 * 统一管理支付流程，协调各个子模块
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { pointsService } from '@/shared/services/points';
import { notificationService } from '@/shared/services/notification';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentChannel,
  RefundStatus,
  PaymentCreateRequest as CreatePaymentOrderRequest,
  PaymentCreateResponse as PaymentOrderResponse,
  PaymentQueryRequest as PaymentStatusQuery,
  RefundCreateRequest as RefundOrderRequest,
  RefundCreateResponse as RefundOrderResponse,
  ReconciliationResponse as PaymentReconciliationReport
} from './types';
import { paymentChannelFactory, PaymentRequest } from './channel-factory';
import { paymentCallbackHandler, CallbackRequest } from './callback-handler';
import { refundService, RefundRequest } from './refund.service';
import { paymentSecurity } from './payment-security';

// 回调请求接口（本地定义）
export interface PaymentCallbackRequest {
  channel: PaymentChannel;
  data: any;
  headers?: any;
}

// 回调响应接口（本地定义）
export interface PaymentCallbackResponse {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  message: string;
}

/**
 * 支付服务主控制器类
 */
export class PaymentService {
  private static instance: PaymentService;

  private constructor() {
    // 初始化各子模块
    paymentChannelFactory;
    paymentCallbackHandler;
    refundService;
    paymentSecurity;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  /**
   * 创建支付订单
   */
  async createPaymentOrder(request: CreatePaymentOrderRequest): Promise<PaymentOrderResponse> {
    const startTime = Date.now();

    try {
      // 1. 基本参数验证
      const validation = await this.validatePaymentRequest(request);
      if (!validation.isValid) {
        return {
          success: false,
          paymentId: '',
          paymentNo: '',
          message: validation.message,
          errors: validation.errors
        };
      }

      // 2. 安全检查
      const riskControl = await paymentSecurity.riskControlCheck(
        request.userId,
        request.amount,
        request.clientIp,
        request.userAgent
      );

      if (!riskControl.allowed) {
        return {
          success: false,
          paymentId: '',
          paymentNo: '',
          message: riskControl.reason || '安全检查失败',
          errors: riskControl.riskFactors
        };
      }

      // 3. 防重复支付检查
      const lockResult = await this.acquirePaymentLock(request);
      if (!lockResult.success) {
        return {
          success: false,
          paymentId: '',
          paymentNo: '',
          message: lockResult.message,
          errors: [lockResult.message]
        };
      }

      // 4. 创建支付记录
      const paymentRecord = await this.createPaymentRecord(request, riskControl.riskScore);

      // 5. 更新安全审计记录
      await this.updateSecurityAudit(paymentRecord.id, 'CREATE');

      // 6. 处理通券支付
      if (request.channel === PaymentChannel.POINTS) {
        return await this.handlePointsPayment(paymentRecord, request);
      }

      // 7. 调用支付渠道工厂处理支付
      const paymentRequest: PaymentRequest = {
        orderId: paymentRecord.paymentNo,
        amount: request.amount,
        subject: request.subject,
        description: request.description,
        clientIp: request.clientIp,
        userId: request.userId,
        extra: request.extra
      };

      const channelResponse = await paymentChannelFactory.processPayment(
        request.channel,
        paymentRequest
      );

      // 8. 记录日志
      await this.logPaymentAction(paymentRecord.id, 'CREATE', request.userId, {
        request,
        response: channelResponse,
        riskScore: riskControl.riskScore,
        duration: Date.now() - startTime
      });

      // 9. 处理渠道响应
      if (!channelResponse.success) {
        await this.updatePaymentStatus(paymentRecord.id, PaymentStatus.FAILED);

        return {
          success: false,
          paymentId: paymentRecord.id,
          paymentNo: paymentRecord.paymentNo,
          message: channelResponse.message || '支付渠道处理失败',
          errors: [channelResponse.message || '支付渠道处理失败']
        };
      }

      // 10. 更新支付记录中的渠道信息
      await this.updatePaymentChannelInfo(paymentRecord.id, {
        channelOrderId: channelResponse.providerOrderId,
        prepayId: channelResponse.prepayId,
        payInfo: channelResponse.payInfo,
        qrCode: channelResponse.qrCode,
        redirectUrl: channelResponse.redirectUrl
      });

      // 11. 返回成功响应
      return {
        success: true,
        paymentId: paymentRecord.id,
        paymentNo: paymentRecord.paymentNo,
        channelOrderId: channelResponse.providerOrderId,
        prepayId: channelResponse.prepayId,
        payInfo: channelResponse.payInfo,
        qrCode: channelResponse.qrCode,
        redirectUrl: channelResponse.redirectUrl
      };

    } catch (error) {
      logger.error('创建支付订单失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      return {
        success: false,
        paymentId: '',
        paymentNo: '',
        message: '创建支付订单失败: ' + (error instanceof Error ? error.message : '未知错误'),
        errors: [error instanceof Error ? error.message : '未知错误']
      };
    }
  }

  /**
   * 处理支付回调
   */
  async handlePaymentCallback(request: PaymentCallbackRequest): Promise<PaymentCallbackResponse> {
    try {
      // 委托给回调处理器处理
      const callbackRequest: CallbackRequest = {
        channel: request.channel,
        data: request.data,
        headers: request.headers
      };

      const response = await paymentCallbackHandler.handleCallback(callbackRequest);

      // 发送通知
      if (response.success && response.status === PaymentStatus.PAID) {
        await this.sendPaymentNotification(response.paymentId, response.status);
      }

      return response;

    } catch (error) {
      logger.error('处理支付回调失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        message: '处理支付回调失败: ' + (error instanceof Error ? error.message : '未知错误')
      };
    }
  }

  /**
   * 创建退款订单
   */
  async createRefundOrder(request: RefundOrderRequest): Promise<RefundOrderResponse> {
    try {
      // 委托给退款服务处理
      const refundRequest: RefundRequest = {
        paymentId: request.paymentId,
        refundAmount: request.refundAmount,
        refundReason: request.refundReason,
        applyUserId: request.applyUserId,
        operatorId: request.operatorId,
        extra: request.extra
      };

      return await refundService.createRefundOrder(refundRequest);

    } catch (error) {
      logger.error('创建退款订单失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误'
      });

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
   * 查询支付状态
   */
  async queryPaymentStatus(paymentId: string): Promise<any> {
    try {
      const paymentRecord = await this.findPaymentById(paymentId);
      if (!paymentRecord) {
        throw new Error('支付记录不存在');
      }

      // 如果是已支付状态，直接返回
      if (paymentRecord.status === PaymentStatus.PAID) {
        return {
          success: true,
          payment: paymentRecord
        };
      }

      // 对于通券支付，直接返回本地状态
      if (paymentRecord.paymentChannel === PaymentChannel.POINTS) {
        return {
          success: true,
          payment: paymentRecord
        };
      }

      // 对于第三方支付，委托给渠道工厂查询
      const paymentRequest: PaymentRequest = {
        orderId: paymentRecord.paymentNo,
        amount: paymentRecord.amount,
        subject: paymentRecord.subject || '',
        userId: paymentRecord.userId
      };

      const channelStatus = await paymentChannelFactory.processPayment(
        paymentRecord.paymentChannel,
        paymentRequest
      );

      if (channelStatus.success && channelStatus.providerOrderId) {
        // 更新本地状态
        await this.updatePaymentStatus(paymentRecord.id, PaymentStatus.PAID);

        // 重新获取记录
        const updatedRecord = await this.findPaymentById(paymentId);
        return {
          success: true,
          payment: updatedRecord
        };
      }

      return {
        success: true,
        payment: paymentRecord
      };

    } catch (error) {
      logger.error('查询支付状态失败', {
        paymentId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      throw error;
    }
  }

  /**
   * 获取支付列表
   */
  async getPaymentList(query: PaymentStatusQuery): Promise<any> {
    try {
      const where: any = {};

      if (query.paymentId) {
        where.id = query.paymentId;
      }
      if (query.paymentNo) {
        where.paymentNo = query.paymentNo;
      }
      if (query.orderId) {
        where.orderId = query.orderId;
      }
      if (query.userId) {
        where.userId = query.userId;
      }
      if (query.channel) {
        where.paymentChannel = query.channel;
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
        prisma.paymentRecords.findMany({
          where,
          include: {
            users: {
              select: {
                id: true,
                nickname: true,
                phone: true
              }
            },
            order: {
              select: {
                id: true,
                orderNo: true,
                type: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: perPage
        }),
        prisma.paymentRecords.count({ where })
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
      logger.error('获取支付列表失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });

      throw error;
    }
  }

  /**
   * 对账处理
   */
  async reconcilePayments(reconcileDate: Date, channel: PaymentChannel): Promise<PaymentReconciliationReport> {
    const startTime = Date.now();

    try {
      // 1. 获取系统支付记录
      const systemPayments = await this.getSystemPaymentsForReconciliation(reconcileDate, channel);

      // 2. 获取渠道支付记录（模拟实现）
      const channelPayments = await this.getChannelPaymentsForReconciliation(reconcileDate, channel);

      // 3. 进行对账比较
      const reconciliationDetails = this.performReconciliation(systemPayments, channelPayments);

      // 4. 统计结果
      const report = this.generateReconciliationReport(
        reconcileDate,
        channel,
        reconciliationDetails
      );

      // 5. 保存对账记录
      await this.saveReconciliationRecord(report);

      // 6. 记录日志
      await this.logReconciliationAction(report, Date.now() - startTime);

      return report;

    } catch (error) {
      logger.error('对账处理失败', {
        reconcileDate,
        channel,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  // ===== 私有方法 =====

  /**
   * 验证支付请求
   */
  private async validatePaymentRequest(request: CreatePaymentOrderRequest): Promise<{isValid: boolean, message: string, errors: string[]}> {
    const errors: string[] = [];

    // 基本参数验证
    if (!request.userId) {
      errors.push('用户ID不能为空');
    }
    if (request.amount <= 0) {
      errors.push('支付金额必须大于0');
    }
    if (!request.subject) {
      errors.push('支付主题不能为空');
    }

    // 渠道特定验证
    if (request.channel === PaymentChannel.POINTS) {
      // 通券支付验证
      const balance = await pointsService.getBalance(request.userId);
      if (balance.available < request.amount) {
        errors.push(`通券余额不足，当前可用: ${balance.available}，需要: ${request.amount}`);
      }
    }

    return {
      isValid: errors.length === 0,
      message: errors.join('; '),
      errors
    };
  }

  /**
   * 获取支付锁（防止重复支付）
   */
  private async acquirePaymentLock(request: CreatePaymentOrderRequest): Promise<{success: boolean, message: string}> {
    try {
      const lockKey = request.orderId
        ? `order:${request.orderId}:${request.userId}`
        : `user:${request.userId}:${request.amount}`;

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
          message: '存在未完成的支付，请勿重复提交'
        };
      }

      // 创建新的支付锁
      await prisma.paymentLocks.create({
        data: {
          lockKey,
          orderId: request.orderId || '',
          userId: request.userId,
          amount: request.amount,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15分钟
        }
      });

      return { success: true, message: '' };

    } catch (error) {
      logger.error('获取支付锁失败', { request, error });
      return {
        success: false,
        message: '系统繁忙，请稍后重试'
      };
    }
  }

  /**
   * 创建支付记录
   */
  private async createPaymentRecord(request: CreatePaymentOrderRequest, riskScore: number): Promise<any> {
    const paymentNo = this.generatePaymentNo();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时

    return await prisma.paymentRecords.create({
      data: {
        paymentNo,
        orderId: request.orderId,
        userId: request.userId,
        paymentChannel: request.channel,
        paymentMethod: request.method as PaymentMethod,
        amount: request.amount,
        currency: 'CNY',
        status: PaymentStatus.UNPAID,
        expiredAt: expiresAt,
        subject: request.subject,
        description: request.description,
        clientIp: request.clientIp,
        userAgent: request.userAgent,
        extra: request.extra ? JSON.stringify(request.extra) : null,
        riskScore
      }
    });
  }

  /**
   * 更新安全审计记录
   */
  private async updateSecurityAudit(paymentId: string, action: string): Promise<void> {
    try {
      await prisma.paymentSecurityAudit.updateMany({
        where: { paymentId },
        data: {
          action,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('更新安全审计记录失败', {
        paymentId,
        action,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 处理通券支付
   */
  private async handlePointsPayment(paymentRecord: any, request: CreatePaymentOrderRequest): Promise<PaymentOrderResponse> {
    try {
      // 扣减通券
      const deductResult = await pointsService.deduct({
        userId: request.userId,
        points: request.amount,
        description: `支付扣减 - ${paymentRecord.paymentNo}`
      });

      if (!deductResult.success) {
        throw new Error('通券扣减失败: ' + deductResult.message);
      }

      // 更新支付状态为成功
      await this.updatePaymentStatus(paymentRecord.id, PaymentStatus.PAID);

      // 处理支付成功后的业务逻辑
      await this.processPaymentSuccess(paymentRecord);

      return {
        success: true,
        paymentId: paymentRecord.id,
        paymentNo: paymentRecord.paymentNo,
        channelOrderId: deductResult.data?.transactionId,
        message: '通券支付成功'
      };

    } catch (error) {
      logger.error('处理通券支付失败', {
        paymentRecord,
        request,
        error: error instanceof Error ? error.message : '未知错误'
      });

      await this.updatePaymentStatus(paymentRecord.id, PaymentStatus.FAILED);

      return {
        success: false,
        paymentId: paymentRecord.id,
        paymentNo: paymentRecord.paymentNo,
        message: error instanceof Error ? error.message : '通券支付失败',
        errors: [error instanceof Error ? error.message : '通券支付失败']
      };
    }
  }

  /**
   * 更新支付记录的渠道信息
   */
  private async updatePaymentChannelInfo(paymentId: string, channelInfo: any): Promise<void> {
    await prisma.paymentRecords.update({
      where: { id: paymentId },
      data: channelInfo
    });
  }

  /**
   * 更新支付状态
   */
  private async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<void> {
    await prisma.paymentRecords.update({
      where: { id: paymentId },
      data: {
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : undefined
      }
    });
  }

  /**
   * 处理支付成功
   */
  private async processPaymentSuccess(paymentRecord: any): Promise<void> {
    try {
      // 如果是订单支付，更新订单状态
      if (paymentRecord.orderId) {
        await prisma.orders.update({
          where: { id: paymentRecord.orderId },
          data: {
            paymentStatus: PaymentStatus.PAID,
            paidAt: new Date()
          }
        });
      }

      // 释放支付锁
      await prisma.paymentLocks.updateMany({
        where: {
          orderId: paymentRecord.orderId || '',
          userId: paymentRecord.userId,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

    } catch (error) {
      logger.error('处理支付成功业务逻辑失败', {
        paymentId: paymentRecord.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 发送支付通知
   */
  private async sendPaymentNotification(paymentId: string, status: PaymentStatus): Promise<void> {
    try {
      const paymentRecord = await this.findPaymentById(paymentId);
      if (!paymentRecord) {
        return;
      }

      const templateCode = status === PaymentStatus.PAID ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED';

      await notificationService.send({
        userId: paymentRecord.userId,
        templateCode,
        data: {
          paymentNo: paymentRecord.paymentNo,
          amount: paymentRecord.amount,
          status: status,
          paidAt: paymentRecord.paidAt
        }
      });

    } catch (error) {
      logger.error('发送支付通知失败', {
        paymentId,
        status,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 记录支付操作日志
   */
  private async logPaymentAction(paymentId: string, action: string, userId?: string, data?: any): Promise<void> {
    try {
      await prisma.paymentLogs.create({
        data: {
          paymentId,
          action: action as any,
          description: this.getActionDescription(action),
          operatorId: userId,
          requestData: data ? JSON.stringify(data) : null,
          extra: data ? JSON.stringify({ duration: data.duration }) : null
        }
      });

    } catch (error) {
      logger.error('记录支付操作日志失败', {
        paymentId,
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
      'CREATE': '创建支付订单',
      'QUERY': '查询支付状态',
      'SUCCESS': '支付成功',
      'FAILED': '支付失败',
      'CANCEL': '取消支付',
      'CLOSE': '关闭支付',
      'EXPIRE': '支付过期',
      'NOTIFY': '支付回调'
    };

    return descriptions[action] || action;
  }

  /**
   * 根据支付ID查找记录
   */
  private async findPaymentById(paymentId: string): Promise<any> {
    return await prisma.paymentRecords.findUnique({
      where: { id: paymentId },
      include: {
        users: true,
        orders: true
      }
    });
  }

  /**
   * 生成支付单号
   */
  private generatePaymentNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PAY${timestamp}${random}`.toUpperCase();
  }

  // 对账相关方法
  private async getSystemPaymentsForReconciliation(reconcileDate: Date, channel: PaymentChannel): Promise<any[]> {
    const startDate = new Date(reconcileDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(reconcileDate);
    endDate.setHours(23, 59, 59, 999);

    return await prisma.paymentRecords.findMany({
      where: {
        paymentChannel: channel,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        paymentNo: true,
        channelOrderId: true,
        amount: true,
        status: true,
        createdAt: true
      }
    });
  }

  private async getChannelPaymentsForReconciliation(reconcileDate: Date, channel: PaymentChannel): Promise<any[]> {
    // 这里应该调用渠道API获取支付记录
    // 暂时返回空数组
    return [];
  }

  private performReconciliation(systemPayments: any[], channelPayments: any[]): any[] {
    // 这里实现具体的对账逻辑
    // 比较系统记录和渠道记录的一致性
    return [];
  }

  private generateReconciliationReport(reconcileDate: Date, channel: PaymentChannel, details: any[]): PaymentReconciliationReport {
    const reconcileNo = `REC${reconcileDate.getTime()}${Math.random().toString(36).substring(2, 8)}`.toUpperCase();

    // 统计数据
    const totalCount = details.length;
    const totalAmount = details.reduce((sum, item) => sum + item.amount, 0);
    const successCount = details.filter(item => item.isMatched && item.status === PaymentStatus.PAID).length;
    const successAmount = details
      .filter(item => item.isMatched && item.status === PaymentStatus.PAID)
      .reduce((sum, item) => sum + item.amount, 0);
    const failedCount = totalCount - successCount;
    const failedAmount = totalAmount - successAmount;

    return {
      success: true,
      reconcileNo,
      reconcileDate,
      channel,
      totalCount,
      totalAmount,
      successCount,
      successAmount,
      failedCount,
      failedAmount,
      details
    };
  }

  private async saveReconciliationRecord(report: PaymentReconciliationReport): Promise<void> {
    await prisma.paymentReconciliations.create({
      data: {
        reconcileNo: report.reconcileNo,
        reconcileDate: report.reconcileDate,
        totalCount: report.totalCount,
        totalAmount: report.totalAmount,
        successCount: report.successCount,
        successAmount: report.successAmount,
        failedCount: report.failedCount,
        failedAmount: report.failedAmount,
        status: 'SUCCESS' as any,
        extra: JSON.stringify(report.details)
      }
    });
  }

  private async logReconciliationAction(report: PaymentReconciliationReport, duration: number): Promise<void> {
    logger.info('对账处理完成', {
      reconcileNo: report.reconcileNo,
      reconcileDate: report.reconcileDate,
      channel: report.channel,
      totalCount: report.totalCount,
      successCount: report.successCount,
      failedCount: report.failedCount,
      totalAmount: report.totalAmount,
      successAmount: report.successAmount,
      duration
    });
  }
}

// 导出单例实例
export const paymentService = PaymentService.getInstance();