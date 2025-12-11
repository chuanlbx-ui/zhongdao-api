/**
 * 团队业绩服务 - 主入口
 * 中道商城多层级供应链社交电商平台的业绩统计核心服务
 * 保持与原有 PerformanceService 的向后兼容性
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import {
  performanceCacheService,
  PerformanceCacheService
} from './cache.service';
import {
  personalCalculatorService,
  PersonalCalculatorService
} from './personal-calculator.service';
import {
  teamCalculatorService,
  TeamCalculatorService
} from './team-calculator.service';
import {
  referralCalculatorService,
  ReferralCalculatorService
} from './referral-calculator.service';
import {
  rankingService,
  RankingService
} from './ranking.service';
import {
  progressionService,
  ProgressionService
} from './progression.service';
import {
  commissionForecastService,
  CommissionForecastService
} from './commission-forecast.service';

// 导出所有类型
export * from './types';
export {
  PerformanceCacheService,
  PersonalCalculatorService,
  TeamCalculatorService,
  ReferralCalculatorService,
  RankingService,
  ProgressionService,
  CommissionForecastService
};

/**
 * 团队业绩服务主类
 * 整合所有子模块服务，提供统一的接口
 */
export class PerformanceService {
  private static instance: PerformanceService;

  private constructor() {}

  public static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  // ==================== 业绩计算引擎 ====================

  /**
   * 计算个人业绩
   */
  async calculatePersonalPerformance(userId: string, period: string) {
    return personalCalculatorService.calculatePersonalPerformance(userId, period);
  }

  /**
   * 计算团队业绩
   */
  async calculateTeamPerformance(userId: string, period: string) {
    return teamCalculatorService.calculateTeamPerformance(userId, period);
  }

  /**
   * 计算推荐业绩
   */
  async calculateReferralPerformance(userId: string, period: string) {
    return referralCalculatorService.calculateReferralPerformance(userId, period);
  }

  // ==================== 排行榜系统 ====================

  /**
   * 获取业绩排行榜
   */
  async getPerformanceLeaderboard(
    type: 'personal' | 'team' | 'referral',
    period: string,
    limit: number = 50
  ) {
    return rankingService.getPerformanceLeaderboard(type, period, limit);
  }

  /**
   * 获取用户在排行榜中的位置
   */
  async getLeaderboardRanking(
    userId: string,
    type: 'personal' | 'team' | 'referral',
    period: string
  ) {
    return rankingService.getLeaderboardRanking(userId, type, period);
  }

  /**
   * 获取指定用户的排行榜周围数据
   */
  async getLeaderboardAroundUser(
    userId: string,
    type: 'personal' | 'team' | 'referral',
    period: string,
    radius: number = 5
  ) {
    return rankingService.getLeaderboardAroundUser(userId, type, period, radius);
  }

  /**
   * 获取排行榜摘要统计
   */
  async getLeaderboardSummary(
    type: 'personal' | 'team' | 'referral',
    period: string
  ) {
    return rankingService.getLeaderboardSummary(type, period);
  }

  // ==================== 晋级进度分析 ====================

  /**
   * 获取晋级进度
   */
  async getUpgradeProgress(userId: string, targetLevel?: any) {
    return progressionService.getUpgradeProgress(userId, targetLevel);
  }

  /**
   * 获取所有等级的晋级进度
   */
  async getAllLevelProgress(userId: string) {
    return progressionService.getAllLevelProgress(userId);
  }

  /**
   * 检查是否符合晋级条件
   */
  async checkPromotionEligibility(userId: string, targetLevel: any) {
    return progressionService.checkPromotionEligibility(userId, targetLevel);
  }

  /**
   * 获取晋级历史记录
   */
  async getPromotionHistory(userId: string) {
    return progressionService.getPromotionHistory(userId);
  }

  // ==================== 佣金预测 ====================

  /**
   * 预测佣金收入
   */
  async predictCommission(userId: string, period: string) {
    return commissionForecastService.predictCommission(userId, period);
  }

