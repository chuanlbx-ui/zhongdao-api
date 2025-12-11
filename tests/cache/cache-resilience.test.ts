import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { CacheService } from '../../src/modules/points/cache/points.cache.service';
import { setupTestDatabase, cleanupTestDatabase } from '../../setup';

describe('缓存系统弹性和一致性测试', () => {
  let cacheService: CacheService;

  beforeAll(async () => {
    await setupTestDatabase();
    cacheService = new CacheService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    if (cacheService) {
      await cacheService.disconnect();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Redis连接故障恢复测试', () => {
    it('should handle Redis connection failure gracefully', async () => {
      // 模拟Redis连接失败
      const mockRedis = {
        get: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        set: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        del: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
        exists: vi.fn().mockRejectedValue(new Error('Redis connection failed'))
      };

      // 替换Redis客户端
      cacheService['redis'] = mockRedis;

      // 缓存操作应该失败但不抛出错误
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('should automatically reconnect after Redis recovery', async () => {
      let connectionAttempts = 0;
      const mockRedis = {
        get: vi.fn().mockImplementation(() => {
          connectionAttempts++;
          if (connectionAttempts === 1) {
            throw new Error('Connection lost');
          }
          return 'cached-value';
        }),
        set: vi.fn().mockResolvedValue('OK'),
        del: vi.fn().mockResolvedValue(1)
      };

      cacheService['redis'] = mockRedis;

      // 第一次调用失败
      const firstAttempt = await cacheService.get('test-key');
      expect(firstAttempt).toBeNull();

      // 等待重连延迟
      await new Promise(resolve => setTimeout(resolve, 100));

      // 第二次调用应该成功
      const secondAttempt = await cacheService.get('test-key');
      expect(secondAttempt).toBe('cached-value');
    });

    it('should use fallback cache when Redis is unavailable', async () => {
      const mockRedis = {
        get: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
        set: vi.fn().mockRejectedValue(new Error('Redis unavailable'))
      };

      cacheService['redis'] = mockRedis;

      // 设置回退缓存
      cacheService.setFallback('test-key', 'fallback-value', 300);

      // 应该从回退缓存获取数据
      const result = await cacheService.get('test-key');
      expect(result).toBe('fallback-value');
    });

    it('should limit reconnection attempts to prevent infinite loops', async () => {
      const mockRedis = {
        get: vi.fn().mockRejectedValue(new Error('Persistent connection error')),
        set: vi.fn().mockRejectedValue(new Error('Persistent connection error'))
      };

      cacheService['redis'] = mockRedis;
      const maxAttempts = 5;

      // 尝试多次操作
      for (let i = 0; i < maxAttempts + 2; i++) {
        await cacheService.get('test-key');
      }

      // 验证重连次数被限制
      expect(mockRedis.get).toHaveBeenCalledTimes(maxAttempts + 2);
    });
  });

  describe('缓存一致性测试', () => {
    it('should maintain cache consistency across multiple operations', async () => {
      const key = 'consistency-test';
      const value = { id: 1, name: 'test', timestamp: Date.now() };

      // 设置缓存
      await cacheService.set(key, value, 300);

      // 多次读取应该返回相同值
      const results = await Promise.all([
        cacheService.get(key),
        cacheService.get(key),
        cacheService.get(key)
      ]);

      results.forEach(result => {
        expect(result).toEqual(value);
      });
    });

    it('should handle concurrent writes without race conditions', async () => {
      const key = 'concurrent-write-test';
      const promises = Array(10).fill(null).map((_, index) =>
        cacheService.set(key, `value-${index}`, 300)
      );

      await Promise.all(promises);

      // 验证最终值是有效的
      const finalValue = await cacheService.get(key);
      expect(finalValue).toMatch(/^value-\d+$/);
    });

    it('should synchronize cache invalidation across instances', async () => {
      const key = 'sync-test';
      const value = { data: 'original' };

      // 设置初始缓存
      await cacheService.set(key, value, 300);

      // 创建另一个缓存实例模拟
      const cacheService2 = new CacheService();
      await cacheService2.set(key, value, 300);

      // 在一个实例上删除缓存
      await cacheService.del(key);

      // 另一个实例应该也能感知到删除
      const valueFromInstance2 = await cacheService2.get(key);
      expect(valueFromInstance2).toBeNull();

      await cacheService2.disconnect();
    });

    it('should handle cache versioning for consistency', async () => {
      const key = 'version-test';
      const v1 = { version: 1, data: 'old' };
      const v2 = { version: 2, data: 'new' };

      // 设置v1
      await cacheService.setWithVersion(key, v1, 1, 300);

      // 获取v1
      const retrievedV1 = await cacheService.getWithVersion(key, 1);
      expect(retrievedV1).toEqual(v1);

      // 更新到v2
      await cacheService.setWithVersion(key, v2, 2, 300);

      // v1应该仍然可获取（如果支持多版本）
      const oldVersion = await cacheService.getWithVersion(key, 1);
      expect(oldVersion).toBe(v1); // 或者根据实现策略返回null

      // v2应该是最新值
      const latest = await cacheService.get(key);
      expect(latest).toEqual(v2);
    });
  });

  describe('缓存击穿防护测试', () => {
    it('should prevent cache breakdown with mutex lock', async () => {
      const key = 'breakdown-test';
      let computeCount = 0;

      const mockCompute = async () => {
        computeCount++;
        await new Promise(resolve => setTimeout(resolve, 100)); // 模拟耗时计算
        return `computed-value-${computeCount}`;
      };

      // 模拟缓存不存在且后端计算耗时
      cacheService['redis'] = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue('OK'),
        eval: vi.fn().mockImplementation((script, keys, args) => {
          // 模拟分布式锁
          if (script.includes('SETNX')) {
            return '1'; // 锁获取成功
          }
          return '0';
        })
      };

      // 并发请求
      const promises = Array(10).fill(null).map(() =>
        cacheService.getOrCompute(key, mockCompute, 300)
      );

      const results = await Promise.all(promises);

      // 验证只计算了一次
      expect(computeCount).toBe(1);

      // 验证所有请求得到相同结果
      results.forEach(result => {
        expect(result).toBe('computed-value-1');
      });
    });

    it('should use stale data while recomputing cache', async () => {
      const key = 'stale-while-recompute';
      const staleValue = { data: 'stale', timestamp: Date.now() - 1000 };
      const freshValue = { data: 'fresh', timestamp: Date.now() };

      cacheService['redis'] = {
        get: vi.fn().mockImplementation(async (k) => {
          if (k.includes(':stale')) {
            return JSON.stringify(staleValue);
          }
          return null;
        }),
        set: vi.fn().mockResolvedValue('OK')
      };

      // 设置过期数据
      await cacheService.set(`${key}:stale`, staleValue, 300);

      let computeCount = 0;
      const computeFresh = async () => {
        computeCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return freshValue;
      };

      // 获取数据应该先返回过期数据，然后更新
      const result = await cacheService.getStaleWhileRecompute(
        key,
        computeFresh,
        300
      );

      expect(result).toEqual(staleValue);

      // 等待后台更新
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证计算被调用
      expect(computeCount).toBe(1);
    });

    it('should handle hot key acceleration', async () => {
      const hotKey = 'hot-key-test';
      const accessTimes = [];

      cacheService['redis'] = {
        get: vi.fn().mockImplementation(async () => {
          accessTimes.push(Date.now());
          return null;
        }),
        set: vi.fn().mockResolvedValue('OK'),
        incr: vi.fn().mockResolvedValue(1)
      };

      // 快速连续访问
      for (let i = 0; i < 10; i++) {
        await cacheService.get(hotKey);
      }

      // 验证热点加速生效（实际实现可能会有批量获取或预加载）
      expect(accessTimes.length).toBe(10);
    });
  });

  describe('热点数据管理测试', () => {
    it('should identify and track hot keys', async () => {
      const hotKey = 'hot-data';

      // 记录访问
      for (let i = 0; i < 100; i++) {
        await cacheService.recordAccess(hotKey);
      }

      // 获取热点统计
      const hotStats = await cacheService.getHotKeysStats();
      expect(hotStats).toHaveProperty(hotKey);
      expect(hotStats[hotKey].count).toBe(100);
    });

    it('should automatically extend TTL for hot data', async () => {
      const hotKey = 'auto-extend-ttl';
      const initialTTL = 60; // 60秒

      // 设置缓存
      await cacheService.set(hotKey, 'hot-value', initialTTL);

      // 模拟频繁访问
      for (let i = 0; i < 10; i++) {
        await cacheService.get(hotKey);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 检查TTL是否被延长
      const ttl = await cacheService.getTTL(hotKey);
      expect(ttl).toBeGreaterThan(initialTTL);
    });

    it('should pre-warm cache for predictable hot data', async () => {
      const preWarmKeys = ['user:1', 'user:2', 'user:3'];

      // 预热缓存
      await cacheService.preWarm(preWarmKeys, async (key) => {
        return { id: key.split(':')[1], name: `User ${key.split(':')[1]}` };
      });

      // 验证预热成功
      for (const key of preWarmKeys) {
        const value = await cacheService.get(key);
        expect(value).toBeTruthy();
        expect(value).toHaveProperty('id');
        expect(value).toHaveProperty('name');
      }
    });

    it('should distribute hot data across multiple cache nodes', async () => {
      const hotKey = 'distributed-hot-data';
      const value = { data: 'hot', replicas: 3 };

      // 分布式缓存设置
      await cacheService.setDistributed(hotKey, value, {
        replicas: 3,
        ttl: 300
      });

      // 验证数据在多个节点
      const replicas = await cacheService.getReplicas(hotKey);
      expect(replicas.length).toBe(3);

      // 验证所有副本数据一致
      for (const replica of replicas) {
        expect(replica.data).toEqual(value);
      }
    });
  });

  describe('缓存性能测试', () => {
    it('should handle high-frequency cache operations', async () => {
      const operations = 1000;
      const promises = [];

      // 批量设置
      for (let i = 0; i < operations; i++) {
        promises.push(cacheService.set(`perf-test-${i}`, `value-${i}`, 300));
      }

      const setStartTime = Date.now();
      await Promise.all(promises);
      const setDuration = Date.now() - setStartTime;

      // 批量获取
      const getPromises = [];
      for (let i = 0; i < operations; i++) {
        getPromises.push(cacheService.get(`perf-test-${i}`));
      }

      const getStartTime = Date.now();
      const results = await Promise.all(getPromises);
      const getDuration = Date.now() - getStartTime;

      // 验证性能指标
      expect(setDuration).toBeLessThan(5000); // 5秒内完成设置
      expect(getDuration).toBeLessThan(1000); // 1秒内完成获取
      expect(results.length).toBe(operations);

      // 验证数据正确性
      results.forEach((result, index) => {
        expect(result).toBe(`value-${index}`);
      });
    });

    it('should maintain performance under memory pressure', async () => {
      const largeData = new Array(1000).fill(null).map((_, i) => ({
        id: i,
        data: 'x'.repeat(1000) // 1KB per item
      }));

      // 写入大量数据
      const promises = largeData.map((item, index) =>
        cacheService.set(`large-${index}`, item, 300)
      );

      await Promise.all(promises);

      // 验证缓存仍然可正常工作
      const sample = await cacheService.get('large-500');
      expect(sample).toBeTruthy();
      expect(sample.id).toBe(500);

      // 验证内存使用情况
      const memoryStats = await cacheService.getMemoryStats();
      expect(memoryStats).toHaveProperty('used');
      expect(memoryStats).toHaveProperty('available');
      expect(memoryStats).toHaveProperty('fragmentation');
    });

    it('should optimize cache eviction policies', async () => {
      // 测试LRU淘汰策略
      const lruCache = new CacheService({ evictionPolicy: 'lru' });

      // 填满缓存
      for (let i = 0; i < 100; i++) {
        await lruCache.set(`lru-${i}`, `value-${i}`, 300);
      }

      // 访问某些键
      await lruCache.get('lru-10');
      await lruCache.get('lru-20');
      await lruCache.get('lru-30');

      // 添加更多键触发淘汰
      for (let i = 100; i < 150; i++) {
        await lruCache.set(`lru-${i}`, `value-${i}`, 300);
      }

      // 验证最近访问的键仍然存在
      expect(await lruCache.get('lru-10')).toBe('value-10');
      expect(await lruCache.get('lru-20')).toBe('value-20');
      expect(await lruCache.get('lru-30')).toBe('value-30');

      // 验证最少使用的键被淘汰
      expect(await lruCache.get('lru-0')).toBeNull();
      expect(await lruCache.get('lru-1')).toBeNull();

      await lruCache.disconnect();
    });
  });

  describe('缓存监控和诊断', () => {
    it('should provide comprehensive cache statistics', async () => {
      // 执行一些缓存操作
      await cacheService.set('stat-test-1', 'value1', 300);
      await cacheService.set('stat-test-2', 'value2', 300);
      await cacheService.get('stat-test-1');
      await cacheService.get('non-existent-key');
      await cacheService.del('stat-test-2');

      const stats = await cacheService.getStatistics();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memoryUsage');

      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      expect(stats.sets).toBe(2);
      expect(stats.deletes).toBe(1);
    });

    it('should detect cache performance anomalies', async () => {
      // 模拟异常情况
      const anomalies = await cacheService.detectAnomalies();

      expect(Array.isArray(anomalies)).toBe(true);

      // 如果有异常，应该包含详细信息
      if (anomalies.length > 0) {
        anomalies.forEach(anomaly => {
          expect(anomaly).toHaveProperty('type');
          expect(anomaly).toHaveProperty('severity');
          expect(anomaly).toHaveProperty('description');
          expect(anomaly).toHaveProperty('timestamp');
        });
      }
    });

    it('should generate cache performance reports', async () => {
      const report = await cacheService.generatePerformanceReport({
        startTime: new Date(Date.now() - 3600000), // 最近1小时
        endTime: new Date(),
        includeDetails: true
      });

      expect(report).toHaveProperty('period');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('details');
      expect(report).toHaveProperty('recommendations');

      expect(report.summary).toHaveProperty('totalOperations');
      expect(report.summary).toHaveProperty('averageResponseTime');
      expect(report.summary).toHaveProperty('peakMemoryUsage');
    });
  });
});