import { Stream } from 'stream';

// 统一API响应格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  message?: string;
  timestamp: string;
  requestId?: string;
  meta?: ResponseMeta;
  code?: string; // 业务操作代码
}

// 错误响应格式
export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  field?: string;
  timestamp: string;
}

// 响应元数据
export interface ResponseMeta {
  version?: string;
  server?: string;
  executionTime?: number;
  cache?: CacheMeta;
  pagination?: PaginationMeta;
}

// 缓存元数据
export interface CacheMeta {
  cached: boolean;
  ttl?: number;
  key?: string;
}

// 分页元数据
export interface PaginationMeta {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 分页响应格式
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// 业务错误码
export enum ErrorCode {
  // 通用错误码
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // 用户相关错误码
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  USER_LEVEL_INVALID = 'USER_LEVEL_INVALID',
  USER_STATUS_INACTIVE = 'USER_STATUS_INACTIVE',
  USER_AUTHENTICATION_FAILED = 'USER_AUTHENTICATION_FAILED',

  // 店铺相关错误码
  SHOP_NOT_FOUND = 'SHOP_NOT_FOUND',
  SHOP_ALREADY_EXISTS = 'SHOP_ALREADY_EXISTS',
  SHOP_APPLICATION_PENDING = 'SHOP_APPLICATION_PENDING',
  SHOP_LEVEL_INSUFFICIENT = 'SHOP_LEVEL_INSUFFICIENT',

  // 采购相关错误码
  PURCHASE_INVALID_PERMISSION = 'PURCHASE_INVALID_PERMISSION',
  PURCHASE_INSUFFICIENT_POINTS = 'PURCHASE_INSUFFICIENT_POINTS',
  PURCHASE_INSUFFICIENT_INVENTORY = 'PURCHASE_INSUFFICIENT_INVENTORY',
  PURCHASE_CONFLICT = 'PURCHASE_CONFLICT',

  // 通券相关错误码
  POINTS_INSUFFICIENT_BALANCE = 'POINTS_INSUFFICIENT_BALANCE',
  POINTS_TRANSFER_LIMIT_EXCEEDED = 'POINTS_TRANSFER_LIMIT_EXCEEDED',
  POINTS_WITHDRAWAL_PENDING = 'POINTS_WITHDRAWAL_PENDING',
  POINTS_RECHARGE_DISABLED = 'POINTS_RECHARGE_DISABLED',

  // 业务规则错误码
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  BUSINESS_STATE_INVALID = 'BUSINESS_STATE_INVALID',

