import { PaymentProvider, ProviderType } from './base/provider';
import { WechatPayProvider } from './wechat/provider';
import { WechatPayConfig } from './wechat/config';
import { AlipayPayProvider } from './alipay/provider';
import { AlipayConfig } from './alipay/config';

/**
 * 支付提供商工厂
 */
export class PaymentProviderFactory {
  private static configs: Map<ProviderType, any> = new Map();

  /**
   * 设置支付配置
   */
  static setConfig(type: ProviderType, config: any): void {
    this.configs.set(type, config);
  }

  /**
   * 创建支付提供商实例
   */
  static createProvider(type: ProviderType): PaymentProvider {
    const config = this.configs.get(type);
    if (!config) {
      throw new Error(`支付提供商 ${type} 的配置未设置`);
    }

    switch (type) {
      case ProviderType.WECHAT:
        return new WechatPayProvider(config as WechatPayConfig);

      case ProviderType.ALIPAY:
        return new AlipayPayProvider(config as AlipayConfig);

      case ProviderType.POINTS:
        // TODO: 实现积分支付提供商
        throw new Error('积分支付提供商尚未实现');

      default:
        throw new Error(`不支持的支付提供商类型: ${type}`);
    }
  }

  /**
   * 批量初始化支付提供商
   */
  static initializeProviders(configs: Record<ProviderType, any>): PaymentProvider[] {
    const providers: PaymentProvider[] = [];

    for (const [type, config] of Object.entries(configs)) {
      try {
        this.setConfig(type as ProviderType, config);
        const provider = this.createProvider(type as ProviderType);
        providers.push(provider);
      } catch (error) {
        console.error(`初始化支付提供商失败 - ${type}:`, error);
      }
    }

    return providers;
  }
}