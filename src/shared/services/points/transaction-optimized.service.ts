import { logger } from '../../utils/logger';
import { PointsTransactionType, PointsTransactionStatus } from './types';
import { queryOptimizerService } from '../database/query-optimizer.service';
import { redisCacheService } from '../cache/redis-cache.service';

/**
 * 优化版积分交易服务
 * 集成查询优化、缓存和性能监控
 */
export class TransactionOptimizedService {
  private static instance: TransactionOptimizedService;

  static getInstance(): TransactionOptimizedService {
    if (!TransactionOptimizedService.instance) {
      TransactionOptimizedService.instance = new TransactionOptimizedService();
    }
    return TransactionOptimizedService.instance;
  }

  /**
   * 生成交易号
   */
  generateTransactionNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PT${timestamp}${random}`.toUpperCase();
  }

  /**
   * 获取用户交易记录（优化版）
   * 支持多种查询策略：缓存优先、游标分页、批量查询
   */
  async getTransactionsOptimized(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      cursor?: string;
      type?: PointsTransactionType;
      startDate?: Date;
      endDate?: Date;
      useCache?: boolean;
      strategy?: 'cache' | 'cursor' | 'batch' | 'auto';
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      cursor,
      type,
      startDate,
      endDate,
      useCache = true,
      strategy = 'auto'
    } = options;

    const startTime = Date.now();
    logger.info('开始获取交易记录（优化版）', {
      userId,
      page,
      limit,
      type,
      strategy,
      useCache
    });

    try {
      // 1. 缓存策略检查
      if (useCache && strategy === 'cache') {
        const cached = await redisCacheService.getCachedUserTransactions(userId, {
          page,
          limit,
          type,
          startDate,
          endDate
        });

        if (cached) {
          logger.info('命中交易记录缓存', {
            userId,
            page,
            limit,
            executionTime: Date.now() - startTime
          });
          return cached;
        }
      }

      // 2. 根据策略选择查询方法
      let result;
      switch (strategy) {
        case 'cursor':
          result = await this.getTransactionsWithCursor({
            userId,
            limit,
            cursor,
            type,
            startDate,
            endDate
          });
          break;

        case 'batch':
          result = await queryOptimizerService.getUserTransactionsBatchOptimized({
            userId,
            limit,
            cursor,
            type,
            startDate,
            endDate
          });
          break;

        case 'auto':
        default:
          // 自动选择最优策略
          if (cursor) {
            // 有游标，使用游标分页
            result = await this.getTransactionsWithCursor({
              userId,
              limit,
              cursor,
              type,
              startDate,
              endDate
            });
          } else if (page === 1 && !type && !startDate && !endDate) {
            // 首页无筛选，使用批量查询
            result = await queryOptimizerService.getUserTransactionsBatchOptimized({
              userId,
              limit,
              type,
              startDate,
              endDate
            });
          } else {
            // 其他情况使用优化查询
            result = await queryOptimizerService.getTransactionsOptimized({
              userId,
              limit,
              cursor,
              type,
              startDate,
              endDate
            });
          }
          break;
      }

      // 3. 缓存结果（仅缓存第一页）
      if (useCache && page === 1 && strategy !== 'cursor') {
        await redisCacheService.cacheUserTransactions(
          userId,
          { page, limit, type, startDate, endDate },
          result,
          60 // 缓存1分钟
        );
      }

      // 4. 添加传统分页信息（向后兼容）
      if (page && !cursor) {
        // 需要获取总数以计算分页
        const totalCount = await this.getTransactionsCount(userId, { type, startDate, endDate });
        result.pagination = {
          ...result.pagination,
          page,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasPrev: page > 1
        };
      }

      const executionTime = Date.now() - startTime;
      logger.info('交易记录查询完成（优化版）', {
        userId,
        strategy,
        executionTime,
        resultCount: result.transactions.length,
        hasMore: result.pagination.hasMore
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('交易记录查询失败（优化版）', {
        userId,
        strategy,
        executionTime,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 游标分页查询
   */
  private async getTransactionsWithCursor(params: {
    userId: string;
    limit: number;
    cursor?: string;
    type?: PointsTransactionType;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { userId, limit, cursor, type, startDate, endDate } = params;

    // 使用查询优化器
    return await queryOptimizerService.getTransactionsOptimized({
      userId,
      limit,
      cursor,
      type,
      startDate,
      endDate
    });
  }

  /**
   * 获取交易记录总数（用于传统分页）
   */
  private async getTransactionsCount(
    userId: string,
    filters: {
      type?: PointsTransactionType;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<number> {
    const cacheKey = `transaction_count:${userId}:${JSON.stringify(filters)}`;

    // 尝试从缓存获取
    const cached = await redisCacheService.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 构建查询条件
    const whereCondition: any = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    };

    if (filters.type) {
      whereCondition.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
      whereCondition.createdAt = {};
      if (filters.startDate) {
        whereCondition.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereCondition.createdAt.lte = filters.endDate;
      }
    }

    // 执行计数查询
    const { prisma } = require('../../database/client');
    const count = await prisma.pointsTransactions.count({
      where: whereCondition
    });

    // 缓存结果（较短时间）
    await redisCacheService.set(cacheKey, count, 30);

    return count;
  }

  /**
   * 获取用户交易统计（优化版）
   */
  async getTransactionStatsOptimized(
    userId: string,
    period: 'week' | 'month' | 'year' = 'month',
    useCache: boolean = true
  ) {
    const cacheKey = `user_stats:${userId}:${period}`;

    // 尝试从缓存获取
    if (useCache) {
      const cached = await redisCacheService.getCachedUserStats(userId, period);
      if (cached) {
        logger.info('命中用户统计缓存', { userId, period });
        return cached;
      }
    }

    // 计算日期范围
    const now = new Date();
    let startDate: Date;

    switch (period) {
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

    // 获取统计信息
    const stats = await queryOptimizerService.getTransactionStatsOptimized(userId, {
      start: startDate,
      end: now
    });

    // 处理统计数据
    const processedStats = {
      period,
      startDate,
      endDate: now,
      summary: {
        totalIncoming: 0,
        totalOutgoing: 0,
        incomingCount: 0,
        outgoingCount: 0
      },
      byType: {} as Record<string, any>,
      byStatus: {} as Record<string, any>
    };

    for (const stat of stats as any[]) {
      processedStats.summary.totalIncoming += Number(stat.totalIncoming) || 0;
      processedStats.summary.totalOutgoing += Number(stat.totalOutgoing) || 0;
      processedStats.summary.incomingCount += Number(stat.incomingCount) || 0;
      processedStats.summary.outgoingCount += Number(stat.outgoingCount) || 0;

      const typeKey = stat.type;
      if (!processedStats.byType[typeKey]) {
        processedStats.byType[typeKey] = {
          incoming: 0,
          outgoing: 0,
          incomingCount: 0,
          outgoingCount: 0
        };
      }
      processedStats.byType[typeKey].incoming += Number(stat.totalIncoming) || 0;
      processedStats.byType[typeKey].outgoing += Number(stat.totalOutgoing) || 0;
      processedStats.byType[typeKey].incomingCount += Number(stat.incomingCount) || 0;
      processedStats.byType[typeKey].outgoingCount += Number(stat.outgoingCount) || 0;

      const statusKey = stat.status;
      if (!processedStats.byStatus[statusKey]) {
        processedStats.byStatus[statusKey] = {
          count: 0,
          amount: 0
        };
      }
      processedStats.byStatus[statusKey].count +=
        (Number(stat.incomingCount) || 0) + (Number(stat.outgoingCount) || 0);
      processedStats.byStatus[statusKey].amount +=
        (Number(stat.totalIncoming) || 0) + (Number(stat.totalOutgoing) || 0);
    }

    // 缓存结果
    if (useCache) {
      await redisCacheService.cacheUserStats(userId, period, processedStats, 300);
    }

    return processedStats;
  }

  /**
   * 清除用户相关缓存
   */
  async clearUserCache(userId: string): Promise<void> {
    await redisCacheService.clearUserCache(userId);
    logger.info('清除用户交易缓存', { userId });
  }

  /**
   * 预加载用户交易数据
   */
  async preloadUserTransactions(userId: string): Promise<void> {
    try {
      // 预加载首页数据
      await this.getTransactionsOptimized(userId, {
        page: 1,
        limit: 20,
        useCache: true
      });

      // 预加载统计数据
      await this.getTransactionStatsOptimized(userId, 'month', true);

      logger.info('预加载用户交易数据完成', { userId });
    } catch (error) {
      logger.error('预加载用户交易数据失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 批量预加载多个用户的数据
   */
  async batchPreloadUserTransactions(userIds: string[]): Promise<void> {
    const promises = userIds.map(userId => this.preloadUserTransactions(userId));
    await Promise.allSettled(promises);
    logger.info('批量预加载用户交易数据完成', {
      userCount: userIds.length
    });
  }
}

// 导出单例实例
export const transactionOptimizedService = TransactionOptimizedService.getInstance();