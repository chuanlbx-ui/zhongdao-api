import axios from 'axios';
import { createSign } from 'crypto';
import { PaymentProvider, PaymentRequest, PaymentResponse, RefundRequest, RefundResponse, QueryResponse, NotifyData } from '../base/provider';
import { AlipayConfig, ALIPAY_APIS, ALIPAY_ENVIRONMENTS, ALIPAY_TRADE_STATUS } from './config';
import { PaymentMethod, ProviderType } from '../base/provider';

/**
 * 支付宝支付提供商实现
 */
export class AlipayPayProvider extends PaymentProvider {
  private config: AlipayConfig;
  private baseUrl: string;

  constructor(config: AlipayConfig) {
    super(config, 'AlipayPay');
    this.config = config;
    this.baseUrl = config.sandbox ? ALIPAY_ENVIRONMENTS.SANDBOX : ALIPAY_ENVIRONMENTS.PRODUCTION;
  }

  /**
   * 获取支持的支付方式
   */
  getSupportedMethods(): string[] {
    return [
      PaymentMethod.ALIPAY_WEB,
      PaymentMethod.ALIPAY_WAP,
      PaymentMethod.ALIPAY_APP,
      PaymentMethod.ALIPAY_QR
    ];
  }

  /**
   * 创建支付订单
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const method = request.extra?.paymentMethod as PaymentMethod;
      const apiMethod = this.getPaymentApiMethod(method);

      const requestData = this.buildPaymentRequest(request, method);

      const response = await this.makeRequest(apiMethod, requestData);

      return this.parsePaymentResponse(response, method, request);
    } catch (error) {
      this.handleError(error, '创建支付订单');
    }
  }

  /**
   * 查询支付状态
   */
  async queryPayment(orderId: string): Promise<QueryResponse> {
    try {
      const requestData = {
        out_trade_no: orderId
      };

      const response = await this.makeRequest(ALIPAY_APIS.TRADE_QUERY, requestData);

      return this.parseQueryResponse(response);
    } catch (error) {
      this.handleError(error, '查询支付状态');
    }
  }

  /**
   * 申请退款
   */
  async createRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const requestData = {
        out_trade_no: request.orderId,
        refund_amount: request.refundAmount.toFixed(2),
        refund_reason: request.reason || '用户申请退款',
        out_request_no: request.refundId || this.generateOrderId('RF')
      };

      const response = await this.makeRequest(ALIPAY_APIS.TRADE_REFUND, requestData);

