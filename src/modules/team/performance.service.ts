/**
 * 团队业绩实时统计服务
 * 中道商城多层级供应链社交电商平台的业绩统计核心服务
 *
 * 功能包括：
 * 1. 实时业绩计算（个人、团队、推荐）
 * 2. 多维度排行榜系统
 * 3. 晋级进度分析和预测
 * 4. 佣金预测和计算
 * 5. 智能缓存和性能优化
 */

import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import {
  PerformanceMetrics,
  CommissionCalculation,
  TeamRole,
  TeamStatus,
  CommissionType,
  CommissionStatus,
  PerformanceQueryParams,
  CommissionQueryParams
} from './types';

// 等级要求配置（基于业务需求）
const LEVEL_REQUIREMENTS = {
  [TeamRole.CAPTAIN]: {      // 一星店长
    minMonthlySales: 2400,
    minDirectMembers: 0,
    description: '月销售额2,400元'
  },
  [TeamRole.MANAGER]: {      // 二星店长
    minMonthlySales: 12000,
    minDirectMembers: 2,
    minCaptainCount: 2,
    description: '月销售额12,000元 + 2个一星下级'
  },
  [TeamRole.DIRECTOR]: {     // 三星店长
    minMonthlySales: 72000,
    minDirectMembers: 5,
    minManagerCount: 2,
    description: '月销售额72,000元 + 2个二星下级'
  },
  [TeamRole.SENIOR_DIRECTOR]: { // 四星店长
    minMonthlySales: 360000,
    minDirectMembers: 10,
    minDirectorCount: 2,
    description: '月销售额360,000元 + 2个三星下级'
  },
  [TeamRole.PARTNER]: {      // 五星店长
    minMonthlySales: 1200000,
    minDirectMembers: 15,
    minSeniorDirectorCount: 2,
    description: '月销售额1,200,000元 + 2个四星下级'
  },
  [TeamRole.AMBASSADOR]: {   // 董事
    minMonthlySales: 6000000,
    minDirectMembers: 20,
    minPartnerCount: 2,
    description: '月销售额6,000,000元 + 2个五星下级'
  }
};

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

// 缓存配置
interface CacheConfig {
  performanceMetrics: number; // 秒
  leaderboard: number;
  teamStats: number;
  commissionData: number;
}

const CACHE_TTL: CacheConfig = {
  performanceMetrics: 300,    // 5分钟
  leaderboard: 600,           // 10分钟
  teamStats: 180,             // 3分钟
  commissionData: 3600        // 1小时
};

// 简单内存缓存实现
class MemoryCache {
  private cache = new Map<string, { data: any; expires: number }>();

  set(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl * 1000
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }
}

export class PerformanceService {
  private static instance: PerformanceService;
  private cache = new MemoryCache();

  private constructor() {
    // 定期清理缓存
    setInterval(() => this.cache.cleanup(), 60000); // 每分钟清理一次
  }

  public static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  // ==================== 业绩计算引擎 ====================

