/**
 * 支付模块类型定义
 * 支持通券支付为主，微信充值为辅的多层支付体系
 */

// 支付方式枚举
export enum PaymentMethod {
  POINTS = 'POINTS',           // 通券支付
  WECHAT = 'WECHAT',           // 微信支付
  ALIPAY = 'ALIPAY',           // 支付宝（预留）
  BALANCE = 'BALANCE',         // 余额支付（预留）
  MIXED = 'MIXED'              // 混合支付（预留）
}

// 支付状态枚举
export enum PaymentStatus {
  PENDING = 'PENDING',         // 待支付
  PROCESSING = 'PROCESSING',   // 支付中
  SUCCESS = 'SUCCESS',         // 支付成功
  FAILED = 'FAILED',           // 支付失败
  CANCELLED = 'CANCELLED',     // 支付取消
  REFUNDED = 'REFUNDED'        // 已退款
}

// 交易类型枚举
export enum TransactionType {
  PAYMENT = 'PAYMENT',         // 支付
  RECHARGE = 'RECHARGE',       // 充值
  TRANSFER = 'TRANSFER',       // 转账
  REFUND = 'REFUND',           // 退款
  PURCHASE = 'PURCHASE',       // 采购
  WITHDRAWAL = 'WITHDRAWAL'    // 提现
}

// 微信充值权限
export enum RechargePermission {
  FIVE_STAR_OWNER = 'FIVE_STAR_OWNER',  // 五星店长
  DIRECTOR = 'DIRECTOR',                // 董事
  ADMIN = 'ADMIN'                       // 管理员
}

// 支付记录接口
export interface PaymentRecord {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  externalTransactionId?: string;  // 第三方交易ID（如微信订单号）
  metadata: PaymentMetadata;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// 支付元数据
export interface PaymentMetadata {
  description?: string;
  orderId?: string;
  userId?: string;
  fromUserId?: string;    // 转账方ID
  toUserId?: string;      // 收款方ID
  relatedOrderId?: string;
  exchangeRate?: number;  // 汇率（1元=1通券）
  pointsAmount?: number;  // 通券数量
  cashAmount?: number;    // 现金数量
  reason?: string;        // 交易原因
  remark?: string;        // 备注
}

// 通券转账记录接口
export interface PointsTransaction {
  id: string;
  fromUserId: string;
  toUserId: string;
  points: number;
  type: TransactionType;
  relatedOrderId?: string;
  relatedPaymentId?: string;
  status: PaymentStatus;
  description?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
}

// 微信充值记录接口
export interface RechargeRecord {
  id: string;
  userId: string;
  wechatOrderNo: string;
  amount: number;           // 人民币金额（元）
  pointsAwarded: number;    // 发放的通券数量
  status: PaymentStatus;
  exchangeRate: number;     // 汇率，固定为1
  metadata: RechargeMetadata;
  createdAt: Date;
  completedAt?: Date;
}

// 充值元数据
export interface RechargeMetadata {
  userLevel: string;
  rechargePermission: RechargePermission;
  description?: string;
  remark?: string;
  paymentMethod?: string;
  tradeType?: string;       // 微信交易类型
  openid?: string;          // 微信用户openid
}

// 支付权限配置
export interface PaymentPermissions {
  userId: string;
  userRole: string;
  userLevel: string;

  // 通券支付权限
  canPayWithPoints: boolean;
  canTransferPoints: boolean;
  canReceivePoints: boolean;

  // 微信充值权限
  canRechargeWithWechat: boolean;
  rechargePermission?: RechargePermission;

  // 采购权限
  canPurchaseFromCloud: boolean;

