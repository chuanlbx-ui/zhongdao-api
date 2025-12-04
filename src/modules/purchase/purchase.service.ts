// @ts-nocheck
import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { UserLevel, userLevelService } from '../user/level.service';
import { teamService } from '../user/team.service';

// 缓存配置
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const MAX_CACHE_SIZE = 1000; // 最大缓存条目数

// 简单的内存缓存实现
class MemoryCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();

  set(key: string, value: T): void {
    // 如果缓存满了，删除最旧的条目
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + CACHE_TTL
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  size(): number {
    return this.cache.size;
  }
}

// 采购订单状态
export enum PurchaseStatus {
  PENDING = 'PENDING',         // 待处理
  CONFIRMED = 'CONFIRMED',     // 已确认
  PROCESSING = 'PROCESSING',   // 处理中
  COMPLETED = 'COMPLETED',     // 已完成
  CANCELLED = 'CANCELLED',     // 已取消
  REFUNDED = 'REFUNDED'        // 已退款
}

// 采购订单接口
export interface PurchaseOrder {
  id: string;
  orderNo: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  skuId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  totalBottles: number;
  status: PurchaseStatus;
  paymentStatus: string;
  shippingAddress?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// 采购创建参数
export interface CreatePurchaseParams {
  buyerId: string;
  sellerId: string;
  productId: string;
  skuId: string;
  quantity: number;
  shippingAddress?: string;
  notes?: string;
}

// 采购验证结果
export interface PurchaseValidationResult {
  isValid: boolean;
  canPurchase: boolean;
  reasons: string[];
  restrictions?: {
    maxQuantity?: number;
    minLevel?: UserLevel;
    requiredTeamSize?: number;
  };
  metadata?: {
    buyerLevel?: UserLevel;
    sellerLevel?: UserLevel;
    teamRelationship?: any;
    levelComparison?: any;
    performance?: {
      responseTime: number;
      cacheHitRate: number;
    };
  };
}

// 采购服务类
export class PurchaseService {
  // 缓存实例
  private userCache = new MemoryCache<any>();
  private productCache = new MemoryCache<any>();
  private uplineChainCache = new MemoryCache<any[]>();

