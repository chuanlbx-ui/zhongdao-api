// @ts-nocheck
/**
 * 中道商城支付服务 - 统一支付渠道集成与回调处理系统
 * 支持微信支付、支付宝支付和通券支付的完整支付流程
 */

import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { PaymentProviderFactory, ProviderType, PaymentProvider } from '../../shared/payments';
import { PaymentConfigLoader } from '../../config/payments';
import { PaymentMethod, PaymentStatus, PaymentChannel } from '@prisma/client';
import { pointsService } from '../../shared/services/points';
import { notificationService } from '../../shared/services/notification';

// 支付相关接口定义
export interface CreatePaymentOrderRequest {
  orderId?: string;
  userId: string;
  amount: number;
  channel: PaymentChannel;
  method: string;
  subject: string;
  description?: string;
  clientIp?: string;
  userAgent?: string;
  extra?: Record<string, any>;
}

export interface PaymentOrderResponse {
  success: boolean;
  paymentId: string;
  paymentNo: string;
  channelOrderId?: string;
  prepayId?: string;
  payInfo?: any;
  qrCode?: string;
  redirectUrl?: string;
  message?: string;
  errors?: string[];
}

export interface PaymentCallbackRequest {
  channel: PaymentChannel;
  data: any;
  headers?: any;
}

export interface PaymentCallbackResponse {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  message: string;
}

export interface RefundOrderRequest {
  paymentId: string;
  refundAmount: number;
  refundReason?: string;
  applyUserId: string;
  extra?: Record<string, any>;
}

export interface RefundOrderResponse {
  success: boolean;
  refundId: string;
  refundNo: string;
  channelRefundId?: string;
  message?: string;
  errors?: string[];
}

export interface PaymentStatusQuery {
  paymentId?: string;
  paymentNo?: string;
  orderId?: string;
  userId?: string;
  channel?: PaymentChannel;
  status?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
}

export interface PaymentReconciliationReport {
  reconcileNo: string;
  reconcileDate: Date;
  channel: PaymentChannel;
  totalCount: number;
  totalAmount: number;
  successCount: number;
  successAmount: number;
  failedCount: number;
  failedAmount: number;
  details: Array<{
    paymentId: string;
    paymentNo: string;
    amount: number;
    status: PaymentStatus;
    systemStatus: PaymentStatus;
    isMatched: boolean;
    difference?: string;
  }>;
}

/**
 * 支付服务类
 */
export class PaymentService {
  private readonly LOCK_EXPIRE_MINUTES = 15;
  private readonly PAYMENT_EXPIRE_HOURS = 24;

  constructor() {
    // 初始化支付系统
    PaymentConfigLoader.initializePaymentSystem();
  }

