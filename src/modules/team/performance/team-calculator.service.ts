/**
 * 团队业绩计算服务
 * 负责计算和统计团队相关的业绩指标
 */

import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { performanceCacheService } from './cache.service';
import {
  TeamPerformance,
  PeriodRange,
  TeamMemberInfo,
  CacheConfig
} from './types';

export class TeamCalculatorService {
  private cacheTTL: Pick<CacheConfig, 'teamStats'>;

  constructor() {
    this.cacheTTL = {
      teamStats: 180 // 3分钟
    };
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
      const cached = performanceCacheService.get(cacheKey);
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
      const levelDistribution = await this.calculateLevelDistribution(teamMembers, startDate, endDate);

      const performance: TeamPerformance = {
        teamSales: teamSalesData.totalAmount,
        teamOrders: teamOrderData.orderCount,
        newMembers: newMembersCount,
        activeRate: teamMemberIds.length > 0 ? activeMembersCount / teamMemberIds.length : 0,
        productivity: teamMemberIds.length > 0 ? teamSalesData.totalAmount / teamMemberIds.length : 0,
        levelDistribution
      };

      performanceCacheService.set(cacheKey, performance, this.cacheTTL.teamStats);

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
   * 获取所有团队成员
   */
  async getAllTeamMembers(userId: string): Promise<TeamMemberInfo[]> {
    try {
      // 使用 teamPath 字段进行高效查询
      const members = await prisma.users.findMany({
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
  async getTeamSalesData(userIds: string[], startDate: Date, endDate: Date): Promise<{ totalAmount: number }> {
    try {
      if (userIds.length === 0) {
        return { totalAmount: 0 };
      }

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
      logger.error('获取团队销售数据失败', { userIds, error });
      return { totalAmount: 0 };
    }
  }

  /**
   * 获取团队订单数据
   */
  async getTeamOrderData(userIds: string[], startDate: Date, endDate: Date): Promise<{ orderCount: number }> {
    try {
      if (userIds.length === 0) {
        return { orderCount: 0 };
      }

      const orderCount = await prisma.orders.count({
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
  async getNewMembersCount(userId: string, startDate: Date, endDate: Date): Promise<number> {
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
   * 获取活跃成员数量
   */
  async getActiveMembersCount(userIds: string[], startDate: Date, endDate: Date): Promise<number> {
    try {
      if (userIds.length === 0) {
        return 0;
      }

      // 有销售记录的成员视为活跃
      const activeMembers = await prisma.orders.findMany({
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
  async calculateLevelDistribution(
    teamMembers: TeamMemberInfo[],
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
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
          const salesResult = await prisma.orders.aggregate({
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
   * 计算团队活跃率
   */
  async calculateTeamActiveRate(userId: string, period: string): Promise<number> {
    try {
      const cacheKey = `team_active_rate:${userId}:${period}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      const { startDate, endDate } = this.parsePeriod(period);
      const teamMembers = await this.getAllTeamMembers(userId);
      const teamMemberIds = teamMembers.map(m => m.userId);

      if (teamMemberIds.length === 0) {
        return 0;
      }

      const activeCount = await this.getActiveMembersCount(teamMemberIds, startDate, endDate);
      const activeRate = activeCount / teamMemberIds.length;

      performanceCacheService.set(cacheKey, activeRate, this.cacheTTL.teamStats);

      return activeRate;
    } catch (error) {
      logger.error('计算团队活跃率失败', { userId, period, error });
      return 0;
    }
  }

  /**
   * 获取团队成员数量统计
   */
  async getTeamMemberStats(userId: string): Promise<{
    totalMembers: number;
    activeMembers: number;
    newMembersThisMonth: number;
    directMembers: number;
  }> {
    try {
      const cacheKey = `team_member_stats:${userId}`;
      const cached = performanceCacheService.get(cacheKey);
      if (cached) return cached;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalMembers,
        activeMembers,
        newMembersThisMonth,
        directMembers
      ] = await Promise.all([
        // 总成员数
        this.getAllTeamMembers(userId).then(members => members.length),
        // 活跃成员数（本月有销售的）
        this.getAllTeamMembers(userId).then(members => {
          const memberIds = members.map(m => m.userId);
          return this.getActiveMembersCount(memberIds, monthStart, now);
        }),
        // 本月新增成员
        this.getNewMembersCount(userId, monthStart, now),
        // 直推成员
        prisma.users.count({
          where: { parentId: userId }
        })
      ]);

      const stats = {
        totalMembers,
        activeMembers,
        newMembersThisMonth,
        directMembers
      };

      performanceCacheService.set(cacheKey, stats, 300); // 5分钟缓存

      return stats;
    } catch (error) {
      logger.error('获取团队成员统计失败', { userId, error });
      return {
        totalMembers: 0,
        activeMembers: 0,
        newMembersThisMonth: 0,
        directMembers: 0
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
}

// 导出服务实例
export const teamCalculatorService = new TeamCalculatorService();