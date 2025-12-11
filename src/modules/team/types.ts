/**
 * 团队管理体系 - 类型定义
 * 多层级供应链社交电商平台的团队管理核心类型
 */

export enum TeamRole {
  MEMBER = 'MEMBER',           // 普通成员
  CAPTAIN = 'CAPTAIN',         // 队长（一星店长）
  MANAGER = 'MANAGER',         // 经理（二星店长）
  DIRECTOR = 'DIRECTOR',       // 董事（三星店长）
  SENIOR_DIRECTOR = 'SENIOR_DIRECTOR', // 高级董事（四星店长）
  PARTNER = 'PARTNER',         // 合伙人（五星店长）
  AMBASSADOR = 'AMBASSADOR'    // 大使（六星店长及以上）
}

export enum TeamStatus {
  ACTIVE = 'ACTIVE',           // 活跃
  INACTIVE = 'INACTIVE',       // 非活跃
  SUSPENDED = 'SUSPENDED',     // 暂停
  TERMINATED = 'TERMINATED'    // 终止
}

export enum RelationshipType {
  DIRECT = 'DIRECT',           // 直接推荐
  INDIRECT = 'INDIRECT',       // 间接推荐
  NETWORK = 'NETWORK'          // 网络关系
}

export interface TeamMember {
  id: string;
  userId: string;
  nickname: string;
  avatar?: string;
  phone?: string;
  email?: string;

  // 团队角色信息
  role: TeamRole;
  level: number;               // 层级深度（1-9级）
  status: TeamStatus;

  // 推荐关系
  parentId?: string;         // 推荐人ID
  referrerNickname?: string;   // 推荐人昵称
  uplineId?: string;           // 上级ID
  uplineNickname?: string;     // 上级昵称

  // 团队信息
  teamId: string;              // 所属团队ID
  teamName: string;            // 团队名称
  position: string;            // 职位名称

  // 业绩数据
  personalSales: number;       // 个人销售额
  teamSales: number;           // 团队销售额
  directCount: number;         // 直推人数
  teamCount: number;           // 团队总人数
  activeDirectCount: number;   // 活跃直推人数
  activeTeamCount: number;     // 活跃团队人数

