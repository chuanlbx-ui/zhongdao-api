/**
 * 支付回调处理器
 * 负责处理异步支付回调、重试机制和状态同步
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { PaymentProviderFactory, ProviderType } from '@/shared/payments';
import { PaymentChannel, PaymentStatus } from './types';

export interface CallbackRequest {
  channel: PaymentChannel;
  data: any;
  headers?: any;
  ip?: string;
}

export interface CallbackResponse {
  success: boolean;
  paymentId: string;
  status: PaymentStatus;
  message: string;
  shouldRetry?: boolean;
}

export interface CallbackVerification {
  isValid: boolean;
  message: string;
  channelOrderId?: string;
  channelStatus?: string;
  channelTransactionId?: string;
}

export interface CallbackQueueItem {
  id: string;
  channel: PaymentChannel;
  paymentId: string;
  data: any;
  headers?: any;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date;
  createdAt: Date;
}

/**
 * 回调处理器类
 */
export class PaymentCallbackHandler {
  private static instance: PaymentCallbackHandler;
  private readonly MAX_RETRY_COUNT = 3;
  private readonly RETRY_DELAY_BASE = 1000; // 1秒基础延迟
  private processingCallbacks: Set<string> = new Set();

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): PaymentCallbackHandler {
    if (!PaymentCallbackHandler.instance) {
      PaymentCallbackHandler.instance = new PaymentCallbackHandler();
    }
    return PaymentCallbackHandler.instance;
  }

  /**
   * 处理支付回调
   */
  public async handleCallback(request: CallbackRequest): Promise<CallbackResponse> {
    const startTime = Date.now();
    let paymentRecord = null;

    try {
      // 1. 验证回调数据
      const verification = await this.verifyCallback(request);
      if (!verification.isValid) {
        logger.error('回调验证失败', {
          channel: request.channel,
          error: verification.message
        });
        return {
          success: false,
          paymentId: '',
          status: PaymentStatus.FAILED,
          message: verification.message
        };
      }

      // 2. 查找支付记录
      paymentRecord = await this.findPaymentByChannelOrderId(
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

      // 3. 防重复处理
      const callbackKey = `${paymentRecord.id}:${verification.channelTransactionId}`;
      if (this.processingCallbacks.has(callbackKey)) {
        return {
          success: true,
          paymentId: paymentRecord.id,
          status: PaymentStatus.UNPAID,
          message: '正在处理中'
        };
      }

      this.processingCallbacks.add(callbackKey);

      // 4. 检查支付状态是否已处理
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

      // 5. 映射渠道状态
      const newStatus = this.mapChannelStatusToPaymentStatus(verification.channelStatus);

      // 6. 更新支付状态
      await this.updatePaymentStatus(paymentRecord.id, {
        status: newStatus,
        channelTransactionId: verification.channelTransactionId,
        notifyData: JSON.stringify(request.data),
        notifiedAt: new Date()
      });

      // 7. 记录回调日志
      await this.logCallbackAction(paymentRecord.id, request, {
        verification,
        newStatus,
        duration: Date.now() - startTime
      });

      // 8. 处理支付成功后的业务逻辑
      if (newStatus === PaymentStatus.PAID) {
        await this.processPaymentSuccess(paymentRecord);
      }

      logger.info('回调处理成功', {
        paymentId: paymentRecord.id,
        channel: request.channel,
        status: newStatus,
        duration: Date.now() - startTime
      });

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

      // 如果有支付记录且错误可重试，加入队列
      if (paymentRecord && this.shouldRetryError(error)) {
        await this.addToRetryQueue(paymentRecord, request);
      }

      return {
        success: false,
        paymentId: paymentRecord?.id || '',
        status: PaymentStatus.FAILED,
        message: '处理支付回调失败: ' + (error instanceof Error ? error.message : '未知错误'),
        shouldRetry: this.shouldRetryError(error)
      };

    } finally {
      // 清理处理中的回调标记
      if (paymentRecord) {
        this.processingCallbacks.delete(`${paymentRecord.id}`);
      }
    }
  }

  /**
   * 验证回调数据
   */
  private async verifyCallback(request: CallbackRequest): Promise<CallbackVerification> {
    try {
      const provider = PaymentProviderFactory.createProvider(request.channel as ProviderType);
      const notifyData = await provider.verifyNotify(request.data, request.headers);

      if (!notifyData) {
        return {
          isValid: false,
          message: '回调数据验证失败'
        };
      }

      // 验证IP白名单（如果配置了）
      const ipValid = await this.verifyCallbackIp(request.channel, request.ip);
      if (!ipValid) {
        return {
          isValid: false,
          message: '回调来源IP验证失败'
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
   * 验证回调来源IP
   */
  private async verifyCallbackIp(channel: PaymentChannel, ip?: string): Promise<boolean> {
    if (!ip) {
      return true; // 如果没有IP信息，跳过验证
    }

    try {
      // 获取渠道允许的IP列表
      const allowedIps = await this.getAllowedCallbackIps(channel);

      if (allowedIps.length === 0) {
        return true; // 如果没有配置IP白名单，跳过验证
      }

      return allowedIps.includes(ip);

    } catch (error) {
      logger.error('验证回调IP失败', {
        channel,
        ip,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return true; // 验证失败时默认通过，避免阻塞正常流程
    }
  }

  /**
   * 获取允许的回调IP列表
   */
  private async getAllowedCallbackIps(channel: PaymentChannel): Promise<string[]> {
    // 这里应该从配置或数据库获取IP白名单
    // 暂时返回空列表
    return [];
  }

  /**
   * 根据渠道订单号查找支付记录
   */
  private async findPaymentByChannelOrderId(
    channel: PaymentChannel,
    channelOrderId: string
  ): Promise<any> {
    return await prisma.paymentRecords.findFirst({
      where: {
        channelOrderId,
        paymentChannel: channel
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
      'CLOSED': PaymentStatus.FAILED,
      'CANCELLED': PaymentStatus.FAILED,
      'EXPIRED': PaymentStatus.FAILED,
      'USERPAYING': PaymentStatus.PAYING,
      'WAIT_BUYER_PAY': PaymentStatus.UNPAID
    };

    return statusMap[channelStatus] || PaymentStatus.UNPAID;
  }

  /**
   * 更新支付状态
   */
  private async updatePaymentStatus(paymentId: string, updateData: any): Promise<void> {
    await prisma.paymentRecords.update({
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

      // 发送通知
      // 这里会由PaymentService统一处理

    } catch (error) {
      logger.error('处理支付成功业务逻辑失败', {
        paymentId: paymentRecord.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 记录回调日志
   */
  private async logCallbackAction(
    paymentId: string,
    request: CallbackRequest,
    data: any
  ): Promise<void> {
    try {
      await prisma.paymentLogs.create({
        data: {
          paymentId,
          action: 'NOTIFY',
          description: '处理支付回调',
          requestData: JSON.stringify({
            channel: request.channel,
            callbackData: request.data,
            headers: request.headers,
            ip: request.ip
          }),
          extra: JSON.stringify({
            verification: data.verification,
            status: data.newStatus,
            duration: data.duration
          })
        }
      });
    } catch (error) {
      logger.error('记录回调日志失败', {
        paymentId,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 判断错误是否可重试
   */
  private shouldRetryError(error: any): boolean {
    // 网络错误、超时等可重试
    if (error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // 数据库连接错误可重试
    if (error.code === 'ECONNREFUSED' ||
        error.code === 'CONNECTION_LOST') {
      return true;
    }

    return false;
  }

  /**
   * 添加到重试队列
   */
  private async addToRetryQueue(
    paymentRecord: any,
    request: CallbackRequest
  ): Promise<void> {
    try {
      const id = `callback_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const delay = this.calculateRetryDelay(0);

      await prisma.callbackRetryQueue.create({
        data: {
          id,
          paymentId: paymentRecord.id,
          channel: request.channel,
          requestData: JSON.stringify(request),
          retryCount: 0,
          maxRetries: this.MAX_RETRY_COUNT,
          nextRetryAt: new Date(Date.now() + delay),
          createdAt: new Date()
        }
      });

      logger.info('回调已加入重试队列', {
        paymentId: paymentRecord.id,
        id
      });

    } catch (error) {
      logger.error('添加到重试队列失败', {
        paymentId: paymentRecord.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(retryCount: number): number {
    // 指数退避算法
    return this.RETRY_DELAY_BASE * Math.pow(2, retryCount);
  }

  /**
   * 处理重试队列
   */
  public async processRetryQueue(): Promise<void> {
    try {
      const now = new Date();

      // 获取需要重试的回调
      const retryItems = await prisma.callbackRetryQueue.findMany({
        where: {
          nextRetryAt: { lte: now },
          retryCount: { lt: this.MAX_RETRY_COUNT }
        },
        take: 50 // 每次最多处理50个
      });

      logger.info('开始处理回调重试队列', {
        count: retryItems.length
      });

      for (const item of retryItems) {
        try {
          const request = JSON.parse(item.requestData);

          // 处理回调
          await this.handleCallback(request);

          // 删除成功的重试项
          await prisma.callbackRetryQueue.delete({
            where: { id: item.id }
          });

        } catch (error) {
          // 更新重试信息
          const newRetryCount = item.retryCount + 1;
          const shouldRetry = newRetryCount < this.MAX_RETRY_COUNT;

          if (shouldRetry) {
            const delay = this.calculateRetryDelay(newRetryCount);

            await prisma.callbackRetryQueue.update({
              where: { id: item.id },
              data: {
                retryCount: newRetryCount,
                nextRetryAt: new Date(Date.now() + delay)
              }
            });
          } else {
            // 达到最大重试次数，标记为失败
            await prisma.callbackRetryQueue.update({
              where: { id: item.id },
              data: {
                retryCount: newRetryCount,
                nextRetryAt: new Date(0), // 永不过期
                status: 'FAILED'
              }
            });
          }

          logger.error('回调重试失败', {
            id: item.id,
            retryCount: newRetryCount,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      }

    } catch (error) {
      logger.error('处理回调重试队列失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
}

// 导出单例实例
export const paymentCallbackHandler = PaymentCallbackHandler.getInstance();