  // 限制配置
  dailyLimit?: number | null;      // 每日限额（无限制时为null）
  monthlyLimit?: number | null;    // 每月限额
  transactionLimit?: number | null; // 单笔交易限额
}

// 支付参数接口
export interface CreatePaymentParams {
  orderId: string;
  userId: string;
  amount: number;
  method: PaymentMethod;
  description?: string;
  metadata?: Record<string, any>;
}

// 通券支付参数
export interface CreatePointsPaymentParams extends CreatePaymentParams {
  method: PaymentMethod.POINTS;
  toUserId?: string;        // 收款方ID（转账时使用）
  transactionType: TransactionType;
}

// 微信充值参数
export interface CreateRechargeParams {
  userId: string;
  amount: number;
  description?: string;
  metadata?: Record<string, any>;
}

// 通券转账参数
export interface CreateTransferParams {
  fromUserId: string;
  toUserId: string;
  points: number;
  type: TransactionType;
  description?: string;
  relatedOrderId?: string;
  metadata?: Record<string, any>;
}

// 支付查询参数
export interface PaymentQueryParams {
  userId?: string;
  orderId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  transactionType?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 支付验证结果
export interface PaymentValidationResult {
  isValid: boolean;
  canProceed: boolean;
  reasons: string[];
  warnings: string[];
  metadata?: {
    userPermissions?: PaymentPermissions;
    balanceInfo?: BalanceInfo;
    orderInfo?: any;
  };
}

// 余额信息
export interface BalanceInfo {
  userId: string;
  points: number;
  availablePoints: number;
  frozenPoints: number;
  lastUpdated: Date;
}

// 支付统计信息
export interface PaymentStatistics {
  totalPayments: number;
  totalAmount: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;

  // 按支付方式统计
  paymentsByMethod: {
    [key in PaymentMethod]?: {
      count: number;
      amount: number;
    };
  };

  // 按状态统计
  paymentsByStatus: {
    [key in PaymentStatus]?: number;
  };

  // 按类型统计
  paymentsByType: {
    [key in TransactionType]?: {
      count: number;
      amount: number;
    };
  };

  // 充值统计
  rechargeStats: {
    totalRecharges: number;
    totalRechargeAmount: number;
    totalPointsAwarded: number;
  };

  // 时间范围
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
}

// 微信支付配置（模拟）
export interface WechatPaymentConfig {
  appId: string;
  mchId: string;
  apiKey: string;
  apiSecret: string;
  notifyUrl: string;
  tradeType: string;
  isSandbox: boolean;  // 是否沙箱环境
}

// 支付回调数据接口
export interface PaymentCallbackData {
  transactionId: string;
  orderId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  externalTransactionId?: string;
  timestamp: Date;
  signature?: string;
  metadata?: Record<string, any>;
}

// 支付结果接口
export interface PaymentResult {
  success: boolean;
  paymentId: string;
  transactionId?: string;
  status: PaymentStatus;
  amount: number;
  method: PaymentMethod;
  message: string;
  metadata: {
    previousBalance?: number;
    currentBalance?: number;
    transactionDetails?: any;
    errors?: string[];
    warnings?: string[];
  };
}

// 批量支付参数
export interface BatchTransferParams {
  fromUserId: string;
  transfers: Array<{
    toUserId: string;
    points: number;
    type: TransactionType;
    description?: string;
  }>;
  totalPoints: number;
  batchDescription?: string;
}

// 批量支付结果
export interface BatchTransferResult {
  batchId: string;
  totalTransfers: number;
  successCount: number;
  failedCount: number;
  totalPoints: number;
  results: Array<{
    toUserId: string;
    points: number;
    success: boolean;
    paymentId?: string;
    error?: string;
  }>;
}

// 支付日志接口
export interface PaymentLog {
  id: string;
  paymentId: string;
  action: string;
  userId?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// 防重复支付锁
export interface PaymentLock {
  lockKey: string;
  orderId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

// 汇率信息
export interface ExchangeRateInfo {
  fromCurrency: string;
  toCurrency: string;
  rate: number;            // 汇率，固定为1（1元=1通券）
  isActive: boolean;
  lastUpdated: Date;
}