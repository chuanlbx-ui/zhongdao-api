/**
 * 支付宝支付配置接口
 */
export interface AlipayConfig {
  appId: string;                    // 应用ID
  privateKey: string;               // 应用私钥
  alipayPublicKey: string;          // 支付宝公钥
  gatewayUrl: string;               // 支付宝网关地址
  notifyUrl: string;                // 支付结果通知地址
  refundNotifyUrl: string;          // 退款结果通知地址
  returnUrl?: string;               // 同步回调地址
  signType: string;                 // 签名算法类型
  charset: string;                  // 字符编码
  version: string;                  // API版本
  format: string;                   // 返回格式
  sandbox?: boolean;                // 是否沙箱环境
}

/**
 * 支付宝支付环境配置
 */
export const ALIPAY_ENVIRONMENTS = {
  PRODUCTION: 'https://openapi.alipay.com/gateway.do',
  SANDBOX: 'https://openapi.alipaydev.com/gateway.do'
} as const;

/**
 * 支付宝支付API方法
 */
export const ALIPAY_APIS = {
  // 统一下单
  TRADE_CREATE: 'alipay.trade.page.pay',           // 网页支付
  TRADE_WAP_PAY: 'alipay.trade.wap.pay',           // 手机网站支付
  TRADE_APP_PAY: 'alipay.trade.app.pay',           // APP支付
  TRADE_QR_PAY: 'alipay.trade.precreate',          // 扫码支付
  TRADE_JSAPI_PAY: 'alipay.trade.create',          // 小程序支付

  // 订单查询
  TRADE_QUERY: 'alipay.trade.query',

  // 关闭订单
  TRADE_CLOSE: 'alipay.trade.close',

  // 申请退款
  TRADE_REFUND: 'alipay.trade.refund',
  TRADE_REFUND_QUERY: 'alipay.trade.fastpay.refund.query',

  // 下载账单
  DATA_BILL: 'alipay.data.dataservice.bill.downloadurl.query'
} as const;

/**
 * 支付宝交易状态枚举
 */
export const ALIPAY_TRADE_STATUS = {
  WAIT_BUYER_PAY: 'WAIT_BUYER_PAY',       // 交易创建，等待买家付款
  TRADE_SUCCESS: 'TRADE_SUCCESS',           // 交易支付成功
  TRADE_FINISHED: 'TRADE_FINISHED',         // 交易结束，不可退款
  TRADE_CLOSED: 'TRADED_CLOSED',           // 未付款交易超时关闭
  TRADE_PENDING: 'TRADE_PENDING'            // 等待卖家收款（买家付款后，如果卖家账号被冻结）
} as const;

/**
 * 退款状态枚举
 */
export const ALIPAY_REFUND_STATUS = {
  REFUND_SUCCESS: 'REFUND_SUCCESS'          // 退款成功
} as const;

/**
 * 支付宝支付配置示例
 */
export const ALIPAY_CONFIG_EXAMPLE: AlipayConfig = {
  appId: 'your_alipay_app_id',
  privateKey: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----',
  alipayPublicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
  gatewayUrl: ALIPAY_ENVIRONMENTS.SANDBOX,
  notifyUrl: 'https://yourdomain.com/api/v1/payments/alipay/notify',
  refundNotifyUrl: 'https://yourdomain.com/api/v1/payments/alipay/refund/notify',
  returnUrl: 'https://yourdomain.com/payment/success',
  signType: 'RSA2',
  charset: 'utf-8',
  version: '1.0',
  format: 'json',
  sandbox: true
};