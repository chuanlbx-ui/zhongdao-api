/**
 * 供应链路径查找服务
 * 实现多种路径搜索算法，支持多层级供应链的智能路径查找
 * 包括BFS、DFS、Dijkstra、A*等算法的优化实现
 */

import { logger } from '@/shared/utils/logger';
import { prisma } from '@/shared/database/client';
import { UserLevel, userLevelService } from '../user/level.service';
import { networkBuilderService } from './network-builder.service';
import {
  SupplyChainNode,
  SupplyChainEdge,
  ProcurementPath,
  PathNode,
  PathFindOptions,
  PathValidationResult,
  SupplyChainError,
  SupplyChainErrorType,
  AlgorithmExecutionRecord,
  PerformanceMetrics
} from './types';

export class PathFinderService {
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

  // 配置参数
  private readonly config = {
    maxSearchDepth: 10,
    defaultMaxPaths: 10,
    searchTimeoutMs: 5000,
    maxNodesPerSearch: 1000,
    batchSize: 100,
    enableCaching: true,
    cacheTtl: 300000 // 5分钟
  };

  // 简单的路径缓存
  private pathCache = new Map<string, { path: ProcurementPath; timestamp: number }>();

  /**
   * 查找最优采购路径
   * @param buyerId 采购方ID
   * @param productId 商品ID
   * @param quantity 采购数量
   * @param options 查找选项
   * @returns 最优路径
   */
  async findOptimalProcurementPath(
    buyerId: string,
    productId: string,
    quantity: number,
    options: PathFindOptions = {}
  ): Promise<ProcurementPath | null> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    try {
      // 参数验证
      this.validateSearchParams(buyerId, productId, quantity);

      // 检查缓存
      if (options.useCache !== false && this.config.enableCaching) {
        const cachedPath = this.getCachedPath(buyerId, productId, quantity, options);
        if (cachedPath) {
          this.updatePerformanceMetrics(Date.now() - startTime, true);
          return cachedPath;
        }
      }

      // 确保供应链图已构建
      const graph = await networkBuilderService.buildSupplyChainGraph();
      if (!graph) {
        throw new SupplyChainError(
          SupplyChainErrorType.NETWORK_NOT_BUILT,
          '供应链网络图未构建'
        );
      }

      // 执行路径搜索
      const paths = await this.findMultiplePaths(buyerId, productId, quantity, options);

      if (paths.length === 0) {
        logger.debug('未找到有效的采购路径', { buyerId, productId, quantity });
        return null;
      }

      // 选择最优路径（默认按综合评分）
      const optimalPath = paths.reduce((best, current) =>
        current.overallScore > best.overallScore ? current : best
      );

      // 缓存结果
      if (this.config.enableCaching) {
        this.cachePath(optimalPath);
      }

      const searchTime = Date.now() - startTime;
      this.updatePerformanceMetrics(searchTime, true);

      logger.debug('找到最优采购路径', {
        buyerId,
        productId,
        quantity,
        pathLength: optimalPath.path.length,
        totalPrice: optimalPath.totalPrice,
        overallScore: optimalPath.overallScore,
        searchTime: `${searchTime}ms`
      });

      return optimalPath;

    } catch (error) {
      const searchTime = Date.now() - startTime;
      this.updatePerformanceMetrics(searchTime, false);

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
        '查找采购路径失败',
        { buyerId, productId, quantity, error }
      );
    }
  }

  /**
   * 查找多个可能的采购路径
   * @param buyerId 采购方ID
   * @param productId 商品ID
   * @param quantity 采购数量
   * @param options 查找选项
   * @returns 路径列表
   */
  async findMultiplePaths(
    buyerId: string,
    productId: string,
    quantity: number,
    options: PathFindOptions = {}
  ): Promise<ProcurementPath[]> {
    const startTime = Date.now();
    const record: AlgorithmExecutionRecord = {
      id: `search_${Date.now()}`,
      algorithm: options.searchStrategy || 'BFS',
      inputSize: 0,
      outputSize: 0,
      executionTime: 0,
      memoryUsage: 0,
      parameters: { buyerId, productId, quantity, options },
      resultCounts: {
        nodesExplored: 0,
        edgesExplored: 0,
        pathsFound: 0,
        validPaths: 0
      },
      complexity: {
        time: 'O(b^d)',
        space: 'O(b^d)',
        actualTime: 0,
        actualSpace: 0
      },
      executedAt: new Date()
    };

    try {
      const graph = await networkBuilderService.buildSupplyChainGraph();
      if (!graph) {
        throw new SupplyChainError(
          SupplyChainErrorType.NETWORK_NOT_BUILT,
          '供应链网络图未构建'
        );
      }

      const maxDepth = options.maxDepth || this.config.maxSearchDepth;
      const maxPaths = options.maxPaths || this.config.defaultMaxPaths;

      // 获取采购方信息
      const buyerNode = graph.nodes.get(buyerId);
      if (!buyerNode) {
        throw new SupplyChainError(
          SupplyChainErrorType.INVALID_NODE,
          `采购方 ${buyerId} 不存在`
        );
      }

      record.inputSize = graph.nodes.size;

      // 根据搜索策略选择算法
      let rawPaths: PathNode[][] = [];

      switch (options.searchStrategy || 'BFS') {
        case 'BFS':
          rawPaths = await this.breadthFirstSearch(graph, buyerId, maxDepth);
          break;
        case 'DFS':
          rawPaths = await this.depthFirstSearch(graph, buyerId, maxDepth);
          break;
        case 'DIJKSTRA':
          rawPaths = await this.dijkstraSearch(graph, buyerId, maxDepth);
          break;
        case 'A_STAR':
          rawPaths = await this.aStarSearch(graph, buyerId, maxDepth);
          break;
        default:
          rawPaths = await this.breadthFirstSearch(graph, buyerId, maxDepth);
      }

      record.resultCounts.nodesExplored = rawPaths.reduce((sum, path) => sum + path.length, 0);

      // 转换为 ProcurementPath 并验证
      const validPaths: ProcurementPath[] = [];

      for (const rawPath of rawPaths.slice(0, maxPaths * 2)) { // 多搜索一些路径用于筛选
        try {
          const path = await this.convertToProcurementPath(
            rawPath,
            buyerId,
            productId,
            quantity
          );

          const validation = await this.validatePath(path);
          if (validation.isValid) {
            validPaths.push(path);
            if (validPaths.length >= maxPaths) break;
          }
        } catch (error) {
          // 忽略单个路径转换错误
          continue;
        }
      }

      record.resultCounts.pathsFound = rawPaths.length;
      record.resultCounts.validPaths = validPaths.length;
      record.outputSize = validPaths.length;
      record.executionTime = Date.now() - startTime;
      record.complexity.actualTime = record.executionTime;

      this.executionRecords.push(record);

      return validPaths;

    } catch (error) {
      record.executionTime = Date.now() - startTime;
      record.complexity.actualTime = record.executionTime;
      this.executionRecords.push(record);

      throw error;
    }
  }

  /**
   * 广度优先搜索 (BFS)
   */
  private async breadthFirstSearch(
    graph: any,
    startUserId: string,
    maxDepth: number
  ): Promise<PathNode[][]> {
    const paths: PathNode[][] = [];
    const queue: Array<{ userId: string; depth: number; path: PathNode[] }> = [{
      userId: startUserId,
      depth: 0,
      path: []
    }];

    const visited = new Set<string>();
    const startTime = Date.now();

    while (queue.length > 0 && Date.now() - startTime < this.config.searchTimeoutMs) {
      const { userId, depth, path } = queue.shift()!;

      // 检查深度限制
      if (depth > maxDepth) continue;

      // 获取当前用户信息
      const currentUser = graph.nodes.get(userId);
      if (!currentUser || currentUser.status !== 'ACTIVE') continue;

      // 创建当前节点
      const currentNode: PathNode = {
        userId,
        level: currentUser.level,
        role: depth === 0 ? 'buyer' : (depth === maxDepth ? 'supplier' : 'intermediate'),
        price: 0, // 稍后计算
        availableStock: 0, // 稍后查询
        distance: depth,
        metadata: {
          responseTime: 0,
          reliability: 1.0,
          commissionRate: 0
        }
      };

      const currentPath = [...path, currentNode];

      // 如果达到最大深度且有充足库存，添加到结果
      if (depth > 0 && depth <= maxDepth) {
        paths.push(currentPath);
      }

      // 继续向上搜索
      const parentNode = this.getParentNode(graph, userId);
      if (parentNode && !visited.has(parentNode.id)) {
        visited.add(parentNode.id);
        queue.push({
          userId: parentNode.id,
          depth: depth + 1,
          path: currentPath
        });
      }
    }

    return paths;
  }

  /**
   * 深度优先搜索 (DFS)
   */
  private async depthFirstSearch(
    graph: any,
    startUserId: string,
    maxDepth: number
  ): Promise<PathNode[][]> {
    const paths: PathNode[][] = [];

    const dfs = async (
      userId: string,
      depth: number,
      path: PathNode[],
      visited: Set<string>
    ) => {
      if (depth > maxDepth || visited.has(userId)) return;

      const currentUser = graph.nodes.get(userId);
      if (!currentUser || currentUser.status !== 'ACTIVE') return;

      const currentNode: PathNode = {
        userId,
        level: currentUser.level,
        role: depth === 0 ? 'buyer' : (depth === maxDepth ? 'supplier' : 'intermediate'),
        price: 0,
        availableStock: 0,
        distance: depth,
        metadata: {
          responseTime: 0,
          reliability: 1.0,
          commissionRate: 0
        }
      };

      const currentPath = [...path, currentNode];
      visited.add(userId);

      if (depth > 0) {
        paths.push(currentPath);
      }

      const parentNode = this.getParentNode(graph, userId);
      if (parentNode) {
        await dfs(parentNode.id, depth + 1, currentPath, new Set(visited));
      }
    };

    await dfs(startUserId, 0, [], new Set<string>());
    return paths;
  }

  /**
   * Dijkstra 最短路径搜索
   */
  private async dijkstraSearch(
    graph: any,
    startUserId: string,
    maxDepth: number
  ): Promise<PathNode[][]> {
    const paths: PathNode[][] = [];
    const distances = new Map<string, number>();
    const previousNodes = new Map<string, PathNode>();
    const unvisited = new Set<string>();

    // 初始化距离
    for (const userId of graph.nodes.keys()) {
      distances.set(userId, userId === startUserId ? 0 : Infinity);
      unvisited.add(userId);
    }

    while (unvisited.size > 0) {
      // 找到最小距离的未访问节点
      let currentUserId: string | null = null;
      let minDistance = Infinity;

      for (const userId of unvisited) {
        const distance = distances.get(userId) || Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          currentUserId = userId;
        }
      }

      if (!currentUserId || minDistance === Infinity) break;

      unvisited.delete(currentUserId);

      const currentUser = graph.nodes.get(currentUserId);
      if (!currentUser || currentUser.status !== 'ACTIVE') continue;

      // 创建路径节点
      const pathNode: PathNode = {
        userId: currentUserId,
        level: currentUser.level,
        role: currentUserId === startUserId ? 'buyer' : 'supplier',
        price: 0,
        availableStock: 0,
        distance: minDistance,
        metadata: {
          responseTime: 0,
          reliability: 1.0,
          commissionRate: 0
        }
      };

      previousNodes.set(currentUserId, pathNode);

      // 如果达到有效供应商且在深度限制内，构建路径
      if (currentUserId !== startUserId && minDistance <= maxDepth) {
        const path = this.buildPathFromPrevious(previousNodes, startUserId, currentUserId);
        paths.push(path);
      }

      // 更新邻居节点的距离
      const parentNode = this.getParentNode(graph, currentUserId);
      if (parentNode && unvisited.has(parentNode.id)) {
        const newDistance = minDistance + 1;
        if (newDistance < (distances.get(parentNode.id) || Infinity)) {
          distances.set(parentNode.id, newDistance);
        }
      }
    }

    return paths;
  }

  /**
   * A* 启发式搜索
   */
  private async aStarSearch(
    graph: any,
    startUserId: string,
    maxDepth: number
  ): Promise<PathNode[][]> {
    const paths: PathNode[][] = [];
    const openSet = new Set<string>([startUserId]);
    const closedSet = new Set<string>();
    const gScore = new Map<string, number>(); // 从起点到当前节点的实际代价
    const fScore = new Map<string, number>(); // 启发式总代价
    const cameFrom = new Map<string, PathNode>();

    // 初始化分数
    for (const userId of graph.nodes.keys()) {
      gScore.set(userId, userId === startUserId ? 0 : Infinity);
      fScore.set(userId, userId === startUserId ? this.heuristic(startUserId, userId) : Infinity);
    }

    while (openSet.size > 0) {
      // 找到 fScore 最小的节点
      let currentUserId: string | null = null;
      let minFScore = Infinity;

      for (const userId of openSet) {
        const score = fScore.get(userId) || Infinity;
        if (score < minFScore) {
          minFScore = score;
          currentUserId = userId;
        }
      }

      if (!currentUserId) break;

      // 如果找到目标供应商
      if (currentUserId !== startUserId && (gScore.get(currentUserId) || 0) <= maxDepth) {
        const path = this.buildPathFromCameFrom(cameFrom, startUserId, currentUserId);
        paths.push(path);
      }

      openSet.delete(currentUserId);
      closedSet.add(currentUserId);

      const currentUser = graph.nodes.get(currentUserId);
      if (!currentUser || currentUser.status !== 'ACTIVE') continue;

      // 探索父节点
      const parentNode = this.getParentNode(graph, currentUserId);
      if (!parentNode || closedSet.has(parentNode.id)) continue;

      const tentativeGScore = (gScore.get(currentUserId) || 0) + 1;

      if (tentativeGScore < (gScore.get(parentNode.id) || Infinity)) {
        const pathNode: PathNode = {
          userId: currentUserId,
          level: currentUser.level,
          role: currentUserId === startUserId ? 'buyer' : 'intermediate',
          price: 0,
          availableStock: 0,
          distance: tentativeGScore,
          metadata: {
            responseTime: 0,
            reliability: 1.0,
            commissionRate: 0
          }
        };

        cameFrom.set(parentNode.id, pathNode);
        gScore.set(parentNode.id, tentativeGScore);
        fScore.set(parentNode.id, tentativeGScore + this.heuristic(startUserId, parentNode.id));

        if (!openSet.has(parentNode.id)) {
          openSet.add(parentNode.id);
        }
      }
    }

    return paths;
  }

  /**
   * 启发式函数
   */
  private heuristic(fromUserId: string, toUserId: string): number {
    // 简单的启发式：基于等级差异
    // 这里可以根据实际业务需求调整
    return 1;
  }

  /**
   * 从 previousNodes 构建路径
   */
  private buildPathFromPrevious(
    previousNodes: Map<string, PathNode>,
    startUserId: string,
    endUserId: string
  ): PathNode[] {
    const path: PathNode[] = [];
    let currentUserId = endUserId;

    while (currentUserId !== startUserId) {
      const node = previousNodes.get(currentUserId);
      if (!node) break;

      path.unshift(node);
      const currentUser = networkBuilderService.getNode(currentUserId);
      currentUserId = currentUser?.parentId || startUserId;
    }

    // 添加起始节点
    const startNode = networkBuilderService.getNode(startUserId);
    if (startNode) {
      path.unshift({
        userId: startUserId,
        level: startNode.level,
        role: 'buyer',
        price: 0,
        availableStock: 0,
        distance: 0,
        metadata: {
          responseTime: 0,
          reliability: 1.0,
          commissionRate: 0
        }
      });
    }

    return path;
  }

  /**
   * 从 cameFrom 构建路径
   */
  private buildPathFromCameFrom(
    cameFrom: Map<string, PathNode>,
    startUserId: string,
    endUserId: string
  ): PathNode[] {
    const path: PathNode[] = [];
    let currentUserId = endUserId;

    while (currentUserId !== startUserId) {
      const node = cameFrom.get(currentUserId);
      if (!node) break;

      path.unshift(node);
      currentUserId = node.userId;
    }

    // 添加起始节点
    const startNode = networkBuilderService.getNode(startUserId);
    if (startNode) {
      path.unshift({
        userId: startUserId,
        level: startNode.level,
        role: 'buyer',
        price: 0,
        availableStock: 0,
        distance: 0,
        metadata: {
          responseTime: 0,
          reliability: 1.0,
          commissionRate: 0
        }
      });
    }

    return path;
  }

  /**
   * 获取父节点
   */
  private getParentNode(graph: any, userId: string): any {
    const node = graph.nodes.get(userId);
    if (!node || !node.parentId) return null;

    return graph.nodes.get(node.parentId);
  }

  /**
   * 转换为 ProcurementPath
   */
  private async convertToProcurementPath(
    pathNodes: PathNode[],
    buyerId: string,
    productId: string,
    quantity: number
  ): Promise<ProcurementPath> {
    if (pathNodes.length < 2) {
      throw new SupplyChainError(
        SupplyChainErrorType.PATH_NOT_FOUND,
        '路径长度不足'
      );
    }

    // 批量获取价格和库存信息
    const supplierIds = [pathNodes[pathNodes.length - 1].userId];
    const priceInfos = await this.batchGetPriceInfo(supplierIds, productId);
    const stockInfos = await this.batchGetStockInfo(supplierIds, productId);

    // 更新路径节点信息
    const supplierId = pathNodes[pathNodes.length - 1].userId;
    const priceInfo = priceInfos.get(supplierId);
    const stockInfo = stockInfos.get(supplierId);

    if (!priceInfo || !stockInfo) {
      throw new SupplyChainError(
        SupplyChainErrorType.INVALID_NODE,
        '无法获取供应商价格或库存信息'
      );
    }

    pathNodes[pathNodes.length - 1].price = priceInfo.price;
    pathNodes[pathNodes.length - 1].availableStock = stockInfo.stock;

    // 计算路径指标
    const totalPrice = this.calculateTotalPrice(pathNodes, quantity);
    const totalLength = pathNodes.length - 1; // 减去采购方
    const availableStock = stockInfo.stock;
    const estimatedDeliveryTime = this.calculateDeliveryTime(pathNodes);

    // 计算评分
    const priceScore = this.calculatePriceScore(totalPrice, productId);
    const inventoryScore = this.calculateInventoryScore(availableStock, quantity);
    const lengthScore = this.calculateLengthScore(totalLength);
    const reliabilityScore = this.calculateReliabilityScore(pathNodes);

    // 综合评分
    const overallScore = this.calculateOverallScore(
      priceScore,
      inventoryScore,
      lengthScore,
      reliabilityScore
    );

    return {
      id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      buyerId,
      productId,
      quantity,
      path: pathNodes,
      totalPrice,
      totalLength,
      availableStock,
      estimatedDeliveryTime,
      priceScore,
      inventoryScore,
      lengthScore,
      reliabilityScore,
      overallScore,
      metadata: {
        calculatedAt: new Date(),
        algorithm: 'BFS',
        weights: { price: 0.4, inventory: 0.3, length: 0.2, reliability: 0.1, speed: 0 },
        searchDepth: totalLength,
        alternativePaths: 0
      }
    };
  }

  /**
   * 批量获取价格信息
   */
  private async batchGetPriceInfo(
    userIds: string[],
    productId: string
  ): Promise<Map<string, { price: number; userLevel: UserLevel }>> {
    const priceInfos = new Map<string, { price: number; userLevel: UserLevel }>();

    try {
      const pricings = await prisma.productPricings.findMany({
        where: {
          productId,
          userLevel: { in: ['NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'] as UserLevel[] }
        },
        orderBy: { price: 'asc' }
      });

      // 按用户等级获取用户
      const users = await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, level: true }
      });

      for (const user of users) {
        const pricing = pricings.find(p => p.userLevel === user.level);
        if (pricing) {
          priceInfos.set(user.id, {
            price: pricing.price,
            userLevel: user.level as UserLevel
          });
        }
      }

    } catch (error) {
      logger.error('批量获取价格信息失败', { userIds, productId });
    }

    return priceInfos;
  }

  /**
   * 批量获取库存信息
   */
  private async batchGetStockInfo(
    userIds: string[],
    productId: string
  ): Promise<Map<string, { stock: number; warehouseType: string }>> {
    const stockInfos = new Map<string, { stock: number; warehouseType: string }>();

    try {
      const stocks = await prisma.inventoryStocks.findMany({
        where: {
          productId,
          userId: { in: userIds }
        },
        select: {
          userId: true,
          quantity: true,
          warehouseType: true
        }
      });

      for (const stock of stocks) {
        stockInfos.set(stock.userId, {
          stock: stock.quantity,
          warehouseType: stock.warehouseType
        });
      }

    } catch (error) {
      logger.error('批量获取库存信息失败', { userIds, productId });
    }

    return stockInfos;
  }

  /**
   * 计算总价格
   */
  private calculateTotalPrice(pathNodes: PathNode[], quantity: number): number {
    // 使用最终供应商的价格
    const supplierNode = pathNodes[pathNodes.length - 1];
    return supplierNode.price * quantity;
  }

  /**
   * 计算配送时间
   */
  private calculateDeliveryTime(pathNodes: PathNode[]): number {
    // 简单计算：每个层级增加24小时
    return pathNodes.length * 24;
  }

  /**
   * 计算价格评分 (0-1, 越低越好)
   */
  private calculatePriceScore(totalPrice: number, productId: string): number {
    // 这里需要参考市场平均价格或历史价格
    // 简化实现：假设合理的价格范围
    const reasonablePrice = 1000; // 假设合理价格
    const score = Math.max(0, 1 - (totalPrice - reasonablePrice) / reasonablePrice);
    return Math.min(1, score);
  }

  /**
   * 计算库存评分 (0-1, 越高越好)
   */
  private calculateInventoryScore(availableStock: number, requiredQuantity: number): number {
    if (availableStock >= requiredQuantity * 2) {
      return 1.0; // 库存充足
    } else if (availableStock >= requiredQuantity) {
      return 0.8; // 库存刚好够
    } else {
      return 0.3; // 库存不足
    }
  }

  /**
   * 计算路径长度评分 (0-1, 越低越好)
   */
  private calculateLengthScore(pathLength: number): number {
    // 路径越短越好
    const maxLength = 5;
    return Math.max(0, 1 - (pathLength - 1) / maxLength);
  }

  /**
   * 计算可靠性评分 (0-1, 越高越好)
   */
  private calculateReliabilityScore(pathNodes: PathNode[]): number {
    // 基于路径中所有节点的可靠性计算
    let totalReliability = 0;
    for (const node of pathNodes) {
      totalReliability += node.metadata.reliability;
    }
    return totalReliability / pathNodes.length;
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(
    priceScore: number,
    inventoryScore: number,
    lengthScore: number,
    reliabilityScore: number
  ): number {
    // 默认权重
    const weights = { price: 0.4, inventory: 0.3, length: 0.2, reliability: 0.1 };

    return (
      priceScore * weights.price +
      inventoryScore * weights.inventory +
      lengthScore * weights.length +
      reliabilityScore * weights.reliability
    );
  }

  /**
   * 验证路径有效性
   */
  async validatePath(path: ProcurementPath): Promise<PathValidationResult> {
    const startTime = Date.now();
    const reasons: string[] = [];
    const warnings: string[] = [];

    try {
      // 1. 路径完整性检查
      const isComplete = path.path.length >= 2 &&
        path.path[0].userId === path.buyerId &&
        path.path[path.path.length - 1].role === 'supplier';

      if (!isComplete) {
        reasons.push('路径不完整或不正确');
      }

      // 2. 采购权限检查
      let hasValidPermissions = true;
      for (let i = 0; i < path.path.length - 1; i++) {
        const current = path.path[i];
        const next = path.path[i + 1];

        // 检查等级关系：只能向更高级别采购
        const levels = Object.values(UserLevel);
        const currentLevelIndex = levels.indexOf(current.level);
        const nextLevelIndex = levels.indexOf(next.level);

        if (nextLevelIndex <= currentLevelIndex) {
          hasValidPermissions = false;
          reasons.push(`节点 ${current.userId} 不能向同级或低级的 ${next.userId} 采购`);
        }
      }

      // 3. 库存检查
      const hasSufficientStock = path.availableStock >= path.quantity;
      if (!hasSufficientStock) {
        reasons.push(`库存不足：需要 ${path.quantity}，可用 ${path.availableStock}`);
      }

      // 4. 价格验证
      const hasValidPrice = path.totalPrice > 0;
      if (!hasValidPrice) {
        reasons.push('价格信息无效');
      }

      // 5. 路径连续性检查
      let hasPathContinuity = true;
      for (let i = 0; i < path.path.length - 1; i++) {
        const current = path.path[i];
        const next = path.path[i + 1];

        // 检查是否在供应链网络中确实相连
        const isConnected = networkBuilderService.areConnected(current.userId, next.userId);
        if (!isConnected) {
          hasPathContinuity = false;
          warnings.push(`节点 ${current.userId} 和 ${next.userId} 可能没有直接的供应关系`);
        }
      }

      const isValid = reasons.length === 0 && isComplete && hasValidPermissions &&
                     hasSufficientStock && hasValidPrice;

      const validationTime = Date.now() - startTime;

      return {
        isValid,
        isComplete,
        hasValidPermissions,
        hasSufficientStock,
        reasons,
        warnings,
        validationDetails: {
          levelCompliance: hasValidPermissions,
          teamRelationship: true, // 假设团队关系正确
          inventoryCheck: hasSufficientStock,
          priceValidation: hasValidPrice,
          pathContinuity: hasPathContinuity
        },
        metadata: {
          validatedAt: new Date(),
          validationTime,
          checkedNodes: path.path.length,
          checkedEdges: path.path.length - 1
        }
      };

    } catch (error) {
      const validationTime = Date.now() - startTime;

      return {
        isValid: false,
        isComplete: false,
        hasValidPermissions: false,
        hasSufficientStock: false,
        reasons: ['验证过程中发生错误'],
        warnings: [],
        validationDetails: {
          levelCompliance: false,
          teamRelationship: false,
          inventoryCheck: false,
          priceValidation: false,
          pathContinuity: false
        },
        metadata: {
          validatedAt: new Date(),
          validationTime,
          checkedNodes: 0,
          checkedEdges: 0
        }
      };
    }
  }

  /**
   * 验证搜索参数
   */
  private validateSearchParams(buyerId: string, productId: string, quantity: number): void {
    if (!buyerId || typeof buyerId !== 'string') {
      throw new SupplyChainError(
        SupplyChainErrorType.INVALID_NODE,
        '采购方ID无效'
      );
    }

    if (!productId || typeof productId !== 'string') {
      throw new SupplyChainError(
        SupplyChainErrorType.INVALID_NODE,
        '商品ID无效'
      );
    }

    if (!quantity || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new SupplyChainError(
        SupplyChainErrorType.INVALID_NODE,
        '采购数量必须是正整数'
      );
    }
  }

  /**
   * 获取缓存的路径
   */
  private getCachedPath(
    buyerId: string,
    productId: string,
    quantity: number,
    options: PathFindOptions
  ): ProcurementPath | null {
    const cacheKey = `${buyerId}_${productId}_${quantity}_${JSON.stringify(options)}`;
    const cached = this.pathCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.config.cacheTtl) {
      this.performanceMetrics.cacheHitRate =
        (this.performanceMetrics.cacheHitRate + 1) / (this.performanceMetrics.totalRequests + 1);
      return cached.path;
    }

    this.performanceMetrics.cacheMissRate =
      (this.performanceMetrics.cacheMissRate + 1) / (this.performanceMetrics.totalRequests + 1);
    return null;
  }

  /**
   * 缓存路径
   */
  private cachePath(path: ProcurementPath): void {
    const cacheKey = `${path.buyerId}_${path.productId}_${path.quantity}`;

    // 清理过期缓存
    this.cleanupExpiredCache();

    this.pathCache.set(cacheKey, {
      path,
      timestamp: Date.now()
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.pathCache.entries()) {
      if (now - value.timestamp > this.config.cacheTtl) {
        this.pathCache.delete(key);
      }
    }
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
   * 清理资源
   */
  cleanup(): void {
    this.pathCache.clear();
    this.executionRecords = [];
    this.responseTimes = [];

    logger.info('路径查找服务资源已清理');
  }
}

// 导出单例实例
export const pathFinderService = new PathFinderService();