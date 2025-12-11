import { logger } from '@/shared/utils/logger';
import { prisma } from '@/shared/database/client';
import { UserLevel, UserLevelService } from '../user/level.service';

// 价格计算结果类型
export interface PriceResult {
  productId: string;
  specId?: string;
  basePrice: number;
  userLevel: UserLevel;
  finalPrice: number;
  discountRate: number;
  discountAmount: number;
  isSpecialPrice: boolean;
}

// 批量价格计算参数
export interface BatchPriceCalculationParams {
  items: Array<{
    productId: string;
    specId?: string;
    quantity?: number;
  }>;
  userLevel: UserLevel;
}

// 价格更新参数
export interface PriceUpdateParams {
  productId: string;
  specId?: string;
  userLevel: UserLevel;
  price: number;
  isSpecialPrice?: boolean;
}

// 批量价格更新参数
export interface BatchPriceUpdateParams {
  updates: PriceUpdateParams[];
  updatedBy?: string;
}

// 特殊定价规则
export interface SpecialPricingRule {
  id: string;
  productId: string;
  specId?: string;
  userLevel: UserLevel;
  ruleType: 'FIXED_PRICE' | 'DISCOUNT_RATE' | 'DISCOUNT_AMOUNT';
  ruleValue: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  maxQuantity?: number;
  description?: string;
}

// 价格缓存接口
interface PriceCache {
  data: Map<string, PriceResult>;
  timestamps: Map<string, number>;
  ttl: number; // 缓存时间(毫秒)
}

/**
 * 差异化定价服务
 * 根据用户等级实现商品的差异化定价策略
 */
export class PricingService {
  private cache: PriceCache;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 默认缓存5分钟
  private readonly userLevelService: UserLevelService;

  // 用户等级折扣配置 - 根据需求文档的折扣体系
  private readonly LEVEL_DISCOUNT_CONFIG = {
    [UserLevel.NORMAL]: { rate: 0, name: '普通会员' },      // 无折扣
    [UserLevel.VIP]: { rate: 0.05, name: 'VIP会员' },       // 5%折扣
    [UserLevel.STAR_1]: { rate: 0.40, name: '一星店长' },   // 40%折扣
    [UserLevel.STAR_2]: { rate: 0.35, name: '二星店长' },   // 35%折扣
    [UserLevel.STAR_3]: { rate: 0.30, name: '三星店长' },   // 30%折扣
    [UserLevel.STAR_4]: { rate: 0.26, name: '四星店长' },   // 26%折扣
    [UserLevel.STAR_5]: { rate: 0.24, name: '五星店长' },   // 24%折扣
    [UserLevel.DIRECTOR]: { rate: 0.22, name: '董事' }      // 22%折扣
  };

  constructor() {
    this.cache = {
      data: new Map(),
      timestamps: new Map(),
      ttl: this.DEFAULT_TTL
    };
    this.userLevelService = new UserLevelService();
  }

