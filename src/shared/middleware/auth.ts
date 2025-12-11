import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { config } from '../../config';
import { createErrorResponse, ErrorCode } from '../types/response';
import { AuthenticationError, ValidationError } from './error';

// JWT载荷接口
interface JWTPayload {
  sub: string;           // 用户ID
  iat: number;           // 签发时间
  exp: number;           // 过期时间
  jti: string;           // Token ID
  scope: string[];        // 权限范围
  role: string;          // 用户角色
  level: string;         // 用户等级
}

// 扩展Request接口
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        openid: string;
        nickname?: string;
        level: string;
        role: string;
        scope: string[];
      };
    }
  }
}

// 注意：JWT_SECRET 在运行时从config对象读取，不在编译时读取
// 这确保本地编译的dist可以在任何环境运行（本地/服务器）

// Token黑名单管理（生产环境建议使用Redis）
const tokenBlacklist = new Map<string, number>();

// 将Token加入黑名单
export const addToBlacklist = (token: string, expiresAt: number): void => {
  tokenBlacklist.set(token, expiresAt);
  logger.info('Token已加入黑名单', {
    tokenHash: token.substring(0, 10) + '...',
    expiresAt: new Date(expiresAt).toISOString()
  });
};

// 检查Token是否在黑名单中
export const isTokenBlacklisted = (token: string): boolean => {
  const expiresAt = tokenBlacklist.get(token);
  if (expiresAt && Date.now() < expiresAt) {
    return true;
  }
  // 清理过期的Token
  if (expiresAt && Date.now() >= expiresAt) {
    tokenBlacklist.delete(token);
  }
  return false;
};

// 清理过期的黑名单Token（定时任务）
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [token, expiresAt] of tokenBlacklist.entries()) {
    if (now >= expiresAt) {
      tokenBlacklist.delete(token);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    logger.debug(`清理了${cleanedCount}个过期的黑名单Token`);
  }
}, 60000); // 每分钟清理一次

// 生成JWT Token
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string => {
  const JWT_SECRET = config.jwt.secret;  // ✅ 运行时读取
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET未设置，无法生成Token');
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + parseTimeToSeconds(config.jwt.expiresIn),
    jti: generateTokenId()
  };

  return jwt.sign(tokenPayload, JWT_SECRET, {
    algorithm: 'HS256'
  });
};

// 解析JWT Token
export const verifyToken = (token: string): JWTPayload => {
  const JWT_SECRET = config.jwt.secret;  // ✅ 运行时读取
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET未设置，无法验证Token');
  }

  try {
    // 首先检查Token是否在黑名单中
    if (isTokenBlacklisted(token)) {
      logger.warn('尝试使用已登出的Token', {
        tokenHash: token.substring(0, 10) + '...'
      });
      throw new AuthenticationError('Token已失效，请重新登录');
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    logger.error('JWT验证失败:', error);
    throw new AuthenticationError('认证失败');
  }
};

// 将时间字符串转换为秒数
const parseTimeToSeconds = (timeStr: string): number => {
  const unit = timeStr.slice(-1);
  const value = parseInt(timeStr.slice(0, -1));

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return value;
  }
};

// 生成Token ID
const generateTokenId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// 从请求头中提取Token
const extractTokenFromHeader = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

// 认证中间件
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req);

    if (!token) {
      throw new AuthenticationError('缺少认证Token');
    }

    // 验证Token
    const decoded = verifyToken(token);

    // 检查用户是否活跃
    if (decoded.scope && !decoded.scope.includes('active')) {
      throw new AuthenticationError('用户状态不活跃');
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: decoded.sub,
      openid: decoded.sub, // 暂时使用sub作为openid
      level: decoded.level,
      role: decoded.role,
      scope: decoded.scope
    };

    logger.debug('用户认证成功', {
      userId: req.user.id,
      level: req.user.level,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    const response = createErrorResponse(
      ErrorCode.UNAUTHORIZED,
      error instanceof Error ? error.message : '认证失败',
      undefined,
      undefined,
      req.requestId
    );

    res.status(401).json(response);
  }
};

// 可选认证中间件（用户可以未认证访问）
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractTokenFromHeader(req);

    if (token) {
      const decoded = verifyToken(token);

      req.user = {
        id: decoded.sub,
        openid: decoded.sub,
        level: decoded.level,
        role: decoded.role,
        scope: decoded.scope
      };

      logger.debug('用户认证成功（可选）', {
        userId: req.user.id,
        level: req.user.level,
        requestId: req.requestId
      });
    }

    next();
  } catch (error) {
    // 可选认证失败时不阻止请求继续
    logger.debug('可选认证失败，继续处理请求', {
      error: error instanceof Error ? error.message : '认证失败',
      requestId: req.requestId
    });
    next();
  }
};

// 权限检查中间件工厂
export const requirePermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('需要登录');
    }

    const userPermissions = req.user.scope || [];
    const hasPermission = permissions.some(permission =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      const response = createErrorResponse(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        '权限不足',
        {
          requiredPermissions: permissions,
          userPermissions
        },
        undefined,
        req.requestId
      );

      res.status(403).json(response);
      return;
    }

    logger.debug('权限检查通过', {
      userId: req.user.id,
      requiredPermissions: permissions,
      requestId: req.requestId
    });

    next();
  };
};

