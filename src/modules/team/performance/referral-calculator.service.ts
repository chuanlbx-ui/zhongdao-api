/**
 * 推荐业绩计算服务
 * 负责计算和统计推荐相关的业绩指标
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { performanceCacheService } from './cache.service';
import {
  ReferralPerformance,
  ReferralData,
  PeriodRange,
  CacheConfig
} from './types';

export class ReferralCalculatorService {
  private cacheTTL: Pick<CacheConfig, 'performanceMetrics'>;

  constructor() {
    this.cacheTTL = {
      performanceMetrics: 300 // 5分钟
    };
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
      const cached = performanceCacheService.get(cacheKey);
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
        networkGrowth: await this.calculateNetworkGrowthRate(userId, period),
        activeReferrals: activeReferralsCount,
        conversionRate: totalReferralsCount > 0 ? activeReferralsCount / totalReferralsCount : 0
      };

      performanceCacheService.set(cacheKey, performance, this.cacheTTL.performanceMetrics);

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

  /**
   * 获取推荐数据
   */
  async getReferralData(userId: string): Promise<ReferralData> {
    try {
      // 获取直接推荐
      const directReferrals = await prisma.users.findMany({
        where: { parentId: userId },
        select: { id: true }
      });

      const directReferralIds = directReferrals.map(r => r.id);

      // 获取间接推荐（下级的推荐）
      let indirectReferrals: string[] = [];
      if (directReferralIds.length > 0) {
        const indirect = await prisma.users.findMany({
          where: {
            parentId: { in: directReferralIds }
          },
          select: { id: true }
        });
        indirectReferrals = indirect.map(r => r.id);
      }

      return {
        directReferrals: directReferralIds,
        indirectReferrals
      };
    } catch (error) {
      logger.error('获取推荐数据失败', { userId, error });
      return { directReferrals: [], indirectReferrals: [] };
    }
  }

  /**
   * 获取推荐销售数据
   */
  async getReferralSales(userIds: string[], startDate: Date, endDate: Date): Promise<{ totalAmount: number }> {
    if (userIds.length === 0) return { totalAmount: 0 };

    try {
      const result = await prisma.orders.aggregate({
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
  async getActiveReferralsCount(userIds: string[], startDate: Date, endDate: Date): Promise<number> {
    if (userIds.length === 0) return 0;

    try {
      const activeReferrals = await prisma.orders.findMany({
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
   * 计算网络增长率
   */
  async calculateNetworkGrowthRate(userId: string, period: string): Promise<number> {
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
      logger.error('计算网络增长率失败', { userId, period, error });
      return 0;
    }
  }

  /**
   * 获取新增成员数量
   */
  private async getNewMembersCount(userId: string, startDate: Date, endDate: Date): Promise<number> {
    try {
      return await prisma.users.count({
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
   * 解析统计周期
   */
  private parsePeriod(period: string): PeriodRange {
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
    }

    // 默认返回当月
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: now
    };
  }

  /**
   * 获取推荐树结构（最多返回指定层级）
   */
  async getReferralTree(userId: string, maxLevel: number = 3): Promise<any> {
    try {
      const cacheKey = `referral_tree:${userId}:${maxLevel}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      const buildTree = async (parentId: string, level: number): Promise<any> => {
        if (level > maxLevel) return null;

        const directReferrals = await prisma.users.findMany({
          where: { parentId },
          select: {
            id: true,
            nickname: true,
            level: true,
            directCount: true,
            createdAt: true
          }
        });

        if (directReferrals.length === 0) return null;

        const children = await Promise.all(
          directReferrals.map(async (referral) => {
            const subtree = await buildTree(referral.id, level + 1);
            return {
              userId: referral.id,
              nickname: referral.nickname,
              level: referral.level,
              directCount: referral.directCount,
              joinDate: referral.createdAt,
              children: subtree ? [subtree] : []
            };
          })
        );

        return {
          parentId,
          level,
          children: children.filter(c => c !== null)
        };
      };

      const tree = await buildTree(userId, 1);

      performanceCacheService.set(cacheKey, tree, 600); // 10分钟缓存

      return tree;
    } catch (error) {
      logger.error('获取推荐树失败', { userId, maxLevel, error });
      return null;
    }
  }

  /**
   * 获取推荐统计信息
   */
  async getReferralStats(userId: string): Promise<{
    totalDirect: number;
    totalIndirect: number;
    totalNetwork: number;
    activeDirectRate: number;
    activeNetworkRate: number;
    totalReferralRevenue: number;
  }> {
    try {
      const cacheKey = `referral_stats:${userId}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // 获取推荐数据
      const referralData = await this.getReferralData(userId);
      const allReferrals = [...referralData.directReferrals, ...referralData.indirectReferrals];

      // 并行获取统计数据
      const [
        directCount,
        indirectCount,
        activeDirectCount,
        activeNetworkCount,
        directSales,
        indirectSales
      ] = await Promise.all([
        Promise.resolve(referralData.directReferrals.length),
        Promise.resolve(referralData.indirectReferrals.length),
        this.getActiveReferralsCount(referralData.directReferrals, monthStart, now),
        this.getActiveReferralsCount(allReferrals, monthStart, now),
        this.getReferralSales(referralData.directReferrals, monthStart, now),
        this.getReferralSales(referralData.indirectReferrals, monthStart, now)
      ]);

      const totalNetwork = directCount + indirectCount;
      const totalReferralRevenue = directSales.totalAmount + indirectSales.totalAmount * 0.3;

      const stats = {
        totalDirect: directCount,
        totalIndirect: indirectCount,
        totalNetwork,
        activeDirectRate: directCount > 0 ? activeDirectCount / directCount : 0,
        activeNetworkRate: totalNetwork > 0 ? activeNetworkCount / totalNetwork : 0,
        totalReferralRevenue
      };

      performanceCacheService.set(cacheKey, stats, 300); // 5分钟缓存

      return stats;
    } catch (error) {
      logger.error('获取推荐统计失败', { userId, error });
      return {
        totalDirect: 0,
        totalIndirect: 0,
        totalNetwork: 0,
        activeDirectRate: 0,
        activeNetworkRate: 0,
        totalReferralRevenue: 0
      };
    }
  }
}

// 导出服务实例
export const referralCalculatorService = new ReferralCalculatorService();