import { PricingService, pricingService } from '../../../src/modules/products/pricing.service';
import { UserLevel } from '../../../src/modules/user/level.service';
import { prisma } from '../../../src/shared/database/client';

// Mock prisma
jest.mock('../../../src/shared/database/client', () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    productSpec: {
      findUnique: jest.fn(),
    },
    productPricing: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
    jest.clearAllMocks();
  });

  describe('calculatePrice', () => {
    it('should calculate price with level discount correctly', async () => {
      // Mock data
      const mockProduct = {
        id: 'product-1',
        name: '测试商品',
        basePrice: 100,
        specs: [],
        pricings: []
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(null);

      // Test VIP level (5% discount)
      const result = await service.calculatePrice('product-1', UserLevel.VIP);

      expect(result).toEqual({
        productId: 'product-1',
        specId: undefined,
        basePrice: 100,
        userLevel: UserLevel.VIP,
        finalPrice: 95,
        discountRate: 0.05,
        discountAmount: 5,
        isSpecialPrice: false
      });
    });

    it('should calculate price with special pricing when exists', async () => {
      // Mock data
      const mockProduct = {
        id: 'product-1',
        name: '测试商品',
        basePrice: 100,
        specs: [],
        pricings: []
      };

      const mockSpecialPricing = {
        id: 'pricing-1',
        productId: 'product-1',
        userLevel: UserLevel.STAR_1,
        price: 30 // 特殊价格，而不是使用等级折扣
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(mockSpecialPricing);

      // Test with special pricing
      const result = await service.calculatePrice('product-1', UserLevel.STAR_1);

      expect(result).toEqual({
        productId: 'product-1',
        specId: undefined,
        basePrice: 100,
        userLevel: UserLevel.STAR_1,
        finalPrice: 30,
        discountRate: 0.7,
        discountAmount: 70,
        isSpecialPrice: true
      });
    });

    it('should handle product not found error', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.calculatePrice('non-existent-product', UserLevel.NORMAL)
      ).rejects.toThrow('商品不存在: non-existent-product');
    });

    it('should calculate different discount rates for different levels', async () => {
      const mockProduct = {
        id: 'product-1',
        name: '测试商品',
        basePrice: 100,
        specs: [],
        pricings: []
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(null);

      // Test different levels
      const testCases = [
        { level: UserLevel.NORMAL, expectedFinalPrice: 100, expectedDiscountRate: 0 },
        { level: UserLevel.VIP, expectedFinalPrice: 95, expectedDiscountRate: 0.05 },
        { level: UserLevel.STAR_1, expectedFinalPrice: 60, expectedDiscountRate: 0.4 },
        { level: UserLevel.STAR_2, expectedFinalPrice: 65, expectedDiscountRate: 0.35 },
        { level: UserLevel.STAR_3, expectedFinalPrice: 70, expectedDiscountRate: 0.3 },
        { level: UserLevel.STAR_4, expectedFinalPrice: 74, expectedDiscountRate: 0.26 },
        { level: UserLevel.STAR_5, expectedFinalPrice: 76, expectedDiscountRate: 0.24 },
        { level: UserLevel.DIRECTOR, expectedFinalPrice: 78, expectedDiscountRate: 0.22 }
      ];

      for (const testCase of testCases) {
        const result = await service.calculatePrice('product-1', testCase.level);
        expect(result.finalPrice).toBe(testCase.expectedFinalPrice);
        expect(result.discountRate).toBe(testCase.expectedDiscountRate);
      }
    });
  });

  describe('getLevelDiscountInfo', () => {
    it('should return correct discount info for each level', () => {
      const testCases = [
        { level: UserLevel.NORMAL, expectedRate: 0, expectedName: '普通会员' },
        { level: UserLevel.VIP, expectedRate: 0.05, expectedName: 'VIP会员' },
        { level: UserLevel.STAR_1, expectedRate: 0.4, expectedName: '一星店长' },
        { level: UserLevel.DIRECTOR, expectedRate: 0.22, expectedName: '董事' }
      ];

      for (const testCase of testCases) {
        const info = service.getLevelDiscountInfo(testCase.level);
        expect(info.rate).toBe(testCase.expectedRate);
        expect(info.name).toBe(testCase.expectedName);
        expect(info.displayName).toContain(testCase.expectedName);
      }
    });
  });

  describe('getAllLevelDiscounts', () => {
    it('should return all level discounts', () => {
      const allDiscounts = service.getAllLevelDiscounts();
      const levels = Object.values(UserLevel);

      expect(Object.keys(allDiscounts)).toHaveLength(levels.length);

      for (const level of levels) {
        expect(allDiscounts[level]).toHaveProperty('rate');
        expect(allDiscounts[level]).toHaveProperty('name');
        expect(allDiscounts[level]).toHaveProperty('displayName');
      }
    });
  });

  describe('batchCalculatePrices', () => {
    it('should calculate prices for multiple products', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          name: '商品1',
          basePrice: 100,
          specs: [],
          pricings: []
        },
        {
          id: 'product-2',
          name: '商品2',
          basePrice: 200,
          specs: [],
          pricings: []
        }
      ];

      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(null);

      const params = {
        items: [
          { productId: 'product-1', quantity: 2 },
          { productId: 'product-2', quantity: 1 }
        ],
        userLevel: UserLevel.VIP
      };

      const results = await service.batchCalculatePrices(params);

      expect(results).toHaveLength(2);
      expect(results[0].finalPrice).toBe(190); // 95 * 2
      expect(results[1].finalPrice).toBe(190); // 200 * 0.95
    });
  });

  describe('updateProductPricing', () => {
    it('should update product pricing successfully', async () => {
      const mockProduct = { id: 'product-1', name: '测试商品' };
      const mockPricing = {
        id: 'pricing-1',
        productId: 'product-1',
        userLevel: UserLevel.VIP,
        price: 80
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.upsert as jest.Mock).mockResolvedValue(mockPricing);

      const result = await service.updateProductPricing({
        productId: 'product-1',
        userLevel: UserLevel.VIP,
        price: 80
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('定价更新成功');
      expect(result.pricing).toBe(mockPricing);
    });

    it('should handle product not found when updating', async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.updateProductPricing({
        productId: 'non-existent',
        userLevel: UserLevel.VIP,
        price: 80
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('商品不存在');
    });
  });

  describe('cache functionality', () => {
    it('should cache price calculation results', async () => {
      const mockProduct = {
        id: 'product-1',
        name: '测试商品',
        basePrice: 100,
        specs: [],
        pricings: []
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(null);

      // First call - should hit database
      await service.calculatePrice('product-1', UserLevel.VIP);
      expect(prisma.product.findUnique).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.calculatePrice('product-1', UserLevel.VIP);
      expect(prisma.product.findUnique).toHaveBeenCalledTimes(1); // Still only called once
    });

    it('should clear cache for product when pricing is updated', async () => {
      const mockProduct = { id: 'product-1', name: '测试商品' };
      const mockPricing = {
        id: 'pricing-1',
        productId: 'product-1',
        userLevel: UserLevel.VIP,
        price: 80
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.upsert as jest.Mock).mockResolvedValue(mockPricing);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(null);

      // Calculate price to populate cache
      await service.calculatePrice('product-1', UserLevel.VIP);

      // Update pricing - should clear cache
      await service.updateProductPricing({
        productId: 'product-1',
        userLevel: UserLevel.VIP,
        price: 80
      });

      // Calculate price again - should hit database again due to cache clear
      await service.calculatePrice('product-1', UserLevel.VIP);
      expect(prisma.product.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle zero base price', async () => {
      const mockProduct = {
        id: 'product-1',
        name: '测试商品',
        basePrice: 0,
        specs: [],
        pricings: []
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.calculatePrice('product-1', UserLevel.VIP);
      expect(result.finalPrice).toBe(0);
      expect(result.discountAmount).toBe(0);
    });

    it('should handle negative special pricing (should be clamped to 0)', async () => {
      const mockProduct = {
        id: 'product-1',
        name: '测试商品',
        basePrice: 100,
        specs: [],
        pricings: []
      };

      const mockSpecialPricing = {
        id: 'pricing-1',
        productId: 'product-1',
        userLevel: UserLevel.VIP,
        price: -10 // Negative price
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(mockSpecialPricing);

      const result = await service.calculatePrice('product-1', UserLevel.VIP);
      expect(result.finalPrice).toBe(0); // Should be clamped to 0
      expect(result.discountAmount).toBe(100);
    });

    it('should handle very large prices', async () => {
      const mockProduct = {
        id: 'product-1',
        name: '测试商品',
        basePrice: 999999.99,
        specs: [],
        pricings: []
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.productPricing.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.calculatePrice('product-1', UserLevel.DIRECTOR);
      expect(result.finalPrice).toBe(779999.99); // 999999.99 * 0.78
      expect(typeof result.finalPrice).toBe('number');
    });
  });
});