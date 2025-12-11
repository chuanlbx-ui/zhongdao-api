/**
 * 支付渠道安全配置管理器
 * 管理微信支付和支付宝的安全配置
 */

import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import crypto from 'crypto';

/**
 * 微信支付安全配置
 */
interface WeChatPaySecurityConfig {
  // API密钥配置
  apiV3Key: string;
  apiClientCert: string;
  apiClientKey: string;
  apiSerialNo: string;
  platformPublicKey?: string;

  // 商户信息
  appId: string;
  mchId: string;

  // 回调配置
  notifyUrl: string;
  refundNotifyUrl: string;

  // 安全配置
  allowSandbox: boolean;
  maxCallbackDelay: number; // 回调最大延迟（秒）
  amountThreshold: number; // 金额阈值（元以上需要额外验证）

  // IP白名单（可选，用于额外验证）
  allowedNotifyIps?: string[];
}

/**
 * 支付宝安全配置
 */
interface AlipaySecurityConfig {
  // 密钥配置
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  signType: 'RSA' | 'RSA2';

  // 网关配置
  gatewayUrl: string;
  isSandbox: boolean;

  // 回调配置
  notifyUrl: string;
  returnUrl?: string;
  refundNotifyUrl?: string;

  // 安全配置
  maxCallbackDelay: number;
  amountThreshold: number;
  allowedNotifyIps?: string[];

  // 证书配置（如果使用证书）
  appCertPublicKey?: string;
  alipayCertPublicKey?: string;
  alipayRootCert?: string;
}

/**
 * 支付渠道安全配置管理器
 */
