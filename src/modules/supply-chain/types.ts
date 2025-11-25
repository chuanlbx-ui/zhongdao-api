/**
 * 供应链路径优化系统类型定义
 * 支持多层级供应链的智能路径查找和优化
 */

import { UserLevel } from '../user/level.service';

// ===========================================
// 基础数据类型
// ===========================================

/**
 * 供应链节点接口
 */
export interface SupplyChainNode {
  id: string;
  userId: string;
  level: UserLevel;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  teamPath?: string;
  parentId?: string;
  children: string[]; // 直接下级ID列表
  metadata: {
    totalSales: number;
    teamSize: number;
    joinDate: Date;
    lastActiveDate?: Date;
  };
}

/**
 * 供应链边接口（供应关系）
 */
export interface SupplyChainEdge {
  id: string;
  fromUserId: string;  // 供应方
  toUserId: string;    // 采购方
  relationship: 'DIRECT' | 'INDIRECT' | 'CROSS_LEVEL';
  level: number;       // 关系层级深度
  isActive: boolean;
  metadata: {
    transactionCount: number;
    totalVolume: number;
    lastTransactionDate?: Date;
    averageResponseTime: number;
  };
}

/**
 * 供应链图结构
 */
export interface SupplyChainGraph {
  nodes: Map<string, SupplyChainNode>;
  edges: Map<string, SupplyChainEdge[]>;
  adjacencyMatrix: number[][];  // 邻接矩阵，用于快速路径查找
  nodeIndexMap: Map<string, number>;  // 节点ID到矩阵索引的映射
  lastUpdated: Date;
  version: number;
}

// ===========================================
// 路径相关类型
// ===========================================

/**
 * 采购路径节点
 */
export interface PathNode {
  userId: string;
  level: UserLevel;
  role: 'buyer' | 'supplier' | 'intermediate';
  price: number;
  availableStock: number;
  distance: number;  // 距离采购方的层级数
  metadata: {
    responseTime: number;
    reliability: number;  // 可靠性评分 0-1
    commissionRate: number;
  };
}

/**
 * 完整采购路径
 */
export interface ProcurementPath {
  id: string;
  buyerId: string;
  productId: string;
  quantity: number;
  path: PathNode[];

  // 路径指标
  totalPrice: number;
  totalLength: number;  // 路径长度（节点数）
  availableStock: number;
  estimatedDeliveryTime: number;

  // 优化指标
  priceScore: number;      // 价格评分 (0-1, 越低越好)
  inventoryScore: number;  // 库存评分 (0-1, 越高越好)
  lengthScore: number;     // 长度评分 (0-1, 越低越好)
  reliabilityScore: number; // 可靠性评分 (0-1, 越高越好)

  // 综合评分
  overallScore: number;    // 综合评分 (0-1, 越高越好)

  // 元数据
  metadata: {
    calculatedAt: Date;
    algorithm: string;
    weights: OptimizationWeights;
    searchDepth: number;
    alternativePaths: number;
  };
}

/**
 * 路径查找选项
 */
export interface PathFindOptions {
  maxDepth?: number;           // 最大搜索深度
  maxPaths?: number;           // 最大返回路径数
  requireMinimumStock?: boolean; // 是否要求最小库存
  excludeInactiveSuppliers?: boolean; // 是否排除非活跃供应商
  preferredSuppliers?: string[]; // 偏好供应商列表
  blacklistedSuppliers?: string[]; // 黑名单供应商

  // 搜索策略
  searchStrategy?: 'BFS' | 'DFS' | 'DIJKSTRA' | 'A_STAR';

  // 过滤条件
  levelFilter?: {
    minLevel?: UserLevel;
    maxLevel?: UserLevel;
  };

  // 价格限制
  priceRange?: {
    min?: number;
    max?: number;
  };

  // 性能选项
  useCache?: boolean;
  timeoutMs?: number;
}

/**
 * 路径验证结果
 */
