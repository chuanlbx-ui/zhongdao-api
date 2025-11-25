/**
 * 微信支付配置接口
 */
export interface WechatPayConfig {
  appId: string;                    // 微信公众号/小程序 appId
  mchId: string;                    // 商户号
  apiV3Key: string;                 // API v3密钥
  apiClientCert: string;            // API证书内容
  apiClientKey: string;             // API私钥内容
  apiSerialNo: string;              // API证书序列号
  notifyUrl: string;                // 支付结果通知地址
  refundNotifyUrl: string;          // 退款结果通知地址
  key: string;                      // 商户密钥（API v2兼容）
  serverUrl?: string;               // 服务器地址（沙箱环境使用）
  sandbox?: boolean;                // 是否沙箱环境
}

/**
 * 微信支付环境配置
 */
export const WECHAT_PAY_ENVIRONMENTS = {
  PRODUCTION: 'https://api.mch.weixin.qq.com',
  SANDBOX: 'https://api.mch.weixin.qq.com/sandboxnew'
} as const;

/**
 * 微信支付API路径
 */
export const WECHAT_PAY_APIS = {
  // 统一下单
  UNIFIED_ORDER: '/v3/pay/transactions/jsapi',
  NATIVE_PAY: '/v3/pay/transactions/native',
  APP_PAY: '/v3/pay/transactions/app',
  H5_PAY: '/v3/pay/transactions/h5',

  // 订单查询
  QUERY_ORDER: '/v3/pay/transactions/out-trade-no/{out_trade_no}',
  QUERY_ORDER_BY_ID: '/v3/pay/transactions/id/{transaction_id}',

  // 关闭订单
  CLOSE_ORDER: '/v3/pay/transactions/out-trade-no/{out_trade_no}/close',

  // 申请退款
  REFUND: '/v3/refund/domestic/refunds',
  QUERY_REFUND: '/v3/refund/domestic/refunds/{out_refund_no}',

  // 下载账单
  DOWNLOAD_BILL: '/v3/bill/tradebill',
  DOWNLOAD_FUND_FLOW: '/v3/bill/fundflowbill',

  // 申请交易账单
  TRADE_BILL: '/v3/bill/tradebill',
  FUND_FLOW_BILL: '/v3/bill/fundflowbill'
} as const;

/**
 * 微信支付状态映射
 */
export const WECHAT_PAY_STATUS = {
  SUCCESS: 'SUCCESS',           // 支付成功
  REFUND: 'REFUND',             // 转入退款
  NOTPAY: 'NOTPAY',             // 未支付
  CLOSED: 'CLOSED',             // 已关闭
  REVOKED: 'REVOKED',           // 已撤销
  USERPAYING: 'USERPAYING',     // 用户支付中
  PAYERROR: 'PAYERROR'          // 支付失败
} as const;

/**
 * 退款状态映射
 */
export const WECHAT_REFUND_STATUS = {
  SUCCESS: 'SUCCESS',           // 退款成功
  CLOSED: 'CLOSED',             // 退款关闭
  PROCESSING: 'PROCESSING',     // 退款处理中
  ABNORMAL: 'ABNORMAL',         // 退款异常
  APPLYING: 'APPLYING'          // 退款申请中
} as const;

/**
 * 微信支付配置示例
 */
export const WECHAT_PAY_CONFIG_EXAMPLE: WechatPayConfig = {
  appId: 'your_wx_app_id',
  mchId: 'your_merchant_id',
  apiV3Key: 'your_api_v3_key',
  apiClientCert: '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
  apiClientKey: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
  apiSerialNo: 'your_cert_serial_no',
  notifyUrl: 'https://yourdomain.com/api/v1/payments/wechat/notify',
  refundNotifyUrl: 'https://yourdomain.com/api/v1/payments/wechat/refund/notify',
  key: 'your_merchant_key',
  sandbox: false
};