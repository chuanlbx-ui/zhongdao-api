import { logger } from '../utils/logger';
import { WechatPayConfig } from '../payments/wechat/config';

/**
 * 微信支付配置管理服务
 */
export class WechatConfigService {
  /**
   * 获取微信支付配置
   * 优先从环境变量读取，如果没有则返回默认沙箱配置
   */
  getConfig(): WechatPayConfig {
    const config: WechatPayConfig = {
      appId: process.env.WECHAT_APP_ID || '',
      mchId: process.env.WECHAT_MCH_ID || '',
      apiV3Key: process.env.WECHAT_API_V3_KEY || '',
      apiClientCert: process.env.WECHAT_API_CLIENT_CERT || '',
      apiClientKey: process.env.WECHAT_API_CLIENT_KEY || '',
      apiSerialNo: process.env.WECHAT_API_SERIAL_NO || '',
      notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
      refundNotifyUrl: process.env.WECHAT_REFUND_NOTIFY_URL || '',
      key: process.env.WECHAT_KEY || '',
      sandbox: process.env.NODE_ENV === 'development' || process.env.WECHAT_SANDBOX === 'true'
    };

    // 如果缺少关键配置，使用沙箱测试配置
    if (!this.isConfigured(config)) {
      logger.warn('微信支付配置不完整，使用沙箱测试配置');
      return this.getSandboxConfig();
    }

    return config;
  }

  /**
   * 检查微信支付是否已正确配置
   */
  isConfigured(config?: WechatPayConfig): boolean {
    const cfg = config || this.getConfig();

    const requiredFields = [
      'appId',
      'mchId',
      'apiV3Key',
      'notifyUrl'
    ];

    return requiredFields.every(field => {
      const value = cfg[field as keyof WechatPayConfig];
      return value && value.trim().length > 0;
    });
  }

  /**
   * 获取沙箱测试配置
   */
  private getSandboxConfig(): WechatPayConfig {
    return {
      appId: 'wx_test_app_id',
      mchId: 'test_mch_id',
      apiV3Key: 'test_api_v3_key',
      apiClientCert: 'test_cert_content',
      apiClientKey: 'test_key_content',
      apiSerialNo: 'test_serial_no',
      notifyUrl: this.getDefaultNotifyUrl(),
      refundNotifyUrl: this.getDefaultRefundNotifyUrl(),
      key: 'test_merchant_key',
      sandbox: true,
      serverUrl: 'https://api.mch.weixin.qq.com/sandboxnew'
    };
  }

