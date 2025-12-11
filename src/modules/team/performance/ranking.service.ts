/**
 * 排行榜服务
 * 负责生成和管理各种业绩排行榜
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { performanceCacheService } from './cache.service';
import { teamCalculatorService } from './team-calculator.service';
import {
  LeaderboardItem,
  LeaderboardRankingResult,
  PeriodRange,
  CacheConfig
} from './types';
import { TeamRole } from '../types';

export class RankingService {
  private cacheTTL: Pick<CacheConfig, 'leaderboard'>;

  constructor() {
    this.cacheTTL = {
      leaderboard: 600 // 10分钟
    };
  }

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
      const cached = performanceCacheService.get(cacheKey);
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

      performanceCacheService.set(cacheKey, leaderboard, this.cacheTTL.leaderboard);

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
  ): Promise<LeaderboardRankingResult> {
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

  /**
   * 获取个人排行榜
   */
  private async getPersonalLeaderboard(startDate: Date, endDate: Date, limit: number): Promise<LeaderboardItem[]> {
    try {
      const topPerformers = await prisma.$queryRaw<Array<{
        userId: string;
        nickname: string;
        avatar: string | null;
        level: string;
        total_amount: bigint;
      }>>`
        SELECT
          u.id as userId,
          u.nickname,
          u.avatar,
          u.level,
          COALESCE(SUM(o.total_amount), 0) as total_amount
        FROM users u
        LEFT JOIN orders o ON u.id = o.seller_id
          AND o.status IN ('PAID', 'SHIPPED', 'DELIVERED')
          AND o.createdAt >= ${startDate}
          AND o.createdAt <= ${endDate}
        WHERE u.status = 'ACTIVE'
          AND u.level IN ('STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR')
        GROUP BY u.id, u.nickname, u.avatar, u.level
        ORDER BY total_amount DESC
        LIMIT ${limit}
      `;

      return topPerformers.map((performer, index) => ({
        userId: performer.userId,
        nickname: performer.nickname || '未知用户',
        avatar: performer.avatar || undefined,
        role: this.mapUserLevelToTeamRole(performer.level as any),
        level: this.getUserLevelNumber(performer.level as any),
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
      // 获取团队领导者
      const teamLeaders = await prisma.users.findMany({
        where: {
          status: 'ACTIVE',
          level: { in: ['STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'] }
        },
        select: {
          id: true,
          nickname: true,
          avatar: true,
          level: true,
          teamId: true
        }
      });

      // 计算团队业绩
      const teamPerformances = await Promise.all(
        teamLeaders.map(async (leader) => {
          const teamMembers = await teamCalculatorService.getAllTeamMembers(leader.id);
          const teamSales = await prisma.orders.aggregate({
            where: {
              sellerId: { in: teamMembers.map(m => m.userId) },
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
            userId: leader.id,
            nickname: leader.nickname || '未知团队领导',
            avatar: leader.avatar,
            role: this.mapUserLevelToTeamRole(leader.level as any),
            level: this.getUserLevelNumber(leader.level as any),
            value: Number(teamSales._sum.totalAmount || 0),
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
      // 获取推荐排行榜（按直推人数）
      const topReferrers = await prisma.users.findMany({
        where: {
          status: 'ACTIVE'
        },
        select: {
          id: true,
          nickname: true,
          avatar: true,
          level: true,
          directCount: true
        },
        orderBy: {
          directCount: 'desc'
        },
        take: limit
      });

      // 计算推荐产生的销售
      const referrersWithSales = await Promise.all(
        topReferrers.map(async (referrer) => {
          const directReferrals = await prisma.users.findMany({
            where: { parentId: referrer.id },
            select: { id: true }
          });

          const referralIds = directReferrals.map(r => r.id);
          let referralSales = 0;

          if (referralIds.length > 0) {
            const salesResult = await prisma.orders.aggregate({
              where: {
                sellerId: { in: referralIds },
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
            referralSales = Number(salesResult._sum.totalAmount || 0);
          }

          return {
            userId: referrer.id,
            nickname: referrer.nickname || '未知推荐人',
            avatar: referrer.avatar,
            role: this.mapUserLevelToTeamRole(referrer.level as any),
            level: this.getUserLevelNumber(referrer.level as any),
            value: referrer.directCount,
            referralSales
          };
        })
      );

      return referrersWithSales.map((referrer, index) => ({
        userId: referrer.userId,
        nickname: referrer.nickname,
        avatar: referrer.avatar,
        role: referrer.role,
        level: referrer.level,
        value: referrer.value,
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
   * 获取指定用户的排行榜周围数据
   */
  async getLeaderboardAroundUser(
    userId: string,
    type: 'personal' | 'team' | 'referral',
    period: string,
    radius: number = 5
  ): Promise<{
    userRanking: LeaderboardRankingResult;
    surroundingRankings: LeaderboardItem[];
  }> {
    try {
      // 获取完整排行榜
      const fullLeaderboard = await this.getPerformanceLeaderboard(type, period, 1000);

      // 查找用户位置
      const userIndex = fullLeaderboard.findIndex(item => item.userId === userId);

      if (userIndex === -1) {
        return {
          userRanking: {
            rank: -1,
            total: 0,
            percentile: 0
          },
          surroundingRankings: []
        };
      }

      const userItem = fullLeaderboard[userIndex];
      const start = Math.max(0, userIndex - radius);
      const end = Math.min(fullLeaderboard.length - 1, userIndex + radius);

      const surroundingRankings = fullLeaderboard.slice(start, end + 1);

      return {
        userRanking: {
          rank: userItem.rank,
          total: fullLeaderboard.length,
          percentile: ((fullLeaderboard.length - userItem.rank + 1) / fullLeaderboard.length) * 100,
          item: userItem
        },
        surroundingRankings
      };
    } catch (error) {
      logger.error('获取用户周围排行榜失败', {
        userId,
        type,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取排行榜摘要统计
   */
  async getLeaderboardSummary(
    type: 'personal' | 'team' | 'referral',
    period: string
  ): Promise<{
    totalParticipants: number;
    topValue: number;
    averageValue: number;
    medianValue: number;
    top10PercentValue: number;
  }> {
    try {
      const cacheKey = `leaderboard_summary:${type}:${period}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      const leaderboard = await this.getPerformanceLeaderboard(type, period, 1000);

      if (leaderboard.length === 0) {
        return {
          totalParticipants: 0,
          topValue: 0,
          averageValue: 0,
          medianValue: 0,
          top10PercentValue: 0
        };
      }

      const values = leaderboard.map(item => item.value);
      values.sort((a, b) => b - a);

      const top10PercentIndex = Math.ceil(values.length * 0.1) - 1;
      const middleIndex = Math.floor(values.length / 2);

      const summary = {
        totalParticipants: leaderboard.length,
        topValue: values[0],
        averageValue: values.reduce((sum, val) => sum + val, 0) / values.length,
        medianValue: values[middleIndex],
        top10PercentValue: values[top10PercentIndex]
      };

      performanceCacheService.set(cacheKey, summary, this.cacheTTL.leaderboard);

      return summary;
    } catch (error) {
      logger.error('获取排行榜摘要失败', {
        type,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        totalParticipants: 0,
        topValue: 0,
        averageValue: 0,
        medianValue: 0,
        top10PercentValue: 0
      };
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
   * 获取用户等级数字
   */
  private getUserLevelNumber(userLevel: string): number {
    const levelMap: Record<string, number> = {
      'NORMAL': 0,
      'VIP': 0,
      'STAR_1': 1,
      'STAR_2': 2,
      'STAR_3': 3,
      'STAR_4': 4,
      'STAR_5': 5,
      'DIRECTOR': 6
    };

    return levelMap[userLevel] || 0;
  }
}

// 导出服务实例
export const rankingService = new RankingService();