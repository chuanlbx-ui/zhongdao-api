/**
 * Prisma类型扩展
 * 为Prisma生成的类型添加额外的属性和方法
 */

import { User, UserLevel, Role, Shop, Product, Order } from '@prisma/client';

// 扩展用户类型
export interface ExtendedUser extends User {
  // 计算属性
  isVip: boolean;
  shopLevel: number;
  canCreateShop: boolean;

  // 关联数据（可选）
  shop?: Shop | null;
  parent?: User | null;
  children?: User[];
  directSubordinatesCount: number;
  teamSize: number;

  // 性能指标
  totalSales: number;
  totalOrders: number;
  totalCommission: number;

  // 权限检查
  hasPermission(permission: string): boolean;
  canAccessLevel(level: UserLevel): boolean;
}

// 扩展店铺类型
export interface ExtendedShop extends Shop {
  // 计算属性
  isActive: boolean;
  levelProgress: {
    current: number;
    required: number;
    percentage: number;
  };

  // 关联数据
  owner?: User | null;
  products?: Product[];
  inventory?: Array<{
    productId: string;
    quantity: number;
    reserved: number;
    available: number;
  }>;

  // 统计数据
  totalProducts: number;
  totalSales: number;
  totalOrders: number;
  averageRating: number;
}

// 扩展产品类型
export interface ExtendedProduct extends Product {
  // 计算属性
  isAvailable: boolean;
  discountRate?: number;
  finalPrice: number;

  // 关联数据
  category?: {
    id: string;
    name: string;
    parentId?: string;
  } | null;
  tags?: Array<{
    id: string;
    name: string;
  }>;

  // 库存信息
  stockInfo: {
    total: number;
    available: number;
    reserved: number;
    warehouse: string;
  };

  // 价格历史
  priceHistory: Array<{
    price: number;
    effectiveDate: Date;
  }>;

  // 评级信息
  ratingInfo: {
    average: number;
    count: number;
    distribution: Record<number, number>;
  };
}

// 扩展订单类型
export interface ExtendedOrder extends Order {
  // 计算属性
  canCancel: boolean;
  canRefund: boolean;
  isExpired: boolean;

  // 关联数据
  buyer?: User | null;
  seller?: User | null;
  items?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    totalPrice: number;
  }>;

  // 支付信息
  paymentInfo: {
    method: string;
    status: string;
    transactionId?: string;
    paidAt?: Date;
  };

  // 物流信息
  shippingInfo: {
    method: string;
    status: string;
    trackingNumber?: string;
    shippedAt?: Date;
    deliveredAt?: Date;
  };
}

// 等级升级要求
export interface LevelUpgradeRequirement {
  level: UserLevel;
  requirements: {
    minOrders: number;
    minSalesAmount: number;
    minTeamSize: number;
    minSubordinateLevel?: UserLevel;
  };
  benefits: {
    commissionRate: number;
    maxShopLevel: number;
    specialPrivileges: string[];
  };
}

// 佣金计算配置
export interface CommissionConfig {
  levels: Record<UserLevel, {
    directRate: number;
    referralRates: number[];
    teamBonusRate: number;
  }>;
  minWithdrawAmount: number;
  withdrawalMethods: Array<{
    id: string;
    name: string;
    feeRate: number;
    minAmount: number;
    maxAmount: number;
  }>;
}

// 团队层级结构
export interface TeamHierarchy {
  userId: string;
  level: UserLevel;
  children: TeamHierarchy[];
  depth: number;
  totalMembers: number;
}

// 库存变动记录
export interface InventoryMovement {
  id: string;
  productId: string;
  warehouseId: string;
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUST';
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  referenceId?: string;
  createdAt: Date;
}

// 价格层级
export interface PriceTier {
  productId: string;
  userLevel: UserLevel;
  price: number;
  minQuantity: number;
  effectiveDate: Date;
  expiryDate?: Date;
}

// 审计日志扩展
export interface AuditLogExtension {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  userId: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  createdAt: Date;
}