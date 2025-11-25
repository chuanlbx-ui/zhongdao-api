/**
 * 中道商城支付宝支付适配器
 * 基于现有支付宝支付基础设施，提供高级业务封装
 */

import { logger } from '../../utils/logger';
import { AlipayPayProvider } from '../../shared/payments/alipay/provider';
import { AlipayConfig } from '../../shared/payments/alipay/config';
import { PaymentProvider, PaymentRequest, PaymentResponse, RefundRequest, RefundResponse, QueryResponse, NotifyData } from '../../shared/payments/base/provider';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface AlipayPaymentRequest extends PaymentRequest {
  // 支付宝支付特有字段
  productCode?: string;       // 产品码
  qrPayMode?: string;        // 二维码支付模式
  qrPayWidth?: number;       // 二维码宽度
  timeoutExpress?: string;   // 超时时间
  timeExpire?: string;       // 绝对超时时间
  returnParams?: string;     // 公共回传参数
  quitUrl?: string;          // 用户付款中途退出返回商户的地址
  extendParams?: string;     // 业务扩展参数
  goodsDetail?: Array<{      // 商品详情
    goods_id: string;
    goods_name: string;
    quantity: number;
    price: number;
  }>;
  operatorId?: string;       // 操作员ID
  storeId?: string;          // 门店ID
  terminalId?: string;       // 终端ID
  businessParams?: string;   // 业务参数
  royaltyParameters?: Array<{  // 分账信息
    trans_in_type: string;
    trans_in: string;
    amount: number;
    desc?: string;
  }>;
  subMerchant?: {           // 二级商户信息
    merchant_id: string;
    merchant_type: string;
    merchant_name: string;
    merchant_service_name: string;
    merchant_service_phone: string;
  };
}

export interface AlipayPaymentResponse extends PaymentResponse {
  // 支付宝支付特有响应字段
  qrCode?: string;           // 二维码内容
  form?: string;            // 表单HTML（网页支付）
  mwebUrl?: string;         // 移动端支付链接
  appPayParams?: string;    // APP支付参数
  tradeNo?: string;         // 支付宝交易号
  outTradeNo?: string;      // 商户订单号
}

export interface AlipayRefundRequest extends RefundRequest {
  // 支付宝退款特有字段
  refundAmount?: number;     // 退款金额（string类型，支付宝要求）
  refundReason?: string;     // 退款原因
  outRequestNo?: string;     // 退款请求号
  refundRoyaltyParameters?: Array<{ // 退款分账信息
    trans_in_type: string;
    trans_in: string;
    amount: number;
    desc?: string;
  }>;
  operatorId?: string;       // 操作员ID
  storeId?: string;          // 门店ID
  terminalId?: string;       // 终端ID
}

export interface AlipayNotifyData extends NotifyData {
  // 支付宝回调特有字段
  tradeNo?: string;          // 支付宝交易号
  outTradeNo?: string;       // 商户订单号
  totalAmount?: string;      // 订单金额
  buyerId?: string;          // 买家支付宝用户ID
  fundBillList?: string;     // 支付金额信息
  passbackParams?: string;   // 公共回传参数
  charset?: string;          // 编码格式
  gmtCreate?: string;        // 交易创建时间
  gmtPayment?: string;       // 交易付款时间
  gmtRefund?: string;        // 交易退款时间
  gmtClose?: string;         // 交易关闭时间
  fundChannel?: string;      // 支付渠道
  discountAmount?: string;   // 平台优惠金额
  mDiscountAmount?: string;  // 商家优惠金额
  invoiceAmount?: string;    // 发票金额
  buyerPayAmount?: string;   // 用户支付金额
  pointAmount?: string;      // 积分金额
  receiptAmount?: string;    // 实收金额
  subject?: string;          // 订单标题
  body?: string;             // 商品描述
  buyerLogonId?: string;     // 买家支付宝账号
  notifyId?: string;         // 通知校验ID
  notifyTime?: string;       // 通知时间
  notifyType?: string;       // 通知类型
  sellerId?: string;         // 卖家支付宝用户ID
  sellerEmail?: string;      // 卖家支付宝账号
  totalFee?: string;         // 订单价格
  tradeStatus?: string;      // 交易状态
  useCoupon?: boolean;       // 是否使用优惠券
  isTotalFeeAdjust?: boolean; // 是否调整总价
}

/**
 * 支付宝支付适配器类
 */
