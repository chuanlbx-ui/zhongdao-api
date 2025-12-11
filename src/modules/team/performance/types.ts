/**
 * 团队业绩系统 - 类型定义
 * 中道商城多层级供应链社交电商平台的业绩统计核心类型
 */

import { TeamRole, TeamStatus, CommissionType, CommissionStatus } from '../types';

// 统计周期类型
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// 业绩统计结果接口
export interface PersonalPerformance {
  salesAmount: number;
  orderCount: number;
  newCustomers: number;
  repeatRate: number;
  averageOrderValue: number;
  monthToDate: number;
  yearToDate: number;
}

export interface TeamPerformance {
  teamSales: number;
  teamOrders: number;
  newMembers: number;
  activeRate: number;
  productivity: number;
  levelDistribution: Array<{
    level: number;
    memberCount: number;
    sales: number;
  }>;
}

export interface ReferralPerformance {
  directReferrals: number;
  indirectReferrals: number;
  referralRevenue: number;
  networkGrowth: number;
  activeReferrals: number;
  conversionRate: number;
}

// 排行榜项目接口
export interface LeaderboardItem {
  userId: string;
  nickname: string;
  avatar?: string;
  role: TeamRole;
  level: number;
  value: number;
  rank: number;
  change: number; // 排名变化
  teamName?: string;
}

// 晋级进度接口
export interface UpgradeProgress {
  currentLevel: TeamRole;
  targetLevel: TeamRole;
  progressPercentage: number;
  requirementsMet: Array<{
    requirement: string;
    current: number;
    required: number;
    percentage: number;
    met: boolean;
  }>;
  estimatedTime?: number; // 预计达到时间（天数）
  monthlyGrowthRate: number;
}

// 佣金预测接口
export interface CommissionForecast {
  currentPeriod: {
    estimatedCommission: number;
    actualToDate: number;
    projection: number;
  };
  nextPeriod: {
    estimatedCommission: number;
    confidence: number; // 预测置信度 0-100
  };
  breakdown: Array<{
    type: CommissionType;
    current: number;
    projected: number;
    percentage: number;
  }>;
  capacityAnalysis: {
    maxCapacity: number; // 基于当前等级的最大佣金潜力
    utilizationRate: number; // 当前利用率
    growthPotential: number; // 增长潜力
  };
}

// 等级要求配置
export interface LevelRequirement {
  minMonthlySales: number;
  minDirectMembers?: number;
  minCaptainCount?: number;
  minManagerCount?: number;
  minDirectorCount?: number;
  minSeniorDirectorCount?: number;
  minPartnerCount?: number;
  description: string;
}

export interface LevelRequirements {
  [key in TeamRole]?: LevelRequirement;
}

// 缓存配置
export interface CacheConfig {
  performanceMetrics: number; // 秒
  leaderboard: number;
  teamStats: number;
  commissionData: number;
}

// 周期解析结果
export interface PeriodRange {
  startDate: Date;
  endDate: Date;
}

// 用户销售数据
export interface UserSalesData {
  totalAmount: number;
}

// 用户订单数据
export interface UserOrderData {
  orderCount: number;
}

// 用户客户数据
export interface UserCustomerData {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
}

// 团队成员信息
export interface TeamMemberInfo {
  userId: string;
  level: number;
}

// 推荐数据
export interface ReferralData {
  directReferrals: string[];
  indirectReferrals: string[];
}

// 佣金容量分析
export interface CommissionCapacity {
  maxCapacity: number;
  utilizationRate: number;
  growthPotential: number;
}

// 业绩数据验证结果
export interface PerformanceValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 业绩指标重建结果
export interface PerformanceRebuildResult {
  success: boolean;
  message: string;
  metrics?: import('../types').PerformanceMetrics;
}

// 排行榜排名查询结果
export interface LeaderboardRankingResult {
  rank: number;
  total: number;
  percentile: number;
  item?: LeaderboardItem;
}