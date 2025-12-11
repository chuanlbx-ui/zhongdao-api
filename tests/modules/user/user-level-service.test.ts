import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { userLevelService, UserLevel } from '../../../src/modules/user/level.service';
import { prisma } from '../../../src/shared/database/client';
import { logger } from '../../../src/shared/utils/logger';

// Mock dependencies
vi.mock('../../../src/shared/database/client');
vi.mock('../../../src/shared/utils/logger');

const mockPrisma = prisma as any;
const mockLogger = logger as any;

describe('userLevelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLevelBenefits', () => {
    it('应该返回普通用户的权益', () => {
      // Act
      const benefits = userLevelService.getLevelBenefits(UserLevel.NORMAL);

      // Assert
      expect(benefits).toEqual({
        maxPurchaseQuantity: 5,
        commissionRate: 0.05,
        maxTeamSize: 10,
        minOrderAmount: 100,
        discountRate: 0,
        features: ['basic_purchase']
      });
    });

    it('应该返回VIP用户的权益', () => {
      // Act
      const benefits = userLevelService.getLevelBenefits(UserLevel.VIP);

      // Assert
      expect(benefits).toEqual({
        maxPurchaseQuantity: 10,
        commissionRate: 0.08,
        maxTeamSize: 50,
        minOrderAmount: 200,
        discountRate: 0.02,
        features: ['basic_purchase', 'team_management', 'commission_tracking']
      });
    });

    it('应该返回一星店长的权益', () => {
      // Act
      const benefits = userLevelService.getLevelBenefits(UserLevel.STAR_1);

      // Assert
      expect(benefits).toEqual({
        maxPurchaseQuantity: 20,
        commissionRate: 0.12,
        maxTeamSize: 100,
        minOrderAmount: 500,
        discountRate: 0.05,
        features: ['basic_purchase', 'team_management', 'commission_tracking', 'advanced_analytics']
      });
    });

    it('应该返回总监的权益', () => {
      // Act
      const benefits = userLevelService.getLevelBenefits(UserLevel.DIRECTOR);

      // Assert
      expect(benefits).toEqual({
        maxPurchaseQuantity: Infinity,
        commissionRate: 0.20,
        maxTeamSize: Infinity,
        minOrderAmount: 1000,
        discountRate: 0.15,
        features: [
          'basic_purchase',
          'team_management',
          'commission_tracking',
          'advanced_analytics',
          'regional_management',
          'custom_pricing',
          'global_analytics'
        ]
      });
    });
  });

  describe('canUpgradeTo', () => {
    it('应该正确判断升级条件 - NORMAL到VIP', () => {
      // Arrange
      const userStats = {
        totalPurchaseAmount: 10000,
        teamSize: 5,
        monthlyCommission: 500
      };

      // Act
      const canUpgrade = userLevelService.canUpgradeTo(UserLevel.NORMAL, UserLevel.VIP, userStats);

      // Assert
      expect(canUpgrade).toBe(true);
    });

    it('应该正确判断升级条件 - VIP到STAR_1', () => {
      // Arrange
      const userStats = {
        totalPurchaseAmount: 30000,
        teamSize: 20,
        monthlyCommission: 2000
      };

      // Act
      const canUpgrade = userLevelService.canUpgradeTo(UserLevel.VIP, UserLevel.STAR_1, userStats);

      // Assert
      expect(canUpgrade).toBe(true);
    });

    it('应该拒绝不满足条件的升级', () => {
      // Arrange
      const userStats = {
        totalPurchaseAmount: 5000,
        teamSize: 5,
        monthlyCommission: 200
      };

      // Act
      const canUpgrade = userLevelService.canUpgradeTo(UserLevel.NORMAL, UserLevel.VIP, userStats);

      // Assert
      expect(canUpgrade).toBe(false);
    });

    it('应该拒绝降级', () => {
      // Arrange
      const userStats = {
        totalPurchaseAmount: 100000,
        teamSize: 100,
        monthlyCommission: 10000
      };

      // Act
      const canUpgrade = userLevelService.canUpgradeTo(UserLevel.STAR_5, UserLevel.VIP, userStats);

      // Assert
      expect(canUpgrade).toBe(false);
    });
  });

  describe('getNextLevel', () => {
    it('应该返回下一等级', () => {
      expect(userLevelService.getNextLevel(UserLevel.NORMAL)).toBe(UserLevel.VIP);
      expect(userLevelService.getNextLevel(UserLevel.VIP)).toBe(UserLevel.STAR_1);
      expect(userLevelService.getNextLevel(UserLevel.STAR_1)).toBe(UserLevel.STAR_2);
      expect(userLevelService.getNextLevel(UserLevel.STAR_2)).toBe(UserLevel.STAR_3);
      expect(userLevelService.getNextLevel(UserLevel.STAR_3)).toBe(UserLevel.STAR_4);
      expect(userLevelService.getNextLevel(UserLevel.STAR_4)).toBe(UserLevel.STAR_5);
      expect(userLevelService.getNextLevel(UserLevel.STAR_5)).toBe(UserLevel.DIRECTOR);
      expect(userLevelService.getNextLevel(UserLevel.DIRECTOR)).toBeNull();
    });
  });

  describe('getLevelRequirements', () => {
    it('应该返回升级到各等级的要求', () => {
      // Act
      const normalRequirements = userLevelService.getLevelRequirements(UserLevel.NORMAL);
      const star1Requirements = userLevelService.getLevelRequirements(UserLevel.STAR_1);
      const directorRequirements = userLevelService.getLevelRequirements(UserLevel.DIRECTOR);

      // Assert
      expect(normalRequirements).toEqual({
        totalPurchaseAmount: 0,
        teamSize: 0,
        monthlyCommission: 0,
        personalOrders: 0
      });

      expect(star1Requirements).toEqual({
        totalPurchaseAmount: 20000,
        teamSize: 20,
        monthlyCommission: 1500,
        personalOrders: 10
      });

      expect(directorRequirements).toEqual({
        totalPurchaseAmount: 500000,
        teamSize: 500,
        monthlyCommission: 20000,
        personalOrders: 100
      });
    });
  });

  describe('calculateUpgradeProgress', () => {
    it('应该正确计算升级进度', () => {
      // Arrange
      const userStats = {
        totalPurchaseAmount: 15000,
        teamSize: 15,
        monthlyCommission: 1000,
        personalOrders: 8
      };

      // Act
      const progress = userLevelService.calculateUpgradeProgress(UserLevel.NORMAL, userStats);

      // Assert
      expect(progress.canUpgrade).toBe(false);
      expect(progress.requirements).toEqual({
        totalPurchaseAmount: { required: 5000, current: 15000, percentage: 100 },
        teamSize: { required: 5, current: 15, percentage: 100 },
        monthlyCommission: { required: 300, current: 1000, percentage: 100 },
        personalOrders: { required: 0, current: 8, percentage: 100 }
      });
      expect(progress.overallPercentage).toBe(100);
      expect(progress.level).toBe(UserLevel.VIP);
    });

    it('应该计算部分满足的升级进度', () => {
      // Arrange
      const userStats = {
        totalPurchaseAmount: 25000,
        teamSize: 10,
        monthlyCommission: 800,
        personalOrders: 5
      };

      // Act
      const progress = userLevelService.calculateUpgradeProgress(UserLevel.VIP, userStats);

      // Assert
      expect(progress.canUpgrade).toBe(false);
      expect(progress.overallPercentage).toBeGreaterThan(0);
      expect(progress.overallPercentage).toBeLessThan(100);
      expect(progress.level).toBe(UserLevel.STAR_1);
    });
  });

  describe('getUserLevelByPerformance', () => {
    it('应该根据业绩确定用户等级', () => {
      // Arrange
      const performance = {
        totalPurchaseAmount: 100000,
        teamSize: 50,
        monthlyCommission: 5000,
        personalOrders: 20
      };

      // Act
      const level = userLevelService.getUserLevelByPerformance(performance);

      // Assert
      expect(level).toBe(UserLevel.STAR_3);
    });

    it('应该返回最低等级对于新用户', () => {
      // Arrange
      const performance = {
        totalPurchaseAmount: 0,
        teamSize: 0,
        monthlyCommission: 0,
        personalOrders: 0
      };

      // Act
      const level = userLevelService.getUserLevelByPerformance(performance);

      // Assert
      expect(level).toBe(UserLevel.NORMAL);
    });

    it('应该返回总监等级对于顶级用户', () => {
      // Arrange
      const performance = {
        totalPurchaseAmount: 1000000,
        teamSize: 1000,
        monthlyCommission: 50000,
        personalOrders: 200
      };

      // Act
      const level = userLevelService.getUserLevelByPerformance(performance);

      // Assert
      expect(level).toBe(UserLevel.DIRECTOR);
    });
  });
});