import axios from 'axios';
import { createHash, createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PaymentProvider, PaymentRequest, PaymentResponse, RefundRequest, RefundResponse, QueryResponse, NotifyData } from '../base/provider';
import { WechatPayConfig, WECHAT_PAY_APIS, WECHAT_PAY_ENVIRONMENTS, WECHAT_PAY_STATUS, WECHAT_REFUND_STATUS } from './config';
import { PaymentMethod, ProviderType } from '../base/provider';

/**
 * 微信支付提供商实现
 */
export class WechatPayProvider extends PaymentProvider {
  private config: WechatPayConfig;
  private baseUrl: string;

  constructor(config: WechatPayConfig) {
    super(config, 'WeChatPay');
    this.config = config;
    this.baseUrl = config.sandbox ? WECHAT_PAY_ENVIRONMENTS.SANDBOX : WECHAT_PAY_ENVIRONMENTS.PRODUCTION;
  }

  /**
   * 获取支持的支付方式
   */
  getSupportedMethods(): string[] {
    return [
      PaymentMethod.WECHAT_JSAPI,
      PaymentMethod.WECHAT_NATIVE,
      PaymentMethod.WECHAT_APP,
      PaymentMethod.WECHAT_H5
    ];
  }

  /**
   * 创建支付订单
   */
  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const method = request.extra?.paymentMethod as PaymentMethod;
      const apiUrl = this.getPaymentApiUrl(method);

      const requestData = this.buildPaymentRequest(request, method);

      const response = await this.makeRequest('POST', apiUrl, requestData);