export interface PathValidationResult {
  isValid: boolean;
  isComplete: boolean;     // 路径是否完整（从头到尾）
  hasValidPermissions: boolean; // 是否有采购权限
  hasSufficientStock: boolean;  // 库存是否充足
  reasons: string[];
  warnings: string[];

  // 详细验证信息
  validationDetails: {
    levelCompliance: boolean;  // 等级规则合规性
    teamRelationship: boolean; // 团队关系有效性
    inventoryCheck: boolean;   // 库存检查结果
    priceValidation: boolean;  // 价格验证结果
    pathContinuity: boolean;   // 路径连续性
  };

  metadata: {
    validatedAt: Date;
    validationTime: number;  // 验证耗时(ms)
    checkedNodes: number;
    checkedEdges: number;
  };
}

// ===========================================
// 优化相关类型
// ===========================================

/**
 * 优化权重配置
 */
export interface OptimizationWeights {
  price: number;        // 价格权重 (0-1)
  inventory: number;    // 库存权重 (0-1)
  length: number;       // 路径长度权重 (0-1)
  reliability: number;  // 可靠性权重 (0-1)
  speed: number;        // 响应速度权重 (0-1)
}

/**
 * 多目标优化结果
 */
export interface OptimizationResult {
  paths: ProcurementPath[];
  ParetoFront: ProcurementPath[];  // 帕累托最优解集

  // 统计信息
  statistics: {
    totalPathsExplored: number;
    validPathsFound: number;
    averagePathLength: number;
    averagePrice: number;
    optimizationTime: number;
  };

  // 最优路径（按不同指标）
  bestPaths: {
    byPrice: ProcurementPath | null;
    byLength: ProcurementPath | null;
    byInventory: ProcurementPath | null;
    byReliability: ProcurementPath | null;
    byOverall: ProcurementPath | null;
  };

  metadata: {
    optimizedAt: Date;
    algorithm: string;
    weights: OptimizationWeights;
    convergenceCriteria: string;
  };
}

/**
 * 路径优化策略
 */
export type OptimizationStrategy =
  | 'PRICE_FIRST'      // 价格优先
  | 'INVENTORY_FIRST'  // 库存优先
  | 'LENGTH_FIRST'     // 路径最短优先
  | 'BALANCED'         // 平衡优化
  | 'RELIABILITY_FIRST'// 可靠性优先
  | 'CUSTOM';          // 自定义权重

// ===========================================
// 缓存相关类型
// ===========================================

/**
 * 缓存条目
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  ttl: number;  // 生存时间(ms)
  size: number; // 占用空间(bytes)
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  totalEntries: number;
  totalSize: number;  // 总占用空间(bytes)
  hitRate: number;    // 命中率(0-1)
  missRate: number;   // 未命中率(0-1)
  evictionCount: number; // 驱逐次数

  // 性能指标
  averageAccessTime: number;  // 平均访问时间(μs)
  memoryUsage: number;        // 内存使用量(bytes)

  // 时间窗口统计
  windowStats: {
    hits: number;
    misses: number;
    evictions: number;
    startTime: Date;
  };
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  maxSize: number;         // 最大条目数
  maxMemory: number;       // 最大内存使用量(bytes)
  defaultTtl: number;      // 默认TTL(ms)

  // 驱逐策略
  evictionPolicy: 'LRU' | 'LFU' | 'TTL' | 'SIZE_BASED';

  // 性能选项
  enableStats: boolean;    // 是否启用统计
  compressionEnabled: boolean; // 是否启用压缩
  backgroundCleanup: boolean;  // 是否启用后台清理

  // 清理配置
  cleanupInterval: number; // 清理间隔(ms)
  cleanupBatchSize: number; // 清理批次大小
}

// ===========================================
// 性能监控类型
// ===========================================

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  // 请求统计
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;

  // 响应时间统计
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;

  // 算法性能
  averageSearchTime: number;
  averageOptimizationTime: number;
  averageValidationTime: number;

  // 缓存性能
  cacheHitRate: number;
  cacheMissRate: number;

  // 资源使用
  memoryUsage: number;
  cpuUsage: number;

  // 错误统计
  errorRate: number;
  timeoutRate: number;

  lastUpdated: Date;
}

/**
 * 算法执行记录
 */
