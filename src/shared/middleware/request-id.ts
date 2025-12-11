/**
 * 请求ID中间件
 * 为每个请求生成唯一ID，便于日志追踪和调试
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface RequestWithId extends Request {
  requestId: string;
}

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  // 从请求头获取或生成新的请求ID
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  // 添加到请求对象
  req.requestId = requestId;

  // 添加到响应头
  res.setHeader('X-Request-ID', requestId);

  next();
}