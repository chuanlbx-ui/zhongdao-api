/**
 * 供应链缓存服务
 * 提供高性能的多层缓存机制，支持LRU、LFU、TTL等多种缓存策略
 * 包含智能预加载、缓存预热、内存监控等高级功能
 */

import { logger } from '@/shared/utils/logger';
import {
  CacheEntry,
  CacheStats,
  CacheConfig,
  SupplyChainError,
  SupplyChainErrorType
} from './types';

export class SupplyChainCacheService<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();  // LRU访问顺序
  private frequencyOrder = new Map<string, number>(); // LFU访问频率
  private stats: CacheStats;
  private config: CacheConfig;
  private lastCleanupTime = Date.now();
  private accessCounter = 0;

  // 内存监控
  private memoryThreshold = 0.8; // 80%内存使用率阈值
  private currentMemoryUsage = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 10000,
      maxMemory: 100 * 1024 * 1024, // 100MB
      defaultTtl: 300000, // 5分钟
      evictionPolicy: 'LRU',
      enableStats: true,
      compressionEnabled: false,
      backgroundCleanup: true,
      cleanupInterval: 60000, // 1分钟
      cleanupBatchSize: 100,
      ...config
    };

    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      averageAccessTime: 0,
      memoryUsage: 0,
      windowStats: {
        hits: 0,
        misses: 0,
        evictions: 0,
        startTime: new Date()
      }
    };

    // 启动后台清理
    if (this.config.backgroundCleanup) {
      this.startBackgroundCleanup();
    }

    // 启动内存监控
    this.startMemoryMonitoring();
  }

  /**
   * 设置缓存
   */
  set(key: string, value: T, customTtl?: number): void {
    const startTime = process.hrtime.bigint();
    const ttl = customTtl || this.config.defaultTtl;
    const size = this.calculateSize(value);

    // 检查内存限制
    if (this.shouldEvictBeforeInsert(size)) {
      this.evictEntries(size);
    }

    // 压缩数据（如果启用）
    const processedValue = this.config.compressionEnabled ? this.compress(value) : value;

    const entry: CacheEntry<T> = {
      key,
      value: processedValue,
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      ttl,
      size: this.config.compressionEnabled ? this.calculateSize(processedValue) : size
    };

    // 如果键已存在，先删除旧条目
    if (this.cache.has(key)) {
      this.delete(key);
    }

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.updateFrequencyOrder(key);

    this.updateStats('set');
    this.currentMemoryUsage += entry.size;

    logger.debug('缓存设置成功', { key, size: entry.size, ttl });
  }

  /**
   * 获取缓存
   */
  get(key: string): T | null {
    const startTime = process.hrtime.bigint();

    const entry = this.cache.get(key);
    if (!entry) {
      this.updateStats('miss');
      this.stats.windowStats.misses++;
      return null;
    }

    // 检查TTL
    if (this.isExpired(entry)) {
      this.delete(key);
      this.updateStats('miss');
      this.stats.windowStats.misses++;
      return null;
    }

    // 更新访问信息
    entry.lastAccessed = new Date();
    entry.accessCount++;
    this.updateAccessOrder(key);
    this.updateFrequencyOrder(key);

    // 解压缩数据（如果需要）
    const value = this.config.compressionEnabled ? this.decompress(entry.value) : entry.value;

    this.updateStats('hit');
    this.stats.windowStats.hits++;

    const endTime = process.hrtime.bigint();
    const accessTime = Number(endTime - startTime) / 1000000; // 转换为毫秒
    this.updateAccessTime(accessTime);

    logger.debug('缓存命中', { key, accessTime: `${accessTime.toFixed(3)}ms` });

    return value;
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.currentMemoryUsage -= entry.size;
    this.cache.delete(key);
    this.accessOrder.delete(key);
    this.frequencyOrder.delete(key);

    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = this.currentMemoryUsage;

    return true;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    const clearedCount = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.frequencyOrder.clear();
    this.currentMemoryUsage = 0;

    this.stats.totalEntries = 0;
    this.stats.totalSize = 0;

    logger.info('缓存已清空', { clearedCount });
  }

  /**
   * 批量设置
   */
  mset(entries: Array<{ key: string; value: T; ttl?: number }>): void {
    for (const { key, value, ttl } of entries) {
      this.set(key, value, ttl);
    }
  }

  /**
   * 批量获取
   */
  mget(keys: string[]): Array<{ key: string; value: T | null }> {
    return keys.map(key => ({
      key,
      value: this.get(key)
    }));
  }

  /**
   * 获取或设置（如果不存在）
   */
  getOrSet(key: string, valueFactory: () => T | Promise<T>, ttl?: number): T | Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = valueFactory();
    if (value instanceof Promise) {
      return value.then(v => {
        this.set(key, v, ttl);
        return v;
      });
    } else {
      this.set(key, value, ttl);
      return value;
    }
  }

  /**
   * 预热缓存
   */
  async warmup(dataProvider: Array<{ key: string; valueFactory: () => T | Promise<T>; ttl?: number }>): Promise<void> {
    logger.info(`开始缓存预热，数据项数量: ${dataProvider.length}`);

    const startTime = Date.now();
    const promises = dataProvider.map(async ({ key, valueFactory, ttl }) => {
      try {
        const value = await valueFactory();
        this.set(key, value, ttl);
      } catch (error) {
        logger.error('缓存预热失败', { key, error: error instanceof Error ? error.message : '未知错误' });
      }
    });

    await Promise.allSettled(promises);

    const warmupTime = Date.now() - startTime;
    logger.info(`缓存预热完成，耗时: ${warmupTime}ms`);
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    this.updateDerivedStats();
    return { ...this.stats };
  }

  /**
   * 获取缓存键列表
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取内存使用量
   */
  getMemoryUsage(): number {
    return this.currentMemoryUsage;
  }

  /**
   * 检查是否需要驱逐条目
   */
  private shouldEvictBeforeInsert(newEntrySize: number): boolean {
    return (
      this.cache.size >= this.config.maxSize ||
      this.currentMemoryUsage + newEntrySize >= this.config.maxMemory ||
      this.getMemoryUsageRatio() >= this.memoryThreshold
    );
  }

  /**
   * 驱逐缓存条目
   */
  private evictEntries(requiredSpace: number): void {
    const entriesToEvict = this.selectEntriesForEviction(requiredSpace);
    let freedSpace = 0;

    for (const key of entriesToEvict) {
      const entry = this.cache.get(key);
      if (entry) {
        freedSpace += entry.size;
        this.delete(key);
        this.stats.evictionCount++;
        this.stats.windowStats.evictions++;
      }

      if (freedSpace >= requiredSpace) break;
    }

    logger.debug('缓存驱逐完成', {
      evictedCount: entriesToEvict.length,
      freedSpace,
      requiredSpace
    });
  }

  /**
   * 根据策略选择要驱逐的条目
   */
  private selectEntriesForEviction(requiredSpace: number): string[] {
    const entries = Array.from(this.cache.entries());
    let sortedEntries: Array<[string, CacheEntry<T>]> = [];

    switch (this.config.evictionPolicy) {
      case 'LRU':
        sortedEntries = entries.sort((a, b) =>
          a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
        );
        break;

      case 'LFU':
        sortedEntries = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;

      case 'TTL':
        sortedEntries = entries.sort((a, b) =>
          (a[1].createdAt.getTime() + a[1].ttl) - (b[1].createdAt.getTime() + b[1].ttl)
        );
        break;

      case 'SIZE_BASED':
        sortedEntries = entries.sort((a, b) => b[1].size - a[1].size);
        break;

      default:
        sortedEntries = entries.sort((a, b) =>
          a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime()
        );
    }

    return sortedEntries.map(([key]) => key);
  }

  /**
   * 检查条目是否过期
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt.getTime() > entry.ttl;
  }

  /**
   * 更新访问顺序（LRU）
   */
  private updateAccessOrder(key: string): void {
    this.accessOrder.set(key, ++this.accessCounter);
  }

  /**
   * 更新访问频率（LFU）
   */
  private updateFrequencyOrder(key: string): void {
    const currentFreq = this.frequencyOrder.get(key) || 0;
    this.frequencyOrder.set(key, currentFreq + 1);
  }

  /**
   * 计算对象大小
   */
  private calculateSize(obj: any): number {
    try {
      return JSON.stringify(obj).length * 2; // 粗略估算，每个字符2字节
    } catch {
      return 1024; // 默认1KB
    }
  }

  /**
   * 压缩数据
   */
  private compress(data: T): T {
    // 简化实现，实际可以使用 zlib 等压缩库
    return data;
  }

  /**
   * 解压缩数据
   */
  private decompress(data: T): T {
    // 简化实现
    return data;
  }

  /**
   * 更新统计信息
   */
  private updateStats(operation: 'set' | 'hit' | 'miss'): void {
    if (!this.config.enableStats) return;

    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = this.currentMemoryUsage;
    this.stats.memoryUsage = this.currentMemoryUsage;

    // 计算窗口统计
    const total = this.stats.windowStats.hits + this.stats.windowStats.misses;
    if (total > 0) {
      this.stats.hitRate = this.stats.windowStats.hits / total;
      this.stats.missRate = this.stats.windowStats.misses / total;
    }
  }

  /**
   * 更新派生统计信息
   */
  private updateDerivedStats(): void {
    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = this.currentMemoryUsage;
    this.stats.memoryUsage = this.currentMemoryUsage;

    // 重置窗口统计（如果时间窗口过长）
    const windowDuration = Date.now() - this.stats.windowStats.startTime.getTime();
    if (windowDuration > 300000) { // 5分钟窗口
      this.stats.windowStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        startTime: new Date()
      };
    }
  }

  /**
   * 更新访问时间统计
   */
  private updateAccessTime(accessTime: number): void {
    const alpha = 0.1; // 平滑因子
    this.stats.averageAccessTime = this.stats.averageAccessTime * (1 - alpha) + accessTime * alpha;
  }

  /**
   * 获取内存使用率
   */
  private getMemoryUsageRatio(): number {
    return this.currentMemoryUsage / this.config.maxMemory;
  }

  /**
   * 启动后台清理
   */
  private startBackgroundCleanup(): void {
    setInterval(() => {
      this.performBackgroundCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 执行后台清理
   */
  private async performBackgroundCleanup(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupTime < this.config.cleanupInterval) return;

    logger.debug('开始后台缓存清理');
    const startTime = Date.now();

    let cleanedCount = 0;
    const keys = Array.from(this.cache.keys());
    const batchSize = Math.min(this.config.cleanupBatchSize, keys.length);

    for (let i = 0; i < batchSize; i++) {
      const key = keys[i];
      const entry = this.cache.get(key);

      if (entry && this.isExpired(entry)) {
        this.delete(key);
        cleanedCount++;
      }

      // 避免阻塞主线程
      if (i % 100 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    const cleanupTime = Date.now() - startTime;
    this.lastCleanupTime = now;

    if (cleanedCount > 0) {
      logger.debug('后台缓存清理完成', {
        cleanedCount,
        cleanupTime: `${cleanupTime}ms`,
        remainingEntries: this.cache.size
      });
    }
  }

  /**
   * 启动内存监控
   */
  private startMemoryMonitoring(): void {
    setInterval(() => {
      this.monitorMemoryUsage();
    }, 30000); // 每30秒检查一次
  }

  /**
   * 监控内存使用
   */
  private monitorMemoryUsage(): void {
    const usageRatio = this.getMemoryUsageRatio();

    if (usageRatio > this.memoryThreshold) {
      logger.warn('缓存内存使用率过高', {
        usageRatio: `${(usageRatio * 100).toFixed(2)}%`,
        threshold: `${(this.memoryThreshold * 100).toFixed(2)}%`,
        currentUsage: `${(this.currentMemoryUsage / 1024 / 1024).toFixed(2)}MB`,
        maxUsage: `${(this.config.maxMemory / 1024 / 1024).toFixed(2)}MB`
      });

      // 触发紧急清理
      this.emergencyCleanup();
    }
  }

  /**
   * 紧急清理
   */
  private emergencyCleanup(): void {
    logger.info('执行紧急缓存清理');

    // 清理所有过期条目
    const keys = Array.from(this.cache.keys());
    let cleanedCount = 0;

    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && this.isExpired(entry)) {
        this.delete(key);
        cleanedCount++;
      }
    }

    // 如果内存使用仍然过高，强制驱逐一些条目
    if (this.getMemoryUsageRatio() > this.memoryThreshold) {
      const additionalCleanup = Math.floor(this.cache.size * 0.2); // 清理20%的条目
      const entriesToEvict = this.selectEntriesForEviction(0).slice(0, additionalCleanup);

      for (const key of entriesToEvict) {
        this.delete(key);
        cleanedCount++;
      }
    }

    logger.info('紧急缓存清理完成', {
      cleanedCount,
      remainingEntries: this.cache.size,
      memoryUsageRatio: `${(this.getMemoryUsageRatio() * 100).toFixed(2)}%`
    });
  }

  /**
   * 导出缓存数据
   */
  export(): Array<{ key: string; value: T; ttl: number }> {
    const exported: Array<{ key: string; value: T; ttl: number }> = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        const value = this.config.compressionEnabled ? this.decompress(entry.value) : entry.value;
        exported.push({
          key,
          value,
          ttl: entry.ttl
        });
      }
    }

    return exported;
  }

  /**
   * 导入缓存数据
   */
  import(data: Array<{ key: string; value: T; ttl?: number }>): void {
    this.clear();

    for (const { key, value, ttl } of data) {
      this.set(key, value, ttl);
    }

    logger.info('缓存数据导入完成', { importedCount: data.length });
  }

  /**
   * 健康检查
   */
  healthCheck(): {
    healthy: boolean;
    issues: string[];
    stats: CacheStats;
  } {
    const issues: string[] = [];

    // 检查内存使用
    if (this.getMemoryUsageRatio() > 0.9) {
      issues.push('内存使用率过高 (>90%)');
    }

    // 检查命中率
    if (this.stats.hitRate < 0.5 && this.stats.windowStats.hits + this.stats.windowStats.misses > 100) {
      issues.push('缓存命中率过低 (<50%)');
    }

    // 检查驱逐频率
    if (this.stats.evictionCount > this.stats.totalEntries * 2) {
      issues.push('缓存驱逐频率过高');
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats: this.getStats()
    };
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    this.clear();
    logger.info('缓存服务已销毁');
  }
}

