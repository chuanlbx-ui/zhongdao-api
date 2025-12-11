/**
 * 支付安全中间件
 * 提供支付相关的安全增强功能
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { rateLimit } from 'express-rate-limit';
import { secureCallbackHandler } from '../payments/callbacks/secure-handler';

/**
 * 支付回调速率限制
 */
export const paymentCallbackRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 每分钟最多100个回调
  message: {
    error: 'Too many payment callbacks',
    message: '支付回调频率过高，请稍后重试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 根据IP和支付提供商生成key
    const provider = req.path.includes('wechat') ? 'wechat' : 'alipay';
    return `payment_callback:${provider}:${req.ip}`;
  },
  handler: (req, res) => {
    logger.warn('支付回调触发速率限制', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      error: 'Too many payment callbacks',
      message: '支付回调频率过高，请稍后重试'
    });
  }
});

/**
 * 支付创建速率限制
 */
export const paymentCreationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 30, // 每分钟最多30个支付请求
  message: {
    error: 'Too many payment requests',
    message: '支付请求频率过高，请稍后重试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // 根据用户ID生成key
    const userId = req.user?.id || req.ip;
    return `payment_creation:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('支付创建触发速率限制', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path
    });

    res.status(429).json({
      error: 'Too many payment requests',
      message: '支付请求频率过高，请稍后重试'
    });
  }
});

/**
 * 支付查询速率限制
 */
export const paymentQueryRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 60, // 每分钟最多60次查询
  message: {
    error: 'Too many payment queries',
    message: '查询频率过高，请稍后重试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.id || req.ip;
    return `payment_query:${userId}`;
  },
  handler: (req, res) => {
    logger.warn('支付查询触发速率限制', {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path
    });

    res.status(429).json({
      error: 'Too many payment queries',
      message: '查询频率过高，请稍后重试'
    });
  }
});

/**
 * 支付回调安全中间件
 */
export function paymentCallbackSecurity(provider: 'WECHAT' | 'ALIPAY') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 记录原始请求体（Express可能已经解析了）
      const rawBody = req.body;

      // 验证Content-Type
      const contentType = req.get('Content-Type');
      if (provider === 'WECHAT' && !contentType?.includes('application/json')) {
        logger.warn('微信支付回调Content-Type不正确', { contentType });
        return res.status(400).json({ error: 'Invalid Content-Type' });
      }

      // 记录回调信息
      logger.info('收到支付回调', {
        provider,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType,
        bodySize: JSON.stringify(rawBody).length
      });

      // 将provider信息附加到请求对象
      req.paymentProvider = provider;

      next();
    } catch (error) {
      logger.error('支付回调安全检查失败', {
        provider,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * 支付金额验证中间件
 */
export function validatePaymentAmount(req: Request, res: Response, next: NextFunction) {
  try {
    const { amount } = req.body;

    // 金额验证
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({
        error: 'Invalid payment amount',
        message: '支付金额无效'
      });
    }

    // 金额范围检查（0.01元到100万元）
    if (amount < 0.01 || amount > 1000000) {
      return res.status(400).json({
        error: 'Amount out of range',
        message: '支付金额超出允许范围'
      });
    }

    // 金额精度检查（最多两位小数）
    if (Math.round(amount * 100) !== amount * 100) {
      return res.status(400).json({
        error: 'Invalid amount precision',
        message: '支付金额最多保留两位小数'
      });
    }

    next();
  } catch (error) {
    logger.error('支付金额验证失败', {
      error: error instanceof Error ? error.message : '未知错误'
    });

    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * 支付订单状态验证中间件
 */
export function validateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { orderId } = req.params;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({
        error: 'Invalid order ID',
        message: '订单ID无效'
      });
    }

    // 检查订单ID格式（UUID）
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orderId)) {
      return res.status(400).json({
        error: 'Invalid order ID format',
        message: '订单ID格式不正确'
      });
    }

    // 将验证结果附加到请求对象
    req.orderId = orderId;

    next();
  } catch (error) {
    logger.error('订单状态验证失败', {
      error: error instanceof Error ? error.message : '未知错误'
    });

    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * 支付日志中间件
 */
export function paymentLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // 记录请求开始
  logger.info('支付请求开始', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?.id,
    userAgent: req.get('User-Agent'),
    orderId: req.params.orderId || req.body.orderId,
    amount: req.body.amount
  });

  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('支付请求完成', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: req.user?.id,
      orderId: req.params.orderId || req.body.orderId
    });
  });

  next();
}

/**
 * 扩展Request接口
 */
declare global {
  namespace Express {
    interface Request {
      paymentProvider?: 'WECHAT' | 'ALIPAY';
      orderId?: string;
    }
  }
}

/**
 * 支付安全头部设置
 */
export function setPaymentSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  // 设置安全头部
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 对于支付相关接口，禁用缓存
  if (req.path.includes('/payment')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  next();
}