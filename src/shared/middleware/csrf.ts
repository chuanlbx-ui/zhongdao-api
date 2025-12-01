import { Request, Response, NextFunction } from 'express';
import { createErrorResponse, ErrorCode } from '../types/response';
import { logger } from '../utils/logger';
import crypto from 'crypto';

// CSRF令牌存储（生产环境建议使用Redis）
const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

// CSRF令牌配置
const CSRF_TOKEN_LENGTH = 32;
const CSRF_EXPIRE_TIME = 24 * 60 * 60 * 1000; // 24小时
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * 生成安全的CSRF令牌
 */
export const generateCSRFToken = (): string => {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
};

/**
 * 验证CSRF令牌格式
 */
export const isValidCSRFToken = (token: string): boolean => {
  return /^[a-f0-9]{64}$/i.test(token);
};

/**
 * 生成基于用户和会话的CSRF令牌键
 */
const getCSRFKey = (userId?: string, sessionId?: string): string => {
  return `csrf:${userId || 'anonymous'}:${sessionId || 'default'}`;
};

/**
 * CSRF防护中间件
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // 检查是否标记跳过CSRF验证
    if ((req as any).skipCSRF) {
      logger.debug('跳过CSRF验证（标记为skipCSRF）', {
        method: req.method,
        url: req.url
      });
      return next();
    }

    // 对于某些路由直接跳过CSRF验证（开发测试模式）
    const bypassPaths = [
      '/api/v1/users/register',      // 用户注册
      '/api/v1/auth/password-register', // 密码注册
      '/api/v1/auth/password-login',    // 密码登录
      '/api/v1/admin/auth/login',    // 管理员登录
      '/api/v1/admin/auth/logout',   // 管理员登出
      '/api/v1/admin/seed',          // 种子数据（开发环境）
    ];
    if (bypassPaths.some(path => req.path.includes(path)) && req.method === 'POST') {
      logger.debug('跳过CSRF验证（路由白名单）', {
        method: req.method,
        url: req.url
      });
      return next();
    }

    // 生成或获取会话ID
    const sessionId = req.session?.id || req.get('User-Agent') || req.ip;
    const userId = req.user?.id;

    const csrfKey = getCSRFKey(userId, sessionId);

    // 对于GET请求，生成并设置CSRF令牌
    if (req.method === 'GET') {
      const existingToken = csrfTokens.get(csrfKey);

      // 检查现有令牌是否过期
      if (existingToken && Date.now() < existingToken.expiresAt) {
        // 令牌仍然有效，设置到Cookie中
        res.cookie(CSRF_COOKIE_NAME, existingToken.token, {
          httpOnly: false, // 客户端需要读取
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: CSRF_EXPIRE_TIME,
          path: '/'
        });
      } else {
        // 生成新令牌
        const newToken = generateCSRFToken();
        const expiresAt = Date.now() + CSRF_EXPIRE_TIME;

        // 存储令牌
        csrfTokens.set(csrfKey, { token: newToken, expiresAt });

        // 设置Cookie
        res.cookie(CSRF_COOKIE_NAME, newToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: CSRF_EXPIRE_TIME,
          path: '/'
        });

        logger.debug('生成CSRF令牌', {
          userId,
          csrfKey,
          tokenHash: newToken.substring(0, 8) + '...'
        });
      }

      return next();
    }

    // 对于状态变更请求（POST、PUT、DELETE、PATCH），验证CSRF令牌
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      // 获取Cookie中的令牌
      const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

      // 获取请求头或请求体中的令牌
      const headerToken = req.get(CSRF_HEADER_NAME);
      const bodyToken = req.body?._csrf;

      const providedToken = headerToken || bodyToken;

      // 验证令牌存在性
      if (!cookieToken || !providedToken) {
        logger.warn('CSRF令牌缺失', {
          method: req.method,
          url: req.url,
          userId,
          hasCookieToken: !!cookieToken,
          hasHeaderToken: !!headerToken,
          hasBodyToken: !!bodyToken,
          ip: req.ip
        });

        return res.status(403).json(createErrorResponse(
          ErrorCode.FORBIDDEN,
          'CSRF令牌缺失',
          {
            requiresCSRF: true,
            tokenLocation: '请在请求头或请求体中提供CSRF令牌'
          }
        ));
      }

      // 验证令牌格式
      if (!isValidCSRFToken(providedToken)) {
        logger.warn('CSRF令牌格式无效', {
          method: req.method,
          url: req.url,
          userId,
          tokenLength: providedToken.length,
          ip: req.ip
        });

        return res.status(403).json(createErrorResponse(
          ErrorCode.FORBIDDEN,
          'CSRF令牌格式无效'
        ));
      }

      // 验证令牌匹配性
      if (cookieToken !== providedToken) {
        logger.warn('CSRF令牌不匹配', {
          method: req.method,
          url: req.url,
          userId,
          cookieTokenHash: cookieToken ? cookieToken.substring(0, 8) + '...' : 'null',
          providedTokenHash: providedToken.substring(0, 8) + '...',
          ip: req.ip
        });

        return res.status(403).json(createErrorResponse(
          ErrorCode.FORBIDDEN,
          'CSRF验证失败',
          {
            reason: '令牌不匹配'
          }
        ));
      }

      // 验证存储的令牌
      const storedToken = csrfTokens.get(csrfKey);
      if (!storedToken || storedToken.token !== providedToken) {
        logger.warn('CSRF令牌存储验证失败', {
          method: req.method,
          url: req.url,
          userId,
          csrfKey,
          ip: req.ip
        });

        return res.status(403).json(createErrorResponse(
          ErrorCode.FORBIDDEN,
          'CSRF令牌已失效'
        ));
      }

      // 检查令牌是否过期
      if (Date.now() > storedToken.expiresAt) {
        logger.warn('CSRF令牌已过期', {
          method: req.method,
          url: req.url,
          userId,
          expiresAt: new Date(storedToken.expiresAt).toISOString(),
          ip: req.ip
        });

        // 清理过期令牌
        csrfTokens.delete(csrfKey);

        return res.status(403).json(createErrorResponse(
          ErrorCode.FORBIDDEN,
          'CSRF令牌已过期，请重新获取'
        ));
      }

      logger.debug('CSRF验证通过', {
        method: req.method,
        url: req.url,
        userId,
        ip: req.ip
      });

      return next();
    }

    // 对于其他请求方法，直接通过
    next();
  } catch (error) {
    logger.error('CSRF防护中间件错误', {
      error: error instanceof Error ? error.message : '未知错误',
      method: req.method,
      url: req.url,
      userId: req.user?.id,
      ip: req.ip
    });

    // 发生错误时拒绝请求，确保安全
    return res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      '安全验证失败'
    ));
  }
};

/**
 * 清理过期的CSRF令牌（定时任务）
 */
