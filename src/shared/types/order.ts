import { UserLevel } from '@/modules/user/level.service';
import { PurchaseStatus } from '@/modules/purchase/purchase.service';

// 订单类型枚举
export enum OrderType {
  RETAIL = 'RETAIL',           // 零售订单 (店长→消费者)
  PURCHASE = 'PURCHASE',       // 采购订单 (下级→上级)
  TEAM = 'TEAM',              // 团队订单 (平台→店长)
  EXCHANGE = 'EXCHANGE'        // 换货订单 (店长间换货)
}

// 订单状态枚举
export enum OrderStatus {
  PENDING = 'PENDING',         // 待付款
  PAID = 'PAID',              // 已付款
  PROCESSING = 'PROCESSING',   // 处理中
  SHIPPED = 'SHIPPED',         // 已发货
  DELIVERED = 'DELIVERED',     // 已送达
  COMPLETED = 'COMPLETED',     // 已完成
  CANCELLED = 'CANCELLED',     // 已取消
  REFUNDED = 'REFUNDED'        // 已退款
}

// 支付方式枚举
export enum PaymentMethod {
  WECHAT = 'WECHAT',           // 微信支付
  ALIPAY = 'ALIPAY',          // 支付宝
  POINTS = 'POINTS',           // 积分转账
  MIXED = 'MIXED'             // 混合支付
}

// 支付状态枚举
export enum PaymentStatus {
  UNPAID = 'UNPAID',           // 未支付
  PAYING = 'PAYING',           // 支付中
  PAID = 'PAID',              // 已支付
  FAILED = 'FAILED',           // 支付失败
  REFUNDING = 'REFUNDING',     // 退款中
  REFUNDED = 'REFUNDED'        // 已退款
}

// 物流状态枚举
export enum LogisticsStatus {
  NOT_SHIPPED = 'NOT_SHIPPED', // 未发货
  SHIPPED = 'SHIPPED',         // 已发货
  IN_TRANSIT = 'IN_TRANSIT',   // 运输中
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY', // 派送中
  DELIVERED = 'DELIVERED',     // 已送达
  EXCEPTION = 'EXCEPTION'      // 异常
}

// 换货状态枚举
export enum ExchangeStatus {
  PENDING = 'PENDING',         // 待处理
  APPROVED = 'APPROVED',       // 已同意
  REJECTED = 'REJECTED',       // 已拒绝
  PROCESSING = 'PROCESSING',   // 处理中
  COMPLETED = 'COMPLETED',     // 已完成
  CANCELLED = 'CANCELLED'      // 已取消
}

// 订单项接口
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  skuId: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;           // 单价
  totalPrice: number;          // 小计
  discountAmount: number;      // 折扣金额
  finalPrice: number;          // 实际支付价格
  metadata?: Record<string, any>;
}

// 收货地址接口
export interface ShippingAddress {
  id: string;
  receiverName: string;        // 收货人姓名
  receiverPhone: string;       // 收货人电话
  province: string;            // 省份
  city: string;               // 城市
  district: string;           // 区县
  street?: string;            // 详细地址
  postalCode?: string;        // 邮政编码
  isDefault: boolean;         // 是否默认地址
}

// 物流信息接口
export interface LogisticsInfo {
  id: string;
  orderId: string;
  expressCompany: string;      // 快递公司
  trackingNumber: string;      // 运单号
  status: LogisticsStatus;     // 物流状态
  currentLocation?: string;    // 当前位置
  estimatedDeliveryDate?: Date; // 预计送达时间
  createdAt: Date;
  updatedAt: Date;
  tracks: LogisticsTrack[];    // 物流轨迹
}

// 物流轨迹接口
export interface LogisticsTrack {
  time: Date;
  status: string;
  location: string;
  description: string;
}

// 支付记录接口
export interface PaymentRecord {
  id: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  transactionId?: string;      // 第三方交易号
  paidAt?: Date;
  refundedAt?: Date;
  refundAmount?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// 订单接口
export interface Order {
  id: string;
  orderNo: string;             // 订单号
  type: OrderType;
  status: OrderStatus;
  buyerId: string;             // 买方ID
  sellerId?: string;           // 卖方ID (采购订单时为上级)
  totalAmount: number;          // 订单总金额
  discountAmount: number;      // 折扣金额
  shippingFee: number;         // 运费
  finalAmount: number;         // 实际支付金额
  pointsAmount?: number;       // 积分抵扣金额
  cashAmount?: number;         // 现金支付金额