  /**
   * 创建支付订单
   */
  async createPaymentOrder(request: CreatePaymentOrderRequest): Promise<PaymentOrderResponse> {
    const startTime = Date.now();

    try {
      // 1. 验证请求参数
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

      // 2. 防重复支付检查
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

      // 3. 创建支付记录
      const paymentRecord = await this.createPaymentRecord(request);

      // 4. 调用第三方支付渠道
      const channelResponse = await this.processChannelPayment(paymentRecord, request);

      // 5. 记录日志
      await this.logPaymentAction(paymentRecord.id, 'CREATE', request.userId, {
        request,
        response: channelResponse,
        duration: Date.now() - startTime
      });

      if (!channelResponse.success) {
        // 支付渠道处理失败，更新支付状态
        await this.updatePaymentStatus(paymentRecord.id, PaymentStatus.FAILED);

        return {
          success: false,
          paymentId: paymentRecord.id,
          paymentNo: paymentRecord.paymentNo,
          message: channelResponse.message || '支付渠道处理失败',
          errors: [channelResponse.message || '支付渠道处理失败']
        };
      }

      // 6. 更新支付记录中的渠道信息
      await this.updatePaymentChannelInfo(paymentRecord.id, {
        channelOrderId: channelResponse.providerOrderId,
        prepayId: channelResponse.prepayId,
        payInfo: channelResponse.payInfo,
        qrCode: channelResponse.qrCode,
        redirectUrl: channelResponse.redirectUrl
      });

      // 7. 返回成功响应
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
    const startTime = Date.now();

    try {
      // 1. 验证回调数据
      const verification = await this.verifyCallback(request);
      if (!verification.isValid) {
        return {
          success: false,
          paymentId: '',
          status: PaymentStatus.FAILED,
          message: verification.message
        };
      }

      // 2. 查找支付记录
      const paymentRecord = await this.findPaymentByChannelOrderId(
        request.channel,
        verification.channelOrderId!
      );

      if (!paymentRecord) {
        logger.warn('支付记录未找到', {
          channel: request.channel,
          channelOrderId: verification.channelOrderId
        });

        return {
          success: false,
          paymentId: '',
          status: PaymentStatus.FAILED,
          message: '支付记录未找到'
        };
      }

      // 3. 检查支付状态是否已处理
      if (paymentRecord.status === PaymentStatus.PAID) {
        logger.info('支付已完成，重复回调', {
          paymentId: paymentRecord.id,
          paymentNo: paymentRecord.paymentNo
        });

        return {
          success: true,
          paymentId: paymentRecord.id,
          status: PaymentStatus.PAID,
          message: '支付已完成'
        };
      }

      // 4. 更新支付状态
      const newStatus = this.mapChannelStatusToPaymentStatus(verification.channelStatus);
      await this.updatePaymentStatusFromCallback(paymentRecord.id, {
        status: newStatus,
        channelTransactionId: verification.channelTransactionId,
        notifyData: JSON.stringify(request.data),
        notifiedAt: new Date()
      });

      // 5. 处理支付成功的业务逻辑
      if (newStatus === PaymentStatus.PAID) {
        await this.processPaymentSuccess(paymentRecord);
      }

      // 6. 记录回调日志
      await this.logPaymentAction(paymentRecord.id, 'NOTIFY', paymentRecord.userId, {
        channel: request.channel,
        callbackData: request.data,
        status: newStatus,
        duration: Date.now() - startTime
      });

      // 7. 发送通知
      await this.sendPaymentNotification(paymentRecord, newStatus);

      return {
        success: true,
        paymentId: paymentRecord.id,
        status: newStatus,
        message: '回调处理成功'
      };

    } catch (error) {
      logger.error('处理支付回调失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
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
    const startTime = Date.now();

    try {
      // 1. 查找支付记录
      const paymentRecord = await this.findPaymentById(request.paymentId);
      if (!paymentRecord) {
        return {
          success: false,
          refundId: '',
          refundNo: '',
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
          message: validation.message,
          errors: validation.errors
        };
      }

      // 3. 创建退款记录
      const refundRecord = await this.createRefundRecord(paymentRecord, request);

      // 4. 调用第三方退款
      const channelRefundResponse = await this.processChannelRefund(refundRecord, paymentRecord);

      // 5. 更新退款状态
      if (channelRefundResponse.success) {
        await this.updateRefundStatus(refundRecord.id, {
          status: 'PROCESSING',
          channelRefundId: channelRefundResponse.refundId,
        });
      } else {
        await this.updateRefundStatus(refundRecord.id, {
          status: 'FAILED',
          failedReason: channelRefundResponse.message
        });
      }

      // 6. 记录日志
      await this.logPaymentAction(paymentRecord.id, 'REFUND_CREATE', request.applyUserId, {
        request,
        response: channelRefundResponse,
        duration: Date.now() - startTime
      });

      return {
        success: channelRefundResponse.success,
        refundId: refundRecord.id,
        refundNo: refundRecord.refundNo,
        channelRefundId: channelRefundResponse.refundId,
        message: channelRefundResponse.message || (channelRefundResponse.success ? '退款申请成功' : '退款申请失败'),
        errors: channelRefundResponse.success ? undefined : [channelRefundResponse.message || '退款申请失败']
      };

    } catch (error) {
      logger.error('创建退款订单失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      return {
        success: false,
        refundId: '',
        refundNo: '',
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

      // 查询渠道状态
      const channelStatus = await this.queryChannelPaymentStatus(paymentRecord);

      if (channelStatus.success && channelStatus.status === 'SUCCESS') {
        // 更新本地状态
        await this.processPaymentSuccess(paymentRecord);

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
        prisma.paymentRecord.findMany({
          where,
          include: {
            user: {
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
        prisma.paymentRecord.count({ where })
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
   * 生成支付单号
   */
  private generatePaymentNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PAY${timestamp}${random}`.toUpperCase();
  }

  /**
   * 生成退款单号
   */
  private generateRefundNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `REF${timestamp}${random}`.toUpperCase();
  }

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
      const existingLock = await prisma.paymentLock.findFirst({
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
      await prisma.paymentLock.create({
        data: {
          lockKey,
          orderId: request.orderId || '',
          userId: request.userId,
          amount: request.amount,
          expiresAt: new Date(Date.now() + this.LOCK_EXPIRE_MINUTES * 60 * 1000)
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
  private async createPaymentRecord(request: CreatePaymentOrderRequest): Promise<any> {
    const paymentNo = this.generatePaymentNo();
    const expiresAt = new Date(Date.now() + this.PAYMENT_EXPIRE_HOURS * 60 * 60 * 1000);

    return await prisma.paymentRecord.create({
      data: {
        paymentNo,
        orderId: request.orderId,
        userId: request.userId,
        paymentChannel: request.channel,
        paymentMethod: request.method as PaymentMethod,
        amount: request.amount,
        currency: 'CNY',
        status: PaymentStatus.UNPAID,
        expiredAt,
        subject: request.subject,
        description: request.description,
        clientIp: request.clientIp,
        userAgent: request.userAgent,
        extra: request.extra ? JSON.stringify(request.extra) : null
      }
    });
  }

  /**
   * 处理渠道支付
   */
  private async processChannelPayment(paymentRecord: any, request: CreatePaymentOrderRequest): Promise<any> {
    try {
      if (request.channel === PaymentChannel.POINTS) {
        // 通券支付处理
        return await this.processPointsPayment(paymentRecord, request);
      } else {
        // 第三方支付渠道处理
        const provider = PaymentProviderFactory.createProvider(request.channel as ProviderType);

        const paymentRequest = {
          orderId: paymentRecord.paymentNo,
          amount: request.amount,
          subject: request.subject,
          description: request.description,
          notifyUrl: this.getNotifyUrl(request.channel),
          returnUrl: request.extra?.returnUrl,
          clientIp: request.clientIp,
          userId: request.userId,
          extra: request.extra
        };

        return await provider.createPayment(paymentRequest);
      }
    } catch (error) {
      logger.error('处理渠道支付失败', {
        paymentRecord,
        request,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : '支付渠道处理失败'
      };
    }
  }

  /**
   * 处理通券支付
   */
  private async processPointsPayment(paymentRecord: any, request: CreatePaymentOrderRequest): Promise<any> {
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

      return {
        success: true,
        providerOrderId: deductResult.data?.transactionId,
        message: '通券支付成功'
      };

    } catch (error) {
      logger.error('处理通券支付失败', {
        paymentRecord,
        request,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : '通券支付失败'
      };
    }
  }

  /**
   * 获取回调通知URL
   */
  private getNotifyUrl(channel: PaymentChannel): string {
    const baseUrl = process.env.API_BASE_URL || 'https://api.zhongdao-mall.com';

    switch (channel) {
      case PaymentChannel.WECHAT:
        return `${baseUrl}/api/v1/payments/wechat/notify`;
      case PaymentChannel.ALIPAY:
        return `${baseUrl}/api/v1/payments/alipay/notify`;
      default:
        return '';
    }
  }

  /**
   * 验证回调数据
   */
  private async verifyCallback(request: PaymentCallbackRequest): Promise<{isValid: boolean, message: string, channelOrderId?: string, channelStatus?: string, channelTransactionId?: string}> {
    try {
      const provider = PaymentProviderFactory.createProvider(request.channel as ProviderType);

      const notifyData = await provider.verifyNotify(request.data, request.headers);

      if (!notifyData) {
        return {
          isValid: false,
          message: '回调数据验证失败'
        };
      }

      return {
        isValid: true,
        message: '验证成功',
        channelOrderId: notifyData.orderId || notifyData.providerOrderId,
        channelStatus: notifyData.tradeStatus,
        channelTransactionId: notifyData.transactionId
      };

    } catch (error) {
      logger.error('验证回调数据失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        isValid: false,
        message: '回调数据验证失败: ' + (error instanceof Error ? error.message : '未知错误')
      };
    }
  }

  /**
   * 根据渠道订单号查找支付记录
   */
  private async findPaymentByChannelOrderId(channel: PaymentChannel, channelOrderId: string): Promise<any> {
    return await prisma.paymentRecord.findFirst({
      where: {
        channelOrderId,
        paymentChannel: channel
      }
    });
  }

  /**
   * 根据支付ID查找记录
   */
  private async findPaymentById(paymentId: string): Promise<any> {
    return await prisma.paymentRecord.findUnique({
      where: { id: paymentId },
      include: {
        user: true,
        order: true
      }
    });
  }

  /**
   * 映射渠道状态到支付状态
   */
  private mapChannelStatusToPaymentStatus(channelStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'SUCCESS': PaymentStatus.PAID,
      'PAID': PaymentStatus.PAID,
      'FINISHED': PaymentStatus.PAID,
      'FAILED': PaymentStatus.FAILED,
      'CLOSED': PaymentStatus.CANCELLED,
      'CANCELLED': PaymentStatus.CANCELLED,
      'EXPIRED': PaymentStatus.EXPIRED
    };

    return statusMap[channelStatus] || PaymentStatus.UNPAID;
  }

  /**
   * 从回调更新支付状态
   */
  private async updatePaymentStatusFromCallback(paymentId: string, updateData: any): Promise<void> {
    await prisma.paymentRecord.update({
      where: { id: paymentId },
      data: updateData
    });
  }

  /**
   * 处理支付成功
   */
  private async processPaymentSuccess(paymentRecord: any): Promise<void> {
    try {
      // 如果是订单支付，更新订单状态
      if (paymentRecord.orderId) {
        await this.updateOrderPaymentStatus(paymentRecord.orderId);
      }

      // 释放支付锁
      await this.releasePaymentLock(paymentRecord.userId, paymentRecord.orderId);

    } catch (error) {
      logger.error('处理支付成功业务逻辑失败', {
        paymentId: paymentRecord.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 更新订单支付状态
   */
  private async updateOrderPaymentStatus(orderId: string): Promise<void> {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.PAID,
        paidAt: new Date()
      }
    });
  }

  /**
   * 释放支付锁
   */
  private async releasePaymentLock(userId: string, orderId?: string): Promise<void> {
    const lockKey = orderId
      ? `order:${orderId}:${userId}`
      : `user:${userId}`;

    await prisma.paymentLock.updateMany({
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
   * 发送支付通知
   */
  private async sendPaymentNotification(paymentRecord: any, status: PaymentStatus): Promise<void> {
    try {
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
        paymentRecord,
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
      await prisma.paymentLog.create({
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
      'NOTIFY': '支付回调',
      'REFUND_CREATE': '创建退款',
      'REFUND_SUCCESS': '退款成功',
      'REFUND_FAILED': '退款失败'
    };

    return descriptions[action] || action;
  }

  /**
   * 更新支付记录的渠道信息
   */
  private async updatePaymentChannelInfo(paymentId: string, channelInfo: any): Promise<void> {
    await prisma.paymentRecord.update({
      where: { id: paymentId },
      data: channelInfo
    });
  }

  /**
   * 更新支付状态
   */
  private async updatePaymentStatus(paymentId: string, status: PaymentStatus): Promise<void> {
    await prisma.paymentRecord.update({
      where: { id: paymentId },
      data: {
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : undefined
      }
    });
  }

  /**
   * 验证退款请求
   */
  private async validateRefundRequest(paymentRecord: any, request: RefundOrderRequest): Promise<{isValid: boolean, message: string, errors: string[]}> {
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
    const existingRefunds = await prisma.paymentRefund.findMany({
      where: { paymentId: request.paymentId }
    });

    const totalRefunded = existingRefunds.reduce((sum, refund) => sum + refund.refundAmount, 0);
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
   * 创建退款记录
   */
  private async createRefundRecord(paymentRecord: any, request: RefundOrderRequest): Promise<any> {
    const refundNo = this.generateRefundNo();

    return await prisma.paymentRefund.create({
      data: {
        refundNo,
        paymentId: request.paymentId,
        refundAmount: request.refundAmount,
        refundReason: request.refundReason,
        applyUserId: request.applyUserId,
        status: 'PENDING' as any,
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
          refundId: refundResult.data?.transactionId,
          message: refundResult.message || (refundResult.success ? '通券退款成功' : '通券退款失败')
        };
      } else {
        // 第三方支付渠道退款
        const provider = PaymentProviderFactory.createProvider(paymentRecord.paymentChannel as ProviderType);

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
    await prisma.paymentRefund.update({
      where: { id: refundId },
      data: {
        ...updateData,
        refundedAt: updateData.status === 'SUCCESS' ? new Date() : undefined
      }
    });
  }

  /**
   * 查询渠道支付状态
   */
  private async queryChannelPaymentStatus(paymentRecord: any): Promise<any> {
    try {
      if (paymentRecord.paymentChannel === PaymentChannel.POINTS) {
        // 通券支付状态查询
        return {
          success: true,
          status: paymentRecord.status === PaymentStatus.PAID ? 'SUCCESS' : 'FAILED'
        };
      } else {
        // 第三方支付渠道状态查询
        const provider = PaymentProviderFactory.createProvider(paymentRecord.paymentChannel as ProviderType);
        return await provider.queryPayment(paymentRecord.paymentNo);
      }
    } catch (error) {
      logger.error('查询渠道支付状态失败', {
        paymentRecord,
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
   * 获取系统支付记录用于对账
   */
  private async getSystemPaymentsForReconciliation(reconcileDate: Date, channel: PaymentChannel): Promise<any[]> {
    const startDate = new Date(reconcileDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(reconcileDate);
    endDate.setHours(23, 59, 59, 999);

    return await prisma.paymentRecord.findMany({
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

  /**
   * 获取渠道支付记录用于对账（模拟实现）
   */
  private async getChannelPaymentsForReconciliation(reconcileDate: Date, channel: PaymentChannel): Promise<any[]> {
    // 这里应该调用渠道API获取支付记录
    // 暂时返回空数组
    return [];
  }

  /**
   * 执行对账比较
   */
  private performReconciliation(systemPayments: any[], channelPayments: any[]): any[] {
    // 这里实现具体的对账逻辑
    // 比较系统记录和渠道记录的一致性
    return [];
  }

  /**
   * 生成对账报告
   */
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

  /**
   * 保存对账记录
   */
  private async saveReconciliationRecord(report: PaymentReconciliationReport): Promise<void> {
    await prisma.paymentReconciliation.create({
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

  /**
   * 记录对账操作
   */
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

// 导出支付服务实例
export const paymentService = new PaymentService();