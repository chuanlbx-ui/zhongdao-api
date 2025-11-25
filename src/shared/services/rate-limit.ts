import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { createErrorResponse } from '../types/response';

// 简单的内存存储限流器（生产环境建议使用Redis）
class MemoryRateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(
    private windowMs: number = 15 * 60 * 1000, // 15分钟窗口
    private maxRequests: number = 5 // 最大请求数
  ) {}

  isAllowed(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const requestData = this.requests.get(key);

    if (!requestData || now > requestData.resetTime) {
      // 重置或初始化计数器
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs
      };
    }

    // 增加请求计数
    requestData.count++;
    const remaining = Math.max(0, this.maxRequests - requestData.count);

    // 更新请求记录
    this.requests.set(key, requestData);

    return {
      allowed: requestData.count <= this.maxRequests,
      remaining,
      resetTime: requestData.resetTime
    };
  }

  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`清理了${cleaned}个过期的限流记录`);
    }
  }
}

// 创建不同类型的限流器实例
const loginLimiter = new MemoryRateLimiter(15 * 60 * 1000, 5); // 15分钟内最多5次登录尝试
const generalApiLimiter = new MemoryRateLimiter(15 * 60 * 1000, 100); // 15分钟内最多100次API请求
const sensitiveApiLimiter = new MemoryRateLimiter(15 * 60 * 1000, 10); // 15分钟内最多10次敏感操作

// 定期清理过期记录
setInterval(() => {
  loginLimiter.cleanup();
  generalApiLimiter.cleanup();
  sensitiveApiLimiter.cleanup();
}, 5 * 60 * 1000); // 每5分钟清理一次

/**
 * 登录限流中间件
 */
export const loginRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = getClientIP(req);
  const key = `login:${clientIp}`;

  const result = loginLimiter.isAllowed(key);

  // 设置响应头
  res.set({
    'X-RateLimit-Limit': loginLimiter['maxRequests'].toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
  });

  if (!result.allowed) {
    logger.warn('登录频率超限', {
      clientIp,
      userAgent: req.get('User-Agent'),
      requestId: req.requestId
    });

    return res.status(429).json(createErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      '登录尝试过于频繁，请稍后再试',
      {
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        limitType: 'login'
      },
      undefined,
      req.requestId
    ));
  }

  logger.debug('登录限流检查通过', {
    clientIp,
    remaining: result.remaining,
    requestId: req.requestId
  });

  next();
};

/**
 * 通用API限流中间件
 */
export const apiRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = getClientIP(req);
  const key = `api:${clientIp}`;

  const result = generalApiLimiter.isAllowed(key);

  res.set({
    'X-RateLimit-Limit': generalApiLimiter['maxRequests'].toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
  });

  if (!result.allowed) {
    logger.warn('API请求频率超限', {
      clientIp,
      path: req.path,
      method: req.method,
      requestId: req.requestId
    });

    return res.status(429).json(createErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      'API请求过于频繁，请稍后再试',
      {
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        limitType: 'api'
      },
      undefined,
      req.requestId
    ));
  }

  next();
};

/**
 * 敏感操作限流中间件
 */
export const sensitiveRateLimit = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next();
  }

  const key = `sensitive:${req.user.id}`;
  const result = sensitiveApiLimiter.isAllowed(key);

  if (!result.allowed) {
    logger.warn('敏感操作频率超限', {
      userId: req.user.id,
      path: req.path,
      method: req.method,
      requestId: req.requestId
    });

    return res.status(429).json(createErrorResponse(
      'RATE_LIMIT_EXCEEDED',
      '敏感操作过于频繁，请稍后再试',
      {
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        limitType: 'sensitive'
      },
      undefined,
      req.requestId
    ));
  }

  next();
};

/**
 * 获取客户端真实IP地址
 */
function getClientIP(req: Request): string {
  const forwarded = req.get('X-Forwarded-For');
  const realIP = req.get('X-Real-IP');
  const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;

  if (forwarded) {
    // X-Forwarded-For可能包含多个IP，取第一个
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (clientIP) {
    return clientIP;
  }

  return 'unknown';
}

/**
 * 基于用户的限流中间件
 */
export const createUserRateLimiter = (windowMs: number, maxRequests: number) => {
  const limiter = new MemoryRateLimiter(windowMs, maxRequests);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    const key = `user:${req.user.id}`;
    const result = limiter.isAllowed(key);

    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
    });

    if (!result.allowed) {
      logger.warn('用户操作频率超限', {
        userId: req.user.id,
        path: req.path,
        requestId: req.requestId
      });

      return res.status(429).json(createErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        '操作过于频繁，请稍后再试',
        {
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        },
        undefined,
        req.requestId
      ));
    }

    next();
  };
};

/**
 * 获取限流状态
 */
export const getRateLimitStatus = (type: 'login' | 'api' | 'sensitive', identifier: string) => {
  const limiters = {
    login: loginLimiter,
    api: generalApiLimiter,
    sensitive: sensitiveApiLimiter
  };

  const limiter = limiters[type];
  const key = `${type}:${identifier}`;

  // 这里可以实现获取当前状态的逻辑
  // 由于我们的简单实现没有直接的状态查询方法，返回基本信息
  return {
    type,
    identifier,
    windowMs: limiter['windowMs'],
    maxRequests: limiter['maxRequests']
  };
};