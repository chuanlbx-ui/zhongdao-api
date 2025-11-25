import { logger } from '../../utils/logger';

/**
 * 支付基础类型定义
 */
export interface PaymentRequest {
  orderId: string;
  amount: number;
  subject: string;
  description?: string;
  notifyUrl?: string;
  returnUrl?: string;
  clientIp?: string;
  userId?: string;
  extra?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  providerOrderId?: string;
  payInfo?: any;
  qrCode?: string;
  redirectUrl?: string;
  prepayId?: string;
  message?: string;
  errorCode?: string;
  raw?: any;
}

export interface RefundRequest {
  orderId: string;
  refundAmount: number;
  totalAmount: number;
  reason?: string;
  refundId?: string;
  extra?: Record<string, any>;
}

export interface RefundResponse {
  success: boolean;
  refundId?: string;
  transactionId?: string;
  refundStatus?: string;
  message?: string;
  errorCode?: string;
  raw?: any;
}

export interface QueryResponse {
  success: boolean;
  tradeStatus?: string;
  orderId?: string;
  providerOrderId?: string;
  totalAmount?: number;
  paidAmount?: number;
  paidAt?: Date;
  message?: string;
  raw?: any;
}

export interface NotifyData {
  orderId?: string;
  providerOrderId?: string;
  transactionId?: string;
  tradeStatus: string;
  totalAmount?: number;
  paidAmount?: number;
  paidAt?: Date;
  raw: any;
}

/**
 * 支付提供商基础接口
 */
export abstract class PaymentProvider {
  protected config: any;
  protected providerName: string;

  constructor(config: any, providerName: string) {
    this.config = config;
    this.providerName = providerName;
  }

  /**
   * 创建支付订单
   */
  abstract createPayment(request: PaymentRequest): Promise<PaymentResponse>;

  /**
   * 查询支付状态
   */
  abstract queryPayment(orderId: string): Promise<QueryResponse>;

  /**
   * 申请退款
   */
  abstract createRefund(request: RefundRequest): Promise<RefundResponse>;

  /**
   * 验证支付回调通知
   */
  abstract verifyNotify(data: any, headers?: any): Promise<NotifyData>;

  /**
   * 关闭支付订单
   */
  abstract closePayment(orderId: string): Promise<boolean>;

  /**
   * 获取支持的支付方式
   */
  abstract getSupportedMethods(): string[];

  /**
   * 生成订单号
   */
  protected generateOrderId(prefix: string = ''): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * 格式化金额（统一为分）
   */
  protected formatAmount(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * 解析金额（从分转换为元）
   */
  protected parseAmount(amount: number): number {
    return amount / 100;
  }

  /**
   * 记录日志
   */
  protected log(level: 'info' | 'error' | 'warn', message: string, data?: any): void {
    logger[level](`[${this.providerName}] ${message}`, {
      provider: this.providerName,
      ...data
    });
  }

  /**
   * 处理API错误
   */
  protected handleError(error: any, operation: string): never {
    this.log('error', `${operation}失败`, {
      error: error.message,
      stack: error.stack
    });

    throw new Error(`[${this.providerName}] ${operation}失败: ${error.message}`);
  }

  /**
   * 签名验证
   */
  protected abstract verifySign(data: any, signature: string): boolean;

  /**
   * 生成签名
   */
  protected abstract generateSign(data: any): string;
}

/**
 * 支付状态枚举
 */
export enum PaymentStatus {
  PENDING = 'PENDING',           // 待支付
  PAID = 'PAID',                 // 已支付
  REFUNDING = 'REFUNDING',       // 退款中
  REFUNDED = 'REFUNDED',         // 已退款
  CANCELLED = 'CANCELLED',       // 已取消
  EXPIRED = 'EXPIRED',           // 已过期
  FAILED = 'FAILED'              // 支付失败
}

/**
 * 支付方式枚举
 */
export enum PaymentMethod {
  WECHAT_JSAPI = 'WECHAT_JSAPI',     // 微信JSAPI支付
  WECHAT_NATIVE = 'WECHAT_NATIVE',   // 微信扫码支付
  WECHAT_APP = 'WECHAT_APP',         // 微信APP支付
  WECHAT_H5 = 'WECHAT_H5',           // 微信H5支付

  ALIPAY_WEB = 'ALIPAY_WEB',         // 支付宝网页支付
  ALIPAY_QR = 'ALIPAY_QR',           // 支付宝扫码支付
  ALIPAY_APP = 'ALIPAY_APP',         // 支付宝APP支付
  ALIPAY_WAP = 'ALIPAY_WAP',         // 支付宝手机网站支付

  POINTS = 'POINTS',                 // 积分支付
  MIXED = 'MIXED'                    // 混合支付
}

/**
 * 支付提供商类型
 */
export enum ProviderType {
  WECHAT = 'WECHAT',
  ALIPAY = 'ALIPAY',
  POINTS = 'POINTS'
}