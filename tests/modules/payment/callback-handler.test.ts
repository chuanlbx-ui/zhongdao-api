import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PaymentCallbackHandler, paymentCallbackHandler } from '../../../src/modules/payment/callback-handler';
import { PaymentProviderFactory } from '@/shared/payments';
import { prisma } from '../../../src/shared/database/client';
import { logger } from '../../../src/shared/utils/logger';
import { PaymentChannel, PaymentStatus } from '../../../src/modules/payment/types';
import type { CallbackRequest, CallbackResponse } from '../../../src/modules/payment/callback-handler';

// Mock dependencies
vi.mock('@/shared/payments');
vi.mock('../../../src/shared/database/client');
vi.mock('../../../src/shared/utils/logger');

const mockPaymentProviderFactory = PaymentProviderFactory as any;
const mockPrisma = prisma as any;
const mockLogger = logger as any;

describe('PaymentCallbackHandler', () => {
  let handler: PaymentCallbackHandler;
  let testCallbackRequest: CallbackRequest;
  let mockProvider: any;
  let mockPaymentRecord: any;

  beforeEach(() => {
    // Get singleton instance
    handler = PaymentCallbackHandler.getInstance();

    // Setup test data
    testCallbackRequest = {
      channel: PaymentChannel.WECHAT,
      data: {
        transaction_id: 'wx-transaction-001',
        out_trade_no: 'order-001',
        result_code: 'SUCCESS',
        total_fee: '1000'
      },
      headers: {
        'x-wechat-signature': 'test-signature'
      },
      ip: '127.0.0.1'
    };

    mockProvider = {
      verifyNotify: vi.fn(),
      createPayment: vi.fn(),
      queryPayment: vi.fn()
    };

    mockPaymentRecord = {
      id: 'payment-001',
      paymentNo: 'PAY-202401001',
      orderId: 'order-001',
      userId: 'user-001',
      channelOrderId: 'order-001',
      paymentChannel: PaymentChannel.WECHAT,
      status: PaymentStatus.UNPAID,
      amount: 1000,
      createdAt: new Date()
    };

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock returns
    mockPaymentProviderFactory.createProvider = vi.fn().mockReturnValue(mockProvider);
    mockProvider.verifyNotify = vi.fn().mockResolvedValue({
      orderId: 'order-001',
      transactionId: 'wx-transaction-001',
      tradeStatus: 'SUCCESS'
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      // Act
      const instance1 = PaymentCallbackHandler.getInstance();
      const instance2 = PaymentCallbackHandler.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('导出的实例应该是单例', () => {
      // Act
      const instance = PaymentCallbackHandler.getInstance();

      // Assert
      expect(paymentCallbackHandler).toBe(instance);
    });
  });

  describe('handleCallback', () => {
    it('应该成功处理支付成功回调', async () => {
      // Arrange
      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentRecords.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.orders.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLocks.updateMany = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await handler.handleCallback(testCallbackRequest);

      // Assert
      expect(result).toEqual({
        success: true,
        paymentId: 'payment-001',
        status: PaymentStatus.PAID,
        message: '回调处理成功'
      });

      expect(mockPrisma.paymentRecords.update).toHaveBeenCalledWith({
        where: { id: 'payment-001' },
        data: {
          status: PaymentStatus.PAID,
          channelTransactionId: 'wx-transaction-001',
          notifyData: JSON.stringify(testCallbackRequest.data),
          notifiedAt: expect.any(Date)
        }
      });

      expect(mockPrisma.orders.update).toHaveBeenCalledWith({
        where: { id: 'order-001' },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: expect.any(Date)
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '回调处理成功',
        expect.objectContaining({
          paymentId: 'payment-001',
          status: PaymentStatus.PAID
        })
      );
    });

    it('应该拒绝无效的回调数据', async () => {
      // Arrange
      mockProvider.verifyNotify = vi.fn()
        .mockResolvedValue(null); // Invalid verification

      // Act
      const result = await handler.handleCallback(testCallbackRequest);

      // Assert
      expect(result).toEqual({
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        message: '回调数据验证失败'
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        '回调验证失败',
        expect.objectContaining({
          channel: PaymentChannel.WECHAT,
          error: '回调数据验证失败'
        })
      );
    });

    it('应该拒绝未找到的支付记录', async () => {
      // Arrange
      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(null); // Payment not found

      // Act
      const result = await handler.handleCallback(testCallbackRequest);

      // Assert
      expect(result).toEqual({
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        message: '支付记录未找到'
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '支付记录未找到',
        expect.objectContaining({
          channel: PaymentChannel.WECHAT,
          channelOrderId: 'order-001'
        })
      );
    });

    it('应该处理重复回调', async () => {
      // Arrange
      const paidPaymentRecord = {
        ...mockPaymentRecord,
        status: PaymentStatus.PAID
      };

      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(paidPaymentRecord);

      // Act
      const result = await handler.handleCallback(testCallbackRequest);

      // Assert
      expect(result).toEqual({
        success: true,
        paymentId: 'payment-001',
        status: PaymentStatus.PAID,
        message: '支付已完成'
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '支付已完成，重复回调',
        expect.objectContaining({
          paymentId: 'payment-001'
        })
      );
    });

    it('应该防止并发处理相同的回调', async () => {
      // Arrange
      const verificationData = {
        orderId: 'order-001',
        transactionId: 'wx-transaction-001',
        tradeStatus: 'SUCCESS'
      };

      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentRecords.update = vi.fn()
        .mockImplementation(async () => {
          // Simulate slow processing
          await new Promise(resolve => setTimeout(resolve, 100));
          return {};
        });

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.orders.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLocks.updateMany = vi.fn()
        .mockResolvedValue({});

      // Act - Process same callback concurrently
      const [result1, result2] = await Promise.all([
        handler.handleCallback(testCallbackRequest),
        handler.handleCallback(testCallbackRequest)
      ]);

      // Assert
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result2.status).toBe(PaymentStatus.UNPAID); // Second one should be marked as processing

      // Should only update payment once
      expect(mockPrisma.paymentRecords.update).toHaveBeenCalledTimes(1);
    });

    it('应该正确映射不同的渠道状态', async () => {
      const statusTests = [
        { channelStatus: 'SUCCESS', expectedStatus: PaymentStatus.PAID },
        { channelStatus: 'PAID', expectedStatus: PaymentStatus.PAID },
        { channelStatus: 'FAILED', expectedStatus: PaymentStatus.FAILED },
        { channelStatus: 'CANCELLED', expectedStatus: PaymentStatus.FAILED },
        { channelStatus: 'USERPAYING', expectedStatus: PaymentStatus.PAYING },
        { channelStatus: 'UNKNOWN', expectedStatus: PaymentStatus.UNPAID }
      ];

      for (const test of statusTests) {
        // Arrange
        mockProvider.verifyNotify = vi.fn()
          .mockResolvedValue({
            orderId: 'order-001',
            transactionId: 'wx-transaction-001',
            tradeStatus: test.channelStatus
          });

        mockPrisma.paymentRecords.findFirst = vi.fn()
          .mockResolvedValue(mockPaymentRecord);

        mockPrisma.paymentRecords.update = vi.fn()
          .mockResolvedValue({});

        mockPrisma.paymentLogs.create = vi.fn()
          .mockResolvedValue({});

        // Act
        const result = await handler.handleCallback(testCallbackRequest);

        // Assert
        expect(result.status).toBe(test.expectedStatus);
      }
    });

    it('应该处理支付失败的回调', async () => {
      // Arrange
      mockProvider.verifyNotify = vi.fn()
        .mockResolvedValue({
          orderId: 'order-001',
          transactionId: 'wx-transaction-001',
          tradeStatus: 'FAILED'
        });

      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentRecords.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await handler.handleCallback(testCallbackRequest);

      // Assert
      expect(result).toEqual({
        success: true,
        paymentId: 'payment-001',
        status: PaymentStatus.FAILED,
        message: '回调处理成功'
      });

      // Should not process success business logic
      expect(mockPrisma.orders.update).not.toHaveBeenCalled();
      expect(mockPrisma.paymentLocks.updateMany).not.toHaveBeenCalled();
    });

    it('应该处理验证错误', async () => {
      // Arrange
      const error = new Error('Verification failed');
      mockProvider.verifyNotify = vi.fn()
        .mockRejectedValue(error);

      // Act
      const result = await handler.handleCallback(testCallbackRequest);

      // Assert
      expect(result).toEqual({
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        message: '回调数据验证失败: Verification failed',
        shouldRetry: false
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        '处理支付回调失败',
        expect.objectContaining({
          error: 'Verification failed'
        })
      );
    });

    it('应该处理可重试的错误', async () => {
      // Arrange
      const retryableError = new Error('Connection timeout');
      retryableError.code = 'ETIMEDOUT';

      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentRecords.update = vi.fn()
        .mockRejectedValue(retryableError);

      mockPrisma.callbackRetryQueue.create = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await handler.handleCallback(testCallbackRequest);

      // Assert
      expect(result).toEqual({
        success: false,
        paymentId: 'payment-001',
        status: PaymentStatus.FAILED,
        message: '处理支付回调失败: Connection timeout',
        shouldRetry: true
      });

      expect(mockPrisma.callbackRetryQueue.create).toHaveBeenCalled();
    });
  });

  describe('IP验证', () => {
    it('应该验证回调IP', async () => {
      // Arrange
      const requestWithIp = {
        ...testCallbackRequest,
        ip: '203.69.160.58' // WeChat Pay IP
      };

      handler['getAllowedCallbackIps'] = vi.fn()
        .mockResolvedValue(['203.69.160.58', '203.69.160.59']);

      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentRecords.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await handler.handleCallback(requestWithIp);

      // Assert
      expect(result.success).toBe(true);
    });

    it('应该拒绝不在白名单的IP', async () => {
      // Arrange
      const requestWithIp = {
        ...testCallbackRequest,
        ip: '192.168.1.1' // Invalid IP
      };

      handler['getAllowedCallbackIps'] = vi.fn()
        .mockResolvedValue(['203.69.160.58']);

      // Act
      const result = await handler.handleCallback(requestWithIp);

      // Assert
      expect(result).toEqual({
        success: false,
        paymentId: '',
        status: PaymentStatus.FAILED,
        message: '回调来源IP验证失败'
      });
    });

    it('应该跳过IP验证如果没有IP信息', async () => {
      // Arrange
      const requestWithoutIp = {
        ...testCallbackRequest,
        ip: undefined
      };

      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentRecords.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await handler.handleCallback(requestWithoutIp);

      // Assert
      expect(result.success).toBe(true);
    });

    it('应该跳过IP验证如果没有配置白名单', async () => {
      // Arrange
      handler['getAllowedCallbackIps'] = vi.fn()
        .mockResolvedValue([]); // Empty whitelist

      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentRecords.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await handler.handleCallback(testCallbackRequest);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('processRetryQueue', () => {
    it('应该处理重试队列中的回调', async () => {
      // Arrange
      const retryItems = [
        {
          id: 'retry-001',
          paymentId: 'payment-001',
          requestData: JSON.stringify(testCallbackRequest),
          retryCount: 0
        }
      ];

      mockPrisma.callbackRetryQueue.findMany = vi.fn()
        .mockResolvedValue(retryItems);

      mockPrisma.paymentRecords.findFirst = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentRecords.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.callbackRetryQueue.delete = vi.fn()
        .mockResolvedValue({});

      // Act
      await handler.processRetryQueue();

      // Assert
      expect(mockPrisma.callbackRetryQueue.findMany).toHaveBeenCalledWith({
        where: {
          nextRetryAt: { lte: expect.any(Date) },
          retryCount: { lt: 3 }
        },
        take: 50
      });

      expect(mockPrisma.callbackRetryQueue.delete).toHaveBeenCalledWith({
        where: { id: 'retry-001' }
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        '开始处理回调重试队列',
        { count: 1 }
      );
    });

    it('应该更新失败的重试项', async () => {
      // Arrange
      const retryItems = [
        {
          id: 'retry-001',
          paymentId: 'payment-001',
          requestData: JSON.stringify(testCallbackRequest),
          retryCount: 0
        }
      ];

      mockPrisma.callbackRetryQueue.findMany = vi.fn()
        .mockResolvedValue(retryItems);

      // Mock callback failure
      mockProvider.verifyNotify = vi.fn()
        .mockRejectedValue(new Error('Callback failed'));

      mockPrisma.callbackRetryQueue.update = vi.fn()
        .mockResolvedValue({});

      // Act
      await handler.processRetryQueue();

      // Assert
      expect(mockPrisma.callbackRetryQueue.update).toHaveBeenCalledWith({
        where: { id: 'retry-001' },
        data: {
          retryCount: 1,
          nextRetryAt: expect.any(Date)
        }
      });
    });

    it('应该标记达到最大重试次数的项目为失败', async () => {
      // Arrange
      const retryItems = [
        {
          id: 'retry-001',
          paymentId: 'payment-001',
          requestData: JSON.stringify(testCallbackRequest),
          retryCount: 2 // One less than max
        }
      ];

      mockPrisma.callbackRetryQueue.findMany = vi.fn()
        .mockResolvedValue(retryItems);

      // Mock callback failure
      mockProvider.verifyNotify = vi.fn()
        .mockRejectedValue(new Error('Callback failed'));

      mockPrisma.callbackRetryQueue.update = vi.fn()
        .mockResolvedValue({});

      // Act
      await handler.processRetryQueue();

      // Assert
      expect(mockPrisma.callbackRetryQueue.update).toHaveBeenCalledWith({
        where: { id: 'retry-001' },
        data: {
          retryCount: 3, // Max retries reached
          nextRetryAt: new Date(0), // Never expires
          status: 'FAILED'
        }
      });
    });
  });

  describe('calculateRetryDelay', () => {
    it('应该使用指数退避算法计算延迟', () => {
      // Arrange & Act & Assert
      expect(handler['calculateRetryDelay'](0)).toBe(1000); // 1 second
      expect(handler['calculateRetryDelay'](1)).toBe(2000); // 2 seconds
      expect(handler['calculateRetryDelay'](2)).toBe(4000); // 4 seconds
      expect(handler['calculateRetryDelay'](3)).toBe(8000); // 8 seconds
    });
  });

  describe('shouldRetryError', () => {
    it('应该识别可重试的错误', () => {
      // Arrange & Act & Assert
      expect(handler['shouldRetryError']({ code: 'ECONNRESET' })).toBe(true);
      expect(handler['shouldRetryError']({ code: 'ETIMEDOUT' })).toBe(true);
      expect(handler['shouldRetryError']({ code: 'ENOTFOUND' })).toBe(true);
      expect(handler['shouldRetryError']({ code: 'ECONNREFUSED' })).toBe(true);
      expect(handler['shouldRetryError']({ code: 'CONNECTION_LOST' })).toBe(true);
    });

    it('应该识别不可重试的错误', () => {
      // Arrange & Act & Assert
      expect(handler['shouldRetryError']({ code: 'VALIDATION_ERROR' })).toBe(false);
      expect(handler['shouldRetryError']({ code: 'PERMISSION_DENIED' })).toBe(false);
      expect(handler['shouldRetryError']({ code: 'DATA_NOT_FOUND' })).toBe(false);
    });
  });
});