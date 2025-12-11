import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { UserLevel, userLevelService } from '../user/level.service';
import { CommissionCalculationParams, CommissionRecord } from './types';

/**
 * 佣金计算器
 * 负责计算和分配多级佣金
 */
export class CommissionCalculator {
  /**
   * 计算并分配佣金
   * @param params 佣金计算参数
   * @param tx 数据库事务对象（可选）
   * @returns 佣金记录数组
   */
  async calculateAndDistributeCommission(
    params: CommissionCalculationParams,
    tx?: any
  ): Promise<CommissionRecord[]> {
    try {
      const commissionRecords: CommissionRecord[] = [];
      const db = tx || prisma;

      // 获取佣金路径（从销售方往上的团队链）
      const commissionPath = await this.getCommissionPath(params.sellerId);

      // 获取销售方的佣金比例
      const sellerBenefits = userLevelService.getLevelBenefits(params.sellerLevel);
      const baseCommissionRate = sellerBenefits.commissionRate;

      // 为链条中的每个用户分配佣金
      const maxDepth = params.maxDepth || 5;
      for (let i = 0; i < commissionPath.length && i < maxDepth; i++) {
        const pathUser = commissionPath[i];

        // 计算佣金比例：每级递减20%
        const commissionRate = baseCommissionRate * Math.pow(0.8, i);
        const commissionAmount = params.totalAmount * commissionRate;

        // 最小佣金门槛（避免过小的金额）
        if (commissionAmount > 0.01) {
          const commission = await db.commissionRecord.create({
            data: {
              userId: pathUser.id,
              orderId: params.orderId,
              amount: commissionAmount,
              rate: commissionRate,
              level: i + 1,
              sourceUserId: params.sellerId,
              sourceType: 'PURCHASE',
              status: 'PENDING',
              metadata: {
                pathDepth: i + 1,
                maxDepth: maxDepth,
                baseCommissionRate,
                calculationMethod: 'degressive'
              }
            }
          });

          commissionRecords.push({
            id: commission.id,
            userId: commission.userId,
            orderId: commission.orderId,
            amount: commission.amount,
            rate: commission.rate,
            level: commission.level,
            sourceUserId: commission.sourceUserId,
            sourceType: commission.sourceType,
            status: commission.status,
            metadata: commission.metadata as Record<string, any>
          });

          logger.info('佣金记录创建成功', {
            commissionId: commission.id,
            userId: pathUser.id,
            orderId: params.orderId,
            amount: commissionAmount,
            rate: commissionRate,
            level: i + 1
          });
        }
      }

      // 计算总佣金金额
      const totalCommission = commissionRecords.reduce((sum, record) => sum + record.amount, 0);

      logger.info('佣金分配完成', {
        orderId: params.orderId,
        totalCommission,
        recordCount: commissionRecords.length,
        sellerId: params.sellerId,
        sellerLevel: params.sellerLevel
      });

      return commissionRecords;
    } catch (error) {
      logger.error('计算分配佣金失败', {
        orderId: params.orderId,
        sellerId: params.sellerId,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      });
      return [];
    }
  }

