/**
 * 店铺管理服务
 * 处理云店和五通店的核心业务逻辑
 */

import { ShopType, ShopStatus, UserLevel } from '@prisma/client';
import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { ErrorCode } from '../../shared/types/response';
import { configService } from '../config';
import { wutongService } from './wutong.service';
import {
  CLOUD_SHOP_LEVELS,
  WUTONG_SHOP_CONFIG,
  ApplyShopParams,
  ApplyShopResult,
  CloudShopUpgradeCheckResult,
  CloudShopUpgradeResult,
  PurchaseWutongShopParams,
  PurchaseWutongShopResult,
  ShopInfo,
  ShopStatistics,
  ShopPermissionCheckResult,
  CanApplyShopResult,
  CloudShopLevelConfig
} from './types';

/**
 * 店铺管理服务类
 */
export class ShopService {
  /**
   * 检查用户是否可以申请开店
   */
  async canApplyShop(userId: string, shopType: ShopType): Promise<CanApplyShopResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, level: true, status: true, shops: true }
      });

      if (!user) {
        return {
          canApply: false,
          reasons: ['用户不存在']
        };
      }

      if (user.status !== 'ACTIVE') {
        return {
          canApply: false,
          reasons: ['用户账户状态异常，请先激活账户']
        };
      }

      const reasons: string[] = [];

      // 检查是否已有该类型的店铺
      const existingShop = user.shops?.find(shop => shop.shopType === shopType);
      if (existingShop) {
        return {
          canApply: false,
          reasons: ['已拥有该类型店铺']
        };
      }

      // 云店申请限制
      if (shopType === ShopType.CLOUD) {
        // 云店可以随时申请，但需要满足等级要求才能升级
        return {
          canApply: true,
          reasons: []
        };
      }

      // 五通店申请限制
      if (shopType === ShopType.WUTONG) {
        // 五通店需要充足余额或现金
        // 这里可以添加支付相关的检查
        return {
          canApply: true,
          reasons: [],
          fee: WUTONG_SHOP_CONFIG.entryFee
        };
      }

      return {
        canApply: false,
        reasons: ['未知的店铺类型']
      };
    } catch (error) {
      logger.error('检查开店权限失败', {
        userId,
        shopType,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        canApply: false,
        reasons: ['系统错误，请稍后重试']
      };
    }
  }

  /**
   * 申请开店
   */
  async applyShop(userId: string, params: ApplyShopParams): Promise<ApplyShopResult> {
    try {
      // 1. 检查权限
      const permissionCheck = await this.canApplyShop(userId, params.shopType);
      if (!permissionCheck.canApply) {
        return {
          success: false,
          message: permissionCheck.reasons.join('; ')
        };
      }

      // 2. 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 3. 创建店铺
      const shop = await prisma.$transaction(async (tx) => {
        const newShop = await tx.shop.create({
          data: {
            userId,
            shopType: params.shopType,
            shopName: params.shopName || null,
            shopDescription: params.shopDescription || null,
            contactName: params.contactName,
            contactPhone: params.contactPhone,
            address: params.address || null,
            shopLevel: 1, // 初始等级为1
            status: params.shopType === ShopType.CLOUD ? ShopStatus.ACTIVE : ShopStatus.PENDING
          }
        });

        // 如果是云店，直接激活；如果是五通店，需要待审核
        if (params.shopType === ShopType.CLOUD) {
          // 更新用户的云店等级
          await tx.user.update({
            where: { id: userId },
            data: { cloudShopLevel: 1 }
          });
        }

        return newShop;
      });

      logger.info('用户申请开店成功', {
        userId,
        shopId: shop.id,
        shopType: params.shopType
      });

      return {
        success: true,
        shopId: shop.id,
        message: params.shopType === ShopType.CLOUD
          ? '云店申请成功，已激活'
          : '五通店申请已提交，请等待审核',
        requiresApproval: params.shopType === ShopType.WUTONG,
        ...(params.shopType === ShopType.WUTONG ? { fee: WUTONG_SHOP_CONFIG.entryFee } : {})
      };
    } catch (error) {
      logger.error('申请开店失败', {
        userId,
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        message: '申请开店失败，请稍后重试'
      };
    }
  }

  /**
   * 检查云店升级条件
   */
  async checkCloudShopUpgrade(userId: string): Promise<CloudShopUpgradeCheckResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          cloudShopLevel: true,
          totalBottles: true,
          directCount: true,
          teamCount: true,
          children: {
            select: { id: true, level: true }
          }
        }
      });

      if (!user) {
        return {
          canUpgrade: false,
          currentLevel: 0,
          reasons: ['用户不存在']
        };
      }

      const currentLevel = user.cloudShopLevel || 1;

      // 已经是最高等级
      if (currentLevel >= 6) {
        return {
          canUpgrade: false,
          currentLevel,
          reasons: ['已是最高等级（董事）']
        };
      }

      const nextLevel = currentLevel + 1;
      const nextLevelConfig = CLOUD_SHOP_LEVELS[nextLevel];

      if (!nextLevelConfig) {
        return {
          canUpgrade: false,
          currentLevel,
          reasons: ['升级配置异常']
        };
      }

      const reasons: string[] = [];
      let canUpgrade = true;

      // 检查瓶数
      if (user.totalBottles < nextLevelConfig.minBottles) {
        reasons.push(
          `累计销售瓶数不足，当前: ${user.totalBottles}, 需要: ${nextLevelConfig.minBottles}`
        );
        canUpgrade = false;
      }

      // 检查团队规模
      if (user.teamCount < nextLevelConfig.minTeamSize) {
        reasons.push(
          `团队规模不足，当前: ${user.teamCount}, 需要: ${nextLevelConfig.minTeamSize}`
        );
        canUpgrade = false;
      }

      // 检查直推等级成员
      const directQualifiedCount = (user.children || []).filter(child => {
        // 至少是该等级或更高等级
        const childLevels = Object.values(UserLevel);
        return childLevels.indexOf(child.level) >= childLevels.indexOf(nextLevelConfig.minDirectMembers as any);
      }).length;

      if (directQualifiedCount < nextLevelConfig.minDirectMembers) {
        reasons.push(
          `直推成员等级不足，当前合格: ${directQualifiedCount}, 需要: ${nextLevelConfig.minDirectMembers}`
        );
        canUpgrade = false;
      }

      return {
        canUpgrade,
        currentLevel,
        ...(canUpgrade ? { nextLevel } : {}),
        reasons,
        currentStats: canUpgrade ? {
          totalBottles: user.totalBottles,
          directMembers: user.directCount || 0,
          teamSize: user.teamCount
        } : undefined,
        requirements: canUpgrade ? nextLevelConfig : undefined
      };
    } catch (error) {
      logger.error('检查云店升级条件失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        canUpgrade: false,
        currentLevel: 0,
        reasons: ['系统错误，请稍后重试']
      };
    }
  }

  /**
   * 执行云店升级
   */
  async upgradeCloudShop(userId: string): Promise<CloudShopUpgradeResult> {
    try {
      const upgradeCheck = await this.checkCloudShopUpgrade(userId);

      if (!upgradeCheck.canUpgrade || !upgradeCheck.nextLevel) {
        return {
          success: false,
          previousLevel: upgradeCheck.currentLevel,
          newLevel: upgradeCheck.currentLevel,
          message: upgradeCheck.reasons.join('; ')
        };
      }

      const result = await prisma.$transaction(async (tx) => {
        // 更新用户云店等级
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { cloudShopLevel: upgradeCheck.nextLevel! }
        });

        // 创建升级记录（可选）
        // await tx.shopUpgradeRecord.create({...});

        return updatedUser;
      });

      const nextLevelConfig = CLOUD_SHOP_LEVELS[upgradeCheck.nextLevel];

      logger.info('云店升级成功', {
        userId,
        previousLevel: upgradeCheck.currentLevel,
        newLevel: upgradeCheck.nextLevel,
        newLevelName: nextLevelConfig?.name
      });

      return {
        success: true,
        previousLevel: upgradeCheck.currentLevel,
        newLevel: upgradeCheck.nextLevel,
        message: `恭喜升级到${nextLevelConfig?.name}！`
      };
    } catch (error) {
      logger.error('云店升级失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        previousLevel: 0,
        newLevel: 0,
        message: '升级失败，请稍后重试'
      };
    }
  }

  /**
   * 购买五通店
   */
  async purchaseWutongShop(
    userId: string,
    params: PurchaseWutongShopParams
  ): Promise<PurchaseWutongShopResult> {
    try {
      // 1. 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, level: true, status: true, pointsBalance: true, shops: true }
      });

      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      if (user.status !== 'ACTIVE') {
        return {
          success: false,
          message: '用户账户状态异常'
        };
      }

      // 2. 检查是否已有五通店
      const existingWutongShop = user.shops?.find(shop => shop.shopType === ShopType.WUTONG);
      if (existingWutongShop) {
        return {
          success: false,
          message: '已拥有五通店，每个用户仅可拥有一个'
        };
      }

      // 3. 生成订单号
      const orderNo = this.generateOrderNo();

      // 4. 创建五通店和支付订单
      const result = await prisma.$transaction(async (tx) => {
        // 创建五通店
        const wutongShop = await tx.shop.create({
          data: {
            userId,
            shopType: ShopType.WUTONG,
            shopName: `${user.id.substring(0, 8)}的五通店`,
            contactName: params.contactName,
            contactPhone: params.contactPhone,
            address: params.address || null,
            shopLevel: 1,
            status: ShopStatus.PENDING // 待支付
          }
        });

        // 标记用户拥有五通店
        await tx.user.update({
          where: { id: userId },
          data: { hasWutongShop: true }
        });

        // TODO: 这里应该调用支付服务创建支付订单
        // 现在假设支付成功
        // await tx.paymentOrder.create({...});

        return wutongShop;
      });

      logger.info('五通店购买申请创建成功', {
        userId,
        shopId: result.id,
        orderNo,
        amount: WUTONG_SHOP_CONFIG.entryFee
      });

      return {
        success: true,
        shopId: result.id,
        orderNo,
        message: '五通店申请已创建，请完成支付',
        paymentInfo: {
          amount: WUTONG_SHOP_CONFIG.entryFee,
          method: params.paymentMethod,
          status: 'PENDING'
        }
      };
    } catch (error) {
      logger.error('购买五通店失败', {
        userId,
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        message: '购买失败，请稍后重试'
      };
    }
  }

  /**
   * 确认五通店支付（支付成功回调）
   */
  async confirmWutongShopPayment(shopId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { id: true, userId: true, shopType: true, status: true, contactName: true, contactPhone: true, address: true }
      });

      if (!shop) {
        return {
          success: false,
          message: '店铺不存在'
        };
      }

      if (shop.shopType !== ShopType.WUTONG) {
        return {
          success: false,
          message: '该店铺不是五通店'
        };
      }

      // 使用五通店服务处理升级特权
      const upgradeResult = await wutongService.openWutongShopWithUpgrade(shop.userId, {
        contactName: shop.contactName || '',
        contactPhone: shop.contactPhone || '',
        address: shop.address || undefined
      });

      if (!upgradeResult.success) {
        return {
          success: false,
          message: upgradeResult.message
        };
      }

      logger.info('五通店支付确认成功', {
        shopId,
        userId: shop.userId,
        upgradeResult
      });

      return {
        success: true,
        message: upgradeResult.message
      };
    } catch (error) {
      logger.error('确认五通店支付失败', {
        shopId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        message: '确认失败，请稍后重试'
      };
    }
  }

  /**
   * 获取店铺信息
   */
  async getShopInfo(shopId: string): Promise<ShopInfo | null> {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        include: {
          user: {
            select: { id: true, level: true }
          }
        }
      });

      if (!shop) {
        return null;
      }

      const levelName = shop.shopType === ShopType.CLOUD
        ? CLOUD_SHOP_LEVELS[shop.shopLevel]?.name
        : WUTONG_SHOP_CONFIG.name;

      const benefits = shop.shopType === ShopType.CLOUD
        ? this.getCloudShopBenefits(shop.shopLevel)
        : this.getWutongShopBenefits();

      return {
        id: shop.id,
        userId: shop.userId,
        shopType: shop.shopType,
        shopName: (shop.shopName || undefined) as string | null,
        shopDescription: (shop.shopDescription || undefined) as string | null,
        contactName: (shop.contactName || undefined) as string | null,
        contactPhone: (shop.contactPhone || undefined) as string | null,
        address: (shop.address || undefined) as string | null,
        shopLevel: shop.shopLevel,
        status: shop.status,
        totalSales: shop.totalSales,
        totalOrders: shop.totalOrders,
        totalRevenue: shop.totalRevenue,
        createdAt: shop.createdAt,
        updatedAt: shop.updatedAt,
        levelName,
        benefits
      };
    } catch (error) {
      logger.error('获取店铺信息失败', {
        shopId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }

  /**
   * 获取用户的店铺列表
   */
  async getUserShops(userId: string): Promise<ShopInfo[]> {
    try {
      const shops = await prisma.shop.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      return shops.map(shop => {
        const levelName = shop.shopType === ShopType.CLOUD
          ? CLOUD_SHOP_LEVELS[shop.shopLevel]?.name
          : WUTONG_SHOP_CONFIG.name;

        const benefits = shop.shopType === ShopType.CLOUD
          ? this.getCloudShopBenefits(shop.shopLevel)
          : this.getWutongShopBenefits();

        return {
          id: shop.id,
          userId: shop.userId,
          shopType: shop.shopType,
          shopName: shop.shopName,
          shopDescription: shop.shopDescription,
          contactName: shop.contactName,
          contactPhone: shop.contactPhone,
          address: shop.address,
          shopLevel: shop.shopLevel,
          status: shop.status,
          totalSales: shop.totalSales,
          totalOrders: shop.totalOrders,
          totalRevenue: shop.totalRevenue,
          createdAt: shop.createdAt,
          updatedAt: shop.updatedAt,
          levelName,
          benefits
        };
      });
    } catch (error) {
      logger.error('获取用户店铺列表失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 获取云店权益
   */
  private getCloudShopBenefits(level: number): any {
    const config = CLOUD_SHOP_LEVELS[level];
    if (!config) return null;

    return {
      level: config.level,
      name: config.name,
      purchaseDiscount: config.purchaseDiscount,
      monthlyTarget: config.monthlyTarget,
      estimatedMonthlyCommission: config.monthlyCommission,
      benefits: [
        `进货折扣：${(config.purchaseDiscount * 100).toFixed(0)}折`,
        `月采购目标：${config.monthlyTarget.toLocaleString()}元`,
        `预估月收益：${config.monthlyCommission.toLocaleString()}元`,
        '可获得佣金',
        '有团队管理工具'
      ]
    };
  }

  /**
   * 获取五通店权益
   */
  private getWutongShopBenefits(): any {
    return {
      name: WUTONG_SHOP_CONFIG.name,
      entryFee: WUTONG_SHOP_CONFIG.entryFee,
      benefits: WUTONG_SHOP_CONFIG.upgradeRights,
      specialFeature: `买${Math.floor(1 / WUTONG_SHOP_CONFIG.giftRatio)}赠1`,
      giftDetails: `满${WUTONG_SHOP_CONFIG.giftThreshold}元送${WUTONG_SHOP_CONFIG.giftValue}元商品`
    };
  }

  /**
   * 获取店铺统计信息
   */
  async getShopStatistics(shopId: string): Promise<ShopStatistics | null> {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: {
          id: true,
          totalSales: true,
          totalOrders: true,
          totalRevenue: true
        }
      });

      if (!shop) {
        return null;
      }

      // TODO: 从订单表计算月度数据
      const monthlyRevenue = 0; // 待实现
      const monthlyOrders = 0;

      return {
        shopId: shop.id,
        totalSales: shop.totalSales,
        totalOrders: shop.totalOrders,
        totalRevenue: shop.totalRevenue,
        monthlyRevenue,
        monthlyOrders,
        averageOrderValue: shop.totalOrders > 0 ? shop.totalRevenue / shop.totalOrders : 0,
        customerCount: 0, // TODO: 从订单表计算
        repeatCustomerRate: 0 // TODO: 从订单表计算
      };
    } catch (error) {
      logger.error('获取店铺统计失败', {
        shopId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }

  /**
   * 获取云店等级的权益说明
   */
  private getLevelBenefits(level: number): string[] {
    const config = CLOUD_SHOP_LEVELS[level];
    if (!config) {
      return [];
    }

    return [
      `进货折扣: ${(config.purchaseDiscount * 100).toFixed(0)}折`,
      `月采购目标: ${config.monthlyTarget}元`,
      `预期月收益: ${config.monthlyCommission}元`,
      `团队要求: ${config.minTeamSize}人`,
      `直推成员: ${config.minDirectMembers}人`
    ];
  }

  /**
   * 验证购买五通店的参数
   */
  private validateWutongPurchaseParams(params: PurchaseWutongShopParams): { valid: boolean; message?: string } {
    if (!params.contactName || params.contactName.trim().length === 0) {
      return { valid: false, message: '请输入联系人名称' };
    }

    if (!params.contactPhone || params.contactPhone.trim().length === 0) {
      return { valid: false, message: '请输入联系人电话' };
    }

    // 基本的电话号码验证
    if (!/^1[3-9]\d{9}$/.test(params.contactPhone.trim())) {
      return { valid: false, message: '请输入有效的手机号码' };
    }

    if (!params.paymentMethod || !['wechat', 'alipay', 'bank'].includes(params.paymentMethod)) {
      return { valid: false, message: '请选择有效的支付方式' };
    }

    return { valid: true };
  }

  /**
   * 生成订单号
   */
  private generateOrderNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `SHOP${timestamp}${random}`.toUpperCase();
  }

  /**
   * 获取五通店权益（委托给五通店服务）
   */
  async getWutongBenefits(userId: string) {
    return await wutongService.validateWutongQualification(userId);
  }

  /**
   * 计算五通店买10赠1权益（委托给五通店服务）
   */
  async calculateWutongBenefit(userId: string, cartItems: any[]) {
    return await wutongService.calculateWutongBenefit(userId, cartItems);
  }

  /**
   * 记录五通店赠品发放（委托给五通店服务）
   */
  async recordWutongGiftDistribution(userId: string, orderId: string, freeProducts: any[]) {
    return await wutongService.recordGiftDistribution(userId, orderId, freeProducts);
  }

  /**
   * 获取五通店统计数据（委托给五通店服务）
   */
  async getWutongStatistics(userId: string) {
    return await wutongService.getWutongStatistics(userId);
  }

  /**
   * 开通五通店（委托给五通店服务）
   */
  async openWutongShopWithUpgrade(userId: string, contactInfo: {
    contactName: string;
    contactPhone: string;
    address?: string;
  }) {
    return await wutongService.openWutongShopWithUpgrade(userId, contactInfo);
  }
}

// 导出单例
export const shopService = new ShopService();