export interface AlgorithmExecutionRecord {
  id: string;
  algorithm: string;
  inputSize: number;
  outputSize: number;
  executionTime: number;
  memoryUsage: number;

  // 执行详情
  parameters: Record<string, any>;
  resultCounts: {
    nodesExplored: number;
    edgesExplored: number;
    pathsFound: number;
    validPaths: number;
  };

  // 性能指标
  complexity: {
    time: string;      // 时间复杂度表示
    space: string;     // 空间复杂度表示
    actualTime: number; // 实际执行时间(ms)
    actualSpace: number; // 实际空间使用(bytes)
  };

  executedAt: Date;
}

// ===========================================
// 错误和异常类型
// ===========================================

/**
 * 供应链错误类型
 */
export enum SupplyChainErrorType {
  NETWORK_NOT_BUILT = 'NETWORK_NOT_BUILT',           // 供应链网络未构建
  INVALID_NODE = 'INVALID_NODE',                     // 无效节点
  INVALID_EDGE = 'INVALID_EDGE',                     // 无效边
  PATH_NOT_FOUND = 'PATH_NOT_FOUND',                 // 路径未找到
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',         // 库存不足
  PERMISSION_DENIED = 'PERMISSION_DENIED',           // 权限不足
  OPTIMIZATION_FAILED = 'OPTIMIZATION_FAILED',       // 优化失败
  VALIDATION_FAILED = 'VALIDATION_FAILED',           // 验证失败
  CACHE_ERROR = 'CACHE_ERROR',                       // 缓存错误
  TIMEOUT = 'TIMEOUT',                               // 超时
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',         // 循环引用
  INCONSISTENT_DATA = 'INCONSISTENT_DATA',           // 数据不一致
}

/**
 * 供应链异常
 */
export class SupplyChainError extends Error {
  public readonly type: SupplyChainErrorType;
  public readonly code: string;
  public readonly details: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    type: SupplyChainErrorType,
    message: string,
    details: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'SupplyChainError';
    this.type = type;
    this.code = `SUPPLY_CHAIN_${type}`;
    this.details = details;
    this.timestamp = new Date();
  }
}

// ===========================================
// 配置类型
// ===========================================

/**
 * 路径优化器配置
 */
export interface PathOptimizerConfig {
  // 算法配置
  defaultAlgorithm: string;
  maxSearchDepth: number;
  maxPaths: number;

  // 优化配置
  defaultWeights: OptimizationWeights;
  optimizationStrategy: OptimizationStrategy;

  // 缓存配置
  cache: CacheConfig;

  // 性能配置
  performance: {
    enableMonitoring: boolean;
    enableProfiling: boolean;
    maxExecutionTime: number;
    batchSize: number;
  };

  // 业务规则配置
  businessRules: {
    allowCrossLevelTransactions: boolean;
    requireTeamMembership: boolean;
    enforceMinimumStock: boolean;
    enableBlacklist: boolean;
  };

  // 网络配置
  network: {
    autoRebuild: boolean;
    rebuildInterval: number;
    incrementalUpdate: boolean;
  };
}

// ===========================================
// 事件类型
// ===========================================

/**
 * 供应链事件类型
 */
export enum SupplyChainEventType {
  NETWORK_BUILT = 'NETWORK_BUILT',
  NETWORK_UPDATED = 'NETWORK_UPDATED',
  PATH_FOUND = 'PATH_FOUND',
  PATH_OPTIMIZED = 'PATH_OPTIMIZED',
  CACHE_HIT = 'CACHE_HIT',
  CACHE_MISS = 'CACHE_MISS',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  PERFORMANCE_WARNING = 'PERFORMANCE_WARNING',
}

/**
 * 供应链事件
 */
export interface SupplyChainEvent {
  type: SupplyChainEventType;
  timestamp: Date;
  source: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}