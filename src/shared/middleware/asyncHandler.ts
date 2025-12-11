import { Request, Response, NextFunction } from 'express';

/**
 * 异步处理包装器
 * 捕获异步函数中的错误并传递给错误处理中间件
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 支持参数的异步处理包装器
 */
export const asyncHandlerWithParams = (...params: any[]) => {
  return (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(...params, req, res, next)).catch(next);
    };
  };
};
