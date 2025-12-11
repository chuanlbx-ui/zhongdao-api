import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SupplyChainCacheService, CacheManager, cacheManager, pathCache, priceCache, inventoryCache } from '../../../src/modules/supply-chain/cache.service';
import { logger } from '@/shared/utils/logger';
import type { CacheConfig, CacheStats } from '../../../src/modules/supply-chain/types';

// Mock dependencies
vi.mock('@/shared/utils/logger');

const mockLogger = logger as any;

describe('SupplyChainCacheService', () => {
  let cache: SupplyChainCacheService<string>;

  beforeEach(() => {
    // Create a new cache instance for each test
    cache = new SupplyChainCacheService<string>({
      maxSize: 10,
      maxMemory: 1024 * 1024, // 1MB
      defaultTtl: 60000, // 1 minute
      enableStats: true,
      backgroundCleanup: false // Disable background cleanup for tests
    });

    vi.clearAllMocks();
    mockLogger.debug = vi.fn();
    mockLogger.info = vi.fn();
    mockLogger.warn = vi.fn();
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('基础操作', () => {
    it('应该能够设置和获取缓存', () => {
      // Arrange
      const key = 'test-key';
      const value = 'test-value';

      // Act
      cache.set(key, value);
      const result = cache.get(key);

      // Assert
      expect(result).toBe(value);
      expect(cache.has(key)).toBe(true);
      expect(cache.size()).toBe(1);
    });

    it('应该返回null对于不存在的键', () => {
      // Act
      const result = cache.get('non-existent-key');

      // Assert
      expect(result).toBeNull();
      expect(cache.has('non-existent-key')).toBe(false);
    });

    it('应该能够删除缓存', () => {
      // Arrange
      const key = 'test-key';
      cache.set(key, 'value');

      // Act
      const deleted = cache.delete(key);

      // Assert
      expect(deleted).toBe(true);
      expect(cache.has(key)).toBe(false);
      expect(cache.get(key)).toBeNull();
    });

    it('应该能够清空所有缓存', () => {
      // Arrange
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Act
      cache.clear();

      // Assert
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        '缓存已清空',
        { clearedCount: 3 }
      );
    });

    it('应该能够获取所有键', () => {
      // Arrange
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Act
      const keys = cache.keys();

      // Assert
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });
  });

  describe('TTL（生存时间）', () => {
    beforeEach(() => {
      // Mock Date.now to control time
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该在TTL过期后返回null', () => {
      // Arrange
      cache.set('key', 'value', 1000); // 1 second TTL

      // Act
      let result = cache.get('key');
      expect(result).toBe('value');

      // Fast forward time
      vi.advanceTimersByTime(1500);

      // Assert
      result = cache.get('key');
      expect(result).toBeNull();
      expect(cache.has('key')).toBe(false);
    });

    it('应该支持自定义TTL', () => {
      // Arrange
      cache.set('key1', 'value1', 5000); // 5 seconds
      cache.set('key2', 'value2', 10000); // 10 seconds

      // Act
      vi.advanceTimersByTime(6000);

      // Assert
      expect(cache.get('key1')).toBeNull(); // Should be expired
      expect(cache.get('key2')).toBe('value2'); // Should still exist
    });
  });

  describe('批量操作', () => {
    it('应该支持批量设置', () => {
      // Arrange
      const entries = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2', ttl: 5000 },
        { key: 'key3', value: 'value3' }
      ];

      // Act
      cache.mset(entries);

      // Assert
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.size()).toBe(3);
    });

    it('应该支持批量获取', () => {
      // Arrange
      cache.set('key1', 'value1');
      cache.set('key3', 'value3');

      // Act
      const results = cache.mget(['key1', 'key2', 'key3', 'key4']);

      // Assert
      expect(results).toHaveLength(4);
      expect(results[0]).toEqual({ key: 'key1', value: 'value1' });
      expect(results[1]).toEqual({ key: 'key2', value: null });
      expect(results[2]).toEqual({ key: 'key3', value: 'value3' });
      expect(results[3]).toEqual({ key: 'key4', value: null });
    });
  });

  describe('getOrSet', () => {
    it('应该返回现有值如果存在', () => {
      // Arrange
      cache.set('key', 'existing-value');

      // Act
      const valueFactory = vi.fn(() => 'new-value');
      const result = cache.getOrSet('key', valueFactory);

      // Assert
      expect(result).toBe('existing-value');
      expect(valueFactory).not.toHaveBeenCalled();
    });

    it('应该设置新值如果不存在', () => {
      // Arrange
      const valueFactory = vi.fn(() => 'new-value');

      // Act
      const result = cache.getOrSet('key', valueFactory);

      // Assert
      expect(result).toBe('new-value');
      expect(valueFactory).toHaveBeenCalled();
      expect(cache.get('key')).toBe('new-value');
    });

    it('应该支持异步值工厂', async () => {
      // Arrange
      const asyncValueFactory = vi.fn(async () => 'async-value');

      // Act
      const result = await cache.getOrSet('key', asyncValueFactory);

      // Assert
      expect(result).toBe('async-value');
      expect(asyncValueFactory).toHaveBeenCalled();
      expect(cache.get('key')).toBe('async-value');
    });
  });

  describe('缓存预热', () => {
    it('应该支持缓存预热', async () => {
      // Arrange
      const dataProvider = [
        { key: 'key1', valueFactory: () => 'value1' },
        { key: 'key2', valueFactory: async () => 'value2' },
        { key: 'key3', valueFactory: () => 'value3', ttl: 5000 }
      ];

      // Act
      await cache.warmup(dataProvider);

      // Assert
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '开始缓存预热，数据项数量: 3'
      );
    });

    it('应该处理预热失败', async () => {
      // Arrange
      const dataProvider = [
        { key: 'key1', valueFactory: () => 'value1' },
        { key: 'key2', valueFactory: () => { throw new Error('Failed'); } },
        { key: 'key3', valueFactory: () => 'value3' }
      ];

      // Act
      await cache.warmup(dataProvider);

      // Assert
      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeNull(); // Failed to load
      expect(cache.get('key3')).toBe('value3');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '缓存预热失败',
        expect.objectContaining({
          key: 'key2'
        })
      );
    });
  });

  describe('驱逐策略', () => {
    beforeEach(() => {
      // Create cache with smaller size for testing
      cache = new SupplyChainCacheService<string>({
        maxSize: 3,
        maxMemory: 1024,
        defaultTtl: 60000,
        evictionPolicy: 'LRU',
        backgroundCleanup: false
      });
    });

    it('应该在达到最大大小时驱逐条目（LRU）', () => {
      // Arrange
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Act - Add new entry, should evict key2 (least recently used)
      cache.set('key4', 'value4');

      // Assert
      expect(cache.has('key1')).toBe(true); // Recently accessed
      expect(cache.has('key2')).toBe(false); // Should be evicted
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
      expect(cache.size()).toBe(3);
    });

    it('应该支持LFU驱逐策略', () => {
      // Arrange
      const lfuCache = new SupplyChainCacheService<string>({
        maxSize: 3,
        evictionPolicy: 'LFU',
        backgroundCleanup: false
      });

      lfuCache.set('key1', 'value1');
      lfuCache.set('key2', 'value2');
      lfuCache.set('key3', 'value3');

      // Access key1 multiple times
      lfuCache.get('key1');
      lfuCache.get('key1');
      lfuCache.get('key1');

      // Access key2 once
      lfuCache.get('key2');

      // Act - Add new entry, should evict key3 (least frequently used)
      lfuCache.set('key4', 'value4');

      // Assert
      expect(lfuCache.has('key1')).toBe(true); // Most frequent
      expect(lfuCache.has('key2')).toBe(true);
      expect(lfuCache.has('key3')).toBe(false); // Least frequent
      expect(lfuCache.has('key4')).toBe(true);

      lfuCache.destroy();
    });

    it('应该支持TTL驱逐策略', () => {
      vi.useFakeTimers();

      try {
        // Arrange
        const ttlCache = new SupplyChainCacheService<string>({
          maxSize: 3,
          evictionPolicy: 'TTL',
          backgroundCleanup: false
        });

        ttlCache.set('key1', 'value1', 1000);
        ttlCache.set('key2', 'value2', 2000);
        ttlCache.set('key3', 'value3', 3000);

        // Fast forward time
        vi.advanceTimersByTime(1500);

        // Act - Add new entry, should evict key1 (expired)
        ttlCache.set('key4', 'value4');

        // Assert
        expect(ttlCache.has('key1')).toBe(false); // Expired
        expect(ttlCache.has('key2')).toBe(true);
        expect(ttlCache.has('key3')).toBe(true);
        expect(ttlCache.has('key4')).toBe(true);

        ttlCache.destroy();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('统计信息', () => {
    it('应该跟踪缓存命中和未命中', () => {
      // Arrange
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // Act
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // hit
      cache.get('non-existent'); // miss
      cache.get('another-missing'); // miss

      const stats = cache.getStats();

      // Assert
      expect(stats.windowStats.hits).toBe(3);
      expect(stats.windowStats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.6); // 3 / (3 + 2)
      expect(stats.missRate).toBe(0.4);
    });

    it('应该跟踪内存使用', () => {
      // Arrange
      const largeValue = 'x'.repeat(1000);
      cache.set('key1', largeValue);
      cache.set('key2', largeValue);

      // Act
      const stats = cache.getStats();
      const memoryUsage = cache.getMemoryUsage();

      // Assert
      expect(stats.memoryUsage).toBe(memoryUsage);
      expect(stats.totalSize).toBe(memoryUsage);
      expect(stats.totalEntries).toBe(2);
      expect(memoryUsage).toBeGreaterThan(0);
    });

    it('应该跟踪驱逐次数', () => {
      // Arrange
      const smallCache = new SupplyChainCacheService<string>({
        maxSize: 2,
        backgroundCleanup: false
      });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3'); // Should trigger eviction

      // Act
      const stats = smallCache.getStats();

      // Assert
      expect(stats.windowStats.evictions).toBeGreaterThan(0);
      expect(stats.evictionCount).toBeGreaterThan(0);

      smallCache.destroy();
    });
  });

  describe('内存管理', () => {
    it('应该在内存限制下驱逐条目', () => {
      // Arrange
      const memoryCache = new SupplyChainCacheService<string>({
        maxMemory: 100, // Very small memory limit
        backgroundCleanup: false
      });

      // Act - Try to add large values
      memoryCache.set('key1', 'x'.repeat(50));
      memoryCache.set('key2', 'x'.repeat(50));
      memoryCache.set('key3', 'x'.repeat(50)); // Should trigger eviction

      // Assert
      expect(memoryCache.size()).toBeLessThanOrEqual(2);
      expect(memoryCache.getMemoryUsage()).toBeLessThanOrEqual(100);

      memoryCache.destroy();
    });

    it('应该执行紧急清理', () => {
      // Arrange
      cache['currentMemoryUsage'] = cache['config'].maxMemory * 0.95; // 95% usage

      // Act
      cache['emergencyCleanup']();

      // Assert
      expect(cache.getMemoryUsage()).toBeLessThan(cache['config'].maxMemory * 0.8);
    });
  });

  describe('数据导入导出', () => {
    it('应该能够导出缓存数据', () => {
      // Arrange
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Act
      const exported = cache.export();

      // Assert
      expect(exported).toHaveLength(3);
      expect(exported).toContainEqual({ key: 'key1', value: 'value1', ttl: 60000 });
      expect(exported).toContainEqual({ key: 'key2', value: 'value2', ttl: 60000 });
      expect(exported).toContainEqual({ key: 'key3', value: 'value3', ttl: 60000 });
    });

    it('应该能够导入缓存数据', () => {
      // Arrange
      const data = [
        { key: 'imported1', value: 'value1', ttl: 5000 },
        { key: 'imported2', value: 'value2' },
        { key: 'imported3', value: 'value3', ttl: 10000 }
      ];

      // Act
      cache.import(data);

      // Assert
      expect(cache.get('imported1')).toBe('value1');
      expect(cache.get('imported2')).toBe('value2');
      expect(cache.get('imported3')).toBe('value3');
      expect(cache.size()).toBe(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '缓存数据导入完成',
        { importedCount: 3 }
      );
    });
  });

  describe('健康检查', () => {
    it('应该通过健康检查', () => {
      // Arrange
      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('non-existent'); // Miss

      // Act
      const health = cache.healthCheck();

      // Assert
      expect(health.healthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      expect(health.stats).toBeDefined();
    });

    it('应该检测内存使用率过高', () => {
      // Arrange
      cache['currentMemoryUsage'] = cache['config'].maxMemory * 0.95;

      // Act
      const health = cache.healthCheck();

      // Assert
      expect(health.healthy).toBe(false);
      expect(health.issues).toContain('内存使用率过高 (>90%)');
    });

    it('应该检测命中率过低', () => {
      // Arrange
      // Create low hit rate
      for (let i = 0; i < 150; i++) {
        cache.get(`miss-${i}`);
      }
      // Only 1 hit
      cache.set('hit', 'value');
      cache.get('hit');

      // Act
      const health = cache.healthCheck();

      // Assert
      expect(health.healthy).toBe(false);
      expect(health.issues).toContain('缓存命中率过低 (<50%)');
    });
  });

  describe('压缩功能', () => {
    it('应该支持数据压缩', () => {
      // Arrange
      const compressingCache = new SupplyChainCacheService<string>({
        compressionEnabled: true,
        backgroundCleanup: false
      });

      // Act
      compressingCache.set('key', 'value');
      const result = compressingCache.get('key');

      // Assert
      expect(result).toBe('value');
      expect(compressingCache.getStats().totalSize).toBeGreaterThan(0);

      compressingCache.destroy();
    });
  });

  describe('后台清理', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('应该执行后台清理', async () => {
      // Arrange
      const cacheWithCleanup = new SupplyChainCacheService<string>({
        defaultTtl: 1000,
        backgroundCleanup: true,
        cleanupInterval: 500
      });

      cacheWithCleanup.set('key1', 'value1');
      cacheWithCleanup.set('key2', 'value2', 2000); // Longer TTL

      // Act - Fast forward time
      vi.advanceTimersByTime(1500);

      // Wait a bit for async cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert
      expect(cacheWithCleanup.has('key1')).toBe(false); // Should be cleaned up
      expect(cacheWithCleanup.has('key2')).toBe(true); // Should still exist

      cacheWithCleanup.destroy();
    });
  });
});

describe('CacheManager', () => {
  let manager: CacheManager;

  beforeEach(() => {
    manager = new CacheManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('应该创建和管理多个缓存实例', () => {
    // Act
    const cache1 = manager.getCache('cache1');
    const cache2 = manager.getCache('cache2');

    // Assert
    expect(cache1).toBeInstanceOf(SupplyChainCacheService);
    expect(cache2).toBeInstanceOf(SupplyChainCacheService);
    expect(cache1).not.toBe(cache2); // Should be different instances

    // Should return same instance on subsequent calls
    const cache1Again = manager.getCache('cache1');
    expect(cache1Again).toBe(cache1);
  });

  it('应该支持自定义配置', () => {
    // Act
    const cache = manager.getCache('custom', {
      maxSize: 500,
      evictionPolicy: 'LFU'
    });

    // Assert
    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(0);
    // Note: We can't directly access config to verify, but cache should work
    cache.set('test', 'value');
    expect(cache.get('test')).toBe('value');
  });

  it('应该能够删除缓存实例', () => {
    // Arrange
    const cache = manager.getCache('temp');
    cache.set('key', 'value');

    // Act
    const deleted = manager.deleteCache('temp');

    // Assert
    expect(deleted).toBe(true);
    expect(manager.deleteCache('non-existent')).toBe(false);
  });

  it('应该清空所有缓存', () => {
    // Arrange
    const cache1 = manager.getCache('cache1');
    const cache2 = manager.getCache('cache2');
    cache1.set('key1', 'value1');
    cache2.set('key2', 'value2');

    // Act
    manager.clearAll();

    // Assert
    expect(cache1.size()).toBe(0);
    expect(cache2.size()).toBe(0);
  });

  it('应该获取所有缓存统计', () => {
    // Arrange
    const cache1 = manager.getCache('cache1');
    const cache2 = manager.getCache('cache2');
    cache1.set('key1', 'value1');
    cache2.set('key2', 'value2');
    cache1.get('key1'); // Hit
    cache2.get('miss'); // Miss

    // Act
    const stats = manager.getAllStats();

    // Assert
    expect(stats).toHaveProperty('cache1');
    expect(stats).toHaveProperty('cache2');
    expect(stats.cache1.totalEntries).toBe(1);
    expect(stats.cache2.totalEntries).toBe(1);
  });

  it('应该执行所有缓存的健康检查', () => {
    // Arrange
    const cache1 = manager.getCache('cache1');
    const cache2 = manager.getCache('cache2');

    // Act
    const results = manager.healthCheckAll();

    // Assert
    expect(results).toHaveProperty('cache1');
    expect(results).toHaveProperty('cache2');
    expect(results.cache1.healthy).toBe(true);
    expect(results.cache2.healthy).toBe(true);
    expect(results.cache1.issues).toEqual([]);
    expect(results.cache2.issues).toEqual([]);
  });
});

describe('预定义缓存实例', () => {
  it('应该导出预定义的缓存实例', () => {
    // Assert
    expect(pathCache).toBeInstanceOf(SupplyChainCacheService);
    expect(priceCache).toBeInstanceOf(SupplyChainCacheService);
    expect(inventoryCache).toBeInstanceOf(SupplyChainCacheService);
  });

  it('应该能够使用预定义的缓存实例', () => {
    // Act
    pathCache.set('path-1', 'path-data-1');
    priceCache.set('price-1', 'price-data-1');
    inventoryCache.set('inventory-1', 'inventory-data-1');

    // Assert
    expect(pathCache.get('path-1')).toBe('path-data-1');
    expect(priceCache.get('price-1')).toBe('price-data-1');
    expect(inventoryCache.get('inventory-1')).toBe('inventory-data-1');

    // Clean up
    pathCache.clear();
    priceCache.clear();
    inventoryCache.clear();
  });
});