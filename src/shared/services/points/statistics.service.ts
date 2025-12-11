import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { PointsBalance } from './types';
import { balanceService } from './balance.service';

export class StatisticsService {
  // 获取通券统计信息
  async getPointsStatistics(userId: string) {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        totalReceived,
        totalSent,
        totalReceivedToday,
        totalSentToday,
        latestTransactions
      ] = await Promise.all([
        // 总收入
        prisma.pointsTransactions.aggregate({
          where: {
            toUserId: userId,
            status: 'COMPLETED'
          },
          _sum: {
            amount: true
          }
        }),
        // 总支出
        prisma.pointsTransactions.aggregate({
          where: {
            fromUserId: userId,
            status: 'COMPLETED'
          },
          _sum: {
            amount: true
          }
        }),
        // 今日收入
        prisma.pointsTransactions.aggregate({
          where: {
            toUserId: userId,
            status: 'COMPLETED',
            createdAt: {
              gte: todayStart
            }
          },
          _sum: {
            amount: true
          }
        }),
        // 今日支出
        prisma.pointsTransactions.aggregate({
          where: {
            fromUserId: userId,
            status: 'COMPLETED',
            createdAt: {
              gte: todayStart
            }
          },
          _sum: {
            amount: true
          }
        }),
        // 最近交易记录
        prisma.pointsTransactions.findMany({
          where: {
            OR: [
              { fromUserId: userId },
              { toUserId: userId }
            ]
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            type: true,
            description: true,
            createdAt: true,
            fromUserId: true,
            toUserId: true
          }
        })
      ]);

      const balance: PointsBalance = await balanceService.getBalance(userId);

      return {
        balance,
        statistics: {
          totalReceived: totalReceived._sum.amount || 0,
          totalSent: Math.abs(totalSent._sum.amount || 0),
          totalReceivedToday: totalReceivedToday._sum.amount || 0,
          totalSentToday: Math.abs(totalSentToday._sum.amount || 0),
          netReceived: (totalReceived._sum.amount || 0) + (totalSent._sum.amount || 0)
        },
        recentTransactions: latestTransactions
      };

    } catch (error) {
      logger.error('获取通券统计信息失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取全局通券统计（管理员功能）
  async getGlobalPointsStatistics() {
    try {
      const [
        totalUsersBalance,
        totalFrozenPoints,
        totalTransactionsCount,
        todayTransactionsCount,
        totalRechargedToday,
        totalWithdrawnToday
      ] = await Promise.all([
        // 所有用户总余额
        prisma.users.aggregate({
          _sum: {
            pointsBalance: true
          }
        }),
        // 所有用户冻结总额
        prisma.users.aggregate({
          _sum: {
            pointsFrozen: true
          }
        }),
        // 总交易笔数
        prisma.pointsTransactions.count(),
        // 今日交易笔数
        prisma.pointsTransactions.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),
        // 今日充值总额
        prisma.pointsTransactions.aggregate({
          where: {
            type: 'RECHARGE',
            status: 'COMPLETED',
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          },
          _sum: {
            amount: true
          }
        }),
        // 今日提现总额
        prisma.pointsTransactions.aggregate({
          where: {
            type: 'WITHDRAW',
            status: 'COMPLETED',
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          },
          _sum: {
            amount: true
          }
        })
      ]);

      return {
        totalBalance: totalUsersBalance._sum.pointsBalance || 0,
        totalFrozen: totalFrozenPoints._sum.pointsFrozen || 0,
        totalAvailable: (totalUsersBalance._sum.pointsBalance || 0) - (totalFrozenPoints._sum.pointsFrozen || 0),
        totalTransactions: totalTransactionsCount,
        todayTransactions: todayTransactionsCount,
        todayRecharged: totalRechargedToday._sum.amount || 0,
        todayWithdrawn: Math.abs(totalWithdrawnToday._sum.amount || 0)
      };

    } catch (error) {
      logger.error('获取全局通券统计失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 获取用户积分排行榜
  async getPointsRanking(limit: number = 10) {
    try {
      const users = await prisma.users.findMany({
        select: {
          id: true,
          nickname: true,
          userNumber: true,
          level: true,
          pointsBalance: true
        },
        orderBy: {
          pointsBalance: 'desc'
        },
        take: limit
      });

      return users.map((user, index) => ({
        rank: index + 1,
        userId: user.id,
        nickname: user.nickname,
        userNumber: user.userNumber,
        level: user.level,
        balance: user.pointsBalance
      }));

    } catch (error) {
      logger.error('获取积分排行榜失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const statisticsService = new StatisticsService();