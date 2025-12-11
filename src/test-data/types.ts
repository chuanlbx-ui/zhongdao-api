/**
 * 测试数据类型定义
 */

export interface TestDataConfig {
  userLevels: {
    normal: number;    // 普通用户数量
    vip: number;       // VIP用户数量
    star1: number;     // 1星店长数量
    star2: number;     // 2星店长数量
    star3: number;     // 3星店长数量
    star4: number;     // 4星店长数量
    star5: number;     // 5星店长数量
    director: number;  // 董事数量
  };
  shops: {
    cloud: number;     // 云店数量
    wutong: number;    // 五通店数量
  };
  products: {
    categories: number;        // 商品分类数量
    products: number;          // 商品总数
    variantsPerProduct: number; // 每个商品规格数
  };
  orders: {
    pending: number;    // 待处理订单数
    paid: number;       // 已支付订单数
    delivered: number;  // 已交付订单数
    cancelled: number;  // 已取消订单数
  };
  inventory: {
    items: number;           // 库存项目数
    lowStockThreshold: number; // 低库存阈值
  };
}

export interface GeneratedUser {
  id: string;
  openid: string;
  nickname: string;
  avatarUrl?: string;
  phone?: string;
  level: string;
  status: string;
  parentId?: string;
  teamPath?: string;
  teamLevel: number;
  totalSales: number;
  totalBottles: number;
  directSales: number;
  teamSales: number;
  directCount: number;
  teamCount: number;
  cloudShopLevel?: number;
  hasWutongShop: boolean;
  pointsBalance: number;
  pointsFrozen: number;
  lastLoginAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedShop {
  id: string;
  userId: string;
  shopType: string;
  shopName: string;
  shopLevel: number;
  status: string;
  contactName: string;
  contactPhone: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedProduct {
  id: string;
  name: string;
  code: string;
  sku: string;
  description?: string;
  basePrice: number;
  originalPrice: number;
  costPrice: number;
  status: string;
  categoryId: string;
  images: string[];
  specifications: Record<string, any>;
  shopType: string;
  createdBy: string;
  updatedBy: string;
  tags: string[];
  isActive: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedOrder {
  id: string;
  orderNo: string;
  buyerId: string;
  sellerId?: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  deliveryAddress: Record<string, any>;
  orderItems: GeneratedOrderItem[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedOrderItem {
  id: string;
  orderId: string;
  productId: string;
  productVariantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specifications: Record<string, any>;
}

export interface GeneratedPointsTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balance: number;
  relatedUserId?: string;
  relatedOrderId?: string;
  description?: string;
  metadata: Record<string, any>;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WutongBenefitScenario {
  userId: string;
  shopId: string;
  orders: GeneratedOrder[];
  gifts: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
  }[];
  totalSavings: number;
}

export interface UserLevelUpgradeScenario {
  userId: string;
  upgradePath: {
    fromLevel: string;
    toLevel: string;
    upgradedAt: Date;
    requirements: Record<string, any>;
  }[];
  commissions: GeneratedPointsTransaction[];
}