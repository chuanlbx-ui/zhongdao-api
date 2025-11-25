/**
 * 供应链采购路径优化系统 - 主入口
 * 整合网络构建、路径查找、多目标优化、缓存管理等功能
 * 提供统一的API接口，支持实时路径优化和批量处理
 */

import { logger } from '../../shared/utils/logger';
import { networkBuilderService } from './network-builder.service';
import { pathFinderService } from './path-finder.service';
import { pathOptimizerService } from './path-optimizer.service';
import { cacheManager, pathCache, priceCache, inventoryCache } from './cache.service';
import { purchaseService } from '../purchase/purchase.service';
import {
  ProcurementPath,
  OptimizationResult,
  PathFindOptions,
  OptimizationStrategy,
  OptimizationWeights,
  PathValidationResult,
  PathOptimizerConfig,
  PerformanceMetrics,
  SupplyChainEvent,
  SupplyChainEventType,
  SupplyChainError,
  SupplyChainErrorType
} from './types';

/**
 * 供应链路径优化器主服务
 * 统一的入口点，整合所有子服务功能
 */
export class SupplyChainPathOptimizer {
  private isInitialized = false;
  private eventListeners = new Map<SupplyChainEventType, Array<(event: SupplyChainEvent) => void>>();
  private config: PathOptimizerConfig;

  constructor(config: Partial<PathOptimizerConfig> = {}) {
    this.config = {
      defaultAlgorithm: 'genetic_algorithm_optimization',
      maxSearchDepth: 10,
      maxPaths: 20,
      defaultWeights: {
        price: 0.35,
        inventory: 0.25,
        length: 0.20,
        reliability: 0.15,
        speed: 0.05
      },
      optimizationStrategy: 'BALANCED',
      cache: {
        maxSize: 10000,
        maxMemory: 100 * 1024 * 1024,
        defaultTtl: 300000,
        evictionPolicy: 'LRU',
        enableStats: true,
        compressionEnabled: false,
        backgroundCleanup: true,
        cleanupInterval: 60000,
        cleanupBatchSize: 100
      },
      performance: {
        enableMonitoring: true,
        enableProfiling: false,
        maxExecutionTime: 10000,
        batchSize: 100
      },
      businessRules: {
        allowCrossLevelTransactions: false,
        requireTeamMembership: true,
        enforceMinimumStock: true,
        enableBlacklist: true
      },
      network: {
        autoRebuild: true,
        rebuildInterval: 300000, // 5分钟
        incrementalUpdate: true
      },
      ...config
    };

    this.initialize();
  }

  /**
   * 初始化系统
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      logger.info('初始化供应链路径优化系统...');

      // 初始化网络图
      await networkBuilderService.buildSupplyChainGraph();

      // 启动后台任务
      if (this.config.network.autoRebuild) {
        this.startNetworkRebuildScheduler();
      }

      // 启动性能监控
      if (this.config.performance.enableMonitoring) {
        this.startPerformanceMonitoring();
      }

      this.isInitialized = true;

      this.emitEvent({
        type: SupplyChainEventType.NETWORK_BUILT,
        timestamp: new Date(),
        source: 'SupplyChainPathOptimizer',
        data: { initialized: true }
      });

      logger.info('供应链路径优化系统初始化完成');

    } catch (error) {
      logger.error('供应链路径优化系统初始化失败', {
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined
      });

      throw new SupplyChainError(
        SupplyChainErrorType.NETWORK_NOT_BUILT,
        '系统初始化失败',
        { error }
      );
    }
  }

  /**
   * 查找最优采购路径
   * @param buyerId 采购方ID
   * @param productId 商品ID
   * @param quantity 采购数量
   * @param options 可选参数
   * @returns 最优路径或null
   */
  async findOptimalPath(
    buyerId: string,
    productId: string,
    quantity: number,
    options: {
      strategy?: OptimizationStrategy;
      weights?: Partial<OptimizationWeights>;
      maxPaths?: number;
      useCache?: boolean;
    } = {}
  ): Promise<ProcurementPath | null> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('开始查找最优采购路径', {
        buyerId,
        productId,
        quantity,
        strategy: options.strategy || this.config.optimizationStrategy
      });

