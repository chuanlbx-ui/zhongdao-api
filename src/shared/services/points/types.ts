// 通券交易类型
export enum PointsTransactionType {
  PURCHASE = 'PURCHASE',    // 采购支付
  TRANSFER = 'TRANSFER',    // 用户转账
  RECHARGE = 'RECHARGE',    // 充值
  WITHDRAW = 'WITHDRAW',    // 提现
  REFUND = 'REFUND',        // 退款
  COMMISSION = 'COMMISSION', // 佣金
  REWARD = 'REWARD',        // 奖励
  FREEZE = 'FREEZE',        // 冻结
  UNFREEZE = 'UNFREEZE'    // 解冻
}

// 通券交易状态
export enum PointsTransactionStatus {
  PENDING = 'PENDING',     // 待处理
  PROCESSING = 'PROCESSING', // 处理中
  COMPLETED = 'COMPLETED',   // 已完成
  FAILED = 'FAILED',       // 失败
  CANCELLED = 'CANCELLED'   // 已取消
}

// 通券交易接口
export interface PointsTransactionData {
  fromUserId?: string;
  toUserId: string;
  amount: number;
  type: PointsTransactionType;
  description?: string;
  relatedOrderId?: string;
  metadata?: Record<string, any>;
}

// 转账结果接口
export interface PointsTransferResult {
  success: boolean;
  message?: string;
  data?: {
    transactionId?: string;
    fromUserId?: string;
    toUserId: string;
    amount: number;
  };
  transactionNo?: string;
  fromUserId?: string;
  toUserId?: string;
  type?: PointsTransactionType;
  description?: string;
  relatedOrderId?: string;
  metadata?: Record<string, any>;
}

// 通券余额信息
export interface PointsBalance {
  userId: string;
  balance: number;
  frozen: number;
  available: number;
}

// 提现信息接口
export interface WithdrawalInfo {
  bankAccount?: string;
  bankName?: string;
  accountName?: string;
  phone?: string;
  withdrawalPassword?: string;
}

// 防重复提交接口
export interface DeduplicationResult {
  success: boolean;
  existingTransaction?: any;
}