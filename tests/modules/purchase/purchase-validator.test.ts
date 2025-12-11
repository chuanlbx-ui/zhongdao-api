import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { PurchaseValidator } from '../../../src/modules/purchase/purchase-validator';
import { prisma } from '../../../src/shared/database/client';
import { userLevelService } from '../../../src/modules/user/level.service';
import { teamService } from '../../../src/modules/user/team.service';
import { UserLevel } from '../../../src/modules/user/level.service';
import { logger } from '../../../src/shared/utils/logger';
import type {
  PurchaseValidationResult,
  UserForValidation,
  TeamRelationshipResult,
  LevelComparisonResult
} from '../../../src/modules/purchase/types';

// Mock dependencies
vi.mock('../../../src/shared/database/client');
vi.mock('../../../src/modules/user/level.service');
vi.mock('../../../src/modules/user/team.service');
vi.mock('../../../src/shared/utils/logger');

const mockPrisma = prisma as any;
const mockUserLevelService = userLevelService as any;
const mockTeamService = teamService as any;
const mockLogger = logger as any;

describe('PurchaseValidator', () => {
  let purchaseValidator: PurchaseValidator;
  let testBuyer: UserForValidation;
  let testSeller: UserForValidation;
  let testProductId: string;
  let testQuantity: number;

  beforeEach(() => {
    purchaseValidator = new PurchaseValidator();

    // Setup test data
    testBuyer = {
      id: 'buyer-001',
      level: UserLevel.NORMAL,
      status: 'ACTIVE',
      parentId: 'parent-001',
      teamPath: '/root/parent-001/buyer-001'
    };

    testSeller = {
      id: 'seller-001',
      level: UserLevel.STAR_1,
      status: 'ACTIVE',
      parentId: 'parent-001',
      teamPath: '/root/parent-001/seller-001'
    };

    testProductId = 'product-001';
    testQuantity = 3;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('validatePurchasePermission', () => {
    it('应该成功验证有效的采购权限', async () => {
      // Arrange
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      mockPrisma.products.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: testProductId,
          status: 'ACTIVE',
          totalStock: 100,
          productSpecs: [
            { id: 'spec-001', stock: 50, price: 100, isActive: true }
          ]
        })
        .mockResolvedValueOnce({
          purchaseLimit: 10,
          minLevel: UserLevel.NORMAL
        });

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValue({ level: UserLevel.NORMAL });

      mockUserLevelService.getLevelBenefits = vi.fn()
        .mockReturnValue({ maxPurchaseQuantity: 5 });

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.canPurchase).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.metadata?.buyerLevel).toBe(UserLevel.NORMAL);
      expect(result.metadata?.sellerLevel).toBe(UserLevel.STAR_1);
    });

    it('应该拒绝不存在的采购用户', async () => {
      // Arrange
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(null)  // Buyer not found
        .mockResolvedValueOnce(testSeller);

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        'invalid-buyer',
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购用户不存在');
    });

    it('应该拒绝不存在的销售用户', async () => {
      // Arrange
      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(null);  // Seller not found

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        'invalid-seller',
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('销售用户不存在');
    });

    it('应该拒绝非活跃状态的账户', async () => {
      // Arrange
      const inactiveBuyer = { ...testBuyer, status: 'SUSPENDED' };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(inactiveBuyer)
        .mockResolvedValueOnce(testSeller);

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购用户账户状态异常');
    });

    it('应该拒绝无效的团队关系', async () => {
      // Arrange
      const invalidTeamRelationship: TeamRelationshipResult = {
        isValid: false,
        distance: -1,
        path: [],
        relationshipType: 'none'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(invalidTeamRelationship);

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购方与销售方无有效团队关系，必须在同一团队内才能进行采购');
    });

    it('应该拒绝平级或更低的销售方等级', async () => {
      // Arrange
      const sameLevelSeller = { ...testSeller, level: UserLevel.NORMAL };
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(sameLevelSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购方等级(NORMAL)高于或等于销售方等级(NORMAL)，违反采购规则');
    });

    it('应该拒绝不存在的商品', async () => {
      // Arrange
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      mockPrisma.products.findUnique = vi.fn()
        .mockResolvedValueOnce(null);  // Product not found

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('商品不存在');
    });

    it('应该拒绝下架的商品', async () => {
      // Arrange
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      mockPrisma.products.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: testProductId,
          status: 'INACTIVE',
          totalStock: 100,
          productSpecs: [
            { id: 'spec-001', stock: 50, price: 100, isActive: true }
          ]
        });

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('商品已下架');
    });

    it('应该拒绝库存不足的商品', async () => {
      // Arrange
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      mockPrisma.products.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: testProductId,
          status: 'ACTIVE',
          totalStock: 2,  // Less than requested quantity
          productSpecs: [
            { id: 'spec-001', stock: 2, price: 100, isActive: true }
          ]
        });

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('库存不足，当前总库存：2，需要：3');
    });

    it('应该拒绝超过采购限制的数量', async () => {
      // Arrange
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      mockPrisma.products.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: testProductId,
          status: 'ACTIVE',
          totalStock: 100,
          productSpecs: [
            { id: 'spec-001', stock: 50, price: 100, isActive: true }
          ]
        })
        .mockResolvedValueOnce({
          purchaseLimit: 2,  // Less than requested quantity
          minLevel: UserLevel.NORMAL
        });

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValue({ level: UserLevel.NORMAL });

      mockUserLevelService.getLevelBenefits = vi.fn()
        .mockReturnValue({ maxPurchaseQuantity: 5 });

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('超过单次采购限制，最大可采购：2，当前：3');
    });

    it('应该拒绝等级不足的用户', async () => {
      // Arrange
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      mockPrisma.products.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: testProductId,
          status: 'ACTIVE',
          totalStock: 100,
          productSpecs: [
            { id: 'spec-001', stock: 50, price: 100, isActive: true }
          ]
        })
        .mockResolvedValueOnce({
          purchaseLimit: 10,
          minLevel: UserLevel.VIP  // Higher than buyer's level
        });

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValue({ level: UserLevel.NORMAL });

      mockUserLevelService.getLevelBenefits = vi.fn()
        .mockReturnValue({ maxPurchaseQuantity: 5 });

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('用户等级不足，最低要求：VIP，当前：NORMAL');
    });

    it('应该处理系统错误并返回适当的错误信息', async () => {
      // Arrange
      const databaseError = new Error('Database connection failed');
      mockPrisma.users.findUnique = vi.fn()
        .mockRejectedValueOnce(databaseError);

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('验证过程中发生系统错误');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '验证采购权限失败',
        expect.objectContaining({
          buyerId: testBuyer.id,
          sellerId: testSeller.id,
          productId: testProductId,
          quantity: testQuantity,
          error: 'Database connection failed'
        })
      );
    });

    it('应该返回包含性能信息的元数据', async () => {
      // Arrange
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      mockPrisma.products.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: testProductId,
          status: 'ACTIVE',
          totalStock: 100,
          productSpecs: [
            { id: 'spec-001', stock: 50, price: 100, isActive: true }
          ]
        })
        .mockResolvedValueOnce({
          purchaseLimit: 10,
          minLevel: UserLevel.NORMAL
        });

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValue({ level: UserLevel.NORMAL });

      mockUserLevelService.getLevelBenefits = vi.fn()
        .mockReturnValue({ maxPurchaseQuantity: 5 });

      // Act
      const result = await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      // Assert
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.performance).toBeDefined();
      expect(result.metadata?.performance.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.performance.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPerformanceStats', () => {
    it('应该返回初始性能统计', () => {
      // Act
      const stats = purchaseValidator.getPerformanceStats();

      // Assert
      expect(stats).toEqual({
        totalValidations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        cacheSize: {
          user: 0,
          product: 0,
          uplineChain: 0
        }
      });
    });

    it('应该在执行验证后更新性能统计', async () => {
      // Arrange
      const teamRelationship: TeamRelationshipResult = {
        isValid: true,
        distance: 2,
        path: ['parent-001', 'seller-001'],
        relationshipType: 'upline'
      };

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValueOnce(testBuyer)
        .mockResolvedValueOnce(testSeller);

      mockTeamService.validateTeamRelationship = vi.fn()
        .mockResolvedValue(teamRelationship);

      mockPrisma.products.findUnique = vi.fn()
        .mockResolvedValueOnce({
          id: testProductId,
          status: 'ACTIVE',
          totalStock: 100,
          productSpecs: [
            { id: 'spec-001', stock: 50, price: 100, isActive: true }
          ]
        })
        .mockResolvedValueOnce({
          purchaseLimit: 10,
          minLevel: UserLevel.NORMAL
        });

      mockPrisma.users.findUnique = vi.fn()
        .mockResolvedValue({ level: UserLevel.NORMAL });

      mockUserLevelService.getLevelBenefits = vi.fn()
        .mockReturnValue({ maxPurchaseQuantity: 5 });

      // Act
      await purchaseValidator.validatePurchasePermission(
        testBuyer.id,
        testSeller.id,
        testProductId,
        testQuantity
      );

      const stats = purchaseValidator.getPerformanceStats();

      // Assert
      expect(stats.totalValidations).toBe(1);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    });
  });
});