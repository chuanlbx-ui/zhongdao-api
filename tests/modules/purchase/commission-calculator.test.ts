import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommissionCalculator } from '../../../src/modules/purchase/commission-calculator';
import { prisma } from '../../../src/shared/database/client';
import { UserLevel, userLevelService } from '../../../src/modules/user/level.service';
import { logger } from '../../../src/shared/utils/logger';
import type { CommissionCalculationParams, CommissionRecord } from '../../../src/modules/purchase/types';

// Mock dependencies
vi.mock('../../../src/shared/database/client');
vi.mock('../../../src/modules/user/level.service');
vi.mock('../../../src/shared/utils/logger');

const mockPrisma = prisma as any;
const mockUserLevelService = userLevelService as any;
const mockLogger = logger as any;

describe('CommissionCalculator', () => {
  let commissionCalculator: CommissionCalculator;
  let testParams: CommissionCalculationParams;
  let mockCommissionPath: Array<{ id: string; level: UserLevel }>;

  beforeEach(() => {
    commissionCalculator = new CommissionCalculator();

    // Setup test data
    testParams = {
      orderId: 'order-001',
      sellerId: 'seller-001',
      sellerLevel: UserLevel.STAR_1,
      totalAmount: 1000,
      maxDepth: 3
    };

    mockCommissionPath = [
      { id: 'seller-001', level: UserLevel.STAR_1 },
      { id: 'upline-001', level: UserLevel.STAR_2 },
      { id: 'upline-002', level: UserLevel.STAR_3 },
      { id: 'upline-003', level: UserLevel.DIRECTOR }
    ];

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock returns
    mockUserLevelService.getLevelBenefits = vi.fn().mockReturnValue({
      commissionRate: 0.15 // 15%
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('calculateAndDistributeCommission', () => {
    it('应该成功计算并分配佣金', async () => {
      // Arrange
      const expectedCommissionRecords: CommissionRecord[] = [
        {
          id: 'commission-001',
          userId: 'seller-001',
          orderId: testParams.orderId,
          amount: 150, // 1000 * 0.15
          rate: 0.15,
          level: 1,
          sourceUserId: testParams.sellerId,
          sourceType: 'PURCHASE',
          status: 'PENDING',
          metadata: {
            pathDepth: 1,
            maxDepth: 3,
            baseCommissionRate: 0.15,
            calculationMethod: 'degressive'
          }
        },
        {
          id: 'commission-002',
          userId: 'upline-001',
          orderId: testParams.orderId,
          amount: 120, // 1000 * 0.15 * 0.8
          rate: 0.12,
          level: 2,
          sourceUserId: testParams.sellerId,
          sourceType: 'PURCHASE',
          status: 'PENDING',
          metadata: {
            pathDepth: 2,
            maxDepth: 3,
            baseCommissionRate: 0.15,
            calculationMethod: 'degressive'
          }
        },
        {
          id: 'commission-003',
          userId: 'upline-002',
          orderId: testParams.orderId,
          amount: 96, // 1000 * 0.15 * 0.8^2
          rate: 0.096,
          level: 3,
          sourceUserId: testParams.sellerId,
          sourceType: 'PURCHASE',
          status: 'PENDING',
          metadata: {
            pathDepth: 3,
            maxDepth: 3,
            baseCommissionRate: 0.15,
            calculationMethod: 'degressive'
          }
        }
      ];

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mockCommissionPath);

      mockPrisma.commissionRecord.create = vi.fn()
        .mockResolvedValueOnce(expectedCommissionRecords[0])
        .mockResolvedValueOnce(expectedCommissionRecords[1])
        .mockResolvedValueOnce(expectedCommissionRecords[2]);

      // Act
      const result = await commissionCalculator.calculateAndDistributeCommission(testParams);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual(expectedCommissionRecords[0]);
      expect(result[1]).toEqual(expectedCommissionRecords[1]);
      expect(result[2]).toEqual(expectedCommissionRecords[2]);

      // Verify the degressive calculation
      expect(result[0].rate).toBe(0.15);  // 15%
      expect(result[1].rate).toBe(0.12);  // 15% * 0.8
      expect(result[2].rate).toBe(0.096); // 15% * 0.8^2

      expect(mockLogger.info).toHaveBeenCalledWith(
        '佣金分配完成',
        expect.objectContaining({
          orderId: testParams.orderId,
          totalCommission: 366, // 150 + 120 + 96
          recordCount: 3
        })
      );
    });

    it('应该只分配大于最小门槛的佣金', async () => {
      // Arrange
      const smallAmountParams = {
        ...testParams,
        totalAmount: 0.05  // Very small amount
      };

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mockCommissionPath);

      mockPrisma.commissionRecord.create = vi.fn(); // Should not be called

      // Act
      const result = await commissionCalculator.calculateAndDistributeCommission(smallAmountParams);

      // Assert
      expect(result).toHaveLength(0);
      expect(mockPrisma.commissionRecord.create).not.toHaveBeenCalled();
    });

    it('应该遵循最大深度限制', async () => {
      // Arrange
      const deepParams = {
        ...testParams,
        maxDepth: 2
      };

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mockCommissionPath);

      mockPrisma.commissionRecord.create = vi.fn()
        .mockResolvedValue({});

      // Act
      await commissionCalculator.calculateAndDistributeCommission(deepParams);

      // Assert
      expect(mockPrisma.commissionRecord.create).toHaveBeenCalledTimes(2); // Limited to maxDepth
    });

    it('应该支持事务模式', async () => {
      // Arrange
      const mockTx = {
        commissionRecord: {
          create: vi.fn().mockResolvedValue({})
        }
      };

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mockCommissionPath);

      // Act
      await commissionCalculator.calculateAndDistributeCommission(testParams, mockTx);

      // Assert
      expect(mockTx.commissionRecord.create).toHaveBeenCalled();
      expect(mockPrisma.commissionRecord.create).not.toHaveBeenCalled();
    });

    it('应该处理数据库错误并返回空数组', async () => {
      // Arrange
      mockPrisma.users.findMany = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      // Act
      const result = await commissionCalculator.calculateAndDistributeCommission(testParams);

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '计算分配佣金失败',
        expect.objectContaining({
          error: 'Database error'
        })
      );
    });

    it('应该跳过非活跃用户', async () => {
      // Arrange
      const mixedStatusPath = [
        ...mockCommissionPath,
        { id: 'inactive-user', level: UserLevel.STAR_4 }
      ];

      const mockUsers = [
        { id: 'seller-001', level: UserLevel.STAR_1, status: 'ACTIVE', referrerId: 'upline-001' },
        { id: 'upline-001', level: UserLevel.STAR_2, status: 'INACTIVE', referrerId: 'upline-002' },
        { id: 'upline-002', level: UserLevel.STAR_3, status: 'ACTIVE', referrerId: null }
      ];

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mixedStatusPath.slice(0, 3)); // Simulate filtering

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(mockUsers[0])  // seller-001
        .mockResolvedValueOnce(mockUsers[1])  // upline-001
        .mockResolvedValueOnce(mockUsers[2]); // upline-002

      mockPrisma.commissionRecord.create = vi.fn()
        .mockResolvedValue({});

      // Act
      const result = await commissionCalculator.calculateAndDistributeCommission(testParams);

      // Assert
      // Should only include active users (seller-001, upline-002)
      expect(mockPrisma.commissionRecord.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCommissionPath', () => {
    it('应该正确获取佣金路径', async () => {
      // Arrange
      const userId = 'seller-001';
      const maxDepth = 3;

      const mockUsers = [
        {
          id: 'seller-001',
          level: UserLevel.STAR_1,
          status: 'ACTIVE',
          referrerId: 'upline-001',
          parentId: null
        },
        {
          id: 'upline-001',
          level: UserLevel.STAR_2,
          status: 'ACTIVE',
          referrerId: 'upline-002',
          parentId: null
        },
        {
          id: 'upline-002',
          level: UserLevel.STAR_3,
          status: 'ACTIVE',
          referrerId: null,
          parentId: null
        }
      ];

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(mockUsers[0])
        .mockResolvedValueOnce(mockUsers[1])
        .mockResolvedValueOnce(mockUsers[2])
        .mockResolvedValueOnce(null); // End of chain

      // Act
      const result = await commissionCalculator.getCommissionPath(userId, maxDepth);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 'seller-001',
        level: UserLevel.STAR_1
      });
      expect(result[1]).toEqual({
        id: 'upline-001',
        level: UserLevel.STAR_2
      });
      expect(result[2]).toEqual({
        id: 'upline-002',
        level: UserLevel.STAR_3
      });
    });

    it('应该优先使用referrerId而非parentId', async () => {
      // Arrange
      const userId = 'user-001';
      const mockUser = {
        id: 'user-001',
        level: UserLevel.NORMAL,
        status: 'ACTIVE',
        referrerId: 'referrer-001',
        parentId: 'parent-001'
      };

      const mockReferrer = {
        id: 'referrer-001',
        level: UserLevel.VIP,
        status: 'ACTIVE',
        referrerId: null,
        parentId: null
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockReferrer)
        .mockResolvedValueOnce(null);

      // Act
      const result = await commissionCalculator.getCommissionPath(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[1].id).toBe('referrer-001'); // Should follow referrer path
    });

    it('应该返回空数组如果用户不存在', async () => {
      // Arrange
      const userId = 'non-existent-user';
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(null);

      // Act
      const result = await commissionCalculator.getCommissionPath(userId);

      // Assert
      expect(result).toEqual([]);
    });

    it('应该停止于非活跃用户', async () => {
      // Arrange
      const userId = 'user-001';
      const activeUser = {
        id: 'user-001',
        level: UserLevel.NORMAL,
        status: 'ACTIVE',
        referrerId: 'inactive-user',
        parentId: null
      };

      const inactiveUser = {
        id: 'inactive-user',
        level: UserLevel.VIP,
        status: 'INACTIVE', // Non-active
        referrerId: 'next-user',
        parentId: null
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(activeUser)
        .mockResolvedValueOnce(inactiveUser);

      // Act
      const result = await commissionCalculator.getCommissionPath(userId);

      // Assert
      expect(result).toHaveLength(1); // Should stop at inactive user
      expect(result[0].id).toBe('user-001');
    });

    it('应该处理查询错误并返回空数组', async () => {
      // Arrange
      const userId = 'user-001';
      mockPrisma.users.findUnique = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      // Act
      const result = await commissionCalculator.getCommissionPath(userId);

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '获取佣金路径失败',
        expect.objectContaining({
          userId,
          error: 'Database error'
        })
      );
    });
  });

  describe('previewCommission', () => {
    it('应该正确预计算佣金', async () => {
      // Arrange
      const params = {
        sellerId: 'seller-001',
        sellerLevel: UserLevel.STAR_1,
        totalAmount: 1000,
        maxDepth: 3
      };

      commissionCalculator.getCommissionPath = vi.fn()
        .mockResolvedValue(mockCommissionPath);

      // Act
      const result = await commissionCalculator.previewCommission(params);

      // Assert
      expect(result.totalCommission).toBe(366); // 150 + 120 + 96
      expect(result.commissionBreakdown).toHaveLength(3);

      expect(result.commissionBreakdown[0]).toEqual({
        userId: 'seller-001',
        level: 1,
        amount: 150,
        rate: 0.15,
        userLevel: UserLevel.STAR_1
      });
    });

    it('应该处理计算错误', async () => {
      // Arrange
      const params = {
        sellerId: 'seller-001',
        sellerLevel: UserLevel.STAR_1,
        totalAmount: 1000
      };

      commissionCalculator.getCommissionPath = vi.fn()
        .mockRejectedValue(new Error('Calculation error'));

      // Act
      const result = await commissionCalculator.previewCommission(params);

      // Assert
      expect(result.totalCommission).toBe(0);
      expect(result.commissionBreakdown).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        '预计算佣金失败',
        expect.objectContaining({
          error: 'Calculation error'
        })
      );
    });
  });

  describe('calculateTeamPerformance', () => {
    it('应该正确计算团队业绩', async () => {
      // Arrange
      const userId = 'leader-001';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockTeamMembers = [
        { id: 'member-001', status: 'ACTIVE', level: UserLevel.NORMAL },
        { id: 'member-002', status: 'ACTIVE', level: UserLevel.VIP },
        { id: 'member-003', status: 'INACTIVE', level: UserLevel.NORMAL }
      ];

      const mockTeamOrders = [
        { id: 'order-001', totalAmount: 500 },
        { id: 'order-002', totalAmount: 300 },
        { id: 'order-003', totalAmount: 200 }
      ];

      const mockTeamCommissions = [
        { amount: 50 },
        { amount: 30 },
        { amount: 20 }
      ];

      mockPrisma.users.findMany = vi.fn()
        .mockResolvedValue(mockTeamMembers);

      mockPrisma.purchaseOrderss = mockPrisma.purchaseOrders || {};
      mockPrisma.purchaseOrderss.findMany = vi.fn()
        .mockResolvedValue(mockTeamOrders);

      mockPrisma.commissionRecord.findMany = vi.fn()
        .mockResolvedValue(mockTeamCommissions);

      // Act
      const result = await commissionCalculator.calculateTeamPerformance(
        userId,
        startDate,
        endDate
      );

      // Assert
      expect(result).toEqual({
        totalOrders: 3,
        totalAmount: 1000,
        totalCommission: 100,
        teamSize: 3,
        activeMembers: 2
      });
    });

    it('应该处理查询错误', async () => {
      // Arrange
      const userId = 'leader-001';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockPrisma.users.findMany = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      // Act
      const result = await commissionCalculator.calculateTeamPerformance(
        userId,
        startDate,
        endDate
      );

      // Assert
      expect(result).toEqual({
        totalOrders: 0,
        totalAmount: 0,
        totalCommission: 0,
        teamSize: 0,
        activeMembers: 0
      });
    });
  });

  describe('getUserCommissionStats', () => {
    it('应该正确计算月度佣金统计', async () => {
      // Arrange
      const userId = 'user-001';
      const period = 'month';

      const mockCommissions = [
        { amount: 100, status: 'PENDING', orderId: 'order-001' },
        { amount: 200, status: 'PAID', orderId: 'order-002' },
        { amount: 150, status: 'PAID', orderId: 'order-003' },
        { amount: 50, status: 'PENDING', orderId: 'order-001' } // Same order
      ];

      mockPrisma.commissionRecord.findMany = vi.fn()
        .mockResolvedValue(mockCommissions);

      // Act
      const result = await commissionCalculator.getUserCommissionStats(userId, period);

      // Assert
      expect(result).toEqual({
        totalCommission: 500, // 100 + 200 + 150 + 50
        pendingCommission: 150, // 100 + 50
        paidCommission: 350, // 200 + 150
        orderCount: 3, // Unique orders
        averageCommission: 166.67 // 500 / 3
      });
    });

    it('应该正确处理不同的时间周期', async () => {
      // Arrange
      const userId = 'user-001';
      const mockCommissions = [];

      mockPrisma.commissionRecord.findMany = vi.fn()
        .mockResolvedValue(mockCommissions);

      // Test different periods
      const periods = ['day', 'week', 'month', 'year'] as const;

      for (const period of periods) {
        // Act
        await commissionCalculator.getUserCommissionStats(userId, period);

        // Assert
        expect(mockPrisma.commissionRecord.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId,
              createdAt: expect.objectContaining({
                gte: expect.any(Date),
                lte: expect.any(Date)
              })
            })
          })
        );
      }
    });

    it('应该处理空佣金记录', async () => {
      // Arrange
      const userId = 'user-001';
      mockPrisma.commissionRecord.findMany = vi.fn()
        .mockResolvedValue([]);

      // Act
      const result = await commissionCalculator.getUserCommissionStats(userId);

      // Assert
      expect(result).toEqual({
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
        orderCount: 0,
        averageCommission: 0
      });
    });

    it('应该处理查询错误', async () => {
      // Arrange
      const userId = 'user-001';
      mockPrisma.commissionRecord.findMany = vi.fn()
        .mockRejectedValue(new Error('Database error'));

      // Act
      const result = await commissionCalculator.getUserCommissionStats(userId);

      // Assert
      expect(result).toEqual({
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
        orderCount: 0,
        averageCommission: 0
      });
    });
  });
});