  /**
   * 核心方法：计算商品价格
   * @param productId 商品ID
   * @param userLevel 用户等级
   * @param specId 规格ID（可选）
   * @returns 价格计算结果
   */
  async calculatePrice(
    productId: string,
    userLevel: UserLevel,
    specId?: string
  ): Promise<PriceResult> {
    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey(productId, userLevel, specId);

      // 检查缓存
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // 获取商品基础信息
      const productData = await this.getProductWithPricing(productId, specId);
      if (!productData) {
        throw new Error(`商品不存在: ${productId}`);
      }

      // 获取基础价格
      const basePrice = specId ?
        (productData.productSpecs?.find(spec => spec.id === specId)?.price || productData.basePrice) :
        productData.basePrice;

      // 查找特殊定价
      const specialPricing = await this.getSpecialPricing(productId, userLevel, specId);

      // 计算最终价格
      const priceResult = await this.computeFinalPrice(
        productId,
        basePrice,
        userLevel,
        specialPricing,
        specId
      );

      // 缓存结果
      this.setCache(cacheKey, priceResult);

      return priceResult;
    } catch (error) {
      logger.error('价格计算失败', {
        productId,
        userLevel,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 批量计算商品价格
   * @param params 批量计算参数
   * @returns 价格结果数组
   */
  async batchCalculatePrices(
    params: BatchPriceCalculationParams
  ): Promise<PriceResult[]> {
    try {
      const results: PriceResult[] = [];

      // 批量获取商品信息
      const productIds = [...new Set(params.items.map(item => item.productId))];
      const products = await prisma.products.findMany({
        where: { id: { in: productIds } },
        include: {
          productSpecs: true,
          productPricings: {
            where: {
              userLevel: params.userLevel
            }
          }
        }
      });

      const productMap = new Map(products.map(p => [p.id, p]));

      // 批量计算价格
      for (const item of params.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          logger.warn('商品不存在，跳过计算', { productId: item.productId });
          continue;
        }

        try {
          const priceResult = await this.calculatePrice(
            item.productId,
            params.userLevel,
            item.specId
          );

          // 如果有数量，计算总价
          if (item.quantity && item.quantity > 1) {
            priceResult.finalPrice = priceResult.finalPrice * item.quantity;
            priceResult.discountAmount = priceResult.discountAmount * item.quantity;
          }

          results.push(priceResult);
        } catch (error) {
          logger.error('批量价格计算失败', {
            productId: item.productId,
            specId: item.specId,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('批量价格计算失败', {
        userLevel: params.userLevel,
        itemCount: params.items.length,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 更新商品定价
   * @param params 价格更新参数
   * @returns 更新结果
   */
  async updateProductPricing(params: PriceUpdateParams): Promise<{
    success: boolean;
    message: string;
    pricing?: any;
  }> {
    try {
      // 验证商品存在
      const product = await prisma.products.findUnique({
        where: { id: params.productId }
      });

      if (!product) {
        return {
          success: false,
          message: `商品不存在: ${params.productId}`
        };
      }

      // 如果有规格ID，验证规格存在
      if (params.specId) {
        const spec = await prisma.productSpecs.findUnique({
          where: { id: params.specId }
        });

        if (!spec || spec.productId !== params.productId) {
          return {
            success: false,
            message: `商品规格不存在: ${params.specId}`
          };
        }
      }

      // 使用 upsert 更新或创建定价记录
      const pricing = await prisma.productPricings.upsert({
        where: {
          productId_specId_userLevel: {
            productId: params.productId,
            specId: params.specId || null,
            userLevel: params.userLevel
          }
        },
        update: {
          price: params.price
        },
        create: {
          productId: params.productId,
          specId: params.specId,
          userLevel: params.userLevel,
          price: params.price
        }
      });

      // 清除相关缓存
      this.clearCacheForProduct(params.productId);

      logger.info('商品定价更新成功', {
        productId: params.productId,
        specId: params.specId,
        userLevel: params.userLevel,
        price: params.price
      });

      return {
        success: true,
        message: '定价更新成功',
        pricing
      };
    } catch (error) {
      logger.error('更新商品定价失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        message: '定价更新失败'
      };
    }
  }

  /**
   * 批量更新商品定价
   * @param params 批量更新参数
   * @returns 批量更新结果
   */
  async batchUpdateProductPricing(
    params: BatchPriceUpdateParams
  ): Promise<{
    successCount: number;
    failCount: number;
    results: Array<{
      productId: string;
      specId?: string;
      userLevel: UserLevel;
      success: boolean;
      message: string;
    }>;
  }> {
    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const update of params.updates) {
      try {
        const result = await this.updateProductPricing(update);
        results.push({
          productId: update.productId,
          specId: update.specId,
          userLevel: update.userLevel,
          success: result.success,
          message: result.message
        });

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        results.push({
          productId: update.productId,
          specId: update.specId,
          userLevel: update.userLevel,
          success: false,
          message: error instanceof Error ? error.message : '未知错误'
        });
        failCount++;
      }
    }

    logger.info('批量更新商品定价完成', {
      totalUpdates: params.updates.length,
      successCount,
      failCount,
      updatedBy: params.updatedBy
    });

    return {
      successCount,
      failCount,
      results
    };
  }

  /**
   * 根据用户ID获取商品价格（便捷方法）
   * @param productId 商品ID
   * @param userId 用户ID
   * @param specId 规格ID（可选）
   * @returns 价格计算结果
   */
  async calculatePriceForUser(
    productId: string,
    userId: string,
    specId?: string
  ): Promise<PriceResult> {
    try {
      const userLevel = await this.userLevelService.getUserLevel(userId);
      return await this.calculatePrice(productId, userLevel, specId);
    } catch (error) {
      logger.error('根据用户ID计算价格失败', {
        productId,
        userId,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取商品的所有等级定价
   * @param productId 商品ID
   * @param specId 规格ID（可选）
   * @returns 所有等级的价格信息
   */
  async getProductPricingForAllLevels(
    productId: string,
    specId?: string
  ): Promise<PriceResult[]> {
    try {
      const results: PriceResult[] = [];
      const levels = Object.values(UserLevel);

      for (const level of levels) {
        try {
          const priceResult = await this.calculatePrice(productId, level, specId);
          results.push(priceResult);
        } catch (error) {
          logger.warn('计算特定等级价格失败', {
            productId,
            userLevel: level,
            specId,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('获取商品所有等级定价失败', {
        productId,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 删除商品定价
   * @param productId 商品ID
   * @param userLevel 用户等级
   * @param specId 规格ID（可选）
   * @returns 删除结果
   */
  async deleteProductPricing(
    productId: string,
    userLevel: UserLevel,
    specId?: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const deleteResult = await prisma.productPricings.deleteMany({
        where: {
          productId,
          specId: specId || null,
          userLevel
        }
      });

      // 清除相关缓存
      this.clearCacheForProduct(productId);

      logger.info('商品定价删除成功', {
        productId,
        userLevel,
        specId,
        deletedCount: deleteResult.count
      });

      return {
        success: true,
        message: `成功删除 ${deleteResult.count} 条定价记录`
      };
    } catch (error) {
      logger.error('删除商品定价失败', {
        productId,
        userLevel,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        message: '删除定价失败'
      };
    }
  }

  /**
   * 获取用户等级折扣信息
   * @param userLevel 用户等级
   * @returns 折扣信息
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
   * @returns 所有等级的折扣配置
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

  // ==================== 私有方法 ====================

  /**
   * 获取商品及定价信息
   */
  private async getProductWithPricing(productId: string, specId?: string) {
    return await prisma.products.findUnique({
      where: { id: productId },
      include: {
        productSpecs: specId ? {
          where: { id: specId }
        } : true,
        productPricings: {
          where: {
            specId: specId || null
          }
        }
      }
    });
  }

  /**
   * 获取特殊定价
   */
  private async getSpecialPricing(
    productId: string,
    userLevel: UserLevel,
    specId?: string
  ) {
    return await prisma.productPricings.findFirst({
      where: {
        productId,
        userLevel,
        specId: specId || null
      }
    });
  }

  /**
   * 计算最终价格
   */
  private async computeFinalPrice(
    productId: string,
    basePrice: number,
    userLevel: UserLevel,
    specialPricing: any,
    specId?: string
  ): Promise<PriceResult> {
    let finalPrice: number;
    let discountRate: number;
    let discountAmount: number;
    let isSpecialPrice = false;

    // 如果有特殊定价，使用特殊定价
    if (specialPricing) {
      finalPrice = specialPricing.price;
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
      specId,
      basePrice,
      userLevel,
      finalPrice: Math.round(finalPrice * 100) / 100, // 保留2位小数
      discountRate: Math.round(discountRate * 10000) / 10000, // 保留4位小数
      discountAmount: Math.round(discountAmount * 100) / 100, // 保留2位小数
      isSpecialPrice
    };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    productId: string,
    userLevel: UserLevel,
    specId?: string
  ): string {
    return `price:${productId}:${userLevel}${specId ? `:${specId}` : ''}`;
  }

  /**
   * 从缓存获取结果
   */
  private getFromCache(cacheKey: string): PriceResult | null {
    const timestamp = this.cache.timestamps.get(cacheKey);
    const cached = this.cache.data.get(cacheKey);

    if (!cached || !timestamp) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() - timestamp > this.cache.ttl) {
      this.cache.data.delete(cacheKey);
      this.cache.timestamps.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * 设置缓存
   */
  private setCache(cacheKey: string, result: PriceResult): void {
    this.cache.data.set(cacheKey, result);
    this.cache.timestamps.set(cacheKey, Date.now());
  }

  /**
   * 清除商品相关缓存
   */
  private clearCacheForProduct(productId: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.data.keys()) {
      if (key.includes(`price:${productId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.data.delete(key);
      this.cache.timestamps.delete(key);
    });
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    this.cache.data.clear();
    this.cache.timestamps.clear();
  }

  /**
   * 设置缓存TTL
   */
  setCacheTTL(ttl: number): void {
    this.cache.ttl = ttl;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    hitRate?: number;
    ttl: number;
  } {
    return {
      size: this.cache.data.size,
      ttl: this.cache.ttl
    };
  }
}

// 导出单例实例
export const pricingService = new PricingService();