export class AlipayPaymentAdapter {
  private alipayProvider: AlipayPayProvider;
  private config: AlipayConfig;

  constructor(config: AlipayConfig) {
    this.config = config;
    this.alipayProvider = new AlipayPayProvider(config);
  }

  /**
   * 创建支付宝支付订单
   */
  async createPayment(request: AlipayPaymentRequest): Promise<AlipayPaymentResponse> {
    const startTime = Date.now();

    try {
      logger.info('开始创建支付宝支付订单', {
        orderId: request.orderId,
        amount: request.amount,
        productCode: request.productCode
      });

      // 1. 验证支付参数
      const validation = this.validatePaymentRequest(request);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // 2. 构建支付宝支付请求
      const alipayRequest = this.buildAlipayPaymentRequest(request);

      // 3. 调用支付宝支付API
      const response = await this.alipayProvider.createPayment(alipayRequest);

      // 4. 解析支付宝支付响应
      const alipayResponse = this.parseAlipayPaymentResponse(response, request);

      // 5. 记录操作日志
      logger.info('支付宝支付订单创建成功', {
        orderId: request.orderId,
        providerOrderId: alipayResponse.providerOrderId,
        success: alipayResponse.success,
        duration: Date.now() - startTime
      });

      return alipayResponse;

    } catch (error) {
      logger.error('创建支付宝支付订单失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 查询支付宝支付状态
   */
  async queryPayment(orderId: string): Promise<QueryResponse> {
    const startTime = Date.now();

    try {
      logger.info('开始查询支付宝支付状态', { orderId });

      const response = await this.alipayProvider.queryPayment(orderId);

      logger.info('支付宝支付状态查询成功', {
        orderId,
        tradeStatus: response.tradeStatus,
        success: response.success,
        duration: Date.now() - startTime
      });

      return response;

    } catch (error) {
      logger.error('查询支付宝支付状态失败', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 申请支付宝支付退款
   */
  async createRefund(request: AlipayRefundRequest): Promise<RefundResponse> {
    const startTime = Date.now();

    try {
      logger.info('开始申请支付宝支付退款', {
        orderId: request.orderId,
        refundAmount: request.refundAmount
      });

      // 1. 验证退款参数
      const validation = this.validateRefundRequest(request);
      if (!validation.isValid) {
        throw new Error(validation.message);
      }

      // 2. 构建支付宝退款请求
      const alipayRefundRequest = this.buildAlipayRefundRequest(request);

      // 3. 调用支付宝退款API
      const response = await this.alipayProvider.createRefund(alipayRefundRequest);

      logger.info('支付宝支付退款申请成功', {
        orderId: request.orderId,
        refundId: response.refundId,
        success: response.success,
        duration: Date.now() - startTime
      });

      return response;

    } catch (error) {
      logger.error('申请支付宝支付退款失败', {
        request,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 验证支付宝支付回调通知
   */
  async verifyNotify(data: any, headers?: any): Promise<AlipayNotifyData> {
    const startTime = Date.now();

    try {
      logger.info('开始验证支付宝支付回调通知', {
        notifyType: data.notify_type,
        tradeNo: data.trade_no
      });

      const notifyData = await this.alipayProvider.verifyNotify(data, headers);

      // 扩展回调数据
      const alipayNotifyData: AlipayNotifyData = {
        ...notifyData,
        tradeNo: data.trade_no,
        outTradeNo: data.out_trade_no,
        totalAmount: data.total_amount,
        buyerId: data.buyer_id,
        fundBillList: data.fund_bill_list,
        passbackParams: data.passback_params,
        charset: data.charset,
        gmtCreate: data.gmt_create,
        gmtPayment: data.gmt_payment,
        gmtRefund: data.gmt_refund,
        gmtClose: data.gmt_close,
        fundChannel: data.fund_channel,
        discountAmount: data.discount_amount,
        mDiscountAmount: data.m_discount_amount,
        invoiceAmount: data.invoice_amount,
        buyerPayAmount: data.buyer_pay_amount,
        pointAmount: data.point_amount,
        receiptAmount: data.receipt_amount,
        subject: data.subject,
        body: data.body,
        buyerLogonId: data.buyer_logon_id,
        notifyId: data.notify_id,
        notifyTime: data.notify_time,
        notifyType: data.notify_type,
        sellerId: data.seller_id,
        sellerEmail: data.seller_email,
        totalFee: data.total_fee,
        tradeStatus: data.trade_status,
        useCoupon: data.use_coupon === 'T',
        isTotalFeeAdjust: data.is_total_fee_adjust === 'Y'
      };

      logger.info('支付宝支付回调验证成功', {
        orderId: alipayNotifyData.orderId,
        tradeStatus: alipayNotifyData.tradeStatus,
        notifyType: alipayNotifyData.notifyType,
        duration: Date.now() - startTime
      });

      return alipayNotifyData;

    } catch (error) {
      logger.error('验证支付宝支付回调失败', {
        data: typeof data === 'object' ? Object.keys(data) : data,
        error: error instanceof Error ? error.message : '未知错误',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * 关闭支付宝支付订单
   */
  async closePayment(orderId: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      logger.info('开始关闭支付宝支付订单', { orderId });

      const result = await this.alipayProvider.closePayment(orderId);

      logger.info('支付宝支付订单关闭成功', {
        orderId,
        success: result,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('关闭支付宝支付订单失败', {
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
    return this.alipayProvider.getSupportedMethods();
  }

  /**
   * 生成支付宝APP支付参数
   */
  generateAPPParams(tradeNo: string): string {
    // 这里应该调用支付宝API获取APP支付参数
    // 暂时返回模拟数据
    return JSON.stringify({
      app_id: this.config.appId,
      method: 'alipay.trade.app.pay',
      charset: this.config.charset,
      sign_type: this.config.signType,
      timestamp: this.getTimestamp(),
      version: this.config.version,
      notify_url: this.config.notifyUrl,
      biz_content: JSON.stringify({
        out_trade_no: tradeNo,
        total_amount: '0.01',
        subject: '中道商城订单支付',
        product_code: 'QUICK_MSECURITY_PAY'
      })
    });
  }

  // ===== 私有方法 =====

  /**
   * 验证支付请求参数
   */
  private validatePaymentRequest(request: AlipayPaymentRequest): {isValid: boolean, message: string} {
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

    // 根据产品码验证特定参数
    const productCode = request.productCode || 'FAST_INSTANT_TRADE_PAY';

    switch (productCode) {
      case 'FAST_INSTANT_TRADE_PAY': // 网页支付
        break;
      case 'QUICK_WAP_PAY': // 手机网站支付
        if (!request.clientIp) {
          return { isValid: false, message: '手机网站支付必须提供客户端IP' };
        }
        break;
      case 'QUICK_MSECURITY_PAY': // APP支付
        break;
      case 'FACE_TO_FACE_PAYMENT': // 扫码支付
        break;
      default:
        return { isValid: false, message: `不支持的产品码: ${productCode}` };
    }

    return { isValid: true, message: '' };
  }

  /**
   * 验证退款请求参数
   */
  private validateRefundRequest(request: AlipayRefundRequest): {isValid: boolean, message: string} {
    // 基础参数验证
    if (!request.orderId) {
      return { isValid: false, message: '订单ID不能为空' };
    }
    if (!request.refundAmount || request.refundAmount <= 0) {
      return { isValid: false, message: '退款金额必须大于0' };
    }
    if (request.refundAmount > request.totalAmount) {
      return { isValid: false, message: '退款金额不能大于总金额' };
    }

    return { isValid: true, message: '' };
  }

  /**
   * 构建支付宝支付请求
   */
  private buildAlipayPaymentRequest(request: AlipayPaymentRequest): PaymentRequest {
    const productCode = request.productCode || 'FAST_INSTANT_TRADE_PAY';

    const baseRequest: PaymentRequest = {
      orderId: request.orderId,
      amount: request.amount,
      subject: request.subject,
      description: request.description,
      notifyUrl: request.notifyUrl || this.config.notifyUrl,
      returnUrl: request.returnUrl || this.config.returnUrl,
      clientIp: request.clientIp,
      userId: request.userId,
      extra: {
        ...request.extra,
        paymentMethod: this.mapProductCodeToPaymentMethod(productCode),
        productCode,
        qrPayMode: request.qrPayMode,
        qrPayWidth: request.qrPayWidth,
        timeoutExpress: request.timeoutExpress,
        timeExpire: request.timeExpire,
        returnParams: request.returnParams,
        quitUrl: request.quitUrl,
        extendParams: request.extendParams,
        goodsDetail: request.goodsDetail,
        operatorId: request.operatorId,
        storeId: request.storeId,
        terminalId: request.terminalId,
        businessParams: request.businessParams,
        royaltyParameters: request.royaltyParameters,
        subMerchant: request.subMerchant
      }
    };

    return baseRequest;
  }

  /**
   * 构建支付宝退款请求
   */
  private buildAlipayRefundRequest(request: AlipayRefundRequest): RefundRequest {
    return {
      orderId: request.orderId,
      refundAmount: request.refundAmount!,
      totalAmount: request.totalAmount,
      reason: request.reason || request.refundReason || '用户申请退款',
      refundId: request.outRequestNo,
      extra: {
        ...request.extra,
        refundAmount: request.refundAmount?.toFixed(2),
        refundReason: request.refundReason,
        outRequestNo: request.outRequestNo,
        refundRoyaltyParameters: request.refundRoyaltyParameters,
        operatorId: request.operatorId,
        storeId: request.storeId,
        terminalId: request.terminalId
      }
    };
  }

  /**
   * 映射产品码到支付方式
   */
  private mapProductCodeToPaymentMethod(productCode: string): PaymentMethod {
    const methodMap: Record<string, PaymentMethod> = {
      'FAST_INSTANT_TRADE_PAY': PaymentMethod.ALIPAY_WEB,
      'QUICK_WAP_PAY': PaymentMethod.ALIPAY_WAP,
      'QUICK_MSECURITY_PAY': PaymentMethod.ALIPAY_APP,
      'FACE_TO_FACE_PAYMENT': PaymentMethod.ALIPAY_QR
    };

    return methodMap[productCode] || PaymentMethod.ALIPAY_WEB;
  }

  /**
   * 解析支付宝支付响应
   */
  private parseAlipayPaymentResponse(response: PaymentResponse, request: AlipayPaymentRequest): AlipayPaymentResponse {
    const alipayResponse: AlipayPaymentResponse = {
      ...response,
      success: response.success
    };

    // 解析特定响应字段
    if (response.qrCode) {
      alipayResponse.qrCode = response.qrCode;
    }

    if (response.redirectUrl && (response.redirectUrl.includes('<form>') || response.redirectUrl.includes('alipay.com'))) {
      alipayResponse.form = response.redirectUrl;
    }

    if (response.redirectUrl && response.redirectUrl.includes('qr.alipay.com')) {
      alipayResponse.mwebUrl = response.redirectUrl;
    }

    if (response.payInfo) {
      alipayResponse.appPayParams = JSON.stringify(response.payInfo);
    }

    // 提取支付宝交易号
    if (response.raw && response.raw.alipay_trade_create_response) {
      const tradeResponse = response.raw.alipay_trade_create_response;
      alipayResponse.tradeNo = tradeResponse.trade_no;
      alipayResponse.outTradeNo = tradeResponse.out_trade_no;
    }

    return alipayResponse;
  }

  /**
   * 获取时间戳格式
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  }
}

/**
 * 创建支付宝支付适配器实例
 */
export function createAlipayPaymentAdapter(): AlipayPaymentAdapter {
  // 从环境变量加载配置
  const config: AlipayConfig = {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    gatewayUrl: process.env.ALIPAY_GATEWAY_URL || (process.env.NODE_ENV === 'development' ? 'https://openapi.alipaydev.com/gateway.do' : 'https://openapi.alipay.com/gateway.do'),
    notifyUrl: process.env.ALIPAY_NOTIFY_URL || `${process.env.API_BASE_URL}/api/v1/payments/alipay/notify`,
    refundNotifyUrl: process.env.ALIPAY_REFUND_NOTIFY_URL || `${process.env.API_BASE_URL}/api/v1/payments/alipay/refund/notify`,
    returnUrl: process.env.ALIPAY_RETURN_URL || `${process.env.FRONTEND_URL}/payment/success`,
    signType: process.env.ALIPAY_SIGN_TYPE || 'RSA2',
    charset: process.env.ALIPAY_CHARSET || 'utf-8',
    version: process.env.ALIPAY_VERSION || '1.0',
    format: process.env.ALIPAY_FORMAT || 'json',
    sandbox: process.env.NODE_ENV === 'development' || process.env.ALIPAY_SANDBOX === 'true'
  };

  // 验证必要配置
  if (!config.appId || !config.privateKey || !config.alipayPublicKey) {
    throw new Error('支付宝支付配置不完整，请检查环境变量');
  }

  return new AlipayPaymentAdapter(config);
}

// 导出单例实例
export const alipayPaymentAdapter = createAlipayPaymentAdapter();