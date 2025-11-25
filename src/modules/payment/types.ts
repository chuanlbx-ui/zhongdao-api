/**
 * 支付模块通用类型定义
 */

import { PaymentChannel, PaymentMethod, PaymentStatus, RefundStatus, PaymentLogAction, ReconciliationStatus } from '@prisma/client';

// 支付相关枚举扩展
export enum PaymentTradeType {
  // 微信支付
  WECHAT_JSAPI = 'JSAPI',           // 微信小程序/公众号支付
  WECHAT_NATIVE = 'NATIVE',         // 微信扫码支付
  WECHAT_APP = 'APP',               // 微信APP支付
  WECHAT_H5 = 'MWEB',              // 微信H5支付

  // 支付宝支付
  ALIPAY_WEB = 'FAST_INSTANT_TRADE_PAY',      // 支付宝网页支付
  ALIPAY_WAP = 'QUICK_WAP_PAY',             // 支付宝手机网站支付
  ALIPAY_APP = 'QUICK_MSECURITY_PAY',       // 支付宝APP支付
  ALIPAY_QR = 'FACE_TO_FACE_PAYMENT',       // 支付宝扫码支付
}

// 退款相关枚举
export enum RefundReasonType {
  USER_REQUEST = 'USER_REQUEST',           // 用户申请退款
  SYSTEM_ERROR = 'SYSTEM_ERROR',           // 系统错误退款
  MERCHANT_REFUSE = 'MERCHANT_REFUSE',     // 商家拒单退款
  TIMEOUT_REFUND = 'TIMEOUT_REFUND',       // 超时退款
  AGREEMENT_REFUND = 'AGREEMENT_REFUND'     // 协议退款
}

// 对账相关枚举
export enum ReconciliationType {
  DAILY = 'DAILY',             // 日对账
  WEEKLY = 'WEEKLY',           // 周对账
  MONTHLY = 'MONTHLY',         // 月对账
  CUSTOM = 'CUSTOM'            // 自定义对账
}

// 支付创建请求
export interface PaymentCreateRequest {
  orderId?: string;
  userId: string;
  amount: number;
  channel: PaymentChannel;
  method: PaymentMethod;
  tradeType?: PaymentTradeType;
  subject: string;
  description?: string;
  clientIp?: string;
  userAgent?: string;
  notifyUrl?: string;
  returnUrl?: string;
  expireTime?: number; // 过期时间（分钟）
  extra?: Record<string, any>;
}

// 支付创建响应
export interface PaymentCreateResponse {
  success: boolean;
  paymentId: string;
  paymentNo: string;
  channelOrderId?: string;
  prepayId?: string;
  payInfo?: any;
  qrCode?: string;
  redirectUrl?: string;
  mwebUrl?: string;
  expiredAt?: Date;
  message?: string;
  errors?: string[];
}