  /**
   * 获取佣金历史趋势
   */
  async getCommissionTrend(userId: string, months: number = 6) {
    return commissionForecastService.getCommissionTrend(userId, months);
  }

  /**
   * 获取佣金预测摘要
   */
  async getCommissionSummary(userId: string) {
    return commissionForecastService.getCommissionSummary(userId);
  }

  /**
   * 分析佣金影响因素
   */
  async analyzeCommissionFactors(userId: string) {
    return commissionForecastService.analyzeCommissionFactors(userId);
  }

  // ==================== 团队统计 ====================

  /**
   * 计算团队活跃率
   */
  async calculateTeamActiveRate(userId: string, period: string) {
    return teamCalculatorService.calculateTeamActiveRate(userId, period);
  }

  /**
   * 获取团队成员数量统计
   */
  async getTeamMemberStats(userId: string) {
    return teamCalculatorService.getTeamMemberStats(userId);
  }

  /**
   * 获取推荐树结构
   */
  async getReferralTree(userId: string, maxLevel: number = 3) {
    return referralCalculatorService.getReferralTree(userId, maxLevel);
  }

  /**
   * 获取推荐统计信息
   */
  async getReferralStats(userId: string) {
    return referralCalculatorService.getReferralStats(userId);
  }

  // ==================== 缓存管理 ====================

  /**
   * 清除指定用户的缓存
   */
  clearUserCache(userId: string): void {
    performanceCacheService.clearUserCache(userId);
  }

  /**
   * 预热缓存
   */
  async warmupCache(userIds: string[]): Promise<void> {
    try {
      logger.info('开始预热业绩缓存', { userIdCount: userIds.length });

      const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      // 并行预热核心数据
      await Promise.all(
        userIds.map(async (userId) => {
          try {
            await Promise.all([
              personalCalculatorService.calculatePersonalPerformance(userId, currentPeriod),
              teamCalculatorService.calculateTeamPerformance(userId, currentPeriod),
              referralCalculatorService.calculateReferralPerformance(userId, currentPeriod)
            ]);
          } catch (error) {
            logger.error('预热用户缓存失败', { userId, error });
          }
        })
      );

      // 预热排行榜
      await Promise.all([
        rankingService.getPerformanceLeaderboard('personal', currentPeriod, 50),
        rankingService.getPerformanceLeaderboard('team', currentPeriod, 50),
        rankingService.getPerformanceLeaderboard('referral', currentPeriod, 50)
      ]);

      logger.info('业绩缓存预热完成', { userIdCount: userIds.length });
    } catch (error) {
      logger.error('预热缓存失败', { userIdCount: userIds.length, error });
    }
  }

  /**
   * 获取缓存信息
   */
  getCacheInfo(): {
    size: number;
    keys: string[];
  } {
    return {
      size: performanceCacheService.size(),
      keys: performanceCacheService.keys()
    };
  }

  /**
   * 清空所有缓存
   */
  clearAllCache(): void {
    performanceCacheService.clear();
  }

  // ==================== 数据校验和异常处理 ====================

  /**
   * 验证业绩数据完整性
   */
  async validatePerformanceData(userId: string, period: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // 检查用户是否存在
      const user = await prisma.users.findUnique({
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
  async rebuildPerformanceMetrics(userId: string, period: string): Promise<{
    success: boolean;
    message: string;
    metrics?: any;
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
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { level: true }
      });

      if (!user) {
        return {
          success: false,
          message: '用户不存在'
        };
      }

      // 获取晋级进度
      const upgradeProgress = await this.getUpgradeProgress(userId);

      // 创建业绩指标记录
      const metrics = {
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
          currentRole: upgradeProgress.currentLevel,
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

// 导出各服务实例以供直接使用
export {
  performanceCacheService,
  personalCalculatorService,
  teamCalculatorService,
  referralCalculatorService,
  rankingService,
  progressionService,
  commissionForecastService
};