#!/usr/bin/env tsx

/**
 * 简化版：生成前端TypeScript类型定义
 * 基于Prisma Schema手动生成类型
 */

import fs from 'fs';
import path from 'path';

/**
 * 生成前端类型定义
 */
function generateFrontendTypes() {
  console.log('🔄 正在生成前端类型定义...');

  const types = `// 自动生成的类型定义 - 请勿手动修改
// Generated at: ${new Date().toISOString()}

// ===========================================
// 基础类型定义
// ===========================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface PaginationParams {
  page?: number;
  perPage?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface QueryParams extends PaginationParams, SortParams {
  search?: string;
  filters?: Record<string, any>;
}

// ===========================================
// 用户相关类型
// ===========================================

export type UserLevel = 'NORMAL' | 'VIP' | 'STAR_1' | 'STAR_2' | 'STAR_3' | 'STAR_4' | 'STAR_5' | 'DIRECTOR';
export type UserStatus = 'active' | 'inactive' | 'frozen';

export interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatar?: string;
  level: UserLevel;
  status: UserStatus;
  parentId?: string;
  teamPath?: string;
  inviteCode: string;
  totalOrders: number;
  totalAmount: number;
  monthAmount: number;
  directMembers: number;
  teamMembers: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateUserInput {
  phone: string;
  nickname?: string;
  avatar?: string;
  parentId?: string;
  inviteCode: string;
}

export interface UpdateUserInput {
  nickname?: string;
  avatar?: string;
  status?: UserStatus;
}

// ===========================================
// 认证相关类型
// ===========================================

export interface LoginRequest {
  code?: string;
  phone?: string;
  verificationCode?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterRequest {
  phone: string;
  verificationCode: string;
  nickname?: string;
  inviteCode?: string;
}

// ===========================================
// 商品相关类型
// ===========================================

export interface ProductCategory {
  id: string;
  name: string;
  icon?: string;
  level: number;
  parentId?: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  images: string[];
  video?: string;
  categoryId: string;
  price: number;
  originalPrice?: number;
  stock: number;
  sales: number;
  status: 'active' | 'inactive' | 'out_of_stock';
  tags?: string[];
  specifications?: Record<string, any>;
  createdBy: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  images: string[];
  video?: string;
  categoryId: string;
  price: number;
  originalPrice?: number;
  stock: number;
  tags?: string[];
  specifications?: Record<string, any>;
}

export interface ProductListResponse {
  products: Product[];
  categories: ProductCategory[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// ===========================================
// 订单相关类型
// ===========================================

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentMethod = 'wechat' | 'alipay' | 'points' | 'mixed';

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
  specifications?: Record<string, any>;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
}

export interface Order {
  id: string;
  userId: string;
  orderNo: string;
  items: OrderItem[];
  totalAmount: number;
  shippingFee: number;
  discountAmount: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  shippingAddress: ShippingAddress;
  remark?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateOrderRequest {
  items: Array<{
    productId: string;
    quantity: number;
    specifications?: Record<string, any>;
  }>;
  shippingAddress: ShippingAddress;
  remark?: string;
}

// ===========================================
// 店铺相关类型
// ===========================================

export type ShopType = 'CLOUD' | 'WUTONG';

export interface Shop {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  banner?: string;
  ownerId: string;
  type: ShopType;
  level: number;
  status: 'active' | 'inactive';
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ===========================================
// 积分相关类型
// ===========================================

export type TransactionType = 'PURCHASE' | 'TRANSFER' | 'RECHARGE' | 'WITHDRAW' | 'COMMISSION' | 'GIFT' | 'REFUND';

export interface PointsTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balance: number;
  fromUserId?: string;
  toUserId?: string;
  relatedOrderId?: string;
  description?: string;
  status: 'success' | 'pending' | 'failed';
  createdAt: Date | string;
}

export interface TransferPointsRequest {
  toUserId: string;
  amount: number;
  remark?: string;
}

export interface PointsBalance {
  balance: number;
  frozenAmount: number;
  totalIncome: number;
  totalExpense: number;
}

// ===========================================
// 团队相关类型
// ===========================================

export interface TeamMember {
  user: User;
  level: UserLevel;
  joinDate: Date | string;
  performance: {
    totalOrders: number;
    totalAmount: number;
    monthAmount: number;
  };
}

export interface TeamStats {
  totalMembers: number;
  directMembers: number;
  indirectMembers: number;
  levelDistribution: Record<UserLevel, number>;
  performance: {
    totalOrders: number;
    totalAmount: number;
    monthAmount: number;
  };
}

// ===========================================
// 库存相关类型
// ===========================================

export type WarehouseType = 'PLATFORM' | 'CLOUD' | 'LOCAL';

export interface InventoryItem {
  id: string;
  productId: string;
  warehouseType: WarehouseType;
  shopId?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  warningThreshold: number;
  lastCheckAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Stock {
  id: string;
  inventoryItemId: string;
  batchNumber?: string;
  quantity: number;
  availableQuantity: number;
  manufactureDate?: Date;
  expiryDate?: Date;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ===========================================
// 文件上传类型
// ===========================================

export interface UploadResponse {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface UploadRequest {
  file: File;
  type?: 'image' | 'video' | 'document';
  category?: string;
}

// ===========================================
// 通知相关类型
// ===========================================

export type NotificationType = 'system' | 'order' | 'promotion' | 'security';
export type NotificationChannel = 'app' | 'sms' | 'email' | 'wechat';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  data?: Record<string, any>;
  readAt?: Date | string;
  createdAt: Date | string;
}

export interface NotificationSettings {
  userId: string;
  channels: Record<NotificationChannel, boolean>;
  types: Record<NotificationType, boolean>;
}

// ===========================================
// 报表相关类型
// ===========================================

export interface SalesReport {
  date: string;
  totalOrders: number;
  totalAmount: number;
  totalUsers: number;
  activeUsers: number;
  conversionRate: number;
}

export interface CommissionReport {
  period: string;
  totalCommission: number;
  directCommission: number;
  indirectCommission: number;
  teamBonus: number;
  levelBonus: number;
}

// ===========================================
// 枚举类型
// ===========================================

export const UserLevelEnum = {
  NORMAL: 'NORMAL',
  VIP: 'VIP',
  STAR_1: 'STAR_1',
  STAR_2: 'STAR_2',
  STAR_3: 'STAR_3',
  STAR_4: 'STAR_4',
  STAR_5: 'STAR_5',
  DIRECTOR: 'DIRECTOR'
} as const;

export const OrderStatusEnum = {
  PENDING: 'pending',
  PAID: 'paid',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
} as const;

export const PaymentMethodEnum = {
  WECHAT: 'wechat',
  ALIPAY: 'alipay',
  POINTS: 'points',
  MIXED: 'mixed'
} as const;
`;

  // 确保前端目录存在
  const frontendTypesDir = path.join('D:/wwwroot/zhongdao-h5/src/types');
  if (!fs.existsSync(frontendTypesDir)) {
    fs.mkdirSync(frontendTypesDir, { recursive: true });
  }

  // 写入类型文件
  const typesFile = path.join(frontendTypesDir, 'api.types.ts');
  fs.writeFileSync(typesFile, types, 'utf-8');

  // 更新索引文件
  const indexContent = `// 导出所有类型定义
export * from './api.types';
export * from './auth.types';
export * from './common.types';

// API错误码映射
export const ErrorCodeMap = {
  // 认证相关
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // 业务相关
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_STATUS_ERROR: 'ORDER_STATUS_ERROR',

  // 验证相关
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PHONE: 'INVALID_PHONE',
  INVALID_VERIFICATION_CODE: 'INVALID_VERIFICATION_CODE',
  VERIFICATION_CODE_EXPIRED: 'VERIFICATION_CODE_EXPIRED',

  // 系统相关
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;
`;

  fs.writeFileSync(path.join(frontendTypesDir, 'index.ts'), indexContent, 'utf-8');

  console.log('✅ 类型定义生成完成:', typesFile);
  console.log('✅ 索引文件更新完成:', path.join(frontendTypesDir, 'index.ts'));
}

// 执行生成
generateFrontendTypes();