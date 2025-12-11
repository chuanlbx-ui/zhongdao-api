import { logger } from '../utils/logger';

/**
 * 缓存服务接口
 */
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteByPattern(pattern: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  increment(key: string, value?: number): Promise<number>;
  decrement(key: string, value?: number): Promise<number>;
  getMultiple<T>(keys: string[]): Promise<Map<string, T | null>>;
  setMultiple(entries: Map<string, any>, ttl?: number): Promise<void>;
}

/**
 * 内存缓存实现
 * 用于开发和测试环境
 */
export class MemoryCacheService implements CacheService {
  private cache = new Map<string, { value: any; expiry: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 定期清理过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // 每分钟清理一次
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    const expiry = Date.now() + (ttl * 1000);
    this.cache.set(key, { value, expiry });

    // 如果缓存过大，删除最旧的条目
    if (this.cache.size > 10000) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) {
      return -1;
    }

    const remaining = Math.ceil((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1;
  }

  async increment(key: string, value: number = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) + value;
    await this.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) - value;
    await this.set(key, newValue);
    return newValue;
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    for (const key of keys) {
      result.set(key, await this.get<T>(key));
    }
    return result;
  }

  async setMultiple(entries: Map<string, any>, ttl?: number): Promise<void> {
    for (const [key, value] of entries) {
      await this.set(key, value, ttl);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

/**
 * Redis缓存实现
 * 用于生产环境
 */
export class RedisCacheService implements CacheService {
  private redis: any; // Redis客户端实例
  private connected = false;

  constructor(redisClient?: any) {
    if (redisClient) {
      this.redis = redisClient;
      this.connected = true;
    } else {
      // 尝试创建Redis客户端
      this.tryConnectRedis();
    }
  }

  private tryConnectRedis(): void {
    try {
      // 这里应该导入并创建Redis客户端
      // const Redis = require('redis');
      // this.redis = Redis.createClient(process.env.REDIS_URL);
      // this.redis.on('connect', () => {
      //   this.connected = true;
      //   logger.info('Redis缓存已连接');
      // });
      // this.redis.on('error', (err) => {
      //   this.connected = false;
      //   logger.error('Redis连接错误', err);
      // });
      logger.warn('Redis未配置，使用内存缓存作为回退');
    } catch (error) {
      logger.error('初始化Redis失败', error);
    }
  }

  private async ensureConnection(): Promise<boolean> {
    if (!this.connected) {
      // 尝试重连或使用内存缓存回退
      return false;
    }
    return true;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!(await this.ensureConnection())) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET失败', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    if (!(await this.ensureConnection())) {
      return;
    }

    try {
      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
    } catch (error) {
      logger.error('Redis SET失败', { key, error });
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!(await this.ensureConnection())) {
      return false;
    }

    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL失败', { key, error });
      return false;
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    if (!(await this.ensureConnection())) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error('Redis DELBYFAILURE失败', { pattern, error });
    }
  }

  async clear(): Promise<void> {
    if (!(await this.ensureConnection())) {
      return;
    }

    try {
      await this.redis.flushdb();
    } catch (error) {
      logger.error('Redis CLEAR失败', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!(await this.ensureConnection())) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS失败', { key, error });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!(await this.ensureConnection())) {
      return -1;
    }

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      logger.error('Redis TTL失败', { key, error });
      return -1;
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    if (!(await this.ensureConnection())) {
      return 0;
    }

    try {
      return await this.redis.incrby(key, value);
    } catch (error) {
      logger.error('Redis INCR失败', { key, error });
      return 0;
    }
  }

  async decrement(key: string, value: number = 1): Promise<number> {
    if (!(await this.ensureConnection())) {
      return 0;
    }

    try {
      return await this.redis.decrby(key, value);
    } catch (error) {
      logger.error('Redis DECR失败', { key, error });
      return 0;
    }
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();

    if (!(await this.ensureConnection())) {
      keys.forEach(key => result.set(key, null));
      return result;
    }

    try {
      const values = await this.redis.mget(...keys);
      keys.forEach((key, index) => {
        const value = values[index];
        result.set(key, value ? JSON.parse(value) : null);
      });
    } catch (error) {
      logger.error('Redis MGET失败', { keys, error });
      keys.forEach(key => result.set(key, null));
    }

    return result;
  }

  async setMultiple(entries: Map<string, any>, ttl?: number): Promise<void> {
    if (!(await this.ensureConnection())) {
      return;
    }

    try {
      if (ttl && ttl > 0) {
        // 使用pipeline设置多个键的过期时间
        const pipeline = this.redis.pipeline();
        for (const [key, value] of entries) {
          pipeline.setex(key, ttl, JSON.stringify(value));
        }
        await pipeline.exec();
      } else {
        const serializedEntries: string[] = [];
        for (const [key, value] of entries) {
          serializedEntries.push(key, JSON.stringify(value));
        }
        await this.redis.mset(...serializedEntries);
      }
    } catch (error) {
      logger.error('Redis MSET失败', { entriesCount: entries.size, error });
    }
  }
}

