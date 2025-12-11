/**
 * 积分缓存类型定义
 */

export interface PointsBalance {
  userId: string;
  balance: number;
  frozenBalance: number;
  availableBalance: number;
  lastUpdated: Date;
  version: number;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  type: 'PURCHASE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RECHARGE' | 'WITHDRAW' | 'COMMISSION' | 'GIFT' | 'REFUND';
  amount: number;
  balance: number;
  description: string;
  relatedUserId?: string;
  relatedOrderId?: string;
  metadata?: Record<string, any>;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
  completedAt?: Date;
}

export interface PointsTransactionHistory {
  userId: string;
  transactions: PointsTransaction[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalIn: number;
    totalOut: number;
    netFlow: number;
    transactionCount: number;
  };
}

export interface PointsStats {
  userId: string;
  period: 'day' | 'week' | 'month' | 'year';
  stats: {
    totalEarned: number;
    totalSpent: number;
    totalTransferred: number;
    netChange: number;
    transactionCount: number;
    averageTransaction: number;
  };
  breakdown: {
    byType: Record<string, {
      count: number;
      amount: number;
      percentage: number;
    }>;
    bySource: Record<string, number>;
  };
  trends: Array<{
    date: string;
    earned: number;
    spent: number;
    netChange: number;
  }>;
}

export interface PointsTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  fee: number;
  description: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
  completedAt?: Date;
  fromUser: {
    nickname: string | null;
    level: string;
  };
  toUser: {
    nickname: string | null;
    level: string;
  };
}

export interface PointsDailySummary {
  date: string;
  userId: string;
  openingBalance: number;
  closingBalance: number;
  totalIn: number;
  totalOut: number;
  netChange: number;
  transactionCount: number;
  breakdown: {
    purchase: number;
    transfer: number;
    recharge: number;
    commission: number;
    other: number;
  };
}

export interface PointsQuota {
  userId: string;
  type: 'daily_transfer' | 'daily_purchase' | 'monthly_withdraw';
  limit: number;
  used: number;
  remaining: number;
  resetDate: Date;
  lastUpdated: Date;
}

export interface PointsCacheStats {
  totalCached: number;
  byType: {
    balance: number;
    transactions: number;
    history: number;
    stats: number;
    transfers: number;
    summaries: number;
    quotas: number;
  };
  hitRate: number;
  memoryUsage: number;
  lastUpdate: Date;
}

export interface PointsLedger {
  userId: string;
  entries: Array<{
    id: string;
    timestamp: Date;
    type: string;
    amount: number;
    balance: number;
    reference?: string;
    metadata?: Record<string, any>;
  }>;
  balance: number;
  lastSynced: Date;
}

export interface PointsExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  fee: number;
  minAmount: number;
  maxAmount: number;
  validFrom: Date;
  validTo: Date;
}

export interface PointsPromotion {
  id: string;
  type: 'bonus' | 'discount' | 'cashback';
  name: string;
  description: string;
  conditions: {
    minAmount?: number;
    maxAmount?: number;
    userLevel?: string[];
    category?: string[];
    timeRange?: {
      start: Date;
      end: Date;
    };
  };
  rewards: {
    multiplier?: number;
    bonusAmount?: number;
    discountRate?: number;
    cashbackRate?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}