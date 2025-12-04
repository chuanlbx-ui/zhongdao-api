// @ts-nocheck
import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { UserLevel } from './level.service';

// 团队成员信息接口
export interface TeamMember {
  id: string;
  nickname: string;
  level: UserLevel;
  status: string;
  totalPurchases: number;
  teamSize: number;
  joinedAt: Date;
  lastActiveAt?: Date;
  path: string;
}

// 团队统计信息接口
export interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  totalPurchases: number;
  totalSales: number;
  levelDistribution: Record<UserLevel, number>;
  monthlyGrowth: number;
  topPerformers: TeamMember[];
}

// 团队服务类
export class TeamService {
  // 获取用户的直推团队
  async getDirectTeam(userId: string, page: number = 1, perPage: number = 20): Promise<{
    members: TeamMember[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const skip = (page - 1) * perPage;

      const [members, total] = await Promise.all([
        prisma.users.findMany({
          where: { referrerId: userId },
          select: {
            id: true,
            nickname: true,
            level: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            purchaseOrders: {
              where: { status: 'COMPLETED' },
              select: { totalAmount: true }
            },
            referredUsers: {
              select: { id: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: perPage
        }),
        prisma.users.count({
          where: { referrerId: userId }
        })
      ]);

      const teamMembers: TeamMember[] = members.map(member => ({
        id: member.id,
        nickname: member.nickname || '未设置昵称',
        level: member.level as UserLevel,
        status: member.status,
        totalPurchases: member.purchaseOrders.reduce((sum, order) => sum + order.totalAmount, 0),
        teamSize: member.referredUsers.length,
        joinedAt: member.createdAt,
        lastActiveAt: member.updatedAt,
        path: `${userId}->${member.id}`
      }));

      return {
        members: teamMembers,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };
    } catch (error) {
      logger.error('获取直推团队失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取完整团队树（递归获取所有下级）
  async getFullTeamTree(userId: string, maxDepth: number = 5): Promise<{
    root: TeamMember;
    tree: any[];
    stats: TeamStats;
  }> {
    try {
      // 获取根用户信息
      const rootUser = await this.getUserWithStats(userId);
      if (!rootUser) {
        throw new Error('用户不存在');
      }

      // 递归构建团队树
      const tree = await this.buildTeamTree(userId, 0, maxDepth);

      // 计算团队统计
      const stats = await this.calculateTeamStats(userId);

      return {
        root: rootUser,
        tree,
        stats
      };
    } catch (error) {
      logger.error('获取团队树失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 递归构建团队树
  private async buildTeamTree(userId: string, currentDepth: number, maxDepth: number): Promise<any[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    try {
      const directMembers = await prisma.users.findMany({
        where: { referrerId: userId },
        select: {
          id: true,
          nickname: true,
          level: true,
          status: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const tree = await Promise.all(
        directMembers.map(async (member) => {
          const memberWithStats = await this.getUserWithStats(member.id);
          const children = await this.buildTeamTree(member.id, currentDepth + 1, maxDepth);

          return {
            ...memberWithStats,
            level: member.level,
            status: member.status,
            children,
            depth: currentDepth + 1
          };
        })
      );

      return tree;
    } catch (error) {
      logger.error('构建团队树节点失败', {
        userId,
        currentDepth,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  // 获取用户及统计信息
  private async getUserWithStats(userId: string): Promise<TeamMember> {
    try {
      const [user, stats] = await Promise.all([
        prisma.users.findUnique({
          where: { id: userId },
          select: {
            id: true,
            nickname: true,
            level: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            referrerId: true
          }
        }),
        this.getUserTeamStats(userId)
      ]);

      if (!user) {
        throw new Error('用户不存在');
      }

      return {
        id: user.id,
        nickname: user.nickname || '未设置昵称',
        level: user.level as UserLevel,
        status: user.status,
        totalPurchases: stats.totalPurchases,
        teamSize: stats.teamSize,
        joinedAt: user.createdAt,
        lastActiveAt: user.updatedAt,
        path: user.referrerId ? `${user.referrerId}->${user.id}` : user.id
      };
    } catch (error) {
      logger.error('获取用户统计信息失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取用户团队统计
  private async getUserTeamStats(userId: string): Promise<{
    totalPurchases: number;
    teamSize: number;
  }> {
    try {
      const [purchaseStats, teamSize] = await Promise.all([
        prisma.purchaseOrder.aggregate({
          where: {
            buyerId: userId,
            status: 'COMPLETED'
          },
          _sum: { totalAmount: true }
        }),
        prisma.users.count({
          where: { referrerId: userId }
        })
      ]);

      return {
        totalPurchases: purchaseStats._sum.totalAmount || 0,
        teamSize
      };
    } catch (error) {
      logger.error('获取用户团队统计失败', { userId });
      return { totalPurchases: 0, teamSize: 0 };
    }
  }

  // 计算团队统计信息
  async calculateTeamStats(userId: string): Promise<TeamStats> {
    try {
      const allTeamMemberIds = await this.getAllTeamMemberIds(userId);

      // 并行计算各项统计
      const [
        totalMembers,
        activeMembers,
        levelStats,
        purchaseStats,
        salesStats,
        topPerformers
      ] = await Promise.all([
        prisma.users.count({
          where: {
            id: { in: allTeamMemberIds }
          }
        }),
        prisma.users.count({
          where: {
            id: { in: allTeamMemberIds },
            status: 'ACTIVE'
          }
        }),
        this.getLevelDistribution(allTeamMemberIds),
        this.getTeamPurchases(allTeamMemberIds),
        this.getTeamSales(allTeamMemberIds),
        this.getTopPerformers(allTeamMemberIds, 5)
      ]);

      return {
        totalMembers,
        activeMembers,
        totalPurchases: purchaseStats,
        totalSales: salesStats,
        levelDistribution: levelStats,
        monthlyGrowth: await this.calculateMonthlyGrowth(userId),
        topPerformers
      };
    } catch (error) {
      logger.error('计算团队统计失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取所有团队成员ID（递归）
  private async getAllTeamMemberIds(userId: string): Promise<string[]> {
    const memberIds: string[] = [];

    const collectMembers = async (currentUserId: string) => {
      try {
        const directMembers = await prisma.users.findMany({
          where: { referrerId: currentUserId },
          select: { id: true }
        });

        for (const member of directMembers) {
          memberIds.push(member.id);
          await collectMembers(member.id);
        }
      } catch (error) {
        logger.error('收集团队成员ID失败', { currentUserId });
      }
    };

    await collectMembers(userId);
    return memberIds;
  }

  // 获取等级分布
  private async getLevelDistribution(memberIds: string[]): Promise<Record<UserLevel, number>> {
    try {
      const levelStats = await prisma.users.groupBy({
        by: ['level'],
        where: {
          id: { in: memberIds }
        },
        _count: { id: true }
      });

      const distribution: Record<UserLevel, number> = {
        [UserLevel.NORMAL]: 0,
        [UserLevel.VIP]: 0,
        [UserLevel.DIAMOND]: 0,
        [UserLevel.DIRECTOR]: 0,
        [UserLevel.MANAGER]: 0,
        [UserLevel.SENIOR_MANAGER]: 0
      };

      levelStats.forEach(stat => {
        distribution[stat.level as UserLevel] = stat._count.id;
      });

      return distribution;
    } catch (error) {
      logger.error('获取等级分布失败');
      return {
        [UserLevel.NORMAL]: 0,
        [UserLevel.VIP]: 0,
        [UserLevel.DIAMOND]: 0,
        [UserLevel.DIRECTOR]: 0,
        [UserLevel.MANAGER]: 0,
        [UserLevel.SENIOR_MANAGER]: 0
      };
    }
  }

  // 获取团队采购总额
  private async getTeamPurchases(memberIds: string[]): Promise<number> {
    try {
      const result = await prisma.purchaseOrder.aggregate({
        where: {
          buyerId: { in: memberIds },
          status: 'COMPLETED'
        },
        _sum: { totalAmount: true }
      });

      return result._sum.totalAmount || 0;
    } catch (error) {
      logger.error('获取团队采购总额失败');
      return 0;
    }
  }

  // 获取团队销售总额
  private async getTeamSales(memberIds: string[]): Promise<number> {
    try {
      const result = await prisma.purchaseOrder.aggregate({
        where: {
          sellerId: { in: memberIds },
          status: 'COMPLETED'
        },
        _sum: { totalAmount: true }
      });

      return result._sum.totalAmount || 0;
    } catch (error) {
      logger.error('获取团队销售总额失败');
      return 0;
    }
  }

  // 获取优秀团队成员
  private async getTopPerformers(memberIds: string[], limit: number): Promise<TeamMember[]> {
    try {
      const topMembers = await prisma.users.findMany({
        where: {
          id: { in: memberIds },
          status: 'ACTIVE'
        },
        select: {
          id: true,
          nickname: true,
          level: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          purchaseOrders: {
            where: { status: 'COMPLETED' },
            select: { totalAmount: true }
          },
          referredUsers: {
            select: { id: true }
          }
        },
        orderBy: {
          purchaseOrders: {
            _sum: { totalAmount: 'desc' }
          }
        },
        take: limit
      });

      return topMembers.map(member => ({
        id: member.id,
        nickname: member.nickname || '未设置昵称',
        level: member.level as UserLevel,
        status: member.status,
        totalPurchases: member.purchaseOrders.reduce((sum, order) => sum + order.totalAmount, 0),
        teamSize: member.referredUsers.length,
        joinedAt: member.createdAt,
        lastActiveAt: member.updatedAt,
        path: member.id
      }));
    } catch (error) {
      logger.error('获取优秀团队成员失败');
      return [];
    }
  }

  // 计算月度增长率
  private async calculateMonthlyGrowth(userId: string): Promise<number> {
    try {
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

      const [currentMonth, previousMonth] = await Promise.all([
        prisma.users.count({
          where: {
            referrerId: userId,
            createdAt: { gte: oneMonthAgo }
          }
        }),
        prisma.users.count({
          where: {
            referrerId: userId,
            createdAt: {
              gte: twoMonthsAgo,
              lt: oneMonthAgo
            }
          }
        })
      ]);

      if (previousMonth === 0) {
        return currentMonth > 0 ? 100 : 0;
      }

      return Math.round(((currentMonth - previousMonth) / previousMonth) * 100);
    } catch (error) {
      logger.error('计算月度增长率失败', { userId });
      return 0;
    }
  }

  // 验证团队关系
  async validateTeamRelationship(uplineId: string, downlineId: string): Promise<{
    isValid: boolean;
    relationship: string;
    distance: number;
  }> {
    try {
      if (uplineId === downlineId) {
        return {
          isValid: false,
          relationship: 'self',
          distance: 0
        };
      }

      // 检查直接关系
      const directRelation = await prisma.users.findFirst({
        where: {
          id: downlineId,
          referrerId: uplineId
        }
      });

      if (directRelation) {
        return {
          isValid: true,
          relationship: 'direct',
          distance: 1
        };
      }

      // 检查间接关系（递归查找）
      const distance = await this.findTeamDistance(uplineId, downlineId, 0, 10);

      return {
        isValid: distance > 0,
        relationship: distance > 0 ? 'indirect' : 'none',
        distance
      };
    } catch (error) {
      logger.error('验证团队关系失败', {
        uplineId,
        downlineId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        isValid: false,
        relationship: 'error',
        distance: -1
      };
    }
  }

  // 查找团队距离
  private async findTeamDistance(
    uplineId: string,
    targetId: string,
    currentDistance: number,
    maxDistance: number
  ): Promise<number> {
    if (currentDistance >= maxDistance) {
      return -1;
    }

    try {
      const downlines = await prisma.users.findMany({
        where: { referrerId: uplineId },
        select: { id: true }
      });

      for (const downline of downlines) {
        if (downline.id === targetId) {
          return currentDistance + 1;
        }

        const distance = await this.findTeamDistance(
          downline.id,
          targetId,
          currentDistance + 1,
          maxDistance
        );

        if (distance > 0) {
          return distance;
        }
      }

      return -1;
    } catch (error) {
      logger.error('查找团队距离失败', { uplineId, currentDistance });
      return -1;
    }
  }

  // 获取团队业绩报表
  async getTeamPerformanceReport(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    period: { start: Date; end: Date };
    summary: {
      newMembers: number;
      totalPurchases: number;
      totalSales: number;
      averageOrderValue: number;
    };
    levelProgression: Array<{
      level: UserLevel;
      count: number;
      newThisPeriod: number;
    }>;
    topPerformers: TeamMember[];
  }> {
    try {
      const end = endDate || new Date();
      const start = startDate || new Date(end.getFullYear(), end.getMonth() - 1, end.getDate());

      const allMemberIds = await this.getAllTeamMemberIds(userId);

      const [newMembers, purchaseStats, salesStats, levelStats, topPerformers] = await Promise.all([
        prisma.users.count({
          where: {
            id: { in: allMemberIds },
            createdAt: {
              gte: start,
              lte: end
            }
          }
        }),
        prisma.purchaseOrder.aggregate({
          where: {
            buyerId: { in: allMemberIds },
            status: 'COMPLETED',
            createdAt: {
              gte: start,
              lte: end
            }
          },
          _sum: { totalAmount: true },
          _count: { id: true }
        }),
        prisma.purchaseOrder.aggregate({
          where: {
            sellerId: { in: allMemberIds },
            status: 'COMPLETED',
            createdAt: {
              gte: start,
              lte: end
            }
          },
          _sum: { totalAmount: true }
        }),
        this.getLevelProgression(allMemberIds, start, end),
        this.getTopPerformers(allMemberIds, 10)
      ]);

      const totalPurchases = purchaseStats._sum.totalAmount || 0;
      const totalOrders = purchaseStats._count.id || 0;
      const averageOrderValue = totalOrders > 0 ? totalPurchases / totalOrders : 0;

      return {
        period: { start, end },
        summary: {
          newMembers,
          totalPurchases,
          totalSales: salesStats._sum.totalAmount || 0,
          averageOrderValue
        },
        levelProgression: levelStats,
        topPerformers
      };
    } catch (error) {
      logger.error('获取团队业绩报表失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取等级晋升情况
  private async getLevelProgression(
    memberIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ level: UserLevel; count: number; newThisPeriod: number }>> {
    try {
      const levels = Object.values(UserLevel);

      return Promise.all(
        levels.map(async (level) => {
          const [totalCount, newCount] = await Promise.all([
            prisma.users.count({
              where: {
                id: { in: memberIds },
                level
              }
            }),
            prisma.users.count({
              where: {
                id: { in: memberIds },
                level,
                updatedAt: {
                  gte: startDate,
                  lte: endDate
                }
              }
            })
          ]);

          return {
            level,
            count: totalCount,
            newThisPeriod: newCount
          };
        })
      );
    } catch (error) {
      logger.error('获取等级晋升情况失败');
      return [];
    }
  }
}

// 导出单例实例
export const teamService = new TeamService();