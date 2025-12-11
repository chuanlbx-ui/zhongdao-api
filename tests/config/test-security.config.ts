/**
 * 测试环境安全配置
 * 在测试期间放宽某些安全限制，确保测试能够顺利进行
 */

import { Request, Response, NextFunction } from 'express';

// 测试环境标识
export const IS_TEST_ENV = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// 测试环境安全配置
export const testSecurityConfig = {
  // 禁用CSRF保护（测试环境）
  disableCsrfProtection: IS_TEST_ENV,

  // 放宽速率限制
  rateLimiting: {
    enabled: !IS_TEST_ENV,
    windowMs: IS_TEST_ENV ? 1000 : 60000, // 1秒窗口（测试）
    maxRequests: IS_TEST_ENV ? 1000 : 100, // 1000次请求（测试）
    skipSuccessfulRequests: IS_TEST_ENV
  },

  // 允许的测试域名
  allowedOrigins: [
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8080',
    'http://localhost:3000', // 添加测试服务器端口
    'http://127.0.0.1:3000'
  ],

  // 测试环境允许的请求头
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-csrf-token',
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],

  // 测试用的JWT配置
  jwt: {
    testSecret: 'test-jwt-secret-key-for-testing-only',
    testIssuer: 'zhongdao-mall-test',
    testAudience: 'zhongdao-mall-users'
  }
};

/**
 * 测试环境安全中间件
 */
export function testSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!IS_TEST_ENV) {
    return next();
  }

  // 测试环境：添加测试标识头
  res.set('X-Test-Environment', 'true');

  // 测试环境：放宽CORS限制
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', testSecurityConfig.allowedHeaders.join(', '));
  res.header('Access-Control-Allow-Credentials', 'true');

  // 测试环境：跳过某些安全检查
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
}

/**
 * 测试环境CSRF绕过中间件
 */
export function testCsrfBypass(req: Request, res: Response, next: NextFunction) {
  if (!IS_TEST_ENV) {
    return next();
  }

  // 测试环境：跳过CSRF验证
  (req as any).skipCSRF = true;
  next();
}

/**
 * 测试环境认证绕过中间件
 * 仅用于特定的测试端点
 */
export function testAuthBypass(req: Request, res: Response, next: NextFunction) {
  if (!IS_TEST_ENV) {
    return next();
  }

  // 检查是否是测试用的特殊token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer test_')) {
    // 设置测试用户信息
    req.user = {
      id: 'test_user_id',
      phone: '18800000000',
      role: 'USER',
      level: 'NORMAL',
      isTestUser: true
    };
  }

  next();
}

/**
 * 验证测试token有效性
 */
export function validateTestToken(token: string): boolean {
  if (!IS_TEST_ENV) {
    return false;
  }

  // 测试token应该以 'test_' 开头
  return token.startsWith('test_') && token.length > 10;
}

/**
 * 获取测试环境专用的数据库URL
 */
export function getTestDatabaseUrl(): string {
  if (IS_TEST_ENV) {
    return process.env.TEST_DATABASE_URL ||
           'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_test';
  }
  return process.env.DATABASE_URL ||
         'mysql://dev_user:dev_password_123@localhost:3306/zhongdao_mall_dev';
}

/**
 * 测试环境日志配置
 */
export const testLogConfig = {
  level: IS_TEST_ENV ? 'error' : 'info', // 测试时只记录错误
  silent: IS_TEST_ENV, // 测试时静默大部分日志
  test: IS_TEST_ENV
};