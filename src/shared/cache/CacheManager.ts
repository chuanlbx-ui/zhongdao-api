/**
 * 缓存管理器
 * 统一管理Redis缓存和内存缓存，提供自动降级功能
 */

import { ICacheService, CacheOptions, CacheStats } from './CacheInterface';
import { redisCacheService } from './services/RedisCacheService';
import { memoryCacheService } from './services/MemoryCacheService';
import { redisConnectionManager } from './RedisConnectionManager';
import { logger } from '../utils/logger';

export type CacheType = 'redis' | 'memory' | 'auto';

export class CacheManager implements ICacheService {
  private redisService: ICacheService;
  private memoryService: ICacheService;
  private currentType: CacheType;
  private fallbackEnabled: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30秒检查一次

  constructor(cacheType: CacheType = 'auto') {
    this.redisService = redisCacheService;
    this.memoryService = memoryCacheService;
    this.currentType = cacheType;

    // 监听Redis连接状态变化
    this.setupHealthMonitoring();
  }

  private setupHealthMonitoring(): void {
    // 定期检查Redis健康状态
    setInterval(async () => {
      await this.checkCacheHealth();
    }, this.healthCheckInterval);

    // 立即执行一次健康检查
    this.checkCacheHealth();
  }

  private async checkCacheHealth(): Promise<void> {
    if (this.currentType === 'memory') return;

    try {
      const isHealthy = await this.redisService.healthCheck();

      if (!isHealthy && this.currentType === 'redis') {
        logger.warn('Redis不健康，切换到内存缓存');
        this.switchToMemoryCache();
      } else if (isHealthy && this.currentType === 'memory' && this.fallbackEnabled) {
        logger.info('Redis恢复健康，切换回Redis缓存');
        await this.switchToRedisCache();
      }

      this.lastHealthCheck = Date.now();
    } catch (error) {
      logger.error('缓存健康检查失败:', error);
    }
  }

  private switchToMemoryCache(): void {
    if (this.currentType !== 'memory') {
      this.currentType = 'memory';
      logger.info('已切换到内存缓存模式');
    }
  }

  private async switchToRedisCache(): Promise<void> {
    if (this.currentType !== 'redis') {
      try {
        await this.redisService.connect();
        this.currentType = 'redis';
        logger.info('已切换回Redis缓存模式');
      } catch (error) {
        logger.error('切换到Redis失败，继续使用内存缓存:', error);
      }
    }
  }

  private getCurrentService(): ICacheService {
    if (this.currentType === 'auto') {
      return this.currentType === 'redis' ? this.redisService : this.memoryService;
    }
    return this.currentType === 'redis' ? this.redisService : this.memoryService;
  }

  // 基础操作
  async get<T>(key: string): Promise<T | null> {
    const service = this.getCurrentService();
    const result = await service.get<T>(key);

    // 如果是Redis且失败，尝试从内存缓存获取
    if (result === null && this.currentType === 'redis' && this.fallbackEnabled) {
      logger.debug(`Redis缓存未命中，尝试从内存缓存获取: ${key}`);
      return await this.memoryService.get<T>(key);
    }

    return result;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const service = this.getCurrentService();
    await service.set(key, value, options);

    // 如果使用Redis，也同步到内存缓存作为备份
    if (this.currentType === 'redis' && this.fallbackEnabled && options?.tags?.includes('sync-to-memory')) {
      await this.memoryService.set(key, value, options);
    }
  }