  /**
   * 计算个人业绩
   * @param userId 用户ID
   * @param period 统计周期 (YYYY-MM-DD, YYYY-MM, YYYY-WW, YYYY)
   */
  async calculatePersonalPerformance(
    userId: string,
    period: string
  ): Promise<PersonalPerformance> {
    try {
      const cacheKey = `personal_performance:${userId}:${period}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      // 解析周期
      const { startDate, endDate } = this.parsePeriod(period);

      // 并行查询各项数据
      const [
        salesData,
        orderData,
        customerData,
        monthlyData,
        yearlyData
      ] = await Promise.all([
        // 销售数据
        this.getUserSalesData(userId, startDate, endDate),
        // 订单数据
        this.getUserOrderData(userId, startDate, endDate),
        // 客户数据
        this.getUserCustomerData(userId, startDate, endDate),
        // 月度至今数据
        this.getUserSalesData(userId, this.getMonthStart(), new Date()),
        // 年度至今数据
        this.getUserSalesData(userId, this.getYearStart(), new Date())
      ]);

      const performance: PersonalPerformance = {
        salesAmount: salesData.totalAmount,
        orderCount: orderData.orderCount,
        newCustomers: customerData.newCustomers,
        repeatRate: this.calculateRepeatRate(customerData.totalCustomers, customerData.repeatCustomers),
        averageOrderValue: orderData.orderCount > 0 ? salesData.totalAmount / orderData.orderCount : 0,
        monthToDate: monthlyData.totalAmount,
        yearToDate: yearlyData.totalAmount
      };

      // 缓存结果
      this.cache.set(cacheKey, performance, CACHE_TTL.performanceMetrics);

      logger.info('个人业绩计算完成', {
        userId,
        period,
        salesAmount: performance.salesAmount,
        orderCount: performance.orderCount
      });

      return performance;

    } catch (error) {
      logger.error('计算个人业绩失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 计算团队业绩
   */
  async calculateTeamPerformance(
    userId: string,
    period: string
  ): Promise<TeamPerformance> {
    try {
      const cacheKey = `team_performance:${userId}:${period}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const { startDate, endDate } = this.parsePeriod(period);

      // 获取团队成员（所有下级）
      const teamMembers = await this.getAllTeamMembers(userId);
      const teamMemberIds = teamMembers.map(m => m.userId);

      // 并行计算团队数据
      const [
        teamSalesData,
        teamOrderData,
        newMembersCount,
        activeMembersCount
      ] = await Promise.all([
        this.getTeamSalesData(teamMemberIds, startDate, endDate),
        this.getTeamOrderData(teamMemberIds, startDate, endDate),
        this.getNewMembersCount(userId, startDate, endDate),
        this.getActiveMembersCount(teamMemberIds, startDate, endDate)
      ]);

      // 层级分布统计
      const levelDistribution = await this.calculateLevelDistribution(teamMembers);

      const performance: TeamPerformance = {
        teamSales: teamSalesData.totalAmount,
        teamOrders: teamOrderData.orderCount,
        newMembers: newMembersCount,
        activeRate: teamMemberIds.length > 0 ? activeMembersCount / teamMemberIds.length : 0,
        productivity: teamMemberIds.length > 0 ? teamSalesData.totalAmount / teamMemberIds.length : 0,
        levelDistribution
      };

      this.cache.set(cacheKey, performance, CACHE_TTL.teamStats);

      logger.info('团队业绩计算完成', {
        userId,
        period,
        teamSales: performance.teamSales,
        teamMembers: teamMemberIds.length
      });

      return performance;

    } catch (error) {
      logger.error('计算团队业绩失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 计算推荐业绩
   */
  async calculateReferralPerformance(
    userId: string,
    period: string
  ): Promise<ReferralPerformance> {
    try {
      const cacheKey = `referral_performance:${userId}:${period}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const { startDate, endDate } = this.parsePeriod(period);

      // 获取推荐关系数据
      const referralData = await this.getReferralData(userId);

      // 计算各项指标
      const [
        directReferralSales,
        indirectReferralSales,
        activeReferralsCount,
        totalReferralsCount
      ] = await Promise.all([
        this.getReferralSales(referralData.directReferrals, startDate, endDate),
        this.getReferralSales(referralData.indirectReferrals, startDate, endDate),
        this.getActiveReferralsCount(referralData.directReferrals, startDate, endDate),
        Promise.resolve(referralData.directReferrals.length)
      ]);

      const performance: ReferralPerformance = {
        directReferrals: referralData.directReferrals.length,
        indirectReferrals: referralData.indirectReferrals.length,
        referralRevenue: directReferralSales.totalAmount + indirectReferralSales.totalAmount * 0.3, // 间接推荐30%佣金
        networkGrowth: this.calculateNetworkGrowthRate(userId, period),
        activeReferrals: activeReferralsCount,
        conversionRate: totalReferralsCount > 0 ? activeReferralsCount / totalReferralsCount : 0
      };

      this.cache.set(cacheKey, performance, CACHE_TTL.performanceMetrics);

      logger.info('推荐业绩计算完成', {
        userId,
        period,
        directReferrals: performance.directReferrals,
        referralRevenue: performance.referralRevenue
      });

      return performance;

    } catch (error) {
      logger.error('计算推荐业绩失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // ==================== 排行榜系统 ====================

  /**
   * 获取业绩排行榜
   * @param type 排行榜类型：personal, team, referral
   * @param period 统计周期
   * @param limit 返回条数
   */
  async getPerformanceLeaderboard(
    type: 'personal' | 'team' | 'referral',
    period: string,
    limit: number = 50
  ): Promise<LeaderboardItem[]> {
    try {
      const cacheKey = `leaderboard:${type}:${period}:${limit}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const { startDate, endDate } = this.parsePeriod(period);

      let leaderboard: LeaderboardItem[] = [];

      switch (type) {
        case 'personal':
          leaderboard = await this.getPersonalLeaderboard(startDate, endDate, limit);
          break;
        case 'team':
          leaderboard = await this.getTeamLeaderboard(startDate, endDate, limit);
          break;
        case 'referral':
          leaderboard = await this.getReferralLeaderboard(startDate, endDate, limit);
          break;
      }

      // 添加排名变化（需要对比上期数据）
      leaderboard = await this.enrichRankingChanges(leaderboard, type, period);

      this.cache.set(cacheKey, leaderboard, CACHE_TTL.leaderboard);

      logger.info('业绩排行榜生成完成', {
        type,
        period,
        limit,
        totalItems: leaderboard.length
      });

      return leaderboard;

    } catch (error) {
      logger.error('获取业绩排行榜失败', {
        type,
        period,
        limit,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取用户在排行榜中的位置
   */
  async getLeaderboardRanking(
    userId: string,
    type: 'personal' | 'team' | 'referral',
    period: string
  ): Promise<{
    rank: number;
    total: number;
    percentile: number;
    item?: LeaderboardItem;
  }> {
    try {
      const leaderboard = await this.getPerformanceLeaderboard(type, period, 1000);
      const userItem = leaderboard.find(item => item.userId === userId);

      if (!userItem) {
        return {
          rank: -1,
          total: 0,
          percentile: 0
        };
      }

      return {
        rank: userItem.rank,
        total: leaderboard.length,
        percentile: ((leaderboard.length - userItem.rank + 1) / leaderboard.length) * 100,
        item: userItem
      };

    } catch (error) {
      logger.error('获取排行榜排名失败', {
        userId,
        type,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // ==================== 晋级进度分析 ====================

  /**
   * 获取晋级进度
   */
  async getUpgradeProgress(
    userId: string,
    targetLevel?: TeamRole
  ): Promise<UpgradeProgress> {
    try {
      // 获取用户当前信息
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const currentLevel = this.mapUserLevelToTeamRole(user.level);
      const targetRole = targetLevel || this.getNextLevel(currentLevel);

      if (!targetRole) {
        throw new Error('已经是最高等级');
      }

      // 获取当前周期业绩数据
      const currentPeriod = this.formatPeriod(new Date(), 'monthly');
      const [personalPerf, teamPerf, referralPerf] = await Promise.all([
        this.calculatePersonalPerformance(userId, currentPeriod),
        this.calculateTeamPerformance(userId, currentPeriod),
        this.calculateReferralPerformance(userId, currentPeriod)
      ]);

      // 检查各项要求
      const requirements = LEVEL_REQUIREMENTS[targetRole];
      const requirementsMet = [
        {
          requirement: '月销售额',
          current: personalPerf.salesAmount,
          required: requirements.minMonthlySales,
          percentage: Math.min((personalPerf.salesAmount / requirements.minMonthlySales) * 100, 100),
          met: personalPerf.salesAmount >= requirements.minMonthlySales
        }
      ];

      // 添加下级数量要求
      if (requirements.minDirectMembers > 0) {
        requirementsMet.push({
          requirement: '直推人数',
          current: referralPerf.directReferrals,
          required: requirements.minDirectMembers,
          percentage: Math.min((referralPerf.directReferrals / requirements.minDirectMembers) * 100, 100),
          met: referralPerf.directReferrals >= requirements.minDirectMembers
        });
      }

      // 添加特定等级下级要求
      await this.addSpecificRoleRequirements(requirementsMet, userId, targetRole, requirements);

      // 计算总体进度
      const progressPercentage = requirementsMet.reduce((sum, req) => sum + req.percentage, 0) / requirementsMet.length;

      // 预测达成时间
      const estimatedTime = await this.predictPromotionTime(userId, targetRole, requirementsMet);

      // 计算月增长率
      const monthlyGrowthRate = await this.calculateMonthlyGrowthRate(userId);

      const progress: UpgradeProgress = {
        currentLevel,
        targetLevel: targetRole,
        progressPercentage,
        requirementsMet,
        estimatedTime,
        monthlyGrowthRate
      };

      logger.info('晋级进度计算完成', {
        userId,
        currentLevel,
        targetLevel: targetRole,
        progressPercentage,
        estimatedTime
      });

      return progress;

    } catch (error) {
      logger.error('获取晋级进度失败', {
        userId,
        targetLevel,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 预测晋级时间
   */
  async predictPromotionTime(
    userId: string,
    targetRole: TeamRole,
    requirementsMet: any[]
  ): Promise<number | undefined> {
    try {
      // 如果所有要求都满足，返回0
      if (requirementsMet.every(req => req.met)) {
        return 0;
      }

      // 计算增长率和预测时间
      const monthlyGrowthRate = await this.calculateMonthlyGrowthRate(userId);

      if (monthlyGrowthRate <= 0) {
        return undefined; // 无法预测
      }

      // 找出最慢达成的要求
      let maxDays = 0;
      for (const req of requirementsMet) {
        if (!req.met && req.current > 0) {
          const remaining = req.required - req.current;
          const dailyGrowth = (req.current * monthlyGrowthRate) / 30; // 日增长
          const daysNeeded = dailyGrowth > 0 ? remaining / dailyGrowth : Infinity;
          maxDays = Math.max(maxDays, daysNeeded);
        }
      }

      return maxDays === Infinity ? undefined : Math.ceil(maxDays);

    } catch (error) {
      logger.error('预测晋级时间失败', {
        userId,
        targetRole,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return undefined;
    }
  }

  // ==================== 佣金预测 ====================

  /**
   * 预测佣金收入
   */
  async predictCommission(
    userId: string,
    period: string
  ): Promise<CommissionForecast> {
    try {
      const cacheKey = `commission_forecast:${userId}:${period}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      // 获取当前业绩数据
      const [personalPerf, teamPerf, referralPerf] = await Promise.all([
        this.calculatePersonalPerformance(userId, period),
        this.calculateTeamPerformance(userId, period),
        this.calculateReferralPerformance(userId, period)
      ]);

      // 获取用户等级
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      const userRole = this.mapUserLevelToTeamRole(user.level);

      // 计算当前周期佣金
      const currentPeriodCommission = this.calculateCommissionFromPerformance(
        personalPerf,
        teamPerf,
        referralPerf,
        userRole
      );

      // 预测下期佣金（基于增长率）
      const growthRate = await this.calculateMonthlyGrowthRate(userId);
      const nextPeriodCommission = currentPeriodCommission * (1 + growthRate);

      // 计算佣金构成
      const breakdown = [
        {
          type: CommissionType.PERSONAL_SALES,
          current: personalPerf.salesAmount * this.getCommissionRate(CommissionType.PERSONAL_SALES, userRole),
          projected: nextPeriodCommission * 0.6, // 假设个人销售占60%
          percentage: 60
        },
        {
          type: CommissionType.TEAM_BONUS,
          current: teamPerf.teamSales * this.getCommissionRate(CommissionType.TEAM_BONUS, userRole),
          projected: nextPeriodCommission * 0.25, // 团队奖金占25%
          percentage: 25
        },
        {
          type: CommissionType.DIRECT_REFERRAL,
          current: referralPerf.directReferrals * 500, // 假设每个直推500元
          projected: nextPeriodCommission * 0.15, // 推荐佣金占15%
          percentage: 15
        }
      ];

      // 容量分析
      const capacityAnalysis = await this.analyzeCommissionCapacity(userId, userRole);

      const forecast: CommissionForecast = {
        currentPeriod: {
          estimatedCommission: currentPeriodCommission,
          actualToDate: currentPeriodCommission * 0.7, // 假设已完成70%
          projection: currentPeriodCommission
        },
        nextPeriod: {
          estimatedCommission: nextPeriodCommission,
          confidence: growthRate > 0 ? Math.min(85, 50 + growthRate * 100) : 30
        },
        breakdown,
        capacityAnalysis
      };

      this.cache.set(cacheKey, forecast, CACHE_TTL.commissionData);

      logger.info('佣金预测完成', {
        userId,
        period,
        currentPeriod: forecast.currentPeriod.estimatedCommission,
        nextPeriod: forecast.nextPeriod.estimatedCommission
      });

      return forecast;

    } catch (error) {
      logger.error('佣金预测失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 解析统计周期
   */
  private parsePeriod(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();

    if (period.match(/^\d{4}-\d{2}$/)) { // YYYY-MM (月度)
      const year = parseInt(period.substring(0, 4));
      const month = parseInt(period.substring(5, 7));
      return {
        startDate: new Date(year, month - 1, 1),
        endDate: new Date(year, month, 0)
      };
    } else if (period.match(/^\d{4}$/)) { // YYYY (年度)
      const year = parseInt(period);
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31)
      };
    } else if (period.match(/^\d{4}-W\d{2}$/)) { // YYYY-WWW (周度)
      // 简化实现，实际需要更复杂的周计算
      const year = parseInt(period.substring(0, 4));
      const week = parseInt(period.substring(6, 8));
      const startDate = new Date(year, 0, 1 + (week - 1) * 7);
      const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      return { startDate, endDate };
    }

    // 默认返回当月
    return {
      startDate: this.getMonthStart(),
      endDate: now
    };
  }

  /**
   * 获取月初时间
   */
  private getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * 获取年初时间
   */
  private getYearStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1);
  }

  /**
   * 格式化周期
   */
  private formatPeriod(date: Date, type: PeriodType): string {
    switch (type) {
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return `${date.getFullYear()}`;
      default:
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  /**
   * 计算复购率
   */
  private calculateRepeatRate(totalCustomers: number, repeatCustomers: number): number {
    return totalCustomers > 0 ? repeatCustomers / totalCustomers : 0;
  }

  /**
   * 计算网络增长率
   */
  private async calculateNetworkGrowthRate(userId: string, period: string): Promise<number> {
    // 简化实现，对比本期和上期的成员增长
    try {
      const currentPeriod = this.parsePeriod(period);
      const lastPeriodStart = new Date(currentPeriod.startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const lastPeriodEnd = currentPeriod.startDate;

      const [currentNewMembers, lastNewMembers] = await Promise.all([
        this.getNewMembersCount(userId, currentPeriod.startDate, currentPeriod.endDate),
        this.getNewMembersCount(userId, lastPeriodStart, lastPeriodEnd)
      ]);

      return lastNewMembers > 0 ? (currentNewMembers - lastNewMembers) / lastNewMembers : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取用户销售数据
   */
  private async getUserSalesData(userId: string, startDate: Date, endDate: Date): Promise<{ totalAmount: number }> {
    try {
      const result = await prisma.order.aggregate({
        where: {
          sellerId: userId,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          totalAmount: true
        }
      });

      return { totalAmount: result._sum.totalAmount || 0 };
    } catch (error) {
      logger.error('获取用户销售数据失败', { userId, error });
      return { totalAmount: 0 };
    }
  }

  /**
   * 获取用户订单数据
   */
  private async getUserOrderData(userId: string, startDate: Date, endDate: Date): Promise<{ orderCount: number }> {
    try {
      const orderCount = await prisma.order.count({
        where: {
          sellerId: userId,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      return { orderCount };
    } catch (error) {
      logger.error('获取用户订单数据失败', { userId, error });
      return { orderCount: 0 };
    }
  }

  /**
   * 获取用户客户数据
   */
  private async getUserCustomerData(userId: string, startDate: Date, endDate: Date): Promise<{
    totalCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
  }> {
    try {
      // 简化实现，实际需要复杂的客户统计逻辑
      const totalCustomers = await prisma.order.groupBy({
        by: ['buyerId'],
        where: {
          sellerId: userId,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      return {
        totalCustomers: totalCustomers.length,
        newCustomers: Math.floor(totalCustomers.length * 0.3), // 假设30%是新客户
        repeatCustomers: Math.floor(totalCustomers.length * 0.2) // 假设20%是复购客户
      };
    } catch (error) {
      logger.error('获取用户客户数据失败', { userId, error });
      return { totalCustomers: 0, newCustomers: 0, repeatCustomers: 0 };
    }
  }

  /**
   * 获取所有团队成员
   */
  private async getAllTeamMembers(userId: string): Promise<Array<{ userId: string; level: number }>> {
    try {
      // 使用 teamPath 字段进行高效查询
      const members = await prisma.user.findMany({
        where: {
          teamPath: {
            startsWith: `/${userId}/`
          }
        },
        select: {
          id: true,
          teamLevel: true
        }
      });

      return members.map(member => ({
        userId: member.id,
        level: member.teamLevel
      }));
    } catch (error) {
      logger.error('获取团队成员失败', { userId, error });
      return [];
    }
  }

  /**
   * 获取团队销售数据
   */
  private async getTeamSalesData(userIds: string[], startDate: Date, endDate: Date): Promise<{ totalAmount: number }> {
    try {
      const result = await prisma.order.aggregate({
        where: {
          sellerId: { in: userIds },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          totalAmount: true
        }
      });

      return { totalAmount: result._sum.totalAmount || 0 };
    } catch (error) {
      logger.error('获取团队销售数据失败', { userIds, error });
      return { totalAmount: 0 };
    }
  }

  /**
   * 获取团队订单数据
   */
  private async getTeamOrderData(userIds: string[], startDate: Date, endDate: Date): Promise<{ orderCount: number }> {
    try {
      const orderCount = await prisma.order.count({
        where: {
          sellerId: { in: userIds },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      return { orderCount };
    } catch (error) {
      logger.error('获取团队订单数据失败', { userIds, error });
      return { orderCount: 0 };
    }
  }

  /**
   * 获取新增成员数量
   */
  private async getNewMembersCount(userId: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      return await prisma.user.count({
        where: {
          parentId: userId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
    } catch (error) {
      logger.error('获取新增成员数量失败', { userId, error });
      return 0;
    }
  }

  /**
   * 获取活跃成员数量
   */
  private async getActiveMembersCount(userIds: string[], startDate: Date, endDate: Date): Promise<number> {
    try {
      // 有销售记录的成员视为活跃
      const activeMembers = await prisma.order.findMany({
        where: {
          sellerId: { in: userIds },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: { sellerId: true },
        distinct: ['sellerId']
      });

      return activeMembers.length;
    } catch (error) {
      logger.error('获取活跃成员数量失败', { userIds, error });
      return 0;
    }
  }

  /**
   * 计算层级分布
   */
  private async calculateLevelDistribution(teamMembers: Array<{ userId: string; level: number }>): Promise<Array<{
    level: number;
    memberCount: number;
    sales: number;
  }>> {
    try {
      const levelMap = new Map<number, { count: number; userIds: string[] }>();

      teamMembers.forEach(member => {
        const level = member.level;
        if (!levelMap.has(level)) {
          levelMap.set(level, { count: 0, userIds: [] });
        }
        const levelData = levelMap.get(level)!;
        levelData.count++;
        levelData.userIds.push(member.userId);
      });

      // 计算每个层级的销售
      const levelDistribution = await Promise.all(
        Array.from(levelMap.entries()).map(async ([level, data]) => {
          const currentMonth = this.formatPeriod(new Date(), 'monthly');
          const { startDate, endDate } = this.parsePeriod(currentMonth);

          const salesResult = await prisma.order.aggregate({
            where: {
              sellerId: { in: data.userIds },
              status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            },
            _sum: {
              totalAmount: true
            }
          });

          return {
            level,
            memberCount: data.count,
            sales: salesResult._sum.totalAmount || 0
          };
        })
      );

      return levelDistribution.sort((a, b) => a.level - b.level);
    } catch (error) {
      logger.error('计算层级分布失败', { error });
      return [];
    }
  }

  /**
   * 获取推荐数据
   */
  private async getReferralData(userId: string): Promise<{
    directReferrals: string[];
    indirectReferrals: string[];
  }> {
    try {
      const directReferrals = await prisma.user.findMany({
        where: { parentId: userId },
        select: { id: true }
      });

      const directReferralIds = directReferrals.map(r => r.id);

      // 获取间接推荐（下级的推荐）
      const indirectReferrals = await prisma.user.findMany({
        where: {
          parentId: { in: directReferralIds }
        },
        select: { id: true }
      });

      return {
        directReferrals: directReferralIds,
        indirectReferrals: indirectReferrals.map(r => r.id)
      };
    } catch (error) {
      logger.error('获取推荐数据失败', { userId, error });
      return { directReferrals: [], indirectReferrals: [] };
    }
  }

  /**
   * 获取推荐销售数据
   */
  private async getReferralSales(userIds: string[], startDate: Date, endDate: Date): Promise<{ totalAmount: number }> {
    if (userIds.length === 0) return { totalAmount: 0 };

    try {
      const result = await prisma.order.aggregate({
        where: {
          sellerId: { in: userIds },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          totalAmount: true
        }
      });

      return { totalAmount: result._sum.totalAmount || 0 };
    } catch (error) {
      logger.error('获取推荐销售数据失败', { userIds, error });
      return { totalAmount: 0 };
    }
  }

  /**
   * 获取活跃推荐人数
   */
  private async getActiveReferralsCount(userIds: string[], startDate: Date, endDate: Date): Promise<number> {
    if (userIds.length === 0) return 0;

    try {
      const activeReferrals = await prisma.order.findMany({
        where: {
          sellerId: { in: userIds },
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: { sellerId: true },
        distinct: ['sellerId']
      });

      return activeReferrals.length;
    } catch (error) {
      logger.error('获取活跃推荐人数失败', { userIds, error });
      return 0;
    }
  }

  /**
   * 获取个人排行榜
   */
  private async getPersonalLeaderboard(startDate: Date, endDate: Date, limit: number): Promise<LeaderboardItem[]> {
    try {
      const topPerformers = await prisma.$queryRaw<Array<{
        user_id: string;
        nickname: string;
        level: string;
        total_amount: bigint;
      }>>`
        SELECT
          u.id as user_id,
          u.nickname,
          u.level,
          COALESCE(SUM(o.total_amount), 0) as total_amount
        FROM users u
        LEFT JOIN orders o ON u.id = o.seller_id
          AND o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
          AND o.created_at >= ${startDate}
          AND o.created_at <= ${endDate}
        WHERE u.status = 'ACTIVE'
        GROUP BY u.id, u.nickname, u.level
        ORDER BY total_amount DESC
        LIMIT ${limit}
      `;

      return topPerformers.map((performer, index) => ({
        userId: performer.user_id,
        nickname: performer.nickname || '未知用户',
        role: this.mapUserLevelToTeamRole(performer.level as any),
        level: 1, // 需要从其他地方获取
        value: Number(performer.total_amount),
        rank: index + 1,
        change: 0 // 需要计算对比数据
      }));
    } catch (error) {
      logger.error('获取个人排行榜失败', { error });
      return [];
    }
  }

  /**
   * 获取团队排行榜
   */
  private async getTeamLeaderboard(startDate: Date, endDate: Date, limit: number): Promise<LeaderboardItem[]> {
    try {
      // 简化实现，获取团队领导者的团队业绩
      const teamLeaders = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          level: { in: ['STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'] }
        },
        select: {
          id: true,
          nickname: true,
          level: true
        }
      });

      const teamPerformances = await Promise.all(
        teamLeaders.map(async (leader) => {
          const teamMembers = await this.getAllTeamMembers(leader.id);
          const teamSales = await this.getTeamSalesData(teamMembers.map(m => m.userId), startDate, endDate);

          return {
            userId: leader.id,
            nickname: leader.nickname || '未知团队领导',
            role: this.mapUserLevelToTeamRole(leader.level as any),
            level: 1,
            value: teamSales.totalAmount,
            teamName: `${leader.nickname}团队`
          };
        })
      );

      // 排序并添加排名
      teamPerformances.sort((a, b) => b.value - a.value);

      return teamPerformances.slice(0, limit).map((performer, index) => ({
        ...performer,
        rank: index + 1,
        change: 0
      }));
    } catch (error) {
      logger.error('获取团队排行榜失败', { error });
      return [];
    }
  }

  /**
   * 获取推荐排行榜
   */
  private async getReferralLeaderboard(startDate: Date, endDate: Date, limit: number): Promise<LeaderboardItem[]> {
    try {
      const topReferrers = await prisma.user.findMany({
        where: {
          status: 'ACTIVE'
        },
        select: {
          id: true,
          nickname: true,
          level: true,
          directCount: true
        },
        orderBy: {
          directCount: 'desc'
        },
        take: limit
      });

      return topReferrers.map((referrer, index) => ({
        userId: referrer.id,
        nickname: referrer.nickname || '未知推荐人',
        role: this.mapUserLevelToTeamRole(referrer.level as any),
        level: 1,
        value: referrer.directCount,
        rank: index + 1,
        change: 0
      }));
    } catch (error) {
      logger.error('获取推荐排行榜失败', { error });
      return [];
    }
  }

  /**
   * 丰富排名变化数据
   */
  private async enrichRankingChanges(
    leaderboard: LeaderboardItem[],
    type: string,
    period: string
  ): Promise<LeaderboardItem[]> {
    try {
      // 获取上一期数据进行对比
      const lastPeriod = this.getLastPeriod(period);
      if (!lastPeriod) {
        return leaderboard;
      }

      const lastLeaderboard = await this.getPerformanceLeaderboard(type as any, lastPeriod, 100);

      return leaderboard.map(item => {
        const lastRank = lastLeaderboard.find(lastItem => lastItem.userId === item.userId);
        const change = lastRank ? lastRank.rank - item.rank : 0;

        return {
          ...item,
          change
        };
      });
    } catch (error) {
      logger.error('丰富排名变化失败', { type, period, error });
      return leaderboard;
    }
  }

  /**
   * 获取上一期周期
   */
  private getLastPeriod(currentPeriod: string): string | null {
    try {
      if (currentPeriod.match(/^\d{4}-\d{2}$/)) { // YYYY-MM
        const year = parseInt(currentPeriod.substring(0, 4));
        const month = parseInt(currentPeriod.substring(5, 7));

        if (month === 1) {
          return `${year - 1}-12`;
        } else {
          return `${year}-${String(month - 1).padStart(2, '0')}`;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 映射用户等级到团队角色
   */
  private mapUserLevelToTeamRole(userLevel: string): TeamRole {
    const levelMap: Record<string, TeamRole> = {
      'NORMAL': TeamRole.MEMBER,
      'VIP': TeamRole.MEMBER,
      'STAR_1': TeamRole.CAPTAIN,
      'STAR_2': TeamRole.MANAGER,
      'STAR_3': TeamRole.DIRECTOR,
      'STAR_4': TeamRole.SENIOR_DIRECTOR,
      'STAR_5': TeamRole.PARTNER,
      'DIRECTOR': TeamRole.AMBASSADOR
    };

    return levelMap[userLevel] || TeamRole.MEMBER;
  }

  /**
   * 获取下一个等级
   */
  private getNextLevel(currentLevel: TeamRole): TeamRole | null {
    const levels = [
      TeamRole.MEMBER,
      TeamRole.CAPTAIN,
      TeamRole.MANAGER,
      TeamRole.DIRECTOR,
      TeamRole.SENIOR_DIRECTOR,
      TeamRole.PARTNER,
      TeamRole.AMBASSADOR
    ];

    const currentIndex = levels.indexOf(currentLevel);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  }

  /**
   * 添加特定角色要求
   */
  private async addSpecificRoleRequirements(
    requirementsMet: any[],
    userId: string,
    targetRole: TeamRole,
    requirements: any
  ): Promise<void> {
    try {
      switch (targetRole) {
        case TeamRole.MANAGER:
          if (requirements.minCaptainCount > 0) {
            const captainCount = await this.getTeamMembersByRole(userId, TeamRole.CAPTAIN);
            requirementsMet.push({
              requirement: '一星店长数量',
              current: captainCount,
              required: requirements.minCaptainCount,
              percentage: Math.min((captainCount / requirements.minCaptainCount) * 100, 100),
              met: captainCount >= requirements.minCaptainCount
            });
          }
          break;

        case TeamRole.DIRECTOR:
          if (requirements.minManagerCount > 0) {
            const managerCount = await this.getTeamMembersByRole(userId, TeamRole.MANAGER);
            requirementsMet.push({
              requirement: '二星店长数量',
              current: managerCount,
              required: requirements.minManagerCount,
              percentage: Math.min((managerCount / requirements.minManagerCount) * 100, 100),
              met: managerCount >= requirements.minManagerCount
            });
          }
          break;

        case TeamRole.SENIOR_DIRECTOR:
          if (requirements.minDirectorCount > 0) {
            const directorCount = await this.getTeamMembersByRole(userId, TeamRole.DIRECTOR);
            requirementsMet.push({
              requirement: '三星店长数量',
              current: directorCount,
              required: requirements.minDirectorCount,
              percentage: Math.min((directorCount / requirements.minDirectorCount) * 100, 100),
              met: directorCount >= requirements.minDirectorCount
            });
          }
          break;

        case TeamRole.PARTNER:
          if (requirements.minSeniorDirectorCount > 0) {
            const seniorDirectorCount = await this.getTeamMembersByRole(userId, TeamRole.SENIOR_DIRECTOR);
            requirementsMet.push({
              requirement: '四星店长数量',
              current: seniorDirectorCount,
              required: requirements.minSeniorDirectorCount,
              percentage: Math.min((seniorDirectorCount / requirements.minSeniorDirectorCount) * 100, 100),
              met: seniorDirectorCount >= requirements.minSeniorDirectorCount
            });
          }
          break;

        case TeamRole.AMBASSADOR:
          if (requirements.minPartnerCount > 0) {
            const partnerCount = await this.getTeamMembersByRole(userId, TeamRole.PARTNER);
            requirementsMet.push({
              requirement: '五星店长数量',
              current: partnerCount,
              required: requirements.minPartnerCount,
              percentage: Math.min((partnerCount / requirements.minPartnerCount) * 100, 100),
              met: partnerCount >= requirements.minPartnerCount
            });
          }
          break;
      }
    } catch (error) {
      logger.error('添加特定角色要求失败', { userId, targetRole, error });
    }
  }

  /**
   * 获取特定角色的团队成员数量
   */
  private async getTeamMembersByRole(userId: string, role: TeamRole): Promise<number> {
    try {
      const teamMembers = await this.getAllTeamMembers(userId);
      const userIds = teamMembers.map(m => m.userId);

      if (userIds.length === 0) return 0;

      const count = await prisma.user.count({
        where: {
          id: { in: userIds },
          level: this.mapTeamRoleToUserLevel(role)
        }
      });

      return count;
    } catch (error) {
      logger.error('获取特定角色团队成员数量失败', { userId, role, error });
      return 0;
    }
  }

  /**
   * 映射团队角色到用户等级
   */
  private mapTeamRoleToUserLevel(role: TeamRole): string {
    const roleMap: Record<TeamRole, string> = {
      [TeamRole.MEMBER]: 'NORMAL',
      [TeamRole.CAPTAIN]: 'STAR_1',
      [TeamRole.MANAGER]: 'STAR_2',
      [TeamRole.DIRECTOR]: 'STAR_3',
      [TeamRole.SENIOR_DIRECTOR]: 'STAR_4',
      [TeamRole.PARTNER]: 'STAR_5',
      [TeamRole.AMBASSADOR]: 'DIRECTOR'
    };

    return roleMap[role] || 'NORMAL';
  }

  /**
   * 计算月增长率
   */
  private async calculateMonthlyGrowthRate(userId: string): Promise<number> {
    try {
      const currentMonth = this.formatPeriod(new Date(), 'monthly');
      const lastMonth = this.getLastPeriod(currentMonth);

      if (!lastMonth) return 0;

      const [currentPerformance, lastPerformance] = await Promise.all([
        this.calculatePersonalPerformance(userId, currentMonth),
        this.calculatePersonalPerformance(userId, lastMonth)
      ]);

      const currentSales = currentPerformance.salesAmount;
      const lastSales = lastPerformance.salesAmount;

      return lastSales > 0 ? (currentSales - lastSales) / lastSales : 0;
    } catch (error) {
      logger.error('计算月增长率失败', { userId, error });
      return 0;
    }
  }

  /**
   * 根据业绩计算佣金
   */
  private calculateCommissionFromPerformance(
    personalPerf: PersonalPerformance,
    teamPerf: TeamPerformance,
    referralPerf: ReferralPerformance,
    userRole: TeamRole
  ): number {
    const personalCommission = personalPerf.salesAmount * this.getCommissionRate(CommissionType.PERSONAL_SALES, userRole);
    const teamCommission = teamPerf.teamSales * this.getCommissionRate(CommissionType.TEAM_BONUS, userRole);
    const referralCommission = referralPerf.directReferrals * 500; // 假设每个直推500元

    return personalCommission + teamCommission + referralCommission;
  }

  /**
   * 获取佣金比例
   */
  private getCommissionRate(type: CommissionType, role: TeamRole): number {
    const rateMap: Record<CommissionType, Record<TeamRole, number>> = {
      [CommissionType.PERSONAL_SALES]: {
        [TeamRole.MEMBER]: 0.05,
        [TeamRole.CAPTAIN]: 0.08,
        [TeamRole.MANAGER]: 0.10,
        [TeamRole.DIRECTOR]: 0.12,
        [TeamRole.SENIOR_DIRECTOR]: 0.14,
        [TeamRole.PARTNER]: 0.16,
        [TeamRole.AMBASSADOR]: 0.20
      },
      [CommissionType.TEAM_BONUS]: {
        [TeamRole.MEMBER]: 0,
        [TeamRole.CAPTAIN]: 0.01,
        [TeamRole.MANAGER]: 0.02,
        [TeamRole.DIRECTOR]: 0.03,
        [TeamRole.SENIOR_DIRECTOR]: 0.04,
        [TeamRole.PARTNER]: 0.05,
        [TeamRole.AMBASSADOR]: 0.06
      },
      [CommissionType.DIRECT_REFERRAL]: {
        [TeamRole.MEMBER]: 0,
        [TeamRole.CAPTAIN]: 200,
        [TeamRole.MANAGER]: 300,
        [TeamRole.DIRECTOR]: 400,
        [TeamRole.SENIOR_DIRECTOR]: 500,
        [TeamRole.PARTNER]: 600,
        [TeamRole.AMBASSADOR]: 800
      },
      [CommissionType.INDIRECT_REFERRAL]: {
        [TeamRole.MEMBER]: 0,
        [TeamRole.CAPTAIN]: 50,
        [TeamRole.MANAGER]: 80,
        [TeamRole.DIRECTOR]: 120,
        [TeamRole.SENIOR_DIRECTOR]: 160,
        [TeamRole.PARTNER]: 200,
        [TeamRole.AMBASSADOR]: 300
      },
      [CommissionType.LEVEL_BONUS]: {
        [TeamRole.MEMBER]: 0,
        [TeamRole.CAPTAIN]: 0.005,
        [TeamRole.MANAGER]: 0.01,
        [TeamRole.DIRECTOR]: 0.015,
        [TeamRole.SENIOR_DIRECTOR]: 0.02,
        [TeamRole.PARTNER]: 0.025,
        [TeamRole.AMBASSADOR]: 0.03
      },
      [CommissionType.PERFORMANCE_BONUS]: {
        [TeamRole.MEMBER]: 0,
        [TeamRole.CAPTAIN]: 0.002,
        [TeamRole.MANAGER]: 0.004,
        [TeamRole.DIRECTOR]: 0.006,
        [TeamRole.SENIOR_DIRECTOR]: 0.008,
        [TeamRole.PARTNER]: 0.01,
        [TeamRole.AMBASSADOR]: 0.015
      },
      [CommissionType.LEADERSHIP_BONUS]: {
        [TeamRole.MEMBER]: 0,
        [TeamRole.CAPTAIN]: 0,
        [TeamRole.MANAGER]: 0.001,
        [TeamRole.DIRECTOR]: 0.002,
        [TeamRole.SENIOR_DIRECTOR]: 0.003,
        [TeamRole.PARTNER]: 0.004,
        [TeamRole.AMBASSADOR]: 0.005
      },
      [CommissionType.SPECIAL_BONUS]: {
        [TeamRole.MEMBER]: 0,
        [TeamRole.CAPTAIN]: 0,
        [TeamRole.MANAGER]: 0,
        [TeamRole.DIRECTOR]: 0.001,
        [TeamRole.SENIOR_DIRECTOR]: 0.002,
        [TeamRole.PARTNER]: 0.003,
        [TeamRole.AMBASSADOR]: 0.005
      }
    };

    return rateMap[type]?.[role] || 0;
  }

  /**
   * 分析佣金容量
   */
  private async analyzeCommissionCapacity(userId: string, userRole: TeamRole): Promise<{
    maxCapacity: number;
    utilizationRate: number;
    growthPotential: number;
  }> {
    try {
      // 获取用户的历史最佳业绩
      const bestPerformance = await this.getBestPerformance(userId);

      // 计算基于等级的理论最大容量
      const maxCapacity = bestPerformance * 3; // 假设理论最大是历史最佳的3倍

      // 获取当前周期业绩
      const currentMonth = this.formatPeriod(new Date(), 'monthly');
      const currentPerformance = await this.calculatePersonalPerformance(userId, currentMonth);
      const currentCommission = this.calculateCommissionFromPerformance(
        currentPerformance,
        await this.calculateTeamPerformance(userId, currentMonth),
        await this.calculateReferralPerformance(userId, currentMonth),
        userRole
      );

      const utilizationRate = maxCapacity > 0 ? currentCommission / maxCapacity : 0;
      const growthPotential = Math.max(0, 1 - utilizationRate);

      return {
        maxCapacity,
        utilizationRate,
        growthPotential
      };
    } catch (error) {
      logger.error('分析佣金容量失败', { userId, userRole, error });
      return {
        maxCapacity: 0,
        utilizationRate: 0,
        growthPotential: 0
      };
    }
  }

  /**
   * 获取历史最佳业绩
   */
  private async getBestPerformance(userId: string): Promise<number> {
    try {
      const result = await prisma.order.aggregate({
        where: {
          sellerId: userId,
          status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] }
        },
        _max: {
          totalAmount: true
        }
      });

      // 按月分组找到最佳月份
      const monthlyBest = await prisma.$queryRaw<Array<{ month: string; total: bigint }>>`
        SELECT
          DATE_FORMAT(created_at, '%Y-%m') as month,
          SUM(total_amount) as total
        FROM orders
        WHERE seller_id = ${userId}
          AND status IN ('PAID', 'SHIPPED', 'DELIVERED')
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY total DESC
        LIMIT 1
      `;

      return monthlyBest.length > 0 ? Number(monthlyBest[0].total) : 0;
    } catch (error) {
      logger.error('获取历史最佳业绩失败', { userId, error });
      return 0;
    }
  }

  // ==================== 缓存管理 ====================

  /**
   * 清除指定用户的缓存
   */
  public clearUserCache(userId: string): void {
    const patterns = [
      `personal_performance:${userId}:`,
      `team_performance:${userId}:`,
      `referral_performance:${userId}:`,
      `commission_forecast:${userId}:`,
      `leaderboard:*:*:*` // 排行榜需要全部清除，因为用户可能在其中
    ];

    for (const pattern of patterns) {
      if (pattern.endsWith(':')) {
        // 清除匹配前缀的缓存
        for (const key of this.cache['cache'].keys()) {
          if (key.startsWith(pattern)) {
            this.cache.delete(key);
          }
        }
      } else if (pattern.includes('*')) {
        // 简单的通配符匹配
        for (const key of this.cache['cache'].keys()) {
          if (this.matchPattern(key, pattern)) {
            this.cache.delete(key);
          }
        }
      }
    }
  }

  /**
   * 简单的通配符匹配
   */
  private matchPattern(str: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(str);
  }

  /**
   * 预热缓存
   */
  public async warmupCache(userIds: string[]): Promise<void> {
    try {
      logger.info('开始预热业绩缓存', { userIdCount: userIds.length });

      const currentPeriod = this.formatPeriod(new Date(), 'monthly');

      // 并行预热核心数据
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            await Promise.all([
              this.calculatePersonalPerformance(userId, currentPeriod),
              this.calculateTeamPerformance(userId, currentPeriod),
              this.calculateReferralPerformance(userId, currentPeriod)
            ]);
          } catch (error) {
            logger.error('预热用户缓存失败', { userId, error });
          }
        })
      );

      // 预热排行榜
      await Promise.all([
        this.getPerformanceLeaderboard('personal', currentPeriod, 50),
        this.getPerformanceLeaderboard('team', currentPeriod, 50),
        this.getPerformanceLeaderboard('referral', currentPeriod, 50)
      ]);

      logger.info('业绩缓存预热完成', { userIdCount: userIds.length });
    } catch (error) {
      logger.error('预热缓存失败', { userIdCount: userIds.length, error });
    }
  }

  // ==================== 数据校验和异常处理 ====================

  /**
   * 验证业绩数据完整性
   */
  public async validatePerformanceData(userId: string, period: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        errors.push('用户不存在');
        return { isValid: false, errors, warnings };
      }

      // 检查周期格式
      if (!period.match(/^\d{4}-\d{2}$/) && !period.match(/^\d{4}$/)) {
        errors.push('周期格式不正确，应为 YYYY-MM 或 YYYY');
      }

      // 获取业绩数据
      const [personalPerf, teamPerf, referralPerf] = await Promise.all([
        this.calculatePersonalPerformance(userId, period),
        this.calculateTeamPerformance(userId, period),
        this.calculateReferralPerformance(userId, period)
      ]);

      // 数据合理性检查
      if (personalPerf.salesAmount < 0) {
        errors.push('个人销售额不能为负数');
      }

      if (personalPerf.orderCount < 0) {
        errors.push('订单数不能为负数');
      }

      if (personalPerf.averageOrderValue < 0) {
        errors.push('平均订单价值不能为负数');
      }

      if (personalPerf.repeatRate < 0 || personalPerf.repeatRate > 1) {
        warnings.push('复购率应在0-1之间');
      }

      // 检查团队数据
      if (teamPerf.teamSales < personalPerf.salesAmount) {
        warnings.push('团队销售额应大于等于个人销售额');
      }

      if (teamPerf.activeRate < 0 || teamPerf.activeRate > 1) {
        warnings.push('团队活跃率应在0-1之间');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push(`数据验证失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * 重建业绩指标缓存
   */
  public async rebuildPerformanceMetrics(userId: string, period: string): Promise<{
    success: boolean;
    message: string;
    metrics?: PerformanceMetrics;
  }> {
    try {
      // 验证数据
      const validation = await this.validatePerformanceData(userId, period);
      if (!validation.isValid) {
        return {
          success: false,
          message: `数据验证失败: ${validation.errors.join(', ')}`
        };
      }

      // 计算各项业绩
      const [personalPerf, teamPerf, referralPerf] = await Promise.all([
        this.calculatePersonalPerformance(userId, period),
        this.calculateTeamPerformance(userId, period),
        this.calculateReferralPerformance(userId, period)
      ]);

      // 获取用户信息
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      const userRole = this.mapUserLevelToTeamRole(user.level);

      // 计算晋级进度
      const upgradeProgress = await this.getUpgradeProgress(userId);

      // 创建业绩指标记录
      const metrics: PerformanceMetrics = {
        id: `metrics_${userId}_${period}_${Date.now()}`,
        userId,
        period,
        personalMetrics: {
          salesAmount: personalPerf.salesAmount,
          orderCount: personalPerf.orderCount,
          newCustomers: personalPerf.newCustomers,
          repeatRate: personalPerf.repeatRate,
          averageOrderValue: personalPerf.averageOrderValue
        },
        teamMetrics: {
          teamSales: teamPerf.teamSales,
          teamOrders: teamPerf.teamOrders,
          newMembers: teamPerf.newMembers,
          activeRate: teamPerf.activeRate,
          productivity: teamPerf.productivity
        },
        referralMetrics: {
          directReferrals: referralPerf.directReferrals,
          indirectReferrals: referralPerf.indirectReferrals,
          referralRevenue: referralPerf.referralRevenue,
          networkGrowth: referralPerf.networkGrowth
        },
        rankProgress: {
          currentRole: userRole,
          nextRole: upgradeProgress.targetLevel,
          progressPercentage: upgradeProgress.progressPercentage,
          requirementsMet: upgradeProgress.requirementsMet
            .filter(req => req.met)
            .map(req => req.requirement),
          requirementsPending: upgradeProgress.requirementsMet
            .filter(req => !req.met)
            .map(req => req.requirement)
        },
        calculationDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 保存到数据库（在实际实现中）
      // await prisma.performanceMetrics.upsert({...});

      // 清除相关缓存
      this.clearUserCache(userId);

      logger.info('业绩指标重建完成', {
        userId,
        period,
        personalSales: personalPerf.salesAmount,
        teamSales: teamPerf.teamSales
      });

      return {
        success: true,
        message: '业绩指标重建成功',
        metrics
      };

    } catch (error) {
      logger.error('重建业绩指标失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        message: `重建失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }
}

// 导出单例实例
export const performanceService = PerformanceService.getInstance();