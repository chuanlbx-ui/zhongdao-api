import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RefundService, refundService } from '../../../src/modules/payment/refund.service';
import { PaymentProviderFactory } from '@/shared/payments';
import { pointsService } from '@/shared/services/points';
import { prisma } from '../../../src/shared/database/client';
import { logger } from '../../../src/shared/utils/logger';
import { PaymentChannel, RefundStatus, PaymentStatus } from '../../../src/modules/payment/types';
import type { RefundRequest, RefundResponse, RefundQuery } from '../../../src/modules/payment/refund.service';

// Mock dependencies
vi.mock('@/shared/payments');
vi.mock('@/shared/services/points');
vi.mock('../../../src/shared/database/client');
vi.mock('../../../src/shared/utils/logger');

const mockPaymentProviderFactory = PaymentProviderFactory as any;
const mockPointsService = pointsService as any;
const mockPrisma = prisma as any;
const mockLogger = logger as any;

describe('RefundService', () => {
  let refundService: RefundService;
  let testRefundRequest: RefundRequest;
  let mockPaymentRecord: any;
  let mockRefundRecord: any;
  let mockProvider: any;

  beforeEach(() => {
    // Get singleton instance
    refundService = RefundService.getInstance();

    // Setup test data
    testRefundRequest = {
      paymentId: 'payment-001',
      refundAmount: 500,
      refundReason: '用户申请退款',
      applyUserId: 'user-001',
      operatorId: 'admin-001'
    };

    mockPaymentRecord = {
      id: 'payment-001',
      paymentNo: 'PAY-202401001',
      orderId: 'order-001',
      userId: 'user-001',
      amount: 1000,
      paymentChannel: PaymentChannel.WECHAT,
      status: PaymentStatus.PAID,
      refunds: []
    };

    mockRefundRecord = {
      id: 'refund-001',
      refundNo: 'REF202401001ABC123',
      paymentId: 'payment-001',
      refundAmount: 500,
      refundReason: '用户申请退款',
      status: RefundStatus.PENDING,
      createdAt: new Date()
    };

    mockProvider = {
      createRefund: vi.fn(),
      queryRefund: vi.fn()
    };

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock returns
    mockPaymentProviderFactory.createProvider = vi.fn().mockReturnValue(mockProvider);
    mockPointsService.credit = vi.fn().mockResolvedValue({
      success: true,
      data: { transactionId: 'points-refund-001' },
      message: '通券返还成功'
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      // Act
      const instance1 = RefundService.getInstance();
      const instance2 = RefundService.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });

    it('导出的实例应该是单例', () => {
      // Act
      const instance = RefundService.getInstance();

      // Assert
      expect(refundService).toBe(instance);
    });
  });

  describe('createRefundOrder', () => {
    it('应该成功创建微信支付退款', async () => {
      // Arrange
      mockPrisma.paymentRecords.findUnique = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentLocks.findFirst = vi.fn()
        .mockResolvedValue(null); // No existing lock

      mockPrisma.paymentLocks.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentRefunds.create = vi.fn()
        .mockResolvedValue(mockRefundRecord);

      mockProvider.createRefund = vi.fn()
        .mockResolvedValue({
          success: true,
          channelRefundId: 'wx-refund-001',
          message: '退款申请成功'
        });

      mockPrisma.paymentRefunds.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLocks.updateMany = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await refundService.createRefundOrder(testRefundRequest);

      // Assert
      expect(result).toEqual({
        success: true,
        refundId: 'refund-001',
        refundNo: 'REF202401001ABC123',
        channelRefundId: 'wx-refund-001',
        status: RefundStatus.PENDING,
        message: '退款申请成功'
      });

      expect(mockProvider.createRefund).toHaveBeenCalledWith({
        orderId: 'PAY-202401001',
        refundAmount: 500,
        totalAmount: 1000,
        reason: '用户申请退款',
        refundId: 'REF202401001ABC123',
        extra: undefined
      });
    });

    it('应该成功创建通券退款', async () => {
      // Arrange
      const pointsPaymentRecord = {
        ...mockPaymentRecord,
        paymentChannel: PaymentChannel.POINTS
      };

      mockPrisma.paymentRecords.findUnique = vi.fn()
        .mockResolvedValue(pointsPaymentRecord);

      mockPrisma.paymentLocks.findFirst = vi.fn()
        .mockResolvedValue(null);

      mockPrisma.paymentLocks.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentRefunds.create = vi.fn()
        .mockResolvedValue(mockRefundRecord);

      mockPrisma.paymentRefunds.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLocks.updateMany = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await refundService.createRefundOrder(testRefundRequest);

      // Assert
      expect(result).toEqual({
        success: true,
        refundId: 'refund-001',
        refundNo: 'REF202401001ABC123',
        channelRefundId: 'points-refund-001',
        status: RefundStatus.PENDING,
        message: '退款申请成功'
      });

      expect(mockPointsService.credit).toHaveBeenCalledWith({
        userId: 'user-001',
        points: 500,
        description: '退款返还 - REF202401001ABC123'
      });
    });

    it('应该拒绝不存在的支付记录', async () => {
      // Arrange
      mockPrisma.paymentRecords.findUnique = vi.fn()
        .mockResolvedValue(null);

      // Act
      const result = await refundService.createRefundOrder(testRefundRequest);

      // Assert
      expect(result).toEqual({
        success: false,
        refundId: '',
        refundNo: '',
        status: RefundStatus.FAILED,
        message: '支付记录不存在',
        errors: ['支付记录不存在']
      });
    });

    it('应该验证退款条件', async () => {
      // Test cases for validation
      const validationTests = [
        {
          paymentRecord: { ...mockPaymentRecord, status: PaymentStatus.UNPAID },
          request: testRefundRequest,
          expectedMessage: '只能对已支付的订单进行退款'
        },
        {
          paymentRecord: mockPaymentRecord,
          request: { ...testRefundRequest, refundAmount: 0 },
          expectedMessage: '退款金额必须大于0'
        },
        {
          paymentRecord: mockPaymentRecord,
          request: { ...testRefundRequest, refundAmount: 1500 },
          expectedMessage: '退款金额不能超过支付金额'
        },
        {
          paymentRecord: {
            ...mockPaymentRecord,
            refunds: [{ status: RefundStatus.SUCCESS, refundAmount: 600 }]
          },
          request: { ...testRefundRequest, refundAmount: 500 },
          expectedMessage: '退款金额加上已退款金额不能超过支付金额'
        }
      ];

      for (const test of validationTests) {
        // Arrange
        mockPrisma.paymentRecords.findUnique = vi.fn()
          .mockResolvedValue(test.paymentRecord);

        // Act
        const result = await refundService.createRefundOrder(test.request);

        // Assert
        expect(result.success).toBe(false);
        expect(result.message).toContain(test.expectedMessage);
      }
    });

    it('应该拒绝重复的退款申请', async () => {
      // Arrange
      mockPrisma.paymentRecords.findUnique = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentLocks.findFirst = vi.fn()
        .mockResolvedValue({ // Existing lock
          id: 'lock-001',
          lockKey: 'refund:payment-001',
          isActive: true,
          expiresAt: new Date(Date.now() + 300000) // 5 minutes later
        });

      // Act
      const result = await refundService.createRefundOrder(testRefundRequest);

      // Assert
      expect(result).toEqual({
        success: false,
        refundId: '',
        refundNo: '',
        status: RefundStatus.FAILED,
        message: '存在未完成的退款申请，请勿重复提交',
        errors: ['存在未完成的退款申请，请勿重复提交']
      });
    });

    it('应该处理渠道退款失败', async () => {
      // Arrange
      mockPrisma.paymentRecords.findUnique = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentLocks.findFirst = vi.fn()
        .mockResolvedValue(null);

      mockPrisma.paymentLocks.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentRefunds.create = vi.fn()
        .mockResolvedValue(mockRefundRecord);

      mockProvider.createRefund = vi.fn()
        .mockResolvedValue({
          success: false,
          message: '退款失败：订单已超过退款期限'
        });

      mockPrisma.paymentRefunds.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLocks.updateMany = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await refundService.createRefundOrder(testRefundRequest);

      // Assert
      expect(result).toEqual({
        success: false,
        refundId: 'refund-001',
        refundNo: 'REF202401001ABC123',
        status: RefundStatus.PENDING,
        message: '退款失败：订单已超过退款期限',
        errors: ['退款失败：订单已超过退款期限']
      });

      expect(mockPrisma.paymentRefunds.update).toHaveBeenCalledWith({
        where: { id: 'refund-001' },
        data: {
          status: RefundStatus.FAILED,
          failedReason: '退款失败：订单已超过退款期限',
          channelResponse: expect.stringContaining('退款失败：订单已超过退款期限')
        }
      });
    });

    it('应该处理系统错误并释放锁', async () => {
      // Arrange
      mockPrisma.paymentRecords.findUnique = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentLocks.findFirst = vi.fn()
        .mockResolvedValue(null);

      mockPrisma.paymentLocks.create = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      mockPrisma.paymentLocks.updateMany = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await refundService.createRefundOrder(testRefundRequest);

      // Assert
      expect(result).toEqual({
        success: false,
        refundId: '',
        refundNo: '',
        status: RefundStatus.FAILED,
        message: '创建退款订单失败: Database error',
        errors: ['Database error']
      });

      // Should still attempt to release lock
      expect(mockPrisma.paymentLocks.updateMany).toHaveBeenCalledWith({
        where: {
          lockKey: 'refund:payment-001',
          isActive: true
        },
        data: {
          isActive: false
        }
      });
    });

    it('应该生成唯一的退款单号', async () => {
      // Arrange
      const requests = [
        { ...testRefundRequest, paymentId: 'payment-001' },
        { ...testRefundRequest, paymentId: 'payment-002' }
      ];

      mockPrisma.paymentRecords.findUnique = vi.fn()
        .mockResolvedValue(mockPaymentRecord);

      mockPrisma.paymentLocks.findFirst = vi.fn()
        .mockResolvedValue(null);

      mockPrisma.paymentLocks.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentRefunds.create = vi.fn()
        .mockImplementation((data) => Promise.resolve({
          ...mockRefundRecord,
          refundNo: data.refundNo
        }));

      mockProvider.createRefund = vi.fn()
        .mockResolvedValue({ success: true });

      mockPrisma.paymentRefunds.update = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLogs.create = vi.fn()
        .mockResolvedValue({});

      mockPrisma.paymentLocks.updateMany = vi.fn()
        .mockResolvedValue({});

      // Act
      const [result1, result2] = await Promise.all(
        requests.map(req => refundService.createRefundOrder(req))
      );

      // Assert
      expect(result1.refundNo).toMatch(/^REF\d+[A-Z0-9]{6}$/);
      expect(result2.refundNo).toMatch(/^REF\d+[A-Z0-9]{6}$/);
      expect(result1.refundNo).not.toBe(result2.refundNo);
    });
  });

  describe('queryRefundStatus', () => {
    it('应该查询退款状态', async () => {
      // Arrange
      const refundWithPayment = {
        ...mockRefundRecord,
        status: RefundStatus.PROCESSING,
        payment: {
          ...mockPaymentRecord,
          users: {
            id: 'user-001',
            nickname: 'Test User',
            phone: '13800138000'
          }
        }
      };

      mockPrisma.paymentRefunds.findUnique = vi.fn()
        .mockResolvedValueOnce(refundWithPayment) // First call
        .mockResolvedValueOnce({
          ...refundWithPayment,
          status: RefundStatus.SUCCESS // Updated status
        });

      mockProvider.queryRefund = vi.fn()
        .mockResolvedValue({
          success: true,
          status: 'SUCCESS'
        });

      mockPrisma.paymentRefunds.update = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await refundService.queryRefundStatus('refund-001');

      // Assert
      expect(result.success).toBe(true);
      expect(result.refund.status).toBe(RefundStatus.SUCCESS);
      expect(mockProvider.queryRefund).toHaveBeenCalledWith(
        'PAY-202401001',
        'REF202401001ABC123'
      );
    });

    it('应该返回已完成的退款状态', async () => {
      // Arrange
      const completedRefund = {
        ...mockRefundRecord,
        status: RefundStatus.SUCCESS,
        payment: {
          ...mockPaymentRecord,
          users: {
            id: 'user-001',
            nickname: 'Test User',
            phone: '13800138000'
          }
        }
      };

      mockPrisma.paymentRefunds.findUnique = vi.fn()
        .mockResolvedValue(completedRefund);

      // Act
      const result = await refundService.queryRefundStatus('refund-001');

      // Assert
      expect(result.success).toBe(true);
      expect(result.refund.status).toBe(RefundStatus.SUCCESS);
      expect(mockProvider.queryRefund).not.toHaveBeenCalled(); // Should not query channel
    });

    it('应该处理通券退款查询', async () => {
      // Arrange
      const pointsRefund = {
        ...mockRefundRecord,
        status: RefundStatus.PROCESSING,
        payment: {
          ...mockPaymentRecord,
          paymentChannel: PaymentChannel.POINTS,
          users: {
            id: 'user-001',
            nickname: 'Test User',
            phone: '13800138000'
          }
        }
      };

      mockPrisma.paymentRefunds.findUnique = vi.fn()
        .mockResolvedValue(pointsRefund);

      // Act
      const result = await refundService.queryRefundStatus('refund-001');

      // Assert
      expect(result.success).toBe(true);
      // Points refunds don't query external channel
      expect(mockProvider.queryRefund).not.toHaveBeenCalled();
    });

    it('应该处理不存在的退款记录', async () => {
      // Arrange
      mockPrisma.paymentRefunds.findUnique = vi.fn()
        .mockResolvedValue(null);

      // Act & Assert
      await expect(refundService.queryRefundStatus('non-existent'))
        .rejects.toThrow('退款记录不存在');
    });

    it('应该处理查询错误', async () => {
      // Arrange
      mockPrisma.paymentRefunds.findUnique = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(refundService.queryRefundStatus('refund-001'))
        .rejects.toThrow('Database error');
    });
  });

  describe('getRefundList', () => {
    it('应该获取退款列表', async () => {
      // Arrange
      const query: RefundQuery = {
        page: 1,
        perPage: 10,
        status: RefundStatus.SUCCESS
      };

      const mockRefunds = [
        {
          ...mockRefundRecord,
          status: RefundStatus.SUCCESS,
          payment: {
            ...mockPaymentRecord,
            users: {
              id: 'user-001',
              nickname: 'Test User',
              phone: '13800138000'
            }
          }
        }
      ];

      mockPrisma.paymentRefunds.findMany = vi.fn()
        .mockResolvedValue(mockRefunds);

      mockPrisma.paymentRefunds.count = vi.fn()
        .mockResolvedValue(1);

      // Act
      const result = await refundService.getRefundList(query);

      // Assert
      expect(result).toEqual({
        success: true,
        data: {
          records: mockRefunds,
          pagination: {
            page: 1,
            perPage: 10,
            total: 1,
            totalPages: 1
          }
        }
      });

      expect(mockPrisma.paymentRefunds.findMany).toHaveBeenCalledWith({
        where: { status: RefundStatus.SUCCESS },
        include: {
          payment: {
            select: {
              id: true,
              paymentNo: true,
              amount: true,
              paymentChannel: true,
              users: {
                select: {
                  id: true,
                  nickname: true,
                  phone: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10
      });
    });

    it('应该支持多种查询条件', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const query: RefundQuery = {
        refundId: 'refund-001',
        refundNo: 'REF202401001',
        paymentId: 'payment-001',
        status: RefundStatus.PENDING,
        startDate,
        endDate,
        page: 2,
        perPage: 20
      };

      mockPrisma.paymentRefunds.findMany = vi.fn()
        .mockResolvedValue([]);

      mockPrisma.paymentRefunds.count = vi.fn()
        .mockResolvedValue(0);

      // Act
      await refundService.getRefundList(query);

      // Assert
      expect(mockPrisma.paymentRefunds.findMany).toHaveBeenCalledWith({
        where: {
          id: 'refund-001',
          refundNo: 'REF202401001',
          paymentId: 'payment-001',
          status: RefundStatus.PENDING,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 20
      });
    });

    it('应该限制每页最大数量', async () => {
      // Arrange
      const query: RefundQuery = {
        perPage: 200 // Exceeds limit
      };

      mockPrisma.paymentRefunds.findMany = vi.fn()
        .mockResolvedValue([]);

      mockPrisma.paymentRefunds.count = vi.fn()
        .mockResolvedValue(0);

      // Act
      await refundService.getRefundList(query);

      // Assert
      expect(mockPrisma.paymentRefunds.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100 // Limited to 100
        })
      );
    });

    it('应该处理查询错误', async () => {
      // Arrange
      mockPrisma.paymentRefunds.findMany = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(refundService.getRefundList({}))
        .rejects.toThrow('Database error');
    });
  });

  describe('getRefundStatistics', () => {
    it('应该获取退款统计', async () => {
      // Arrange
      mockPrisma.paymentRefunds.aggregate = vi.fn()
        .mockResolvedValue({
          _count: { id: 100 },
          _sum: { refundAmount: 50000 }
        });

      mockPrisma.paymentRefunds.groupBy = vi.fn()
        .mockResolvedValue([
          { status: 'PENDING', _count: { id: 10 }, _sum: { refundAmount: 5000 } },
          { status: 'PROCESSING', _count: { id: 5 }, _sum: { refundAmount: 2500 } },
          { status: 'SUCCESS', _count: { id: 80 }, _sum: { refundAmount: 40000 } },
          { status: 'FAILED', _count: { id: 5 }, _sum: { refundAmount: 2500 } }
        ]);

      // Act
      const result = await refundService.getRefundStatistics();

      // Assert
      expect(result).toEqual({
        totalCount: 100,
        totalAmount: 50000,
        pendingCount: 10,
        pendingAmount: 5000,
        processingCount: 5,
        processingAmount: 2500,
        successCount: 80,
        successAmount: 40000,
        failedCount: 5,
        failedAmount: 2500
      });
    });

    it('应该支持时间范围查询', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrisma.paymentRefunds.aggregate = vi.fn()
        .mockResolvedValue({
          _count: { id: 0 },
          _sum: { refundAmount: 0 }
        });

      mockPrisma.paymentRefunds.groupBy = vi.fn()
        .mockResolvedValue([]);

      // Act
      await refundService.getRefundStatistics({ startDate, endDate });

      // Assert
      expect(mockPrisma.paymentRefunds.aggregate).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: { id: true },
        _sum: { refundAmount: true }
      });
    });

    it('应该处理统计查询错误', async () => {
      // Arrange
      mockPrisma.paymentRefunds.aggregate = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(refundService.getRefundStatistics())
        .rejects.toThrow('Database error');
    });
  });

  describe('私有方法', () => {
    it('应该生成正确的退款单号格式', () => {
      // Act
      const refundNo1 = refundService['generateRefundNo']();
      const refundNo2 = refundService['generateRefundNo']();

      // Assert
      expect(refundNo1).toMatch(/^REF\d+[A-Z0-9]{6}$/);
      expect(refundNo2).toMatch(/^REF\d+[A-Z0-9]{6}$/);
      expect(refundNo1).not.toBe(refundNo2);
    });

    it('应该正确映射渠道退款状态', () => {
      // Arrange & Act & Assert
      expect(refundService['mapChannelRefundStatus']('SUCCESS')).toBe(RefundStatus.SUCCESS);
      expect(refundService['mapChannelRefundStatus']('SUCCESSFUL')).toBe(RefundStatus.SUCCESS);
      expect(refundService['mapChannelRefundStatus']('FAILED')).toBe(RefundStatus.FAILED);
      expect(refundService['mapChannelRefundStatus']('CLOSED')).toBe(RefundStatus.FAILED);
      expect(refundService['mapChannelRefundStatus']('PROCESSING')).toBe(RefundStatus.PROCESSING);
      expect(refundService['mapChannelRefundStatus']('PENDING')).toBe(RefundStatus.PENDING);
      expect(refundService['mapChannelRefundStatus']('UNKNOWN')).toBe(RefundStatus.FAILED);
    });

    it('应该返回正确的操作描述', () => {
      // Arrange & Act & Assert
      expect(refundService['getActionDescription']('CREATE')).toBe('创建退款申请');
      expect(refundService['getActionDescription']('QUERY')).toBe('查询退款状态');
      expect(refundService['getActionDescription']('SUCCESS')).toBe('退款成功');
      expect(refundService['getActionDescription']('FAILED')).toBe('退款失败');
      expect(refundService['getActionDescription']('CANCEL')).toBe('取消退款');
      expect(refundService['getActionDescription']('PROCESS')).toBe('退款处理中');
      expect(refundService['getActionDescription']('UNKNOWN')).toBe('UNKNOWN');
    });
  });
});