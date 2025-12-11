/**
 * 佣金服务实现
 * 处理佣金计算、结算、提现等核心业务逻辑
 */

import { prisma } from '../../shared/database/client';
import { pointsTransactions_type, Prisma } from '@prisma/client';

// 使用 Prisma 生成的 UserLevel 类型
type UserLevel = 'NORMAL' | 'VIP' | 'STAR_1' | 'STAR_2' | 'STAR_3' | 'STAR_4' | 'STAR_5' | 'DIRECTOR';
import { AppError, ErrorFactory } from '../../shared/errors';
import { logger } from '../../shared/utils/logger';

// 佣金计算类型
export enum CommissionType {
  DIRECT_SALES = 'DIRECT_SALES',         // 直接销售佣金
  REFERRAL = 'REFERRAL',                 // 推荐佣金
  TEAM_BONUS = 'TEAM_BONUS',             // 团队奖金
  LEVEL_BONUS = 'LEVEL_BONUS',           // 等级奖金
  PERFORMANCE_BONUS = 'PERFORMANCE_BONUS' // 绩效奖金
}

// 佣金记录接口
export interface CommissionRecord {
  id: string;
  userId: string;
  orderId?: string;
  type: CommissionType;
  amount: number;
  rate: number;
  level: string;
  description: string;
  metadata?: Record<string, any>;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
  completedAt?: Date;
}

// 佣金计算参数
export interface CommissionCalculationParams {
  orderId: string;
  buyerId: string;
  sellerId: string;
  orderAmount: number;
  products: Array<{
    productId: string;
    quantity: number;
    price: number;
    commissionRate?: number;
  }>;
  metadata?: Record<string, any>;
}

// 佣金计算结果
export interface CommissionCalculationResult {
  orderId: string;
  orderAmount: number;
  commissions: Array<{
    userId: string;
    userLevel: UserLevel;
    type: CommissionType;
    rate: number;
    amount: number;
    description: string;
  }>;
  totalCommission: number;
  calculatedAt: Date;
}

// 佣金费率配置
const COMMISSION_RATES = {
  // 直接销售佣金率
  DIRECT_SALES: {
    NORMAL: 0,
    VIP: 0.15,
    STAR_1: 0.18,
    STAR_2: 0.20,
    STAR_3: 0.22,
    STAR_4: 0.25,
    STAR_5: 0.30,
    DIRECTOR: 0.35
  },
  // 推荐佣金率
  REFERRAL: 0.10,
  // 团队奖金率
  TEAM_BONUS: {
    VIP: 0.01,
    STAR_1: 0.02,
    STAR_2: 0.03,
    STAR_3: 0.05,
    STAR_4: 0.07,
    STAR_5: 0.10,
    DIRECTOR: 0.15
  }
} as const;

// 佣金汇总接口
export interface CommissionSummary {
  totalCommission: number;
  pendingCommission: number;
  settledCommission: number;
  thisMonthCommission: number;
  lastMonthCommission: number;
  chartData?: Array<{
    month: string;
    commission: number;
  }>;
}

// 提现参数
export interface WithdrawalParams {
  commissionIds: string[];
  withdrawAmount: number;
  withdrawMethod: 'BANK' | 'ALIPAY' | 'WECHAT';
  accountInfo: {
    accountName: string;
    accountNumber: string;
    bankName?: string;
  };
  remark?: string;
}

