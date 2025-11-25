import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';

// XSS防护中间件
export const xssProtection = (req: Request, res: Response, next: NextFunction): void => {
  // 清理请求体中的字符串字段
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  // 清理查询参数
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }

  // 清理路径参数
  if (req.params && typeof req.params === 'object') {
    sanitizeObject(req.params);
  }

  next();
};

// 递归清理对象中的字符串字段
const sanitizeObject = (obj: any): void => {
  if (!obj || typeof obj !== 'object') {
    return;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        // 清理HTML标签和危险的JavaScript代码
        obj[key] = DOMPurify.sanitize(value, {
          ALLOWED_TAGS: [], // 不允许任何HTML标签
          ALLOWED_ATTR: [], // 不允许任何属性
          KEEP_CONTENT: true // 保留文本内容
        });
      } else if (typeof value === 'object' && value !== null) {
        // 递归清理嵌套对象
        sanitizeObject(value);
      }
    }
  }
};

// 输入验证中间件
export const inputValidation = (req: Request, res: Response, next: NextFunction): void => {
  // 检查请求大小
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: '请求体过大',
        timestamp: new Date().toISOString()
      }
    });
  }

  // 检查Content-Type
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: '不支持的媒体类型，请使用application/json',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  next();
};

// 速率限制中间件（简单实现）
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number = 100, windowMs: number = 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    let clientData = requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      clientData = {
        count: 1,
        resetTime: now + windowMs
      };
      requestCounts.set(clientId, clientData);
    } else {
      clientData.count++;
    }

    // 设置响应头
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - clientData.count));
    res.setHeader('X-RateLimit-Reset', new Date(clientData.resetTime).toISOString());

    if (clientData.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: '请求过于频繁，请稍后再试',
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        }
      });
    }

    next();
  };
};

// 安全头中间件
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // 防止点击劫持
  res.setHeader('X-Frame-Options', 'DENY');

  // 防止MIME类型嗅探
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS保护
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 强制HTTPS（生产环境）
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // 内容安全策略
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'");

  // 引用者策略
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};