  // 系统错误码
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR',
  SYSTEM_EXTERNAL_SERVICE_ERROR = 'SYSTEM_EXTERNAL_SERVICE_ERROR',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
}

// HTTP状态码映射
export const getHttpStatus = (errorCode: ErrorCode): number => {
  switch (errorCode) {
    case ErrorCode.NOT_FOUND:
      return 404;
    case ErrorCode.UNAUTHORIZED:
      return 401;
    case ErrorCode.FORBIDDEN:
      return 403;
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.CONFLICT:
      return 400;
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return 429;
    case ErrorCode.INTERNAL_ERROR:
    default:
      return 500;
  }
};

// 请求查询参数
export interface QueryParams {
  page?: number;
  perPage?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: any;
}

// 分页查询参数
export interface PaginatedQueryParams extends QueryParams {
  page: number;
  perPage: number;
}

// 创建成功响应
export const createSuccessResponse = <T>(
  data: T,
  message?: string,
  meta?: ResponseMeta,
  requestId?: string,
  code?: string
): ApiResponse<T> => ({
  success: true,
  data,
  message,
  timestamp: new Date().toISOString(),
  requestId,
  meta,
  code
});

// 创建错误响应
export const createErrorResponse = (
  code: ErrorCode,
  message?: string,
  details?: any,
  field?: string,
  requestId?: string
): ApiResponse<never> => ({
  success: false,
  error: {
    code,
    message: message || getDefaultErrorMessage(code),
    details,
    field,
    timestamp: new Date().toISOString()
  },
  timestamp: new Date().toISOString(),
  requestId
});

// 创建分页响应
export const createPaginatedResponse = <T>(
  items: T[],
  totalCount: number,
  page: number,
  perPage: number,
  message?: string,
  requestId?: string,
  meta?: Omit<ResponseMeta, 'pagination'>
): ApiResponse<PaginatedResponse<T>> => {
  const totalPages = Math.ceil(totalCount / perPage);

  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        perPage,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    },
    message,
    timestamp: new Date().toISOString(),
    requestId,
    meta: {
      ...meta,
      pagination: {
        page,
        perPage,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  };
};

// 创建空响应
export const createEmptyResponse = (
  message?: string,
  requestId?: string,
  code?: string
): ApiResponse<null> => ({
  success: true,
  data: null,
  message,
  timestamp: new Date().toISOString(),
  requestId,
  code
});

// 创建批量操作响应
export const createBatchResponse = <T>(
  results: Array<{
    success: boolean;
    data?: T;
    error?: string;
    index?: number;
  }>,
  message?: string,
  requestId?: string
): ApiResponse<{
  total: number;
  successCount: number;
  failureCount: number;
  results: typeof results;
}> => {
  const total = results.length;
  const successCount = results.filter(r => r.success).length;
  const failureCount = total - successCount;

  return {
    success: true,
    data: {
      total,
      successCount,
      failureCount,
      results
    },
    message,
    timestamp: new Date().toISOString(),
    requestId
  };
};

// 创建文件下载响应
export const createFileResponse = (
  filename: string,
  contentType: string,
  data: Buffer | Stream,
  requestId?: string
): {
  headers: Record<string, string>;
  data: Buffer | Stream;
} => ({
  headers: {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'X-Request-ID': requestId || '',
    'X-Timestamp': new Date().toISOString()
  },
  data
});

// 获取默认错误消息
const getDefaultErrorMessage = (code: ErrorCode): string => {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
    [ErrorCode.VALIDATION_ERROR]: '请求参数验证失败',
    [ErrorCode.NOT_FOUND]: '请求的资源不存在',
    [ErrorCode.BAD_REQUEST]: '请求参数错误',
    [ErrorCode.CONFIG_NOT_FOUND]: '配置不存在',
    [ErrorCode.UNAUTHORIZED]: '未授权访问',
    [ErrorCode.FORBIDDEN]: '权限不足',
    [ErrorCode.CONFLICT]: '资源冲突',
    [ErrorCode.RATE_LIMIT_EXCEEDED]: '请求过于频繁',

    [ErrorCode.USER_NOT_FOUND]: '用户不存在',
    [ErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
    [ErrorCode.USER_LEVEL_INVALID]: '用户等级无效',
    [ErrorCode.USER_STATUS_INACTIVE]: '用户状态不活跃',
    [ErrorCode.USER_AUTHENTICATION_FAILED]: '用户认证失败',

    [ErrorCode.SHOP_NOT_FOUND]: '店铺不存在',
    [ErrorCode.SHOP_ALREADY_EXISTS]: '店铺已存在',
    [ErrorCode.SHOP_APPLICATION_PENDING]: '店铺申请待审核',
    [ErrorCode.SHOP_LEVEL_INSUFFICIENT]: '店铺等级不足',

    [ErrorCode.PURCHASE_INVALID_PERMISSION]: '采购权限无效',
    [ErrorCode.PURCHASE_INSUFFICIENT_POINTS]: '通券余额不足',
    [ErrorCode.PURCHASE_INSUFFICIENT_INVENTORY]: '库存不足',
    [ErrorCode.PURCHASE_CONFLICT]: '采购冲突',

    [ErrorCode.POINTS_INSUFFICIENT_BALANCE]: '通券余额不足',
    [ErrorCode.POINTS_TRANSFER_LIMIT_EXCEEDED]: '转账限额超出',
    [ErrorCode.POINTS_WITHDRAWAL_PENDING]: '提现申请待处理',
    [ErrorCode.POINTS_RECHARGE_DISABLED]: '充值功能未启用',

    [ErrorCode.BUSINESS_RULE_VIOLATION]: '违反业务规则',
    [ErrorCode.BUSINESS_LOGIC_ERROR]: '业务逻辑错误',
    [ErrorCode.BUSINESS_STATE_INVALID]: '业务状态无效',

    [ErrorCode.SYSTEM_DATABASE_ERROR]: '数据库错误',
    [ErrorCode.SYSTEM_EXTERNAL_SERVICE_ERROR]: '外部服务错误',
    [ErrorCode.OPERATION_TIMEOUT]: '操作超时'
  };

  return messages[code] || '未知错误';
};