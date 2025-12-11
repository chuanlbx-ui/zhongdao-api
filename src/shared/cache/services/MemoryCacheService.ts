/**
 * 内存缓存服务实现
 * 作为Redis不可用时的降级方案
 */

import { EventEmitter } from 'events';
import { ICacheService, CacheOptions, CacheStats, CacheItem } from '../CacheInterface';
import { logger } from '../../utils/logger';

interface MemoryCacheEntry<T> {
  value: T;
  expiry?: number;
  createdAt: number;
  updatedAt: number;
  hits: number;
  tags?: string[];
  ttl?: number;
}

export class MemoryCacheService extends EventEmitter implements ICacheService {
  private cache: Map<string, MemoryCacheEntry<any>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };
  private prefix: string = 'zhongdao:';
  private defaultTTL: number = 3600; // 1小时
  private maxEntries: number = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startCleanupTask();
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private updateStats(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiry && now > entry.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    // 如果缓存条目过多，删除最旧的
    if (this.cache.size > this.maxEntries) {
      const entries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.createdAt - b.createdAt);

      const toDelete = entries.slice(0, this.cache.size - this.maxEntries);
      for (const [key] of toDelete) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`内存缓存清理: 删除了${cleanedCount}个过期条目`);
    }
  }

  private startCleanupTask(): void {
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  // 基础操作
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getKey(key);
      const entry = this.cache.get(fullKey);

      if (!entry) {
        this.stats.misses++;
        this.updateStats();
        this.emit('cache:miss', { key });
        return null;
      }

      // 检查过期
      if (entry.expiry && Date.now() > entry.expiry) {
        this.cache.delete(fullKey);
        this.stats.misses++;
        this.updateStats();
        this.emit('cache:miss', { key });
        return null;
      }

      // 更新命中次数
      entry.hits++;
      this.stats.hits++;
      this.updateStats();
      this.emit('cache:hit', { key, value: entry.value });

      return entry.value as T;
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存GET错误:', error);
      this.emit('cache:error', { key, error: error as Error });
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      const ttl = options.ttl || this.defaultTTL;
      const now = Date.now();

      const entry: MemoryCacheEntry<T> = {
        value,
        expiry: ttl > 0 ? now + ttl * 1000 : undefined,
        createdAt: now,
        updatedAt: now,
        hits: 0,
        tags: options.tags,
        ttl
      };

      this.cache.set(fullKey, entry);

      // 处理标签
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          if (!this.tagIndex.has(tag)) {
            this.tagIndex.set(tag, new Set());
          }
          this.tagIndex.get(tag)!.add(fullKey);
        }
      }

      this.stats.sets++;
      this.emit('cache:set', { key, value, options });
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存SET错误:', error);
      this.emit('cache:error', { key, error: error as Error });
    }
  }

  async del(key: string): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      const entry = this.cache.get(fullKey);

      if (entry) {
        // 删除标签索引
        if (entry.tags) {
          for (const tag of entry.tags) {
            const tagKeys = this.tagIndex.get(tag);
            if (tagKeys) {
              tagKeys.delete(fullKey);
              if (tagKeys.size === 0) {
                this.tagIndex.delete(tag);
              }
            }
          }
        }

        this.cache.delete(fullKey);
        this.stats.deletes++;
        this.emit('cache:delete', { key });
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存DEL错误:', error);
      this.emit('cache:error', { key, error: error as Error });
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getKey(key);
      const entry = this.cache.get(fullKey);

      if (!entry) {
        return false;
      }

      // 检查过期
      if (entry.expiry && Date.now() > entry.expiry) {
        this.cache.delete(fullKey);
        return false;
      }

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存EXISTS错误:', error);
      return false;
    }
  }

  // TTL操作
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getKey(key);
      const entry = this.cache.get(fullKey);

      if (!entry || !entry.expiry) {
        return -1;
      }

      const now = Date.now();
      if (now > entry.expiry) {
        this.cache.delete(fullKey);
        return -2;
      }

      return Math.floor((entry.expiry - now) / 1000);
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存TTL错误:', error);
      return -2;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      const entry = this.cache.get(fullKey);

      if (entry) {
        entry.expiry = ttl > 0 ? Date.now() + ttl * 1000 : undefined;
        entry.updatedAt = Date.now();
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存EXPIRE错误:', error);
    }
  }

  async persist(key: string): Promise<void> {
    try {
      const fullKey = this.getKey(key);
      const entry = this.cache.get(fullKey);

      if (entry) {
        entry.expiry = undefined;
        entry.updatedAt = Date.now();
      }
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存PERSIST错误:', error);
    }
  }

  // 批量操作
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];

    for (const key of keys) {
      const value = await this.get<T>(key);
      results.push(value);
    }

    return results;
  }

  async mset<T>(items: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.value, item.options);
    }
  }

  async mdel(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.del(key);
    }
  }

  // 模式匹配
  async keys(pattern: string): Promise<string[]> {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const matchedKeys: string[] = [];

      for (const key of this.cache.keys()) {
        const shortKey = key.substring(this.prefix.length);
        if (regex.test(shortKey)) {
          matchedKeys.push(shortKey);
        }
      }

      return matchedKeys;
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存KEYS错误:', error);
      return [];
    }
  }

  async delPattern(pattern: string): Promise<number> {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      let deletedCount = 0;

      for (const [key] of this.cache) {
        const shortKey = key.substring(this.prefix.length);
        if (regex.test(shortKey)) {
          await this.del(shortKey);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存DELPATTERN错误:', error);
      return 0;
    }
  }

  // 标签操作
  async invalidateTags(tags: string[]): Promise<number> {
    let deletedCount = 0;

    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const fullKey of keys) {
          const shortKey = fullKey.substring(this.prefix.length);
          await this.del(shortKey);
          deletedCount++;
        }
        this.tagIndex.delete(tag);
      }
    }

    return deletedCount;
  }

  // 原子操作
  async incr(key: string, amount: number = 1): Promise<number> {
    try {
      const value = await this.get<number>(key);
      const newValue = (value || 0) + amount;
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存INCR错误:', error);
      return 0;
    }
  }

  async decr(key: string, amount: number = 1): Promise<number> {
    try {
      const value = await this.get<number>(key);
      const newValue = (value || 0) - amount;
      await this.set(key, newValue);
      return newValue;
    } catch (error) {
      this.stats.errors++;
      logger.error('内存缓存DECR错误:', error);
      return 0;
    }
  }

  // 哈希操作
  async hget<T>(key: string, field: string): Promise<T | null> {
    const hashKey = `${key}:hash`;
    const hash = await this.get<Record<string, T>>(hashKey);
    return hash && hash[field] ? hash[field] : null;
  }

  async hset<T>(key: string, field: string, value: T, options: CacheOptions = {}): Promise<void> {
    const hashKey = `${key}:hash`;
    const hash = await this.get<Record<string, T>>(hashKey) || {};
    hash[field] = value;
    await this.set(hashKey, hash, options);
  }

  async hdel(key: string, field: string): Promise<void> {
    const hashKey = `${key}:hash`;
    const hash = await this.get<Record<string, any>>(hashKey);
    if (hash && hash[field]) {
      delete hash[field];
      await this.set(hashKey, hash);
    }
  }

  async hkeys(key: string): Promise<string[]> {
    const hashKey = `${key}:hash`;
    const hash = await this.get<Record<string, any>>(hashKey);
    return hash ? Object.keys(hash) : [];
  }

  async hvals<T>(key: string): Promise<T[]> {
    const hashKey = `${key}:hash`;
    const hash = await this.get<Record<string, T>>(hashKey);
    return hash ? Object.values(hash) : [];
  }

  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const hashKey = `${key}:hash`;
    const hash = await this.get<Record<string, T>>(hashKey);
    return hash || {};
  }

  // 列表操作
  async lpush<T>(key: string, value: T, options?: CacheOptions): Promise<number> {
    const listKey = `${key}:list`;
    const list = await this.get<T[]>(listKey) || [];
    list.unshift(value);
    await this.set(listKey, list, options);
    return list.length;
  }

  async rpush<T>(key: string, value: T, options?: CacheOptions): Promise<number> {
    const listKey = `${key}:list`;
    const list = await this.get<T[]>(listKey) || [];
    list.push(value);
    await this.set(listKey, list, options);
    return list.length;
  }

  async lpop<T>(key: string): Promise<T | null> {
    const listKey = `${key}:list`;
    const list = await this.get<T[]>(listKey);
    if (list && list.length > 0) {
      const value = list.shift();
      await this.set(listKey, list);
      return value || null;
    }
    return null;
  }

  async rpop<T>(key: string): Promise<T | null> {
    const listKey = `${key}:list`;
    const list = await this.get<T[]>(listKey);
    if (list && list.length > 0) {
      const value = list.pop();
      await this.set(listKey, list);
      return value || null;
    }
    return null;
  }

  async llen(key: string): Promise<number> {
    const listKey = `${key}:list`;
    const list = await this.get<any[]>(listKey);
    return list ? list.length : 0;
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    const listKey = `${key}:list`;
    const list = await this.get<T[]>(listKey);
    if (list) {
      // 处理负数索引
      const actualStart = start < 0 ? list.length + start : start;
      const actualStop = stop < 0 ? list.length + stop : stop;
      return list.slice(actualStart, actualStop + 1);
    }
    return [];
  }

  // 集合操作
  async sadd<T>(key: string, value: T, options?: CacheOptions): Promise<number> {
    const setKey = `${key}:set`;
    const set = await this.get<Set<T>>(setKey) || new Set();
    const added = set.has(value) ? 0 : 1;
    set.add(value);
    await this.set(setKey, Array.from(set), options);
    return added;
  }

  async srem<T>(key: string, value: T): Promise<number> {
    const setKey = `${key}:set`;
    const set = await this.get<Set<T>>(setKey) || new Set();
    const removed = set.has(value) ? 1 : 0;
    set.delete(value);
    await this.set(setKey, Array.from(set));
    return removed;
  }

  async smembers<T>(key: string): Promise<T[]> {
    const setKey = `${key}:set`;
    const set = await this.get<T[]>(setKey);
    return set || [];
  }

  async scard(key: string): Promise<number> {
    const setKey = `${key}:set`;
    const set = await this.get<T[]>(setKey);
    return set ? set.length : 0;
  }

  async sismember<T>(key: string, value: T): Promise<boolean> {
    const setKey = `${key}:set`;
    const set = await this.get<T[]>(setKey);
    return set ? set.includes(value) : false;
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
    this.cache.clear();
    this.tagIndex.clear();
    this.emit('cache:clear', {});
  }

  // 统计和监控
  async getStats(): Promise<CacheStats> {
    this.updateStats();

    // 计算内存使用
    let memoryUsage = 0;
    for (const [_, entry] of this.cache) {
      memoryUsage += JSON.stringify(entry).length * 2; // 估算内存使用
    }

    return {
      ...this.stats,
      memoryUsage,
      keys: this.cache.size
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

  // 健康检查
  async healthCheck(): Promise<boolean> {
    return true; // 内存缓存总是健康的
  }

  // 连接管理
  async connect(): Promise<void> {
    // 内存缓存不需要连接
  }

  async disconnect(): Promise<void> {
    // 停止清理任务
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // 配置
  async updateConfig(config: any): Promise<void> {
    if (config.defaultTTL !== undefined) {
      this.defaultTTL = config.defaultTTL;
    }
    if (config.maxEntries !== undefined) {
      this.maxEntries = config.maxEntries;
    }
  }

  getConfig(): any {
    return {
      prefix: this.prefix,
      defaultTTL: this.defaultTTL,
      maxEntries: this.maxEntries,
      size: this.cache.size,
      connected: true
    };
  }
}

// 导出单例
export const memoryCacheService = new MemoryCacheService();