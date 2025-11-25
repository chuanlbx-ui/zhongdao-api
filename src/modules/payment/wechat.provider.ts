/**
 * 中道商城微信支付适配器
 * 基于现有微信支付基础设施，提供高级业务封装
 */

import { logger } from '../../utils/logger';
import { WechatPayProvider } from '../../shared/payments/wechat/provider';
import { WechatPayConfig } from '../../shared/payments/wechat/config';
import { PaymentProvider, PaymentRequest, PaymentResponse, RefundRequest, RefundResponse, QueryResponse, NotifyData } from '../../shared/payments/base/provider';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface WechatPaymentRequest extends PaymentRequest {
  // 微信支付特有字段
  openid?: string;           // 用户openid（JSAPI支付必填）
  tradeType?: string;        // 交易类型
  sceneInfo?: {             // 场景信息
    payer_client_ip?: string;
    h5_info?: {
      type: string;
      wap_url: string;
      wap_name: string;
    };
  };
  goodsDetail?: Array<{     // 商品详情
    goods_id: string;
    goods_name: string;
    quantity: number;
    price: number;
  }>;
  limitPay?: string;        // 限定支付方式
  promotionInfo?: string;   // 优惠信息
}

export interface WechatPaymentResponse extends PaymentResponse {
  // 微信支付特有响应字段
  codeUrl?: string;         // 二维码链接（扫码支付）
  appPayParams?: {         // APP支付参数
    appid: string;
    partnerid: string;
    prepayid: string;
    package: string;
    noncestr: string;
    timestamp: string;
    sign: string;
  };
  jsApiParams?: {          // JSAPI支付参数
    appId: string;
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };
  mwebUrl?: string;         // H5支付跳转链接
}

export interface WechatRefundRequest extends RefundRequest {
  // 微信退款特有字段
  goodsDetail?: Array<{     // 退款商品详情
    goods_id: string;
    goods_name: string;
    quantity: number;
    price: number;
  }>;
  accountType?: string;     // 退款资金来源
  fromAccount?: string;     // 退款资金账户
  refundAccount?: string;   // 退款目标账户
  refundReason?: string;    // 退款原因
  refundFeeType?: string;   // 退款手续费类型
}

export interface WechatNotifyData extends NotifyData {
  // 微信回调特有字段
  tradeState?: string;           // 交易状态
  tradeStateDesc?: string;       // 交易状态描述
  transactionId?: string;        // 微信支付订单号
  outTradeNo?: string;          // 商户订单号
  attach?: string;              // 附加数据
  timeEnd?: string;             // 支付完成时间
  bankType?: string;            // 付款银行
  settlementTotalFee?: number;  // 应结订单金额
  cashFee?: number;             // 现金支付金额
  couponFee?: number;           // 代金券金额
  refundList?: Array<{          // 退款信息列表
    out_refund_no: string;
    refund_id: string;
    refund_channel: string;
    refund_fee: number;
    refund_status: string;
  }>;
}

/**
 * 微信支付适配器类
 */
export class WechatPaymentAdapter {
  private wechatProvider: WechatPayProvider;
  private config: WechatPayConfig;

  constructor(config: WechatPayConfig) {
    this.config = config;
    this.wechatProvider = new WechatPayProvider(config);
  }

