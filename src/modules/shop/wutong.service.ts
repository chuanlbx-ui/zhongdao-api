/**
 * 五通店特殊业务逻辑服务
 * 实现买10赠1机制和终身权益
 */

import { ShopType, ShopStatus, UserLevel, ProductStatus, OrderStatus } from '@prisma/client';
import { logger } from '@/shared/utils/logger';
import { prisma } from '@/shared/database/client';
import { WUTONG_SHOP_CONFIG } from './types';

/**
 * 五通店权益配置
 */
export interface WutongBenefitConfig {
  userId: string;
  shopId: string;
  isActive: boolean;
  activatedAt: Date;
  totalGiftsGiven: number;
  totalGiftValue: number;
  lastGiftAt?: Date;
}

/**
 * 买10赠1计算结果
 */
export interface BuyTenGetOneResult {
  qualifies: boolean;
  orderAmount: number;
  freeQuantity: number;
  freeProducts: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
  }[];
  savingsAmount: number;
  message: string;
}

/**
 * 购物车项用于赠品计算
 */
export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  qualifies: boolean; // 是否参与买10赠1活动
}

/**
 * 五通店升级结果
 */
export interface WutongUpgradeResult {
  success: boolean;
  previousLevel: UserLevel;
  newLevel: UserLevel;
  shopId?: string;
  message: string;
  benefits?: string[];
}

// 类型定义
interface WutongQualificationResult {
  hasWutongShop: boolean;
  shopId?: string;
  shopStatus?: ShopStatus;
  activatedAt?: Date;
  canUseBenefits: boolean;
}

interface ShopCreationParams {
  contactName: string;
  contactPhone: string;
  address?: string;
}

interface WutongStatistics {
  totalOrders: number;
  totalGifts: number;
  totalGiftValue: number;
  lastOrderDate?: Date;
  benefitsUsedThisMonth: number;
  monthlyLimit: number;
}

interface ProductInfo {
  id: string;
  name: string;
  price: number;
  status: ProductStatus;
  qualifiesForBenefit: boolean;
}

/**
 * 五通店服务类
 */