export const cleanupExpiredCSRFtokens = (): void => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, token] of csrfTokens.entries()) {
    if (now > token.expiresAt) {
      csrfTokens.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug(`清理了${cleanedCount}个过期的CSRF令牌`);
  }
};

// 每10分钟清理一次过期令牌
setInterval(cleanupExpiredCSRFtokens, 10 * 60 * 1000);

/**
 * 撤销用户的CSRF令牌
 */
export const revokeUserCSRFtokens = (userId: string): void => {
  let revokedCount = 0;

  for (const [key] of csrfTokens.entries()) {
    if (key.startsWith(`csrf:${userId}:`)) {
      csrfTokens.delete(key);
      revokedCount++;
    }
  }

  if (revokedCount > 0) {
    logger.info(`撤销了用户${userId}的${revokedCount}个CSRF令牌`);
  }
};

/**
 * 获取CSRF统计信息
 */
export const getCSRFStats = () => {
  const now = Date.now();
  let activeCount = 0;
  let expiredCount = 0;

  for (const [key, token] of csrfTokens.entries()) {
    if (now < token.expiresAt) {
      activeCount++;
    } else {
      expiredCount++;
    }
  }

  return {
    totalTokens: csrfTokens.size,
    activeTokens: activeCount,
    expiredTokens: expiredCount
  };
};