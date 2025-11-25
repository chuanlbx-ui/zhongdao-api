/**
 * 支付回调处理系统
 * 统一处理微信支付和支付宝的异步回调通知
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { PaymentStatus, PaymentChannel } from '@prisma/client';
import { paymentService } from './payment.service';
import { wechatPaymentAdapter } from './wechat.provider';
import { alipayPaymentAdapter } from './alipay.provider';
import { pointsService } from '../../shared/services/points';
import { notificationService } from '../../shared/services/notification';

export interface CallbackRequest {
  body: any;
  headers: any;
  rawBody?: string;
  ip?: string;
}

export interface CallbackResponse {
  success: boolean;
  paymentId: string;
  paymentNo: string;
  status: PaymentStatus;
  message: string;
  shouldRespondChannel: boolean;
  channelResponse?: any;
}

export interface CallbackHandlerOptions {
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableSignatureVerification?: boolean;
  enableDuplicateCheck?: boolean;
  duplicateCheckWindow?: number; // 重复检查时间窗口（秒）
}

/**
 * 支付回调处理器
 */
export class PaymentCallbackHandler {
  private options: CallbackHandlerOptions;
  private processingCallbacks = new Set<string>(); // 防重复处理

  constructor(options: CallbackHandlerOptions = {}) {
    this.options = {
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableSignatureVerification: true,
      enableDuplicateCheck: true,
      duplicateCheckWindow: 300, // 5分钟
      ...options
    };
  }

