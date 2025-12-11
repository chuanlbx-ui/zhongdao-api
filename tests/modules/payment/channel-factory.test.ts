import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PaymentChannelFactory, paymentChannelFactory } from '../../../src/modules/payment/channel-factory';
import { PaymentProviderFactory } from '@/shared/payments';
import { PaymentConfigLoader } from '../../../src/config/payments';
import { logger } from '../../../src/shared/utils/logger';
import { PaymentChannel, PaymentMethod } from '../../../src/modules/payment/types';
import type { ChannelConfig, PaymentRequest, PaymentResponse } from '../../../src/modules/payment/channel-factory';

// Mock dependencies
vi.mock('@/shared/payments');
vi.mock('../../../src/config/payments');
vi.mock('../../../src/shared/utils/logger');

const mockPaymentProviderFactory = PaymentProviderFactory as any;
const mockPaymentConfigLoader = PaymentConfigLoader as any;
const mockLogger = logger as any;

describe('PaymentChannelFactory', () => {
  let factory: PaymentChannelFactory;
  let testPaymentRequest: PaymentRequest;
  let mockProvider: any;

  beforeEach(() => {
    // Get singleton instance
    factory = PaymentChannelFactory.getInstance();

    // Setup test data
    testPaymentRequest = {
      orderId: 'order-001',
      amount: 1000,
      subject: '测试订单',
      description: '测试订单描述',
      userId: 'user-001',
      clientIp: '127.0.0.1'
    };

    mockProvider = {
      createPayment: vi.fn(),
      verifyCallback: vi.fn(),
      queryPayment: vi.fn()
    };

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock returns
    mockPaymentConfigLoader.initializePaymentSystem = vi.fn();
    mockPaymentConfigLoader.getConfig = vi.fn();
    mockPaymentProviderFactory.createProvider = vi.fn().mockReturnValue(mockProvider);
    mockLogger.info = vi.fn();
    mockLogger.warn = vi.fn();
    mockLogger.error = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      // Act
      const instance1 = PaymentChannelFactory.getInstance();
      const instance2 = PaymentChannelFactory.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('导出的实例应该是单例', () => {
      // Act
      const instance = PaymentChannelFactory.getInstance();

      // Assert
      expect(paymentChannelFactory).toBe(instance);
    });
  });

  describe('渠道初始化', () => {
    it('应该成功初始化启用的渠道', async () => {
      // Arrange
      const mockConfigs = {
        [PaymentChannel.WECHAT]: {
          enabled: true,
          appId: 'wx-test',
          mchId: 'mch-test'
        },
        [PaymentChannel.ALIPAY]: {
          enabled: true,
          appId: 'alipay-test',
          merchantId: 'merchant-test'
        },
        [PaymentChannel.POINTS]: {
          enabled: true
        }
      };

      mockPaymentConfigLoader.getConfig = vi.fn((channel: PaymentChannel) => mockConfigs[channel]);

      // Act
      await factory['initializeChannels']();

      // Assert
      expect(mockPaymentConfigLoader.initializePaymentSystem).toHaveBeenCalled();
      expect(factory.isChannelAvailable(PaymentChannel.WECHAT)).toBe(true);
      expect(factory.isChannelAvailable(PaymentChannel.ALIPAY)).toBe(true);
      expect(factory.isChannelAvailable(PaymentChannel.POINTS)).toBe(true);
    });

    it('应该跳过未启用的渠道', async () => {
      // Arrange
      mockPaymentConfigLoader.getConfig = vi.fn().mockReturnValue({
        enabled: false
      });

      // Act
      await factory['initializeChannels']();

      // Assert
      expect(factory.getAvailableChannels()).toHaveLength(0);
    });

    it('应该处理初始化错误', async () => {
      // Arrange
      mockPaymentConfigLoader.initializePaymentSystem = vi.fn()
        .mockRejectedValue(new Error('Initialization failed'));

      // Act
      await factory['initializeChannels']();

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        '支付渠道初始化失败',
        expect.objectContaining({
          error: 'Initialization failed'
        })
      );
    });
  });

  describe('processPayment', () => {
    beforeEach(() => {
      // Setup mock channels
      mockPaymentConfigLoader.getConfig = vi.fn((channel: PaymentChannel) => {
        if (channel === PaymentChannel.WECHAT || channel === PaymentChannel.ALIPAY) {
          return { enabled: true };
        }
        return { enabled: false };
      });

      factory['initializeChannels']();
    });

    it('应该成功处理微信支付', async () => {
      // Arrange
      const expectedResponse: PaymentResponse = {
        success: true,
        providerOrderId: 'wx-order-001',
        prepayId: 'wx-prepay-001',
        payInfo: 'wx-pay-info'
      };

      mockProvider.createPayment = vi.fn().mockResolvedValue(expectedResponse);

      // Act
      const result = await factory.processPayment(
        PaymentChannel.WECHAT,
        testPaymentRequest
      );

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockProvider.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          ...testPaymentRequest,
          notifyUrl: expect.stringContaining('/api/v1/payments/wechat/notify')
        })
      );
    });

    it('应该成功处理支付宝支付', async () => {
      // Arrange
      const expectedResponse: PaymentResponse = {
        success: true,
        providerOrderId: 'alipay-order-001',
        qrCode: 'alipay-qr-code'
      };

      mockProvider.createPayment = vi.fn().mockResolvedValue(expectedResponse);

      // Act
      const result = await factory.processPayment(
        PaymentChannel.ALIPAY,
        testPaymentRequest
      );

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(mockProvider.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          ...testPaymentRequest,
          notifyUrl: expect.stringContaining('/api/v1/payments/alipay/notify')
        })
      );
    });

    it('应该处理通券支付', async () => {
      // Act
      const result = await factory.processPayment(
        PaymentChannel.POINTS,
        testPaymentRequest
      );

      // Assert
      expect(result).toEqual({
        success: true,
        message: '通券支付处理'
      });
    });

    it('应该拒绝不可用的支付渠道', async () => {
      // Act
      const result = await factory.processPayment(
        PaymentChannel.UNIONPAY, // Unsupported channel
        testPaymentRequest
      );

      // Assert
      expect(result).toEqual({
        success: false,
        message: '支付渠道不可用'
      });
    });

    it('应该处理支付请求错误', async () => {
      // Arrange
      const error = new Error('Payment failed');
      mockProvider.createPayment = vi.fn().mockRejectedValue(error);

      // Act
      const result = await factory.processPayment(
        PaymentChannel.WECHAT,
        testPaymentRequest
      );

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Payment failed'
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        '处理支付请求失败',
        expect.objectContaining({
          channel: PaymentChannel.WECHAT,
          error: 'Payment failed'
        })
      );
    });

    it('应该使用自定义通知URL如果提供', async () => {
      // Arrange
      const customNotifyUrl = 'https://custom.example.com/notify';
      const requestWithCustomUrl = {
        ...testPaymentRequest,
        notifyUrl: customNotifyUrl
      };

      mockProvider.createPayment = vi.fn().mockResolvedValue({ success: true });

      // Act
      await factory.processPayment(PaymentChannel.WECHAT, requestWithCustomUrl);

      // Assert
      expect(mockProvider.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          notifyUrl: customNotifyUrl
        })
      );
    });
  });

  describe('渠道配置管理', () => {
    beforeEach(async () => {
      mockPaymentConfigLoader.getConfig = vi.fn((channel: PaymentChannel) => {
        if (channel === PaymentChannel.WECHAT) {
          return {
            enabled: true,
            appId: 'wx-test',
            mchId: 'mch-test'
          };
        }
        return { enabled: false };
      });

      await factory['initializeChannels']();
    });

    it('应该正确映射渠道到支付方式', () => {
      // Act & Assert
      expect(factory['mapChannelToMethod'](PaymentChannel.WECHAT)).toBe(PaymentMethod.WECHAT_PAY);
      expect(factory['mapChannelToMethod'](PaymentChannel.ALIPAY)).toBe(PaymentMethod.ALIPAY);
      expect(factory['mapChannelToMethod'](PaymentChannel.POINTS)).toBe(PaymentMethod.POINTS);
      expect(factory['mapChannelToMethod'](PaymentChannel.UNIONPAY as any)).toBe(PaymentMethod.BALANCE);
    });

    it('应该获取渠道配置', () => {
      // Act
      const config = factory.getChannelConfig(PaymentChannel.WECHAT);

      // Assert
      expect(config).toEqual({
        channel: PaymentChannel.WECHAT,
        method: PaymentMethod.WECHAT_PAY,
        enabled: true,
        config: {
          enabled: true,
          appId: 'wx-test',
          mchId: 'mch-test'
        }
      });
    });

    it('应该对不存在的渠道返回null配置', () => {
      // Act
      const config = factory.getChannelConfig(PaymentChannel.UNIONPAY);

      // Assert
      expect(config).toBeNull();
    });

    it('应该检查渠道可用性', () => {
      // Act & Assert
      expect(factory.isChannelAvailable(PaymentChannel.WECHAT)).toBe(true);
      expect(factory.isChannelAvailable(PaymentChannel.ALIPAY)).toBe(false);
    });

    it('应该获取所有可用渠道', () => {
      // Act
      const channels = factory.getAvailableChannels();

      // Assert
      expect(channels).toEqual([PaymentChannel.WECHAT]);
    });

    it('应该动态启用/禁用渠道', async () => {
      // Act - Disable channel
      const disableResult = await factory.toggleChannel(PaymentChannel.WECHAT, false);

      // Assert
      expect(disableResult).toBe(true);
      expect(factory.isChannelAvailable(PaymentChannel.WECHAT)).toBe(false);

      // Act - Re-enable channel
      const enableResult = await factory.toggleChannel(PaymentChannel.WECHAT, true);

      // Assert
      expect(enableResult).toBe(true);
      expect(factory.isChannelAvailable(PaymentChannel.WECHAT)).toBe(true);
    });

    it('应该处理不存在渠道的状态切换', async () => {
      // Act
      const result = await factory.toggleChannel(PaymentChannel.UNIONPAY, true);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '尝试配置不存在的支付渠道',
        { channel: PaymentChannel.UNIONPAY }
      );
    });

    it('应该重新加载配置', async () => {
      // Arrange
      const initialChannels = factory.getAvailableChannels();

      // Mock different config for reload
      mockPaymentConfigLoader.getConfig = vi.fn((channel: PaymentChannel) => {
        if (channel === PaymentChannel.ALIPAY) {
          return { enabled: true };
        }
        return { enabled: false };
      });

      // Act
      await factory.reloadConfig();

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('重新加载支付渠道配置');
      expect(factory.getAvailableChannels()).not.toEqual(initialChannels);
    });
  });

  describe('错误处理', () => {
    it('应该处理渠道配置加载失败', async () => {
      // Arrange
      const error = new Error('Config load failed');
      mockPaymentConfigLoader.getConfig = vi.fn().mockRejectedValue(error);

      // Act
      const config = await factory['loadChannelConfig'](PaymentChannel.WECHAT);

      // Assert
      expect(config).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '加载支付渠道配置失败',
        expect.objectContaining({
          channel: PaymentChannel.WECHAT,
          error: 'Config load failed'
        })
      );
    });

    it('应该处理Provider创建失败', async () => {
      // Arrange
      const error = new Error('Provider creation failed');
      mockPaymentProviderFactory.createProvider = vi.fn().mockRejectedValue(error);

      // Act
      const provider = factory['createProvider'](PaymentChannel.WECHAT);

      // Assert
      expect(provider).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        '创建支付提供者失败',
        expect.objectContaining({
          channel: PaymentChannel.WECHAT,
          error: 'Provider creation failed'
        })
      );
    });

    it('应该处理渠道切换错误', async () => {
      // Arrange - Create channel config first
      mockPaymentConfigLoader.getConfig = vi.fn().mockReturnValue({ enabled: true });
      await factory['initializeChannels']();

      // Mock error by making Map.set throw
      const originalSet = Map.prototype.set;
      Map.prototype.set = vi.fn().mockImplementation(function() {
        throw new Error('Map set failed');
      });

      // Act
      const result = await factory.toggleChannel(PaymentChannel.WECHAT, false);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '更新支付渠道状态失败',
        expect.objectContaining({
          channel: PaymentChannel.WECHAT,
          enabled: false
        })
      );

      // Restore
      Map.prototype.set = originalSet;
    });
  });

  describe('通知URL生成', () => {
    it('应该生成正确的微信支付通知URL', () => {
      // Arrange
      process.env.API_BASE_URL = 'https://test.api.com';

      // Act
      const notifyUrl = factory['getNotifyUrl'](PaymentChannel.WECHAT);

      // Assert
      expect(notifyUrl).toBe('https://test.api.com/api/v1/payments/wechat/notify');
    });

    it('应该生成正确的支付宝通知URL', () => {
      // Arrange
      process.env.API_BASE_URL = 'https://test.api.com';

      // Act
      const notifyUrl = factory['getNotifyUrl'](PaymentChannel.ALIPAY);

      // Assert
      expect(notifyUrl).toBe('https://test.api.com/api/v1/payments/alipay/notify');
    });

    it('应该使用默认URL如果环境变量未设置', () => {
      // Arrange
      delete process.env.API_BASE_URL;

      // Act
      const notifyUrl = factory['getNotifyUrl'](PaymentChannel.WECHAT);

      // Assert
      expect(notifyUrl).toBe('https://api.zhongdao-mall.com/api/v1/payments/wechat/notify');
    });

    it('应该对不支持的渠道返回空字符串', () => {
      // Act
      const notifyUrl = factory['getNotifyUrl'](PaymentChannel.UNIONPAY);

      // Assert
      expect(notifyUrl).toBe('');
    });
  });
});