import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { UserLevel, userLevelService } from '../user/level.service';
import { teamService } from '../user/team.service';
import {
  PurchaseValidationResult,
  PurchaseRestrictions,
  UserForValidation,
  TeamRelationshipResult,
  LevelComparisonResult,
  StockValidationResult,
  PerformanceStats
} from './types';

/**
 * 采购权限验证器
 * 负责验证用户采购权限、等级关系、库存等
 */
export class PurchaseValidator {
  private performanceStats: PerformanceStats = {
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
  };

  /**
   * 验证采购权限
   * 规则：用户只能向更高级别且非平级的上级进货
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

      // 1. 基础验证：用户存在性检查
      const [buyer, seller] = await Promise.all([
        this.getUser(buyerId),
        this.getUser(sellerId)
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

      // 4. 产品和库存验证
      const productValidation = await this.validateProductAndStock(productId, quantity);
      if (!productValidation.isValid) {
        reasons.push(...productValidation.reasons);
        canPurchase = false;
      }

      // 5. 采购限制验证
      const restrictions = await this.getPurchaseRestrictions(buyerId, productId);
      const restrictionValidation = this.validatePurchaseRestrictions(
        buyer.level,
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
   * 获取用户信息
   */
  private async getUser(userId: string): Promise<UserForValidation | null> {
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
   * 验证等级和团队关系
   * 处理平级上级的特殊情况：如果上级与自己平级，需要再往上找更高等级
   */
  private async validateLevelAndTeamRelationship(
    buyer: UserForValidation,
    seller: UserForValidation
  ): Promise<{
    isValid: boolean;
    reasons: string[];
    teamRelationship?: TeamRelationshipResult;
    levelComparison?: LevelComparisonResult;
  }> {
    const reasons: string[] = [];
    const buyerLevel = buyer.level;
    const sellerLevel = seller.level;
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
    if (sellerLevelIndex <= buyerLevelIndex) {
      reasons.push(
        `采购方等级(${buyerLevel})高于或等于销售方等级(${sellerLevel})，违反采购规则`
      );
      return {
        isValid: false,
        reasons,
        teamRelationship: teamRelation,
        levelComparison: {
          isValid: false,
          buyerLevel,
          sellerLevel,
          buyerLevelIndex,
          sellerLevelIndex,
          result: 'seller_level_too_low'
        }
      };
    }

    return {
      isValid: true,
      reasons: [],
      teamRelationship: teamRelation,
      levelComparison: {
        isValid: true,
        buyerLevel,
        sellerLevel,
        buyerLevelIndex,
        sellerLevelIndex,
        result: 'valid'
      }
    };
  }

  /**
   * 验证产品和库存
   */
  private async validateProductAndStock(
    productId: string,
    quantity: number
  ): Promise<StockValidationResult> {
    const reasons: string[] = [];

    try {
      const product = await prisma.products.findUnique({
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
        return { isValid: false, reasons, availableStock: 0, requestedQuantity: quantity };
      }

      if (product.status !== 'ACTIVE') {
        reasons.push('商品已下架');
        return { isValid: false, reasons, availableStock: 0, requestedQuantity: quantity };
      }

      if (!product.productSpecs || product.productSpecs.length === 0) {
        reasons.push('商品没有可用的规格');
        return { isValid: false, reasons, availableStock: 0, requestedQuantity: quantity };
      }

      // 检查总库存
      const totalStock = product.totalStock > 0
        ? product.totalStock
        : product.productSpecs.reduce((sum, spec) => sum + spec.stock, 0);

      if (totalStock < quantity) {
        reasons.push(`库存不足，当前总库存：${totalStock}，需要：${quantity}`);
        return { isValid: false, reasons, availableStock: totalStock, requestedQuantity: quantity };
      }

      return {
        isValid: true,
        reasons: [],
        availableStock: totalStock,
        requestedQuantity: quantity
      };
    } catch (error) {
      logger.error('验证产品和库存失败', {
        productId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      reasons.push('验证商品库存时发生错误');
      return { isValid: false, reasons, availableStock: 0, requestedQuantity: quantity };
    }
  }

  /**
   * 验证采购限制
   */
  private validatePurchaseRestrictions(
    buyerLevel: UserLevel,
    quantity: number,
    restrictions: PurchaseRestrictions
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
   * 获取采购限制
   */
  private async getPurchaseRestrictions(
    buyerId: string,
    productId: string
  ): Promise<PurchaseRestrictions> {
    try {
      const buyer = await prisma.users.findUnique({
        where: { id: buyerId },
        select: { level: true }
      });

      const restrictions: PurchaseRestrictions = {};

      // 根据用户等级设置限制
      if (buyer) {
        const levelBenefits = userLevelService.getLevelBenefits(buyer.level);

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
      const product = await prisma.products.findUnique({
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
  public getPerformanceStats(): PerformanceStats {
    return {
      ...this.performanceStats,
      cacheHitRate: this.getCacheHitRate()
    };
  }
}