// 用户等级检查中间件工厂
export const requireMinLevel = (minLevel: string) => {
  const levelOrder = [
    'NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'
  ];

  // 支持多种格式输入，统一转换为大写
  const normalizeLevel = (level: string): string => {
    switch (level.toLowerCase()) {
      case 'normal': return 'NORMAL';
      case 'vip': return 'VIP';
      case 'star_1': return 'STAR_1';
      case 'star_2': return 'STAR_2';
      case 'star_3': return 'STAR_3';
      case 'star_4': return 'STAR_4';
      case 'star_5': return 'STAR_5';
      case 'director': return 'DIRECTOR';
      default: return level.toUpperCase();
    }
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('需要登录');
    }

    const userLevel = normalizeLevel(req.user.level);
    const requiredLevel = normalizeLevel(minLevel);

    const userLevelIndex = levelOrder.indexOf(userLevel);
    const requiredLevelIndex = levelOrder.indexOf(requiredLevel);

    if (userLevelIndex < requiredLevelIndex) {
      const response = createErrorResponse(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        '用户等级不足',
        {
          requiredLevel: requiredLevel,
          currentLevel: userLevel
        },
        undefined,
        req.requestId
      );

      res.status(403).json(response);
      return;
    }

    logger.debug('用户等级检查通过', {
      userId: req.user.id,
      requiredLevel: requiredLevel,
      currentLevel: userLevel,
      requestId: req.requestId
    });

    next();
  };
};

// 生成刷新Token
export const generateRefreshToken = (payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string => {
  const JWT_SECRET = config.jwt.secret;  // ✅ 运行时读取
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET未设置，无法生成刷新Token');
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + parseTimeToSeconds(config.jwt.refreshExpiresIn),
    jti: generateTokenId(),
    scope: ['refresh'] // 刷新Token只具有刷新权限
  };

  return jwt.sign(tokenPayload, JWT_SECRET, {
    algorithm: 'HS256'
  });
};

// 登出功能 - 将Token加入黑名单
export const logout = async (token: string): Promise<void> => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (decoded && decoded.exp) {
      const expiresAt = decoded.exp * 1000; // 转换为毫秒
      addToBlacklist(token, expiresAt);

      logger.info('用户登出成功', {
        userId: decoded.sub,
        expiresAt: new Date(expiresAt).toISOString()
      });
    }
  } catch (error) {
    logger.error('登出处理失败', {
      error: error instanceof Error ? error.message : '未知错误'
    });
    throw new AuthenticationError('登出失败');
  }
};

// Token刷新功能
export const refreshToken = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
  const JWT_SECRET = config.jwt.secret;  // ✅ 运行时读取
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET未设置，无法刷新Token');
  }

  try {
    // 验证刷新Token
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      algorithms: ['HS256']
    }) as JWTPayload;

    // 检查是否为刷新Token
    if (!decoded.scope || !decoded.scope.includes('refresh')) {
      throw new AuthenticationError('无效的刷新Token');
    }

    // 检查刷新Token是否在黑名单中
    if (isTokenBlacklisted(refreshToken)) {
      throw new AuthenticationError('刷新Token已失效');
    }

    // 将旧刷新Token加入黑名单
    if (decoded.exp) {
      const oldExpiresAt = decoded.exp * 1000;
      addToBlacklist(refreshToken, oldExpiresAt);
    }

    // 生成新的访问Token和刷新Token
    const newPayload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'> = {
      sub: decoded.sub,
      scope: decoded.scope.filter(scope => scope !== 'refresh'), // 移除refresh权限
      role: decoded.role,
      level: decoded.level
    };

    const newAccessToken = generateToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    logger.info('Token刷新成功', {
      userId: decoded.sub
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    logger.error('Token刷新失败', {
      error: error instanceof Error ? error.message : '未知错误'
    });
    throw new AuthenticationError('Token刷新失败');
  }
};

// 检查Token是否即将过期（剩余时间小于30分钟）
export const isTokenExpiringSoon = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded || !decoded.exp) {
      return true; // 无法解析则认为需要刷新
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    const thirtyMinutes = 30 * 60;

    return timeUntilExpiry < thirtyMinutes && timeUntilExpiry > 0;
  } catch {
    return true;
  }
};

// 微信认证中间件（用于微信小程序登录）
export const wechatAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // 这里实现微信登录逻辑
  // 由于需要调用微信API，这里先提供一个基础实现

  try {
    const { code } = req.body;

    if (!code) {
      throw new ValidationError('缺少微信授权码');
    }

    // TODO: 实现微信登录逻辑
    // 1. 使用code获取access_token
    // 2. 使用access_token获取用户信息
    // 3. 创建或更新用户记录
    // 4. 生成JWT Token

    throw new Error('微信登录功能待实现');
  } catch (error) {
    const response = createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : '微信登录失败',
      undefined,
      undefined,
      req.requestId
    );

    res.status(500).json(response);
  }
};