  // 性能监控
  private performanceStats = {
    totalValidations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageResponseTime: 0
  };
  // 生成采购订单号
  private generateOrderNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PO${timestamp}${random}`.toUpperCase();
  }

  /**
   * 验证采购权限 - 核心业务逻辑（性能优化版）
   * 规则：用户只能向更高级别且非平级的上级进货
   * @param buyerId 采购方ID
   * @param sellerId 销售方ID
   * @param productId 商品ID
   * @param quantity 采购数量
   * @returns 验证结果
   */
  async validatePurchasePermission(
    buyerId: string,
    sellerId: string,
    productId: string,
    quantity: number
  ): Promise<PurchaseValidationResult> {
    const startTime = Date.now();
    this.performanceStats.totalValidations++;

    try {
      const reasons: string[] = [];
      let canPurchase = true;

      // 1. 基础验证：用户存在性检查（带缓存）
      const [buyer, seller] = await Promise.all([
        this.getUserWithCache(buyerId),
        this.getUserWithCache(sellerId)
      ]);

      if (!buyer) {
        return {
          isValid: false,
          canPurchase: false,
          reasons: ['采购用户不存在']
        };
      }

      if (!seller) {
        return {
          isValid: false,
          canPurchase: false,
          reasons: ['销售用户不存在']
        };
      }

      // 2. 账户状态验证
      if (buyer.status !== 'ACTIVE') {
        reasons.push('采购用户账户状态异常');
        canPurchase = false;
      }

      if (seller.status !== 'ACTIVE') {
        reasons.push('销售用户账户状态异常');
        canPurchase = false;
      }

      // 3. 核心业务规则：团队关系和等级验证
      const levelValidation = await this.validateLevelAndTeamRelationship(buyer, seller);
      if (!levelValidation.isValid) {
        reasons.push(...levelValidation.reasons);
        canPurchase = false;
      }

      // 4. 产品和库存验证（带缓存）
      const productValidation = await this.validateProductAndStockWithCache(productId, quantity);
      if (!productValidation.isValid) {
        reasons.push(...productValidation.reasons);
        canPurchase = false;
      }

      // 5. 采购限制验证
      const restrictions = await this.getPurchaseRestrictions(buyerId, productId);
      const restrictionValidation = this.validatePurchaseRestrictions(
        buyer.level as UserLevel,
        quantity,
        restrictions
      );
      if (!restrictionValidation.isValid) {
        reasons.push(...restrictionValidation.reasons);
        canPurchase = false;
      }

      // 更新性能统计
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime);

      return {
        isValid: reasons.length === 0,
        canPurchase,
        reasons,
        restrictions,
        // 额外信息用于调试和日志
        metadata: {
          buyerLevel: buyer.level,
          sellerLevel: seller.level,
          teamRelationship: levelValidation.teamRelationship,
          levelComparison: levelValidation.levelComparison,
          performance: {
            responseTime,
            cacheHitRate: this.getCacheHitRate()
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updatePerformanceStats(responseTime);

      logger.error('验证采购权限失败', {
        buyerId,
        sellerId,
        productId,
        quantity,
        responseTime,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        isValid: false,
        canPurchase: false,
        reasons: ['验证过程中发生系统错误'],
        metadata: {
          performance: {
            responseTime,
            cacheHitRate: this.getCacheHitRate()
          }
        }
      };
    }
  }

  /**
   * 带缓存的用户信息获取
   */
  private async getUserWithCache(userId: string): Promise<any> {
    const cacheKey = `user:${userId}`;

    // 尝试从缓存获取
    const cachedUser = this.userCache.get(cacheKey);
    if (cachedUser) {
      this.performanceStats.cacheHits++;
      return cachedUser;
    }

    this.performanceStats.cacheMisses++;

    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          level: true,
          status: true,
          parentId: true,
          teamPath: true
        }
      });

      if (user) {
        this.userCache.set(cacheKey, user);
      }

      return user;
    } catch (error) {
      logger.error('获取用户信息失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }

  /**
   * 带缓存的产品和库存验证
   */
  private async validateProductAndStockWithCache(
    productId: string,
    quantity: number
  ): Promise<{
    isValid: boolean;
    reasons: string[];
  }> {
    const cacheKey = `product:${productId}`;

    // 尝试从缓存获取产品信息
    const cachedProduct = this.productCache.get(cacheKey);
    let product = cachedProduct;

    if (!product) {
      try {
        product = await prisma.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            status: true,
            totalStock: true,
            productSpecs: {
              select: {
                id: true,
                stock: true,
                price: true,
                isActive: true
              },
              where: { isActive: true }
            }
          }
        });

        if (product) {
          this.productCache.set(cacheKey, product);
        }
      } catch (error) {
        logger.error('获取产品信息失败', {
          productId,
          error: error instanceof Error ? error.message : '未知错误'
        });
        return {
          isValid: false,
          reasons: ['验证商品库存时发生错误']
        };
      }
    }

    const reasons: string[] = [];

    if (!product) {
      reasons.push('商品不存在');
      return { isValid: false, reasons };
    }

    if (product.status !== 'ACTIVE') {
      reasons.push('商品已下架');
      return { isValid: false, reasons };
    }

    if (!product.productSpecs || product.productSpecs.length === 0) {
      reasons.push('商品没有可用的规格');
      return { isValid: false, reasons };
    }

    const totalStock = product.totalStock > 0
      ? product.totalStock
      : product.productSpecs.reduce((sum, spec) => sum + spec.stock, 0);

    if (totalStock < quantity) {
      reasons.push(`库存不足，当前总库存：${totalStock}，需要：${quantity}`);
      return { isValid: false, reasons };
    }

    return { isValid: true, reasons: [] };
  }

  /**
   * 更新性能统计
   */
  private updatePerformanceStats(responseTime: number): void {
    const { totalValidations, averageResponseTime } = this.performanceStats;

    // 计算新的平均响应时间
    this.performanceStats.averageResponseTime =
      (averageResponseTime * (totalValidations - 1) + responseTime) / totalValidations;
  }

  /**
   * 获取缓存命中率
   */
  private getCacheHitRate(): number {
    const { cacheHits, cacheMisses } = this.performanceStats;
    const total = cacheHits + cacheMisses;
    return total > 0 ? (cacheHits / total) * 100 : 0;
  }

  /**
   * 获取性能统计信息
   */
  public getPerformanceStats() {
    return {
      ...this.performanceStats,
      cacheHitRate: this.getCacheHitRate(),
      cacheSize: {
        user: this.userCache.size(),
        product: this.productCache.size(),
        uplineChain: this.uplineChainCache.size()
      }
    };
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    this.userCache.clear();
    this.productCache.clear();
    this.uplineChainCache.clear();
    logger.info('采购服务缓存已清理');
  }

  /**
   * 验证等级和团队关系 - 核心业务逻辑
   * 处理平级上级的特殊情况：如果上级与自己平级，需要再往上找更高等级
   */
  private async validateLevelAndTeamRelationship(
    buyer: any,
    seller: any
  ): Promise<{
    isValid: boolean;
    reasons: string[];
    teamRelationship?: any;
    levelComparison?: any;
  }> {
    const reasons: string[] = [];
    const buyerLevel = buyer.level as UserLevel;
    const sellerLevel = seller.level as UserLevel;
    const levels = Object.values(UserLevel);
    const buyerLevelIndex = levels.indexOf(buyerLevel);
    const sellerLevelIndex = levels.indexOf(sellerLevel);

    // 1. 检查是否在同一个团队中
    const teamRelation = await teamService.validateTeamRelationship(seller.id, buyer.id);

    if (!teamRelation.isValid || teamRelation.distance <= 0) {
      reasons.push('采购方与销售方无有效团队关系，必须在同一团队内才能进行采购');
      return { isValid: false, reasons, teamRelationship: teamRelation };
    }

    // 2. 等级比较逻辑
    let finalSeller = seller;
    let finalSellerLevel = sellerLevel;
    let searchPath = [seller.id];

    // 如果销售方等级低于或等于采购方，需要向上查找更高级别的上级
    if (sellerLevelIndex <= buyerLevelIndex) {
      const higherUpline = await this.findHigherLevelUpline(
        seller.id,
        buyerLevelIndex,
        10 // 最大搜索深度
      );

      if (higherUpline) {
        finalSeller = higherUpline.user;
        finalSellerLevel = higherUpline.level;
        searchPath = higherUpline.searchPath;

        reasons.push(
          `原销售方等级(${sellerLevel})不高于采购方等级(${buyerLevel})，` +
          `已自动找到更高级别的上级(${finalSellerLevel})进行采购`
        );
      } else {
        reasons.push(
          `采购方等级(${buyerLevel})高于或等于销售方等级(${sellerLevel})，` +
          '且未找到更高级别的上级，违反采购规则'
        );
        return {
          isValid: false,
          reasons,
          teamRelationship: teamRelation,
          levelComparison: {
            buyerLevel,
            sellerLevel,
            buyerLevelIndex,
            sellerLevelIndex,
            result: 'seller_level_too_low'
          }
        };
      }
    }

    // 3. 最终验证：确保最终销售方等级确实高于采购方
    const finalSellerLevelIndex = levels.indexOf(finalSellerLevel);
    if (finalSellerLevelIndex <= buyerLevelIndex) {
      reasons.push(
        `最终验证失败：采购方等级(${buyerLevel})高于或等于最终销售方等级(${finalSellerLevel})`
      );
      return {
        isValid: false,
        reasons,
        teamRelationship: teamRelation,
        levelComparison: {
          buyerLevel,
          originalSellerLevel: sellerLevel,
          finalSellerLevel,
          buyerLevelIndex,
          finalSellerLevelIndex,
          searchPath,
          result: 'final_validation_failed'
        }
      };
    }

    return {
      isValid: true,
      reasons: [],
      teamRelationship: {
        ...teamRelation,
        searchPath,
        finalSellerId: finalSeller.id,
        finalSellerLevel: finalSellerLevel
      },
      levelComparison: {
        buyerLevel,
        originalSellerLevel: sellerLevel,
        finalSellerLevel,
        buyerLevelIndex,
        finalSellerLevelIndex,
        searchPath,
        result: 'valid'
      }
    };
  }

  /**
   * 向上查找更高级别的上级 - 性能优化版本
   * 使用单次查询优化和批量处理来减少数据库查询次数
   * @param startUserId 起始用户ID
   * @param minLevelIndex 最低等级索引（必须高于这个等级）
   * @param maxDepth 最大搜索深度
   * @returns 查找结果
   */
  private async findHigherLevelUpline(
    startUserId: string,
    minLevelIndex: number,
    maxDepth: number = 10
  ): Promise<{
    user: any;
    level: UserLevel;
    searchPath: string[];
  } | null> {
    const levels = Object.values(UserLevel);
    const searchPath: string[] = [startUserId];
    let currentUserId = startUserId;

    try {
      // 性能优化：预先获取所有可能的上级路径
      const uplineChain = await this.getUplineChain(currentUserId, maxDepth);

      if (!uplineChain || uplineChain.length === 0) {
        return null;
      }

      // 在内存中处理等级比较，减少数据库查询
      for (const uplineUser of uplineChain) {
        if (uplineUser.status !== 'ACTIVE') {
          continue;
        }

        const uplineLevel = uplineUser.level as UserLevel;
        const uplineLevelIndex = levels.indexOf(uplineLevel);

        // 找到足够高级别的上级
        if (uplineLevelIndex > minLevelIndex) {
          // 计算搜索路径
          const pathIndex = uplineChain.indexOf(uplineUser);
          const finalSearchPath = searchPath.concat(
            uplineChain.slice(0, pathIndex + 1).map(u => u.id)
          );

          return {
            user: uplineUser,
            level: uplineLevel,
            searchPath: finalSearchPath
          };
        }
      }

      return null;
    } catch (error) {
      logger.error('查找更高级别上级失败', {
        startUserId,
        minLevelIndex,
        maxDepth,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * 获取上级链 - 优化版本，使用单次查询获取完整路径（带缓存）
   * @param userId 用户ID
   * @param maxDepth 最大深度
   * @returns 上级用户链
   */
  private async getUplineChain(userId: string, maxDepth: number): Promise<any[]> {
    const cacheKey = `upline:${userId}:${maxDepth}`;

    // 尝试从缓存获取
    const cachedChain = this.uplineChainCache.get(cacheKey);
    if (cachedChain) {
      return cachedChain;
    }

    try {
      // 使用 teamPath 字段来优化查询，如果可用的话
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          teamPath: true,
          parentId: true
        }
      });

      if (!user) {
        return [];
      }

      let uplineChain: any[] = [];

      // 如果有 teamPath，解析路径来批量获取上级
      if (user.teamPath) {
        uplineChain = await this.getUplineFromPath(user.teamPath, maxDepth);
      } else {
        // 回退到逐级查询
        uplineChain = await this.getUplineByTraversal(userId, maxDepth);
      }

      // 缓存结果
      if (uplineChain.length > 0) {
        this.uplineChainCache.set(cacheKey, uplineChain);
      }

      return uplineChain;
    } catch (error) {
      logger.error('获取上级链失败', {
        userId,
        maxDepth,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 从 teamPath 获取上级链
   * @param teamPath 团队路径
   * @param maxDepth 最大深度
   * @returns 上级用户链
   */
  private async getUplineFromPath(teamPath: string, maxDepth: number): Promise<any[]> {
    try {
      // 解析路径，获取所有上级ID
      const pathIds = teamPath.split('/').filter(id => id);
      const uplineIds = pathIds.slice(-maxDepth); // 取最后 maxDepth 个上级

      if (uplineIds.length === 0) {
        return [];
      }

      // 批量查询所有上级用户
      const uplines = await prisma.users.findMany({
        where: {
          id: { in: uplineIds },
          status: 'ACTIVE'
        },
        select: {
          id: true,
          level: true,
          status: true
        },
        orderBy: {
          createdAt: 'asc' // 按时间排序，确保正确顺序
        }
      });

      return uplines;
    } catch (error) {
      logger.error('从路径获取上级链失败', {
        teamPath,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 通过遍历获取上级链 - 回退方案
   * @param userId 用户ID
   * @param maxDepth 最大深度
   * @returns 上级用户链
   */
  private async getUplineByTraversal(userId: string, maxDepth: number): Promise<any[]> {
    const uplines: any[] = [];
    let currentUserId = userId;

    try {
      for (let depth = 0; depth < maxDepth; depth++) {
        const user = await prisma.users.findUnique({
          where: { id: currentUserId },
          select: {
            parentId: true
          }
        });

        if (!user || !user.parentId) {
          break;
        }

        // 获取上级用户
        const upline = await prisma.users.findUnique({
          where: { id: user.parentId },
          select: {
            id: true,
            level: true,
            status: true
          }
        });

        if (!upline) {
          break;
        }

        uplines.push(upline);
        currentUserId = user.parentId;

        // 如果到达非活跃用户，继续往上找
        if (upline.status !== 'ACTIVE') {
          continue;
        }
      }

      return uplines;
    } catch (error) {
      logger.error('遍历获取上级链失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 验证产品和库存
   */
  private async validateProductAndStock(
    productId: string,
    quantity: number
  ): Promise<{
    isValid: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          status: true,
          totalStock: true,
          productSpecs: {
            select: {
              id: true,
              stock: true,
              price: true,
              isActive: true
            },
            where: { isActive: true }
          }
        }
      });

      if (!product) {
        reasons.push('商品不存在');
        return { isValid: false, reasons };
      }

      if (product.status !== 'ACTIVE') {
        reasons.push('商品已下架');
        return { isValid: false, reasons };
      }

      // 检查是否有可用的规格
      if (!product.productSpecs || product.productSpecs.length === 0) {
        reasons.push('商品没有可用的规格');
        return { isValid: false, reasons };
      }

      // 检查总库存（优先使用产品的总库存，如果没有则计算所有规格库存）
      const totalStock = product.totalStock > 0
        ? product.totalStock
        : product.productSpecs.reduce((sum, spec) => sum + spec.stock, 0);

      if (totalStock < quantity) {
        reasons.push(`库存不足，当前总库存：${totalStock}，需要：${quantity}`);
        return { isValid: false, reasons };
      }

      return { isValid: true, reasons: [] };
    } catch (error) {
      logger.error('验证产品和库存失败', {
        productId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      reasons.push('验证商品库存时发生错误');
      return { isValid: false, reasons };
    }
  }

  /**
   * 验证采购限制
   */
  private validatePurchaseRestrictions(
    buyerLevel: UserLevel,
    quantity: number,
    restrictions: any
  ): {
    isValid: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const levels = Object.values(UserLevel);

    // 检查数量限制
    if (restrictions.maxQuantity && quantity > restrictions.maxQuantity) {
      reasons.push(`超过单次采购限制，最大可采购：${restrictions.maxQuantity}，当前：${quantity}`);
    }

    // 检查等级限制
    if (restrictions.minLevel) {
      const minLevelIndex = levels.indexOf(restrictions.minLevel);
      const buyerLevelIndex = levels.indexOf(buyerLevel);

      if (buyerLevelIndex < minLevelIndex) {
        reasons.push(`用户等级不足，最低要求：${restrictions.minLevel}，当前：${buyerLevel}`);
      }
    }

    // 检查团队规模限制
    if (restrictions.requiredTeamSize) {
      // 这里需要获取用户的团队规模，暂时跳过具体实现
      // TODO: 实现团队规模检查
    }

    return {
      isValid: reasons.length === 0,
      reasons
    };
  }

  /**
   * 保持向后兼容的旧方法
   * @deprecated 使用 validatePurchasePermission 替代
   */
  async validatePurchasePermissions(
    buyerId: string,
    sellerId: string,
    productId: string,
    quantity: number
  ): Promise<PurchaseValidationResult> {
    logger.warn('使用了已废弃的 validatePurchasePermissions 方法，建议使用 validatePurchasePermission');
    return this.validatePurchasePermission(buyerId, sellerId, productId, quantity);
  }

  // 获取采购限制
  private async getPurchaseRestrictions(buyerId: string, productId: string): Promise<{
    maxQuantity?: number;
    minLevel?: UserLevel;
    requiredTeamSize?: number;
  }> {
    try {
      const buyer = await prisma.users.findUnique({
        where: { id: buyerId },
        select: { level: true }
      });

      const restrictions: any = {};

      // 根据用户等级设置限制
      if (buyer) {
        const levelBenefits = userLevelService.getLevelBenefits(buyer.level as UserLevel);

        // 普通用户单次采购限制
        if (buyer.level === UserLevel.NORMAL) {
          restrictions.maxQuantity = 5; // 最多5箱
          restrictions.minLevel = UserLevel.NORMAL;
        } else if (buyer.level === UserLevel.VIP) {
          restrictions.maxQuantity = 10;
          restrictions.minLevel = UserLevel.VIP;
        } else {
          // 更高等级用户限制更少
          restrictions.maxQuantity = 20;
        }
      }

      // 产品特定限制
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          purchaseLimit: true,
          minLevel: true
        }
      });

      if (product) {
        if (product.purchaseLimit) {
          restrictions.maxQuantity = Math.min(
            restrictions.maxQuantity || Infinity,
            product.purchaseLimit
          );
        }
        if (product.minLevel) {
          restrictions.minLevel = product.minLevel as UserLevel;
        }
      }

      return restrictions;
    } catch (error) {
      logger.error('获取采购限制失败', { buyerId, productId });
      return {};
    }
  }

  // 创建采购订单
  async createPurchaseOrder(params: CreatePurchaseParams): Promise<{
    success: boolean;
    order?: PurchaseOrder;
    error?: string;
    message: string;
  }> {
    try {
      // 1. 验证采购权限
      const validation = await this.validatePurchasePermission(
        params.buyerId,
        params.sellerId,
        params.productId,
        params.quantity
      );

      if (!validation.canPurchase) {
        return {
          success: false,
          error: validation.reasons.join('; '),
          message: '采购验证失败'
        };
      }

      // 2. 获取产品信息
      const product = await prisma.product.findUnique({
        where: { id: params.productId },
        select: {
          id: true,
          name: true,
          sku: {
            select: {
              id: true,
              price: true,
              bottlesPerCase: true,
              stock: true
            }
          }
        }
      });

      if (!product || !product.sku) {
        return {
          success: false,
          error: '产品信息不完整',
          message: '创建采购订单失败'
        };
      }

      // 3. 计算订单金额
      const unitPrice = product.sku.price;
      const totalAmount = unitPrice * params.quantity;
      const totalBottles = product.sku.bottlesPerCase * params.quantity;

      // 4. 创建采购订单
      const order = await prisma.$transaction(async (tx) => {
        // 创建订单
        const newOrder = await tx.purchaseOrder.create({
          data: {
            orderNo: this.generateOrderNo(),
            buyerId: params.buyerId,
            sellerId: params.sellerId,
            productId: params.productId,
            skuId: params.skuId,
            quantity: params.quantity,
            unitPrice,
            totalAmount,
            totalBottles,
            status: PurchaseStatus.PENDING,
            paymentStatus: 'UNPAID',
            shippingAddress: params.shippingAddress,
            notes: params.notes,
            metadata: {
              productName: product.name,
              bottlesPerCase: product.sku.bottlesPerCase,
              validation: validation
            }
          }
        });

        // 预扣库存（可选）
        await tx.productSKU.update({
          where: { id: params.skuId },
          data: {
            reservedStock: {
              increment: params.quantity
            }
          }
        });

        return newOrder;
      });

      logger.info('采购订单创建成功', {
        orderId: order.id,
        orderNo: order.orderNo,
        buyerId: params.buyerId,
        sellerId: params.sellerId,
        totalAmount
      });

      return {
        success: true,
        order: this.formatOrder(order),
        message: '采购订单创建成功'
      };
    } catch (error) {
      logger.error('创建采购订单失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建失败',
        message: '创建采购订单失败'
      };
    }
  }

  // 确认采购订单
  async confirmPurchaseOrder(
    orderId: string,
    operatorId: string
  ): Promise<{
    success: boolean;
    order?: PurchaseOrder;
    error?: string;
    message: string;
  }> {
    try {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id: orderId },
        include: {
          buyer: { select: { id: true, level: true } },
          seller: { select: { id: true, level: true } },
          product: {
            select: {
              id: true,
              name: true,
              sku: { select: { stock: true, bottlesPerCase: true } }
            }
          }
        }
      });

      if (!order) {
        return {
          success: false,
          error: '订单不存在',
          message: '确认订单失败'
        };
      }

      if (order.status !== PurchaseStatus.PENDING) {
        return {
          success: false,
          error: '订单状态不允许确认',
          message: '确认订单失败'
        };
      }

      // 检查库存
      if (order.product.sku.stock < order.quantity) {
        return {
          success: false,
          error: '库存不足',
          message: '确认订单失败'
        };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 更新订单状态
        const updated = await tx.purchaseOrder.update({
          where: { id: orderId },
          data: {
            status: PurchaseStatus.CONFIRMED,
            confirmedAt: new Date(),
            metadata: {
              ...order.metadata,
              confirmedBy: operatorId,
              confirmedAt: new Date().toISOString()
            }
          }
        });

        // 扣除库存
        await tx.productSKU.update({
          where: { id: order.skuId },
          data: {
            stock: { decrement: order.quantity },
            reservedStock: { decrement: order.quantity }
          }
        });

        return updated;
      });

      logger.info('采购订单确认成功', {
        orderId,
        orderNo: order.orderNo,
        operatorId
      });

      return {
        success: true,
        order: this.formatOrder(updatedOrder),
        message: '订单确认成功'
      };
    } catch (error) {
      logger.error('确认采购订单失败', {
        orderId,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '确认失败',
        message: '确认订单失败'
      };
    }
  }

  // 完成采购订单（支付完成或发货完成）
  async completePurchaseOrder(
    orderId: string,
    operatorId: string
  ): Promise<{
    success: boolean;
    order?: PurchaseOrder;
    commissionRecords?: any[];
    error?: string;
    message: string;
  }> {
    try {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id: orderId },
        include: {
          buyer: { select: { id: true, level: true, referrerId: true } },
          seller: { select: { id: true, level: true, referrerId: true } }
        }
      });

      if (!order) {
        return {
          success: false,
          error: '订单不存在',
          message: '完成订单失败'
        };
      }

      if (order.status !== PurchaseStatus.CONFIRMED && order.status !== PurchaseStatus.PROCESSING) {
        return {
          success: false,
          error: '订单状态不允许完成',
          message: '完成订单失败'
        };
      }

      const result = await prisma.$transaction(async (tx) => {
        // 更新订单状态
        const updatedOrder = await tx.purchaseOrder.update({
          where: { id: orderId },
          data: {
            status: PurchaseStatus.COMPLETED,
            paymentStatus: 'PAID',
            completedAt: new Date(),
            metadata: {
              ...order.metadata,
              completedBy: operatorId,
              completedAt: new Date().toISOString()
            }
          }
        });

        // 计算和分配佣金
        const commissionRecords = await this.calculateAndDistributeCommission(
          order,
          tx
        );

        // 更新用户业绩统计
        await this.updateUserPurchaseStats(order.buyerId, order.totalAmount, order.totalBottles, tx);

        // 检查并触发升级检查
        await this.checkAndTriggerUpgrade(order.buyerId, tx);

        return {
          order: updatedOrder,
          commissionRecords
        };
      });

      logger.info('采购订单完成成功', {
        orderId,
        orderNo: order.orderNo,
        totalAmount: order.totalAmount,
        commissionCount: result.commissionRecords.length
      });

      return {
        success: true,
        order: this.formatOrder(result.order),
        commissionRecords: result.commissionRecords,
        message: '订单完成成功'
      };
    } catch (error) {
      logger.error('完成采购订单失败', {
        orderId,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '完成失败',
        message: '完成订单失败'
      };
    }
  }

  // 计算和分配佣金
  private async calculateAndDistributeCommission(
    order: any,
    tx: any
  ): Promise<any[]> {
    try {
      const commissionRecords: any[] = [];

      // 获取佣金路径（从销售方往上的团队链）
      const commissionPath = await this.getCommissionPath(order.sellerId);

      // 获取销售方的佣金比例
      const sellerBenefits = userLevelService.getLevelBenefits(order.seller.level as UserLevel);
      const baseCommissionRate = sellerBenefits.commissionRate;

      // 为链条中的每个用户分配佣金
      for (let i = 0; i < commissionPath.length && i < 5; i++) {
        const pathUser = commissionPath[i];
        const commissionRate = baseCommissionRate * Math.pow(0.8, i); // 每级递减20%
        const commissionAmount = order.totalAmount * commissionRate;

        if (commissionAmount > 0.01) { // 最小佣金门槛
          const commission = await tx.commissionRecord.create({
            data: {
              userId: pathUser.id,
              orderId: order.id,
              amount: commissionAmount,
              rate: commissionRate,
              level: i + 1,
              sourceUserId: order.sellerId,
              sourceType: 'PURCHASE',
              status: 'PENDING',
              metadata: {
                orderNo: order.orderNo,
                productName: order.metadata?.productName,
                pathDepth: i + 1
              }
            }
          });

          commissionRecords.push(commission);
        }
      }

      return commissionRecords;
    } catch (error) {
      logger.error('计算分配佣金失败', {
        orderId: order.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  // 获取佣金路径
  private async getCommissionPath(userId: string): Promise<Array<{ id: string; level: UserLevel }>> {
    const path: Array<{ id: string; level: UserLevel }> = [];
    let currentUserId = userId;
    let depth = 0;
    const maxDepth = 5;

    while (currentUserId && depth < maxDepth) {
      const user = await prisma.users.findUnique({
        where: { id: currentUserId },
        select: { id: true, level: true, referrerId: true }
      });

      if (!user) break;

      path.push({
        id: user.id,
        level: user.level as UserLevel
      });

      currentUserId = user.referrerId;
      depth++;
    }

    return path;
  }

  // 更新用户采购统计
  private async updateUserPurchaseStats(
    userId: string,
    totalAmount: number,
    totalBottles: number,
    tx: any
  ): Promise<void> {
    try {
      await tx.userStats.upsert({
        where: { userId },
        update: {
          totalPurchases: { increment: totalAmount },
          totalBottles: { increment: totalBottles },
          purchaseCount: { increment: 1 },
          lastPurchaseAt: new Date()
        },
        create: {
          userId,
          totalPurchases: totalAmount,
          totalBottles,
          purchaseCount: 1,
          lastPurchaseAt: new Date()
        }
      });
    } catch (error) {
      logger.error('更新用户采购统计失败', { userId });
    }
  }

  // 检查并触发升级
  private async checkAndTriggerUpgrade(userId: string, tx: any): Promise<void> {
    try {
      const upgradeCheck = await userLevelService.checkUpgradeConditions(userId);

      if (upgradeCheck.canUpgrade) {
        await tx.levelUpgradeRecord.create({
          data: {
            userId,
            previousLevel: upgradeCheck.currentLevel,
            newLevel: upgradeCheck.nextLevel!,
            upgradeType: 'AUTO',
            approvedById: 'system',
            stats: upgradeCheck.currentStats,
            requirements: upgradeCheck.requirements,
            status: 'PENDING'
          }
        });

        logger.info('触发用户升级检查', {
          userId,
          currentLevel: upgradeCheck.currentLevel,
          nextLevel: upgradeCheck.nextLevel
        });
      }
    } catch (error) {
      logger.error('检查用户升级失败', { userId });
    }
  }

  // 格式化订单数据
  private formatOrder(order: any): PurchaseOrder {
    return {
      id: order.id,
      orderNo: order.orderNo,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      productId: order.productId,
      skuId: order.skuId,
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      totalAmount: order.totalAmount,
      totalBottles: order.totalBottles,
      status: order.status as PurchaseStatus,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      notes: order.notes,
      metadata: order.metadata,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt
    };
  }

  // 获取用户采购订单列表
  async getUserPurchaseOrders(
    userId: string,
    type: 'buyer' | 'seller' = 'buyer',
    page: number = 1,
    perPage: number = 20,
    status?: PurchaseStatus
  ): Promise<{
    orders: PurchaseOrder[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const skip = (page - 1) * perPage;
      const where: any = {};

      if (type === 'buyer') {
        where.buyerId = userId;
      } else {
        where.sellerId = userId;
      }

      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
          include: {
            buyer: {
              select: { id: true, nickname: true }
            },
            seller: {
              select: { id: true, nickname: true }
            },
            product: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: perPage
        }),
        prisma.purchaseOrder.count({ where })
      ]);

      const formattedOrders = orders.map(order => this.formatOrder(order));

      return {
        orders: formattedOrders,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };
    } catch (error) {
      logger.error('获取用户采购订单失败', {
        userId,
        type,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 取消采购订单
  async cancelPurchaseOrder(
    orderId: string,
    reason: string,
    operatorId: string
  ): Promise<{
    success: boolean;
    order?: PurchaseOrder;
    error?: string;
    message: string;
  }> {
    try {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, skuId: true, quantity: true }
      });

      if (!order) {
        return {
          success: false,
          error: '订单不存在',
          message: '取消订单失败'
        };
      }

      if (order.status === PurchaseStatus.COMPLETED || order.status === PurchaseStatus.CANCELLED) {
        return {
          success: false,
          error: '订单状态不允许取消',
          message: '取消订单失败'
        };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 更新订单状态
        const updated = await tx.purchaseOrder.update({
          where: { id: orderId },
          data: {
            status: PurchaseStatus.CANCELLED,
            metadata: {
              cancelReason: reason,
              cancelledBy: operatorId,
              cancelledAt: new Date().toISOString()
            }
          }
        });

        // 恢复库存
        if (order.status !== PurchaseStatus.PENDING) {
          await tx.productSKU.update({
            where: { id: order.skuId },
            data: {
              stock: { increment: order.quantity },
              reservedStock: { decrement: order.quantity }
            }
          });
        }

        return updated;
      });

      logger.info('采购订单取消成功', {
        orderId,
        reason,
        operatorId
      });

      return {
        success: true,
        order: this.formatOrder(updatedOrder),
        message: '订单取消成功'
      };
    } catch (error) {
      logger.error('取消采购订单失败', {
        orderId,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '取消失败',
        message: '取消订单失败'
      };
    }
  }
}

// 导出单例实例
export const purchaseService = new PurchaseService();