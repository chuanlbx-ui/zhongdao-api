/**
 * 安全支付回调处理器
 * 提供严格的签名验证、IP白名单、幂等性控制等安全机制
 */

import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { NotifyData } from '../base/provider';
import crypto from 'crypto';
import { Request } from 'express';

/**
 * 支付回调安全配置
 */
interface PaymentSecurityConfig {
  // IP白名单配置
  wechatPayIps: string[];
  alipayIps: string[];

  // 签名验证配置
  enableSignatureVerification: boolean;
  signatureTimeout: number; // 签名时间戳有效期（秒）

  // 幂等性配置
  enableIdempotency: boolean;
  idempotencyWindow: number; // 幂等性时间窗口（秒）

  // 审计日志配置
  enableAuditLog: boolean;
  rawRequestRetentionDays: number;

  // 告警配置
  enableAlerts: boolean;
  alertWebhookUrl?: string;
}

/**
 * 回调请求信息
 */
interface CallbackRequest {
  provider: 'WECHAT' | 'ALIPAY';
  ip: string;
  userAgent: string;
  timestamp: number;
  rawBody: string;
  headers: Record<string, string>;
  signature?: string;
}

/**
 * 审计日志条目
 */
interface AuditLogEntry {
  id: string;
  provider: string;
  orderId?: string;
  transactionId?: string;
  callbackId: string;
  ip: string;
  action: 'RECEIVED' | 'VERIFIED' | 'PROCESSED' | 'FAILED' | 'REJECTED';
  details: any;
  timestamp: Date;
  rawRequest?: string;
  processingTime?: number;
}

/**
 * 安全支付回调处理器
 */
export class SecurePaymentCallbackHandler {
  private config: PaymentSecurityConfig;
  private readonly redisKeyPrefix = 'payment_callback:';

  constructor(config?: Partial<PaymentSecurityConfig>) {
    this.config = {
      // 微信支付官方IP段（需要定期更新）
      wechatPayIps: [
        '101.226.103.0/24',
        '101.226.233.0/24',
        '58.250.137.0/24',
        '58.251.86.0/24',
        '58.251.87.0/24',
        '113.108.215.0/24',
        '203.205.147.0/24',
        '180.163.81.0/24',
        '119.147.71.0/24',
        '117.184.32.0/24',
        '120.197.224.0/24',
        '114.80.136.0/24',
        '119.147.70.0/24',
        '14.215.138.0/24',
        '14.215.139.0/24',
        '14.215.140.0/24',
        '14.215.141.0/24',
        '58.251.80.0/24',
        '119.147.73.0/24',
        '183.62.198.0/24',
        '183.62.199.0/24',
        '183.62.200.0/24',
        '183.62.201.0/24'
      ],
      // 支付宝官方IP段（需要定期更新）
      alipayIps: [
        '110.75.142.0/24',
        '110.75.143.0/24',
        '110.75.144.0/24',
        '110.75.145.0/24',
        '110.75.146.0/24',
        '110.75.147.0/24',
        '110.75.148.0/24',
        '110.75.149.0/24',
        '140.207.74.0/24',
        '140.207.75.0/24',
        '140.207.76.0/24',
        '140.207.77.0/24'
      ],
      enableSignatureVerification: true,
      signatureTimeout: 300, // 5分钟
      enableIdempotency: true,
      idempotencyWindow: 86400, // 24小时
      enableAuditLog: true,
      rawRequestRetentionDays: 30,
      enableAlerts: true,
      ...config
    };
  }

