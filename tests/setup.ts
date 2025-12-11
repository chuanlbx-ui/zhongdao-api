/**
 * 改进的API测试设置文件
 * 集成认证、数据库管理、Mock服务等完整的测试环境
 */

// 首先加载环境变量
import dotenv from 'dotenv';
import path from 'path';

// 加载测试环境变量，覆盖之前的配置
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true });

// 强制设置测试环境标识
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';
process.env.DISABLE_CSRF = 'true';
process.env.DISABLE_RATE_LIMIT = 'true';

import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import app from '../src/index';

// 导入测试辅助工具
import { TestAuthHelper, createTestUsers, cleanupTestUsers } from './helpers/auth.helper';
import { testDb, connectTestDatabase, disconnectTestDatabase, cleanupTestData, seedTestData } from './database/test-database.helper';
import { mockExternalServicesMiddleware, cleanupMockData } from './mocks/external.services.mock';
import { testSecurityConfig, testSecurityMiddleware, testCsrfBypass } from './config/test-security.config';

// 导出Express应用实例供测试使用
export { app };

// 导出测试数据库实例（需要在使用前先连接）
export const testPrisma = testDb.getPrisma();

// 导出测试辅助类
export { TestAuthHelper };

// 全局测试用户存储
let globalTestUsers: any = null;

/**
 * 设置测试环境
 */
export async function setupTestDatabase() {
  try {
    console.log('🚀 开始设置测试环境...');

    // 设置测试环境变量
    process.env.NODE_ENV = 'test';
    process.env.VITEST = 'true';

    // 确保JWT secret与开发环境一致
    process.env.JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

    // 连接测试数据库
    await connectTestDatabase();

    // 清理历史测试数据
    await cleanupTestData();
    await cleanupTestUsers();
    await cleanupMockData();

    // 创建测试数据种子
    await seedTestData();

    // 创建全局测试用户
    globalTestUsers = await createTestUsers();

    console.log('✅ 测试环境设置完成');
    console.log(`📊 测试用户: ${Object.keys(globalTestUsers).join(', ')}`);

    return {
      testUsers: globalTestUsers,
      testDb: testDb,
      testPrisma: testPrisma
    };
  } catch (error) {
    console.error('❌ 测试环境设置失败:', error);
    throw error;
  }
}

/**
 * 清理测试环境
 */
export async function cleanupTestDatabase() {
  try {
    console.log('🧹 开始清理测试环境...');

    // 清理测试数据
    await cleanupTestData();
    await cleanupTestUsers();
    await cleanupMockData();

    // 断开数据库连接
    await disconnectTestDatabase();

    // 清理全局变量
    globalTestUsers = null;

    console.log('✅ 测试环境清理完成');
  } catch (error) {
    console.warn('⚠️ 测试环境清理失败:', error);
  }
}

/**
 * 获取全局测试用户
 */
export function getGlobalTestUsers() {
  if (!globalTestUsers) {
    throw new Error('测试用户未初始化，请先调用 setupTestDatabase()');
  }
  return globalTestUsers;
}

/**
 * 获取特定类型的测试用户
 */
export function getTestUser(type: 'admin' | 'normal' | 'vip' | 'star1' | 'star3' | 'star5') {
  const users = getGlobalTestUsers();
  return users[type];
}

/**
 * 为请求添加认证头
 */
export function getAuthHeadersForUser(userType: 'admin' | 'normal' | 'vip' | 'star1' | 'star3' | 'star5', csrfToken?: string) {
  const user = getTestUser(userType);
  return TestAuthHelper.getAuthHeaders(user, csrfToken);
}

/**
 * 生成测试数据
 */
export function generateTestData() {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 1000000);

  return {
    userId: `test_user_${timestamp}_${randomId}`,
    orderId: `TEST_${timestamp}_${randomId}`,
    phone: `1${randomId.toString().padStart(10, '0')}`,
    amount: Math.floor(Math.random() * 1000) + 100,
    timestamp,
    randomId
  };
}

/**
 * 等待指定时间
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建测试请求代理（用于Express应用）
 */
export function createTestAgent(app: Express) {
  const request = require('supertest');
  const agent = request.agent(app);

  // 添加测试辅助方法
  agent.asUser = function(userType: string) {
    const headers = getAuthHeadersForUser(userType as any);
    return this.set(headers);
  };

  agent.withCsrf = function(csrfToken?: string) {
    const token = csrfToken || TestAuthHelper.generateCsrfToken();
    return this.set('x-csrf-token', token);
  };

  agent.asAdmin = function() {
    return this.asUser('admin');
  };

  agent.asNormalUser = function() {
    return this.asUser('normal');
  };

  return agent;
}

/**
 * 测试数据断言辅助函数
 */
export const assert = {
  /**
   * 断言API响应格式
   */
  apiResponse(response: any, expectedStatus: number = 200) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('timestamp');
  },

  /**
   * 断言错误响应格式
   */
  errorResponse(response: any, expectedStatus: number = 400, expectedCode?: string) {
    expect(response.status).toBe(expectedStatus);
    expect(response.body.success).toBe(false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toHaveProperty('code');
    expect(response.body.error).toHaveProperty('message');

    if (expectedCode) {
      expect(response.body.error.code).toBe(expectedCode);
    }
  },

  /**
   * 断言分页数据格式
   */
  paginatedResponse(response: any) {
    this.apiResponse(response);
    expect(response.body.data).toHaveProperty('items');
    expect(response.body.data).toHaveProperty('total');
    expect(response.body.data).toHaveProperty('page');
    expect(response.body.data).toHaveProperty('perPage');
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(typeof response.body.data.total).toBe('number');
  },

  /**
   * 断言JWT token格式
   */
  jwtToken(token: string) {
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT格式: header.payload.signature
  },

  /**
   * 断言UUID格式
   */
  uuid(uuid: string) {
    expect(typeof uuid).toBe('string');
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  },

  /**
   * 断言手机号格式
   */
  phoneNumber(phone: string) {
    expect(typeof phone).toBe('string');
    expect(phone).toMatch(/^1[3-9]\d{9}$/);
  },

  /**
   * 断言金额格式
   */
  amount(amount: number | string) {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    expect(typeof numAmount).toBe('number');
    expect(numAmount).toBeGreaterThanOrEqual(0);
    expect(numAmount.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  }
};

/**
 * 测试中间件集合
 */
export const testMiddleware = {
  security: testSecurityMiddleware,
  csrfBypass: testCsrfBypass,
  externalServices: mockExternalServicesMiddleware
};

/**
 * 导出测试配置
 */
export const testConfig = {
  security: testSecurityConfig
};

// 全局测试设置（Vitest全局设置）
if (process.env.VITEST === 'true') {
  // 设置全局超时
  (global as any).testTimeout = 30000;
  (global as any).hookTimeout = 30000;

  // 添加全局测试工具
  (global as any).testUtils = {
    assert,
    delay,
    generateTestData,
    getTestUser,
    getGlobalTestUsers,
    getAuthHeadersForUser,
    createTestAgent
  };
}