  async del(key: string): Promise<void> {
    const service = this.getCurrentService();
    await service.del(key);

    // 同时删除其他缓存中的键
    if (this.fallbackEnabled) {
      if (this.currentType === 'redis') {
        await this.memoryService.del(key);
      } else {
        await this.redisService.del(key);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const service = this.getCurrentService();
    const exists = await service.exists(key);

    // 如果Redis中不存在，检查内存缓存
    if (!exists && this.currentType === 'redis' && this.fallbackEnabled) {
      return await this.memoryService.exists(key);
    }

    return exists;
  }

  // TTL操作
  async ttl(key: string): Promise<number> {
    const service = this.getCurrentService();
    const ttl = await service.ttl(key);

    if (ttl === -2 && this.currentType === 'redis' && this.fallbackEnabled) {
      return await this.memoryService.ttl(key);
    }

    return ttl;
  }

  async expire(key: string, ttl: number): Promise<void> {
    const service = this.getCurrentService();
    await service.expire(key, ttl);

    if (this.fallbackEnabled) {
      if (this.currentType === 'redis') {
        await this.memoryService.expire(key, ttl);
      } else {
        await this.redisService.expire(key, ttl);
      }
    }
  }

  async persist(key: string): Promise<void> {
    const service = this.getCurrentService();
    await service.persist(key);

    if (this.fallbackEnabled) {
      if (this.currentType === 'redis') {
        await this.memoryService.persist(key);
      } else {
        await this.redisService.persist(key);
      }
    }
  }

  // 批量操作
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const service = this.getCurrentService();
    let results = await service.mget<T>(keys);

    // 如果是Redis且有失败，尝试从内存缓存补充
    if (this.currentType === 'redis' && this.fallbackEnabled) {
      const memoryResults = await this.memoryService.mget<T>(keys);
      results = results.map((result, index) => {
        return result !== null ? result : memoryResults[index];
      });
    }

    return results;
  }

  async mset<T>(items: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    const service = this.getCurrentService();
    await service.mset(items);

    // 同步到备用缓存
    if (this.fallbackEnabled) {
      const backupService = this.currentType === 'redis' ? this.memoryService : this.redisService;
      await backupService.mset(items);
    }
  }

  async mdel(keys: string[]): Promise<void> {
    const service = this.getCurrentService();
    await service.mdel(keys);

    if (this.fallbackEnabled) {
      const backupService = this.currentType === 'redis' ? this.memoryService : this.redisService;
      await backupService.mdel(keys);
    }
  }

  // 模式匹配
  async keys(pattern: string): Promise<string[]> {
    const service = this.getCurrentService();
    let keys = await service.keys(pattern);

    if (this.currentType === 'redis' && this.fallbackEnabled) {
      const memoryKeys = await this.memoryService.keys(pattern);
      // 合并去重
      keys = [...new Set([...keys, ...memoryKeys])];
    }

    return keys;
  }

  async delPattern(pattern: string): Promise<number> {
    let count = 0;

    if (this.fallbackEnabled) {
      // 从两个缓存都删除
      count += await this.redisService.delPattern(pattern);
      count += await this.memoryService.delPattern(pattern);
    } else {
      const service = this.getCurrentService();
      count = await service.delPattern(pattern);
    }

    return count;
  }

  // 标签操作
  async invalidateTags(tags: string[]): Promise<number> {
    let count = 0;

    if (this.fallbackEnabled) {
      // 从两个缓存都删除
      count += await this.redisService.invalidateTags(tags);
      count += await this.memoryService.invalidateTags(tags);
    } else {
      const service = this.getCurrentService();
      count = await service.invalidateTags(tags);
    }

    return count;
  }

  // 原子操作
  async incr(key: string, amount?: number): Promise<number> {
    const service = this.getCurrentService();
    return await service.incr(key, amount);
  }

  async decr(key: string, amount?: number): Promise<number> {
    const service = this.getCurrentService();
    return await service.decr(key, amount);
  }

  // 哈希操作
  async hget<T>(key: string, field: string): Promise<T | null> {
    const service = this.getCurrentService();
    const result = await service.hget<T>(key, field);

    if (result === null && this.currentType === 'redis' && this.fallbackEnabled) {
      return await this.memoryService.hget<T>(key, field);
    }

    return result;
  }

  async hset<T>(key: string, field: string, value: T, options?: CacheOptions): Promise<void> {
    const service = this.getCurrentService();
    await service.hset(key, field, value, options);

    if (this.fallbackEnabled) {
      const backupService = this.currentType === 'redis' ? this.memoryService : this.redisService;
      await backupService.hset(key, field, value, options);
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    const service = this.getCurrentService();
    await service.hdel(key, field);

    if (this.fallbackEnabled) {
      const backupService = this.currentType === 'redis' ? this.memoryService : this.redisService;
      await backupService.hdel(key, field);
    }
  }

  async hkeys(key: string): Promise<string[]> {
    const service = this.getCurrentService();
    return await service.hkeys(key);
  }

  async hvals<T>(key: string): Promise<T[]> {
    const service = this.getCurrentService();
    return await service.hvals<T>(key);
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const service = this.getCurrentService();
    return await service.hgetall<T>(key);
  }

  // 列表操作
  async lpush<T>(key: string, value: T, options?: CacheOptions): Promise<number> {
    const service = this.getCurrentService();
    return await service.lpush(key, value, options);
  }

  async rpush<T>(key: string, value: T, options?: CacheOptions): Promise<number> {
    const service = this.getCurrentService();
    return await service.rpush(key, value, options);
  }

  async lpop<T>(key: string): Promise<T | null> {
    const service = this.getCurrentService();
    const result = await service.lpop<T>(key);

    if (result === null && this.currentType === 'redis' && this.fallbackEnabled) {
      return await this.memoryService.lpop<T>(key);
    }

    return result;
  }

  async rpop<T>(key: string): Promise<T | null> {
    const service = this.getCurrentService();
    const result = await service.rpop<T>(key);

    if (result === null && this.currentType === 'redis' && this.fallbackEnabled) {
      return await this.memoryService.rpop<T>(key);
    }

    return result;
  }

  async llen(key: string): Promise<number> {
    const service = this.getCurrentService();
    const length = await service.llen(key);

    if (length === 0 && this.currentType === 'redis' && this.fallbackEnabled) {
      return await this.memoryService.llen(key);
    }

    return length;
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const service = this.getCurrentService();
    return await service.lrange<T>(key, start, stop);
  }

  // 集合操作
  async sadd<T>(key: string, value: T, options?: CacheOptions): Promise<number> {
    const service = this.getCurrentService();
    return await service.sadd(key, value, options);
  }

  async srem<T>(key: string, value: T): Promise<number> {
    const service = this.getCurrentService();
    return await service.srem(key, value);
  }

  async smembers<T>(key: string): Promise<T[]> {
    const service = this.getCurrentService();
    return await service.smembers<T>(key);
  }

  async scard(key: string): Promise<number> {
    const service = this.getCurrentService();
    const count = await service.scard(key);

    if (count === 0 && this.currentType === 'redis' && this.fallbackEnabled) {
      return await this.memoryService.scard(key);
    }

    return count;
  }

  async sismember<T>(key: string, value: T): Promise<boolean> {
    const service = this.getCurrentService();
    const isMember = await service.sismember(key, value);

    if (!isMember && this.currentType === 'redis' && this.fallbackEnabled) {
      return await this.memoryService.sismember(key, value);
    }

    return isMember;
  }

  // 缓存操作
  async remember<T>(key: string, fn: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    await this.set(key, value, options);
    return value;
  }

  async forget(key: string): Promise<void> {
    await this.del(key);
  }

  async flush(): Promise<void> {
    if (this.fallbackEnabled) {
      await this.redisService.flush();
      await this.memoryService.flush();
    } else {
      const service = this.getCurrentService();
      await service.flush();
    }
  }

  // 统计和监控
  async getStats(): Promise<CacheStats & {
    redis?: CacheStats;
    memory?: CacheStats;
    currentType: CacheType;
    fallbackEnabled: boolean;
    lastHealthCheck: number;
  }> {
    const redisStats = await this.redisService.getStats();
    const memoryStats = await this.memoryService.getStats();
    const currentStats = await this.getCurrentService().getStats();

    return {
      ...currentStats,
      redis: redisStats,
      memory: memoryStats,
      currentType: this.currentType,
      fallbackEnabled: this.fallbackEnabled,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  async resetStats(): Promise<void> {
    await this.redisService.resetStats();
    await this.memoryService.resetStats();
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    if (this.currentType === 'auto') {
      const redisHealthy = await this.redisService.healthCheck();
      if (redisHealthy) {
        return true;
      } else {
        return this.memoryService.healthCheck();
      }
    } else {
      return this.getCurrentService().healthCheck();
    }
  }

  // 连接管理
  async connect(): Promise<void> {
    await this.redisService.connect();
    await this.memoryService.connect();
  }

  async disconnect(): Promise<void> {
    await this.redisService.disconnect();
    await this.memoryService.disconnect();
  }

  // 配置
  async updateConfig(config: any): Promise<void> {
    if (config.cacheType !== undefined) {
      this.currentType = config.cacheType;
    }
    if (config.fallbackEnabled !== undefined) {
      this.fallbackEnabled = config.fallbackEnabled;
    }
    if (config.healthCheckInterval !== undefined) {
      this.healthCheckInterval = config.healthCheckInterval;
    }

    await this.redisService.updateConfig(config);
    await this.memoryService.updateConfig(config);
  }

  getConfig(): any {
    return {
      currentType: this.currentType,
      fallbackEnabled: this.fallbackEnabled,
      healthCheckInterval: this.healthCheckInterval,
      redis: this.redisService.getConfig(),
      memory: this.memoryService.getConfig()
    };
  }

  // 手动切换缓存类型
  switchCacheType(type: CacheType): void {
    if (type === 'auto') {
      this.currentType = 'auto';
      this.checkCacheHealth();
    } else {
      this.currentType = type;
    }
    logger.info(`手动切换缓存类型到: ${type}`);
  }

  // 获取当前缓存类型
  getCurrentCacheType(): CacheType {
    return this.currentType;
  }

  // 预热缓存
  async warmup(warmupData: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    const service = this.getCurrentService();

    // 并行预热
    const promises = warmupData.map(item =>
      service.set(item.key, item.value, item.options)
    );

    await Promise.all(promises);
    logger.info(`预热了${warmupData.length}个缓存项`);
  }
}

// 导出单例
export const cacheManager = new CacheManager();