import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';

/**
 * 数据库查询优化服务
 * 提供查询优化、缓存和性能监控功能
 */
export class QueryOptimizerService {
  private static instance: QueryOptimizerService;
  private queryStats: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();
  private slowQueryThreshold = 1000; // 1秒阈值

  static getInstance(): QueryOptimizerService {
    if (!QueryOptimizerService.instance) {
      QueryOptimizerService.instance = new QueryOptimizerService();
    }
    return QueryOptimizerService.instance;
  }

  /**
   * 记录查询统计信息
   */
  recordQueryStats(queryName: string, executionTime: number): void {
    const stats = this.queryStats.get(queryName) || { count: 0, totalTime: 0, avgTime: 0 };
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    this.queryStats.set(queryName, stats);

    // 记录慢查询
    if (executionTime > this.slowQueryThreshold) {
      logger.warn('慢查询检测', {
        queryName,
        executionTime,
        threshold: this.slowQueryThreshold
      });
    }
  }

  /**
   * 获取查询统计信息
   */
  getQueryStats(): Record<string, { count: number; totalTime: number; avgTime: number }> {
    return Object.fromEntries(this.queryStats);
  }

  /**
   * 优化的积分交易查询
   * 使用游标分页和查询优化
   */
  async getTransactionsOptimized(params: {
    userId: string;
    limit?: number;
    cursor?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const queryName = 'getTransactionsOptimized';
    const startTime = Date.now();

    const {
      userId,
      limit = 20,
      cursor,
      type,
      startDate,
      endDate
    } = params;

    try {
      // 构建查询条件
      const whereCondition: any = {
        OR: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      };

      // 添加类型过滤
      if (type) {
        whereCondition.type = type;
      }

      // 添加时间范围过滤
      if (startDate || endDate) {
        whereCondition.createdAt = {};
        if (startDate) {
          whereCondition.createdAt.gte = startDate;
        }
        if (endDate) {
          whereCondition.createdAt.lte = endDate;
        }
      }

      // 游标分页处理
      const cursorCondition = cursor ? {
        cursor: {
          id: cursor
        },
        skip: 1
      } : {};

      // 执行优化查询
      const transactions = await prisma.pointsTransactions.findMany({
        where: whereCondition,
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
        orderBy: [
          { createdAt: 'desc' },
          { id: 'desc' } // 确保排序稳定性
        ],
        take: Math.min(limit, 100), // 限制最大查询数量
        ...cursorCondition
      });

      // 处理数据
      const processedTransactions = transactions.map(t => ({
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

      // 获取下一页游标
      const nextCursor = transactions.length === limit ?
        transactions[transactions.length - 1].id : null;

      const result = {
        transactions: processedTransactions,
        pagination: {
          hasMore: transactions.length === limit,
          nextCursor,
          limit
        }
      };

      // 记录查询统计
      const executionTime = Date.now() - startTime;
      this.recordQueryStats(queryName, executionTime);

      logger.debug('优化查询执行完成', {
        queryName,
        userId,
        executionTime,
        resultCount: processedTransactions.length
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('优化查询执行失败', {
        queryName,
        userId,
        executionTime,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 批量查询优化
   * 使用 UNION ALL 优化复杂的 OR 查询
   */
  async getUserTransactionsBatchOptimized(params: {
    userId: string;
    limit?: number;
    cursor?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const queryName = 'getUserTransactionsBatchOptimized';
    const startTime = Date.now();

    const {
      userId,
      limit = 20,
      cursor,
      type,
      startDate,
      endDate
    } = params;

    try {
      // 使用原生 SQL 查询优化性能
      let sql = `
        SELECT * FROM (
          SELECT
            id, transactionNo, amount, type, description, status,
            createdAt, completedAt, fromUserId, toUserId, metadata,
            'outgoing' as direction
          FROM pointsTransactions
          WHERE fromUserId = ?
            ${type ? 'AND type = ?' : ''}
            ${startDate ? 'AND createdAt >= ?' : ''}
            ${endDate ? 'AND createdAt <= ?' : ''}

          UNION ALL

          SELECT
            id, transactionNo, amount, type, description, status,
            createdAt, completedAt, fromUserId, toUserId, metadata,
            'incoming' as direction
          FROM pointsTransactions
          WHERE toUserId = ?
            ${type ? 'AND type = ?' : ''}
            ${startDate ? 'AND createdAt >= ?' : ''}
            ${endDate ? 'AND createdAt <= ?' : ''}
        ) as combined
        ORDER BY createdAt DESC, id DESC
        LIMIT ?
      `;

      // 构建参数数组
      const params: any[] = [userId];
      if (type) params.push(type);
      if (startDate) params.push(startDate);
      if (endDate) params.push(endDate);
      params.push(userId);
      if (type) params.push(type);
      if (startDate) params.push(startDate);
      if (endDate) params.push(endDate);
      params.push(Math.min(limit, 100));

      // 执行原生查询
      const results = await prisma.$queryRawUnsafe(sql, ...params);

      // 处理结果
      const processedTransactions = (results as any[]).map(t => ({
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
        isIncoming: t.direction === 'incoming',
        isOutgoing: t.direction === 'outgoing'
      }));

      // 记录查询统计
      const executionTime = Date.now() - startTime;
      this.recordQueryStats(queryName, executionTime);

      logger.debug('批量优化查询执行完成', {
        queryName,
        userId,
        executionTime,
        resultCount: processedTransactions.length
      });

      return {
        transactions: processedTransactions,
        pagination: {
          hasMore: processedTransactions.length === limit,
          nextCursor: processedTransactions.length > 0 ?
            processedTransactions[processedTransactions.length - 1].id : null,
          limit
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('批量优化查询执行失败', {
        queryName,
        userId,
        executionTime,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取用户交易统计信息
   * 使用优化的聚合查询
   */
  async getTransactionStatsOptimized(userId: string, dateRange?: { start: Date; end: Date }) {
    const queryName = 'getTransactionStatsOptimized';
    const startTime = Date.now();

    try {
      const dateCondition = dateRange ?
        `AND createdAt BETWEEN ? AND ?` : '';

      const sql = `
        SELECT
          type,
          status,
          SUM(CASE WHEN fromUserId = ? THEN amount ELSE 0 END) as totalOutgoing,
          SUM(CASE WHEN toUserId = ? THEN amount ELSE 0 END) as totalIncoming,
          COUNT(CASE WHEN fromUserId = ? THEN 1 ELSE NULL END) as outgoingCount,
          COUNT(CASE WHEN toUserId = ? THEN 1 ELSE NULL END) as incomingCount
        FROM pointsTransactions
        WHERE (fromUserId = ? OR toUserId = ?)
          ${dateCondition}
        GROUP BY type, status
      `;

      const params: any[] = [userId, userId, userId, userId, userId, userId];
      if (dateRange) {
        params.push(dateRange.start, dateRange.end);
      }

      const results = await prisma.$queryRawUnsafe(sql, ...params);

      const executionTime = Date.now() - startTime;
      this.recordQueryStats(queryName, executionTime);

      return results;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('统计查询执行失败', {
        queryName,
        userId,
        executionTime,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const queryOptimizerService = QueryOptimizerService.getInstance();