  /**
   * 处理支付回调（统一入口）
   */
  async handlePaymentCallback(req: CallbackRequest, channel: PaymentChannel): Promise<Response> {
    const callbackId = this.generateCallbackId(req, channel);
    const startTime = Date.now();

    try {
      logger.info('开始处理支付回调', {
        callbackId,
        channel,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      // 1. 重复回调检查
      if (this.options.enableDuplicateCheck && this.processingCallbacks.has(callbackId)) {
        logger.warn('检测到重复回调', { callbackId, channel });
        return this.getChannelSuccessResponse(channel);
      }

      this.processingCallbacks.add(callbackId);

      try {
        // 2. 预处理回调数据
        const preprocessedData = await this.preprocessCallbackData(req, channel);

        // 3. 验证回调签名
        if (this.options.enableSignatureVerification) {
          const signatureValid = await this.verifyCallbackSignature(req, channel);
          if (!signatureValid) {
            logger.error('回调签名验证失败', {
              callbackId,
              channel,
              headers: this.getSignatureHeaders(req, channel)
            });
            return this.getChannelErrorResponse(channel, '签名验证失败');
          }
        }

        // 4. 业务处理
        const callbackResult = await this.processCallbackBusiness(preprocessedData, channel);

        // 5. 清理重复检查标记
        setTimeout(() => {
          this.processingCallbacks.delete(callbackId);
        }, this.options.duplicateCheckWindow! * 1000);

        // 6. 记录处理日志
        await this.logCallbackProcessing({
          callbackId,
          channel,
          request: req.body,
          response: callbackResult,
          success: callbackResult.success,
          duration: Date.now() - startTime
        });

        // 7. 返回渠道响应
        if (callbackResult.shouldRespondChannel) {
          return this.getChannelSuccessResponse(channel, callbackResult.channelResponse);
        } else {
          return this.getDefaultSuccessResponse();
        }

      } finally {
        this.processingCallbacks.delete(callbackId);
      }

    } catch (error) {
      logger.error('处理支付回调失败', {
        callbackId,
        channel,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      this.processingCallbacks.delete(callbackId);

      return this.getChannelErrorResponse(channel, error instanceof Error ? error.message : '处理失败');
    }
  }

  /**
   * 处理微信支付回调
   */
  async handleWechatCallback(req: CallbackRequest): Promise<Response> {
    try {
      logger.info('处理微信支付回调', {
        headers: this.getSignatureHeaders(req, PaymentChannel.WECHAT)
      });

      // 验证回调数据
      const notifyData = await wechatPaymentAdapter.verifyNotify(req.body, req.headers);

      // 处理回调业务逻辑
      const result = await paymentService.handlePaymentCallback({
        channel: PaymentChannel.WECHAT,
        data: req.body,
        headers: req.headers
      });

      // 微信支付需要返回特定的响应格式
      return this.getWechatCallbackResponse(result.success);

    } catch (error) {
      logger.error('处理微信支付回调失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body
      });

      return this.getWechatCallbackResponse(false);
    }
  }

  /**
   * 处理支付宝回调
   */
  async handleAlipayCallback(req: CallbackRequest): Promise<Response> {
    try {
      logger.info('处理支付宝回调', {
        notifyType: req.body.notify_type,
        tradeNo: req.body.trade_no
      });

      // 验证回调数据
      const notifyData = await alipayPaymentAdapter.verifyNotify(req.body, req.headers);

      // 处理回调业务逻辑
      const result = await paymentService.handlePaymentCallback({
        channel: PaymentChannel.ALIPAY,
        data: req.body,
        headers: req.headers
      });

      // 支付宝回调返回文本响应
      return this.getAlipayCallbackResponse(result.success);

    } catch (error) {
      logger.error('处理支付宝回调失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body
      });

      return this.getAlipayCallbackResponse(false);
    }
  }

  /**
   * 处理退款回调
   */
  async handleRefundCallback(req: CallbackRequest, channel: PaymentChannel): Promise<Response> {
    try {
      logger.info('处理退款回调', {
        channel,
        refundId: req.body.refund_id || req.body.out_request_no
      });

      // 1. 验证退款回调签名
      if (this.options.enableSignatureVerification) {
        const signatureValid = await this.verifyRefundCallbackSignature(req, channel);
        if (!signatureValid) {
          logger.error('退款回调签名验证失败', { channel });
          return this.getChannelErrorResponse(channel, '签名验证失败');
        }
      }

      // 2. 解析退款回调数据
      const refundData = await this.parseRefundCallbackData(req, channel);

      // 3. 查找退款记录
      const refundRecord = await this.findRefundRecord(refundData.refundId, refundData.channelRefundId);
      if (!refundRecord) {
        logger.warn('退款记录未找到', { refundData });
        return this.getChannelSuccessResponse(channel);
      }

      // 4. 更新退款状态
      await this.updateRefundStatusFromCallback(refundRecord.id, {
        status: refundData.status,
        channelTransactionId: refundData.channelTransactionId,
        notifyData: JSON.stringify(req.body),
        notifiedAt: new Date()
      });

      // 5. 处理退款成功业务逻辑
      if (refundData.status === 'SUCCESS') {
        await this.processRefundSuccess(refundRecord);
      }

      logger.info('退款回调处理成功', {
        refundId: refundRecord.id,
        status: refundData.status
      });

      return this.getChannelSuccessResponse(channel);

    } catch (error) {
      logger.error('处理退款回调失败', {
        channel,
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body
      });

      return this.getChannelErrorResponse(channel, error instanceof Error ? error.message : '处理失败');
    }
  }

  // ===== 私有方法 =====

  /**
   * 生成回调ID（用于重复检查）
   */
  private generateCallbackId(req: CallbackRequest, channel: PaymentChannel): string {
    const key = channel === PaymentChannel.WECHAT
      ? `${req.body.transaction_id || req.body.out_trade_no}`
      : `${req.body.trade_no || req.body.out_trade_no}`;

    return `${channel}_${key}_${Math.floor(Date.now() / (this.options.duplicateCheckWindow! * 1000))}`;
  }

  /**
   * 预处理回调数据
   */
  private async preprocessCallbackData(req: CallbackRequest, channel: PaymentChannel): Promise<any> {
    switch (channel) {
      case PaymentChannel.WECHAT:
        return await wechatPaymentAdapter.verifyNotify(req.body, req.headers);
      case PaymentChannel.ALIPAY:
        return await alipayPaymentAdapter.verifyNotify(req.body, req.headers);
      default:
        throw new Error(`不支持的支付渠道: ${channel}`);
    }
  }

  /**
   * 验证回调签名
   */
  private async verifyCallbackSignature(req: CallbackRequest, channel: PaymentChannel): Promise<boolean> {
    try {
      switch (channel) {
        case PaymentChannel.WECHAT:
          const wechatNotifyData = await wechatPaymentAdapter.verifyNotify(req.body, req.headers);
          return !!wechatNotifyData;
        case PaymentChannel.ALIPAY:
          const alipayNotifyData = await alipayPaymentAdapter.verifyNotify(req.body, req.headers);
          return !!alipayNotifyData;
        default:
          return true;
      }
    } catch (error) {
      logger.error('验证回调签名异常', {
        channel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 验证退款回调签名
   */
  private async verifyRefundCallbackSignature(req: CallbackRequest, channel: PaymentChannel): Promise<boolean> {
    try {
      // 这里应该实现具体的退款回调签名验证逻辑
      // 暂时返回true
      return true;
    } catch (error) {
      logger.error('验证退款回调签名异常', {
        channel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 处理回调业务逻辑
   */
  private async processCallbackBusiness(callbackData: any, channel: PaymentChannel): Promise<CallbackResponse> {
    try {
      const result = await paymentService.handlePaymentCallback({
        channel,
        data: callbackData.raw || callbackData,
        headers: {}
      });

      return {
        success: result.success,
        paymentId: result.paymentId,
        paymentNo: result.paymentNo || '',
        status: result.status,
        message: result.message,
        shouldRespondChannel: true
      };

    } catch (error) {
      logger.error('处理回调业务逻辑失败', {
        channel,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        paymentId: '',
        paymentNo: '',
        status: PaymentStatus.FAILED,
        message: error instanceof Error ? error.message : '处理失败',
        shouldRespondChannel: true
      };
    }
  }

  /**
   * 解析退款回调数据
   */
  private async parseRefundCallbackData(req: CallbackRequest, channel: PaymentChannel): Promise<any> {
    switch (channel) {
      case PaymentChannel.WECHAT:
        return {
          refundId: req.body.out_refund_no,
          channelRefundId: req.body.refund_id,
          status: this.mapWechatRefundStatus(req.body.refund_status),
          channelTransactionId: req.body.refund_id,
          refundAmount: req.body.amount ? parseInt(req.body.amount) / 100 : 0
        };
      case PaymentChannel.ALIPAY:
        return {
          refundId: req.body.out_request_no,
          channelRefundId: req.body.trade_no,
          status: this.mapAlipayRefundStatus(req.body.refund_status),
          channelTransactionId: req.body.trade_no,
          refundAmount: req.body.refund_fee ? parseFloat(req.body.refund_fee) : 0
        };
      default:
        throw new Error(`不支持的支付渠道: ${channel}`);
    }
  }

  /**
   * 查找退款记录
   */
  private async findRefundRecord(refundId: string, channelRefundId?: string): Promise<any> {
    return await prisma.paymentRefund.findFirst({
      where: {
        OR: [
          { refundNo: refundId },
          { channelRefundId: channelRefundId }
        ]
      },
      include: {
        payment: {
          include: {
            user: true,
            order: true
          }
        }
      }
    });
  }

  /**
   * 从回调更新退款状态
   */
  private async updateRefundStatusFromCallback(refundId: string, updateData: any): Promise<void> {
    await prisma.paymentRefund.update({
      where: { id: refundId },
      data: {
        status: updateData.status === 'SUCCESS' ? 'SUCCESS' as any :
               updateData.status === 'FAILED' ? 'FAILED' as any : 'PROCESSING' as any,
        channelTransactionId: updateData.channelTransactionId,
        notifyData: updateData.notifyData,
        notifiedAt: updateData.notifiedAt,
        refundedAt: updateData.status === 'SUCCESS' ? new Date() : undefined
      }
    });
  }

  /**
   * 处理退款成功
   */
  private async processRefundSuccess(refundRecord: any): Promise<void> {
    try {
      // 如果是通券支付，需要返还通券
      if (refundRecord.payment.paymentChannel === PaymentChannel.POINTS) {
        await pointsService.credit({
          userId: refundRecord.payment.userId,
          points: refundRecord.refundAmount,
          description: `退款返还 - ${refundRecord.refundNo}`
        });
      }

      // 发送退款成功通知
      await notificationService.send({
        userId: refundRecord.payment.userId,
        templateCode: 'REFUND_SUCCESS',
        data: {
          refundNo: refundRecord.refundNo,
          paymentNo: refundRecord.payment.paymentNo,
          refundAmount: refundRecord.refundAmount,
          refundedAt: new Date().toISOString()
        }
      });

      // 如果是订单退款，更新订单状态
      if (refundRecord.payment.orderId) {
        await this.updateOrderRefundStatus(refundRecord.payment.orderId);
      }

    } catch (error) {
      logger.error('处理退款成功业务逻辑失败', {
        refundId: refundRecord.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 更新订单退款状态
   */
  private async updateOrderRefundStatus(orderId: string): Promise<void> {
    // 检查订单是否所有退款都已完成
    const totalRefunds = await prisma.paymentRefund.count({
      where: {
        payment: {
          orderId: orderId
        }
      }
    });

    const completedRefunds = await prisma.paymentRefund.count({
      where: {
        payment: {
          orderId: orderId
        },
        status: 'SUCCESS'
      }
    });

    if (totalRefunds === completedRefunds && totalRefunds > 0) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.REFUNDED
        }
      });
    }
  }

  /**
   * 映射微信退款状态
   */
  private mapWechatRefundStatus(wechatStatus: string): string {
    const statusMap: Record<string, string> = {
      'SUCCESS': 'SUCCESS',
      'FAIL': 'FAILED',
      'PROCESSING': 'PROCESSING',
      'CHANGE': 'PROCESSING' // 退款异常
    };

    return statusMap[wechatStatus] || 'PROCESSING';
  }

  /**
   * 映射支付宝退款状态
   */
  private mapAlipayRefundStatus(alipayStatus: string): string {
    const statusMap: Record<string, string> = {
      'REFUND_SUCCESS': 'SUCCESS',
      'REFUND_FAIL': 'FAILED',
      'REFUND_IN_PROGRESS': 'PROCESSING'
    };

    return statusMap[alipayStatus] || 'PROCESSING';
  }

  /**
   * 获取签名相关请求头
   */
  private getSignatureHeaders(req: CallbackRequest, channel: PaymentChannel): any {
    switch (channel) {
      case PaymentChannel.WECHAT:
        return {
          'wechatpay-signature': req.headers['wechatpay-signature'],
          'wechatpay-timestamp': req.headers['wechatpay-timestamp'],
          'wechatpay-nonce': req.headers['wechatpay-nonce'],
          'wechatpay-serial': req.headers['wechatpay-serial']
        };
      case PaymentChannel.ALIPAY:
        return {
          'alipay-signature': req.body.sign,
          'alipay-timestamp': req.body.timestamp
        };
      default:
        return {};
    }
  }

  /**
   * 记录回调处理日志
   */
  private async logCallbackProcessing(logData: any): Promise<void> {
    try {
      await prisma.paymentLog.create({
        data: {
          paymentId: logData.callbackId,
          action: 'NOTIFY' as any,
          description: `处理${logData.channel}支付回调`,
          requestData: JSON.stringify(logData.request),
          responseData: JSON.stringify(logData.response),
          extra: JSON.stringify({
            channel: logData.channel,
            success: logData.success,
            duration: logData.duration
          })
        }
      });

    } catch (error) {
      logger.error('记录回调处理日志失败', {
        logData,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 获取微信回调响应
   */
  public getWechatCallbackResponse(success: boolean): Response {
    const responseData = {
      code: success ? 'SUCCESS' : 'FAIL',
      message: success ? '成功' : '失败'
    };

    const xmlData = `<xml>
      <return_code><![CDATA[${responseData.code}]]></return_code>
      <return_msg><![CDATA[${responseData.message}]]></return_msg>
    </xml>`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/xml'
      },
      body: xmlData
    } as Response;
  }

  /**
   * 获取支付宝回调响应
   */
  public getAlipayCallbackResponse(success: boolean): Response {
    const responseData = success ? 'success' : 'fail';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain'
      },
      body: responseData
    } as Response;
  }

  /**
   * 获取渠道成功响应
   */
  private getChannelSuccessResponse(channel: PaymentChannel, customResponse?: any): Response {
    switch (channel) {
      case PaymentChannel.WECHAT:
        return this.getWechatCallbackResponse(true);
      case PaymentChannel.ALIPAY:
        return this.getAlipayCallbackResponse(true);
      default:
        return this.getDefaultSuccessResponse();
    }
  }

  /**
   * 获取渠道错误响应
   */
  private getChannelErrorResponse(channel: PaymentChannel, message: string): Response {
    switch (channel) {
      case PaymentChannel.WECHAT:
        return this.getWechatCallbackResponse(false);
      case PaymentChannel.ALIPAY:
        return this.getAlipayCallbackResponse(false);
      default:
        return this.getDefaultErrorResponse(message);
    }
  }

  /**
   * 获取默认成功响应
   */
  private getDefaultSuccessResponse(): Response {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: true, message: '处理成功' })
    } as Response;
  }

  /**
   * 获取默认错误响应
   */
  private getDefaultErrorResponse(message: string): Response {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, message })
    } as Response;
  }
}

// 创建回调处理器实例
export const paymentCallbackHandler = new PaymentCallbackHandler({
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  enableSignatureVerification: true,
  enableDuplicateCheck: true,
  duplicateCheckWindow: 300
});