export class CommissionService {
  /**
   * 计算订单佣金
   */
  async calculateCommission(params: CommissionCalculationParams): Promise<CommissionCalculationResult> {
    try {
      logger.info('开始计算佣金', { orderId: params.orderId });

      // 验证参数
      this.validateCalculationParams(params);

      // 获取相关用户信息
      const [buyer, seller, referrer] = await Promise.all([
        prisma.users.findUnique({ where: { id: params.buyerId } }),
        prisma.users.findUnique({ where: { id: params.sellerId } }),
        this.getReferrer(params.sellerId)
      ]);

      if (!buyer || !seller) {
        throw ErrorFactory.notFound('买家或卖家');
      }

      const commissions: CommissionCalculationResult['commissions'] = [];
      let totalCommission = 0;

      // 1. 计算直接销售佣金
      const directRate = COMMISSION_RATES.DIRECT_SALES[seller.level];
      if (directRate > 0) {
        const directAmount = params.orderAmount * directRate;
        totalCommission += directAmount;

        commissions.push({
          userId: params.sellerId,
          userLevel: seller.level,
          type: CommissionType.DIRECT_SALES,
          rate: directRate,
          amount: directAmount,
          description: '直接销售佣金'
        });
      }

      // 2. 计算推荐佣金
      if (referrer) {
        const referralAmount = params.orderAmount * COMMISSION_RATES.REFERRAL;
        totalCommission += referralAmount;

        commissions.push({
          userId: referrer.id,
          userLevel: referrer.level,
          type: CommissionType.REFERRAL,
          rate: COMMISSION_RATES.REFERRAL,
          amount: referralAmount,
          description: '推荐佣金'
        });
      }

      // 3. 计算团队奖金
      const teamBonusRate = COMMISSION_RATES.TEAM_BONUS[seller.level];
      if (teamBonusRate > 0) {
        const teamBonusAmount = params.orderAmount * teamBonusRate;
        totalCommission += teamBonusAmount;

        commissions.push({
          userId: params.sellerId,
          userLevel: seller.level,
          type: CommissionType.TEAM_BONUS,
          rate: teamBonusRate,
          amount: teamBonusAmount,
          description: '团队奖金'
        });
      }

      const result: CommissionCalculationResult = {
        orderId: params.orderId,
        orderAmount: params.orderAmount,
        commissions,
        totalCommission,
        calculatedAt: new Date()
      };

      logger.info('佣金计算完成', {
        orderId: params.orderId,
        totalCommission,
        commissionCount: commissions.length
      });

      return result;

    } catch (error) {
      logger.error('佣金计算失败', { error, params });
      if (error instanceof AppError) throw error;
      throw ErrorFactory.commissionCalculationFailed('计算佣金时发生错误');
    }
  }