  // 时间戳
  joinDate: Date;              // 加入时间
  promotedDate?: Date;         // 晋升时间
  lastActiveDate?: Date;       // 最后活跃时间
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamStructure {
  id: string;
  name: string;
  description?: string;

  // 团队架构
  leaderId: string;             // 团队负责人ID
  leaderNickname: string;      // 团队负责人昵称
  rootMemberId: string;        // 根节点成员ID

  // 统计数据
  totalMembers: number;        // 总成员数
  activeMembers: number;       // 活跃成员数
  totalLevels: number;         // 总层级数
  totalSales: number;          // 总销售额

  // 层级统计
  levelStatistics: Array<{
    level: number;
    memberCount: number;
    sales: number;
  }>;

  // 状态
  status: TeamStatus;

  // 时间戳
  establishedDate: Date;       // 成立时间
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralRelationship {
  id: string;
  parentId: string;          // 推荐人ID
  refereeId: string;           // 被推荐人ID
  relationshipType: RelationshipType;

  // 关系信息
  level: number;               // 关系层级（1-9）
  path: string;                // 推荐路径
  depth: number;               // 在推荐树中的深度

  // 业绩关联
  referralSales: number;       // 推荐产生的销售额
  referralCommission: number;  // 推荐佣金
  bonusEarned: number;         // 奖金收益

  // 状态
  isActive: boolean;           // 关系是否活跃
  isQualified: boolean;        // 是否符合资格

  // 时间戳
  establishedDate: Date;       // 建立关系时间
  qualifiedDate?: Date;        // 符合资格时间
  lastActiveDate?: Date;       // 最后活跃时间
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceMetrics {
  id: string;
  userId: string;
  period: string;              // 统计周期（YYYY-MM）

  // 个人业绩
  personalMetrics: {
    salesAmount: number;       // 销售额
    orderCount: number;        // 订单数
    newCustomers: number;      // 新客数
    repeatRate: number;        // 复购率
    averageOrderValue: number; // 平均订单价值
  };

  // 团队业绩
  teamMetrics: {
    teamSales: number;         // 团队销售额
    teamOrders: number;        // 团队订单数
    newMembers: number;        // 新增成员数
    activeRate: number;        // 活跃率
    productivity: number;      // 生产力指数
  };

  // 推荐业绩
  referralMetrics: {
    directReferrals: number;   // 直推人数
    indirectReferrals: number; // 间接推荐人数
    referralRevenue: number;   // 推荐收入
    networkGrowth: number;     // 网络增长率
  };

  // 等级进度
  rankProgress: {
    currentRole: TeamRole;
    nextRole?: TeamRole;
    progressPercentage: number; // 晋级进度百分比
    requirementsMet: string[];  // 已满足条件
    requirementsPending: string[]; // 待满足条件
  };

  // 时间戳
  calculationDate: Date;       // 计算日期
  createdAt: Date;
  updatedAt: Date;
}

export interface CommissionCalculation {
  id: string;
  userId: string;
  orderId?: string;             // 关联订单ID（可选）
  period: string;              // 计算周期

  // 佣金明细
  commissionDetails: Array<{
    type: CommissionType;
    amount: number;             // 佣金金额
    rate: number;               // 佣金比例
    baseAmount: number;         // 计算基数
    description: string;        // 描述
    relatedUserId?: string;     // 相关用户ID
  }>;

  // 汇总信息
  totalCommission: number;     // 总佣金
  personalCommission: number;  // 个人销售佣金
  teamCommission: number;      // 团队管理佣金
  referralCommission: number;  // 推荐佣金
  bonusCommission: number;     // 奖金佣金

  // 状态
  status: CommissionStatus;
  paidDate?: Date;             // 支付日期

  // 时间戳
  calculatedAt: Date;          // 计算时间
  createdAt: Date;
  updatedAt: Date;
}

export enum CommissionType {
  PERSONAL_SALES = 'PERSONAL_SALES',     // 个人销售佣金
  DIRECT_REFERRAL = 'DIRECT_REFERRAL',   // 直推佣金
  INDIRECT_REFERRAL = 'INDIRECT_REFERRAL', // 间接推荐佣金
  TEAM_BONUS = 'TEAM_BONUS',             // 团队奖金
  LEVEL_BONUS = 'LEVEL_BONUS',           // 等级奖金
  PERFORMANCE_BONUS = 'PERFORMANCE_BONUS', // 业绩奖金
  LEADERSHIP_BONUS = 'LEADERSHIP_BONUS', // 领导奖金
  SPECIAL_BONUS = 'SPECIAL_BONUS'        // 特别奖金
}

export enum CommissionStatus {
  PENDING = 'PENDING',         // 待结算
  CALCULATED = 'CALCULATED',   // 已计算
  APPROVED = 'APPROVED',       // 已批准
  PAID = 'PAID',               // 已支付
  CANCELLED = 'CANCELLED'      // 已取消
}

// API 接口参数类型
export interface CreateReferralParams {
  parentId: string;
  refereeId: string;
  relationshipType?: RelationshipType;
}

export interface TeamQueryParams {
  userId?: string | undefined;
  teamId?: string | undefined;
  role?: TeamRole | undefined;
  status?: TeamStatus | undefined;
  level?: number | undefined;
  includeInactive?: boolean | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  sortBy?: 'joinDate' | 'sales' | 'level' | 'teamCount' | undefined;
  sortOrder?: 'asc' | 'desc' | undefined;
}

export interface PromotionParams {
  userId: string;
  newRole: TeamRole;
  reason: string;
  effectiveDate?: Date | undefined;
  notes?: string | undefined;
}

export interface PerformanceQueryParams {
  userId?: string;
  teamId?: string;
  period?: string;
  role?: TeamRole;
  metricType?: 'personal' | 'team' | 'referral' | 'all';
  periodType?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate?: string;
  endDate?: string;
}

export interface CommissionQueryParams {
  userId?: string;
  period?: string;
  status?: CommissionStatus;
  type?: CommissionType;
  paidStatus?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}

// 计算结果类型
export interface TeamStatistics {
  overview: {
    totalMembers: number;
    activeMembers: number;
    totalSales: number;
    averagePerformance: number;
    growthRate: number;
  };

  levelDistribution: Array<{
    level: number;
    memberCount: number;
    salesContribution: number;
    percentage: number;
  }>;

  roleDistribution: Array<{
    role: TeamRole;
    count: number;
    sales: number;
    avgPerformance: number;
  }>;

  performanceMetrics: {
    topPerformers: Array<{
      userId: string;
      nickname: string;
      role: TeamRole;
      sales: number;
      teamSize: number;
    }>;
    growthTrends: Array<{
      period: string;
      sales: number;
      newMembers: number;
      activeRate: number;
    }>;
  };
}

export interface NetworkTree {
  userId: string;
  nickname: string;
  role: TeamRole;
  level: number;
  personalSales: number;
  teamSales: number;
  directCount: number;
  teamCount: number;
  status: TeamStatus;
  children: NetworkTree[];
}

// 团队管理操作类型
export enum TeamActionType {
  PROMOTE = 'PROMOTE',         // 晋升
  DEMOTE = 'DEMOTE',           // 降级
  TRANSFER = 'TRANSFER',       // 转移
  SUSPEND = 'SUSPEND',         // 暂停
  ACTIVATE = 'ACTIVATE',       // 激活
  TERMINATE = 'TERMINATE'      // 终止
}

export interface TeamActionLog {
  id: string;
  userId: string;
  operatorId: string;
  actionType: TeamActionType;
  oldData?: any;
  newData?: any;
  reason: string;
  notes?: string;
  createdAt: Date;
}