      // 检查缓存
      if (options.useCache !== false) {
        const cacheKey = this.generateCacheKey(buyerId, productId, quantity, options);
        const cachedPath = pathCache.get(cacheKey);
        if (cachedPath) {
          this.emitEvent({
            type: SupplyChainEventType.CACHE_HIT,
            timestamp: new Date(),
            source: 'findOptimalPath',
            data: { buyerId, productId, cacheKey }
          });

          return cachedPath;
        }

        this.emitEvent({
          type: SupplyChainEventType.CACHE_MISS,
          timestamp: new Date(),
          source: 'findOptimalPath',
          data: { buyerId, productId, cacheKey }
        });
      }

      // 执行路径优化
      const optimizationResult = await pathOptimizerService.optimizeProcurementPath(
        buyerId,
        productId,
        quantity,
        options.strategy || this.config.optimizationStrategy,
        options.weights
      );

      if (optimizationResult.ParetoFront.length === 0) {
        logger.debug('未找到有效的采购路径', { buyerId, productId, quantity });
        return null;
      }

      // 选择最优路径
      const optimalPath = optimizationResult.bestPaths.byOverall || optimizationResult.ParetoFront[0];

      // 缓存结果
      if (options.useCache !== false) {
        const cacheKey = this.generateCacheKey(buyerId, productId, quantity, options);
        pathCache.set(cacheKey, optimalPath, this.config.cache.defaultTtl);
      }

      const searchTime = Date.now() - startTime;

      this.emitEvent({
        type: SupplyChainEventType.PATH_FOUND,
        timestamp: new Date(),
        source: 'findOptimalPath',
        data: {
          buyerId,
          productId,
          quantity,
          pathId: optimalPath.id,
          pathLength: optimalPath.path.length,
          totalPrice: optimalPath.totalPrice,
          searchTime
        }
      });

      logger.debug('找到最优采购路径', {
        buyerId,
        productId,
        quantity,
        pathId: optimalPath.id,
        pathLength: optimalPath.path.length,
        totalPrice: optimalPath.totalPrice,
        overallScore: optimalPath.overallScore,
        searchTime: `${searchTime}ms`
      });

