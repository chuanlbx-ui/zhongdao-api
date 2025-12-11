
// 用户等级类型定义
export type UserLevel = 'NORMAL' | 'VIP' | 'STAR_1' | 'STAR_2' | 'STAR_3' | 'STAR_4' | 'STAR_5' | 'DIRECTOR';

// 用户模型类型
export type User = {
  id: string;
  phone: string;
  openid?: string;
  nickname: string;
  level: UserLevel;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
  parentId?: string;
  teamPath: string;
  pointsBalance: number;
  pointsFrozen: number;
  referralCode: string;
  createdAt: Date;
  updatedAt: Date;
};

// 认证请求扩展
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone: string;
    openid: string;
    nickname: string;
    level: string;
    role: string;
    scope: string[];
  };
}


/**
 * 全局类型定义
 * 定义应用中常用的类型，避免使用any
 */

import { Request } from 'express';


// 扩展Express Request类型
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phone: string;
    nickname: string;
    level: UserLevel;
    role: string;
    parentId?: string;
    teamPath?: string;
  };
  requestId?: string;
}

// 分页参数
export interface PaginationParams {
  page?: number;
  perPage?: number;
}

// 分页结果
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// 日期范围
export interface DateRange {
  startDate?: Date;
  endDate?: Date;
}

// 排序参数
export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

// 通用查询参数
export interface QueryParams extends PaginationParams {
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 金额类型
export type Amount = number;

// ID类型
export type ID = string;

// 状态枚举
export enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

// 操作结果
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// 批量操作结果
export interface BatchOperationResult {
  total: number;
  success: number;
  failed: number;
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

// 配置值类型
export type ConfigValue = string | number | boolean | object;

// 环境类型
export type Environment = 'development' | 'production' | 'test';

// 日志级别
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

// 事件类型
export interface Event<T = any> {
  type: string;
  data: T;
  timestamp: Date;
  userId?: string;
  requestId?: string;
}

// 队列任务
export interface QueueJob<T = any> {
  id: string;
  type: string;
  data: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  processedAt?: Date;
}

// 缓存选项
export interface CacheOptions {
  ttl?: number; // 生存时间（秒）
  tags?: string[]; // 缓存标签
}

// 导出/导入参数
export interface ExportParams {
  format: 'csv' | 'excel' | 'json';
  fields: string[];
  filters?: Record<string, any>;
  dateRange?: DateRange;
}

// 导入结果
export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    field: string;
    value: any;
    error: string;
  }>;
}

// 角色类型
export type Role = 'ADMIN' | 'DIRECTOR' | 'MANAGER' | 'USER';

// 权限类型
export type Permission = string;

// 用户上下文
export interface UserContext {
  id: ID;
  phone: string;
  nickname: string;
  level: UserLevel;
  role: Role;
  permissions: Permission[];
  parentId?: ID;
  teamPath?: string;
}

// API元数据
export interface ApiMetadata {
  version: string;
  endpoint: string;
  method: string;
  duration: number;
  statusCode: number;
  requestId: string;
  userId?: string;
}

// 健康检查结果
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  services: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime?: number;
    error?: string;
  }>;
  timestamp: Date;
}

// 审计日志条目
export interface AuditLogEntry {
  id: ID;
  userId: ID;
  action: string;
  resource: string;
  resourceId?: ID;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

// 统计数据
export interface StatisticsData {
  count: number;
  sum?: number;
  average?: number;
  min?: number;
  max?: number;
  groups?: Array<{
    key: string;
    count: number;
    sum?: number;
  }>;
}

// 图表数据点
export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
  metadata?: Record<string, any>;
}

// 推荐类型（用于替代函数重载）
export type Callback<T = void> = (data: T) => void;
export type Predicate<T = any> = (value: T) => boolean;
export type Transformer<T, U> = (value: T) => U;
export type AsyncFunction<T = any> = () => Promise<T>;

// 深度部分类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 必需的键
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// 可选的键
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// 提取数组元素的类型
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

// 提取Promise的返回类型
export type PromiseReturnType<T> = T extends Promise<infer U> ? U : never;

// 提取函数的返回类型
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;