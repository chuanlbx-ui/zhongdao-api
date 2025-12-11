/**
 * 支付渠道工厂
 * 负责创建和管理支付渠道实例
 */

import { logger } from '../../../shared/utils/logger';
import { PaymentProviderFactory, ProviderType, PaymentProvider } from '@/shared/payments';
import { PaymentConfigLoader } from '../../../config/payments';
import { PaymentChannel, PaymentMethod } from './types';

export interface ChannelConfig {
  channel: PaymentChannel;
  method: PaymentMethod;
  enabled: boolean;
  config: any;
}

export interface PaymentRequest {
  orderId: string;
  amount: number;
  subject: string;
  description?: string;
  notifyUrl?: string;
  returnUrl?: string;
  clientIp?: string;
  userId: string;
  extra?: any;
}

export interface PaymentResponse {
  success: boolean;
  providerOrderId?: string;
  prepayId?: string;
  payInfo?: string;
  qrCode?: string;
  redirectUrl?: string;
  message?: string;
}

/**
 * 支付渠道工厂类
 */
export class PaymentChannelFactory {
  private static instance: PaymentChannelFactory;
  private channelConfigs: Map<PaymentChannel, ChannelConfig> = new Map();
  private providers: Map<PaymentChannel, PaymentProvider> = new Map();

  private constructor() {
    this.initializeChannels();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PaymentChannelFactory {
    if (!PaymentChannelFactory.instance) {
      PaymentChannelFactory.instance = new PaymentChannelFactory();
    }
    return PaymentChannelFactory.instance;
  }

  /**
   * 初始化支付渠道
   */
  private async initializeChannels(): Promise<void> {
    try {
      PaymentConfigLoader.initializePaymentSystem();

      // 初始化支持的渠道
      const supportedChannels = [
        PaymentChannel.WECHAT,
        PaymentChannel.ALIPAY,
        PaymentChannel.POINTS
      ];

      for (const channel of supportedChannels) {
        const config = await this.loadChannelConfig(channel);
        if (config?.enabled) {
          this.channelConfigs.set(channel, config);
          this.providers.set(channel, this.createProvider(channel));
        }
      }

      logger.info('支付渠道初始化完成', {
        channels: Array.from(this.channelConfigs.keys())
      });

    } catch (error) {
      logger.error('支付渠道初始化失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 加载渠道配置
   */
  private async loadChannelConfig(channel: PaymentChannel): Promise<ChannelConfig | null> {
    try {
      const baseConfig = PaymentConfigLoader.getConfig(channel);

      if (!baseConfig) {
        logger.warn('未找到支付渠道配置', { channel });
        return null;
      }

      return {
        channel,
        method: this.mapChannelToMethod(channel),
        enabled: baseConfig.enabled || false,
        config: baseConfig
      };

    } catch (error) {
      logger.error('加载支付渠道配置失败', {
        channel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }

  /**
   * 映射渠道到支付方式
   */
  private mapChannelToMethod(channel: PaymentChannel): PaymentMethod {
    switch (channel) {
      case PaymentChannel.WECHAT:
        return PaymentMethod.WECHAT_PAY;
      case PaymentChannel.ALIPAY:
        return PaymentMethod.ALIPAY;
      case PaymentChannel.POINTS:
        return PaymentMethod.POINTS;
      default:
        return PaymentMethod.BALANCE;
    }
  }

  /**
   * 创建支付提供者实例
   */
  private createProvider(channel: PaymentChannel): PaymentProvider | null {
    try {
      if (channel === PaymentChannel.POINTS) {
        // 通券支付不需要外部provider
        return null;
      }

      return PaymentProviderFactory.createProvider(channel as ProviderType);

    } catch (error) {
      logger.error('创建支付提供者失败', {
        channel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }

  /**
   * 处理支付请求
   */
  public async processPayment(
    channel: PaymentChannel,
    paymentRequest: PaymentRequest
  ): Promise<PaymentResponse> {
    try {
      const provider = this.providers.get(channel);

      if (!provider && channel !== PaymentChannel.POINTS) {
        return {
          success: false,
          message: '支付渠道不可用'
        };
      }

      // 设置通知URL
      const notifyUrl = this.getNotifyUrl(channel);
      const request = {
        ...paymentRequest,
        notifyUrl: notifyUrl || paymentRequest.notifyUrl
      };

      if (channel === PaymentChannel.POINTS) {
        // 通券支付处理逻辑由PaymentService处理
        return {
          success: true,
          message: '通券支付处理'
        };
      }

      // 调用第三方支付渠道
      const response = await provider!.createPayment(request);

      return {
        success: response.success,
        providerOrderId: response.providerOrderId,
        prepayId: response.prepayId,
        payInfo: response.payInfo,
        qrCode: response.qrCode,
        redirectUrl: response.redirectUrl,
        message: response.message
      };

    } catch (error) {
      logger.error('处理支付请求失败', {
        channel,
        paymentRequest,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : '支付处理失败'
      };
    }
  }

  /**
   * 获取通知URL
   */
  private getNotifyUrl(channel: PaymentChannel): string {
    const baseUrl = process.env.API_BASE_URL || 'https://api.zhongdao-mall.com';

    switch (channel) {
      case PaymentChannel.WECHAT:
        return `${baseUrl}/api/v1/payments/wechat/notify`;
      case PaymentChannel.ALIPAY:
        return `${baseUrl}/api/v1/payments/alipay/notify`;
      default:
        return '';
    }
  }

  /**
   * 获取支付渠道配置
   */
  public getChannelConfig(channel: PaymentChannel): ChannelConfig | null {
    return this.channelConfigs.get(channel) || null;
  }

  /**
   * 检查渠道是否可用
   */
  public isChannelAvailable(channel: PaymentChannel): boolean {
    const config = this.channelConfigs.get(channel);
    return config?.enabled || false;
  }

  /**
   * 获取所有可用的支付渠道
   */
  public getAvailableChannels(): PaymentChannel[] {
    return Array.from(this.channelConfigs.entries())
      .filter(([_, config]) => config.enabled)
      .map(([channel]) => channel);
  }

  /**
   * 动态启用/禁用支付渠道
   */
  public async toggleChannel(channel: PaymentChannel, enabled: boolean): Promise<boolean> {
    try {
      const config = this.channelConfigs.get(channel);
      if (!config) {
        logger.warn('尝试配置不存在的支付渠道', { channel });
        return false;
      }

      config.enabled = enabled;
      this.channelConfigs.set(channel, config);

      logger.info('支付渠道状态已更新', {
        channel,
        enabled
      });

      return true;

    } catch (error) {
      logger.error('更新支付渠道状态失败', {
        channel,
        enabled,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 重新加载配置
   */
  public async reloadConfig(): Promise<void> {
    logger.info('重新加载支付渠道配置');
    this.channelConfigs.clear();
    this.providers.clear();
    await this.initializeChannels();
  }
}

// 导出单例实例
export const paymentChannelFactory = PaymentChannelFactory.getInstance();