      return this.parsePaymentResponse(response, method);
    } catch (error) {
      this.handleError(error, '创建支付订单');
    }
  }

  /**
   * 查询支付状态
   */
  async queryPayment(orderId: string): Promise<QueryResponse> {
    try {
      const apiUrl = WECHAT_PAY_APIS.QUERY_ORDER.replace('{out_trade_no}', orderId);

      const response = await this.makeRequest('GET', apiUrl);

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
        out_refund_no: request.refundId || this.generateOrderId('RF'),
        reason: request.reason || '用户申请退款',
        amount: {
          refund: this.formatAmount(request.refundAmount),
          total: this.formatAmount(request.totalAmount),
          currency: 'CNY'
        },
        goods_detail: request.extra?.goodsDetail || []
      };

      const response = await this.makeRequest('POST', WECHAT_PAY_APIS.REFUND, requestData);

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
      const signature = headers?.['wechatpay-signature'] || headers?.['Wechatpay-Signature'];
      const timestamp = headers?.['wechatpay-timestamp'] || headers?.['Wechatpay-Timestamp'];
      const nonce = headers?.['wechatpay-nonce'] || headers?.['Wechatpay-Nonce'];

      if (!this.verifyNotifySignature(data, signature, timestamp, nonce)) {
        throw new Error('回调通知签名验证失败');
      }

      // 解析回调数据
      const resource = data.resource;
      const decryptedData = this.decryptNotifyData(resource);

      return this.parseNotifyData(decryptedData);
    } catch (error) {
      this.handleError(error, '验证支付回调');
    }
  }

  /**
   * 关闭支付订单
   */
  async closePayment(orderId: string): Promise<boolean> {
    try {
      const apiUrl = WECHAT_PAY_APIS.CLOSE_ORDER.replace('{out_trade_no}', orderId);

      const requestData = {
        out_trade_no: orderId
      };

      await this.makeRequest('POST', apiUrl, requestData);
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
    const signStr = Object.keys(data)
      .filter(key => data[key] !== undefined && data[key] !== '')
      .sort()
      .map(key => `${key}=${data[key]}`)
      .join('&') + `&key=${this.config.key}`;

    return createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
  }

  /**
   * 验证签名
   */
  protected verifySign(data: any, signature: string): boolean {
    const calculatedSign = this.generateSign(data);
    return calculatedSign === signature;
  }

  /**
   * 获取支付API地址
   */
  private getPaymentApiUrl(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.WECHAT_JSAPI:
        return WECHAT_PAY_APIS.UNIFIED_ORDER;
      case PaymentMethod.WECHAT_NATIVE:
        return WECHAT_PAY_APIS.NATIVE_PAY;
      case PaymentMethod.WECHAT_APP:
        return WECHAT_PAY_APIS.APP_PAY;
      case PaymentMethod.WECHAT_H5:
        return WECHAT_PAY_APIS.H5_PAY;
      default:
        throw new Error(`不支持的微信支付方式: ${method}`);
    }
  }

  /**
   * 构建支付请求数据
   */
  private buildPaymentRequest(request: PaymentRequest, method: PaymentMethod): any {
    const baseData = {
      appid: this.config.appId,
      mchid: this.config.mchId,
      description: request.subject,
      out_trade_no: request.orderId,
      time_expire: this.getExpireTime(),
      notify_url: request.notifyUrl || this.config.notifyUrl,
      amount: {
        total: this.formatAmount(request.amount),
        currency: 'CNY'
      },
      scene_info: request.extra?.sceneInfo || {}
    };

    switch (method) {
      case PaymentMethod.WECHAT_JSAPI:
        return {
          ...baseData,
          payer: {
            openid: request.extra?.openid
          }
        };

      case PaymentMethod.WECHAT_H5:
        return {
          ...baseData,
          scene_info: {
            payer_client_ip: request.clientIp,
            h5_info: {
              type: 'Wap',
              wap_url: request.returnUrl,
              wap_name: '中道商城'
            }
          }
        };

      case PaymentMethod.WECHAT_NATIVE:
      case PaymentMethod.WECHAT_APP:
        return baseData;

      default:
        throw new Error(`不支持的微信支付方式: ${method}`);
    }
  }

  /**
   * 解析支付响应
   */
  private parsePaymentResponse(response: any, method: PaymentMethod): PaymentResponse {
    if (response.code_url) {
      // Native扫码支付
      return {
        success: true,
        qrCode: response.code_url,
        providerOrderId: response.prepay_id
      };
    }

    if (response.prepay_id) {
      // JSAPI/APP支付
      const payInfo = this.buildPayInfo(response, method);
      return {
        success: true,
        prepayId: response.prepay_id,
        providerOrderId: response.prepay_id,
        payInfo
      };
    }

    return {
      success: false,
      message: '创建支付订单失败',
      raw: response
    };
  }

  /**
   * 构建支付参数
   */
  private buildPayInfo(response: any, method: PaymentMethod): any {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = uuidv4().replace(/-/g, '');

    const packageStr = `prepay_id=${response.prepay_id}`;
    const signType = 'RSA';

    // 构建待签名字符串
    const signStr = [
      this.config.appId,
      timeStamp,
      nonceStr,
      packageStr
    ].join('\n');

    const paySign = this.signWithRSA(signStr);

    switch (method) {
      case PaymentMethod.WECHAT_JSAPI:
        return {
          appId: this.config.appId,
          timeStamp,
          nonceStr,
          package: packageStr,
          signType,
          paySign
        };

      case PaymentMethod.WECHAT_APP:
        return {
          appid: this.config.appId,
          partnerid: this.config.mchId,
          prepayid: response.prepay_id,
          package: packageStr,
          noncestr: nonceStr,
          timestamp: timeStamp,
          sign: paySign
        };

      default:
        return response;
    }
  }

  /**
   * RSA签名
   */
  private signWithRSA(signStr: string): string {
    // 这里需要使用实际的RSA私钥进行签名
    // 暂时返回模拟签名，实际实现时需要使用crypto模块和私钥
    return 'mock_signature';
  }

  /**
   * 解析查询响应
   */
  private parseQueryResponse(response: any): QueryResponse {
    return {
      success: response.trade_state === WECHAT_PAY_STATUS.SUCCESS,
      tradeStatus: response.trade_state,
      orderId: response.out_trade_no,
      providerOrderId: response.transaction_id,
      totalAmount: this.parseAmount(response.amount?.total || 0),
      paidAmount: this.parseAmount(response.amount?.payer_total || 0),
      paidAt: response.success_time ? new Date(response.success_time) : undefined,
      raw: response
    };
  }

  /**
   * 解析退款响应
   */
  private parseRefundResponse(response: any): RefundResponse {
    return {
      success: response.status === WECHAT_REFUND_STATUS.SUCCESS,
      refundId: response.refund_id,
      transactionId: response.out_trade_no,
      refundStatus: response.status,
      raw: response
    };
  }

  /**
   * 验证回调通知签名
   */
  private verifyNotifySignature(data: any, signature: string, timestamp: string, nonce: string): boolean {
    // 构建验证字符串
    const message = `${timestamp}\n${nonce}\n${JSON.stringify(data)}\n`;

    // 这里需要使用微信支付平台证书进行验证
    // 暂时返回true，实际实现时需要验证RSA签名
    return true;
  }

  /**
   * 解密回调数据
   */
  private decryptNotifyData(resource: any): any {
    const { ciphertext, associated_data, nonce } = resource;

    // 使用AES-256-GCM解密
    // 这里需要实现实际的解密逻辑
    try {
      // 暂时返回解密后的数据结构
      return {
        out_trade_no: resource.out_trade_no,
        transaction_id: resource.transaction_id,
        trade_state: resource.trade_state,
        amount: resource.amount,
        success_time: resource.success_time
      };
    } catch (error) {
      throw new Error('解密回调数据失败');
    }
  }

  /**
   * 解析回调数据
   */
  private parseNotifyData(data: any): NotifyData {
    return {
      orderId: data.out_trade_no,
      providerOrderId: data.transaction_id,
      transactionId: data.transaction_id,
      tradeStatus: data.trade_state,
      totalAmount: this.parseAmount(data.amount?.total || 0),
      paidAt: data.success_time ? new Date(data.success_time) : undefined,
      raw: data
    };
  }

  /**
   * 发送HTTP请求
   */
  private async makeRequest(method: string, url: string, data?: any): Promise<any> {
    const fullUrl = `${this.baseUrl}${url}`;
    const headers = this.buildHeaders(method, url, data);

    const config = {
      method,
      url: fullUrl,
      headers,
      timeout: 30000
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  }

  /**
   * 构建请求头
   */
  private buildHeaders(method: string, url: string, data?: any): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = uuidv4().replace(/-/g, '');

    // 构建签名字符串
    const signStr = [
      method,
      url,
      timestamp,
      nonce,
      data ? JSON.stringify(data) : ''
    ].join('\n');

    const signature = this.signWithRSA(signStr);

    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `WECHATPAY2-SHA256-RSA2048 ${signature}`,
      'Wechatpay-Timestamp': timestamp,
      'Wechatpay-Nonce': nonce,
      'Wechatpay-Serial': this.config.apiSerialNo
    };
  }

  /**
   * 获取过期时间
   */
  private getExpireTime(): string {
    const now = new Date();
    // 设置2小时后过期
    now.setHours(now.getHours() + 2);
    return now.toISOString().replace(/\.\d{3}Z$/, '+08:00');
  }
}