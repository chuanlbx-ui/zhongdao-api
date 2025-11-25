import { PaymentProviderFactory, ProviderType } from '../shared/payments';
import { WechatPayConfig } from '../shared/payments/wechat/config';
import { AlipayConfig } from '../shared/payments/alipay/config';

/**
 * 支付配置加载
 */
export class PaymentConfigLoader {
  /**
   * 从环境变量加载微信支付配置
   */
  static loadWechatPayConfig(): WechatPayConfig {
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

    this.validateWechatPayConfig(config);
    return config;
  }

  /**
   * 从环境变量加载支付宝支付配置 (已暂时禁用)
   */
  // static loadAlipayConfig(): AlipayConfig {
  //   const config: AlipayConfig = {
  //     appId: process.env.ALIPAY_APP_ID || '',
  //     privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
  //     alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
  //     gatewayUrl: process.env.ALIPAY_GATEWAY_URL || (process.env.NODE_ENV === 'development' ? 'https://openapi.alipaydev.com/gateway.do' : 'https://openapi.alipay.com/gateway.do'),
  //     notifyUrl: process.env.ALIPAY_NOTIFY_URL || `${process.env.API_BASE_URL}/api/v1/payments/alipay/notify`,
  //     refundNotifyUrl: process.env.ALIPAY_REFUND_NOTIFY_URL || `${process.env.API_BASE_URL}/api/v1/payments/alipay/refund/notify`,
  //     returnUrl: process.env.ALIPAY_RETURN_URL || `${process.env.FRONTEND_URL}/payment/success`,
  //     signType: process.env.ALIPAY_SIGN_TYPE || 'RSA2',
  //     charset: process.env.ALIPAY_CHARSET || 'utf-8',
  //     version: process.env.ALIPAY_VERSION || '1.0',
  //     format: process.env.ALIPAY_FORMAT || 'json',
  //     sandbox: process.env.NODE_ENV === 'development' || process.env.ALIPAY_SANDBOX === 'true'
  //   };

  //   this.validateAlipayConfig(config);
  //   return config;
  // }

  /**
   * 验证微信支付配置
   */
  private static validateWechatPayConfig(config: WechatPayConfig): void {
    const requiredFields = ['appId', 'mchId', 'apiV3Key', 'key'];
    const missingFields = requiredFields.filter(field => !config[field as keyof WechatPayConfig]);

    if (missingFields.length > 0) {
      console.warn('微信支付配置缺少必要字段:', missingFields);
      console.warn('请在环境变量中设置以下字段:');
      missingFields.forEach(field => {
        const envVar = field === 'appId' ? 'WECHAT_APP_ID' :
                      field === 'mchId' ? 'WECHAT_MCH_ID' :
                      field === 'apiV3Key' ? 'WECHAT_API_V3_KEY' :
                      field === 'key' ? 'WECHAT_KEY' : field;
        console.warn(`  ${envVar}`);
      });
    }
  }

  /**
   * 验证支付宝支付配置 (已暂时禁用)
   */
  // private static validateAlipayConfig(config: AlipayConfig): void {
  //   const requiredFields = ['appId', 'privateKey', 'alipayPublicKey'];
  //   const missingFields = requiredFields.filter(field => !config[field as keyof AlipayConfig]);

  //   if (missingFields.length > 0) {
  //     console.warn('支付宝支付配置缺少必要字段:', missingFields);
  //     console.warn('请在环境变量中设置以下字段:');
  //     missingFields.forEach(field => {
  //       const envVar = field === 'appId' ? 'ALIPAY_APP_ID' :
  //                     field === 'privateKey' ? 'ALIPAY_PRIVATE_KEY' :
  //                     field === 'alipayPublicKey' ? 'ALIPAY_PUBLIC_KEY' : field;
  //       console.warn(`  ${envVar}`);
  //     });
  //   }
  // }

  /**
   * 初始化支付系统 (仅启用微信支付)
   */
  static initializePaymentSystem(): void {
    try {
      // 加载微信支付配置
      const wechatConfig = this.loadWechatPayConfig();

      // 设置支付提供商配置 (仅微信支付)
      PaymentProviderFactory.setConfig(ProviderType.WECHAT, wechatConfig);

      console.log('支付系统初始化成功');
      console.log('微信支付沙箱模式:', wechatConfig.sandbox ? '启用' : '禁用');
      console.log('支付宝支付: 已暂时禁用');
    } catch (error) {
      console.error('支付系统初始化失败:', error);
    }
  }
}

/**
 * 默认导出配置加载器
 */
export default PaymentConfigLoader;