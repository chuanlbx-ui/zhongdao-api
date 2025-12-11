import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { createErrorResponse } from '../types/response';

/**
 * 微信登录安全验证中间件
 */
export function wechatSecurityGuard(req: Request, res: Response, next: NextFunction) {
  // 获取客户端信息
  const userAgent = req.get('User-Agent') || '';
  const clientIp = getClientIP(req);

  // 记录请求信息
  logger.info('微信登录安全检查', {
    ip: clientIp,
    userAgent: userAgent.substring(0, 200),
    path: req.path,
    requestId: req.requestId
  });

  // 检查是否为已知的恶意User-Agent
  const maliciousPatterns = [
    /bot/i,
    /crawler/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /go-http/i
  ];

  const isMaliciousUA = maliciousPatterns.some(pattern => pattern.test(userAgent));

  if (isMaliciousUA && !process.env.ALLOW_DEBUG_UA) {
    logger.warn('检测到可疑的User-Agent', {
      ip: clientIp,
      userAgent,
      requestId: req.requestId
    });

    return res.status(403).json(createErrorResponse(
      'FORBIDDEN',
      '访问被拒绝',
      '请使用微信小程序访问',
      { requestId: req.requestId }
    ));
  }

  // 检查Referer（如果存在）
  const referer = req.get('Referer');
  if (referer && !isValidReferer(referer)) {
    logger.warn('检测到无效的Referer', {
      ip: clientIp,
      referer,
      requestId: req.requestId
    });

    return res.status(403).json(createErrorResponse(
      'FORBIDDEN',
      '访问来源无效',
      '请从微信小程序访问',
      { requestId: req.requestId }
    ));
  }

  // 添加安全响应头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 记录客户端IP到请求对象，供后续使用
  req.clientIP = clientIp;

  next();
}

/**
 * 限流中间件
 */
export function wechatRateLimit(maxRequests: number = 5, windowMs: number = 15 * 60 * 1000) {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = getClientIP(req);
    const now = Date.now();
    const key = `wechat_login:${clientIp}`;

    const record = attempts.get(key);

    if (!record || now > record.resetTime) {
      // 新的窗口期
      attempts.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    // 检查是否超过限制
    if (record.count >= maxRequests) {
      logger.warn('微信登录频率超限', {
        ip: clientIp,
        count: record.count,
        maxRequests,
        requestId: req.requestId
      });

      return res.status(429).json(createErrorResponse(
        'RATE_LIMIT_EXCEEDED',
        '请求过于频繁',
        `请在${Math.ceil(windowMs / 60000)}分钟后重试`,
        {
          retryAfter: Math.ceil(windowMs / 1000),
          requestId: req.requestId
        }
      ));
    }

    // 增加计数
    record.count++;
    next();
  };
}

/**
 * 验证微信小程序请求头
 */
export function validateWechatHeaders(req: Request, res: Response, next: NextFunction) {
  // 检查微信小程序特有的请求头
  const wxHeaders = {
    'x-wx-source': req.get('x-wx-source'),
    'x-wx-version': req.get('x-wx-version'),
    'x-wx-openid': req.get('x-wx-openid'),
    'x-wx-from': req.get('x-wx-from')
  };

  // 在开发环境下跳过验证
  if (process.env.NODE_ENV === 'development' || process.env.SKIP_WECHAT_HEADER_CHECK) {
    logger.debug('开发环境：跳过微信请求头验证');
    return next();
  }

  // 检查是否有微信小程序的标识
  const hasWechatHeaders = Object.values(wxHeaders).some(value => value !== undefined);

  if (!hasWechatHeaders && req.path.includes('/wechat/')) {
    logger.warn('缺少微信小程序请求头', {
      ip: getClientIP(req),
      path: req.path,
      headers: wxHeaders,
      requestId: req.requestId
    });

    // 返回警告但不阻止请求（可能是旧版本小程序）
  }

  // 将微信信息存储到请求对象中
  req.wechatInfo = wxHeaders;
  next();
}

/**
 * 获取真实的客户端IP
 */
function getClientIP(req: Request): string {
  // 检查各种可能的IP头
  const xForwardedFor = req.get('X-Forwarded-For');
  const xRealIP = req.get('X-Real-IP');
  const xClientIP = req.get('X-Client-IP');
  const cfConnectingIP = req.get('CF-Connecting-IP'); // Cloudflare

  if (xForwardedFor) {
    // X-Forwarded-For 可能包含多个IP，取第一个
    return xForwardedFor.split(',')[0].trim();
  }

  if (xRealIP) {
    return xRealIP;
  }

  if (xClientIP) {
    return xClientIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // 最后回退到连接的远程地址
  return req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * 验证Referer是否有效
 */
function isValidReferer(referer: string): boolean {
  try {
    const refererUrl = new URL(referer);

    // 允许的域名列表
    const allowedDomains = [
      'servicewechat.com', // 微信小程序域名
      'tencent.com',
      'qq.com'
    ];

    // 开发环境允许本地域名
    if (process.env.NODE_ENV === 'development') {
      allowedDomains.push('localhost', '127.0.0.1');
    }

    return allowedDomains.some(domain =>
      refererUrl.hostname.includes(domain)
    );
  } catch {
    return false;
  }
}

/**
 * 验证微信小程序code格式
 */
export function validateWechatCode(req: Request, res: Response, next: NextFunction) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json(createErrorResponse(
      'MISSING_CODE',
      '缺少微信授权码'
    ));
  }

  // 微信code的格式检查
  // 通常长度在32-64位之间，只包含字母、数字和特定字符
  if (!/^[a-zA-Z0-9\-_!]+$/.test(code) || code.length < 10 || code.length > 128) {
    logger.warn('无效的微信授权码格式', {
      codeLength: code.length,
      codePattern: /^[a-zA-Z0-9\-_!]+$/.test(code),
      requestId: req.requestId
    });

    return res.status(400).json(createErrorResponse(
      'INVALID_CODE_FORMAT',
      '微信授权码格式无效'
    ));
  }

  next();
}

// 扩展Request接口
declare global {
  namespace Express {
    interface Request {
      clientIP?: string;
      wechatInfo?: {
        'x-wx-source'?: string;
        'x-wx-version'?: string;
        'x-wx-openid'?: string;
        'x-wx-from'?: string;
      };
    }
  }
}