export class WutongService {
  /**
   * 验证用户是否拥有五通店资格
   */
  async validateWutongQualification(userId: string): Promise<WutongQualificationResult> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          hasWutongShop: true,
          shops: {
            where: { shopType: ShopType.WUTONG },
            select: { id: true, status: true, createdAt: true }
          }
        }
      });

      if (!user) {
        return { hasWutongShop: false, canUseBenefits: false };
      }

      const wutongShop = user.shops?.[0];
      const hasWutongShop = user.hasWutongShop && wutongShop?.status === ShopStatus.ACTIVE;

      return {
        hasWutongShop,
        shopId: wutongShop?.id,
        shopStatus: wutongShop?.status,
        activatedAt: wutongShop?.createdAt,
        canUseBenefits: hasWutongShop
      };
    } catch (error) {
      logger.error('验证五通店资格失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return { hasWutongShop: false, canUseBenefits: false };
    }
  }

  /**
   * 计算买10赠1权益
   * 核心业务逻辑：满5,999元送599元商品，每满10瓶送1瓶
   */
  async calculateWutongBenefit(userId: string, cartItems: CartItem[]): Promise<BuyTenGetOneResult> {
    try {
      // 1. 验证五通店资格
      const qualification = await this.validateWutongQualification(userId);
      if (!qualification.canUseBenefits) {
        return {
          qualifies: false,
          orderAmount: 0,
          freeQuantity: 0,
          freeProducts: [],
          savingsAmount: 0,
          message: '您还没有开通五通店，无法享受买10赠1权益'
        };
      }

      // 2. 筛选参与活动的商品
      const qualifiedItems = await this.getQualifiedProducts(cartItems);

      if (qualifiedItems.length === 0) {
        return {
          qualifies: false,
          orderAmount: cartItems.reduce((sum, item) => sum + item.totalPrice, 0),
          freeQuantity: 0,
          freeProducts: [],
          savingsAmount: 0,
          message: '购物车中没有参与买10赠1活动的商品'
        };
      }

      // 3. 计算订单金额和符合条件的商品数量
      const qualifiedAmount = qualifiedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const qualifiedBottles = qualifiedItems.reduce((sum, item) => sum + item.quantity, 0);

      // 4. 检查是否满足赠品门槛
      if (qualifiedAmount < WUTONG_SHOP_CONFIG.giftThreshold) {
        return {
          qualifies: false,
          orderAmount: cartItems.reduce((sum, item) => sum + item.totalPrice, 0),
          freeQuantity: 0,
          freeProducts: [],
          savingsAmount: 0,
          message: `还需消费${(WUTONG_SHOP_CONFIG.giftThreshold - qualifiedAmount).toLocaleString()}元即可享受赠品`
        };
      }

      // 5. 计算赠品数量（每10瓶送1瓶）
      const freeQuantity = Math.floor(qualifiedBottles / 10);

      if (freeQuantity === 0) {
        return {
          qualifies: true,
          orderAmount: cartItems.reduce((sum, item) => sum + item.totalPrice, 0),
          freeQuantity: 0,
          freeProducts: [],
          savingsAmount: 0,
          message: '已满足赠品门槛，但购买数量不足10瓶，暂无赠品'
        };
      }

      // 6. 选择赠品（同款商品或等值商品）
      const freeProducts = await this.selectFreeProducts(qualifiedItems, freeQuantity);
      const savingsAmount = freeProducts.reduce((sum, product) => sum + product.totalValue, 0);

      return {
        qualifies: true,
        orderAmount: cartItems.reduce((sum, item) => sum + item.totalPrice, 0),
        freeQuantity,
        freeProducts,
        savingsAmount,
        message: `恭喜！您获得了${freeQuantity}件赠品，价值${savingsAmount.toLocaleString()}元`
      };
    } catch (error) {
      logger.error('计算五通店权益失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        qualifies: false,
        orderAmount: 0,
        freeQuantity: 0,
        freeProducts: [],
        savingsAmount: 0,
        message: '计算权益时发生错误，请稍后重试'
      };
    }
  }

  /**
   * 获取参与买10赠1活动的商品
   */
  private async getQualifiedProducts(cartItems: CartItem[]): Promise<CartItem[]> {
    try {
      // �参与活动的商品ID列表（可从配置中读取）
      const participatingProductIds = await this.getParticipatingProductIds();

      return cartItems.filter(item =>
        participatingProductIds.includes(item.productsId) && item.quantity > 0
      );
    } catch (error) {
      logger.error('获取符合条件的商品失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 获取参与活动的商品ID列表
   */
  private async getParticipatingProductIds(): Promise<string[]> {
    try {
      // 从系统配置中获取参与活动的商品
      const config = await prisma.systemConfigs.findUnique({
        where: { key: 'wutong_gift_products' }
      });

      if (config?.value) {
        return JSON.parse(config.value) as string[];
      }

      // 如果没有配置，默认返回所有上架商品
      const products = await prisma.products.findMany({
        where: { status: ProductStatus.ACTIVE },
        select: { id: true }
      });

      return products.map(p => p.id);
    } catch (error) {
      logger.error('获取参与活动商品列表失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 选择赠品
   * 优先选择同款商品，如果库存不足则选择等值商品
   */
  private async selectFreeProducts(qualifiedItems: CartItem[], freeQuantity: number): Promise<BuyTenGetOneResult['freeProducts']> {
    const freeProducts: BuyTenGetOneResult['freeProducts'] = [];
    let remainingQuantity = freeQuantity;

    try {
      // 按价值排序，优先选择高价值商品的赠品
      const sortedItems = qualifiedItems.sort((a, b) => b.unitPrice - a.unitPrice);

      for (const item of sortedItems) {
        if (remainingQuantity <= 0) break;

        // 检查商品库存
        const stock = await this.getProductStock(item.productsId);
        const maxFreeQuantity = Math.min(remainingQuantity, Math.floor(item.quantity / 10));

        if (maxFreeQuantity > 0 && stock >= maxFreeQuantity) {
          freeProducts.push({
            productId: item.productsId,
            productName: item.productsName,
            quantity: maxFreeQuantity,
            unitPrice: item.unitPrice,
            totalValue: maxFreeQuantity * item.unitPrice
          });
          remainingQuantity -= maxFreeQuantity;
        }
      }

      // 如果还有剩余的赠品数量，选择等值的其他商品
      if (remainingQuantity > 0) {
        const alternativeGifts = await this.getAlternativeGifts(remainingQuantity);
        freeProducts.push(...alternativeGifts);
      }

      return freeProducts;
    } catch (error) {
      logger.error('选择赠品失败', {
        qualifiedItems,
        freeQuantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 获取商品库存
   */
  private async getProductStock(productId: string): Promise<number> {
    try {
      const stock = await prisma.inventoryStocks.aggregate({
        where: { productId },
        _sum: { availableQuantity: true }
      });

      return stock._sum.availableQuantity || 0;
    } catch (error) {
      logger.error('获取商品库存失败', { productId });
      return 0;
    }
  }

  /**
   * 获取替代赠品
   */
  private async getAlternativeGifts(requiredQuantity: number): Promise<BuyTenGetOneResult['freeProducts']> {
    try {
      // 获取等值商品作为赠品
      const products = await prisma.products.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          basePrice: {
            lte: WUTONG_SHOP_CONFIG.giftValue
          }
        },
        select: { id: true, name: true, basePrice: true },
        orderBy: { basePrice: 'desc' },
        take: 5
      });

      const alternativeGifts: BuyTenGetOneResult['freeProducts'] = [];

      for (const product of products) {
        if (alternativeGifts.reduce((sum, gift) => sum + gift.quantity, 0) >= requiredQuantity) {
          break;
        }

        const stock = await this.getProductStock(product.id);
        if (stock > 0) {
          const quantity = Math.min(1, requiredQuantity - alternativeGifts.reduce((sum, gift) => sum + gift.quantity, 0));

          alternativeGifts.push({
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice: product.basePrice,
            totalValue: quantity * product.basePrice
          });
        }
      }

      return alternativeGifts;
    } catch (error) {
      logger.error('获取替代赠品失败', {
        requiredQuantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 开通五通店并处理升级特权
   */
  async openWutongShopWithUpgrade(userId: string, contactInfo: {
    contactName: string;
    contactPhone: string;
    address?: string;
  }): Promise<WutongUpgradeResult> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. 获取用户当前信息
        const user = await tx.users.findUnique({
          where: { id: userId },
          select: { level: true, status: true, hasWutongShop: true }
        });

        if (!user || user.status !== 'ACTIVE') {
          throw new Error('用户不存在或账户状态异常');
        }

        if (user.hasWutongShop) {
          throw new Error('用户已拥有五通店');
        }

        const previousLevel = user.level;

        // 2. 创建五通店
        const wutongShop = await tx.shops.create({
          data: {
            userId,
            shopType: ShopType.WUTONG,
            shopName: `${contactInfo.contactName}的五通店`,
            contactName: contactInfo.contactName,
            contactPhone: contactInfo.contactPhone,
            address: contactInfo.address,
            shopLevel: 1,
            status: ShopStatus.ACTIVE // 直接激活，因为已付费
          }
        });

        // 3. 更新用户五通店状态
        await tx.users.update({
          where: { id: userId },
          data: { hasWutongShop: true }
        });

        // 4. 五通店特权：直接升级为二星店长
        const newLevel = UserLevel.STAR_2;
        if (previousLevel !== UserLevel.STAR_2 && previousLevel !== UserLevel.DIRECTOR) {
          await tx.users.update({
            where: { id: userId },
            data: { level: newLevel }
          });

          // 创建升级记录
          await tx.levelUpgradeRecords.create({
            data: {
              userId,
              previousLevel,
              newLevel,
              upgradeType: 'WUTONG_PRIVILEGE',
              approvedById: 'system',
              metadata: {
                reason: '五通店开通特权',
                shopId: wutongShop.id,
                entryFee: WUTONG_SHOP_CONFIG.entryFee
              }
            }
          });
        }

        return {
          wutongShop,
          previousLevel,
          newLevel: previousLevel !== UserLevel.STAR_2 && previousLevel !== UserLevel.DIRECTOR ? newLevel : previousLevel
        };
      });

      const benefits = this.getWutongBenefits();
      const levelChanged = result.previousLevel !== result.newLevel;

      logger.info('五通店开通成功', {
        userId,
        shopId: result.wutongShop.id,
        previousLevel: result.previousLevel,
        newLevel: result.newLevel,
        upgraded: levelChanged
      });

      return {
        success: true,
        previousLevel: result.previousLevel,
        newLevel: result.newLevel,
        shopId: result.wutongShop.id,
        message: levelChanged
          ? `恭喜开通五通店！您已升级为${this.getLevelDisplayName(result.newLevel)}，享受买10赠1终身权益`
          : '恭喜开通五通店！您现在可以享受买10赠1终身权益',
        benefits
      };
    } catch (error) {
      logger.error('开通五通店失败', {
        userId,
        contactInfo,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        previousLevel: UserLevel.NORMAL,
        newLevel: UserLevel.NORMAL,
        message: error instanceof Error ? error.message : '开通五通店失败'
      };
    }
  }

  /**
   * 获取五通店权益说明
   */
  getWutongBenefits(): string[] {
    return [
      '终身享受买10赠1机制',
      '满5,999元送599元商品',
      '可直接升级为二星店长',
      '享受二星店长所有权益：3.5折进货价、团队管理等',
      '优先销售权和库存保障',
      '专属客服和技术支持'
    ];
  }

  /**
   * 获取等级显示名称
   */
  private getLevelDisplayName(level: UserLevel): string {
    const levelNames = {
      [UserLevel.NORMAL]: '普通会员',
      [UserLevel.VIP]: 'VIP会员',
      [UserLevel.STAR_1]: '一星店长',
      [UserLevel.STAR_2]: '二星店长',
      [UserLevel.STAR_3]: '三星店长',
      [UserLevel.STAR_4]: '四星店长',
      [UserLevel.STAR_5]: '五星店长',
      [UserLevel.DIRECTOR]: '董事'
    };
    return levelNames[level] || level;
  }

  /**
   * 记录赠品发放
   */
  async recordGiftDistribution(userId: string, orderId: string, freeProducts: BuyTenGetOneResult['freeProducts']): Promise<void> {
    try {
      if (freeProducts.length === 0) return;

      for (const freeProduct of freeProducts) {
        await prisma.giftRecord.create({
          data: {
            userId,
            orderId,
            productId: freeProduct.productsId,
            quantity: freeProduct.quantity,
            value: freeProduct.totalValue,
            type: 'WUTONG_BUY_TEN_GET_ONE',
            status: 'PENDING',
            metadata: {
              shopType: ShopType.WUTONG,
              reason: '买10赠1权益'
            }
          }
        });
      }

      logger.info('赠品记录创建成功', {
        userId,
        orderId,
        freeProductsCount: freeProducts.length,
        totalValue: freeProducts.reduce((sum, p) => sum + p.totalValue, 0)
      });
    } catch (error) {
      logger.error('记录赠品发放失败', {
        userId,
        orderId,
        freeProducts,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 获取五通店统计数据
   */
  async getWutongStatistics(userId: string): Promise<WutongStatistics & {
    shopId?: string;
    activatedAt?: Date;
    totalGiftsGiven: number;
    lastGiftAt?: Date;
    monthlyStats: {
      orders: number;
      giftsGiven: number;
      giftValue: number;
    };
  }> {
    try {
      const qualification = await this.validateWutongQualification(userId);
      if (!qualification.hasWutongShop) {
        return {
          totalOrders: 0,
          totalGiftsGiven: 0,
          totalGiftValue: 0,
          monthlyStats: { orders: 0, giftsGiven: 0, giftValue: 0 }
        };
      }

      // 获取订单统计
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const [
        totalOrders,
        totalGifts,
        monthlyOrders,
        monthlyGifts
      ] = await Promise.all([
        prisma.orders.count({
          where: {
            buyerId: userId,
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
            metadata: { contains: 'wutong_benefit' }
          }
        }),
        prisma.giftRecord.aggregate({
          where: {
            userId,
            type: 'WUTONG_BUY_TEN_GET_ONE',
            status: 'COMPLETED'
          },
          _sum: { quantity: true, value: true },
          _max: { createdAt: true }
        }),
        prisma.orders.count({
          where: {
            buyerId: userId,
            status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
            metadata: { contains: 'wutong_benefit' },
            createdAt: { gte: new Date(currentMonth + '-01') }
          }
        }),
        prisma.giftRecord.aggregate({
          where: {
            userId,
            type: 'WUTONG_BUY_TEN_GET_ONE',
            status: 'COMPLETED',
            createdAt: { gte: new Date(currentMonth + '-01') }
          },
          _sum: { quantity: true, value: true }
        })
      ]);

      return {
        shopId: qualification.shopId,
        activatedAt: qualification.activatedAt,
        totalOrders,
        totalGiftsGiven: totalGifts._sum.quantity || 0,
        totalGiftValue: totalGifts._sum.value || 0,
        lastGiftAt: totalGifts._max.createdAt || undefined,
        monthlyStats: {
          orders: monthlyOrders,
          giftsGiven: monthlyGifts._sum.quantity || 0,
          giftValue: monthlyGifts._sum.value || 0
        }
      };
    } catch (error) {
      logger.error('获取五通店统计失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        totalOrders: 0,
        totalGiftsGiven: 0,
        totalGiftValue: 0,
        monthlyStats: { orders: 0, giftsGiven: 0, giftValue: 0 }
      };
    }
  }
}

// 导出单例实例
export const wutongService = new WutongService();