  /**
   * 获取佣金路径
   * 从指定用户向上获取团队链，用于佣金分配
   * @param userId 起始用户ID
   * @param maxDepth 最大深度
   * @returns 用户路径数组
   */
  async getCommissionPath(
    userId: string,
    maxDepth: number = 5
  ): Promise<Array<{ id: string; level: UserLevel }>> {
    const path: Array<{ id: string; level: UserLevel }> = [];
    let currentUserId = userId;
    let depth = 0;

    try {
      while (currentUserId && depth < maxDepth) {
        const user = await prisma.users.findUnique({
          where: { id: currentUserId },
          select: {
            id: true,
            level: true,
            referrerId: true,
            parentId: true,
            status: true
          }
        });

        if (!user || user.status !== 'ACTIVE') {
          break;
        }

        // 将用户添加到路径中
        path.push({
          id: user.id,
          level: user.level as UserLevel
        });

        // 向上移动到推荐人或父级
        currentUserId = user.referrerId || user.parentId;
        depth++;
      }

      return path;
    } catch (error) {
      logger.error('获取佣金路径失败', {
        userId,
        maxDepth,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 预计算佣金金额
   * 用于在订单创建前预估佣金
   * @param params 佣金计算参数
   * @returns 预计算的佣金信息
   */
  async previewCommission(
    params: Omit<CommissionCalculationParams, 'orderId'>
  ): Promise<{
    totalCommission: number;
    commissionBreakdown: Array<{
      userId: string;
      level: number;
      amount: number;
      rate: number;
      userLevel: UserLevel;
    }>;
  }> {
    try {
      // 获取佣金路径
      const commissionPath = await this.getCommissionPath(params.sellerId);

      // 获取销售方的佣金比例
      const sellerBenefits = userLevelService.getLevelBenefits(params.sellerLevel);
      const baseCommissionRate = sellerBenefits.commissionRate;

      const maxDepth = params.maxDepth || 5;
      const commissionBreakdown = [];
      let totalCommission = 0;

      // 计算每个层级的佣金
      for (let i = 0; i < commissionPath.length && i < maxDepth; i++) {
        const pathUser = commissionPath[i];
        const commissionRate = baseCommissionRate * Math.pow(0.8, i);
        const commissionAmount = params.totalAmount * commissionRate;

        if (commissionAmount > 0.01) {
          commissionBreakdown.push({
            userId: pathUser.id,
            level: i + 1,
            amount: commissionAmount,
            rate: commissionRate,
            userLevel: pathUser.level
          });
          totalCommission += commissionAmount;
        }
      }

      return {
        totalCommission,
        commissionBreakdown
      };
    } catch (error) {
      logger.error('预计算佣金失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        totalCommission: 0,
        commissionBreakdown: []
      };
    }
  }

  /**
   * 计算团队业绩
   * 计算指定用户在一定时间内的团队业绩
   * @param userId 用户ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 团队业绩统计
   */
  async calculateTeamPerformance(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalOrders: number;
    totalAmount: number;
    totalCommission: number;
    teamSize: number;
    activeMembers: number;
  }> {
    try {
      // 获取团队成员
      const teamMembers = await prisma.users.findMany({
        where: {
          OR: [
            { parentId: userId },
            { referrerId: userId },
            { teamPath: { contains: `/${userId}/` } }
          ]
        },
        select: {
          id: true,
          status: true,
          level: true
        }
      });

      const teamSize = teamMembers.length;
      const activeMembers = teamMembers.filter(member => member.status === 'ACTIVE').length;
      const memberIds = teamMembers.map(member => member.id);

      // 计算团队订单
      const teamOrders = await prisma.purchaseOrderss.findMany({
        where: {
          buyerId: { in: memberIds },
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          status: 'COMPLETED'
        },
        select: {
          id: true,
          totalAmount: true
        }
      });

      // 计算团队佣金
      const teamCommissions = await prisma.commissionRecord.findMany({
        where: {
          userId: { in: memberIds },
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          status: 'PAID'
        },
        select: {
          amount: true
        }
      });

      const totalOrders = teamOrders.length;
      const totalAmount = teamOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      const totalCommission = teamCommissions.reduce((sum, commission) => sum + commission.amount, 0);

      return {
        totalOrders,
        totalAmount,
        totalCommission,
        teamSize,
        activeMembers
      };
    } catch (error) {
      logger.error('计算团队业绩失败', {
        userId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        totalOrders: 0,
        totalAmount: 0,
        totalCommission: 0,
        teamSize: 0,
        activeMembers: 0
      };
    }
  }

  /**
   * 获取用户佣金统计
   * @param userId 用户ID
   * @param period 统计周期（day/week/month/year）
   * @returns 佣金统计信息
   */
  async getUserCommissionStats(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<{
    totalCommission: number;
    pendingCommission: number;
    paidCommission: number;
    orderCount: number;
    averageCommission: number;
  }> {
    try {
      // 计算时间范围
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      // 获取佣金记录
      const commissions = await prisma.commissionRecord.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: now
          }
        },
        select: {
          amount: true,
          status: true,
          orderId: true
        }
      });

      const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
      const pendingCommission = commissions
        .filter(c => c.status === 'PENDING')
        .reduce((sum, c) => sum + c.amount, 0);
      const paidCommission = commissions
        .filter(c => c.status === 'PAID')
        .reduce((sum, c) => sum + c.amount, 0);

      const orderCount = new Set(commissions.map(c => c.orderId)).size;
      const averageCommission = orderCount > 0 ? totalCommission / orderCount : 0;

      return {
        totalCommission,
        pendingCommission,
        paidCommission,
        orderCount,
        averageCommission
      };
    } catch (error) {
      logger.error('获取用户佣金统计失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        totalCommission: 0,
        pendingCommission: 0,
        paidCommission: 0,
        orderCount: 0,
        averageCommission: 0
      };
    }
  }
}