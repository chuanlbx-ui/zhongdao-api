import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PurchaseValidator } from '@/modules/purchase/purchase-validator';
import { UserLevel } from '@/modules/user/level.service';
import { prisma } from '@/shared/database/client';
import { teamService } from '@/modules/user/team.service';

// Mock dependencies
vi.mock('@/shared/database/client');
vi.mock('@/modules/user/team.service');
vi.mock('@/shared/utils/logger');

const mockPrisma = prisma as any;

describe('PurchaseValidator', () => {
  let validator: PurchaseValidator;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new PurchaseValidator();
  });

  describe('validatePurchasePermission', () => {
    it('should validate successfully for valid purchase', async () => {
      // Arrange
      const buyer = {
        id: 'buyer-1',
        level: UserLevel.NORMAL,
        status: 'ACTIVE',
        parentId: 'seller-1',
        teamPath: '/root/seller-1/'
      };

      const seller = {
        id: 'seller-1',
        level: UserLevel.VIP,
        status: 'ACTIVE',
        parentId: 'seller-2',
        teamPath: '/root/'
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce(buyer)  // buyer
        .mockResolvedValueOnce(seller) // seller
        .mockResolvedValueOnce({ level: UserLevel.NORMAL }) // buyer for restrictions
        .mockResolvedValueOnce({ purchaseLimit: 10, minLevel: UserLevel.NORMAL }); // product

      mockPrisma.products.findUnique.mockResolvedValue({
        id: 'product-1',
        status: 'ACTIVE',
        totalStock: 100,
        productSpecs: [
          { id: 'sku-1', stock: 50, price: 100, isActive: true }
        ]
      });

      vi.mocked(teamService.validateTeamRelationship).mockResolvedValue({
        isValid: true,
        distance: 1,
        path: ['seller-1', 'buyer-1']
      });

      // Act
      const result = await validator.validatePurchasePermission(
        'buyer-1',
        'seller-1',
        'product-1',
        5
      );

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.canPurchase).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should reject when buyer does not exist', async () => {
      // Arrange
      mockPrisma.users.findUnique.mockResolvedValueOnce(null);

      // Act
      const result = await validator.validatePurchasePermission(
        'invalid-buyer',
        'seller-1',
        'product-1',
        5
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购用户不存在');
    });

    it('should reject when seller does not exist', async () => {
      // Arrange
      const buyer = {
        id: 'buyer-1',
        level: UserLevel.NORMAL,
        status: 'ACTIVE'
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce(buyer)  // buyer
        .mockResolvedValueOnce(null);  // seller

      // Act
      const result = await validator.validatePurchasePermission(
        'buyer-1',
        'invalid-seller',
        'product-1',
        5
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('销售用户不存在');
    });

    it('should reject when buyer account is not active', async () => {
      // Arrange
      const buyer = {
        id: 'buyer-1',
        level: UserLevel.NORMAL,
        status: 'INACTIVE'
      };

      const seller = {
        id: 'seller-1',
        level: UserLevel.VIP,
        status: 'ACTIVE'
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce(buyer)
        .mockResolvedValueOnce(seller);

      // Act
      const result = await validator.validatePurchasePermission(
        'buyer-1',
        'seller-1',
        'product-1',
        5
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购用户账户状态异常');
    });

    it('should reject when team relationship is invalid', async () => {
      // Arrange
      const buyer = {
        id: 'buyer-1',
        level: UserLevel.NORMAL,
        status: 'ACTIVE'
      };

      const seller = {
        id: 'seller-1',
        level: UserLevel.VIP,
        status: 'ACTIVE'
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce(buyer)
        .mockResolvedValueOnce(seller);

      vi.mocked(teamService.validateTeamRelationship).mockResolvedValue({
        isValid: false,
        distance: 0,
        path: []
      });

      // Act
      const result = await validator.validatePurchasePermission(
        'buyer-1',
        'seller-1',
        'product-1',
        5
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('采购方与销售方无有效团队关系，必须在同一团队内才能进行采购');
    });

    it('should reject when product does not exist', async () => {
      // Arrange
      const buyer = {
        id: 'buyer-1',
        level: UserLevel.NORMAL,
        status: 'ACTIVE'
      };

      const seller = {
        id: 'seller-1',
        level: UserLevel.VIP,
        status: 'ACTIVE'
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce(buyer)
        .mockResolvedValueOnce(seller);

      vi.mocked(teamService.validateTeamRelationship).mockResolvedValue({
        isValid: true,
        distance: 1,
        path: ['seller-1', 'buyer-1']
      });

      mockPrisma.products.findUnique.mockResolvedValue(null);

      // Act
      const result = await validator.validatePurchasePermission(
        'buyer-1',
        'seller-1',
        'invalid-product',
        5
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons).toContain('商品不存在');
    });

    it('should reject when insufficient stock', async () => {
      // Arrange
      const buyer = {
        id: 'buyer-1',
        level: UserLevel.NORMAL,
        status: 'ACTIVE'
      };

      const seller = {
        id: 'seller-1',
        level: UserLevel.VIP,
        status: 'ACTIVE'
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce(buyer)
        .mockResolvedValueOnce(seller)
        .mockResolvedValueOnce({ level: UserLevel.NORMAL });

      vi.mocked(teamService.validateTeamRelationship).mockResolvedValue({
        isValid: true,
        distance: 1,
        path: ['seller-1', 'buyer-1']
      });

      mockPrisma.products.findUnique.mockResolvedValue({
        id: 'product-1',
        status: 'ACTIVE',
        totalStock: 3, // Less than requested quantity
        productSpecs: [
          { id: 'sku-1', stock: 3, price: 100, isActive: true }
        ]
      });

      mockPrisma.products.findUnique.mockResolvedValueOnce({});

      // Act
      const result = await validator.validatePurchasePermission(
        'buyer-1',
        'seller-1',
        'product-1',
        5 // Request more than available
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons.some(r => r.includes('库存不足'))).toBe(true);
    });

    it('should reject when exceeding purchase limit', async () => {
      // Arrange
      const buyer = {
        id: 'buyer-1',
        level: UserLevel.NORMAL,
        status: 'ACTIVE'
      };

      const seller = {
        id: 'seller-1',
        level: UserLevel.VIP,
        status: 'ACTIVE'
      };

      mockPrisma.users.findUnique
        .mockResolvedValueOnce(buyer)  // buyer
        .mockResolvedValueOnce(seller) // seller
        .mockResolvedValueOnce({ level: UserLevel.NORMAL }); // buyer for restrictions

      vi.mocked(teamService.validateTeamRelationship).mockResolvedValue({
        isValid: true,
        distance: 1,
        path: ['seller-1', 'buyer-1']
      });

      mockPrisma.products.findUnique.mockResolvedValue({
        id: 'product-1',
        status: 'ACTIVE',
        totalStock: 100,
        productSpecs: [
          { id: 'sku-1', stock: 50, price: 100, isActive: true }
        ]
      });

      // Mock product with purchase limit
      mockPrisma.products.findUnique.mockResolvedValueOnce({
        purchaseLimit: 3, // Limit is less than requested quantity
        minLevel: UserLevel.NORMAL
      });

      // Act
      const result = await validator.validatePurchasePermission(
        'buyer-1',
        'seller-1',
        'product-1',
        5 // Exceeds limit
      );

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.canPurchase).toBe(false);
      expect(result.reasons.some(r => r.includes('超过单次采购限制'))).toBe(true);
    });
  });

  describe('getPerformanceStats', () => {
    it('should return performance statistics', () => {
      // Act
      const stats = validator.getPerformanceStats();

      // Assert
      expect(stats).toHaveProperty('totalValidations');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('cacheSize');
    });
  });
});