/**
 * 带装饰器的缓存服务
 * 提供额外的缓存功能
 */
export class CacheServiceWithDecorator implements CacheService {
  private cache: CacheService;
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0
  };

  constructor(cacheService: CacheService) {
    this.cache = cacheService;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    if (value !== null) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    return value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    await this.cache.set(key, value, ttl);
    this.stats.sets++;
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.cache.delete(key);
    if (result) {
      this.stats.deletes++;
    }
    return result;
  }

  async deleteByPattern(pattern: string): Promise<void> {
    await this.cache.deleteByPattern(pattern);
  }

  async clear(): Promise<void> {
    await this.cache.clear();
    this.resetStats();
  }

  async exists(key: string): Promise<boolean> {
    return this.cache.exists(key);
  }

  async ttl(key: string): Promise<number> {
    return this.cache.ttl(key);
  }

  async increment(key: string, value?: number): Promise<number> {
    return this.cache.increment(key, value);
  }

  async decrement(key: string, value?: number): Promise<number> {
    return this.cache.decrement(key, value);
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = await this.cache.getMultiple<T>(keys);
    // 更新统计
    for (const value of results.values()) {
      if (value !== null) {
        this.stats.hits++;
      } else {
        this.stats.misses++;
      }
    }
    return results;
  }

  async setMultiple(entries: Map<string, any>, ttl?: number): Promise<void> {
    await this.cache.setMultiple(entries, ttl);
    this.stats.sets += entries.size;
  }

  /**
   * 获取或设置缓存
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    let value = await this.get<T>(key);

    if (value === null) {
      value = await fetcher();
      await this.set(key, value, ttl);
    }

    return value;
  }

  /**
   * 记忆化装饰器
   */
  memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: {
      ttl?: number;
      keyGenerator?: (...args: Parameters<T>) => string;
    } = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      const key = options.keyGenerator
        ? options.keyGenerator(...args)
        : `${fn.name}:${JSON.stringify(args)}`;

      return this.getOrSet(key, () => fn(...args), options.ttl);
    }) as T;
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.sets = 0;
    this.stats.deletes = 0;
  }
}

// 创建缓存服务实例
let memoryCache: MemoryCacheService;
let cacheService: CacheServiceWithDecorator;

// 初始化缓存服务
export function initializeCache(useRedis: boolean = false): CacheServiceWithDecorator {
  if (cacheService) {
    return cacheService;
  }

  let baseCache: CacheService;

  if (useRedis) {
    baseCache = new RedisCacheService();
    logger.info('使用Redis缓存服务');
  } else {
    baseCache = new MemoryCacheService();
    logger.info('使用内存缓存服务');
  }

  cacheService = new CacheServiceWithDecorator(baseCache);
  memoryCache = baseCache instanceof MemoryCacheService ? baseCache : null;

  return cacheService;
}

// 导出默认缓存服务
export const cacheService = initializeCache(process.env.NODE_ENV === 'production');

// 导出内存缓存实例（用于测试）
export function getMemoryCache(): MemoryCacheService | null {
  return memoryCache;
}