  /**
   * 获取默认通知地址
   */
  private getDefaultNotifyUrl(): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/v1/payments/wechat/notify`;
  }

  /**
   * 获取默认退款通知地址
   */
  private getDefaultRefundNotifyUrl(): string {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/api/v1/payments/wechat/refund/notify`;
  }

  /**
   * 验证配置的完整性
   */
  validateConfig(config: WechatPayConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.appId) {
      errors.push('微信AppID不能为空');
    } else if (!/^wx[a-f0-9]{16}$/.test(config.appId)) {
      errors.push('微信AppID格式不正确');
    }

    if (!config.mchId) {
      errors.push('商户号不能为空');
    } else if (!/^\d{10}$/.test(config.mchId)) {
      errors.push('商户号格式不正确（应为10位数字）');
    }

    if (!config.apiV3Key) {
      errors.push('API v3密钥不能为空');
    } else if (config.apiV3Key.length !== 32) {
      errors.push('API v3密钥长度不正确（应为32位）');
    }

    if (!config.notifyUrl) {
      errors.push('支付通知地址不能为空');
    } else if (!this.isValidUrl(config.notifyUrl)) {
      errors.push('支付通知地址格式不正确');
    }

    if (!config.refundNotifyUrl) {
      errors.push('退款通知地址不能为空');
    } else if (!this.isValidUrl(config.refundNotifyUrl)) {
      errors.push('退款通知地址格式不正确');
    }

    if (!config.key) {
      errors.push('商户密钥不能为空');
    }

    // API证书验证（生产环境必须）
    if (!config.sandbox) {
      if (!config.apiClientCert) {
        errors.push('API证书不能为空（生产环境）');
      }
      if (!config.apiClientKey) {
        errors.push('API私钥不能为空（生产环境）');
      }
      if (!config.apiSerialNo) {
        errors.push('API证书序列号不能为空（生产环境）');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证URL格式
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * 获取配置摘要信息（隐藏敏感信息）
   */
  getConfigSummary(): {
    configured: boolean;
    sandbox: boolean;
    appId?: string;
    mchId?: string;
    hasCert: boolean;
    hasKey: boolean;
    notifyUrl?: string;
    errors: string[];
    recommendations: string[];
  } {
    const config = this.getConfig();
    const validation = this.validateConfig(config);

    const summary = {
      configured: this.isConfigured(config),
      sandbox: config.sandbox || false,
      appId: config.appId ? this.maskSensitive(config.appId) : undefined,
      mchId: config.mchId ? this.maskSensitive(config.mchId) : undefined,
      hasCert: !!config.apiClientCert && !config.sandbox,
      hasKey: !!config.apiClientKey && !config.sandbox,
      notifyUrl: config.notifyUrl,
      errors: validation.errors,
      recommendations: this.getRecommendations(config, validation.errors)
    };

    return summary;
  }

  /**
   * 隐藏敏感信息
   */
  private maskSensitive(value: string): string {
    if (!value || value.length <= 8) {
      return value;
    }
    return value.substring(0, 4) + '***' + value.substring(value.length - 4);
  }

  /**
   * 获取配置建议
   */
  private getRecommendations(config: WechatPayConfig, errors: string[]): string[] {
    const recommendations: string[] = [];

    if (!config.appId) {
      recommendations.push('请在微信公众平台获取AppID并配置WECHAT_APP_ID环境变量');
    }

    if (!config.mchId) {
      recommendations.push('请在微信商户平台获取商户号并配置WECHAT_MCH_ID环境变量');
    }

    if (!config.apiV3Key) {
      recommendations.push('请在微信商户平台设置APIv3密钥并配置WECHAT_API_V3_KEY环境变量');
    }

    if (!config.sandbox && !config.apiClientCert) {
      recommendations.push('请在微信商户平台下载API证书并配置WECHAT_API_CLIENT_CERT环境变量');
    }

    if (!config.notifyUrl || !config.notifyUrl.includes('https')) {
      recommendations.push('请配置HTTPS的支付回调地址WECHAT_NOTIFY_URL环境变量');
    }

    if (config.sandbox) {
      recommendations.push('当前使用沙箱环境，上线前请切换到生产环境');
    }

    if (errors.length === 0 && this.isConfigured(config)) {
      recommendations.push('配置完整，可以正常使用微信支付功能');
    }

    return recommendations;
  }

  /**
   * 动态更新配置（用于运行时配置更新）
   */
  updateConfig(updates: Partial<WechatPayConfig>): void {
    logger.info('更新微信支付配置', { updates: Object.keys(updates) });

    // 注意：这里只是记录更新，实际的环境变量更新需要重启应用
    // 在生产环境中，建议使用配置管理服务来动态更新配置
  }

  /**
   * 生成微信支付配置示例
   */
  generateConfigExample(): {
    environment: Record<string, string>;
    nginx: string[];
    security: string[];
  } {
    return {
      environment: {
        '# 微信小程序配置': '',
        'WECHAT_APP_ID': 'wx1234567890abcdef',
        'WECHAT_MCH_ID': '1234567890',
        '# API v3密钥（32位）': '',
        'WECHAT_API_V3_KEY': 'your_32_character_api_v3_key_here',
        '# API证书（生产环境必需）': '',
        'WECHAT_API_CLIENT_CERT': '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----',
        'WECHAT_API_CLIENT_KEY': '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
        'WECHAT_API_SERIAL_NO': 'your_cert_serial_no',
        '# 回调地址': '',
        'WECHAT_NOTIFY_URL': 'https://yourdomain.com/api/v1/payments/wechat/notify',
        'WECHAT_REFUND_NOTIFY_URL': 'https://yourdomain.com/api/v1/payments/wechat/refund/notify',
        '# 其他配置': '',
        'WECHAT_KEY': 'your_merchant_key',
        'WECHAT_SANDBOX': 'false'
      },
      nginx: [
        '# Nginx配置示例 - 支持微信支付回调',
        'location /api/v1/payments/wechat/notify {',
        '    proxy_pass http://localhost:3000;',
        '    proxy_set_header Host $host;',
        '    proxy_set_header X-Real-IP $remote_addr;',
        '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
        '    proxy_set_header X-Forwarded-Proto $scheme;',
        '}'
      ],
      security: [
        '1. 所有回调地址必须使用HTTPS',
        '2. 定期更新API证书（建议每年更新）',
        '3. 不要在前端代码中暴露商户密钥',
        '4. 启用微信支付的安全设置（IP白名单等）',
        '5. 定期检查支付日志，发现异常交易'
      ]
    };
  }
}

// 导出单例实例
export const wechatConfigService = new WechatConfigService();