// 支付查询请求
export interface PaymentQueryRequest {
  paymentId?: string;
  paymentNo?: string;
  orderId?: string;
  channelOrderId?: string;
  userId?: string;
  channel?: PaymentChannel;
  method?: PaymentMethod;
  status?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 支付查询响应
export interface PaymentQueryResponse {
  success: boolean;
  data: {
    records: PaymentRecord[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

// 支付记录（扩展）
export interface PaymentRecord {
  id: string;
  paymentNo: string;
  orderId?: string;
  userId: string;
  paymentChannel: PaymentChannel;
  paymentMethod: PaymentMethod;
  amount: number;
  currency: string;
  channelOrderId?: string;
  channelTransactionId?: string;
  prepayId?: string;
  status: PaymentStatus;
  paidAt?: Date;
  expiredAt?: Date;
  notifyData?: string;
  notifiedAt?: Date;
  subject?: string;
  description?: string;
  clientIp?: string;
  userAgent?: string;
  extra?: string;
  user?: {
    id: string;
    nickname?: string;
    phone?: string;
  };
  order?: {
    id: string;
    orderNo: string;
    type: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 退款创建请求
export interface RefundCreateRequest {
  paymentId: string;
  refundAmount: number;
  refundReason?: string;
  reasonType?: RefundReasonType;
  applyUserId: string;
  approveUserId?: string;
  extra?: Record<string, any>;
}

// 退款创建响应
export interface RefundCreateResponse {
  success: boolean;
  refundId: string;
  refundNo: string;
  channelRefundId?: string;
  status: RefundStatus;
  message?: string;
  errors?: string[];
}

// 退款记录（扩展）
export interface RefundRecord {
  id: string;
  refundNo: string;
  paymentId: string;
  refundAmount: number;
  refundReason?: string;
  applyUserId: string;
  approveUserId?: string;
  channelRefundId?: string;
  channelTransactionId?: string;
  status: RefundStatus;
  refundedAt?: Date;
  failedReason?: string;
  notifyData?: string;
  notifiedAt?: Date;
  extra?: string;
  payment: PaymentRecord;
  applyUser: {
    id: string;
    nickname?: string;
    phone?: string;
  };
  approveUser?: {
    id: string;
    nickname?: string;
    phone?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 对账请求
export interface ReconciliationRequest {
  reconcileDate: Date;
  channel: PaymentChannel;
  type?: ReconciliationType;
  autoFix?: boolean; // 是否自动修复差异
  emailReport?: boolean; // 是否发送邮件报告
}

// 对账响应
export interface ReconciliationResponse {
  success: boolean;
  reconcileNo: string;
  reconcileDate: Date;
  channel: PaymentChannel;
  totalCount: number;
  totalAmount: number;
  successCount: number;
  successAmount: number;
  failedCount: number;
  failedAmount: number;
  details: ReconciliationDetail[];
  reportUrl?: string;
  message?: string;
}

// 对账详情
export interface ReconciliationDetail {
  paymentId: string;
  paymentNo: string;
  channelOrderId?: string;
  amount: number;
  status: PaymentStatus;
  systemStatus: PaymentStatus;
  isMatched: boolean;
  difference?: string;
  fixAction?: string;
}

// 支付统计请求
export interface PaymentStatisticsRequest {
  userId?: string;
  channel?: PaymentChannel;
  method?: PaymentMethod;
  status?: PaymentStatus;
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week' | 'month' | 'channel' | 'method' | 'status';
}

// 支付统计响应
export interface PaymentStatisticsResponse {
  success: boolean;
  summary: {
    totalCount: number;
    totalAmount: number;
    successCount: number;
    successAmount: number;
    failedCount: number;
    failedAmount: number;
    successRate: number;
    averageAmount: number;
  };
  groupByData?: Array<{
    key: string;
    count: number;
    amount: number;
    successRate: number;
  }>;
  trends?: Array<{
    date: string;
    count: number;
    amount: number;
    successRate: number;
  }>;
  message?: string;
}

// 支付日志记录
export interface PaymentLogRecord {
  id: string;
  paymentId: string;
  action: PaymentLogAction;
  description: string;
  beforeStatus?: PaymentStatus;
  afterStatus?: PaymentStatus;
  requestData?: string;
  responseData?: string;
  operatorId?: string;
  clientIp?: string;
  userAgent?: string;
  extra?: string;
  payment: PaymentRecord;
  operator?: {
    id: string;
    nickname?: string;
    phone?: string;
  };
  createdAt: Date;
}

// 支付配置
export interface PaymentChannelConfig {
  channel: PaymentChannel;
  enabled: boolean;
  priority: number; // 优先级，数字越小优先级越高
  minAmount?: number;
  maxAmount?: number;
  supportedMethods: PaymentMethod[];
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// 支付锁定记录
export interface PaymentLockRecord {
  id: string;
  lockKey: string;
  orderId: string;
  userId: string;
  amount: number;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 回调处理记录
export interface CallbackProcessingRecord {
  id: string;
  callbackId: string;
  channel: PaymentChannel;
  requestData: string;
  responseData: string;
  success: boolean;
  errorMessage?: string;
  duration: number;
  ip: string;
  userAgent?: string;
  createdAt: Date;
}

// 支付相关错误
export class PaymentError extends Error {
  public code: string;
  public channel?: PaymentChannel;
  public paymentId?: string;
  public details?: any;

  constructor(message: string, code: string = 'PAYMENT_ERROR', channel?: PaymentChannel, paymentId?: string, details?: any) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.channel = channel;
    this.paymentId = paymentId;
    this.details = details;
  }
}

// 支付相关错误代码
export enum PaymentErrorCode {
  // 通用错误
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_CHANNEL = 'INVALID_CHANNEL',
  PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
  PAYMENT_EXPIRED = 'PAYMENT_EXPIRED',
  PAYMENT_ALREADY_PAID = 'PAYMENT_ALREADY_PAID',

  // 签名相关错误
  SIGNATURE_VERIFICATION_FAILED = 'SIGNATURE_VERIFICATION_FAILED',
  SIGNATURE_GENERATION_FAILED = 'SIGNATURE_GENERATION_FAILED',

  // 渠道相关错误
  CHANNEL_ERROR = 'CHANNEL_ERROR',
  CHANNEL_TIMEOUT = 'CHANNEL_TIMEOUT',
  CHANNEL_BUSY = 'CHANNEL_BUSY',
  CHANNEL_MAINTENANCE = 'CHANNEL_MAINTENANCE',

  // 业务逻辑错误
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  PAYMENT_LIMIT_EXCEEDED = 'PAYMENT_LIMIT_EXCEEDED',
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
  REFUND_NOT_ALLOWED = 'REFUND_NOT_ALLOWED',

  // 系统错误
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

// 支付工具函数
export namespace PaymentUtils {
  export function formatAmount(amount: number): number {
    return Math.round(amount * 100);
  }

  export function parseAmount(amount: number): number {
    return amount / 100;
  }

  export function generatePaymentNo(prefix: string = 'PAY'): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  export function generateRefundNo(prefix: string = 'REF'): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  export function isPaymentSuccessful(status: PaymentStatus): boolean {
    return status === PaymentStatus.PAID;
  }

  export function isPaymentPending(status: PaymentStatus): boolean {
    return status === PaymentStatus.UNPAID || status === PaymentStatus.PAYING;
  }

  export function isPaymentFailed(status: PaymentStatus): boolean {
    return status === PaymentStatus.FAILED || status === PaymentStatus.CANCELLED || status === PaymentStatus.EXPIRED;
  }

  export function getChannelDisplayName(channel: PaymentChannel): string {
    const channelNames: Record<PaymentChannel, string> = {
      [PaymentChannel.WECHAT]: '微信支付',
      [PaymentChannel.ALIPAY]: '支付宝',
      [PaymentChannel.POINTS]: '通券支付',
      [PaymentChannel.MIXED]: '混合支付'
    };
    return channelNames[channel] || channel;
  }

  export function getMethodDisplayName(method: PaymentMethod): string {
    const methodNames: Record<PaymentMethod, string> = {
      [PaymentMethod.WECHAT]: '微信支付',
      [PaymentMethod.ALIPAY]: '支付宝',
      [PaymentMethod.POINTS]: '通券支付',
      [PaymentMethod.MIXED]: '混合支付'
    };
    return methodNames[method] || method;
  }

  export function getStatusDisplayName(status: PaymentStatus): string {
    const statusNames: Record<PaymentStatus, string> = {
      [PaymentStatus.UNPAID]: '未支付',
      [PaymentStatus.PAYING]: '支付中',
      [PaymentStatus.PAID]: '已支付',
      [PaymentStatus.FAILED]: '支付失败',
      [PaymentStatus.CANCELLED]: '已取消',
      [PaymentStatus.REFUNDED]: '已退款',
      [PaymentStatus.EXPIRED]: '已过期'
    };
    return statusNames[status] || status;
  }
}