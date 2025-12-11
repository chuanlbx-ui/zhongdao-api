/**
 * 统一的缓存接口
 * 定义缓存操作的标准方法
 */

export interface CacheOptions {
  ttl?: number; // 生存时间（秒）
  prefix?: string; // 键前缀
  tags?: string[]; // 缓存标签（用于批量失效）
  priority?: 'low' | 'normal' | 'high'; // 优先级
  serialize?: boolean; // 是否序列化
}

export interface CacheStats {
  hits: number; // 命中次数
  misses: number; // 未命中次数
  hitRate: number; // 命中率
  sets: number; // 设置次数
  deletes: number; // 删除次数
  errors: number; // 错误次数
  memoryUsage?: number; // 内存使用（字节）
  keys?: number; // 键数量
}

export interface CacheItem {
  value: any;
  expiry?: number;
  createdAt: number;
  updatedAt: number;
  hits: number;
  tags?: string[];
}

/**
 * 缓存接口
 */
export interface ICacheService {
  // 基础操作
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;

  // TTL操作
  ttl(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  persist(key: string): Promise<void>;

  // 批量操作
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(items: Array<{ key: string; value: T; options?: CacheOptions }>): Promise<void>;
  mdel(keys: string[]): Promise<void>;

  // 模式匹配
  keys(pattern: string): Promise<string[]>;
  delPattern(pattern: string): Promise<number>;

  // 标签操作
  invalidateTags(tags: string[]): Promise<number>;

  // 原子操作
  incr(key: string, amount?: number): Promise<number>;
  decr(key: string, amount?: number): Promise<number>;

  // 哈希操作
  hget<T>(key: string, field: string): Promise<T | null>;
  hset<T>(key: string, field: string, value: T, options?: CacheOptions): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hkeys(key: string): Promise<string[]>;
  hvals<T>(key: string): Promise<T[]>;
  hgetall<T>(key: string): Promise<Record<string, T>>;

  // 列表操作
  lpush<T>(key: string, value: T, options?: CacheOptions): Promise<number>;
  rpush<T>(key: string, value: T, options?: CacheOptions): Promise<number>;
  lpop<T>(key: string): Promise<T | null>;
  rpop<T>(key: string): Promise<T | null>;
  llen(key: string): Promise<number>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;

  // 集合操作
  sadd<T>(key: string, value: T, options?: CacheOptions): Promise<number>;
  srem<T>(key: string, value: T): Promise<number>;
  smembers<T>(key: string): Promise<T[]>;
  scard(key: string): Promise<number>;
  sismember<T>(key: string, value: T): Promise<boolean>;

  // 缓存操作
  remember<T>(key: string, fn: () => Promise<T>, options?: CacheOptions): Promise<T>;
  forget(key: string): Promise<void>;
  flush(): Promise<void>;

  // 统计和监控
  getStats(): Promise<CacheStats>;
  resetStats(): Promise<void>;

  // 健康检查
  healthCheck(): Promise<boolean>;

  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // 配置
  updateConfig(config: any): Promise<void>;
  getConfig(): any;
}

/**
 * 缓存事件
 */
export interface CacheEvents {
  'cache:hit': { key: string; value: any };
  'cache:miss': { key: string };
  'cache:set': { key: string; value: any; options?: CacheOptions };
  'cache:delete': { key: string };
  'cache:clear': { pattern?: string };
  'cache:error': { key: string; error: Error };
}

/**
 * 缓存策略接口
 */
export interface ICacheStrategy {
  // 缓存键生成
  generateKey(prefix: string, params: Record<string, any>): string;

  // TTL计算
  calculateTTL(data: any, baseOptions: CacheOptions): number;

  // 缓存预热
  warmup(patterns: string[]): Promise<void>;

  // 缓存更新
  update(key: string, updater: (value: any) => any): Promise<void>;

  // 缓存穿透保护
  protect(key: string, fn: () => Promise<any>): Promise<any>;
}