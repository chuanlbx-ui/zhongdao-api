import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommissionCalculator } from '@/modules/purchase/commission-calculator';
import { UserLevel } from '@/modules/user/level.service';
import { prisma } from '@/shared/database/client';
import { userLevelService } from '@/modules/user/level.service';

// Mock dependencies
vi.mock('@/shared/database/client');
vi.mock('@/modules/user/level.service');
vi.mock('@/shared/utils/logger');

const mockPrisma = prisma as any;
const mockUserLevelService = userLevelService as any;

describe('CommissionCalculator', () => {
  let calculator: CommissionCalculator;

  beforeEach(() => {
    vi.clearAllMocks();
    calculator = new CommissionCalculator();
  });

  describe('calculateAndDistributeCommission', () => {
    it('should calculate and distribute commission correctly', async () => {
      // Arrange
      const params = {
        orderId: 'order-1',
        sellerId: 'seller-1',
        totalAmount: 1000,
        sellerLevel: UserLevel.STAR_1
      };

      const commissionPath = [
        { id: 'seller-1', level: UserLevel.STAR_1 },
        { id: 'upline-1', level: UserLevel.STAR_2 },
        { id: 'upline-2', level: UserLevel.STAR_3 }
      ];

      const mockCommissionRecord = {
        id: 'commission-1',
        userId: 'seller-1',
        orderId: 'order-1',
        amount: 50,
        rate: 0.05,
        level: 1,
        sourceUserId: 'seller-1',
        sourceType: 'PURCHASE',
        status: 'PENDING',
        metadata: {}
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce({ id: 'seller-1', referrerId: 'upline-1', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-1', referrerId: 'upline-2', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-2', referrerId: null, status: 'ACTIVE' });

      mockPrisma.commissionRecord.create.mockResolvedValue(mockCommissionRecord);

      mockUserLevelService.getLevelBenefits.mockReturnValue({
        commissionRate: 0.05 // 5% base commission
      });

      // Act
      const result = await calculator.calculateAndDistributeCommission(params);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].userId).toBe('seller-1');
      expect(result[0].amount).toBe(50); // 1000 * 0.05
      expect(result[0].rate).toBe(0.05);
      expect(result[0].level).toBe(1);

      expect(result[1].userId).toBe('upline-1');
      expect(result[1].amount).toBe(40); // 1000 * 0.05 * 0.8
      expect(result[1].rate).toBe(0.04);
      expect(result[1].level).toBe(2);

      expect(result[2].userId).toBe('upline-2');
      expect(result[2].amount).toBe(32); // 1000 * 0.05 * 0.8 * 0.8
      expect(result[2].rate).toBe(0.032);
      expect(result[2].level).toBe(3);
    });

    it('should use provided transaction object', async () => {
      // Arrange
      const params = {
        orderId: 'order-1',
        sellerId: 'seller-1',
        totalAmount: 1000,
        sellerLevel: UserLevel.STAR_1
      };

      const mockTx = {
        commissionRecord: {
          create: vi.fn().mockResolvedValue({
            id: 'commission-1',
            userId: 'seller-1',
            orderId: 'order-1'
          })
        }
      };

      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'seller-1',
        referrerId: null,
        status: 'ACTIVE'
      });

      mockUserLevelService.getLevelBenefits.mockReturnValue({
        commissionRate: 0.05
      });

      // Act
      await calculator.calculateAndDistributeCommission(params, mockTx);

      // Assert
      expect(mockTx.commissionRecord.create).toHaveBeenCalled();
      expect(mockPrisma.commissionRecord.create).not.toHaveBeenCalled();
    });

    it('should skip commissions below minimum threshold', async () => {
      // Arrange
      const params = {
        orderId: 'order-1',
        sellerId: 'seller-1',
        totalAmount: 0.1, // Very small amount
        sellerLevel: UserLevel.STAR_1
      };

      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'seller-1',
        referrerId: null,
        status: 'ACTIVE'
      });

      mockUserLevelService.getLevelBenefits.mockReturnValue({
        commissionRate: 0.05
      });

      // Act
      const result = await calculator.calculateAndDistributeCommission(params);

      // Assert
      expect(result).toHaveLength(0);
      expect(mockPrisma.commissionRecord.create).not.toHaveBeenCalled();
    });

    it('should handle inactive users in commission path', async () => {
      // Arrange
      const params = {
        orderId: 'order-1',
        sellerId: 'seller-1',
        totalAmount: 1000,
        sellerLevel: UserLevel.STAR_1
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce({ id: 'seller-1', referrerId: 'upline-1', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-1', referrerId: 'upline-2', status: 'INACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-2', referrerId: null, status: 'ACTIVE' });

      mockUserLevelService.getLevelBenefits.mockReturnValue({
        commissionRate: 0.05
      });

      // Act
      const result = await calculator.calculateAndDistributeCommission(params);

      // Assert
      expect(result).toHaveLength(2); // Skips inactive upline-1
      expect(result[0].userId).toBe('seller-1');
      expect(result[1].userId).toBe('upline-2');
    });
  });

  describe('getCommissionPath', () => {
    it('should get commission path with referrer', async () => {
      // Arrange
      mockPrisma.users.findUnique
        .mockResolvedValueOnce({ id: 'seller-1', referrerId: 'upline-1', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-1', referrerId: 'upline-2', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-2', referrerId: null, status: 'ACTIVE' });

      // Act
      const result = await calculator.getCommissionPath('seller-1', 5);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('seller-1');
      expect(result[1].id).toBe('upline-1');
      expect(result[2].id).toBe('upline-2');
    });

    it('should get commission path with parent when no referrer', async () => {
      // Arrange
      mockPrisma.users.findUnique
        .mockResolvedValueOnce({ id: 'seller-1', referrerId: null, parentId: 'upline-1', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-1', referrerId: null, parentId: null, status: 'ACTIVE' });

      // Act
      const result = await calculator.getCommissionPath('seller-1', 5);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('seller-1');
      expect(result[1].id).toBe('upline-1');
    });

    it('should respect max depth', async () => {
      // Arrange
      mockPrisma.users.findUnique
        .mockResolvedValueOnce({ id: 'seller-1', referrerId: 'upline-1', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-1', referrerId: 'upline-2', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-2', referrerId: 'upline-3', status: 'ACTIVE' });

      // Act
      const result = await calculator.getCommissionPath('seller-1', 2);

      // Assert
      expect(result).toHaveLength(2); // Limited by maxDepth
    });

    it('should stop at inactive users', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValue({
        id: 'seller-1',
        referrerId: 'upline-1',
        status: 'INACTIVE' // Stop here
      });

      // Act
      const result = await calculator.getCommissionPath('seller-1', 5);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('previewCommission', () => {
    it('should preview commission correctly', async () => {
      // Arrange
      const params = {
        sellerId: 'seller-1',
        totalAmount: 1000,
        sellerLevel: UserLevel.STAR_1
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce({ id: 'seller-1', referrerId: 'upline-1', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'upline-1', referrerId: null, status: 'ACTIVE' });

      mockUserLevelService.getLevelBenefits.mockReturnValue({
        commissionRate: 0.05
      });

      // Act
      const result = await calculator.previewCommission(params);

      // Assert
      expect(result.totalCommission).toBe(90); // 50 + 40
      expect(result.commissionBreakdown).toHaveLength(2);

      expect(result.commissionBreakdown[0]).toMatchObject({
        userId: 'seller-1',
        level: 1,
        amount: 50,
        rate: 0.05,
        userLevel: UserLevel.STAR_1
      });

      expect(result.commissionBreakdown[1]).toMatchObject({
        userId: 'upline-1',
        level: 2,
        amount: 40,
        rate: 0.04,
        userLevel: UserLevel.STAR_1
      });
    });

    it('should return empty preview for invalid data', async () => {
      // Arrange
      const params = {
        sellerId: 'invalid-seller',
        totalAmount: 1000,
        sellerLevel: UserLevel.STAR_1
      };

      mockPrisma.users.findUnique.mockResolvedValue(null);

      // Act
      const result = await calculator.previewCommission(params);

      // Assert
      expect(result.totalCommission).toBe(0);
      expect(result.commissionBreakdown).toHaveLength(0);
    });
  });

  describe('calculateTeamPerformance', () => {
    it('should calculate team performance correctly', async () => {
      // Arrange
      const teamMembers = [
        { id: 'member-1', status: 'ACTIVE', level: UserLevel.NORMAL },
        { id: 'member-2', status: 'ACTIVE', level: UserLevel.VIP },
        { id: 'member-3', status: 'INACTIVE', level: UserLevel.NORMAL }
      ];

      const teamOrders = [
        { id: 'order-1', totalAmount: 100 },
        { id: 'order-2', totalAmount: 200 },
        { id: 'order-3', totalAmount: 300 }
      ];

      const teamCommissions = [
        { amount: 10 },
        { amount: 20 }
      ];

      mockPrisma.users.findMany.mockResolvedValue(teamMembers);
      mockPrisma.purchaseOrderss.findMany.mockResolvedValue(teamOrders);
      mockPrisma.commissionRecord.findMany.mockResolvedValue(teamCommissions);

      // Act
      const result = await calculator.calculateTeamPerformance(
        'leader-1',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      // Assert
      expect(result.totalOrders).toBe(3);
      expect(result.totalAmount).toBe(600);
      expect(result.totalCommission).toBe(30);
      expect(result.teamSize).toBe(3);
      expect(result.activeMembers).toBe(2);
    });

    it('should handle empty team', async () => {
      // Arrange
      mockPrisma.users.findMany.mockResolvedValue([]);
      mockPrisma.purchaseOrderss.findMany.mockResolvedValue([]);
      mockPrisma.commissionRecord.findMany.mockResolvedValue([]);

      // Act
      const result = await calculator.calculateTeamPerformance(
        'leader-1',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      // Assert
      expect(result.totalOrders).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.totalCommission).toBe(0);
      expect(result.teamSize).toBe(0);
      expect(result.activeMembers).toBe(0);
    });
  });

  describe('getUserCommissionStats', () => {
    it('should calculate user commission stats for month', async () => {
      // Arrange
      const commissions = [
        { amount: 100, status: 'PAID', orderId: 'order-1' },
        { amount: 50, status: 'PENDING', orderId: 'order-2' },
        { amount: 80, status: 'PAID', orderId: 'order-1' }, // Same order
        { amount: 30, status: 'PAID', orderId: 'order-3' }
      ];

      mockPrisma.commissionRecord.findMany.mockResolvedValue(commissions);

      // Act
      const result = await calculator.getUserCommissionStats('user-1', 'month');

      // Assert
      expect(result.totalCommission).toBe(260);
      expect(result.pendingCommission).toBe(50);
      expect(result.paidCommission).toBe(210);
      expect(result.orderCount).toBe(3); // Unique orders
      expect(result.averageCommission).toBeCloseTo(86.67, 2);
    });

    it('should calculate stats for different periods', async () => {
      // Arrange
      mockPrisma.commissionRecord.findMany.mockResolvedValue([]);

      // Act & Assert
      await calculator.getUserCommissionStats('user-1', 'day');
      await calculator.getUserCommissionStats('user-1', 'week');
      await calculator.getUserCommissionStats('user-1', 'month');
      await calculator.getUserCommissionStats('user-1', 'year');

      // Should not throw
      expect(true).toBe(true);
    });
  });
});