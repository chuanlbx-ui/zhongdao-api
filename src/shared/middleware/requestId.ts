import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// 请求ID中间件
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  // 将请求ID添加到请求对象
  req.requestId = requestId;

  // 将请求ID添加到响应头
  res.setHeader('X-Request-ID', requestId);

  logger.debug('请求开始', {
    method: req.method,
    url: req.url,
    requestId
  });

  next();
};

// 扩展Request接口
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}