/**
 * 中道商城支付模块
 * 统一支付渠道集成与回调处理系统
 */

// 导出服务类
export { PaymentService } from './payment.service';
export { paymentService } from './payment.service';

// 导出适配器类
export { WechatPaymentAdapter, createWechatPaymentAdapter, wechatPaymentAdapter } from './wechat.provider';
export { AlipayPaymentAdapter, createAlipayPaymentAdapter, alipayPaymentAdapter } from './alipay.provider';

// 导出回调处理器
export { PaymentCallbackHandler, paymentCallbackHandler } from './callback.handler';
export type { CallbackRequest, CallbackResponse, CallbackHandlerOptions } from './callback.handler';

// 导出类型定义
export * from './types';

// 导出常量
export const PAYMENT_CONSTANTS = {
  // 锁定时间
  LOCK_EXPIRE_MINUTES: 15,
  PAYMENT_EXPIRE_HOURS: 24,
  DUPLICATE_CHECK_WINDOW: 300, // 5分钟

  // 限制
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
  MAX_PER_PAGE: 100,

  // 支付渠道
  SUPPORTED_CHANNELS: ['WECHAT', 'ALIPAY', 'POINTS', 'MIXED'],

  // 支付状态
  FINAL_STATUSES: ['PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'],

  // 金额精度
  AMOUNT_PRECISION: 2,
  AMOUNT_SCALE: 100
};

// 支付模块信息
export const PAYMENT_MODULE_INFO = {
  name: '中道商城支付模块',
  version: '1.0.0',
  description: '统一支付渠道集成与回调处理系统',
  supportedChannels: ['微信支付', '支付宝', '通券支付', '混合支付'],
  features: [
    '多渠道支付集成',
    '异步回调处理',
    '退款处理',
    '对账功能',
    '支付统计',
    '防重复支付',
    '签名验证',
    '监控告警'
  ]
};

// 导出默认配置
export const DEFAULT_PAYMENT_CONFIG = {
  enableSignatureVerification: true,
  enableDuplicateCheck: true,
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  lockExpireMinutes: 15,
  paymentExpireHours: 24,
  duplicateCheckWindow: 300
};