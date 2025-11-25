import { UserLevel } from '../../modules/user/level.service';

/**
 * 佣金计算参数
 */
export interface CommissionCalculationParams {
  orderId: string;
  buyerId: string;
  sellerId?: string;
  orderAmount: number;
  productCount: number;
  orderType: string;
  commissionDetails?: string;
}

/**
 * 佣金配置
 */
export interface CommissionConfig {
  personalRate: number;        // 个人销售佣金率
  directReferralRate: number;  // 直推佣金率
  indirectReferralRates: number[]; // 间接推荐佣金率数组（索引为层级-1）
  teamBonusRates: Record<UserLevel, number>; // 团队奖金率
  levelBonusAmounts: Record<UserLevel, number>; // 等级奖金金额
  performanceThresholds: Array<{ threshold: number; rate: number }>; // 业绩门槛和奖励率
}

/**
 * 计算结果
 */
export interface CommissionResult {
  userId: string;
  orderId: string;
  personalCommission: number;    // 个人销售佣金
  directReferralCommission: number; // 直推佣金
  indirectReferralCommission: number; // 间接推荐佣金
  teamBonus: number;            // 团队奖金
  levelBonus: number;           // 等级奖金
  performanceBonus: number;     // 业绩奖金
  totalCommission: number;      // 总佣金
  breakdown: CommissionBreakdown[];
}

/**
 * 佣金明细
 */
export interface CommissionBreakdown {
  type: CommissionType;
  userId: string;
  amount: number;
  rate?: number;
  level?: number;
  sourceOrderId?: string;
  sourceUserId?: string;
  description: string;
}

/**
 * 佣金统计
 */
export interface CommissionStats {
  userId: string;
  period: string;
  totalCommission: number;
  personalCommission: number;
  teamCommission: number;
  referralCommission: number;
  bonusCommission: number;
  orderCount: number;
  teamSize: number;
  level: UserLevel;
  paidAmount: number;
  pendingAmount: number;
}

/**
 * 佣金记录查询参数
 */
export interface CommissionQueryParams {
  userId?: string;
  period?: string;
  status?: string;
  type?: CommissionType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  perPage?: number;
}

/**
 * 用户团队结构
 */
export interface UserTeamStructure {
  userId: string;
  level: UserLevel;
  directCount: number;
  indirectCounts: number[];
  totalTeamSize: number;
  teamLevels: Record<UserLevel, number>;
  monthlyStats: {
    orderCount: number;
    orderAmount: number;
    newMembers: number;
  };
}

/**
 * 佣金类型枚举
 */
export enum CommissionType {
  PERSONAL_SALES = 'PERSONAL_SALES',
  DIRECT_REFERRAL = 'DIRECT_REFERRAL',
  INDIRECT_REFERRAL = 'INDIRECT_REFERRAL',
  TEAM_BONUS = 'TEAM_BONUS',
  LEVEL_BONUS = 'LEVEL_BONUS',
  PERFORMANCE_BONUS = 'PERFORMANCE_BONUS',
  LEADERSHIP_BONUS = 'LEADERSHIP_BONUS',
  SPECIAL_BONUS = 'SPECIAL_BONUS'
}

/**
 * 佣金状态枚举
 */
export enum CommissionStatus {
  PENDING = 'PENDING',
  CALCULATED = 'CALCULATED',
  APPROVED = 'APPROVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

/**
 * 默认佣金配置
 */
export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  personalRate: 0.15,              // 个人销售15%佣金
  directReferralRate: 0.10,        // 直推10%佣金
  indirectReferralRates: [0.05, 0.03, 0.02, 0.01], // 1-4级间接推荐佣金
  teamBonusRates: {
    [UserLevel.NORMAL]: 0,
    [UserLevel.VIP]: 0.01,
    [UserLevel.STAR_1]: 0.02,
    [UserLevel.STAR_2]: 0.03,
    [UserLevel.STAR_3]: 0.05,
    [UserLevel.STAR_4]: 0.07,
    [UserLevel.STAR_5]: 0.10,
    [UserLevel.DIRECTOR]: 0.15
  },
  levelBonusAmounts: {
    [UserLevel.NORMAL]: 0,
    [UserLevel.VIP]: 100,
    [UserLevel.STAR_1]: 300,
    [UserLevel.STAR_2]: 600,
    [UserLevel.STAR_3]: 1200,
    [UserLevel.STAR_4]: 2000,
    [UserLevel.STAR_5]: 3500,
    [UserLevel.DIRECTOR]: 5000
  },
  performanceThresholds: [
    { threshold: 10000, rate: 0.01 },   // 1万以上额外1%
    { threshold: 50000, rate: 0.02 },   // 5万以上额外2%
    { threshold: 100000, rate: 0.03 },  // 10万以上额外3%
    { threshold: 500000, rate: 0.05 }   // 50万以上额外5%
  ]
};

/**
 * 升级奖励配置
 */
export interface UpgradeRewardConfig {
  level: UserLevel;
  bonusAmount: number;
  requiredConditions: {
    minPersonalSales: number;
    minTeamSize: number;
    minDirectCount: number;
  };
}