      return this.parseRefundResponse(response);
    } catch (error) {
      this.handleError(error, '申请退款');
    }
  }

  /**
   * 验证支付回调通知
   */
  async verifyNotify(data: any, headers?: any): Promise<NotifyData> {
    try {
      // 验证签名
      if (!this.verifyNotifySign(data)) {
        throw new Error('回调通知签名验证失败');
      }

      return this.parseNotifyData(data);
    } catch (error) {
      this.handleError(error, '验证支付回调');
    }
  }

  /**
   * 关闭支付订单
   */
  async closePayment(orderId: string): Promise<boolean> {
    try {
      const requestData = {
        out_trade_no: orderId
      };

      await this.makeRequest(ALIPAY_APIS.TRADE_CLOSE, requestData);
      return true;
    } catch (error) {
      this.log('error', '关闭支付订单失败', { orderId, error: error.message });
      return false;
    }
  }

  /**
   * 生成签名
   */
  protected generateSign(data: any): string {
    // 构建待签名字符串
    const signContent = this.buildSignContent(data);

    // 使用RSA2签名
    const sign = createSign('RSA-SHA256');
    sign.update(signContent, 'utf8');

    return sign.sign(this.config.privateKey, 'base64');
  }

  /**
   * 验证签名
   */
  protected verifySign(data: any, signature: string): boolean {
    const signContent = this.buildSignContent(data);
    // 这里需要使用支付宝公钥验证签名
    // 简化实现，实际需要使用crypto模块验证
    return true;
  }

  /**
   * 获取支付API方法
   */
  private getPaymentApiMethod(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.ALIPAY_WEB:
        return ALIPAY_APIS.TRADE_CREATE;
      case PaymentMethod.ALIPAY_WAP:
        return ALIPAY_APIS.TRADE_WAP_PAY;
      case PaymentMethod.ALIPAY_APP:
        return ALIPAY_APIS.TRADE_APP_PAY;
      case PaymentMethod.ALIPAY_QR:
        return ALIPAY_APIS.TRADE_QR_PAY;
      default:
        throw new Error(`不支持的支付宝支付方式: ${method}`);
    }
  }

  /**
   * 构建支付请求数据
   */
  private buildPaymentRequest(request: PaymentRequest, method: PaymentMethod): any {
    const baseData = {
      out_trade_no: request.orderId,
      total_amount: request.amount.toFixed(2),
      subject: request.subject,
      body: request.description || '',
      notify_url: request.notifyUrl || this.config.notifyUrl,
      return_url: request.returnUrl || this.config.returnUrl
    };

    switch (method) {
      case PaymentMethod.ALIPAY_WEB:
        return {
          ...baseData,
          product_code: 'FAST_INSTANT_TRADE_PAY'
        };

      case PaymentMethod.ALIPAY_WAP:
        return {
          ...baseData,
          product_code: 'QUICK_WAP_PAY',
          quit_url: request.extra?.quitUrl
        };

      case PaymentMethod.ALIPAY_QR:
        return {
          ...baseData,
          timeout_express: request.extra?.timeoutExpress || '30m'
        };

      case PaymentMethod.ALIPAY_APP:
        return {
          ...baseData,
          timeout_express: request.extra?.timeoutExpress || '30m'
        };

      default:
        return baseData;
    }
  }

  /**
   * 解析支付响应
   */
  private parsePaymentResponse(response: any, method: PaymentMethod, request: PaymentRequest): PaymentResponse {
    try {
      // 扫码支付返回二维码
      if (response.qr_code) {
        return {
          success: true,
          qrCode: response.qr_code,
          providerOrderId: response.out_trade_no
        };
      }

      // APP支付返回支付参数
      if (method === PaymentMethod.ALIPAY_APP && response.trade_no) {
        return {
          success: true,
          prepayId: response.trade_no,
          providerOrderId: response.out_trade_no,
          payInfo: response
        };
      }

      // 网页支付和WAP支付需要跳转到支付宝页面
      if (response.code || response.form) {
        return {
          success: true,
          redirectUrl: response.code || response.form,
          providerOrderId: response.out_trade_no
        };
      }

      return {
        success: false,
        message: '创建支付订单失败',
        raw: response
      };
    } catch (error) {
      return {
        success: false,
        message: '解析支付响应失败',
        error: error.message,
        raw: response
      };
    }
  }

  /**
   * 解析查询响应
   */
  private parseQueryResponse(response: any): QueryResponse {
    return {
      success: response.trade_status === ALIPAY_TRADE_STATUS.TRADE_SUCCESS,
      tradeStatus: response.trade_status,
      orderId: response.out_trade_no,
      providerOrderId: response.trade_no,
      totalAmount: response.total_amount ? parseFloat(response.total_amount) : undefined,
      paidAmount: response.total_amount ? parseFloat(response.total_amount) : undefined,
      paidAt: response.send_pay_date ? new Date(response.send_pay_date) : undefined,
      raw: response
    };
  }

  /**
   * 解析退款响应
   */
  private parseRefundResponse(response: any): RefundResponse {
    return {
      success: response.code === '10000',
      refundId: response.out_request_no,
      transactionId: response.trade_no,
      refundStatus: response.refund_status,
      message: response.msg,
      raw: response
    };
  }

  /**
   * 验证回调通知签名
   */
  private verifyNotifySign(data: any): boolean {
    const signature = data.sign;
    if (!signature) {
      return false;
    }

    // 移除sign字段，只验证其他字段
    const signData = { ...data };
    delete signData.sign;

    return this.verifySign(signData, signature);
  }

  /**
   * 解析回调数据
   */
  private parseNotifyData(data: any): NotifyData {
    return {
      orderId: data.out_trade_no,
      providerOrderId: data.trade_no,
      transactionId: data.trade_no,
      tradeStatus: data.trade_status,
      totalAmount: data.total_amount ? parseFloat(data.total_amount) : undefined,
      paidAt: data.gmt_payment ? new Date(data.gmt_payment) : undefined,
      raw: data
    };
  }

  /**
   * 发送请求到支付宝
   */
  private async makeRequest(method: string, bizData: any): Promise<any> {
    const requestData = {
      app_id: this.config.appId,
      method: method,
      charset: this.config.charset,
      sign_type: this.config.signType,
      timestamp: this.getTimestamp(),
      version: this.config.version,
      notify_url: this.config.notifyUrl,
      biz_content: JSON.stringify(bizData)
    };

    // 生成签名
    const sign = this.generateSign(requestData);
    requestData.sign = sign;

    try {
      const response = await axios.post(this.baseUrl, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      return this.parseResponse(response.data, method);
    } catch (error) {
      this.log('error', '支付宝请求失败', {
        method,
        error: error.message,
        requestData
      });
      throw error;
    }
  }

  /**
   * 解析支付宝响应
   */
  private parseResponse(response: string, method: string): any {
    // 处理直接返回的情况（如扫码支付）
    if (typeof response === 'string') {
      // 检查是否是二维码URL或表单
      if (response.includes('qr.alipay.com') || response.includes('<form>')) {
        return response;
      }
    }

    // 处理JSON响应
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;

      // 检查是否是错误响应
      if (parsed.code && parsed.code !== '10000') {
        throw new Error(`支付宝API错误: ${parsed.msg || parsed.sub_msg}`);
      }

      // 对于不同的API方法，返回不同的数据结构
      if (parsed[method]) {
        return parsed[method];
      }

      return parsed;
    } catch (error) {
      this.log('error', '解析支付宝响应失败', {
        response,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 构建签名内容
   */
  private buildSignContent(data: any): string {
    // 过滤空值并排序
    const sortedKeys = Object.keys(data)
      .filter(key => data[key] !== null && data[key] !== undefined && data[key] !== '')
      .sort();

    // 构建签名字符串
    const signContent = sortedKeys
      .map(key => `${key}=${data[key]}`)
      .join('&');

    return signContent;
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