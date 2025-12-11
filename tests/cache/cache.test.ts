/**
 * 缓存系统测试
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cacheManager } from '../../src/shared/cache/CacheManager';
import { cacheMonitor } from '../../src/shared/cache/monitor/CacheMonitor';
import { UserCacheService } from '../../src/modules/users/cache';
import { ProductCacheService } from '../../src/modules/products/cache';

describe('缓存系统测试', () => {
  beforeAll(async () => {
    // 初始化缓存
    await cacheManager.connect();
    await cacheMonitor.startMonitoring();
  });

  afterAll(async () => {
    // 清理
    cacheMonitor.stopMonitoring();
    await cacheManager.flush();
    await cacheManager.disconnect();
  });

  beforeEach(async () => {
    // 每个测试前清理
    await cacheManager.flush();
  });

  describe('基础缓存操作', () => {
    it('应该能够设置和获取缓存', async () => {
      await cacheManager.set('test:key', { value: 'test' });
      const result = await cacheManager.get('test:key');
      expect(result).toEqual({ value: 'test' });
    });

    it('应该能够处理不存在的键', async () => {
      const result = await cacheManager.get('nonexistent:key');
      expect(result).toBeNull();
    });

    it('应该能够删除缓存', async () => {
      await cacheManager.set('test:key', { value: 'test' });
      await cacheManager.del('test:key');
      const result = await cacheManager.get('test:key');
      expect(result).toBeNull();
    });

    it('应该支持TTL过期', async () => {
      await cacheManager.set('test:ttl', { value: 'test' }, { ttl: 1 });
      const result1 = await cacheManager.get('test:ttl');
      expect(result1).toEqual({ value: 'test' });

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));
      const result2 = await cacheManager.get('test:ttl');
      expect(result2).toBeNull();
    });

    it('应该支持批量操作', async () => {
      const items = [
        { key: 'batch:1', value: { id: 1 } },
        { key: 'batch:2', value: { id: 2 } },
        { key: 'batch:3', value: { id: 3 } }
      ];

      await cacheManager.mset(items);
      const results = await cacheManager.mget(['batch:1', 'batch:2', 'batch:3']);
      expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);

      await cacheManager.mdel(['batch:1', 'batch:3']);
      const results2 = await cacheManager.mget(['batch:1', 'batch:2', 'batch:3']);
      expect(results2).toEqual([null, { id: 2 }, null]);
    });

    it('应该支持模式匹配删除', async () => {
      await cacheManager.set('pattern:test:1', 'value1');
      await cacheManager.set('pattern:test:2', 'value2');
      await cacheManager.set('pattern:other:1', 'value3');

      const deleted = await cacheManager.delPattern('pattern:test:*');
      expect(deleted).toBe(2);

      const result1 = await cacheManager.get('pattern:test:1');
      const result2 = await cacheManager.get('pattern:other:1');
      expect(result1).toBeNull();
      expect(result2).toBe('value3');
    });
  });

  describe('用户缓存服务', () => {
    let userCache: UserCacheService;

    beforeEach(() => {
      userCache = new UserCacheService();
    });

    it('应该能够缓存用户基本信息', async () => {
      const userData = {
        id: 'user1',
        nickname: '测试用户',
        level: 'VIP',
        status: 'ACTIVE',
        pointsBalance: 1000
      };

      await userCache.setUserProfile('user1', userData as any);
      const cached = await userCache.getUserProfile('user1');
      expect(cached).toEqual(userData);
    });

    it('应该能够失效用户缓存', async () => {
      const userData = {
        id: 'user1',
        nickname: '测试用户',
        level: 'VIP',
        status: 'ACTIVE',
        pointsBalance: 1000
      };

      await userCache.setUserProfile('user1', userData as any);
      await userCache.invalidateUserProfile('user1');
      const cached = await userCache.getUserProfile('user1');
      expect(cached).toBeNull();
    });

    it('应该能够缓存用户等级进度', async () => {
      const progressData = {
        currentLevel: { key: 'VIP', name: 'VIP会员' },
        progress: 50,
        nextLevel: { key: 'STAR_1', name: '一星级' }
      };

      await userCache.setUserLevelProgress('user1', progressData as any);
      const cached = await userCache.getUserLevelProgress('user1');
      expect(cached).toEqual(progressData);
    });
  });

  describe('产品缓存服务', () => {
    let productCache: ProductCacheService;

    beforeEach(() => {
      productCache = new ProductCacheService();
    });

    it('应该能够缓存产品详情', async () => {
      const productData = {
        id: 'prod1',
        name: '测试产品',
        basePrice: 100,
        status: 'ACTIVE',
        totalStock: 50
      };

      await productCache.setProductDetail('prod1', productData as any);
      const cached = await productCache.getProductDetail('prod1');
      expect(cached).toEqual(productData);
    });

    it('应该能够缓存产品列表', async () => {
      const listData = [
        { id: 'prod1', name: '产品1', basePrice: 100 },
        { id: 'prod2', name: '产品2', basePrice: 200 }
      ];

      await productCache.setProductList({ page: 1, perPage: 20 }, listData as any);
      const cached = await productCache.getProductList({ page: 1, perPage: 20 });
      expect(cached).toEqual(listData);
    });

    it('应该能够缓存搜索结果', async () => {
      const searchData = {
        query: '测试',
        products: [],
        pagination: { page: 1, perPage: 20, total: 0 }
      };

      await productCache.setSearchResults('测试', { page: 1, perPage: 20 }, searchData as any);
      const cached = await productCache.getSearchResults('测试', { page: 1, perPage: 20 });
      expect(cached).toEqual(searchData);
    });
  });

  describe('缓存监控', () => {
    it('应该能够记录响应时间', () => {
      cacheMonitor.recordResponseTime(50);
      cacheMonitor.recordResponseTime(100);
      cacheMonitor.recordResponseTime(75);

      const metrics = cacheMonitor.getCurrentMetrics();
      expect(metrics?.responseTime.avg).toBeGreaterThan(0);
    });

    it('应该能够创建警报', () => {
      // 模拟低命中率
      const metrics = {
        timestamp: Date.now(),
        hits: 30,
        misses: 70,
        sets: 0,
        deletes: 0,
        errors: 0,
        hitRate: 30,
        responseTime: { avg: 0, min: 0, max: 0, p95: 0, p99: 0 },
        memory: { used: 0, total: 0, percentage: 0 },
        operations: { get: 0, set: 0, del: 0, mget: 0, mset: 0 }
      };

      // 手动触发检查
      cacheMonitor['checkAlerts'](metrics);
      const alerts = cacheMonitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });

    it('应该能够获取健康状态', async () => {
      const health = await cacheMonitor.getHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('score');
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
    });

    it('应该能够导出指标数据', () => {
      const jsonData = cacheMonitor.exportMetrics('json');
      const csvData = cacheMonitor.exportMetrics('csv');

      expect(() => JSON.parse(jsonData)).not.toThrow();
      expect(csvData).toContain('timestamp');
    });
  });

  describe('缓存策略', () => {
    it('应该支持remember模式', async () => {
      let callCount = 0;
      const expensiveFunction = async () => {
        callCount++;
        return { data: 'expensive result' };
      };

      // 第一次调用
      const result1 = await cacheManager.remember('remember:test', expensiveFunction, { ttl: 60 });
      expect(result1).toEqual({ data: 'expensive result' });
      expect(callCount).toBe(1);

      // 第二次调用应该从缓存获取
      const result2 = await cacheManager.remember('remember:test', expensiveFunction, { ttl: 60 });
      expect(result2).toEqual({ data: 'expensive result' });
      expect(callCount).toBe(1); // 没有增加
    });

    it('应该支持标签失效', async () => {
      await cacheManager.set('tagged:1', 'value1', { tags: ['test-tag'] });
      await cacheManager.set('tagged:2', 'value2', { tags: ['test-tag'] });
      await cacheManager.set('tagged:3', 'value3', { tags: ['other-tag'] });

      await cacheManager.invalidateTags(['test-tag']);

      const result1 = await cacheManager.get('tagged:1');
      const result2 = await cacheManager.get('tagged:2');
      const result3 = await cacheManager.get('tagged:3');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBe('value3');
    });
  });

  describe('高级功能', () => {
    it('应该支持哈希操作', async () => {
      await cacheManager.hset('hash:test', 'field1', 'value1');
      await cacheManager.hset('hash:test', 'field2', 'value2');

      const value1 = await cacheManager.hget('hash:test', 'field1');
      expect(value1).toBe('value1');

      const all = await cacheManager.hgetall('hash:test');
      expect(all).toEqual({ field1: 'value1', field2: 'value2' });

      await cacheManager.hdel('hash:test', 'field1');
      const value1AfterDel = await cacheManager.hget('hash:test', 'field1');
      expect(value1AfterDel).toBeNull();
    });

    it('应该支持列表操作', async () => {
      await cacheManager.lpush('list:test', 'item1');
      await cacheManager.lpush('list:test', 'item2');
      await cacheManager.rpush('list:test', 'item3');

      const length = await cacheManager.llen('list:test');
      expect(length).toBe(3);

      const item1 = await cacheManager.lpop('list:test');
      expect(item1).toBe('item2');

      const item3 = await cacheManager.rpop('list:test');
      expect(item3).toBe('item3');
    });

    it('应该支持集合操作', async () => {
      await cacheManager.sadd('set:test', 'member1');
      await cacheManager.sadd('set:test', 'member2');
      await cacheManager.sadd('set:test', 'member1'); // 重复

      const members = await cacheManager.smembers('set:test');
      expect(members).toContain('member1');
      expect(members).toContain('member2');

      const isMember = await cacheManager.sismember('set:test', 'member1');
      expect(isMember).toBe(true);
    });

    it('应该支持原子操作', async () => {
      await cacheManager.set('counter:test', 10);
      const incremented = await cacheManager.incr('counter:test', 5);
      expect(incremented).toBe(15);

      const decremented = await cacheManager.decr('counter:test', 3);
      expect(decremented).toBe(12);
    });
  });

  describe('错误处理', () => {
    it('应该优雅处理连接错误', async () => {
      // 断开连接
      await cacheManager.disconnect();

      // 尝试操作应该不会抛出错误
      await expect(cacheManager.get('test:key')).resolves.toBeNull();
      await expect(cacheManager.set('test:key', 'value')).resolves.not.toThrow();

      // 重新连接
      await cacheManager.connect();
    });

    it('应该处理无效的TTL值', async () => {
      await expect(cacheManager.set('test:key', 'value', { ttl: -1 })).resolves.not.toThrow();
      await expect(cacheManager.set('test:key', 'value', { ttl: NaN })).resolves.not.toThrow();
    });

    it('应该处理大对象序列化', async () => {
      const largeObject = {
        data: new Array(10000).fill(0).map((_, i) => ({ id: i, value: `item${i}` }))
      };

      await expect(cacheManager.set('test:large', largeObject)).resolves.not.toThrow();
      const retrieved = await cacheManager.get('test:large');
      expect(retrieved).toEqual(largeObject);
    });
  });

  describe('性能测试', () => {
    it('应该能够处理大量并发操作', async () => {
      const promises = [];
      const count = 1000;

      // 并发写入
      for (let i = 0; i < count; i++) {
        promises.push(cacheManager.set(`perf:test:${i}`, { id: i }));
      }

      const writeStart = Date.now();
      await Promise.all(promises);
      const writeTime = Date.now() - writeStart;

      // 并发读取
      const readPromises = [];
      for (let i = 0; i < count; i++) {
        readPromises.push(cacheManager.get(`perf:test:${i}`));
      }

      const readStart = Date.now();
      const readResults = await Promise.all(readPromises);
      const readTime = Date.now() - readStart;

      expect(readResults.every(r => r !== null)).toBe(true);
      expect(writeTime).toBeLessThan(5000); // 5秒内完成
      expect(readTime).toBeLessThan(1000); // 1秒内完成

      console.log(`写入${count}个操作耗时: ${writeTime}ms`);
      console.log(`读取${count}个操作耗时: ${readTime}ms`);
    }, 10000);
  });
});