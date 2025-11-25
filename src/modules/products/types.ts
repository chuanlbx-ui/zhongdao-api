import { UserLevel } from '../user/level.service';

/**
 * 定价相关类型定义
 */

// 价格计算参数
export interface PriceCalculationParams {
  productId: string;
  userLevel: UserLevel;
  specId?: string;
  quantity?: number;
}

// 价格结果
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

// 特殊定价规则类型
export enum SpecialPricingRuleType {
  FIXED_PRICE = 'FIXED_PRICE',     // 固定价格
  DISCOUNT_RATE = 'DISCOUNT_RATE', // 折扣率
  DISCOUNT_AMOUNT = 'DISCOUNT_AMOUNT' // 折扣金额
}

// 特殊定价规则
export interface SpecialPricingRule {
  id: string;
  productId: string;
  specId?: string;
  userLevel: UserLevel;
  ruleType: SpecialPricingRuleType;
  ruleValue: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  maxQuantity?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 价格统计信息
export interface PriceStats {
  totalProducts: number;
  productsWithSpecialPricing: number;
  averageDiscountRate: number;
  levelDistribution: Record<UserLevel, number>;
}

// 定价配置
export interface PricingConfig {
  enableCache: boolean;
  cacheTTL: number;
  defaultDiscountRate: number;
  maxDiscountRate: number;
  minPrice: number;
}

// 价格变更记录
export interface PriceChangeRecord {
  id: string;
  productId: string;
  specId?: string;
  userLevel: UserLevel;
  oldPrice: number;
  newPrice: number;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  reason?: string;
  changedBy: string;
  changedAt: Date;
}

// 价格审批流程
export interface PriceApproval {
  id: string;
  productId: string;
  specId?: string;
  userLevel: UserLevel;
  requestedPrice: number;
  currentPrice?: number;
  requestReason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
}

// 定价策略
export interface PricingStrategy {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  rules: Array<{
    userLevel: UserLevel;
    discountRate: number;
    minQuantity?: number;
    maxQuantity?: number;
    startDate?: Date;
    endDate?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// 价格导入/导出
export interface PriceImportExport {
  productId: string;
  productName: string;
  specId?: string;
  specName?: string;
  userLevel: UserLevel;
  userLevelName: string;
  basePrice: number;
  specialPrice?: number;
  discountRate?: number;
  isActive: boolean;
  lastUpdated: Date;
}

// 价格分析报告
export interface PricingAnalysisReport {
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalProducts: number;
    totalPricingRules: number;
    averageDiscountRate: number;
    totalDiscountAmount: number;
  };
  levelAnalysis: Array<{
    userLevel: UserLevel;
    productCount: number;
    averageDiscountRate: number;
    totalDiscountAmount: number;
  }>;
  topDiscountedProducts: Array<{
    productId: string;
    productName: string;
    maxDiscountRate: number;
    averageDiscountRate: number;
  }>;
  pricingTrends: Array<{
    date: Date;
    averageDiscountRate: number;
    totalDiscountAmount: number;
  }>;
}

// 定价错误类型
export enum PricingError {
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  INVALID_USER_LEVEL = 'INVALID_USER_LEVEL',
  INVALID_PRICE = 'INVALID_PRICE',
  SPEC_NOT_FOUND = 'SPEC_NOT_FOUND',
  PRICING_NOT_FOUND = 'PRICING_NOT_FOUND',
  CALCULATION_ERROR = 'CALCULATION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR'
}

// 定价API响应
export interface PricingApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: PricingError;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: Date;
    requestId: string;
    version: string;
  };
}