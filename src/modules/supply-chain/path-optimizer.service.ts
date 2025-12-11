/**
 * 供应链路径优化服务
 * 实现多目标优化算法，综合考虑价格、库存、路径长度、可靠性等因素
 * 支持帕累托最优解集、自定义权重配置、实时优化等高级功能
 */

import { logger } from '@/shared/utils/logger';
import { pathFinderService } from './path-finder.service';
import {
  ProcurementPath,
  OptimizationWeights,
  OptimizationResult,
  OptimizationStrategy,
  SupplyChainError,
  SupplyChainErrorType,
  AlgorithmExecutionRecord,
  PerformanceMetrics
} from './types';

export class PathOptimizerService {
  // 性能监控
  private performanceMetrics: PerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    averageSearchTime: 0,
    averageOptimizationTime: 0,
    averageValidationTime: 0,
    cacheHitRate: 0,
    cacheMissRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    errorRate: 0,
    timeoutRate: 0,
    lastUpdated: new Date()
  };

  private executionRecords: AlgorithmExecutionRecord[] = [];
  private responseTimes: number[] = [];

  // 默认优化权重
  private readonly defaultWeights: OptimizationWeights = {
    price: 0.35,        // 价格权重
    inventory: 0.25,    // 库存权重
    length: 0.20,       // 路径长度权重
    reliability: 0.15,  // 可靠性权重
    speed: 0.05         // 响应速度权重
  };

  // 配置参数
  private readonly config = {
    maxOptimizationPaths: 50,
    maxParetoSolutions: 20,
    optimizationTimeoutMs: 8000,
    convergenceThreshold: 0.001,
    maxIterations: 100,
    populationSize: 30,
    mutationRate: 0.1,
    crossoverRate: 0.8
  };

  /**
   * 优化采购路径
   * @param buyerId 采购方ID
   * @param productId 商品ID
   * @param quantity 采购数量
   * @param strategy 优化策略
   * @param customWeights 自定义权重
   * @returns 优化结果
   */
  async optimizeProcurementPath(
    buyerId: string,
    productId: string,
    quantity: number,
    strategy: OptimizationStrategy = 'BALANCED',
    customWeights?: Partial<OptimizationWeights>
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    try {
      logger.debug('开始路径优化', {
        buyerId,
        productId,
        quantity,
        strategy
      });

      // 1. 获取基础路径
      const paths = await pathFinderService.findMultiplePaths(buyerId, productId, quantity, {
        maxPaths: this.config.maxOptimizationPaths,
        useCache: true
      });

      if (paths.length === 0) {
        throw new SupplyChainError(
          SupplyChainErrorType.PATH_NOT_FOUND,
          '未找到可用于优化的采购路径'
        );
      }

      // 2. 确定优化权重
      const weights = this.resolveOptimizationWeights(strategy, customWeights);

      // 3. 执行多目标优化
      const optimizationResult = await this.performMultiObjectiveOptimization(
        paths,
        weights,
        strategy
      );

      // 4. 构建优化结果
      const result: OptimizationResult = {
        paths: optimizationResult.optimizedPaths,
        ParetoFront: optimizationResult.paretoFront,
        statistics: {
          totalPathsExplored: paths.length,
          validPathsFound: paths.length,
          averagePathLength: this.calculateAveragePathLength(paths),
          averagePrice: this.calculateAveragePrice(paths),
          optimizationTime: Date.now() - startTime
        },
        bestPaths: {
          byPrice: this.findBestByPrice(optimizationResult.optimizedPaths),
          byLength: this.findBestByLength(optimizationResult.optimizedPaths),
          byInventory: this.findBestByInventory(optimizationResult.optimizedPaths),
          byReliability: this.findBestByReliability(optimizationResult.optimizedPaths),
          byOverall: this.findBestByOverall(optimizationResult.optimizedPaths)
        },
        metadata: {
          optimizedAt: new Date(),
          algorithm: this.getAlgorithmName(strategy),
          weights,
          convergenceCriteria: 'score_improvement'
        }
      };

      const optimizationTime = Date.now() - startTime;
      this.updatePerformanceMetrics(optimizationTime, true);

      logger.info('路径优化完成', {
        buyerId,
        productId,
        quantity,
        strategy,
        pathsExplored: paths.length,
        paretoSolutions: result.ParetoFront.length,
        optimizationTime: `${optimizationTime}ms`
      });

      return result;

    } catch (error) {
      const optimizationTime = Date.now() - startTime;
      this.updatePerformanceMetrics(optimizationTime, false);

      logger.error('路径优化失败', {
        buyerId,
        productId,
        quantity,
        strategy,
        error: error instanceof Error ? error.message : '未知错误',
        optimizationTime: `${optimizationTime}ms`
      });

      if (error instanceof SupplyChainError) {
        throw error;
      }

      throw new SupplyChainError(
        SupplyChainErrorType.OPTIMIZATION_FAILED,
        '路径优化过程中发生错误',
        { buyerId, productId, quantity, strategy, error }
      );
    }
  }

  /**
   * 执行多目标优化
   */
  private async performMultiObjectiveOptimization(
    paths: ProcurementPath[],
    weights: OptimizationWeights,
    strategy: OptimizationStrategy
  ): Promise<{
    optimizedPaths: ProcurementPath[];
    paretoFront: ProcurementPath[];
  }> {
    const record: AlgorithmExecutionRecord = {
      id: `optimize_${Date.now()}`,
      algorithm: this.getAlgorithmName(strategy),
      inputSize: paths.length,
      outputSize: 0,
      executionTime: 0,
      memoryUsage: 0,
      parameters: { strategy, weights },
      resultCounts: {
        nodesExplored: 0,
        edgesExplored: 0,
        pathsFound: 0,
        validPaths: 0
      },
      complexity: {
        time: 'O(n * log n)',
        space: 'O(n)',
        actualTime: 0,
        actualSpace: 0
      },
      executedAt: new Date()
    };

    const startTime = Date.now();

    try {
      let optimizedPaths: ProcurementPath[];
      let paretoFront: ProcurementPath[];

      switch (strategy) {
        case 'PRICE_FIRST':
          optimizedPaths = this.optimizeByPrice(paths, weights);
          paretoFront = this.findParetoFront(optimizedPaths);
          break;

        case 'INVENTORY_FIRST':
          optimizedPaths = this.optimizeByInventory(paths, weights);
          paretoFront = this.findParetoFront(optimizedPaths);
          break;

        case 'LENGTH_FIRST':
          optimizedPaths = this.optimizeByLength(paths, weights);
          paretoFront = this.findParetoFront(optimizedPaths);
          break;

        case 'RELIABILITY_FIRST':
          optimizedPaths = this.optimizeByReliability(paths, weights);
          paretoFront = this.findParetoFront(optimizedPaths);
          break;

        case 'CUSTOM':
          optimizedPaths = this.optimizeByCustomWeights(paths, weights);
          paretoFront = this.findParetoFront(optimizedPaths);
          break;

        case 'BALANCED':
        default:
          // 使用遗传算法进行多目标优化
          const geneticResult = await this.geneticAlgorithmOptimization(paths, weights);
          optimizedPaths = geneticResult.paths;
          paretoFront = geneticResult.paretoFront;
          break;
      }

      // 重新计算所有路径的综合评分
      optimizedPaths = optimizedPaths.map(path => ({
        ...path,
        overallScore: this.calculateOverallScore(path, weights)
      }));

      // 按综合评分排序
      optimizedPaths.sort((a, b) => b.overallScore - a.overallScore);

      record.executionTime = Date.now() - startTime;
      record.complexity.actualTime = record.executionTime;
      record.outputSize = optimizedPaths.length;
      record.resultCounts.pathsFound = optimizedPaths.length;
      record.resultCounts.validPaths = optimizedPaths.length;

      this.executionRecords.push(record);

      return { optimizedPaths, paretoFront };

    } catch (error) {
      record.executionTime = Date.now() - startTime;
      record.complexity.actualTime = record.executionTime;
      this.executionRecords.push(record);
      throw error;
    }
  }

  /**
   * 价格优先优化
   */
  private optimizeByPrice(paths: ProcurementPath[], weights: OptimizationWeights): ProcurementPath[] {
    const priceWeightedWeights = { ...weights, price: 0.8, inventory: 0.1, length: 0.05, reliability: 0.05 };

    return paths
      .map(path => ({
        ...path,
        overallScore: this.calculateOverallScore(path, priceWeightedWeights)
      }))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * 库存优先优化
   */
  private optimizeByInventory(paths: ProcurementPath[], weights: OptimizationWeights): ProcurementPath[] {
    const inventoryWeightedWeights = { ...weights, price: 0.1, inventory: 0.7, length: 0.1, reliability: 0.1 };

    return paths
      .map(path => ({
        ...path,
        overallScore: this.calculateOverallScore(path, inventoryWeightedWeights)
      }))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * 路径长度优先优化
   */
  private optimizeByLength(paths: ProcurementPath[], weights: OptimizationWeights): ProcurementPath[] {
    const lengthWeightedWeights = { ...weights, price: 0.2, inventory: 0.2, length: 0.5, reliability: 0.1 };

    return paths
      .map(path => ({
        ...path,
        overallScore: this.calculateOverallScore(path, lengthWeightedWeights)
      }))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * 可靠性优先优化
   */
  private optimizeByReliability(paths: ProcurementPath[], weights: OptimizationWeights): ProcurementPath[] {
    const reliabilityWeightedWeights = { ...weights, price: 0.15, inventory: 0.15, length: 0.1, reliability: 0.6 };

    return paths
      .map(path => ({
        ...path,
        overallScore: this.calculateOverallScore(path, reliabilityWeightedWeights)
      }))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * 自定义权重优化
   */
  private optimizeByCustomWeights(paths: ProcurementPath[], weights: OptimizationWeights): ProcurementPath[] {
    return paths
      .map(path => ({
        ...path,
        overallScore: this.calculateOverallScore(path, weights)
      }))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * 遗传算法多目标优化
   */
  private async geneticAlgorithmOptimization(
    initialPaths: ProcurementPath[],
    weights: OptimizationWeights
  ): Promise<{
    paths: ProcurementPath[];
    paretoFront: ProcurementPath[];
  }> {
    const populationSize = Math.min(this.config.populationSize, initialPaths.length);
    const maxGenerations = Math.floor(this.config.maxIterations / 10);

    // 初始化种群
    let population = this.initializePopulation(initialPaths, populationSize);

    // 进化循环
    for (let generation = 0; generation < maxGenerations; generation++) {
      // 计算适应度
      population = this.calculateFitness(population, weights);

      // 选择
      const selected = this.selection(population);

      // 交叉
      const offspring = this.crossover(selected);

      // 变异
      const mutated = this.mutation(offspring);

      // 环境选择（保留最优个体）
      population = this.environmentalSelection([...population, ...mutated], populationSize);

      // 检查收敛
      if (this.hasConverged(population, generation)) {
        break;
      }
    }

    // 最终适应度计算
    population = this.calculateFitness(population, weights);

    // 找到帕累托前沿
    const paretoFront = this.findParetoFront(population);

    return {
      paths: population.sort((a, b) => b.overallScore - a.overallScore),
      paretoFront: paretoFront.sort((a, b) => b.overallScore - a.overallScore)
    };
  }

  /**
   * 初始化种群
   */
  private initializePopulation(initialPaths: ProcurementPath[], size: number): ProcurementPath[] {
    if (initialPaths.length <= size) {
      return [...initialPaths];
    }

    // 随机选择初始种群
    const selected: ProcurementPath[] = [];
    const indices = new Set<number>();

    while (selected.length < size && indices.size < initialPaths.length) {
      const index = Math.floor(Math.random() * initialPaths.length);
      if (!indices.has(index)) {
        indices.add(index);
        selected.push(initialPaths[index]);
      }
    }

    return selected;
  }

  /**
   * 计算种群适应度
   */
  private calculateFitness(population: ProcurementPath[], weights: OptimizationWeights): ProcurementPath[] {
    return population.map(path => ({
      ...path,
      overallScore: this.calculateOverallScore(path, weights)
    }));
  }

  /**
   * 选择操作（锦标赛选择）
   */
  private selection(population: ProcurementPath[]): ProcurementPath[] {
    const selected: ProcurementPath[] = [];
    const tournamentSize = 3;

    for (let i = 0; i < population.length; i++) {
      const tournament: ProcurementPath[] = [];

      // 随机选择锦标赛参与者
      for (let j = 0; j < tournamentSize; j++) {
        const randomIndex = Math.floor(Math.random() * population.length);
        tournament.push(population[randomIndex]);
      }

      // 选择最优的
      tournament.sort((a, b) => b.overallScore - a.overallScore);
      selected.push(tournament[0]);
    }

    return selected;
  }

  /**
   * 交叉操作
   */
  private crossover(parents: ProcurementPath[]): ProcurementPath[] {
    const offspring: ProcurementPath[] = [];

    for (let i = 0; i < parents.length - 1; i += 2) {
      const parent1 = parents[i];
      const parent2 = parents[i + 1];

      if (Math.random() < this.config.crossoverRate) {
        // 执行交叉操作
        const child = this.crossoverTwoParents(parent1, parent2);
        offspring.push(child);
      } else {
        // 不交叉，直接复制
        offspring.push({ ...parent1 });
        offspring.push({ ...parent2 });
      }
    }

    return offspring;
  }

  /**
   * 两个父代交叉
   */
  private crossoverTwoParents(parent1: ProcurementPath, parent2: ProcurementPath): ProcurementPath {
    // 简单的交叉：选择价格、库存等指标的中间值
    const child: ProcurementPath = {
      ...parent1,
      id: `genetic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      totalPrice: (parent1.totalPrice + parent2.totalPrice) / 2,
      totalLength: Math.round((parent1.totalLength + parent2.totalLength) / 2),
      availableStock: Math.max(parent1.availableStock, parent2.availableStock),
      estimatedDeliveryTime: (parent1.estimatedDeliveryTime + parent2.estimatedDeliveryTime) / 2,
      priceScore: (parent1.priceScore + parent2.priceScore) / 2,
      inventoryScore: (parent1.inventoryScore + parent2.inventoryScore) / 2,
      lengthScore: (parent1.lengthScore + parent2.lengthScore) / 2,
      reliabilityScore: (parent1.reliabilityScore + parent2.reliabilityScore) / 2,
      overallScore: (parent1.overallScore + parent2.overallScore) / 2,
      metadata: {
        ...parent1.metadata,
        calculatedAt: new Date(),
        algorithm: 'genetic_crossover'
      }
    };

    return child;
  }

  /**
   * 变异操作
   */
  private mutation(population: ProcurementPath[]): ProcurementPath[] {
    return population.map(path => {
      if (Math.random() < this.config.mutationRate) {
        return this.mutatePath(path);
      }
      return path;
    });
  }

  /**
   * 对单条路径进行变异
   */
  private mutatePath(path: ProcurementPath): ProcurementPath {
    // 随机变异某个属性
    const mutationType = Math.floor(Math.random() * 4);
    const mutatedPath = { ...path };

    switch (mutationType) {
      case 0: // 变异价格评分
        mutatedPath.priceScore = Math.max(0, Math.min(1, path.priceScore + (Math.random() - 0.5) * 0.2));
        break;
      case 1: // 变异库存评分
        mutatedPath.inventoryScore = Math.max(0, Math.min(1, path.inventoryScore + (Math.random() - 0.5) * 0.2));
        break;
      case 2: // 变异路径长度评分
        mutatedPath.lengthScore = Math.max(0, Math.min(1, path.lengthScore + (Math.random() - 0.5) * 0.2));
        break;
      case 3: // 变异可靠性评分
        mutatedPath.reliabilityScore = Math.max(0, Math.min(1, path.reliabilityScore + (Math.random() - 0.5) * 0.2));
        break;
    }

    // 重新计算综合评分
    mutatedPath.overallScore = (mutatedPath.priceScore + mutatedPath.inventoryScore +
                               mutatedPath.lengthScore + mutatedPath.reliabilityScore) / 4;

    mutatedPath.id = `mutated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    mutatedPath.metadata = {
      ...mutatedPath.metadata,
      calculatedAt: new Date(),
      algorithm: 'genetic_mutation'
    };

    return mutatedPath;
  }

  /**
   * 环境选择（精英保留策略）
   */
  private environmentalSelection(population: ProcurementPath[], targetSize: number): ProcurementPath[] {
    // 按适应度排序
    population.sort((a, b) => b.overallScore - a.overallScore);

    // 保留前 targetSize 个最优个体
    return population.slice(0, targetSize);
  }

  /**
   * 检查收敛
   */
  private hasConverged(population: ProcurementPath[], generation: number): boolean {
    if (generation < 5) return false; // 前几代不检查收敛

    // 计算适应度方差
    const scores = population.map(p => p.overallScore);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;

    return variance < this.config.convergenceThreshold;
  }

  /**
   * 查找帕累托前沿
   */
  private findParetoFront(paths: ProcurementPath[]): ProcurementPath[] {
    const paretoFront: ProcurementPath[] = [];

    for (const path of paths) {
      let isDominated = false;

      for (const other of paths) {
        if (this.dominates(other, path)) {
          isDominated = true;
          break;
        }
      }

      if (!isDominated) {
        paretoFront.push(path);
      }
    }

    return paretoFront;
  }

  /**
   * 检查 path1 是否支配 path2
   * 支配定义：path1 在所有目标上都不差于 path2，且至少在一个目标上优于 path2
   */
  private dominates(path1: ProcurementPath, path2: ProcurementPath): boolean {
    // 目标：价格（越低越好），库存（越高越好），路径长度（越低越好），可靠性（越高越好）
    const priceBetter = path1.totalPrice <= path2.totalPrice;
    const inventoryBetter = path1.availableStock >= path2.availableStock;
    const lengthBetter = path1.totalLength <= path2.totalLength;
    const reliabilityBetter = path1.reliabilityScore >= path2.reliabilityScore;

    const atLeastOneBetter = (path1.totalPrice < path2.totalPrice) ||
                              (path1.availableStock > path2.availableStock) ||
                              (path1.totalLength < path2.totalLength) ||
                              (path1.reliabilityScore > path2.reliabilityScore);

    return priceBetter && inventoryBetter && lengthBetter && reliabilityBetter && atLeastOneBetter;
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(path: ProcurementPath, weights: OptimizationWeights): number {
    // 归一化权重
    const totalWeight = weights.price + weights.inventory + weights.length + weights.reliability + weights.speed;

    if (totalWeight === 0) return 0;

    const normalizedWeights = {
      price: weights.price / totalWeight,
      inventory: weights.inventory / totalWeight,
      length: weights.length / totalWeight,
      reliability: weights.reliability / totalWeight,
      speed: weights.speed / totalWeight
    };

    return (
      path.priceScore * normalizedWeights.price +
      path.inventoryScore * normalizedWeights.inventory +
      path.lengthScore * normalizedWeights.length +
      path.reliabilityScore * normalizedWeights.reliability +
      this.calculateSpeedScore(path) * normalizedWeights.speed
    );
  }

  /**
   * 计算速度评分
   */
  private calculateSpeedScore(path: ProcurementPath): number {
    // 基于预估配送时间计算速度评分
    const maxDeliveryTime = 7 * 24; // 7天
    return Math.max(0, 1 - path.estimatedDeliveryTime / maxDeliveryTime);
  }

  /**
   * 解析优化权重
   */
  private resolveOptimizationWeights(
    strategy: OptimizationStrategy,
    customWeights?: Partial<OptimizationWeights>
  ): OptimizationWeights {
    let baseWeights: OptimizationWeights;

    switch (strategy) {
      case 'PRICE_FIRST':
        baseWeights = { price: 0.6, inventory: 0.15, length: 0.15, reliability: 0.05, speed: 0.05 };
        break;
      case 'INVENTORY_FIRST':
        baseWeights = { price: 0.15, inventory: 0.6, length: 0.1, reliability: 0.1, speed: 0.05 };
        break;
      case 'LENGTH_FIRST':
        baseWeights = { price: 0.2, inventory: 0.2, length: 0.5, reliability: 0.05, speed: 0.05 };
        break;
      case 'RELIABILITY_FIRST':
        baseWeights = { price: 0.15, inventory: 0.15, length: 0.1, reliability: 0.55, speed: 0.05 };
        break;
      case 'BALANCED':
      default:
        baseWeights = { ...this.defaultWeights };
        break;
    }

    // 应用自定义权重
    if (customWeights) {
      return { ...baseWeights, ...customWeights };
    }

    return baseWeights;
  }

  /**
   * 获取算法名称
   */
  private getAlgorithmName(strategy: OptimizationStrategy): string {
    switch (strategy) {
      case 'PRICE_FIRST':
        return 'price_priority_optimization';
      case 'INVENTORY_FIRST':
        return 'inventory_priority_optimization';
      case 'LENGTH_FIRST':
        return 'length_priority_optimization';
      case 'RELIABILITY_FIRST':
        return 'reliability_priority_optimization';
      case 'CUSTOM':
        return 'custom_weight_optimization';
      case 'BALANCED':
      default:
        return 'genetic_algorithm_optimization';
    }
  }

  /**
   * 计算平均路径长度
   */
  private calculateAveragePathLength(paths: ProcurementPath[]): number {
    if (paths.length === 0) return 0;
    const totalLength = paths.reduce((sum, path) => sum + path.totalLength, 0);
    return totalLength / paths.length;
  }

  /**
   * 计算平均价格
   */
  private calculateAveragePrice(paths: ProcurementPath[]): number {
    if (paths.length === 0) return 0;
    const totalPrice = paths.reduce((sum, path) => sum + path.totalPrice, 0);
    return totalPrice / paths.length;
  }

  /**
   * 找到价格最优路径
   */
  private findBestByPrice(paths: ProcurementPath[]): ProcurementPath | null {
    if (paths.length === 0) return null;
    return paths.reduce((best, current) =>
      current.totalPrice < best.totalPrice ? current : best
    );
  }

  /**
   * 找到长度最短路径
   */
  private findBestByLength(paths: ProcurementPath[]): ProcurementPath | null {
    if (paths.length === 0) return null;
    return paths.reduce((best, current) =>
      current.totalLength < best.totalLength ? current : best
    );
  }

  /**
   * 找到库存最优路径
   */
  private findBestByInventory(paths: ProcurementPath[]): ProcurementPath | null {
    if (paths.length === 0) return null;
    return paths.reduce((best, current) =>
      current.availableStock > best.availableStock ? current : best
    );
  }

  /**
   * 找到可靠性最优路径
   */
  private findBestByReliability(paths: ProcurementPath[]): ProcurementPath | null {
    if (paths.length === 0) return null;
    return paths.reduce((best, current) =>
      current.reliabilityScore > best.reliabilityScore ? current : best
    );
  }

  /**
   * 找到综合评分最优路径
   */
  private findBestByOverall(paths: ProcurementPath[]): ProcurementPath | null {
    if (paths.length === 0) return null;
    return paths.reduce((best, current) =>
      current.overallScore > best.overallScore ? current : best
    );
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(responseTime: number, success: boolean): void {
    this.responseTimes.push(responseTime);

    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    if (success) {
      this.performanceMetrics.successfulRequests++;
    } else {
      this.performanceMetrics.failedRequests++;
    }

    this.performanceMetrics.minResponseTime = Math.min(
      this.performanceMetrics.minResponseTime,
      responseTime
    );
    this.performanceMetrics.maxResponseTime = Math.max(
      this.performanceMetrics.maxResponseTime,
      responseTime
    );

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.performanceMetrics.averageResponseTime = sum / this.responseTimes.length;
    this.performanceMetrics.averageOptimizationTime = sum / this.responseTimes.length;

    this.performanceMetrics.errorRate =
      this.performanceMetrics.failedRequests / this.performanceMetrics.totalRequests;

    this.performanceMetrics.lastUpdated = new Date();
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * 获取算法执行记录
   */
  getExecutionRecords(limit: number = 100): AlgorithmExecutionRecord[] {
    return this.executionRecords.slice(-limit);
  }

  /**
   * 批量优化路径
   */
  async batchOptimizePaths(
    requests: Array<{
      buyerId: string;
      productId: string;
      quantity: number;
      strategy?: OptimizationStrategy;
      customWeights?: Partial<OptimizationWeights>;
    }>
  ): Promise<OptimizationResult[]> {
    logger.info(`开始批量路径优化，请求数量: ${requests.length}`);

    const results: OptimizationResult[] = [];
    const batchSize = this.config.batchSize;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      const batchPromises = batch.map(request =>
        this.optimizeProcurementPath(
          request.buyerId,
          request.productId,
          request.quantity,
          request.strategy || 'BALANCED',
          request.customWeights
        )
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        logger.debug(`批量处理完成 ${i + batch.length}/${requests.length} 个请求`);

      } catch (error) {
        logger.error('批量优化中的部分请求失败', {
          batchSize: batch.length,
          error: error instanceof Error ? error.message : '未知错误'
        });

        // 继续处理其他批次
        continue;
      }
    }

    logger.info(`批量路径优化完成，成功处理 ${results.length}/${requests.length} 个请求`);
    return results;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.executionRecords = [];
    this.responseTimes = [];

    logger.info('路径优化服务资源已清理');
  }
}

// 导出单例实例
export const pathOptimizerService = new PathOptimizerService();