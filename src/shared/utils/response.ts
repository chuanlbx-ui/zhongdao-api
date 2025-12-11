/**
 * 统一的API响应格式工具
 * 确保所有API返回一致的响应格式
 */

import { Response } from 'express';

// API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
  meta?: {
    pagination?: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
    requestId: string;
  };
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T = any>(
  data?: T,
  message?: string,
  meta?: ApiResponse<T>['meta']
): ApiResponse<T> {
  const response: ApiResponse<T> = {
    success: true,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: generateRequestId(),
      ...meta
    }
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.data = {
      ...(response.data || {} as T),
      message
    } as T;
  }

  return response;
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  status?: number
): { response: ApiResponse; status: number } {
  return {
    response: {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString()
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: generateRequestId()
      }
    },
    status: status || 400
  };
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T = any>(
  data: T[],
  pagination: ApiResponse['meta']['pagination'],
  message?: string
): ApiResponse<T[]> {
  return createSuccessResponse(
    data,
    message,
    {
      pagination,
      timestamp: new Date().toISOString(),
      requestId: generateRequestId()
    }
  );
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * 标准化错误代码
 */
export const ERROR_CODES = {
  // 通用错误
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // 认证相关
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // 业务错误
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  PHONE_EXISTS: 'PHONE_EXISTS',
  INVALID_OPERATION: 'INVALID_OPERATION',

  // 系统错误
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
} as const;

/**
 * HTTP状态码映射
 */
export const STATUS_CODES = {
  [ERROR_CODES.BAD_REQUEST]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.TOKEN_EXPIRED]: 401,
  [ERROR_CODES.TOKEN_INVALID]: 401,
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
  [ERROR_CODES.USER_NOT_FOUND]: 404,
  [ERROR_CODES.PHONE_EXISTS]: 409,
  [ERROR_CODES.INVALID_OPERATION]: 400,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.EXTERNAL_SERVICE_ERROR]: 502,
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429
} as const;

/**
 * Express中间件：发送API响应
 */
export function sendApiResponse<T = any>(
  res: Response,
  response: ApiResponse<T>
): Response {
  // 添加安全头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  return res.json(response);
}

/**
 * 快速创建并发送响应
 */
export function sendSuccess<T = any>(
  res: Response,
  data?: T,
  message?: string,
  meta?: ApiResponse<T>['meta']
): Response {
  return sendApiResponse(res, createSuccessResponse(data, message, meta));
}

/**
 * 快速创建并发送错误响应
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  details?: any
): Response {
  const { response, status } = createErrorResponse(code, message, details);
  return res.status(status).json(response);
}