  /**
   * 创建微信支付订单
   */
  async createPayment(request: WechatPaymentRequest): Promise<WechatPaymentResponse> {
    const startTime = Date.now();

    try {
      logger.info('开始创建微信支付订单', {
        orderId: request.orderId,
        amount: request.amount,
        tradeType: request.tradeType
      });

      // 1. 验证支付参数
      const validation = this.validatePaymentRequest(request);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // 2. 构建微信支付请求
      const wechatRequest = this.buildWechatPaymentRequest(request);

      // 3. 调用微信支付API
      const response = await this.wechatProvider.createPayment(wechatRequest);

      // 4. 解析微信支付响应
      const wechatResponse = this.parseWechatPaymentResponse(response, request);

      // 5. 记录操作日志
      logger.info('微信支付订单创建成功', {
        orderId: request.orderId,
        providerOrderId: wechatResponse.providerOrderId,
        duration: Date.now() - startTime
      });

      return wechatResponse;

    } catch (error) {
      logger.error('创建微信支付订单失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 查询微信支付状态
   */
  async queryPayment(orderId: string): Promise<QueryResponse> {
    const startTime = Date.now();

    try {
      logger.info('开始查询微信支付状态', { orderId });

      const response = await this.wechatProvider.queryPayment(orderId);

      logger.info('微信支付状态查询成功', {
        orderId,
        tradeStatus: response.tradeStatus,
        success: response.success,
        duration: Date.now() - startTime
      });

      return response;

    } catch (error) {
      logger.error('查询微信支付状态失败', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 申请微信支付退款
   */
  async createRefund(request: WechatRefundRequest): Promise<RefundResponse> {
    const startTime = Date.now();

    try {
      logger.info('开始申请微信支付退款', {
        orderId: request.orderId,
        refundAmount: request.refundAmount
      });

      // 1. 验证退款参数
      const validation = this.validateRefundRequest(request);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // 2. 构建微信退款请求
      const wechatRefundRequest = this.buildWechatRefundRequest(request);

      // 3. 调用微信退款API
      const response = await this.wechatProvider.createRefund(wechatRefundRequest);

      logger.info('微信支付退款申请成功', {
        orderId: request.orderId,
        refundId: response.refundId,
        success: response.success,
        duration: Date.now() - startTime
      });

      return response;

    } catch (error) {
      logger.error('申请微信支付退款失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 验证微信支付回调通知
   */
  async verifyNotify(data: any, headers?: any): Promise<WechatNotifyData> {
    const startTime = Date.now();

    try {
      logger.info('开始验证微信支付回调通知', {
        headers: headers ? Object.keys(headers) : null
      });

      const notifyData = await this.wechatProvider.verifyNotify(data, headers);

      // 扩展回调数据
      const wechatNotifyData: WechatNotifyData = {
        ...notifyData,
        tradeState: data.trade_state,
        tradeStateDesc: data.trade_state_desc,
        transactionId: data.transaction_id,
        outTradeNo: data.out_trade_no,
        attach: data.attach,
        timeEnd: data.time_end,
        bankType: data.bank_type,
        settlementTotalFee: data.settlement_total_fee ? parseInt(data.settlement_total_fee) / 100 : undefined,
        cashFee: data.cash_fee ? parseInt(data.cash_fee) / 100 : undefined,
        couponFee: data.coupon_fee ? parseInt(data.coupon_fee) / 100 : undefined,
        refundList: data.refund_list ? JSON.parse(data.refund_list) : undefined
      };

      logger.info('微信支付回调验证成功', {
        orderId: wechatNotifyData.orderId,
        tradeStatus: wechatNotifyData.tradeStatus,
        duration: Date.now() - startTime
      });

      return wechatNotifyData;

    } catch (error) {
      logger.error('验证微信支付回调失败', {
        data: typeof data === 'object' ? Object.keys(data) : data,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 关闭微信支付订单
   */
  async closePayment(orderId: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      logger.info('开始关闭微信支付订单', { orderId });

      const result = await this.wechatProvider.closePayment(orderId);

      logger.info('微信支付订单关闭成功', {
        orderId,
        success: result,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('关闭微信支付订单失败', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 获取支持的支付方式
   */
  getSupportedMethods(): string[] {
    return this.wechatProvider.getSupportedMethods();
  }

  /**
   * 生成微信支付JSAPI参数
   */
  generateJSAPIParams(prepayId: string): any {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr();
    const packageStr = `prepay_id=${prepayId}`;

    // 这里应该使用实际的RSA签名
    const paySign = this.generateMockSign();

    return {
      appId: this.config.appId,
      timeStamp: timestamp,
      nonceStr,
      package: packageStr,
      signType: 'RSA',
      paySign
    };
  }

  /**
   * 生成微信支付APP参数
   */
  generateAPPParams(prepayId: string): any {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.generateNonceStr();
    const packageStr = `prepay_id=${prepayId}`;

    // 这里应该使用实际的RSA签名
    const sign = this.generateMockSign();

    return {
      appid: this.config.appId,
      partnerid: this.config.mchId,
      prepayid: prepayId,
      package: packageStr,
      noncestr: nonceStr,
      timestamp: timestamp,
      sign
    };
  }

  // ===== 私有方法 =====

  /**
   * 验证支付请求参数
   */
  private validatePaymentRequest(request: WechatPaymentRequest): {isValid: boolean, message: string} {
    // 基础参数验证
    if (!request.orderId) {
      return { isValid: false, message: '订单ID不能为空' };
    }
    if (request.amount <= 0) {
      return { isValid: false, message: '支付金额必须大于0' };
    }
    if (!request.subject) {
      return { isValid: false, message: '支付主题不能为空' };
    }

    // 根据交易类型验证特定参数
    const tradeType = request.tradeType || 'JSAPI';

    switch (tradeType) {
      case 'JSAPI':
        if (!request.openid) {
          return { isValid: false, message: 'JSAPI支付必须提供openid' };
        }
        break;
      case 'NATIVE':
        // 扫码支付通常不需要额外参数
        break;
      case 'APP':
        // APP支付通常不需要额外参数
        break;
      case 'MWEB':
        if (!request.sceneInfo?.payer_client_ip) {
          return { isValid: false, message: 'H5支付必须提供客户端IP' };
        }
        break;
      default:
        return { isValid: false, message: `不支持的交易类型: ${tradeType}` };
    }

    return { isValid: true, message: '' };
  }

  /**
   * 验证退款请求参数
   */
  private validateRefundRequest(request: WechatRefundRequest): {isValid: boolean, message: string} {
    // 基础参数验证
    if (!request.orderId) {
      return { isValid: false, message: '订单ID不能为空' };
    }
    if (request.refundAmount <= 0) {
      return { isValid: false, message: '退款金额必须大于0' };
    }
    if (request.refundAmount > request.totalAmount) {
      return { isValid: false, message: '退款金额不能大于总金额' };
    }

    return { isValid: true, message: '' };
  }

  /**
   * 构建微信支付请求
   */
  private buildWechatPaymentRequest(request: WechatPaymentRequest): PaymentRequest {
    const tradeType = request.tradeType || 'JSAPI';

    const baseRequest: PaymentRequest = {
      orderId: request.orderId,
      amount: request.amount,
      subject: request.subject,
      description: request.description,
      notifyUrl: request.notifyUrl || this.config.notifyUrl,
      returnUrl: request.returnUrl,
      clientIp: request.clientIp,
      userId: request.userId,
      extra: {
        ...request.extra,
        paymentMethod: this.mapTradeTypeToPaymentMethod(tradeType),
        openid: request.openid,
        sceneInfo: request.sceneInfo,
        goodsDetail: request.goodsDetail,
        limitPay: request.limitPay,
        promotionInfo: request.promotionInfo
      }
    };

    return baseRequest;
  }

  /**
   * 构建微信退款请求
   */
  private buildWechatRefundRequest(request: WechatRefundRequest): RefundRequest {
    return {
      orderId: request.orderId,
      refundAmount: request.refundAmount,
      totalAmount: request.totalAmount,
      reason: request.reason || request.refundReason || '用户申请退款',
      refundId: request.refundId,
      extra: {
        ...request.extra,
        goodsDetail: request.goodsDetail,
        accountType: request.accountType,
        fromAccount: request.fromAccount,
        refundAccount: request.refundAccount,
        refundFeeType: request.refundFeeType
      }
    };
  }

  /**
   * 映射交易类型到支付方式
   */
  private mapTradeTypeToPaymentMethod(tradeType: string): PaymentMethod {
    const methodMap: Record<string, PaymentMethod> = {
      'JSAPI': PaymentMethod.WECHAT_JSAPI,
      'NATIVE': PaymentMethod.WECHAT_NATIVE,
      'APP': PaymentMethod.WECHAT_APP,
      'MWEB': PaymentMethod.WECHAT_H5
    };

    return methodMap[tradeType] || PaymentMethod.WECHAT_JSAPI;
  }

  /**
   * 解析微信支付响应
   */
  private parseWechatPaymentResponse(response: PaymentResponse, request: WechatPaymentRequest): WechatPaymentResponse {
    const wechatResponse: WechatPaymentResponse = {
      ...response,
      success: response.success
    };

    const tradeType = request.tradeType || 'JSAPI';

    // 根据交易类型解析特定响应
    if (tradeType === 'NATIVE' && response.qrCode) {
      wechatResponse.codeUrl = response.qrCode;
    }

    if (tradeType === 'MWEB' && response.redirectUrl) {
      wechatResponse.mwebUrl = response.redirectUrl;
    }

    if (tradeType === 'JSAPI' && response.payInfo) {
      wechatResponse.jsApiParams = response.payInfo;
    }

    if (tradeType === 'APP' && response.payInfo) {
      wechatResponse.appPayParams = response.payInfo;
    }

    return wechatResponse;
  }

  /**
   * 生成随机字符串
   */
  private generateNonceStr(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成模拟签名（实际应使用RSA私钥签名）
   */
  private generateMockSign(): string {
    return 'mock_signature_' + Date.now().toString();
  }
}

/**
 * 创建微信支付适配器实例
 */
export function createWechatPaymentAdapter(): WechatPaymentAdapter {
  // 从环境变量加载配置
  const config: WechatPayConfig = {
    appId: process.env.WECHAT_APP_ID || '',
    mchId: process.env.WECHAT_MCH_ID || '',
    apiV3Key: process.env.WECHAT_API_V3_KEY || '',
    apiClientCert: process.env.WECHAT_API_CLIENT_CERT || '',
    apiClientKey: process.env.WECHAT_API_CLIENT_KEY || '',
    apiSerialNo: process.env.WECHAT_API_SERIAL_NO || '',
    key: process.env.WECHAT_KEY || '',
    notifyUrl: process.env.WECHAT_NOTIFY_URL || `${process.env.API_BASE_URL}/api/v1/payments/wechat/notify`,
    refundNotifyUrl: process.env.WECHAT_REFUND_NOTIFY_URL || `${process.env.API_BASE_URL}/api/v1/payments/wechat/refund/notify`,
    sandbox: process.env.NODE_ENV === 'development' || process.env.WECHAT_SANDBOX === 'true'
  };

  // 验证必要配置
  if (!config.appId || !config.mchId || !config.key) {
    throw new Error('微信支付配置不完整，请检查环境变量');
  }

  return new WechatPaymentAdapter(config);
}

// 导出单例实例
export const wechatPaymentAdapter = createWechatPaymentAdapter();