/**
 * 缓存管理器 - 管理多个缓存实例
 */
export class CacheManager {
  private caches = new Map<string, SupplyChainCacheService>();

  /**
   * 创建或获取缓存实例
   */
  getCache<T = any>(name: string, config?: Partial<CacheConfig>): SupplyChainCacheService<T> {
    if (!this.caches.has(name)) {
      this.caches.set(name, new SupplyChainCacheService<T>(config));
    }

    return this.caches.get(name) as SupplyChainCacheService<T>;
  }

  /**
   * 删除缓存实例
   */
  deleteCache(name: string): boolean {
    const cache = this.caches.get(name);
    if (cache) {
      cache.destroy();
      return this.caches.delete(name);
    }
    return false;
  }

  /**
   * 清空所有缓存
   */
  clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * 获取所有缓存统计
   */
  getAllStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};

    for (const [name, cache] of this.caches.entries()) {
      stats[name] = cache.getStats();
    }

    return stats;
  }

  /**
   * 健康检查所有缓存
   */
  healthCheckAll(): Record<string, { healthy: boolean; issues: string[] }> {
    const results: Record<string, { healthy: boolean; issues: string[] }> = {};

    for (const [name, cache] of this.caches.entries()) {
      const check = cache.healthCheck();
      results[name] = {
        healthy: check.healthy,
        issues: check.issues
      };
    }

    return results;
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    for (const cache of this.caches.values()) {
      cache.destroy();
    }
    this.caches.clear();
  }
}

// 导出全局缓存管理器实例
export const cacheManager = new CacheManager();

// 导出常用缓存实例
export const pathCache = cacheManager.getCache('paths', {
  maxSize: 5000,
  maxMemory: 50 * 1024 * 1024, // 50MB
  defaultTtl: 300000, // 5分钟
  evictionPolicy: 'LRU'
});

export const priceCache = cacheManager.getCache('prices', {
  maxSize: 10000,
  maxMemory: 20 * 1024 * 1024, // 20MB
  defaultTtl: 600000, // 10分钟
  evictionPolicy: 'LFU'
});

export const inventoryCache = cacheManager.getCache('inventory', {
  maxSize: 3000,
  maxMemory: 30 * 1024 * 1024, // 30MB
  defaultTtl: 120000, // 2分钟
  evictionPolicy: 'TTL'
});