  /**
   * 创建佣金记录
   */
  async createCommissionRecords(result: CommissionCalculationResult): Promise<void> {
    try {
      const records = result.commissions.map(commission => ({
        id: `cm${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        transactionNo: `TXN${Date.now()}${Math.random().toString(36).substr(2, 6)}`,
        toUserId: commission.userId,
        amount: commission.amount,
        balanceBefore: 0, // 将在后续更新
        balanceAfter: 0,  // 将在后续更新
        type: pointsTransactions_type.COMMISSION,
        description: commission.description,
        status: 'PENDING' as const,
        metadata: JSON.stringify({
          orderId: result.orderId,
          commissionType: commission.type,
          rate: commission.rate,
          orderAmount: result.orderAmount
        })
      }));

      await prisma.pointsTransactions.createMany({
        data: records
      });

      logger.info('创建佣金记录成功', {
        orderId: result.orderId,
        recordCount: records.length
      });

    } catch (error) {
      logger.error('创建佣金记录失败', { error, result });
      throw ErrorFactory.internalError('创建佣金记录失败');
    }
  }

  /**
   * 获取用户的佣金列表
   */
  async getUserCommissions(
    userId: string,
    options: {
      page?: number;
      perPage?: number;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ items: CommissionRecord[]; total: number }> {
    const { page = 1, perPage = 10, status, startDate, endDate } = options;
    const skip = (page - 1) * perPage;

    const where: Prisma.pointsTransactionsWhereInput = {
      type: pointsTransactions_type.COMMISSION,
      toUserId: userId
    };

    if (status) {
      where.status = status as any;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.pointsTransactions.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.pointsTransactions.count({ where })
    ]);

    const items = transactions.map(this.mapToCommissionRecord);

    return { items, total };
  }

  /**
   * 获取佣金汇总信息
   */
  async getCommissionSummary(
    userId?: string,
    options: {
      period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
      includeChart?: boolean;
    } = {}
  ): Promise<CommissionSummary> {
    const { period = 'month', includeChart = false } = options;

    const where: Prisma.pointsTransactionsWhereInput = {
      type: pointsTransactions_type.COMMISSION
    };

    if (userId) {
      where.toUserId = userId;
    }

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
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const [totalResult, pendingResult, settledResult] = await Promise.all([
      prisma.pointsTransactions.aggregate({
        where,
        _sum: { amount: true }
      }),
      prisma.pointsTransactions.aggregate({
        where: { ...where, status: 'PENDING' },
        _sum: { amount: true }
      }),
      prisma.pointsTransactions.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { amount: true }
      })
    ]);

    // 本月和上月佣金
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthResult, lastMonthResult] = await Promise.all([
      prisma.pointsTransactions.aggregate({
        where: { ...where, createdAt: { gte: thisMonthStart } },
        _sum: { amount: true }
      }),
      prisma.pointsTransactions.aggregate({
        where: {
          ...where,
          createdAt: {
            gte: lastMonthStart,
            lte: lastMonthEnd
          }
        },
        _sum: { amount: true }
      })
    ]);

    const summary: CommissionSummary = {
      totalCommission: totalResult._sum.amount || 0,
      pendingCommission: pendingResult._sum.amount || 0,
      settledCommission: settledResult._sum.amount || 0,
      thisMonthCommission: thisMonthResult._sum.amount || 0,
      lastMonthCommission: lastMonthResult._sum.amount || 0
    };

    // 生成图表数据
    if (includeChart) {
      summary.chartData = await this.generateCommissionChartData(where, 12);
    }

    return summary;
  }

  /**
   * 结算佣金
   */
  async settleCommissions(
    commissionIds: string[],
    settleDate: Date = new Date(),
    operatorId: string,
    remark?: string
  ): Promise<{ settledCount: number; totalAmount: number }> {
    try {
      // 验证佣金记录
      const commissions = await prisma.pointsTransactions.findMany({
        where: {
          id: { in: commissionIds },
          type: pointsTransactions_type.COMMISSION,
          status: 'PENDING'
        }
      });

      if (commissions.length === 0) {
        throw ErrorFactory.validationError('没有找到待结算的佣金记录');
      }

      // 更新佣金状态
      const updateResult = await prisma.pointsTransactions.updateMany({
        where: {
          id: { in: commissions.map(c => c.id) }
        },
        data: {
          status: 'COMPLETED',
          completedAt: settleDate,
          metadata: JSON.stringify({
            remark: remark || '批量结算',
            settledBy: operatorId,
            settledAt: settleDate.toISOString()
          })
        }
      });

      const totalAmount = commissions.reduce((sum, c) => sum + c.amount, 0);

      logger.info('佣金结算成功', {
        settledCount: updateResult.count,
        totalAmount,
        operatorId
      });

      return {
        settledCount: updateResult.count,
        totalAmount
      };

    } catch (error) {
      logger.error('结算佣金失败', { error, commissionIds });
      if (error instanceof AppError) throw error;
      throw ErrorFactory.internalError('结算佣金失败');
    }
  }

  /**
   * 申请提现
   */
  async applyForWithdrawal(
    userId: string,
    params: WithdrawalParams
  ): Promise<{ withdrawId: string; status: string }> {
    try {
      // 验证参数
      if (!Array.isArray(params.commissionIds) || params.commissionIds.length === 0) {
        throw ErrorFactory.validationError('佣金ID列表不能为空');
      }

      if (params.withdrawAmount <= 0) {
        throw ErrorFactory.validationError('提现金额必须大于0');
      }

      // 验证可用佣金
      const commissions = await prisma.pointsTransactions.findMany({
        where: {
          id: { in: params.commissionIds },
          toUserId: userId,
          type: pointsTransactions_type.COMMISSION,
          status: 'COMPLETED'
        }
      });

      if (commissions.length === 0) {
        throw ErrorFactory.validationError('没有找到可提现的佣金记录');
      }

      const totalAvailable = commissions.reduce((sum, c) => sum + c.amount, 0);
      if (params.withdrawAmount > totalAvailable) {
        throw ErrorFactory.withdrawalAmountExceeded(totalAvailable, params.withdrawAmount);
      }

      // 创建提现记录
      const withdrawId = `wd${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      await prisma.pointsTransactions.create({
        data: {
          id: withdrawId,
          transactionNo: `TXN${Date.now()}${Math.random().toString(36).substr(2, 6)}`,
          toUserId: userId,
          amount: -params.withdrawAmount,
          balanceBefore: 0,
          balanceAfter: 0,
          type: pointsTransactions_type.WITHDRAW,
          description: '佣金提现',
          status: 'PENDING',
          metadata: JSON.stringify({
            withdrawMethod: params.withdrawMethod,
            accountInfo: params.accountInfo,
            commissionIds: params.commissionIds,
            remark: params.remark || '佣金提现申请'
          })
        }
      });

      logger.info('申请提现成功', {
        userId,
        withdrawId,
        amount: params.withdrawAmount
      });

      return {
        withdrawId,
        status: 'PENDING'
      };

    } catch (error) {
      logger.error('申请提现失败', { error, userId, params });
      if (error instanceof AppError) throw error;
      throw ErrorFactory.internalError('申请提现失败');
    }
  }

  /**
   * 获取提现记录
   */
  async getWithdrawals(
    userId?: string,
    options: {
      page?: number;
      perPage?: number;
      status?: string;
    } = {}
  ): Promise<{ items: any[]; total: number }> {
    const { page = 1, perPage = 10, status } = options;
    const skip = (page - 1) * perPage;

    const where: Prisma.pointsTransactionsWhereInput = {
      type: pointsTransactions_type.WITHDRAW
    };

    if (userId) {
      where.toUserId = userId;
    }

    if (status) {
      where.status = status as any;
    }

    const [withdrawals, total] = await Promise.all([
      prisma.pointsTransactions.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.pointsTransactions.count({ where })
    ]);

    // 格式化提现记录
    const items = withdrawals.map(withdraw => {
      let withdrawInfo = {};
      if (withdraw.metadata) {
        try {
          const metadata = typeof withdraw.metadata === 'string'
            ? JSON.parse(withdraw.metadata)
            : withdraw.metadata;

          withdrawInfo = {
            withdrawId: withdraw.id,
            amount: Math.abs(withdraw.amount),
            withdrawMethod: metadata.withdrawMethod,
            accountInfo: metadata.accountInfo,
            commissionIds: metadata.commissionIds
          };
        } catch (e) {
          withdrawInfo = {
            withdrawId: withdraw.id,
            amount: Math.abs(withdraw.amount)
          };
        }
      }

      return {
        ...withdraw,
        ...withdrawInfo
      };
    });

    return { items, total };
  }

  /**
   * 审核提现
   */
  async reviewWithdrawal(
    withdrawalId: string,
    approve: boolean,
    operatorId: string,
    remark?: string,
    transactionId?: string
  ): Promise<void> {
    try {
      const withdrawal = await prisma.pointsTransactions.findUnique({
        where: { id: withdrawalId }
      });

      if (!withdrawal) {
        throw ErrorFactory.notFound('提现记录');
      }

      if (withdrawal.status !== 'PENDING') {
        throw ErrorFactory.businessRuleViolation('提现申请状态不是待处理');
      }

      const updateData: Prisma.pointsTransactionsUpdateInput = {
        status: approve ? 'COMPLETED' : 'CANCELLED',
        completedAt: new Date(),
        metadata: JSON.stringify({
          ...(typeof withdrawal.metadata === 'string'
            ? JSON.parse(withdrawal.metadata)
            : withdrawal.metadata),
          reviewedBy: operatorId,
          reviewedAt: new Date().toISOString(),
          remark,
          transactionId: approve ? transactionId : undefined
        })
      };

      await prisma.pointsTransactions.update({
        where: { id: withdrawalId },
        data: updateData
      });

      logger.info('审核提现成功', {
        withdrawalId,
        approve,
        operatorId
      });

    } catch (error) {
      logger.error('审核提现失败', { error, withdrawalId, approve });
      if (error instanceof AppError) throw error;
      throw ErrorFactory.internalError('审核提现失败');
    }
  }

  /**
   * 验证佣金计算参数
   */
  private validateCalculationParams(params: CommissionCalculationParams): void {
    if (!params.orderId || !params.buyerId || !params.sellerId) {
      throw ErrorFactory.validationError('缺少必填字段');
    }

    if (params.orderAmount <= 0) {
      throw ErrorFactory.validationError('订单金额必须大于0');
    }

    if (!Array.isArray(params.products) || params.products.length === 0) {
      throw ErrorFactory.validationError('商品列表不能为空');
    }
  }

  /**
   * 获取推荐人
   */
  private async getReferrer(userId: string): Promise<{ id: string; level: UserLevel } | null> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { parentId: true }
    });

    if (!user?.parentId) {
      return null;
    }

    return prisma.users.findUnique({
      where: { id: user.parentId },
      select: { id: true, level: true }
    });
  }

  /**
   * 将数据库记录转换为佣金记录
   */
  private mapToCommissionRecord(transaction: any): CommissionRecord {
    let metadata: any = {};
    if (transaction.metadata) {
      try {
        metadata = typeof transaction.metadata === 'string'
          ? JSON.parse(transaction.metadata)
          : transaction.metadata || {};
      } catch (e) {
        metadata = {};
      }
    }

    return {
      id: transaction.id,
      userId: transaction.toUserId,
      orderId: (metadata && metadata.orderId) || '',
      type: (metadata && metadata.commissionType) || CommissionType.DIRECT_SALES,
      amount: transaction.amount,
      rate: (metadata && metadata.rate) || 0,
      level: 'UNKNOWN',
      description: transaction.description,
      metadata,
      status: transaction.status,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt
    };
  }

  /**
   * 生成佣金图表数据
   */
  private async generateCommissionChartData(
    where: Prisma.pointsTransactionsWhereInput,
    months: number
  ): Promise<Array<{ month: string; commission: number }>> {
    const chartData = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthResult = await prisma.pointsTransactions.aggregate({
        where: {
          ...where,
          createdAt: {
            gte: monthStart,
            lte: monthEnd
          }
        },
        _sum: { amount: true }
      });

      chartData.push({
        month: monthStart.toISOString().substring(0, 7),
        commission: monthResult._sum.amount || 0
      });
    }

    return chartData;
  }
}

// 导出服务单例
export const commissionService = new CommissionService();