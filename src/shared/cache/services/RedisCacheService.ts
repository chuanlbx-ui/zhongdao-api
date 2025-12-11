/**
 * Redis缓存服务实现
 * 提供完整的Redis缓存功能
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { ICacheService, CacheOptions, CacheStats, CacheItem } from '../CacheInterface';
import { redisConnectionManager } from '../RedisConnectionManager';
import { logger } from '../../utils/logger';

export class RedisCacheService extends EventEmitter implements ICacheService {
  private client: Redis | null = null;
  private prefix: string = 'zhongdao:';
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };
  private tagPrefix = 'tag:';
  private defaultTTL = 3600; // 1小时

  constructor() {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.client = await redisConnectionManager.getClient();

      // 设置事件监听
      if (this.client) {
        this.client.on('error', (error) => {
          logger.error('Redis缓存错误:', error);
          this.emit('cache:error', { key: 'global', error });
        });
      }
    } catch (error) {
      logger.error('Redis缓存初始化失败:', error);
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private serialize(value: any): string {
    return JSON.stringify(value);
  }

  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value as unknown as T;
    }
  }

  // 基础操作
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const fullKey = this.getKey(key);
      const value = await this.client.get(fullKey);

      if (value === null) {
        this.stats.misses++;
        this.updateHitRate();
        this.emit('cache:miss', { key });
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      this.emit('cache:hit', { key, value: this.deserialize<T>(value) });
      return this.deserialize<T>(value);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis GET错误:', error);
      this.emit('cache:error', { key, error: error as Error });
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    if (!this.client) return;

    try {
      const fullKey = this.getKey(key);
      const serializedValue = this.serialize(value);
      const ttl = options.ttl || this.defaultTTL;

      // 添加标签信息
      const cacheItem: CacheItem = {
        value,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        hits: 0,
        tags: options.tags
      };

      const finalValue = this.serialize(cacheItem);

      if (ttl > 0) {
        await this.client.setex(fullKey, ttl, finalValue);
      } else {
        await this.client.set(fullKey, finalValue);
      }

      // 处理标签
      if (options.tags && options.tags.length > 0) {
        await this.addTags(key, options.tags);
      }

      this.stats.sets++;
      this.emit('cache:set', { key, value, options });
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis SET错误:', error);
      this.emit('cache:error', { key, error: error as Error });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;

    try {
      const fullKey = this.getKey(key);
      await this.client.del(fullKey);
      this.stats.deletes++;
      this.emit('cache:delete', { key });
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis DEL错误:', error);
      this.emit('cache:error', { key, error: error as Error });
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const fullKey = this.getKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis EXISTS错误:', error);
      return false;
    }
  }

  // TTL操作
  async ttl(key: string): Promise<number> {
    if (!this.client) return -2;

    try {
      const fullKey = this.getKey(key);
      return await this.client.ttl(fullKey);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis TTL错误:', error);
      return -2;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    if (!this.client) return;

    try {
      const fullKey = this.getKey(key);
      await this.client.expire(fullKey, ttl);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis EXPIRE错误:', error);
    }
  }

  async persist(key: string): Promise<void> {
    if (!this.client) return;

    try {
      const fullKey = this.getKey(key);
      await this.client.persist(fullKey);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis PERSIST错误:', error);
    }
  }

  // 批量操作
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.client || keys.length === 0) return [];

    try {
      const fullKeys = keys.map(key => this.getKey(key));
      const values = await this.client.mget(...fullKeys);

      return values.map(value => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        this.stats.hits++;
        return this.deserialize<T>(value);
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis MGET错误:', error);
      return keys.map(() => null);
    }
  }

  async mset<T>(items: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    if (!this.client || items.length === 0) return;

    try {
      const pipeline = this.client.pipeline();

      for (const item of items) {
        const fullKey = this.getKey(item.key);
        const cacheItem: CacheItem = {
          value: item.value,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          hits: 0,
          tags: item.options?.tags
        };
        const serializedValue = this.serialize(cacheItem);
        const ttl = item.options?.ttl || this.defaultTTL;

        if (ttl > 0) {
          pipeline.setex(fullKey, ttl, serializedValue);
        } else {
          pipeline.set(fullKey, serializedValue);
        }

        // 处理标签
        if (item.options?.tags && item.options.tags.length > 0) {
          this.addTags(item.key, item.options.tags);
        }
      }

      await pipeline.exec();
      this.stats.sets += items.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis MSET错误:', error);
    }
  }

  async mdel(keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;

    try {
      const fullKeys = keys.map(key => this.getKey(key));
      await this.client.del(...fullKeys);
      this.stats.deletes += keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis MDEL错误:', error);
    }
  }

  // 模式匹配
  async keys(pattern: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      const fullPattern = this.getKey(pattern);
      const keys = await this.client.keys(fullPattern);
      return keys.map(key => key.substring(this.prefix.length));
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis KEYS错误:', error);
      return [];
    }
  }

  async delPattern(pattern: string): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullPattern = this.getKey(pattern);
      const keys = await this.client.keys(fullPattern);

      if (keys.length > 0) {
        await this.client.del(...keys);
        this.stats.deletes += keys.length;
      }

      return keys.length;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis DELPATTERN错误:', error);
      return 0;
    }
  }

  // 标签操作
  async invalidateTags(tags: string[]): Promise<number> {
    if (!this.client || tags.length === 0) return 0;

    try {
      const pipeline = this.client.pipeline();
      const tagKeys = tags.map(tag => `${this.tagPrefix}${tag}`);

      // 获取所有标签关联的键
      const results = await Promise.all(
        tagKeys.map(async tagKey => {
          const keys = await this.client.smembers(tagKey);
          return keys;
        })
      );

      // 收集所有需要删除的键
      const keysToDelete = new Set<string>();
      for (const keys of results) {
        for (const key of keys) {
          keysToDelete.add(key);
        }
      }

      // 删除缓存和标签关联
      if (keysToDelete.size > 0) {
        pipeline.del(...Array.from(keysToDelete));
      }

      // 删除标签本身
      pipeline.del(...tagKeys);

      await pipeline.exec();

      const count = keysToDelete.size;
      this.stats.deletes += count;

      return count;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis INVALIDATE_TAGS错误:', error);
      return 0;
    }
  }

  private async addTags(key: string, tags: string[]): Promise<void> {
    if (!this.client || tags.length === 0) return;

    try {
      const fullKey = this.getKey(key);
      const pipeline = this.client.pipeline();

      for (const tag of tags) {
        const tagKey = `${this.tagPrefix}${tag}`;
        pipeline.sadd(tagKey, fullKey);
        // 设置标签的过期时间
        pipeline.expire(tagKey, this.defaultTTL * 2);
      }

      await pipeline.exec();
    } catch (error) {
      logger.error('添加标签失败:', error);
    }
  }

  // 原子操作
  async incr(key: string, amount: number = 1): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullKey = this.getKey(key);
      return await this.client.incrby(fullKey, amount);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis INCR错误:', error);
      return 0;
    }
  }

  async decr(key: string, amount: number = 1): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullKey = this.getKey(key);
      return await this.client.decrby(fullKey, amount);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis DECR错误:', error);
      return 0;
    }
  }

  // 哈希操作
  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const fullKey = this.getKey(key);
      const value = await this.client.hget(fullKey, field);
      return value ? this.deserialize<T>(value) : null;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis HGET错误:', error);
      return null;
    }
  }

  async hset<T>(key: string, field: string, value: T, options: CacheOptions = {}): Promise<void> {
    if (!this.client) return;

    try {
      const fullKey = this.getKey(key);
      const serializedValue = this.serialize(value);
      await this.client.hset(fullKey, field, serializedValue);

      if (options.ttl) {
        await this.client.expire(fullKey, options.ttl);
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis HSET错误:', error);
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    if (!this.client) return;

    try {
      const fullKey = this.getKey(key);
      await this.client.hdel(fullKey, field);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis HDEL错误:', error);
    }
  }

  async hkeys(key: string): Promise<string[]> {
    if (!this.client) return [];

    try {
      const fullKey = this.getKey(key);
      return await this.client.hkeys(fullKey);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis HKEYS错误:', error);
      return [];
    }
  }

  async hvals<T>(key: string): Promise<T[]> {
    if (!this.client) return [];

    try {
      const fullKey = this.getKey(key);
      const values = await this.client.hvals(fullKey);
      return values.map(value => this.deserialize<T>(value));
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis HVALS错误:', error);
      return [];
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    if (!this.client) return {};

    try {
      const fullKey = this.getKey(key);
      const hash = await this.client.hgetall(fullKey);
      const result: Record<string, T> = {};

      for (const [field, value] of Object.entries(hash)) {
        result[field] = this.deserialize<T>(value);
      }

      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis HGETALL错误:', error);
      return {};
    }
  }

  // 列表操作
  async lpush<T>(key: string, value: T, options: CacheOptions = {}): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullKey = this.getKey(key);
      const serializedValue = this.serialize(value);
      const result = await this.client.lpush(fullKey, serializedValue);

      if (options.ttl) {
        await this.client.expire(fullKey, options.ttl);
      }

      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis LPUSH错误:', error);
      return 0;
    }
  }

  async rpush<T>(key: string, value: T, options: CacheOptions = {}): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullKey = this.getKey(key);
      const serializedValue = this.serialize(value);
      const result = await this.client.rpush(fullKey, serializedValue);

      if (options.ttl) {
        await this.client.expire(fullKey, options.ttl);
      }

      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis RPUSH错误:', error);
      return 0;
    }
  }

  async lpop<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const fullKey = this.getKey(key);
      const value = await this.client.lpop(fullKey);
      return value ? this.deserialize<T>(value) : null;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis LPOP错误:', error);
      return null;
    }
  }

  async rpop<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const fullKey = this.getKey(key);
      const value = await this.client.rpop(fullKey);
      return value ? this.deserialize<T>(value) : null;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis RPOP错误:', error);
      return null;
    }
  }

  async llen(key: string): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullKey = this.getKey(key);
      return await this.client.llen(fullKey);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis LLEN错误:', error);
      return 0;
    }
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    if (!this.client) return [];

    try {
      const fullKey = this.getKey(key);
      const values = await this.client.lrange(fullKey, start, stop);
      return values.map(value => this.deserialize<T>(value));
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis LRANGE错误:', error);
      return [];
    }
  }

  // 集合操作
  async sadd<T>(key: string, value: T, options: CacheOptions = {}): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullKey = this.getKey(key);
      const serializedValue = this.serialize(value);
      const result = await this.client.sadd(fullKey, serializedValue);

      if (options.ttl) {
        await this.client.expire(fullKey, options.ttl);
      }

      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis SADD错误:', error);
      return 0;
    }
  }

  async srem<T>(key: string, value: T): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullKey = this.getKey(key);
      const serializedValue = this.serialize(value);
      return await this.client.srem(fullKey, serializedValue);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis SREM错误:', error);
      return 0;
    }
  }

  async smembers<T>(key: string): Promise<T[]> {
    if (!this.client) return [];

    try {
      const fullKey = this.getKey(key);
      const values = await this.client.smembers(fullKey);
      return values.map(value => this.deserialize<T>(value));
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis SMEMBERS错误:', error);
      return [];
    }
  }

  async scard(key: string): Promise<number> {
    if (!this.client) return 0;

    try {
      const fullKey = this.getKey(key);
      return await this.client.scard(fullKey);
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis SCARD错误:', error);
      return 0;
    }
  }

  async sismember<T>(key: string, value: T): Promise<boolean> {
    if (!this.client) return false;

    try {
      const fullKey = this.getKey(key);
      const serializedValue = this.serialize(value);
      const result = await this.client.sismember(fullKey, serializedValue);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis SISMEMBER错误:', error);
      return false;
    }
  }

  // 缓存操作
  async remember<T>(key: string, fn: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
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
    if (!this.client) return;

    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      this.emit('cache:clear', {});
    } catch (error) {
      this.stats.errors++;
      logger.error('Redis FLUSH错误:', error);
    }
  }

  // 统计和监控
  async getStats(): Promise<CacheStats> {
    this.updateHitRate();

    let memoryUsage = 0;
    let keys = 0;

    if (this.client) {
      try {
        const info = await this.client.info('memory');
        const match = info.match(/used_memory:(\d+)/);
        if (match) {
          memoryUsage = parseInt(match[1]);
        }

        const dbInfo = await this.client.info('keyspace');
        const dbMatch = dbInfo.match(/db\d+:keys=(\d+)/);
        if (dbMatch) {
          keys = parseInt(dbMatch[1]);
        }
      } catch (error) {
        logger.error('获取Redis统计失败:', error);
      }
    }

    return {
      ...this.stats,
      memoryUsage,
      keys
    };
  }

  async resetStats(): Promise<void> {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // 连接管理
  async connect(): Promise<void> {
    await this.initialize();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  // 配置
  async updateConfig(config: any): Promise<void> {
    // 实现配置更新逻辑
  }

  getConfig(): any {
    return {
      prefix: this.prefix,
      defaultTTL: this.defaultTTL,
      connected: !!this.client
    };
  }
}

// 导出单例
export const redisCacheService = new RedisCacheService();