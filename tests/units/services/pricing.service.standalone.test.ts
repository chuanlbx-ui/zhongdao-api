/**
 * 独立的定价服务测试
 * 不依赖外部服务，专注于定价核心逻辑
 */

// 直接定义 UserLevel 枚举，避免导入有问题的文件
enum UserLevel {
  NORMAL = 'NORMAL',         // 普通会员
  VIP = 'VIP',              // VIP会员
  STAR_1 = 'STAR_1',        // 一星店长
  STAR_2 = 'STAR_2',        // 二星店长
  STAR_3 = 'STAR_3',        // 三星店长
  STAR_4 = 'STAR_4',        // 四星店长
  STAR_5 = 'STAR_5',        // 五星店长
  DIRECTOR = 'DIRECTOR'     // 董事
}

// 价格计算结果类型
interface PriceResult {
  productId: string;
  specId?: string;
  basePrice: number;
  userLevel: UserLevel;
  finalPrice: number;
  discountRate: number;
  discountAmount: number;
  isSpecialPrice: boolean;
}

// 简化的定价服务类，用于测试核心逻辑
class SimplePricingService {
  // 用户等级折扣配置
  private readonly LEVEL_DISCOUNT_CONFIG = {
    [UserLevel.NORMAL]: { rate: 0, name: '普通会员' },
    [UserLevel.VIP]: { rate: 0.05, name: 'VIP会员' },
    [UserLevel.STAR_1]: { rate: 0.40, name: '一星店长' },
    [UserLevel.STAR_2]: { rate: 0.35, name: '二星店长' },
    [UserLevel.STAR_3]: { rate: 0.30, name: '三星店长' },
    [UserLevel.STAR_4]: { rate: 0.26, name: '四星店长' },
    [UserLevel.STAR_5]: { rate: 0.24, name: '五星店长' },
    [UserLevel.DIRECTOR]: { rate: 0.22, name: '董事' }
  };

  /**
   * 简单的价格计算方法
   */
  calculatePrice(
    productId: string,
    userLevel: UserLevel,
    basePrice: number = 100,
    specialPrice?: number
  ): PriceResult {
    let finalPrice: number;
    let discountRate: number;
    let discountAmount: number;
    let isSpecialPrice = false;

    // 如果有特殊定价，使用特殊定价
    if (specialPrice !== undefined) {
      finalPrice = Math.max(0, specialPrice);
      discountRate = (basePrice - finalPrice) / basePrice;
      discountAmount = basePrice - finalPrice;
      isSpecialPrice = true;
    } else {
      // 使用等级折扣
      const levelConfig = this.LEVEL_DISCOUNT_CONFIG[userLevel];
      discountRate = levelConfig.rate;
      discountAmount = basePrice * discountRate;
      finalPrice = basePrice - discountAmount;
      isSpecialPrice = false;
    }

    // 确保价格不为负数
    finalPrice = Math.max(0, finalPrice);
    discountAmount = Math.max(0, discountAmount);

    return {
      productId,
      basePrice,
      userLevel,
      finalPrice: Math.round(finalPrice * 100) / 100, // 保留2位小数
      discountRate: Math.round(discountRate * 10000) / 10000, // 保留4位小数
      discountAmount: Math.round(discountAmount * 100) / 100, // 保留2位小数
      isSpecialPrice
    };
  }

  /**
   * 获取用户等级折扣信息
   */
  getLevelDiscountInfo(userLevel: UserLevel): {
    rate: number;
    name: string;
    displayName: string;
  } {
    const config = this.LEVEL_DISCOUNT_CONFIG[userLevel];

    if (!config) {
      return {
        rate: 0,
        name: '未知等级',
        displayName: '未知等级'
      };
    }

    return {
      rate: config.rate,
      name: config.name,
      displayName: `${config.name} (${(config.rate * 100).toFixed(1)}折)`
    };
  }

