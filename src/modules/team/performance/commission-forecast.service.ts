/**
 * 佣金预测服务
 * 负责预测和分析用户佣金收入
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { performanceCacheService } from './cache.service';
import { personalCalculatorService } from './personal-calculator.service';
import { teamCalculatorService } from './team-calculator.service';
import { referralCalculatorService } from './referral-calculator.service';
import {
  CommissionForecast,
  CommissionCapacity,
  CacheConfig
} from './types';
import { TeamRole, CommissionType } from '../types';

export class CommissionForecastService {
  private cacheTTL: Pick<CacheConfig, 'commissionData'>;

  constructor() {
    this.cacheTTL = {
      commissionData: 3600 // 1小时
    };
  }

  /**
   * 预测佣金收入
   */
  async predictCommission(
    userId: string,
    period: string
  ): Promise<CommissionForecast> {
    try {
      const cacheKey = `commission_forecast:${userId}:${period}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      // 获取当前业绩数据
      const [personalPerf, teamPerf, referralPerf] = await Promise.all([
        personalCalculatorService.calculatePersonalPerformance(userId, period),
        teamCalculatorService.calculateTeamPerformance(userId, period),
        referralCalculatorService.calculateReferralPerformance(userId, period)
      ]);

      // 获取用户等级
      const user = await prisma.users.findUnique({
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
      const growthRate = await personalCalculatorService.calculateMonthlyGrowthRate(userId);
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

      performanceCacheService.set(cacheKey, forecast, this.cacheTTL.commissionData);

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

  /**
   * 获取佣金历史趋势
   */
  async getCommissionTrend(
    userId: string,
    months: number = 6
  ): Promise<Array<{
    period: string;
    commission: number;
    personalSales: number;
    teamBonus: number;
    referralCommission: number;
  }>> {
    try {
      const cacheKey = `commission_trend:${userId}:${months}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      const trends = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        // 获取该月业绩数据
        const [personalPerf, teamPerf, referralPerf] = await Promise.all([
          personalCalculatorService.calculatePersonalPerformance(userId, period),
          teamCalculatorService.calculateTeamPerformance(userId, period),
          referralCalculatorService.calculateReferralPerformance(userId, period)
        ]);

        // 获取用户等级
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { level: true }
        });

        if (user) {
          const userRole = this.mapUserLevelToTeamRole(user.level);
          const personalCommission = personalPerf.salesAmount * this.getCommissionRate(CommissionType.PERSONAL_SALES, userRole);
          const teamCommission = teamPerf.teamSales * this.getCommissionRate(CommissionType.TEAM_BONUS, userRole);
          const referralCommission = referralPerf.directReferrals * 500;

          trends.push({
            period,
            commission: personalCommission + teamCommission + referralCommission,
            personalSales: personalCommission,
            teamBonus: teamCommission,
            referralCommission
          });
        }
      }

      performanceCacheService.set(cacheKey, trends, this.cacheTTL.commissionData);

      return trends;
    } catch (error) {
      logger.error('获取佣金历史趋势失败', {
        userId,
        months,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 获取佣金预测摘要
   */
  async getCommissionSummary(userId: string): Promise<{
    currentMonthEstimate: number;
    nextMonthProjection: number;
    yearlyProjection: number;
    averageGrowthRate: number;
    capacityUtilization: number;
  }> {
    try {
      const cacheKey = `commission_summary:${userId}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      // 获取当前月预测
      const currentForecast = await this.predictCommission(userId, currentPeriod);

      // 计算年平均增长率
      const trends = await this.getCommissionTrend(userId, 12);
      let averageGrowthRate = 0;

      if (trends.length > 1) {
        const growthRates = [];
        for (let i = 1; i < trends.length; i++) {
          if (trends[i - 1].commission > 0) {
            const rate = (trends[i].commission - trends[i - 1].commission) / trends[i - 1].commission;
            growthRates.push(rate);
          }
        }
        averageGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
      }

      // 计算年度预测
      const yearlyProjection = currentForecast.currentPeriod.estimatedCommission * 12 * (1 + averageGrowthRate);

      const summary = {
        currentMonthEstimate: currentForecast.currentPeriod.estimatedCommission,
        nextMonthProjection: currentForecast.nextPeriod.estimatedCommission,
        yearlyProjection,
        averageGrowthRate,
        capacityUtilization: currentForecast.capacityAnalysis.utilizationRate
      };

      performanceCacheService.set(cacheKey, summary, this.cacheTTL.commissionData);

      return summary;
    } catch (error) {
      logger.error('获取佣金预测摘要失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        currentMonthEstimate: 0,
        nextMonthProjection: 0,
        yearlyProjection: 0,
        averageGrowthRate: 0,
        capacityUtilization: 0
      };
    }
  }

  /**
   * 分析佣金影响因素
   */
  async analyzeCommissionFactors(userId: string): Promise<{
    factors: Array<{
      name: string;
      impact: number;
      description: string;
      suggestion: string;
    }>;
    optimizationPotential: number;
  }> {
    try {
      // 获取最近的业绩数据
      const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const [personalPerf, teamPerf, referralPerf] = await Promise.all([
        personalCalculatorService.calculatePersonalPerformance(userId, currentPeriod),
        teamCalculatorService.calculateTeamPerformance(userId, currentPeriod),
        referralCalculatorService.calculateReferralPerformance(userId, currentPeriod)
      ]);

      const factors = [];

      // 分析个人销售
      if (personalPerf.salesAmount > 0) {
        factors.push({
          name: '个人销售额',
          impact: personalPerf.salesAmount * 0.1, // 假设影响权重
          description: `当前月销售额 ${personalPerf.salesAmount.toLocaleString()} 元`,
          suggestion: personalPerf.salesAmount < 10000 ? '增加产品推广和客户维护' : '保持当前销售势头'
        });
      }

      // 分析团队活跃度
      if (teamPerf.activeRate < 0.5) {
        factors.push({
          name: '团队活跃度',
          impact: (0.5 - teamPerf.activeRate) * 1000,
          description: `团队活跃率仅 ${Math.round(teamPerf.activeRate * 100)}%`,
          suggestion: '加强团队培训和激励，提升成员积极性'
        });
      }

      // 分析推荐转化
      if (referralPerf.conversionRate < 0.3) {
        factors.push({
          name: '推荐转化率',
          impact: (0.3 - referralPerf.conversionRate) * 500,
          description: `推荐转化率仅 ${Math.round(referralPerf.conversionRate * 100)}%`,
          suggestion: '优化推荐流程，提供更好的新人指导'
        });
      }

      // 计算优化潜力
      const optimizationPotential = factors.reduce((sum, factor) => sum + factor.impact, 0);

      return {
        factors,
        optimizationPotential
      };
    } catch (error) {
      logger.error('分析佣金影响因素失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        factors: [],
        optimizationPotential: 0
      };
    }
  }

  /**
   * 根据业绩计算佣金
   */
  private calculateCommissionFromPerformance(
    personalPerf: any,
    teamPerf: any,
    referralPerf: any,
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
  private async analyzeCommissionCapacity(userId: string, userRole: TeamRole): Promise<CommissionCapacity> {
    try {
      // 获取用户的历史最佳业绩
      const bestPerformance = await personalCalculatorService.getBestPerformance(userId);

      // 计算基于等级的理论最大容量
      const maxCapacity = bestPerformance * 3; // 假设理论最大是历史最佳的3倍

      // 获取当前周期业绩
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const currentPerformance = await personalCalculatorService.calculatePersonalPerformance(userId, currentMonth);
      const currentCommission = this.calculateCommissionFromPerformance(
        currentPerformance,
        await teamCalculatorService.calculateTeamPerformance(userId, currentMonth),
        await referralCalculatorService.calculateReferralPerformance(userId, currentMonth),
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
}

// 导出服务实例
export const commissionForecastService = new CommissionForecastService();