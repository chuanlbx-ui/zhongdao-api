/**
 * 店铺管理模块 - 类型定义
 * 包含云店和五通店的数据结构
 */

import { shops_shopType as ShopType, shops_status as ShopStatus } from '@prisma/client';

// ==================== 云店配置 ====================

/**
 * 云店等级配置
 * 基于销售额自动升级
 */
export interface CloudShopLevelConfig {
  level: number;
  name: string;
  minBottles: number; // 最低瓶数（599元为1瓶基准）
  minTeamSize: number; // 最小团队规模
  minDirectMembers: number; // 最小直推人数
  purchaseDiscount: number; // 进货折扣 (4折 = 0.4)
  monthlyTarget: number; // 月采购目标（元）
  monthlyCommission: number; // 典型月收益（元）
  description: string;
}

/**
 * 云店配置常量
 */
export const CLOUD_SHOP_LEVELS: Record<number, CloudShopLevelConfig> = {
  1: {
    level: 1,
    name: '一星店长',
    minBottles: 4,
    minTeamSize: 0,
    minDirectMembers: 0,
    purchaseDiscount: 0.4,
    monthlyTarget: 2400,
    monthlyCommission: 600,
    description: '基础店长等级，无团队要求'
  },
  2: {
    level: 2,
    name: '二星店长',
    minBottles: 20,
    minTeamSize: 2,
    minDirectMembers: 2,
    purchaseDiscount: 0.35,
    monthlyTarget: 12000,
    monthlyCommission: 3000,
    description: '需要2个一星店长直推'
  },
  3: {
    level: 3,
    name: '三星店长',
    minBottles: 120,
    minTeamSize: 4,
    minDirectMembers: 2,
    purchaseDiscount: 0.3,
    monthlyTarget: 72000,
    monthlyCommission: 15000,
    description: '需要2个二星店长直推'
  },
  4: {
    level: 4,
    name: '四星店长',
    minBottles: 600,
    minTeamSize: 8,
    minDirectMembers: 2,
    purchaseDiscount: 0.26,
    monthlyTarget: 360000,
    monthlyCommission: 72000,
    description: '需要2个三星店长直推'
  },
  5: {
    level: 5,
    name: '五星店长',
    minBottles: 2400,
    minTeamSize: 16,
    minDirectMembers: 2,
    purchaseDiscount: 0.24,
    monthlyTarget: 1200000,
    monthlyCommission: 288000,
    description: '需要2个四星店长直推'
  },
  6: {
    level: 6,
    name: '董事',
    minBottles: 12000,
    minTeamSize: 32,
    minDirectMembers: 2,
    purchaseDiscount: 0.22,
    monthlyTarget: 6000000,
    monthlyCommission: 1320000,
    description: '需要2个五星店长直推'
  }
};

// ==================== 五通店配置 ====================

/**
 * 五通店配置
 * 一次性拿货100瓶 × 270元/瓶 = 27,000元
 */
export interface WutongShopConfig {
  name: string;
  entryFee: number; // 进入费用（27,000元）
  bottleCount: number; // 拿货数量（100瓶）
  unitPrice: number; // 单价（270元/瓶）
  giftRatio: number; // 赠送比例（满5999元送599元）
  giftThreshold: number; // 赠送门槛（5999元）
  giftValue: number; // 赠送价值（599元）
  upgradeRights: string[]; // 升级权益
  description: string;
}

export const WUTONG_SHOP_CONFIG: WutongShopConfig = {
  name: '五通店',
  entryFee: 27000,
  bottleCount: 100,
  unitPrice: 270,
  giftRatio: 0.1, // 10%赠送比例
  giftThreshold: 5999,
  giftValue: 599,
  upgradeRights: [
    '买10赠1机制（终身）',
    '可直接升级为二星店长',
    '优先销售权'
  ],
  description: '一次性拿货27,000元，终身享受买10赠1机制'
};

// ==================== 店铺申请 ====================

/**
 * 开店申请参数
 */
export interface ApplyShopParams {
  shopType: ShopType;
  shopName?: string;
  shopDescription?: string;
  contactName: string;
  contactPhone: string;
  address?: string;
}

/**
 * 开店申请结果
 */
export interface ApplyShopResult {
  success: boolean;
  shopId?: string | undefined;
  message: string;
  requiresApproval?: boolean | undefined;
  fee?: number | undefined;
}

// ==================== 云店升级 ====================

/**
 * 云店升级条件检查结果
 */
export interface CloudShopUpgradeCheckResult {
  canUpgrade: boolean;
  currentLevel: number;
  nextLevel?: number | undefined;
  reasons: string[];
  currentStats?: {
    totalBottles: number;
    directMembers: number;
    teamSize: number;
  } | undefined;
  requirements?: CloudShopLevelConfig | undefined;
}

/**
 * 云店升级结果
 */
export interface CloudShopUpgradeResult {
  success: boolean;
  previousLevel: number;
  newLevel: number;
  message: string;
}

// ==================== 五通店升级 ====================

/**
 * 五通店购买参数
 */
export interface PurchaseWutongShopParams {
  userId: string;
  contactName: string;
  contactPhone: string;
  address?: string;
  paymentMethod: 'wechat' | 'alipay' | 'bank';
}

/**
 * 五通店购买结果
 */
export interface PurchaseWutongShopResult {
  success: boolean;
  shopId?: string;
  orderNo?: string;
  message: string;
  paymentInfo?: {
    amount: number;
    method: string;
    status: string;
  };
}

// ==================== 店铺信息 ====================

/**
 * 完整的店铺信息
 */
export interface ShopInfo {
  id: string;
  userId: string;
  shopType: ShopType;
  shopName?: string | null;
  shopDescription?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  shopLevel: number;
  status: ShopStatus;
  totalSales: number;
  totalOrders: number;
  totalRevenue: number;
  createdAt: Date;
  updatedAt: Date;
  levelName?: string | undefined;
  benefits?: any | undefined;
}

/**
 * 店铺统计信息
 */
export interface ShopStatistics {
  shopId: string;
  totalSales: number;
  totalOrders: number;
  totalRevenue: number;
  monthlyRevenue: number;
  monthlyOrders: number;
  averageOrderValue: number;
  customerCount: number;
  repeatCustomerRate: number;
}

// ==================== 店铺验证 ====================

/**
 * 店铺权限验证结果
 */
export interface ShopPermissionCheckResult {
  hasShop: boolean;
  shopId?: string;
  shopType?: ShopType;
  canUpgrade?: boolean;
  canApply?: boolean;
  reasons: string[];
}

/**
 * 开店权限验证结果
 */
export interface CanApplyShopResult {
  canApply: boolean;
  reasons: string[];
  requiredLevel?: string | undefined;
  fee?: number | undefined;
}
