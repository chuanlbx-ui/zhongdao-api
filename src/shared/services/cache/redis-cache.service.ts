import { logger } from '../../utils/logger';

/**
 * Redis缓存服务
 * 注意：根据项目配置，生产环境禁用了Redis，这里提供内存缓存替代方案
 */
export class RedisCacheService {
  private static instance: RedisCacheService;
  private cache: Map<string, { value: any; expiry: number }> = new Map();
  private defaultTTL = 300; // 5分钟默认过期时间

  static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService();
    }
    return RedisCacheService.instance;
  }

  /**
   * 生成缓存键
   */
  private generateKey(prefix: string, ...params: (string | number)[]): string {
    return `${prefix}:${params.join(':')}`;
  }

  /**
   * 设置缓存
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expiry = Date.now() + (ttl || this.defaultTTL) * 1000;
    this.cache.set(key, { value, expiry });

    logger.debug('缓存设置', {
      key,
      ttl: ttl || this.defaultTTL,
      size: JSON.stringify(value).length
    });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      logger.debug('缓存过期并删除', { key });
      return null;
    }

    logger.debug('缓存命中', { key });
    return item.value as T;
  }

  /**
   * 删除缓存
   */
  async del(key: string): Promise<void> {
    this.cache.delete(key);
    logger.debug('缓存删除', { key });
  }

  /**
   * 删除匹配模式的缓存
   */
  async delPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
    logger.debug('批量删除缓存', { pattern });
  }

  /**
   * 检查缓存是否存在
   */
  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, ttl: number): Promise<void> {
    const item = this.cache.get(key);
    if (item) {
      item.expiry = Date.now() + ttl * 1000;
      logger.debug('更新缓存过期时间', { key, ttl });
    }
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string): Promise<number> {
    const item = this.cache.get(key);
    if (!item) {
      return -2; // key不存在
    }

    const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
    if (remaining <= 0) {
      this.cache.delete(key);
      return -2; // key不存在
    }

    return remaining;
  }

  /**
   * 缓存用户交易记录
   */
  async cacheUserTransactions(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    },
    data: any,
    ttl: number = 60 // 1分钟缓存
  ): Promise<void> {
    const key = this.generateKey(
      'user_transactions',
      userId,
      params.page || 1,
      params.limit || 20,
      params.type || 'all',
      params.startDate?.getTime() || 'null',
      params.endDate?.getTime() || 'null'
    );

    await this.set(key, data, ttl);
  }

  /**
   * 获取缓存的用户交易记录
   */
  async getCachedUserTransactions(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      type?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<any> {
    const key = this.generateKey(
      'user_transactions',
      userId,
      params.page || 1,
      params.limit || 20,
      params.type || 'all',
      params.startDate?.getTime() || 'null',
      params.endDate?.getTime() || 'null'
    );

    return await this.get(key);
  }

  /**
   * 清除用户相关的所有缓存
   */
  async clearUserCache(userId: string): Promise<void> {
    await this.delPattern(`user_transactions:${userId}:*`);
    await this.delPattern(`user_balance:${userId}`);
    await this.delPattern(`user_stats:${userId}:*`);
    logger.info('清除用户缓存', { userId });
  }

  /**
   * 缓存用户余额
   */
  async cacheUserBalance(userId: string, balance: number, ttl: number = 30): Promise<void> {
    const key = this.generateKey('user_balance', userId);
    await this.set(key, balance, ttl);
  }

  /**
   * 获取缓存的用户余额
   */
  async getCachedUserBalance(userId: string): Promise<number | null> {
    const key = this.generateKey('user_balance', userId);
    return await this.get(key);
  }

  /**
   * 缓存用户统计信息
   */
  async cacheUserStats(
    userId: string,
    period: string,
    stats: any,
    ttl: number = 300 // 5分钟缓存
  ): Promise<void> {
    const key = this.generateKey('user_stats', userId, period);
    await this.set(key, stats, ttl);
  }

  /**
   * 获取缓存的用户统计信息
   */
  async getCachedUserStats(userId: string, period: string): Promise<any> {
    const key = this.generateKey('user_stats', userId, period);
    return await this.get(key);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    memoryUsage: number;
  } {
    let memoryUsage = 0;
    for (const [key, item] of this.cache) {
      memoryUsage += JSON.stringify(item).length;
    }

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsage
    };
  }

  /**
   * 清理过期缓存
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('清理过期缓存', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * 定期清理任务
   */
  startCleanupTask(intervalMs: number = 60000): void {
    setInterval(() => {
      this.cleanupExpired();
    }, intervalMs);
  }
}

// 导出单例实例
export const redisCacheService = RedisCacheService.getInstance();

// 启动定期清理任务
redisCacheService.startCleanupTask();