/**
 * 积分缓存服务
 * 提供积分相关数据的缓存管理
 */

import { cacheManager } from '../../../shared/cache/CacheManager';
import { logger } from '../../../shared/utils/logger';
import {
  PointsBalance,
  PointsTransaction,
  PointsTransactionHistory,
  PointsStats,
  PointsTransfer,
  PointsDailySummary,
  PointsQuota,
  PointsCacheStats,
  PointsLedger,
  PointsExchangeRate,
  PointsPromotion
} from './points.cache.types';

export class PointsCacheService {
  private readonly KEY_PREFIX = 'points';

  // 积分余额缓存（极短TTL，保证实时性）
  async getBalance(userId: string): Promise<PointsBalance | null> {
    const key = `${this.KEY_PREFIX}:balance:${userId}`;
    return await cacheManager.get<PointsBalance>(key);
  }

  async setBalance(userId: string, data: PointsBalance): Promise<void> {
    const key = `${this.KEY_PREFIX}:balance:${userId}`;
    await cacheManager.set(key, data, {
      ttl: 30, // 30秒
      tags: ['points-balance', `points:${userId}`]
    });
  }

  async invalidateBalance(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['points-balance', `points:${userId}`]);
  }

  // 积分余额版本控制（用于乐观锁）
  async getBalanceVersion(userId: string): Promise<number> {
    const balance = await this.getBalance(userId);
    return balance?.version || 0;
  }

  async incrementBalanceVersion(userId: string): Promise<number> {
    const key = `${this.KEY_PREFIX}:balance:version:${userId}`;
    const version = await cacheManager.incr(key);
    await cacheManager.expire(key, 3600); // 1小时
    return version;
  }

  // 积分交易记录缓存
  async getTransaction(transactionId: string): Promise<PointsTransaction | null> {
    const key = `${this.KEY_PREFIX}:transaction:${transactionId}`;
    return await cacheManager.get<PointsTransaction>(key);
  }

  async setTransaction(transactionId: string, data: PointsTransaction): Promise<void> {
    const key = `${this.KEY_PREFIX}:transaction:${transactionId}`;
    await cacheManager.set(key, data, {
      ttl: 3600, // 1小时
      tags: ['points-transaction', `points:transaction:${transactionId}`]
    });
  }

  async invalidateTransaction(transactionId: string): Promise<void> {
    await cacheManager.invalidateTags(['points-transaction', `points:transaction:${transactionId}`]);
  }

  // 用户交易历史缓存
  async getTransactionHistory(userId: string, params: {
    page: number;
    perPage: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<PointsTransactionHistory | null> {
    const key = this.generateTransactionHistoryKey(userId, params);
    return await cacheManager.get<PointsTransactionHistory>(key);
  }

  async setTransactionHistory(userId: string, params: {
    page: number;
    perPage: number;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }, data: PointsTransactionHistory): Promise<void> {
    const key = this.generateTransactionHistoryKey(userId, params);
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['points-history', `points:${userId}`]
    });
  }

  private generateTransactionHistoryKey(userId: string, params: any): string {
    const { page, perPage, type, startDate, endDate } = params;
    let key = `${this.KEY_PREFIX}:history:${userId}:${page}:${perPage}`;
    if (type) key += `:type:${type}`;
    if (startDate) key += `:start:${startDate.getTime()}`;
    if (endDate) key += `:end:${endDate.getTime()}`;
    return key;
  }

  // 积分统计缓存
  async getStats(userId: string, period: 'day' | 'week' | 'month' | 'year'): Promise<PointsStats | null> {
    const key = `${this.KEY_PREFIX}:stats:${userId}:${period}`;
    return await cacheManager.get<PointsStats>(key);
  }

  async setStats(userId: string, period: 'day' | 'week' | 'month' | 'year', data: PointsStats): Promise<void> {
    const key = `${this.KEY_PREFIX}:stats:${userId}:${period}`;
    const ttl = period === 'day' ? 1800 : period === 'week' ? 3600 : 7200;
    await cacheManager.set(key, data, {
      ttl,
      tags: ['points-stats', `points:${userId}`]
    });
  }

  async invalidateStats(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['points-stats', `points:${userId}`]);
  }

  // 积分转账记录缓存
  async getTransfer(transferId: string): Promise<PointsTransfer | null> {
    const key = `${this.KEY_PREFIX}:transfer:${transferId}`;
    return await cacheManager.get<PointsTransfer>(key);
  }

  async setTransfer(transferId: string, data: PointsTransfer): Promise<void> {
    const key = `${this.KEY_PREFIX}:transfer:${transferId}`;
    await cacheManager.set(key, data, {
      ttl: 3600, // 1小时
      tags: ['points-transfer', `points:transfer:${transferId}`]
    });
  }

  async invalidateTransfer(transferId: string): Promise<void> {
    await cacheManager.invalidateTags(['points-transfer', `points:transfer:${transferId}`]);
  }

  // 用户转账记录缓存
  async getUserTransfers(userId: string, params: {
    page: number;
    perPage: number;
    type?: 'sent' | 'received' | 'all';
  }): Promise<PointsTransfer[] | null> {
    const key = this.generateUserTransfersKey(userId, params);
    return await cacheManager.get<PointsTransfer[]>(key);
  }

  async setUserTransfers(userId: string, params: {
    page: number;
    perPage: number;
    type?: 'sent' | 'received' | 'all';
  }, data: PointsTransfer[]): Promise<void> {
    const key = this.generateUserTransfersKey(userId, params);
    await cacheManager.set(key, data, {
      ttl: 600, // 10分钟
      tags: ['points-user-transfers', `points:${userId}`]
    });
  }

  private generateUserTransfersKey(userId: string, params: any): string {
    const { page, perPage, type } = params;
    let key = `${this.KEY_PREFIX}:transfers:${userId}:${page}:${perPage}`;
    if (type && type !== 'all') key += `:type:${type}`;
    return key;
  }

  // 每日积分汇总缓存
  async getDailySummary(userId: string, date: string): Promise<PointsDailySummary | null> {
    const key = `${this.KEY_PREFIX}:daily:${userId}:${date}`;
    return await cacheManager.get<PointsDailySummary>(key);
  }

  async setDailySummary(userId: string, date: string, data: PointsDailySummary): Promise<void> {
    const key = `${this.KEY_PREFIX}:daily:${userId}:${date}`;
    await cacheManager.set(key, data, {
      ttl: 86400, // 24小时
      tags: ['points-daily', `points:${userId}`]
    });
  }

  async invalidateDailySummary(userId: string): Promise<void> {
    await cacheManager.invalidateTags(['points-daily', `points:${userId}`]);
  }

  // 积分配额缓存
  async getQuota(userId: string, type: 'daily_transfer' | 'daily_purchase' | 'monthly_withdraw'): Promise<PointsQuota | null> {
    const key = `${this.KEY_PREFIX}:quota:${userId}:${type}`;
    return await cacheManager.get<PointsQuota>(key);
  }

  async setQuota(userId: string, type: 'daily_transfer' | 'daily_purchase' | 'monthly_withdraw', data: PointsQuota): Promise<void> {
    const key = `${this.KEY_PREFIX}:quota:${userId}:${type}`;
    const ttl = type === 'monthly_withdraw' ? 2592000 : 86400; // 30天或1天
    await cacheManager.set(key, data, {
      ttl,
      tags: ['points-quota', `points:${userId}`]
    });
  }

  async updateQuotaUsage(userId: string, type: 'daily_transfer' | 'daily_purchase' | 'monthly_withdraw', amount: number): Promise<void> {
    const key = `${this.KEY_PREFIX}:quota:usage:${userId}:${type}`;
    await cacheManager.incr(key, amount);
    // 设置过期时间
    const ttl = type === 'monthly_withdraw' ? 2592000 : 86400;
    await cacheManager.expire(key, ttl);
  }

  // 积分账本缓存（用于审计）
  async getLedger(userId: string, params: {
    startDate: Date;
    endDate: Date;
    page?: number;
    perPage?: number;
  }): Promise<PointsLedger | null> {
    const key = this.generateLedgerKey(userId, params);
    return await cacheManager.get<PointsLedger>(key);
  }

  async setLedger(userId: string, params: {
    startDate: Date;
    endDate: Date;
    page?: number;
    perPage?: number;
  }, data: PointsLedger): Promise<void> {
    const key = this.generateLedgerKey(userId, params);
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['points-ledger', `points:${userId}`]
    });
  }

  private generateLedgerKey(userId: string, params: any): string {
    const { startDate, endDate, page = 1, perPage = 100 } = params;
    return `${this.KEY_PREFIX}:ledger:${userId}:${startDate.getTime()}-${endDate.getTime()}:${page}:${perPage}`;
  }

  // 积分汇率缓存
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<PointsExchangeRate | null> {
    const key = `${this.KEY_PREFIX}:exchange:${fromCurrency}:${toCurrency}`;
    return await cacheManager.get<PointsExchangeRate>(key);
  }

  async setExchangeRate(fromCurrency: string, toCurrency: string, data: PointsExchangeRate): Promise<void> {
    const key = `${this.KEY_PREFIX}:exchange:${fromCurrency}:${toCurrency}`;
    const ttl = Math.floor((data.validTo.getTime() - Date.now()) / 1000);
    await cacheManager.set(key, data, {
      ttl: Math.max(ttl, 300), // 至少5分钟
      tags: ['points-exchange']
    });
  }

  async invalidateExchangeRates(): Promise<void> {
    await cacheManager.invalidateTags(['points-exchange']);
  }

  // 积分促销活动缓存
  async getPromotions(userId?: string): Promise<PointsPromotion[] | null> {
    const key = userId
      ? `${this.KEY_PREFIX}:promotions:user:${userId}`
      : `${this.KEY_PREFIX}:promotions:all`;
    return await cacheManager.get<PointsPromotion[]>(key);
  }

  async setPromotions(data: PointsPromotion[], userId?: string): Promise<void> {
    const key = userId
      ? `${this.KEY_PREFIX}:promotions:user:${userId}`
      : `${this.KEY_PREFIX}:promotions:all`;
    await cacheManager.set(key, data, {
      ttl: 1800, // 30分钟
      tags: ['points-promotions', userId ? `points:${userId}` : '']
    });
  }

  // 积分操作锁（防止重复操作）
  async acquireLock(userId: string, operation: string, ttl: number = 10): Promise<boolean> {
    const key = `${this.KEY_PREFIX}:lock:${userId}:${operation}`;
    const result = await cacheManager.set(key, '1', { ttl });
    return result !== null;
  }

  async releaseLock(userId: string, operation: string): Promise<void> {
    const key = `${this.KEY_PREFIX}:lock:${userId}:${operation}`;
    await cacheManager.del(key);
  }

  // 批量获取用户余额
  async getBalances(userIds: string[]): Promise<Map<string, PointsBalance | null>> {
    const keys = userIds.map(id => `${this.KEY_PREFIX}:balance:${id}`);
    const values = await cacheManager.mget<PointsBalance>(keys);

    const result = new Map<string, PointsBalance | null>();
    userIds.forEach((id, index) => {
      result.set(id, values[index]);
    });

    return result;
  }

  // 批量设置用户余额
  async setBalances(balances: Array<{ userId: string; data: PointsBalance }>): Promise<void> {
    const items = balances.map(item => ({
      key: `${this.KEY_PREFIX}:balance:${item.userId}`,
      value: item.data,
      options: {
        ttl: 30,
        tags: ['points-balance', `points:${item.userId}`]
      }
    }));

    await cacheManager.mset(items);
  }

  // 清除用户所有积分缓存
  async invalidateAllPointsCache(userId: string): Promise<void> {
    await cacheManager.invalidateTags([`points:${userId}`]);
  }

  // 原子操作：增加余额
  async incrBalance(userId: string, amount: number): Promise<number> {
    const key = `${this.KEY_PREFIX}:balance:raw:${userId}`;
    return await cacheManager.incr(key, amount);
  }

  // 原子操作：减少余额
  async decrBalance(userId: string, amount: number): Promise<number> {
    const key = `${this.KEY_PREFIX}:balance:raw:${userId}`;
    return await cacheManager.decr(key, amount);
  }

  // 获取原始余额（用于原子操作）
  async getRawBalance(userId: string): Promise<number | null> {
    const key = `${this.KEY_PREFIX}:balance:raw:${userId}`;
    return await cacheManager.get<number>(key);
  }

  // 设置原始余额
  async setRawBalance(userId: string, balance: number): Promise<void> {
    const key = `${this.KEY_PREFIX}:balance:raw:${userId}`;
    await cacheManager.set(key, balance, {
      ttl: 30,
      tags: ['points-balance', `points:${userId}`]
    });
  }

  // 预热积分缓存
  async warmupPointsCache(userId: string): Promise<void> {
    // 预热关键数据
    await Promise.all([
      this.getBalance(userId),
      this.getTransactionHistory(userId, { page: 1, perPage: 20 }),
      this.getStats(userId, 'day'),
      this.getQuota(userId, 'daily_transfer'),
      this.getDailySummary(userId, new Date().toISOString().split('T')[0])
    ]);
    logger.info(`预热积分缓存: ${userId}`);
  }

  // 批量预热积分缓存
  async warmupPointsCaches(userIds: string[]): Promise<void> {
    const promises = userIds.map(id => this.warmupPointsCache(id));
    await Promise.all(promises);
  }

  // 获取缓存统计
  async getCacheStats(): Promise<PointsCacheStats> {
    const stats = await cacheManager.getStats();

    // 获取各类型缓存数量
    const balanceKeys = await cacheManager.keys(`${this.KEY_PREFIX}:balance:*`);
    const transactionKeys = await cacheManager.keys(`${this.KEY_PREFIX}:transaction:*`);
    const historyKeys = await cacheManager.keys(`${this.KEY_PREFIX}:history:*`);
    const statsKeys = await cacheManager.keys(`${this.KEY_PREFIX}:stats:*`);
    const transferKeys = await cacheManager.keys(`${this.KEY_PREFIX}:transfer:*`);
    const dailyKeys = await cacheManager.keys(`${this.KEY_PREFIX}:daily:*`);
    const quotaKeys = await cacheManager.keys(`${this.KEY_PREFIX}:quota:*`);

    return {
      totalCached: balanceKeys.length + transactionKeys.length + historyKeys.length +
                  statsKeys.length + transferKeys.length + dailyKeys.length + quotaKeys.length,
      byType: {
        balance: balanceKeys.length,
        transactions: transactionKeys.length,
        history: historyKeys.length,
        stats: statsKeys.length,
        transfers: transferKeys.length,
        summaries: dailyKeys.length,
        quotas: quotaKeys.length
      },
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsage || 0,
      lastUpdate: new Date()
    };
  }

  // 清理过期积分缓存
  async cleanupExpiredPointsCache(): Promise<number> {
    const keys = await cacheManager.keys(`${this.KEY_PREFIX}:*`);
    let cleanedCount = 0;

    for (const key of keys) {
      const ttl = await cacheManager.ttl(key);
      if (ttl === -2) { // 已过期
        await cacheManager.del(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理了${cleanedCount}个过期的积分缓存`);
    }

    return cleanedCount;
  }
}