export class PaymentSecurityConfigManager {
  private wechatConfigCache?: WeChatPaySecurityConfig;
  private alipayConfigCache?: AlipaySecurityConfig;
  private lastCacheUpdate = 0;
  private readonly cacheExpiry = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 获取微信支付安全配置
   */
  async getWeChatPayConfig(): Promise<WeChatPaySecurityConfig> {
    const now = Date.now();

    // 检查缓存
    if (this.wechatConfigCache && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return this.wechatConfigCache;
    }

    try {
      // 从环境变量加载
      const config: WeChatPaySecurityConfig = {
        apiV3Key: process.env.WECHAT_API_V3_KEY || '',
        apiClientCert: process.env.WECHAT_API_CLIENT_CERT || '',
        apiClientKey: process.env.WECHAT_API_CLIENT_KEY || '',
        apiSerialNo: process.env.WECHAT_API_SERIAL_NO || '',
        platformPublicKey: process.env.WECHAT_PLATFORM_PUBLIC_KEY,
        appId: process.env.WECHAT_APP_ID || '',
        mchId: process.env.WECHAT_MCH_ID || '',
        notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
        refundNotifyUrl: process.env.WECHAT_REFUND_NOTIFY_URL || '',
        allowSandbox: process.env.WECHAT_SANDBOX === 'true',
        maxCallbackDelay: parseInt(process.env.WECHAT_MAX_CALLBACK_DELAY || '300'),
        amountThreshold: parseInt(process.env.WECHAT_AMOUNT_THRESHOLD || '1000'),
        allowedNotifyIps: process.env.WECHAT_ALLOWED_IPS?.split(',').map(ip => ip.trim())
      };

      // 验证必要配置
      this.validateWeChatPayConfig(config);

      // 缓存配置
      this.wechatConfigCache = config;
      this.lastCacheUpdate = now;

      logger.info('微信支付安全配置加载成功');

      return config;

    } catch (error) {
      logger.error('加载微信支付安全配置失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw new Error('微信支付安全配置加载失败');
    }
  }

  /**
   * 获取支付宝安全配置
   */
  async getAlipayConfig(): Promise<AlipaySecurityConfig> {
    const now = Date.now();

    // 检查缓存
    if (this.alipayConfigCache && (now - this.lastCacheUpdate) < this.cacheExpiry) {
      return this.alipayConfigCache;
    }

    try {
      // 从环境变量加载
      const config: AlipaySecurityConfig = {
        appId: process.env.ALIPAY_APP_ID || '',
        privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
        alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
        signType: (process.env.ALIPAY_SIGN_TYPE || 'RSA2') as 'RSA' | 'RSA2',
        gatewayUrl: process.env.ALIPAY_GATEWAY_URL || 'https://openapi.alipay.com/gateway.do',
        isSandbox: process.env.ALIPAY_SANDBOX === 'true',
        notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
        returnUrl: process.env.ALIPAY_RETURN_URL,
        refundNotifyUrl: process.env.ALIPAY_REFUND_NOTIFY_URL,
        maxCallbackDelay: parseInt(process.env.ALIPAY_MAX_CALLBACK_DELAY || '300'),
        amountThreshold: parseInt(process.env.ALIPAY_AMOUNT_THRESHOLD || '1000'),
        allowedNotifyIps: process.env.ALIPAY_ALLOWED_IPS?.split(',').map(ip => ip.trim()),
        appCertPublicKey: process.env.ALIPAY_APP_CERT_PUBLIC_KEY,
        alipayCertPublicKey: process.env.ALIPAY_CERT_PUBLIC_KEY,
        alipayRootCert: process.env.ALIPAY_ROOT_CERT
      };

      // 验证必要配置
      this.validateAlipayConfig(config);

      // 缓存配置
      this.alipayConfigCache = config;
      this.lastCacheUpdate = now;

      logger.info('支付宝安全配置加载成功');

      return config;

    } catch (error) {
      logger.error('加载支付宝安全配置失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw new Error('支付宝安全配置加载失败');
    }
  }

  /**
   * 验证微信支付配置
   */
  private validateWeChatPayConfig(config: WeChatPaySecurityConfig): void {
    const required = [
      'apiV3Key',
      'appId',
      'mchId',
      'notifyUrl'
    ];

    const missing = required.filter(key => !config[key as keyof WeChatPaySecurityConfig]);

    if (missing.length > 0) {
      throw new Error(`微信支付配置缺少必要字段: ${missing.join(', ')}`);
    }

    // 验证密钥长度
    if (config.apiV3Key.length !== 32) {
      throw new Error('微信支付API v3密钥长度必须为32位');
    }

    // 验证回调URL
    if (!config.notifyUrl.startsWith('https://')) {
      logger.warn('微信支付回调URL建议使用HTTPS');
    }

    // 验证商户号格式
    if (!/^\d{10}$/.test(config.mchId)) {
      throw new Error('微信商户号格式不正确');
    }

    // 验证AppID格式
    if (!/^wx[a-z0-9]{16}$/.test(config.appId)) {
      throw new Error('微信AppID格式不正确');
    }
  }

  /**
   * 验证支付宝配置
   */
  private validateAlipayConfig(config: AlipaySecurityConfig): void {
    const required = [
      'appId',
      'privateKey',
      'alipayPublicKey',
      'notifyUrl'
    ];

    const missing = required.filter(key => !config[key as keyof AlipaySecurityConfig]);

    if (missing.length > 0) {
      throw new Error(`支付宝配置缺少必要字段: ${missing.join(', ')}`);
    }

    // 验证密钥格式
    if (!config.privateKey.includes('-----BEGIN')) {
      throw new Error('支付宝私钥格式不正确');
    }

    if (!config.alipayPublicKey.includes('-----BEGIN')) {
      throw new Error('支付宝公钥格式不正确');
    }

    // 验证AppID格式
    if (!/^\d{16}$/.test(config.appId)) {
      throw new Error('支付宝AppID格式不正确');
    }

    // 验证网关URL
    if (!config.gatewayUrl.startsWith('https://')) {
      logger.warn('支付宝网关URL建议使用HTTPS');
    }
  }

  /**
   * 生成支付安全令牌
   */
  generateSecurityToken(orderId: string, amount: number): string {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const data = `${orderId}:${amount}:${timestamp}:${nonce}`;

    return crypto
      .createHmac('sha256', process.env.PAYMENT_SECURITY_SECRET || 'default-secret')
      .update(data)
      .digest('hex');
  }

  /**
   * 验证支付安全令牌
   */
  verifySecurityToken(
    orderId: string,
    amount: number,
    token: string,
    maxAge: number = 300 // 5分钟有效期
  ): boolean {
    try {
      // 解析令牌（这里简化处理，实际应该包含时间戳等信息）
      // TODO: 实现更完善的令牌验证机制

      return true;
    } catch (error) {
      logger.error('验证安全令牌失败', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 更新配置缓存
   */
  async refreshCache(): Promise<void> {
    this.lastCacheUpdate = 0;
    await this.getWeChatPayConfig();
    await this.getAlipayConfig();
  }

  /**
   * 获取配置摘要（用于日志）
   */
  async getConfigSummary(): Promise<any> {
    const wechatConfig = await this.getWeChatPayConfig();
    const alipayConfig = await this.getAlipayConfig();

    return {
      wechat: {
        appId: wechatConfig.appId,
        mchId: wechatConfig.mchId,
        hasApiV3Key: !!wechatConfig.apiV3Key,
        hasCert: !!wechatConfig.apiClientCert,
        sandbox: wechatConfig.allowSandbox,
        amountThreshold: wechatConfig.amountThreshold
      },
      alipay: {
        appId: alipayConfig.appId,
        signType: alipayConfig.signType,
        hasPrivateKey: !!alipayConfig.privateKey,
        hasPublicKey: !!alipayConfig.alipayPublicKey,
        sandbox: alipayConfig.isSandbox,
        amountThreshold: alipayConfig.amountThreshold
      }
    };
  }

  /**
   * 保存配置到数据库（持久化配置）
   */
  async saveConfigToDatabase(provider: 'WECHAT' | 'ALIPAY', config: any): Promise<void> {
    try {
      await prisma.systemConfig.upsert({
        where: { key: `payment_security_${provider.toLowerCase()}` },
        update: {
          value: JSON.stringify(config),
          updatedAt: new Date()
        },
        create: {
          key: `payment_security_${provider.toLowerCase()}`,
          value: JSON.stringify(config),
          description: `${provider}支付安全配置`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info(`${provider}支付安全配置已保存到数据库`);

      // 清除缓存
      this.lastCacheUpdate = 0;

    } catch (error) {
      logger.error('保存支付安全配置失败', {
        provider,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 从数据库加载配置
   */
  async loadConfigFromDatabase(provider: 'WECHAT' | 'ALIPAY'): Promise<any | null> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key: `payment_security_${provider.toLowerCase()}` }
      });

      if (config) {
        return JSON.parse(config.value);
      }

      return null;
    } catch (error) {
      logger.error('从数据库加载支付安全配置失败', {
        provider,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }
}

// 创建全局实例
export const paymentSecurityConfigManager = new PaymentSecurityConfigManager();

// 定期刷新缓存
setInterval(async () => {
  try {
    await paymentSecurityConfigManager.refreshCache();
  } catch (error) {
    logger.error('定期刷新支付安全配置失败', {
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
}, 10 * 60 * 1000); // 每10分钟刷新一次