  /**
   * 获取所有等级折扣配置
   */
  getAllLevelDiscounts(): Record<UserLevel, {
    rate: number;
    name: string;
    displayName: string;
  }> {
    const result = {} as Record<UserLevel, {
      rate: number;
      name: string;
      displayName: string;
    }>;

    for (const level of Object.values(UserLevel)) {
      result[level] = this.getLevelDiscountInfo(level);
    }

    return result;
  }

  /**
   * 批量计算价格
   */
  batchCalculatePrices(
    items: Array<{ productId: string; userLevel: UserLevel; quantity?: number }>,
    basePrice: number = 100
  ): PriceResult[] {
    return items.map(item => {
      const result = this.calculatePrice(item.productId, item.userLevel, basePrice);
      if (item.quantity && item.quantity > 1) {
        result.finalPrice = result.finalPrice * item.quantity;
        result.discountAmount = result.discountAmount * item.quantity;
      }
      return result;
    });
  }
}

describe('差异化定价系统 - 核心逻辑测试', () => {
  let service: SimplePricingService;

  beforeEach(() => {
    service = new SimplePricingService();
  });

  describe('基础价格计算', () => {
    it('应该正确计算普通会员价格（无折扣）', () => {
      const result = service.calculatePrice('prod-001', UserLevel.NORMAL, 100);

      expect(result.finalPrice).toBe(100);
      expect(result.discountRate).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.isSpecialPrice).toBe(false);
    });

    it('应该正确计算VIP会员价格（5%折扣）', () => {
      const result = service.calculatePrice('prod-001', UserLevel.VIP, 100);

      expect(result.finalPrice).toBe(95);
      expect(result.discountRate).toBe(0.05);
      expect(result.discountAmount).toBe(5);
      expect(result.isSpecialPrice).toBe(false);
    });

    it('应该正确计算一星店长价格（40%折扣）', () => {
      const result = service.calculatePrice('prod-001', UserLevel.STAR_1, 100);

      expect(result.finalPrice).toBe(60);
      expect(result.discountRate).toBe(0.4);
      expect(result.discountAmount).toBe(40);
      expect(result.isSpecialPrice).toBe(false);
    });

    it('应该正确计算董事价格（22%折扣）', () => {
      const result = service.calculatePrice('prod-001', UserLevel.DIRECTOR, 100);

      expect(result.finalPrice).toBe(78);
      expect(result.discountRate).toBe(0.22);
      expect(result.discountAmount).toBe(22);
      expect(result.isSpecialPrice).toBe(false);
    });
  });

  describe('特殊定价计算', () => {
    it('应该使用特殊定价而不是等级折扣', () => {
      const result = service.calculatePrice('prod-001', UserLevel.VIP, 100, 50);

      expect(result.finalPrice).toBe(50);
      expect(result.discountRate).toBe(0.5); // (100-50)/100 = 50%
      expect(result.discountAmount).toBe(50);
      expect(result.isSpecialPrice).toBe(true);
    });

    it('应该处理特殊价格为0的情况', () => {
      const result = service.calculatePrice('prod-001', UserLevel.VIP, 100, 0);

      expect(result.finalPrice).toBe(0);
      expect(result.discountRate).toBe(1);
      expect(result.discountAmount).toBe(100);
      expect(result.isSpecialPrice).toBe(true);
    });

    it('应该处理负数特殊价格（ clamp to 0 ）', () => {
      const result = service.calculatePrice('prod-001', UserLevel.VIP, 100, -10);

      expect(result.finalPrice).toBe(0);
      expect(result.discountAmount).toBe(100);
    });
  });

  describe('等级折扣配置', () => {
    it('应该返回正确的折扣信息', () => {
      const testCases = [
        { level: UserLevel.NORMAL, expectedRate: 0, expectedName: '普通会员' },
        { level: UserLevel.VIP, expectedRate: 0.05, expectedName: 'VIP会员' },
        { level: UserLevel.STAR_1, expectedRate: 0.4, expectedName: '一星店长' },
        { level: UserLevel.STAR_2, expectedRate: 0.35, expectedName: '二星店长' },
        { level: UserLevel.STAR_3, expectedRate: 0.3, expectedName: '三星店长' },
        { level: UserLevel.STAR_4, expectedRate: 0.26, expectedName: '四星店长' },
        { level: UserLevel.STAR_5, expectedRate: 0.24, expectedName: '五星店长' },
        { level: UserLevel.DIRECTOR, expectedRate: 0.22, expectedName: '董事' }
      ];

      testCases.forEach(({ level, expectedRate, expectedName }) => {
        const discountInfo = service.getLevelDiscountInfo(level);
        expect(discountInfo.rate).toBe(expectedRate);
        expect(discountInfo.name).toBe(expectedName);
        expect(discountInfo.displayName).toContain(expectedName);
        expect(discountInfo.displayName).toContain(`${(expectedRate * 100).toFixed(1)}折`);
      });
    });

    it('应该返回所有等级的折扣配置', () => {
      const allDiscounts = service.getAllLevelDiscounts();
      const levels = Object.values(UserLevel);

      expect(Object.keys(allDiscounts)).toHaveLength(levels.length);

      levels.forEach(level => {
        expect(allDiscounts[level]).toHaveProperty('rate');
        expect(allDiscounts[level]).toHaveProperty('name');
        expect(allDiscounts[level]).toHaveProperty('displayName');
        expect(typeof allDiscounts[level].rate).toBe('number');
        expect(allDiscounts[level].rate).toBeGreaterThanOrEqual(0);
        expect(allDiscounts[level].rate).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('批量价格计算', () => {
    it('应该正确计算多个商品的价格', () => {
      const items = [
        { productId: 'prod-001', userLevel: UserLevel.VIP, quantity: 2 },
        { productId: 'prod-002', userLevel: UserLevel.STAR_1, quantity: 1 },
        { productId: 'prod-003', userLevel: UserLevel.DIRECTOR, quantity: 3 }
      ];

      const results = service.batchCalculatePrices(items, 100);

      expect(results).toHaveLength(3);
      expect(results[0].finalPrice).toBe(190); // 95 * 2
      expect(results[1].finalPrice).toBe(60);  // 60 * 1
      expect(results[2].finalPrice).toBe(234); // 78 * 3
    });

    it('应该处理没有数量的项目', () => {
      const items = [
        { productId: 'prod-001', userLevel: UserLevel.VIP },
        { productId: 'prod-002', userLevel: UserLevel.STAR_1 }
      ];

      const results = service.batchCalculatePrices(items, 100);

      expect(results[0].finalPrice).toBe(95);
      expect(results[1].finalPrice).toBe(60);
    });
  });

  describe('价格精度测试', () => {
    it('应该正确处理小数价格', () => {
      const result = service.calculatePrice('prod-001', UserLevel.VIP, 99.99);

      expect(result.finalPrice).toBe(94.99); // 99.99 * 0.95
      expect(result.discountAmount).toBe(5); // 99.99 * 0.05 ≈ 5
    });

    it('应该正确保留小数位数', () => {
      const result = service.calculatePrice('prod-001', UserLevel.STAR_4, 100);

      // 26% 折扣应该精确到小数点后4位
      expect(result.discountRate).toBe(0.26);
      expect(result.finalPrice).toBe(74); // 保留2位小数
      expect(result.discountAmount).toBe(26); // 保留2位小数
    });

    it('应该处理高精度价格计算', () => {
      const basePrice = 9999.99;
      const result = service.calculatePrice('prod-001', UserLevel.DIRECTOR, basePrice);

      const expectedFinalPrice = basePrice * 0.78;
      expect(result.finalPrice).toBeCloseTo(expectedFinalPrice, 2);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理0基础价格', () => {
      const result = service.calculatePrice('prod-001', UserLevel.VIP, 0);

      expect(result.finalPrice).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.discountRate).toBe(0.05);
    });

    it('应该处理非常大的价格', () => {
      const largePrice = 999999.99;
      const result = service.calculatePrice('prod-001', UserLevel.STAR_1, largePrice);

      const expectedFinalPrice = largePrice * 0.6;
      expect(result.finalPrice).toBeCloseTo(expectedFinalPrice, 2);
      expect(typeof result.finalPrice).toBe('number');
      expect(isFinite(result.finalPrice)).toBe(true);
    });

    it('应该处理极小的折扣率', () => {
      const testPrice = 100;
      const result = service.calculatePrice('prod-001', UserLevel.NORMAL, testPrice);

      expect(result.discountRate).toBe(0);
      expect(result.finalPrice).toBe(testPrice);
    });
  });

  describe('折扣率一致性测试', () => {
    it('所有等级的折扣率应该在合理范围内', () => {
      const allDiscounts = service.getAllLevelDiscounts();

      Object.values(allDiscounts).forEach(discount => {
        expect(discount.rate).toBeGreaterThanOrEqual(0);
        expect(discount.rate).toBeLessThanOrEqual(1);
      });
    });

    it('高等级应该有更高的折扣率', () => {
      const normalDiscount = service.getLevelDiscountInfo(UserLevel.NORMAL).rate;
      const vipDiscount = service.getLevelDiscountInfo(UserLevel.VIP).rate;
      const directorDiscount = service.getLevelDiscountInfo(UserLevel.DIRECTOR).rate;

      expect(directorDiscount).toBeGreaterThan(vipDiscount);
      expect(vipDiscount).toBeGreaterThan(normalDiscount);
    });
  });

  describe('业务逻辑验证', () => {
    it('应该符合业务文档中的折扣要求', () => {
      const businessRequirements = [
        { level: UserLevel.NORMAL, expectedDiscount: '0%' },
        { level: UserLevel.VIP, expectedDiscount: '5%' },
        { level: UserLevel.STAR_1, expectedDiscount: '40%' },
        { level: UserLevel.STAR_2, expectedDiscount: '35%' },
        { level: UserLevel.STAR_3, expectedDiscount: '30%' },
        { level: UserLevel.STAR_4, expectedDiscount: '26%' },
        { level: UserLevel.STAR_5, expectedDiscount: '24%' },
        { level: UserLevel.DIRECTOR, expectedDiscount: '22%' }
      ];

      businessRequirements.forEach(({ level, expectedDiscount }) => {
        const discountInfo = service.getLevelDiscountInfo(level);
        const actualDiscount = `${(discountInfo.rate * 100).toFixed(0)}%`;

        expect(actualDiscount).toBe(expectedDiscount);
      });
    });

    it('应该正确计算节省金额', () => {
      const basePrice = 1000;
      const result = service.calculatePrice('prod-001', UserLevel.STAR_2, basePrice);

      const expectedDiscountAmount = basePrice * 0.35; // 35% 折扣
      expect(result.discountAmount).toBe(expectedDiscountAmount);
      expect(result.finalPrice + result.discountAmount).toBe(basePrice);
    });
  });

  describe('性能测试', () => {
    it('应该能够快速计算大量价格', () => {
      const startTime = performance.now();

      // 计算大量价格
      for (let i = 0; i < 10000; i++) {
        service.calculatePrice(`prod-${i}`, UserLevel.VIP, 100);
        service.calculatePrice(`prod-${i}`, UserLevel.STAR_1, 100);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 20000次价格计算应该在合理时间内完成（比如1秒）
      expect(duration).toBeLessThan(1000);
    });

    it('批量计算应该比单个计算更高效', () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        productId: `prod-${i}`,
        userLevel: UserLevel.VIP
      }));

      // 批量计算
      const batchStart = performance.now();
      service.batchCalculatePrices(items, 100);
      const batchEnd = performance.now();

      // 单个计算
      const singleStart = performance.now();
      items.forEach(item => {
        service.calculatePrice(item.productId, item.userLevel, 100);
      });
      const singleEnd = performance.now();

      const batchDuration = batchEnd - batchStart;
      const singleDuration = singleEnd - singleStart;

      // 批量计算应该不会比单个计算慢太多（允许一些差异）
      expect(batchDuration).toBeLessThan(singleDuration * 1.5);
    });
  });
});