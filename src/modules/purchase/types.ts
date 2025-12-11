import { UserLevel } from '../user/level.service';

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

// 采购限制
export interface PurchaseRestrictions {
  maxQuantity?: number;
  minLevel?: UserLevel;
  requiredTeamSize?: number;
}

// 用户信息（用于验证）
export interface UserForValidation {
  id: string;
  level: UserLevel;
  status: string;
  parentId?: string;
  teamPath?: string;
}

// 团队关系验证结果
export interface TeamRelationshipResult {
  isValid: boolean;
  distance: number;
  path: string[];
  commonAncestor?: string;
}

// 等级比较结果
export interface LevelComparisonResult {
  isValid: boolean;
  buyerLevel: UserLevel;
  sellerLevel: UserLevel;
  buyerLevelIndex: number;
  sellerLevelIndex: number;
  result: 'valid' | 'seller_level_too_low' | 'final_validation_failed';
  searchPath?: string[];
  finalSellerLevel?: UserLevel;
  finalSellerId?: string;
}

// 上级链查找结果
export interface UplineSearchResult {
  user: UserForValidation;
  level: UserLevel;
  searchPath: string[];
}

// 供应链路径
export interface SupplyChainPath {
  path: Array<{
    userId: string;
    level: UserLevel;
    distance: number;
  }>;
  totalDistance: number;
  isValid: boolean;
}

// 佣金计算参数
export interface CommissionCalculationParams {
  orderId: string;
  sellerId: string;
  totalAmount: number;
  sellerLevel: UserLevel;
  maxDepth?: number;
}

// 佣金记录
export interface CommissionRecord {
  id: string;
  userId: string;
  orderId: string;
  amount: number;
  rate: number;
  level: number;
  sourceUserId: string;
  sourceType: string;
  status: string;
  metadata?: Record<string, any>;
}

// 性能统计
export interface PerformanceStats {
  totalValidations: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  cacheHitRate: number;
  cacheSize: {
    user: number;
    product: number;
    uplineChain: number;
  };
}

// 库存验证结果
export interface StockValidationResult {
  isValid: boolean;
  reasons: string[];
  availableStock: number;
  requestedQuantity: number;
}