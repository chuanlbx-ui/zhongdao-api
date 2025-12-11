import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { PointsTransactionType, PointsTransactionStatus } from './types';

export class TransactionService {
  // 生成交易号
  generateTransactionNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PT${timestamp}${random}`.toUpperCase();
  }

  // 创建交易记录
  async createTransaction(
    tx: any,
    data: {
      transactionNo: string;
      fromUserId?: string;
      toUserId: string;
      amount: number;
      type: PointsTransactionType;
      description?: string;
      relatedOrderId?: string;
      status: PointsTransactionStatus;
      balanceBefore: number;
      balanceAfter: number;
      metadata?: Record<string, any>;
      completedAt?: Date;
    }
  ) {
    return await tx.pointsTransactions.create({
      data: {
        transactionNo: data.transactionNo,
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        amount: data.amount,
        type: data.type,
        description: data.description,
        relatedOrderId: data.relatedOrderId,
        status: data.status,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        metadata: data.metadata,
        completedAt: data.completedAt
      }
    });
  }

  // 更新交易状态
  async updateTransactionStatus(
    tx: any,
    transactionId: string,
    status: PointsTransactionStatus,
    additionalData?: Record<string, any>
  ) {
    return await tx.pointsTransactions.update({
      where: { id: transactionId },
      data: {
        status,
        ...additionalData,
        ...(status === PointsTransactionStatus.COMPLETED && { completedAt: new Date() })
      }
    });
  }

  // 获取通券流水记录 - 使用双查询优化性能
  async getTransactions(
    userId: string,
    page: number = 1,
    perPage: number = 20,
    type?: PointsTransactionType,
    startDate?: Date,
    endDate?: Date
  ) {
// [DEBUG REMOVED]     console.log(`[TransactionService] 查询开始: userId=${userId}, page=${page}, perPage=${perPage}`);
    const startTime = Date.now();
    const offset = (page - 1) * perPage;

    try {
      // 构建基础查询条件
      const baseCondition: any = {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      };

      // 添加类型过滤
      if (type) {
        baseCondition.type = type;
      }

      // 添加日期范围过滤
      if (startDate || endDate) {
        baseCondition.createdAt = {};
        if (startDate) {
          baseCondition.createdAt.gte = startDate;
        }
        if (endDate) {
          baseCondition.createdAt.lte = endDate;
        }
      }

// [DEBUG REMOVED]       console.log(`[TransactionService] 执行双查询优化...`);

      // 执行查询和计数 - 并行执行提高性能
      const [transactions, totalCount] = await Promise.all([
        // 主查询 - 获取交易记录
        prisma.pointsTransactions.findMany({
          where: baseCondition,
          select: {
            id: true,
            transactionNo: true,
            amount: true,
            type: true,
            description: true,
            status: true,
            createdAt: true,
            completedAt: true,
            fromUserId: true,
            toUserId: true,
            metadata: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: perPage
        }),
        // 计数查询 - 获取总数
        prisma.pointsTransactions.count({
          where: baseCondition
        })
      ]);

// [DEBUG REMOVED]       console.log(`[TransactionService] 查询完成, 耗时: ${Date.now() - startTime}ms`);

      // 处理交易记录数据，添加方向标识
      const transactionsList = transactions.map(t => ({
        id: t.id,
        transactionNo: t.transactionNo,
        amount: Number(t.amount),
        type: t.type,
        description: t.description,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        metadata: t.metadata,
        isIncoming: t.toUserId === userId,
        isOutgoing: t.fromUserId === userId
      }));

// [DEBUG REMOVED]       console.log(`[TransactionService] 处理完成, 总耗时: ${Date.now() - startTime}ms, 返回${transactionsList.length}条记录, 总数${totalCount}`);

      return {
        transactions: transactionsList,
        pagination: {
          page,
          perPage,
          total: totalCount,
          totalPages: Math.ceil(totalCount / perPage),
          hasNext: page * perPage < totalCount,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error(`[TransactionService] 查询失败, 耗时: ${Date.now() - startTime}ms`, error);

      // 如果查询失败，返回降级结果
      console.warn('[TransactionService] 主查询失败，尝试降级查询...');
      return this.getTransactionsFallback(userId, page, perPage, type, startDate, endDate);
    }
  }

  // 降级查询方法 - 当主查询超时时使用
  private async getTransactionsFallback(
    userId: string,
    page: number = 1,
    perPage: number = 20,
    type?: PointsTransactionType,
    startDate?: Date,
    endDate?: Date
  ) {
// [DEBUG REMOVED]     console.log(`[TransactionService] 执行降级查询...`);
    const startTime = Date.now();

    // 简化的查询，只查询最近的数据
    const whereClause: any = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    };

    // 限制时间范围到最近30天
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    whereClause.createdAt = { gte: thirtyDaysAgo };

    if (type) {
      whereClause.type = type;
    }

    const transactions = await prisma.pointsTransactions.findMany({
      where: whereClause,
      take: Math.min(perPage, 50), // 限制最大返回数量
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        transactionNo: true,
        amount: true,
        type: true,
        description: true,
        status: true,
        createdAt: true,
        completedAt: true,
        fromUserId: true,
        toUserId: true,
        metadata: true
      }
    });

    const processedTransactions = transactions.map(t => ({
      ...t,
      isIncoming: t.toUserId === userId,
      isOutgoing: t.fromUserId === userId
    }));

// [DEBUG REMOVED]     console.log(`[TransactionService] 降级查询完成, 耗时: ${Date.now() - startTime}ms`);

    return {
      transactions: processedTransactions,
      pagination: {
        page,
        perPage,
        total: transactions.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      },
      isFallback: true // 标记这是降级结果
    };
  }

  // 根据交易号查找交易
  async getTransactionByNo(transactionNo: string) {
    return await prisma.pointsTransactions.findUnique({
      where: { transactionNo },
      include: {
        users_pointsTransactions_fromUserIdTousers: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            level: true
          }
        },
        users_pointsTransactions_toUserIdTousers: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            level: true
          }
        }
      }
    });
  }

  // 获取交易详情
  async getTransactionById(transactionId: string) {
    return await prisma.pointsTransactions.findUnique({
      where: { id: transactionId },
      include: {
        users_pointsTransactions_fromUserIdTousers: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            level: true
          }
        },
        users_pointsTransactions_toUserIdTousers: {
          select: {
            id: true,
            nickname: true,
            phone: true,
            level: true
          }
        }
      }
    });
  }

  // 防重复提交检查
  async checkDuplicateSubmission(
    userId: string,
    amount: number,
    type: PointsTransactionType,
    timeWindow: number = 30 // 时间窗口（秒）
  ) {
    try {
      const timeThreshold = new Date(Date.now() - timeWindow * 1000);

      const existingTransaction = await prisma.pointsTransactions.findFirst({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId }
          ],
          amount: type === 'FREEZE' || type === 'WITHDRAW' ? -amount : amount,
          type,
          createdAt: {
            gte: timeThreshold
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (existingTransaction) {
        logger.warn('检测到重复提交', {
          userId,
          amount,
          type,
          existingTransactionId: existingTransaction.id,
          timeWindow
        });

        return {
          success: false,
          existingTransaction
        };
      }

      return { success: true };
    } catch (error) {
      logger.error('防重复检查失败', {
        userId,
        amount,
        type,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const transactionService = new TransactionService();