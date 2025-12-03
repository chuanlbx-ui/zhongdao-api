/**
 * 改进的用户认证API测试套件
 * 使用新的测试框架，包含真实的认证token和完整的安全测试
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app,
  setupTestDatabase,
  cleanupTestDatabase,
  getTestUser,
  getAuthHeadersForUser,
  createTestAgent,
  assert,
  generateTestData
} from '../setup';

const API_BASE = '/api/v1';

describe('改进的用户认证API测试', () => {
  let testUsers: any;
  let csrfToken: string;

  beforeAll(async () => {
    console.log('开始改进的认证API测试...');
    const setup = await setupTestDatabase();
    testUsers = setup.testUsers;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    // 生成新的CSRF token
    csrfToken = `test_csrf_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  });

  describe('健康检查端点', () => {
    it('应该能够获取应用健康状态', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('status', 'ok');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('uptime');
    });

    it('应该能够获取数据库健康状态', async () => {
      const response = await request(app)
        .get('/health/database')
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('status', 'ok');
      expect(response.body.data).toHaveProperty('database');
      expect(response.body.data).toHaveProperty('timestamp');
    });
  });

  describe('GET /auth/me - 获取当前用户信息', () => {
    it('管理员应该能够获取自己的用户信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set(getAuthHeadersForUser('admin', csrfToken))
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('phone', '18800000001');
      expect(response.body.data).toHaveProperty('nickname', '测试管理员');
      expect(response.body.data).toHaveProperty('level', 'DIRECTOR');
      expect(response.body.data).toHaveProperty('role', 'ADMIN');
      expect(response.body.data).toHaveProperty('is_active', true);
    });

    it('普通用户应该能够获取自己的用户信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set(getAuthHeadersForUser('normal', csrfToken))
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('phone', '18800000002');
      expect(response.body.data).toHaveProperty('level', 'NORMAL');
      expect(response.body.data).toHaveProperty('role', 'USER');
    });

    it('VIP用户应该能够获取自己的用户信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set(getAuthHeadersForUser('vip', csrfToken))
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('level', 'VIP');
      expect(response.body.data).toHaveProperty('role', 'USER');
    });

    it('星级用户应该能够获取自己的用户信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set(getAuthHeadersForUser('star3', csrfToken))
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('level', 'STAR_3');
      expect(response.body.data).toHaveProperty('role', 'USER');
    });

    it('应该拒绝无效token的请求', async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });

    it('应该拒绝缺失token的请求', async () => {
      const response = await request(app)
        .get(`${API_BASE}/auth/me`)
        .expect(401);

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });
  });

  describe('POST /auth/refresh - 刷新访问令牌', () => {
    it('管理员应该能够刷新访问令牌', async () => {
      const adminUser = testUsers.admin;

      const response = await request(app)
        .post(`${API_BASE}/auth/refresh`)
        .set('Authorization', `Bearer ${adminUser.tokens.refreshToken}`)
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('expiresIn');

      // 验证新的token格式
      assert.jwtToken(response.body.data.accessToken);
      assert.jwtToken(response.body.data.refreshToken);
    });

    it('普通用户应该能够刷新访问令牌', async () => {
      const normalUser = testUsers.normal;

      const response = await request(app)
        .post(`${API_BASE}/auth/refresh`)
        .set('Authorization', `Bearer ${normalUser.tokens.refreshToken}`)
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('accessToken');

      // 验证新token与旧token不同
      expect(response.body.data.accessToken).not.toBe(normalUser.tokens.accessToken);
    });

    it('应该拒绝无效的refreshToken', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/refresh`)
        .set('Authorization', 'Bearer invalid_refresh_token')
        .expect(401);

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });

    it('应该拒绝使用accessToken作为refreshToken', async () => {
      const adminUser = testUsers.admin;

      const response = await request(app)
        .post(`${API_BASE}/auth/refresh`)
        .set('Authorization', `Bearer ${adminUser.tokens.accessToken}`)
        .expect(401);

      assert.errorResponse(response, 401, 'INVALID_TOKEN_TYPE');
    });
  });

  describe('POST /auth/logout - 用户登出', () => {
    it('管理员应该能够成功登出', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/logout`)
        .set(getAuthHeadersForUser('admin', csrfToken))
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.message).toMatch(/登出成功|logout.*success/i);
    });

    it('普通用户应该能够成功登出', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/logout`)
        .set(getAuthHeadersForUser('normal', csrfToken))
        .expect(200);

      assert.apiResponse(response);
    });

    it('应该拒绝未授权的登出请求', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/logout`)
        .expect(401);

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });

    it('应该拒绝无效token的登出请求', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/logout`)
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });
  });

  describe('POST /auth/wechat-login - 微信登录（Mock）', () => {
    it('应该能够使用有效的微信登录码登录', async () => {
      const loginData = {
        code: 'test_wechat_login_code_12345'
      };

      const response = await request(app)
        .post(`${API_BASE}/auth/wechat-login`)
        .send(loginData)
        .expect(200);

      assert.apiResponse(response);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');

      // 验证用户信息
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user).toHaveProperty('wechat_open_id');
      expect(response.body.data.user).toHaveProperty('nickname');

      // 验证token
      assert.jwtToken(response.body.data.tokens.accessToken);
      assert.jwtToken(response.body.data.tokens.refreshToken);
    });

    it('应该拒绝空的登录码', async () => {
      const loginData = {
        code: ''
      };

      const response = await request(app)
        .post(`${API_BASE}/auth/wechat-login`)
        .send(loginData)
        .expect(400);

      assert.errorResponse(response, 400);
    });

    it('应该拒绝缺少必要参数的登录请求', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/wechat-login`)
        .send({})
        .expect(400);

      assert.errorResponse(response, 400, 'VALIDATION_ERROR');
    });

    it('应该拒绝无效的登录码格式', async () => {
      const loginData = {
        code: 'invalid_format_code'
      };

      const response = await request(app)
        .post(`${API_BASE}/auth/wechat-login`)
        .send(loginData);

      // 可能返回400或403，取决于验证逻辑
      expect([400, 403]).toContain(response.status);
      if (response.status === 400) {
        assert.errorResponse(response, 400, 'VALIDATION_ERROR');
      } else {
        assert.errorResponse(response, 403, 'FORBIDDEN');
      }
    });
  });

  describe('权限级别测试', () => {
    it('应该正确验证用户权限级别', async () => {
      const users = ['normal', 'vip', 'star1', 'star3', 'star5', 'admin'];
      const expectedLevels = ['NORMAL', 'VIP', 'STAR_1', 'STAR_3', 'STAR_5', 'DIRECTOR'];

      for (let i = 0; i < users.length; i++) {
        const userType = users[i] as any;
        const expectedLevel = expectedLevels[i];

        const response = await request(app)
          .get(`${API_BASE}/auth/me`)
          .set(getAuthHeadersForUser(userType, csrfToken))
          .expect(200);

        expect(response.body.data.level).toBe(expectedLevel);
      }
    });

    it('应该正确验证用户角色', async () => {
      const adminResponse = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set(getAuthHeadersForUser('admin', csrfToken))
        .expect(200);

      expect(adminResponse.body.data.role).toBe('ADMIN');

      const normalResponse = await request(app)
        .get(`${API_BASE}/auth/me`)
        .set(getAuthHeadersForUser('normal', csrfToken))
        .expect(200);

      expect(normalResponse.body.data.role).toBe('USER');
    });
  });

  describe('Token格式验证', () => {
    it('应该生成正确格式的JWT token', async () => {
      const adminUser = testUsers.admin;

      // 验证accessToken格式
      const accessParts = adminUser.tokens.accessToken.split('.');
      expect(accessParts).toHaveLength(3);

      // 验证refreshToken格式
      const refreshParts = adminUser.tokens.refreshToken.split('.');
      expect(refreshParts).toHaveLength(3);

      // 验证token可以解码（不验证签名）
      const accessPayload = JSON.parse(Buffer.from(accessParts[1], 'base64').toString());
      expect(accessPayload).toHaveProperty('sub');
      expect(accessPayload).toHaveProperty('phone', '18800000001');
      expect(accessPayload).toHaveProperty('type', 'access');

      const refreshPayload = JSON.parse(Buffer.from(refreshParts[1], 'base64').toString());
      expect(refreshPayload).toHaveProperty('sub');
      expect(refreshPayload).toHaveProperty('type', 'refresh');
      expect(refreshPayload).toHaveProperty('jti');
    });
  });

  describe('并发请求测试', () => {
    it('应该能够处理并发认证请求', async () => {
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .get(`${API_BASE}/auth/me`)
          .set(getAuthHeadersForUser('normal', csrfToken))
          .expect(200)
      );

      const responses = await Promise.all(promises);

      // 所有响应都应该成功
      responses.forEach(response => {
        assert.apiResponse(response);
        expect(response.body.data).toHaveProperty('phone', '18800000002');
      });
    });

    it('应该能够处理并发token刷新请求', async () => {
      const normalUser = testUsers.normal;

      const promises = Array(3).fill(null).map(() =>
        request(app)
          .post(`${API_BASE}/auth/refresh`)
          .set('Authorization', `Bearer ${normalUser.tokens.refreshToken}`)
          .expect(200)
      );

      const responses = await Promise.all(promises);

      // 所有响应都应该成功并返回新的token
      responses.forEach(response => {
        assert.apiResponse(response);
        expect(response.body.data).toHaveProperty('accessToken');
        assert.jwtToken(response.body.data.accessToken);
      });
    });
  });

  describe('测试框架功能验证', () => {
    it('测试工具函数应该正常工作', async () => {
      // 测试数据生成
      const testData = generateTestData();
      expect(testData).toHaveProperty('userId');
      expect(testData).toHaveProperty('orderId');
      expect(testData).toHaveProperty('phone');
      expect(testData).toHaveProperty('amount');

      // 测试用户获取
      const adminUser = getTestUser('admin');
      expect(adminUser).toHaveProperty('phone', '18800000001');
      expect(adminUser).toHaveProperty('role', 'ADMIN');

      // 测试认证头生成
      const headers = getAuthHeadersForUser('normal', 'test_csrf_123');
      expect(headers).toHaveProperty('Authorization');
      expect(headers).toHaveProperty('x-csrf-token', 'test_csrf_123');
      expect(headers.Authorization).toMatch(/^Bearer .+$/);
    });
  });
});