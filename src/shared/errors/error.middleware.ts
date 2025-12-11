/**
 * 错误处理中间件
 * 统一处理应用中的错误，确保一致的错误响应格式
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from './index';
import { createErrorResponse } from '../types/response';
import { logger } from '../utils/logger';

// 处理未知错误
function handleUnknownError(error: Error): AppError {
  // 如果已经是AppError，直接返回
  if (error instanceof AppError) {
    return error;
  }

  // Prisma相关错误
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    switch (prismaError.code) {
      case 'P2002':
        return new AppError(
          ErrorCode.CONFLICT,
          '数据已存在，违反唯一性约束',
          409,
          { field: prismaError.meta?.target?.[0] }
        );
      case 'P2025':
        return new AppError(
          ErrorCode.NOT_FOUND,
          '找不到指定的记录',
          404
        );
      case 'P2003':
        return new AppError(
          ErrorCode.BUSINESS_RULE_VIOLATION,
          '外键约束违反',
          400,
          { field: prismaError.meta?.field_name }
        );
      default:
        return new AppError(
          ErrorCode.INTERNAL_ERROR,
          '数据库操作失败',
          500,
          { prismaCode: prismaError.code }
        );
    }
  }

  // 验证错误（如Joi、Zod等）
  if (error.name === 'ValidationError') {
    return new AppError(
      ErrorCode.VALIDATION_ERROR,
      '数据验证失败',
      400,
      { details: error.message }
    );
  }

  // JWT相关错误
  if (error.name === 'JsonWebTokenError') {
    return new AppError(
      ErrorCode.UNAUTHORIZED,
      '无效的访问令牌',
      401
    );
  }

  if (error.name === 'TokenExpiredError') {
    return new AppError(
      ErrorCode.UNAUTHORIZED,
      '访问令牌已过期',
      401
    );
  }

  // 未知错误，转换为内部服务器错误
  return new AppError(
    ErrorCode.INTERNAL_ERROR,
    process.env.NODE_ENV === 'production' ? '内部服务器错误' : error.message,
    500
  );
}

// 全局错误处理中间件
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const appError = handleUnknownError(error);

  // 记录错误日志
  if (appError.statusCode >= 500) {
    logger.error({
      error: appError.toJSON(),
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        user: req.user
      }
    }, '服务器内部错误');
  } else {
    logger.warn({
      error: appError.toJSON(),
      request: {
        method: req.method,
        url: req.url,
        user: req.user
      }
    }, '客户端错误');
  }

  // 发送错误响应
  const errorResponse = createErrorResponse(
    appError.code,
    appError.message,
    appError.details,
    undefined,
    appError.requestId || req.requestId
  );

  // 在开发环境下添加堆栈信息
  if (process.env.NODE_ENV === 'development' && appError.stack) {
    errorResponse.stack = appError.stack;
  }

  res.status(appError.statusCode).json(errorResponse);
}

// 异步错误处理包装器
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 未捕获的异常处理器
export function setupUnhandledExceptionHandlers(): void {
  // 未捕获的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({
      reason,
      promise
    }, '未处理的Promise拒绝');
    // 优雅关闭
    process.exit(1);
  });

  // 未捕获的异常
  process.on('uncaughtException', (error) => {
    logger.error({
      error: error.stack
    }, '未捕获的异常');
    // 优雅关闭
    process.exit(1);
  });
}