/**
 * 供应链路径优化系统基础测试
 * 测试核心功能和基本用例
 */

import { supplyChainOptimizer, supplyChainIntegrationService } from '../index';
import { SupplyChainErrorType } from '../types';

describe('SupplyChainPathOptimizer', () => {
  beforeAll(async () => {
    // 确保系统已初始化
    await supplyChainOptimizer.findOptimalPath('test_buyer', 'test_product', 1);
  });

  describe('基本路径查找', () => {
    test('应该能够找到基本采购路径', async () => {
      const path = await supplyChainOptimizer.findOptimalPath(
        'test_buyer_1',
        'test_product_1',
        5
      );

      expect(path).toBeDefined();
      expect(path!.buyerId).toBe('test_buyer_1');
      expect(path!.productId).toBe('test_product_1');
      expect(path!.quantity).toBe(5);
      expect(path!.path.length).toBeGreaterThan(1);
      expect(path!.totalPrice).toBeGreaterThan(0);
      expect(path!.overallScore).toBeGreaterThanOrEqual(0);
      expect(path!.overallScore).toBeLessThanOrEqual(1);
    });

    test('应该能够处理不同的优化策略', async () => {
      const strategies = ['PRICE_FIRST', 'INVENTORY_FIRST', 'LENGTH_FIRST', 'BALANCED'] as const;

      for (const strategy of strategies) {
        const path = await supplyChainOptimizer.findOptimalPath(
          'test_buyer_2',
          'test_product_2',
          3,
          { strategy }
        );

        expect(path).toBeDefined();
        expect(path!.metadata.algorithm).toBeDefined();
      }
    });

    test('应该能够处理自定义权重', async () => {
      const customWeights = {
        price: 0.6,
        inventory: 0.2,
        length: 0.1,
        reliability: 0.1
      };

      const path = await supplyChainOptimizer.findOptimalPath(
        'test_buyer_3',
        'test_product_3',
        8,
        { weights: customWeights }
      );

      expect(path).toBeDefined();
      expect(path!.metadata.weights).toBeDefined();
    });
  });

  describe('多路径优化', () => {
    test('应该能够返回多个优化路径', async () => {
      const result = await supplyChainOptimizer.findMultiplePaths(
        'test_buyer_4',
        'test_product_4',
        10,
        { maxPaths: 5 }
      );

      expect(result).toBeDefined();
      expect(result.paths.length).toBeGreaterThan(0);
      expect(result.ParetoFront.length).toBeGreaterThan(0);
      expect(result.statistics.totalPathsExplored).toBeGreaterThan(0);
      expect(result.bestPaths.byOverall).toBeDefined();
    });

    test('应该能够找到按不同指标的最优路径', async () => {
      const result = await supplyChainOptimizer.findMultiplePaths(
        'test_buyer_5',
        'test_product_5',
        7
      );

      expect(result.bestPaths.byPrice).toBeDefined();
      expect(result.bestPaths.byLength).toBeDefined();
      expect(result.bestPaths.byInventory).toBeDefined();
      expect(result.bestPaths.byReliability).toBeDefined();

      // 验证按价格最优的路径确实价格最低
      const priceOptimal = result.bestPaths.byPrice!;
      const otherPaths = result.paths.filter(p => p.id !== priceOptimal.id);

      for (const path of otherPaths) {
        expect(priceOptimal.totalPrice).toBeLessThanOrEqual(path.totalPrice);
      }
    });
  });

  describe('路径验证', () => {
    test('应该能够验证有效路径', async () => {
      const path = await supplyChainOptimizer.findOptimalPath(
        'test_buyer_6',
        'test_product_6',
        5
      );

      expect(path).toBeDefined();

      const validation = await supplyChainOptimizer.validatePath(path!);

      expect(validation).toBeDefined();
      expect(validation.validationDetails).toBeDefined();
      expect(validation.metadata).toBeDefined();
    });

    test('应该检测路径问题', async () => {
      // 创建一个可能无效的路径进行测试
      const invalidPath = {
        id: 'invalid_path_test',
        buyerId: 'test_buyer_7',
        productId: 'test_product_7',
        quantity: 1000, // 超大数量
        path: [
          {
            userId: 'test_buyer_7',
            level: 'NORMAL' as const,
            role: 'buyer' as const,
            price: 0,
            availableStock: 0,
            distance: 0,
            metadata: {
              responseTime: 0,
              reliability: 1.0,
              commissionRate: 0
            }
          }
        ],
        totalPrice: 0,
        totalLength: 0,
        availableStock: 0,
        estimatedDeliveryTime: 0,
        priceScore: 0,
        inventoryScore: 0,
        lengthScore: 0,
        reliabilityScore: 0,
        overallScore: 0,
        metadata: {
          calculatedAt: new Date(),
          algorithm: 'test',
          weights: { price: 0.4, inventory: 0.3, length: 0.2, reliability: 0.1, speed: 0 },
          searchDepth: 0,
          alternativePaths: 0
        }
      };

      const validation = await supplyChainOptimizer.validatePath(invalidPath);

      // 验证应该发现问题
      expect(validation.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('性能测试', () => {
    test('路径查找应该在合理时间内完成', async () => {
      const startTime = Date.now();

      await supplyChainOptimizer.findOptimalPath(
        'test_buyer_perf',
        'test_product_perf',
        5
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });

    test('缓存应该提高查询性能', async () => {
      const buyerId = 'test_buyer_cache';
      const productId = 'test_product_cache';
      const quantity = 3;

      // 第一次查询（无缓存）
      const start1 = Date.now();
      const path1 = await supplyChainOptimizer.findOptimalPath(
        buyerId,
        productId,
        quantity,
        { useCache: false }
      );
      const time1 = Date.now() - start1;

      // 第二次查询（有缓存）
      const start2 = Date.now();
      const path2 = await supplyChainOptimizer.findOptimalPath(
        buyerId,
        productId,
        quantity,
        { useCache: true }
      );
      const time2 = Date.now() - start2;

      expect(path1).toBeDefined();
      expect(path2).toBeDefined();
      expect(path1!.id).toBe(path2!.id);

      // 缓存查询应该更快（至少不会明显变慢）
      expect(time2).toBeLessThanOrEqual(time1 + 100); // 允许100ms误差
    });
  });

  describe('错误处理', () => {
    test('应该处理无效参数', async () => {
      await expect(
        supplyChainOptimizer.findOptimalPath('', 'test_product', 5)
      ).rejects.toThrow();

      await expect(
        supplyChainOptimizer.findOptimalPath('test_buyer', '', 5)
      ).rejects.toThrow();

      await expect(
        supplyChainOptimizer.findOptimalPath('test_buyer', 'test_product', 0)
      ).rejects.toThrow();

      await expect(
        supplyChainOptimizer.findOptimalPath('test_buyer', 'test_product', -5)
      ).rejects.toThrow();
    });

    test('应该处理不存在的产品', async () => {
      const path = await supplyChainOptimizer.findOptimalPath(
        'test_buyer',
        'nonexistent_product',
        5
      );

      // 对于不存在的产品，应该返回null而不是抛出异常
      expect(path).toBeNull();
    });
  });

  describe('系统集成', () => {
    test('应该能够进行智能采购', async () => {
      const result = await supplyChainIntegrationService.intelligentPurchase({
        buyerId: 'test_buyer_integration',
        productId: 'test_product_integration',
        quantity: 3
      });

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        expect(result.path).toBeDefined();
        expect(result.order).toBeDefined();
        expect(result.metadata).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
        expect(result.message).toBeDefined();
      }
    });

    test('应该能够获取采购建议', async () => {
      const suggestions = await supplyChainIntegrationService.getPurchaseSuggestions(
        'test_buyer_suggestions',
        'test_product_suggestions',
        5,
        3
      );

      expect(suggestions).toBeDefined();
      expect(suggestions.suggestions).toBeDefined();
      expect(suggestions.metadata).toBeDefined();

      if (suggestions.suggestions.length > 0) {
        const suggestion = suggestions.suggestions[0];
        expect(suggestion.path).toBeDefined();
        expect(suggestion.validation).toBeDefined();
        expect(suggestion.recommendation).toBeDefined();
        expect(suggestion.score).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('系统监控', () => {
    test('应该能够获取性能指标', () => {
      const metrics = supplyChainOptimizer.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.networkBuilder).toBeDefined();
      expect(metrics.pathFinder).toBeDefined();
      expect(metrics.pathOptimizer).toBeDefined();
      expect(metrics.cache).toBeDefined();
    });

    test('应该能够进行健康检查', async () => {
      const health = await supplyChainOptimizer.healthCheck();

      expect(health).toBeDefined();
      expect(typeof health.healthy).toBe('boolean');
      expect(health.components).toBeDefined();
      expect(health.metrics).toBeDefined();
    });
  });

  describe('批量处理', () => {
    test('应该能够处理批量请求', async () => {
      const requests = [
        {
          buyerId: 'test_buyer_batch_1',
          productId: 'test_product_batch_1',
          quantity: 2
        },
        {
          buyerId: 'test_buyer_batch_2',
          productId: 'test_product_batch_2',
          quantity: 4
        }
      ];

      const startTime = Date.now();
      const results = await supplyChainOptimizer.batchOptimize(requests);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(requests.length);

      results.forEach((result, index) => {
        expect(result.request).toBe(requests[index]);
        // 某些请求可能失败，但应该有结果
        expect(result.result !== undefined || result.error !== undefined).toBe(true);
      });

      // 批量处理应该在合理时间内完成
      expect(duration).toBeLessThan(5000);
    });
  });
});

describe('缓存系统', () => {
  test('缓存应该正确存储和检索数据', async () => {
    const { cacheManager } = await import('../cache');
    const testCache = cacheManager.getCache('test');

    const key = 'test_key';
    const value = { test: 'data', number: 42 };

    // 设置数据
    testCache.set(key, value);

    // 获取数据
    const retrieved = testCache.get(key);
    expect(retrieved).toEqual(value);

    // 检查是否存在
    expect(testCache.has(key)).toBe(true);

    // 删除数据
    const deleted = testCache.delete(key);
    expect(deleted).toBe(true);
    expect(testCache.has(key)).toBe(false);
  });

  test('缓存应该正确处理TTL', async () => {
    const { cacheManager } = await import('../cache');
    const testCache = cacheManager.getCache('test_ttl');

    const key = 'ttl_test_key';
    const value = { test: 'ttl_data' };
    const shortTtl = 100; // 100ms

    testCache.set(key, value, shortTtl);

    // 立即获取应该成功
    expect(testCache.get(key)).toEqual(value);

    // 等待TTL过期
    await new Promise(resolve => setTimeout(resolve, shortTtl + 10));

    // 过期后获取应该返回null
    expect(testCache.get(key)).toBeNull();
  });
});

describe('错误类型', () => {
  test('应该正确创建和识别错误类型', () => {
    const { SupplyChainError } = require('../types');

    const error = new SupplyChainError(
      SupplyChainErrorType.PATH_NOT_FOUND,
      '测试路径未找到错误',
      { additionalInfo: 'test' }
    );

    expect(error.type).toBe(SupplyChainErrorType.PATH_NOT_FOUND);
    expect(error.code).toBe('SUPPLY_CHAIN_PATH_NOT_FOUND');
    expect(error.message).toBe('测试路径未找到错误');
    expect(error.details.additionalInfo).toBe('test');
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.name).toBe('SupplyChainError');
  });
});