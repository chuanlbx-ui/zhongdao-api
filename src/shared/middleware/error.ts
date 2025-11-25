import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { createErrorResponse, ErrorCode, getHttpStatus } from '../types/response';

// 错误处理中间件
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.requestId;

  // 记录错误日志
  logger.error('请求处理错误', {
    error: err.message,
    stack: err.stack,
    requestId,
    method: req.method,
    url: req.url,
    userId: req.user?.id
  });

  // 判断错误类型
  let errorCode = ErrorCode.INTERNAL_ERROR;
  let statusCode = 500;
  let message = '服务器内部错误';

  if (err.name === 'ValidationError') {
    errorCode = ErrorCode.VALIDATION_ERROR;
    statusCode = 400;
    message = '请求参数验证失败';
  } else if (err.name === 'CastError') {
    errorCode = ErrorCode.VALIDATION_ERROR;
    statusCode = 400;
    message = '参数格式错误';
  } else if (err.name === 'JsonWebTokenError') {
    errorCode = ErrorCode.UNAUTHORIZED;
    statusCode = 401;
    message = '认证失败';
  } else if (err.name === 'TokenExpiredError') {
    errorCode = ErrorCode.UNAUTHORIZED;
    statusCode = 401;
    message = '认证已过期';
  } else if (err.message.includes('Duplicate entry')) {
    errorCode = ErrorCode.CONFLICT;
    statusCode = 409;
    message = '数据已存在';
  } else if (err.message.includes('foreign key constraint')) {
    errorCode = ErrorCode.VALIDATION_ERROR;
    statusCode = 400;
    message = '关联数据不存在';
  }

  // 创建错误响应
  const response = createErrorResponse(errorCode, message, {
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  }, undefined, requestId);

  res.status(statusCode).json(response);
};

// 404处理中间件
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.requestId;

  logger.warn('404 - 资源未找到', {
    url: req.url,
    method: req.method,
    requestId
  });

  const response = createErrorResponse(
    ErrorCode.NOT_FOUND,
    '请求的资源不存在',
    undefined,
    undefined,
    requestId
  );

  res.status(404).json(response);
};

// 异步错误处理包装器
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 自定义错误类
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: any;

  constructor(message: string, code: ErrorCode = ErrorCode.INTERNAL_ERROR, statusCode?: number, details?: any) {
    super(message);
    this.code = code;
    this.statusCode = statusCode || getHttpStatus(code);
    this.details = details;
  }
}

// 业务错误类
export class BusinessError extends AppError {
  constructor(message: string, code: ErrorCode, details?: any) {
    super(message, code, getHttpStatus(code), details);
  }
}

// 验证错误类
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

// 权限错误类
export class AuthorizationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.FORBIDDEN, 403, details);
  }
}

// 认证错误类
export class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.UNAUTHORIZED, 401, details);
  }
}

// 未找到错误类
export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.NOT_FOUND, 404, details);
  }
}

// 冲突错误类
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.CONFLICT, 409, details);
  }
}