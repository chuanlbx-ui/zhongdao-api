
// 用户等级类型定义
export type UserLevel = 'NORMAL' | 'VIP' | 'STAR_1' | 'STAR_2' | 'STAR_3' | 'STAR_4' | 'STAR_5' | 'DIRECTOR';

// 用户模型类型
export type User = {
  id: string;
  phone: string;
  openid?: string;
  nickname: string;
  level: UserLevel;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
  parentId?: string;
  teamPath: string;
  pointsBalance: number;
  pointsFrozen: number;
  referralCode: string;
  createdAt: Date;
  updatedAt: Date;
};

// 认证请求扩展
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone: string;
    openid: string;
    nickname: string;
    level: string;
    role: string;
    scope: string[];
  };
}


/**
 * 佣金模块接口定义
 * 定义服务和仓储的接口，支持依赖注入
 */



// 佣金仓储接口
export interface ICommissionRepository {
  // 佣金记录相关
  createCommissionRecord(data: any): Promise<any>;
  findCommissionsByUser(
    userId: string,
    options: {
      page?: number;
      perPage?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ items: any[]; total: number }>;
  findCommissionById(id: string): Promise<any | null>;
  updateCommissionStatus(
    ids: string[],
    status: string,
    metadata?: any
  ): Promise<{ count: number }>;

  // 提现记录相关
  createWithdrawalRecord(data: any): Promise<any>;
  findWithdrawalsByUser(
    userId: string,
    options: {
      page?: number;
      perPage?: number;
      status?: string;
    }
  ): Promise<{ items: any[]; total: number }>;
  findWithdrawalById(id: string): Promise<any | null>;
  updateWithdrawalStatus(id: string, status: string, metadata: any): Promise<void>;

  // 统计相关
  aggregateCommissions(
    userId?: string,
    filters?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    total: number;
    pending: number;
    settled: number;
  }>;
  getCommissionChartData(
    userId: string,
    months: number
  ): Promise<Array<{ month: string; commission: number }>>;
}

// 用户服务接口
export interface IUserService {
  getUserById(id: string): Promise<any>;
  getUserReferrer(userId: string): Promise<any>;
  validateUserLevel(userId: string): Promise<UserLevel>;
}

// 通知服务接口
export interface INotificationService {
  sendNotification(
    userId: string,
    type: string,
    content: string,
    data?: any
  ): Promise<void>;
  sendBatchNotifications(
    notifications: Array<{
      userId: string;
      type: string;
      content: string;
      data?: any;
    }>
  ): Promise<void>;
}

// 佣金服务接口
export interface ICommissionService {
  // 核心业务方法
  calculateCommission(params: {
    orderId: string;
    buyerId: string;
    sellerId: string;
    orderAmount: number;
    products: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
  }): Promise<{
    orderId: string;
    orderAmount: number;
    commissions: Array<{
      userId: string;
      userLevel: UserLevel;
      type: string;
      rate: number;
      amount: number;
      description: string;
    }>;
    totalCommission: number;
    calculatedAt: Date;
  }>;

  // 佣金记录管理
  createCommissionRecords(result: any): Promise<void>;
  getUserCommissions(
    userId: string,
    options?: {
      page?: number;
      perPage?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ items: any[]; total: number }>;
  getCommissionSummary(
    userId?: string,
    options?: {
      period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
      includeChart?: boolean;
    }
  ): Promise<{
    totalCommission: number;
    pendingCommission: number;
    settledCommission: number;
    thisMonthCommission: number;
    lastMonthCommission: number;
    chartData?: Array<{ month: string; commission: number }>;
  }>;

  // 佣金结算
  settleCommissions(
    commissionIds: string[],
    settleDate?: Date,
    operatorId?: string,
    remark?: string
  ): Promise<{ settledCount: number; totalAmount: number }>;

  // 提现管理
  applyForWithdrawal(
    userId: string,
    params: {
      commissionIds: string[];
      withdrawAmount: number;
      withdrawMethod: 'BANK' | 'ALIPAY' | 'WECHAT';
      accountInfo: {
        accountName: string;
        accountNumber: string;
        bankName?: string;
      };
      remark?: string;
    }
  ): Promise<{ withdrawId: string; status: string }>;
  getWithdrawals(
    userId?: string,
    options?: {
      page?: number;
      perPage?: number;
      status?: string;
    }
  ): Promise<{ items: any[]; total: number }>;
  reviewWithdrawal(
    withdrawalId: string,
    approve: boolean,
    operatorId: string,
    remark?: string,
    transactionId?: string
  ): Promise<void>;
}

// 佣金规则服务接口
export interface ICommissionRulesService {
  // 获取佣金费率
  getCommissionRate(userLevel: UserLevel, commissionType: string): number;
  getTeamBonusRate(userLevel: UserLevel): number;
  getReferralRate(): number;

  // 验证佣金规则
  validateCommissionRules(
    userId: string,
    orderAmount: number,
    commissionType: string
  ): Promise<boolean>;

  // 获取佣金规则配置
  getCommissionRules(): Promise<Array<{
    level: UserLevel;
    rate: number;
    conditions: Record<string, any>;
    description: string;
    isActive: boolean;
  }>>;
}

// 佣金计算策略接口
export interface ICommissionCalculationStrategy {
  calculate(params: {
    sellerLevel: UserLevel;
    orderAmount: number;
    products: any[];
  }): Promise<{
    amount: number;
    rate: number;
    breakdown: Array<{
      type: string;
      rate: number;
      amount: number;
    }>;
  }>;
}

// 事件发布接口
export interface IEventPublisher {
  publish(event: string, data: any): Promise<void>;
  publishBatch(events: Array<{ event: string; data: any }>): Promise<void>;
}

// 审计日志接口
export interface IAuditLogger {
  log(action: string, userId: string, data: any): Promise<void>;
  logBatch(entries: Array<{
    action: string;
    userId: string;
    data: any;
  }>): Promise<void>;
}