  // 商品信息
  items: OrderItem[];

  // 收货信息 (零售订单)
  shippingAddress?: ShippingAddress;

  // 支付信息
  paymentMethod?: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentRecords: PaymentRecord[];

  // 物流信息
  logistics?: LogisticsInfo;

  // 促销信息
  promotionInfo?: {
    type: string;
    discount: number;
    description: string;
  };

  // 备注信息
  buyerNotes?: string;
  sellerNotes?: string;

  // 时间信息
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // 扩展信息
  metadata?: Record<string, any>;
}

// 换货申请接口
export interface ExchangeRequest {
  id: string;
  orderNo: string;             // 换货单号
  originalOrderId: string;     // 原订单ID
  requesterId: string;         // 申请人ID
  targetUserId?: string;       // 目标用户ID (上级)

  // 换出商品 (给上级)
  outItems: ExchangeItem[];

  // 换入商品 (从上级)
  inItems: ExchangeItem[];

  // 价格差异计算
  priceDifference: number;     // 价格差异 (正数表示申请人需补差价)

  status: ExchangeStatus;
  reason: string;              // 换货原因
  description?: string;        // 详细描述

  // 审核信息
  reviewedBy?: string;         // 审核人ID
  reviewedAt?: Date;
  reviewNotes?: string;

  // 处理信息
  processedBy?: string;        // 处理人ID
  processedAt?: Date;

  // 时间信息
  createdAt: Date;
  updatedAt: Date;

  // 扩展信息
  metadata?: Record<string, any>;
}

// 换货商品项接口
export interface ExchangeItem {
  productId: string;
  skuId: string;
  productName: string;
  quantity: number;
  unitPrice: number;           // 换货时的单价
  totalPrice: number;
}

// 订单统计接口
export interface OrderStatistics {
  totalOrders: number;
  totalAmount: number;
  paidOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  // 按类型统计
  retailOrders: number;
  purchaseOrders: number;
  exchangeOrders: number;
  // 按状态统计
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
}

// 订单创建参数接口
export interface CreateOrderParams {
  type: OrderType;
  buyerId: string;
  sellerId?: string;
  items: Array<{
    productId: string;
    skuId: string;
    quantity: number;
  }>;
  shippingAddress?: ShippingAddress;
  paymentMethod?: PaymentMethod;
  pointsAmount?: number;
  buyerNotes?: string;
  promotionCode?: string;
  metadata?: Record<string, any>;
}

// 订单查询参数接口
export interface OrderQueryParams {
  userId?: string;
  type?: OrderType;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
  sortBy?: 'createdAt' | 'totalAmount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// 换货创建参数接口
export interface CreateExchangeParams {
  originalOrderId: string;
  outItems: Array<{
    productId: string;
    skuId: string;
    quantity: number;
  }>;
  inItems: Array<{
    productId: string;
    skuId: string;
    quantity: number;
  }>;
  reason: string;
  description?: string;
  targetUserId?: string;
}

// 支付配置接口
export interface PaymentConfig {
  wechat: {
    enabled: boolean;
    appId: string;
    mchId: string;
    apiKey: string;
  };
  alipay: {
    enabled: boolean;
    appId: string;
    privateKey: string;
    publicKey: string;
  };
  points: {
    enabled: boolean;
    exchangeRate: number;     // 积分兑换比例 (1积分 = X元)
  };
}

// 物流配置接口
export interface LogisticsConfig {
  providers: Array<{
    code: string;             // 快递公司代码
    name: string;             // 快递公司名称
    enabled: boolean;
    apiKey?: string;
    secretKey?: string;
  }>;
  autoTracking: boolean;      // 是否自动跟踪
  notificationEnabled: boolean; // 是否启用通知
}

// 订单验证结果接口
export interface OrderValidationResult {
  isValid: boolean;
  canCreate: boolean;
  reasons: string[];
  restrictions?: {
    maxQuantity?: number;
    minAmount?: number;
    allowedPaymentMethods?: PaymentMethod[];
  };
}

// 库存验证结果接口
export interface InventoryValidationResult {
  isValid: boolean;
  sufficient: boolean;
  availableQuantity: number;
  requestedQuantity: number;
  shortage: number;
  suggestions: string[];
}