  /**
   * 安全处理支付回调
   */
  async handleSecureCallback(
    provider: 'WECHAT' | 'ALIPAY',
    req: Request,
    verifySignature: (data: any, signature: string) => Promise<boolean>
  ): Promise<{ success: boolean; data?: NotifyData; error?: string }> {
    const startTime = Date.now();
    const callbackId = crypto.randomUUID();

    // 提取请求信息
    const callbackInfo: CallbackRequest = {
      provider,
      ip: this.getClientIp(req),
      userAgent: req.get('User-Agent') || '',
      timestamp: startTime,
      rawBody: req.body,
      headers: this.extractHeaders(req),
      signature: this.extractSignature(req, provider)
    };

    try {
      // 1. 记录接收到的回调
      await this.logCallback(callbackId, 'RECEIVED', callbackInfo, null);

      // 2. IP白名单验证
      if (!await this.verifyIpWhitelist(callbackInfo.ip, provider)) {
        const error = `IP地址不在白名单内: ${callbackInfo.ip}`;
        await this.logCallback(callbackId, 'REJECTED', callbackInfo, { reason: error });
        await this.sendAlert('IP白名单验证失败', { ip: callbackInfo.ip, provider });
        return { success: false, error };
      }

      // 3. 幂等性检查
      const idempotencyKey = this.generateIdempotencyKey(callbackInfo);
      if (!await this.checkIdempotency(idempotencyKey)) {
        const error = '重复的回调请求';
        await this.logCallback(callbackId, 'REJECTED', callbackInfo, { reason: error });
        return { success: false, error };
      }

      // 4. 签名验证
      if (this.config.enableSignatureVerification) {
        const isValidSignature = await this.verifySignatureWithTimeout(
          callbackInfo.rawBody,
          callbackInfo.signature,
          verifySignature
        );

        if (!isValidSignature) {
          const error = '签名验证失败';
          await this.logCallback(callbackId, 'REJECTED', callbackInfo, { reason: error });
          await this.sendAlert('签名验证失败', { ip: callbackInfo.ip, provider });
          return { success: false, error };
        }
      }

      // 5. 解析回调数据
      const notifyData = await this.parseNotifyData(provider, callbackInfo.rawBody);

      // 6. 记录验证成功
      await this.logCallback(callbackId, 'VERIFIED', callbackInfo, {
        orderId: notifyData.orderId,
        transactionId: notifyData.transactionId
      });

      // 7. 标记幂等性
      await this.markIdempotency(idempotencyKey, notifyData);

      const processingTime = Date.now() - startTime;

      // 8. 记录处理完成
      await this.logCallback(callbackId, 'PROCESSED', callbackInfo, {
        orderId: notifyData.orderId,
        transactionId: notifyData.transactionId,
        processingTime
      });

      return { success: true, data: notifyData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const processingTime = Date.now() - startTime;

      await this.logCallback(callbackId, 'FAILED', callbackInfo, {
        error: errorMessage,
        processingTime
      });

      await this.sendAlert('回调处理失败', {
        ip: callbackInfo.ip,
        provider,
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * 验证IP白名单
   */
  private async verifyIpWhitelist(ip: string, provider: 'WECHAT' | 'ALIPAY'): Promise<boolean> {
    const allowedIps = provider === 'WECHAT' ? this.config.wechatPayIps : this.config.alipayIps;

    for (const allowedIp of allowedIps) {
      if (this.isIpInRange(ip, allowedIp)) {
        return true;
      }
    }

    // 开发环境跳过IP验证
    if (process.env.NODE_ENV === 'development') {
      logger.warn('开发环境跳过IP白名单验证', { ip, provider });
      return true;
    }

    return false;
  }

  /**
   * 检查IP是否在范围内
   */
  private isIpInRange(ip: string, range: string): boolean {
    const [network, prefixLength] = range.split('/');
    const ipInt = this.ipToLong(ip);
    const networkInt = this.ipToLong(network);
    const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;

    return (ipInt & mask) === (networkInt & mask);
  }

  /**
   * IP转整数
   */
  private ipToLong(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  /**
   * 生成幂等性键
   */
  private generateIdempotencyKey(callbackInfo: CallbackRequest): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${callbackInfo.provider}:${callbackInfo.rawBody}`)
      .digest('hex');

    return `${this.redisKeyPrefix}${callbackInfo.provider}:${hash}`;
  }

  /**
   * 检查幂等性
   */
  private async checkIdempotency(key: string): Promise<boolean> {
    if (!this.config.enableIdempotency) {
      return true;
    }

    try {
      const redis = require('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      const exists = await client.exists(key);
      await client.quit();

      return !exists;
    } catch (error) {
      logger.error('检查幂等性失败', { error: error.message, key });
      // Redis故障时允许通过
      return true;
    }
  }

  /**
   * 标记幂等性
   */
  private async markIdempotency(key: string, data: NotifyData): Promise<void> {
    if (!this.config.enableIdempotency) {
      return;
    }

    try {
      const redis = require('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      await client.setex(
        key,
        this.config.idempotencyWindow,
        JSON.stringify({
          orderId: data.orderId,
          transactionId: data.transactionId,
          processedAt: new Date().toISOString()
        })
      );

      await client.quit();
    } catch (error) {
      logger.error('标记幂等性失败', { error: error.message, key });
    }
  }

  /**
   * 带超时的签名验证
   */
  private async verifySignatureWithTimeout(
    data: any,
    signature: string,
    verifyFunction: (data: any, signature: string) => Promise<boolean>
  ): Promise<boolean> {
    const timeout = this.config.signatureTimeout * 1000;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        logger.warn('签名验证超时');
        resolve(false);
      }, timeout);

      verifyFunction(data, signature)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          logger.error('签名验证异常', { error: error.message });
          resolve(false);
        });
    });
  }

  /**
   * 解析回调数据
   */
  private async parseNotifyData(provider: string, rawBody: any): Promise<NotifyData> {
    let data;

    try {
      if (typeof rawBody === 'string') {
        data = JSON.parse(rawBody);
      } else {
        data = rawBody;
      }
    } catch (error) {
      throw new Error('无效的JSON数据');
    }

    if (provider === 'WECHAT') {
      return {
        orderId: data.resource?.out_trade_no || data.out_trade_no,
        providerOrderId: data.resource?.transaction_id || data.transaction_id,
        transactionId: data.resource?.transaction_id || data.transaction_id,
        tradeStatus: data.resource?.trade_state || data.trade_state,
        totalAmount: data.resource?.amount?.total ? data.resource.amount.total / 100 : 0,
        paidAmount: data.resource?.amount?.payer_total ? data.resource.amount.payer_total / 100 : 0,
        paidAt: data.resource?.success_time ? new Date(data.resource.success_time) : undefined,
        raw: data
      };
    } else if (provider === 'ALIPAY') {
      return {
        orderId: data.out_trade_no,
        providerOrderId: data.trade_no,
        transactionId: data.trade_no,
        tradeStatus: data.trade_status === 'TRADE_SUCCESS' ? 'SUCCESS' : 'FAILED',
        totalAmount: parseFloat(data.total_amount) || 0,
        paidAmount: parseFloat(data.total_amount) || 0,
        paidAt: data.gmt_payment ? new Date(data.gmt_payment) : undefined,
        raw: data
      };
    }

    throw new Error(`不支持的支付提供商: ${provider}`);
  }

  /**
   * 记录审计日志
   */
  private async logCallback(
    callbackId: string,
    action: AuditLogEntry['action'],
    callbackInfo: CallbackRequest,
    details: any
  ): Promise<void> {
    if (!this.config.enableAuditLog) {
      return;
    }

    try {
      const logEntry: AuditLogEntry = {
        id: crypto.randomUUID(),
        provider: callbackInfo.provider,
        orderId: details?.orderId,
        transactionId: details?.transactionId,
        callbackId,
        ip: callbackInfo.ip,
        action,
        details,
        timestamp: new Date(),
        rawRequest: action === 'RECEIVED' ? JSON.stringify(callbackInfo) : undefined,
        processingTime: details?.processingTime
      };

      // 保存到数据库
      await prisma.paymentCallbackLog.create({
        data: {
          id: logEntry.id,
          provider: logEntry.provider,
          orderId: logEntry.orderId,
          transactionId: logEntry.transactionId,
          callbackId: logEntry.callbackId,
          ip: logEntry.ip,
          action: logEntry.action,
          details: JSON.stringify(logEntry.details),
          rawRequest: logEntry.rawRequest,
          processingTime: logEntry.processingTime,
          createdAt: logEntry.timestamp
        }
      });

      // 记录到日志
      logger.info('支付回调审计', {
        callbackId,
        provider: callbackInfo.provider,
        action,
        ip: callbackInfo.ip,
        orderId: details?.orderId,
        processingTime: details?.processingTime
      });

    } catch (error) {
      logger.error('记录审计日志失败', {
        callbackId,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 发送告警
   */
  private async sendAlert(title: string, data: any): Promise<void> {
    if (!this.config.enableAlerts || !this.config.alertWebhookUrl) {
      return;
    }

    try {
      const axios = require('axios');

      await axios.post(this.config.alertWebhookUrl, {
        title,
        level: 'HIGH',
        timestamp: new Date().toISOString(),
        data
      });
    } catch (error) {
      logger.error('发送告警失败', {
        title,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 获取客户端IP
   */
  private getClientIp(req: Request): string {
    return (
      req.get('CF-Connecting-IP') ||
      req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      req.get('X-Real-IP') ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * 提取请求头
   */
  private extractHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    // 提取关键头部
    const importantHeaders = [
      'content-type',
      'user-agent',
      'x-forwarded-for',
      'x-real-ip',
      'wechatpay-signature',
      'wechatpay-timestamp',
      'wechatpay-nonce',
      'wechatpay-serial',
      'alipay-sdk'
    ];

    for (const header of importantHeaders) {
      const value = req.get(header);
      if (value) {
        headers[header] = value;
      }
    }

    return headers;
  }

  /**
   * 提取签名
   */
  private extractSignature(req: Request, provider: string): string {
    if (provider === 'WECHAT') {
      return req.get('wechatpay-signature') || req.get('Wechatpay-Signature') || '';
    } else if (provider === 'ALIPAY') {
      return req.body?.sign || '';
    }

    return '';
  }
}

/**
 * 创建安全回调处理器实例
 */
export function createSecureCallbackHandler(): SecurePaymentCallbackHandler {
  return new SecurePaymentCallbackHandler({
    alertWebhookUrl: process.env.PAYMENT_ALERT_WEBHOOK_URL
  });
}

// 导出单例
export const secureCallbackHandler = createSecureCallbackHandler();