      return optimalPath;

    } catch (error) {
      const searchTime = Date.now() - startTime;

      this.emitEvent({
        type: SupplyChainEventType.ERROR_OCCURRED,
        timestamp: new Date(),
        source: 'findOptimalPath',
        data: {
          buyerId,
          productId,
          quantity,
          error: error instanceof Error ? error.message : '未知错误',
          searchTime
        }
      });

      logger.error('查找最优采购路径失败', {
        buyerId,
        productId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误',
        searchTime: `${searchTime}ms`
      });

      if (error instanceof SupplyChainError) {
        throw error;
      }

      throw new SupplyChainError(
        SupplyChainErrorType.PATH_NOT_FOUND,
        '查找最优路径失败',
        { buyerId, productId, quantity, error }
      );
    }
  }

  /**
   * 获取多个优化路径选项
   * @param buyerId 采购方ID
   * @param productId 商品ID
   * @param quantity 采购数量
   * @param options 可选参数
   * @returns 优化结果
   */
  async findMultiplePaths(
    buyerId: string,
    productId: string,
    quantity: number,
    options: {
      strategy?: OptimizationStrategy;
      weights?: Partial<OptimizationWeights>;
      maxPaths?: number;
    } = {}
  ): Promise<OptimizationResult> {
    await this.ensureInitialized();

    try {
      logger.debug('开始查找多个采购路径', {
        buyerId,
        productId,
        quantity,
        strategy: options.strategy || this.config.optimizationStrategy
      });

      const optimizationResult = await pathOptimizerService.optimizeProcurementPath(
        buyerId,
        productId,
        quantity,
        options.strategy || this.config.optimizationStrategy,
        options.weights
      );

      this.emitEvent({
        type: SupplyChainEventType.PATH_OPTIMIZED,
        timestamp: new Date(),
        source: 'findMultiplePaths',
        data: {
          buyerId,
          productId,
          quantity,
          pathsFound: optimizationResult.paths.length,
          paretoSolutions: optimizationResult.ParetoFront.length,
          algorithm: optimizationResult.metadata.algorithm
        }
      });

      return optimizationResult;

    } catch (error) {
      logger.error('查找多个采购路径失败', {
        buyerId,
        productId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });

      if (error instanceof SupplyChainError) {
        throw error;
      }

      throw new SupplyChainError(
        SupplyChainErrorType.OPTIMIZATION_FAILED,
        '查找多个路径失败',
        { buyerId, productId, quantity, error }
      );
    }
  }

  /**
   * 批量路径优化
   * @param requests 批量请求
   * @returns 优化结果数组
   */
  async batchOptimize(
    requests: Array<{
      buyerId: string;
      productId: string;
      quantity: number;
      strategy?: OptimizationStrategy;
      weights?: Partial<OptimizationWeights>;
    }>
  ): Promise<Array<{
    request: any;
    result: OptimizationResult | null;
    error?: string;
  }>> {
    await this.ensureInitialized();

    logger.info(`开始批量路径优化，请求数量: ${requests.length}`);

    const results: Array<{
      request: any;
      result: OptimizationResult | null;
      error?: string;
    }> = [];

    const batchSize = this.config.performance.batchSize;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      for (const request of batch) {
        try {
          const result = await this.findMultiplePaths(
            request.buyerId,
            request.productId,
            request.quantity,
            {
              strategy: request.strategy,
              weights: request.weights
            }
          );

          results.push({ request, result });

        } catch (error) {
          results.push({
            request,
            result: null,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      }

      // 避免过载
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    const successCount = results.filter(r => r.result !== null).length;

    logger.info(`批量路径优化完成`, {
      totalRequests: requests.length,
      successCount,
      failureCount: requests.length - successCount
    });

    return results;
  }

  /**
   * 验证采购路径
   * @param path 要验证的路径
   * @returns 验证结果
   */
  async validatePath(path: ProcurementPath): Promise<PathValidationResult> {
    try {
      const validationResult = await pathFinderService.validatePath(path);

      logger.debug('路径验证完成', {
        pathId: path.id,
        isValid: validationResult.isValid,
        reasons: validationResult.reasons.length
      });

      return validationResult;

    } catch (error) {
      logger.error('路径验证失败', {
        pathId: path.id,
        error: error instanceof Error ? error.message : '未知错误'
      });

      throw new SupplyChainError(
        SupplyChainErrorType.VALIDATION_FAILED,
        '路径验证失败',
        { pathId: path.id, error }
      );
    }
  }

  /**
   * 增量更新供应链网络
   * @param userIds 需要更新的用户ID列表
   */
  async updateNetwork(userIds: string[]): Promise<void> {
    try {
      await networkBuilderService.incrementalUpdate(userIds);

      // 清理相关缓存
      this.clearRelatedCaches(userIds);

      this.emitEvent({
        type: SupplyChainEventType.NETWORK_UPDATED,
        timestamp: new Date(),
        source: 'updateNetwork',
        data: { userIds, count: userIds.length }
      });

      logger.debug('供应链网络更新完成', { userIds, count: userIds.length });

    } catch (error) {
      logger.error('供应链网络更新失败', {
        userIds,
        error: error instanceof Error ? error.message : '未知错误'
      });

      throw new SupplyChainError(
        SupplyChainErrorType.INCONSISTENT_DATA,
        '网络更新失败',
        { userIds, error }
      );
    }
  }

  /**
   * 获取系统性能指标
   */
  getPerformanceMetrics(): {
    networkBuilder: PerformanceMetrics;
    pathFinder: PerformanceMetrics;
    pathOptimizer: PerformanceMetrics;
    cache: any;
  } {
    return {
      networkBuilder: networkBuilderService.getPerformanceMetrics(),
      pathFinder: pathFinderService.getPerformanceMetrics(),
      pathOptimizer: pathOptimizerService.getPerformanceMetrics(),
      cache: cacheManager.getAllStats()
    };
  }

  /**
   * 系统健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: Record<string, { healthy: boolean; issues: string[] }>;
    metrics: any;
  }> {
    const components: Record<string, { healthy: boolean; issues: string[] }> = {};

    // 检查网络构建器
    const networkGraph = networkBuilderService.getGraph();
    components.networkBuilder = {
      healthy: !!networkGraph && networkGraph.nodes.size > 0,
      issues: !networkGraph ? ['网络图未构建'] : []
    };

    // 检查缓存
    const cacheHealth = cacheManager.healthCheckAll();
    Object.keys(cacheHealth).forEach(cacheName => {
      components[`cache_${cacheName}`] = cacheHealth[cacheName];
    });

    // 检查采购服务集成
    try {
      const purchaseStats = purchaseService.getPerformanceStats();
      components.purchaseService = {
        healthy: purchaseStats.cacheHitRate >= 0,
        issues: []
      };
    } catch (error) {
      components.purchaseService = {
        healthy: false,
        issues: ['采购服务不可用']
      };
    }

    const allHealthy = Object.values(components).every(comp => comp.healthy);

    return {
      healthy: allHealthy,
      components,
      metrics: this.getPerformanceMetrics()
    };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    pathCache.clear();
    priceCache.clear();
    inventoryCache.clear();
  }

  /**
   * 预热缓存
   * @param popularProducts 热门商品列表
   * @param activeBuyers 活跃买家列表
   */
  async warmupCache(
    popularProducts: string[],
    activeBuyers: string[]
  ): Promise<void> {
    logger.info('开始缓存预热', {
      productCount: popularProducts.length,
      buyerCount: activeBuyers.length
    });

    // 预热商品价格缓存
    const priceWarmupData = popularProducts.map(productId => ({
      key: `product_prices_${productId}`,
      valueFactory: async () => {
        // 实际实现中应该调用价格服务
        return { productId, prices: [] };
      }
    }));

    await priceCache.warmup(priceWarmupData);

    // 预热库存缓存
    const inventoryWarmupData = popularProducts.map(productId => ({
      key: `product_inventory_${productId}`,
      valueFactory: async () => {
        // 实际实现中应该调用库存服务
        return { productId, inventory: 0 };
      }
    }));

    await inventoryCache.warmup(inventoryWarmupData);

    logger.info('缓存预热完成');
  }

  /**
   * 添加事件监听器
   */
  addEventListener(
    eventType: SupplyChainEventType,
    listener: (event: SupplyChainEvent) => void
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(
    eventType: SupplyChainEventType,
    listener: (event: SupplyChainEvent) => void
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 销毁系统
   */
  async destroy(): Promise<void> {
    logger.info('开始销毁供应链路径优化系统...');

    try {
      // 清理所有服务
      networkBuilderService.cleanup();
      pathFinderService.cleanup();
      pathOptimizerService.cleanup();
      cacheManager.destroy();

      // 清理事件监听器
      this.eventListeners.clear();

      this.isInitialized = false;

      logger.info('供应链路径优化系统已销毁');

    } catch (error) {
      logger.error('销毁系统时发生错误', {
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  // 私有方法

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private generateCacheKey(
    buyerId: string,
    productId: string,
    quantity: number,
    options: any
  ): string {
    const optionsHash = JSON.stringify(options);
    return `optimal_path_${buyerId}_${productId}_${quantity}_${btoa(optionsHash)}`;
  }

  private clearRelatedCaches(userIds: string[]): void {
    // 清理与这些用户相关的路径缓存
    const keys = pathCache.keys();
    for (const key of keys) {
      if (userIds.some(userId => key.includes(userId))) {
        pathCache.delete(key);
      }
    }
  }

  private startNetworkRebuildScheduler(): void {
    setInterval(async () => {
      try {
        await networkBuilderService.buildSupplyChainGraph();
        logger.debug('定期网络重建完成');
      } catch (error) {
        logger.error('定期网络重建失败', {
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }, this.config.network.rebuildInterval);
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const metrics = this.getPerformanceMetrics();

      // 检查性能阈值
      if (metrics.pathFinder.averageResponseTime > 1000) {
        this.emitEvent({
          type: SupplyChainEventType.PERFORMANCE_WARNING,
          timestamp: new Date(),
          source: 'performance_monitor',
          data: {
            component: 'pathFinder',
            metric: 'averageResponseTime',
            value: metrics.pathFinder.averageResponseTime,
            threshold: 1000
          }
        });
      }
    }, 60000); // 每分钟检查一次
  }

  private emitEvent(event: SupplyChainEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          logger.error('事件监听器执行失败', {
            eventType: event.type,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      }
    }
  }
}

// 导出主要类型和服务
export {
  SupplyChainPathOptimizer,
  pathFinderService,
  pathOptimizerService,
  networkBuilderService,
  cacheManager,
  pathCache,
  priceCache,
  inventoryCache
};

// 导出所有类型
export * from './types';

// 创建并导出默认实例
export const supplyChainOptimizer = new SupplyChainPathOptimizer();