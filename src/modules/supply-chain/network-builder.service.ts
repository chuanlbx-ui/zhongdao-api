/**
 * 供应链网络建模服务
 * 负责构建和维护多层级供应链的图数据结构
 * 支持增量更新、实时同步和性能优化
 */

import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { UserLevel } from '../user/level.service';
import {
  SupplyChainNode,
  SupplyChainEdge,
  SupplyChainGraph,
  SupplyChainError,
  SupplyChainErrorType,
  PerformanceMetrics,
  AlgorithmExecutionRecord
} from './types';

export class NetworkBuilderService {
  private graph: SupplyChainGraph | null = null;
  private isBuilding = false;
  private buildPromise: Promise<void> | null = null;
  private lastBuildTime: Date | null = null;
  private buildVersion = 0;

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
    maxNodes: 10000,
    maxEdges: 50000,
    buildTimeoutMs: 30000,
    incrementalUpdateInterval: 60000, // 1分钟
    maxRetryAttempts: 3,
    batchSize: 1000
  };

  /**
   * 构建完整的供应链网络图
   * @param forceRebuild 是否强制重新构建
   * @returns 构建结果
   */
  async buildSupplyChainGraph(forceRebuild: boolean = false): Promise<SupplyChainGraph> {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;

    // 检查是否需要重新构建
    if (!forceRebuild && this.graph && this.isGraphValid()) {
      logger.debug('供应链网络图有效，直接返回');
      return this.graph;
    }

    // 防止并发构建
    if (this.isBuilding && this.buildPromise) {
      logger.debug('网络图正在构建中，等待完成...');
      await this.buildPromise;
      return this.graph!;
    }

    this.isBuilding = true;

    try {
      this.buildPromise = this.performBuild();
      await this.buildPromise;

      const buildTime = Date.now() - startTime;
      this.updatePerformanceMetrics(buildTime, true);

      logger.info('供应链网络图构建成功', {
        version: this.buildVersion,
        nodeCount: this.graph!.nodes.size,
        edgeCount: this.calculateTotalEdges(),
        buildTime: `${buildTime}ms`,
        memoryUsage: process.memoryUsage()
      });

      return this.graph!;

    } catch (error) {
      const buildTime = Date.now() - startTime;
      this.updatePerformanceMetrics(buildTime, false);

      logger.error('构建供应链网络图失败', {
        error: error instanceof Error ? error.message : '未知错误',
        buildTime: `${buildTime}ms`,
        stack: error instanceof Error ? error.stack : undefined
      });

      throw new SupplyChainError(
        SupplyChainErrorType.NETWORK_NOT_BUILT,
        '构建供应链网络图失败',
        { error, buildTime }
      );
    } finally {
      this.isBuilding = false;
      this.buildPromise = null;
      this.lastBuildTime = new Date();
    }
  }

  /**
   * 执行实际的构建过程
   */
  private async performBuild(): Promise<void> {
    const buildStartTime = Date.now();
    const record: AlgorithmExecutionRecord = {
      id: `build_${Date.now()}`,
      algorithm: 'network_builder',
      inputSize: 0,
      outputSize: 0,
      executionTime: 0,
      memoryUsage: 0,
      parameters: { forceRebuild: false },
      resultCounts: {
        nodesExplored: 0,
        edgesExplored: 0,
        pathsFound: 0,
        validPaths: 0
      },
      complexity: {
        time: 'O(n + e)',
        space: 'O(n^2)',
        actualTime: 0,
        actualSpace: 0
      },
      executedAt: new Date()
    };

    try {
      // 1. 获取所有用户数据
      const users = await this.fetchAllUsers();
      record.inputSize = users.length;
      record.resultCounts.nodesExplored = users.length;

      // 2. 创建节点
      const nodes = new Map<string, SupplyChainNode>();
      const nodeIndexMap = new Map<string, number>();

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const node = this.createSupplyChainNode(user);
        nodes.set(user.id, node);
        nodeIndexMap.set(user.id, i);
      }

      // 3. 创建边（供应关系）
      const edges = new Map<string, SupplyChainEdge[]>();
      let edgeCount = 0;

      for (const user of users) {
        if (user.parentId && nodes.has(user.parentId)) {
          const edge = this.createSupplyChainEdge(user.parentId, user.id);

          if (!edges.has(user.parentId)) {
            edges.set(user.parentId, []);
          }
          edges.get(user.parentId)!.push(edge);
          edgeCount++;
        }
      }

      record.resultCounts.edgesExplored = edgeCount;

      // 4. 构建邻接矩阵
      const adjacencyMatrix = this.buildAdjacencyMatrix(nodes, edges, nodeIndexMap);

      // 5. 更新子节点关系
      this.updateChildRelationships(nodes, edges);

      // 6. 创建图结构
      this.graph = {
        nodes,
        edges,
        adjacencyMatrix,
        nodeIndexMap,
        lastUpdated: new Date(),
        version: ++this.buildVersion
      };

      record.outputSize = nodes.size;
      record.executionTime = Date.now() - buildStartTime;
      record.complexity.actualTime = record.executionTime;
      record.complexity.actualSpace = this.estimateMemoryUsage();

      this.executionRecords.push(record);

    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取所有用户数据
   */
  private async fetchAllUsers(): Promise<any[]> {
    logger.debug('开始获取用户数据...');

    try {
      const users = await prisma.users.findMany({
        where: {
          status: 'ACTIVE'  // 只获取活跃用户
        },
        select: {
          id: true,
          level: true,
          status: true,
          parentId: true,
          teamPath: true,
          totalSales: true,
          directCount: true,
          teamCount: true,
          createdAt: true,
          lastLoginAt: true
        },
        orderBy: {
          createdAt: 'asc'
        },
        take: this.config.maxNodes
      });

      logger.debug(`获取到 ${users.length} 个用户`);

      // 验证数据完整性
      this.validateUserData(users);

      return users;

    } catch (error) {
      logger.error('获取用户数据失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw new SupplyChainError(
        SupplyChainErrorType.INCONSISTENT_DATA,
        '获取用户数据失败',
        { error }
      );
    }
  }

  /**
   * 验证用户数据完整性
   */
  private validateUserData(users: any[]): void {
    const issues: string[] = [];
    const userIds = new Set<string>();

    // 检查重复ID
    for (const user of users) {
      if (userIds.has(user.id)) {
        issues.push(`重复的用户ID: ${user.id}`);
      }
      userIds.add(user.id);
    }

    // 检查父节点引用
    for (const user of users) {
      if (user.parentId && !userIds.has(user.parentId)) {
        issues.push(`用户 ${user.id} 引用了不存在的父节点: ${user.parentId}`);
      }
    }

    // 检查循环引用
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const user of users) {
      if (this.hasCircularReference(user.id, users, visited, recursionStack)) {
        issues.push(`检测到循环引用，涉及用户: ${user.id}`);
      }
    }

    if (issues.length > 0) {
      logger.warn('用户数据验证发现问题', { issues });
      // 在生产环境中，我们可能需要处理这些问题，而不是直接抛出错误
      // 但为了确保数据质量，这里先抛出错误
      throw new SupplyChainError(
        SupplyChainErrorType.INCONSISTENT_DATA,
        '用户数据验证失败',
        { issues }
      );
    }
  }

  /**
   * 检查循环引用
   */
  private hasCircularReference(
    userId: string,
    users: any[],
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(userId)) {
      return true;
    }

    if (visited.has(userId)) {
      return false;
    }

    visited.add(userId);
    recursionStack.add(userId);

    const user = users.find(u => u.id === userId);
    if (user && user.parentId) {
      return this.hasCircularReference(user.parentId, users, visited, recursionStack);
    }

    recursionStack.delete(userId);
    return false;
  }

  /**
   * 创建供应链节点
   */
  private createSupplyChainNode(user: any): SupplyChainNode {
    return {
      id: user.id,
      userId: user.id,
      level: user.level as UserLevel,
      status: user.status,
      teamPath: user.teamPath,
      parentId: user.parentId,
      children: [],  // 稍后填充
      metadata: {
        totalSales: user.totalSales || 0,
        teamSize: user.teamCount || 0,
        joinDate: user.createdAt,
        lastActiveDate: user.lastLoginAt
      }
    };
  }

  /**
   * 创建供应链边
   */
  private createSupplyChainEdge(fromUserId: string, toUserId: string): SupplyChainEdge {
    return {
      id: `${fromUserId}_${toUserId}`,
      fromUserId,
      toUserId,
      relationship: 'DIRECT',
      level: 1,
      isActive: true,
      metadata: {
        transactionCount: 0,
        totalVolume: 0,
        averageResponseTime: 0
      }
    };
  }

  /**
   * 构建邻接矩阵
   */
  private buildAdjacencyMatrix(
    nodes: Map<string, SupplyChainNode>,
    edges: Map<string, SupplyChainEdge[]>,
    nodeIndexMap: Map<string, number>
  ): number[][] {
    const size = nodes.size;
    const matrix: number[][] = Array(size).fill(null).map(() => Array(size).fill(0));

    // 填充邻接矩阵
    for (const [fromUserId, edgeList] of edges) {
      const fromIndex = nodeIndexMap.get(fromUserId);
      if (fromIndex === undefined) continue;

      for (const edge of edgeList) {
        const toIndex = nodeIndexMap.get(edge.toUserId);
        if (toIndex === undefined) continue;

        // 设置边的权重（这里使用1表示直接连接）
        matrix[fromIndex][toIndex] = 1;
      }
    }

    return matrix;
  }

  /**
   * 更新子节点关系
   */
  private updateChildRelationships(
    nodes: Map<string, SupplyChainNode>,
    edges: Map<string, SupplyChainEdge[]>
  ): void {
    // 清空所有子节点列表
    for (const node of nodes.values()) {
      node.children = [];
    }

    // 根据边关系重建子节点列表
    for (const edgeList of edges.values()) {
      for (const edge of edgeList) {
        const parentNode = nodes.get(edge.fromUserId);
        if (parentNode) {
          parentNode.children.push(edge.toUserId);
        }
      }
    }
  }

  /**
   * 计算总边数
   */
  private calculateTotalEdges(): number {
    if (!this.graph) return 0;

    let total = 0;
    for (const edgeList of this.graph.edges.values()) {
      total += edgeList.length;
    }
    return total;
  }

  /**
   * 估算内存使用量
   */
  private estimateMemoryUsage(): number {
    if (!this.graph) return 0;

    const nodeSize = this.graph.nodes.size * 200; // 每个节点约200字节
    const edgeSize = this.calculateTotalEdges() * 150; // 每条边约150字节
    const matrixSize = this.graph.adjacencyMatrix.length * this.graph.adjacencyMatrix.length * 8; // 矩阵大小

    return nodeSize + edgeSize + matrixSize;
  }

  /**
   * 验证图结构是否有效
   */
  private isGraphValid(): boolean {
    if (!this.graph || !this.lastBuildTime) {
      return false;
    }

    // 检查构建时间是否过期
    const now = new Date();
    const timeDiff = now.getTime() - this.lastBuildTime.getTime();

    // 如果超过5分钟，认为需要重新构建
    return timeDiff < this.config.incrementalUpdateInterval;
  }

  /**
   * 增量更新供应链网络
   * @param userIds 需要更新的用户ID列表
   */
  async incrementalUpdate(userIds: string[]): Promise<void> {
    if (!this.graph) {
      logger.warn('图结构不存在，执行完整构建');
      await this.buildSupplyChainGraph();
      return;
    }

    logger.debug(`开始增量更新 ${userIds.length} 个用户节点`);

    try {
      // 获取更新的用户数据
      const updatedUsers = await prisma.users.findMany({
        where: {
          id: { in: userIds },
          status: 'ACTIVE'
        },
        select: {
          id: true,
          level: true,
          status: true,
          parentId: true,
          teamPath: true,
          totalSales: true,
          directCount: true,
          teamCount: true,
          createdAt: true,
          lastLoginAt: true
        }
      });

      // 更新节点
      for (const user of updatedUsers) {
        const node = this.createSupplyChainNode(user);

        // 更新或添加节点
        if (this.graph.nodes.has(user.id)) {
          // 保留现有的子节点关系
          const existingNode = this.graph.nodes.get(user.id)!;
          node.children = existingNode.children;
        }

        this.graph.nodes.set(user.id, node);
      }

      // 更新边关系
      this.updateEdgesForUsers(updatedUsers);

      // 重建邻接矩阵
      this.graph.adjacencyMatrix = this.buildAdjacencyMatrix(
        this.graph.nodes,
        this.graph.edges,
        this.graph.nodeIndexMap
      );

      this.graph.lastUpdated = new Date();
      this.graph.version++;

      logger.debug('增量更新完成', {
        updatedUsers: updatedUsers.length,
        newVersion: this.graph.version
      });

    } catch (error) {
      logger.error('增量更新失败，回退到完整构建', {
        userIds,
        error: error instanceof Error ? error.message : '未知错误'
      });

      // 增量更新失败，执行完整构建
      await this.buildSupplyChainGraph(true);
    }
  }

  /**
   * 更新指定用户的边关系
   */
  private updateEdgesForUsers(users: any[]): void {
    if (!this.graph) return;

    // 获取受影响的用户ID（包括他们的父节点和子节点）
    const affectedUserIds = new Set<string>(users.map(u => u.id));

    for (const user of users) {
      if (user.parentId) {
        affectedUserIds.add(user.parentId);
      }

      const node = this.graph.nodes.get(user.id);
      if (node) {
        node.children.forEach(childId => affectedUserIds.add(childId));
      }
    }

    // 清除受影响用户的边关系
    for (const userId of affectedUserIds) {
      this.graph.edges.delete(userId);
    }

    // 重新建立边关系
    for (const user of users) {
      if (user.parentId && this.graph.nodes.has(user.parentId)) {
        const edge = this.createSupplyChainEdge(user.parentId, user.id);

        if (!this.graph.edges.has(user.parentId)) {
          this.graph.edges.set(user.parentId, []);
        }
        this.graph.edges.get(user.parentId)!.push(edge);
      }
    }

    // 重建子节点关系
    this.updateChildRelationships(this.graph.nodes, this.graph.edges);
  }

  /**
   * 获取当前图结构
   */
  getGraph(): SupplyChainGraph | null {
    return this.graph;
  }

  /**
   * 获取节点信息
   */
  getNode(userId: string): SupplyChainNode | null {
    return this.graph?.nodes.get(userId) || null;
  }

  /**
   * 获取节点的直接下级
   */
  getChildren(userId: string): SupplyChainNode[] {
    if (!this.graph) return [];

    const node = this.graph.nodes.get(userId);
    if (!node) return [];

    return node.children
      .map(childId => this.graph.nodes.get(childId))
      .filter(Boolean) as SupplyChainNode[];
  }

  /**
   * 获取节点的直接上级
   */
  getParent(userId: string): SupplyChainNode | null {
    if (!this.graph) return null;

    const node = this.graph.nodes.get(userId);
    if (!node || !node.parentId) return null;

    return this.graph.nodes.get(node.parentId) || null;
  }

  /**
   * 检查两个节点是否相连
   */
  areConnected(fromUserId: string, toUserId: string): boolean {
    if (!this.graph) return false;

    const fromIndex = this.graph.nodeIndexMap.get(fromUserId);
    const toIndex = this.graph.nodeIndexMap.get(toUserId);

    if (fromIndex === undefined || toIndex === undefined) {
      return false;
    }

    return this.graph.adjacencyMatrix[fromIndex][toIndex] > 0;
  }

  /**
   * 更新性能指标
   */
  private updatePerformanceMetrics(responseTime: number, success: boolean): void {
    this.responseTimes.push(responseTime);

    // 保持最近1000次响应时间记录
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }

    if (success) {
      this.performanceMetrics.successfulRequests++;
    } else {
      this.performanceMetrics.failedRequests++;
    }

    // 更新响应时间统计
    this.performanceMetrics.minResponseTime = Math.min(
      this.performanceMetrics.minResponseTime,
      responseTime
    );
    this.performanceMetrics.maxResponseTime = Math.max(
      this.performanceMetrics.maxResponseTime,
      responseTime
    );

    // 计算平均响应时间
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.performanceMetrics.averageResponseTime = sum / this.responseTimes.length;

    // 计算百分位数
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    this.performanceMetrics.p95ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    this.performanceMetrics.p99ResponseTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

    // 更新错误率
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
    this.graph = null;
    this.isBuilding = false;
    this.buildPromise = null;
    this.lastBuildTime = null;
    this.executionRecords = [];
    this.responseTimes = [];

    logger.info('网络构建服务资源已清理');
  }
}

// 导出单例实例
export const networkBuilderService = new NetworkBuilderService();