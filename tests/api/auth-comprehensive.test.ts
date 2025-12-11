/**
 * 完整的认证系统测试
 * 覆盖所有用户级别和认证场景
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app, setupTestDatabase, cleanupTestDatabase, getAuthHeadersForUser, createTestAgent, assert } from '../setup';
import { TestAuthHelper } from '../helpers/auth.helper';
import { DatabaseIsolation } from '../isolation/database-isolation';

describe('完整认证系统测试', () => {
  let isolation: DatabaseIsolation;
  let agent: any;

  beforeAll(async () => {
    await setupTestDatabase();
    isolation = new DatabaseIsolation((app as any).prisma || global.prisma);
    agent = createTestAgent(app);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await isolation.cleanupAllContexts();
  });

  beforeEach(async () => {
    // 每个测试前创建隔离上下文
    const contextId = await isolation.startIsolation('auth-test');
    (global as any).currentTestContextId = contextId;
  });

  afterEach(async () => {
    // 每个测试后清理隔离上下文
    const contextId = (global as any).currentTestContextId;
    if (contextId) {
      await isolation.endIsolation(contextId);
    }
  });

  describe('1. 基础认证测试', () => {
    it('应该允许访问公开的健康检查接口', async () => {
      const response = await agent.get('/health');

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('status', 'healthy');
    });

    it('应该拒绝未认证的用户访问受保护的路由', async () => {
      const response = await agent.get('/api/v1/auth/me');

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });

    it('应该拒绝无效的token', async () => {
      const response = await agent
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });
  });

  describe('2. 微信登录认证', () => {
    it('应该能够通过微信code登录', async () => {
      const loginData = {
        code: 'test_wechat_code_123456',
        userInfo: {
          nickname: '测试微信用户',
          avatarUrl: 'https://example.com/avatar.jpg'
        }
      };

      const response = await agent
        .post('/api/v1/auth/wechat-login')
        .send(loginData);

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      assert.jwtToken(response.body.data.tokens.accessToken);
      assert.jwtToken(response.body.data.tokens.refreshToken);
    });

    it('应该拒绝无效的微信code', async () => {
      const loginData = {
        code: 'invalid_code',
        userInfo: {
          nickname: '测试用户'
        }
      };

      const response = await agent
        .post('/api/v1/auth/wechat-login')
        .send(loginData);

      assert.errorResponse(response, 400);
    });

    it('登录应该自动创建新用户', async () => {
      const uniqueCode = `test_code_${Date.now()}`;
      const loginData = {
        code: uniqueCode,
        userInfo: {
          nickname: '新测试用户',
          avatarUrl: 'https://example.com/new-avatar.jpg'
        }
      };

      const response = await agent
        .post('/api/v1/auth/wechat-login')
        .send(loginData);

      assert.apiResponse(response, 200);
      expect(response.body.data.user.nickname).toBe('新测试用户');
      expect(response.body.data.user.level).toBe('NORMAL');
    });
  });

  describe('3. 各级别用户认证测试', () => {
    describe('3.1 普通用户 (NORMAL)', () => {
      it('普通用户应该能够获取自己的信息', async () => {
        const response = await agent
          .get('/api/v1/auth/me')
          .asNormalUser();

        assert.apiResponse(response, 200);
        expect(response.body.data.user.level).toBe('NORMAL');
        expect(response.body.data.user.role).toBe('USER');
      });

      it('普通用户应该能够访问基础功能', async () => {
        const response = await agent
          .get('/api/v1/products')
          .asNormalUser();

        assert.apiResponse(response, 200);
      });

      it('普通用户不应该能够访问管理功能', async () => {
        const response = await agent
          .get('/api/v1/admin/users')
          .asNormalUser();

        assert.errorResponse(response, 403, 'FORBIDDEN');
      });
    });

    describe('3.2 VIP用户 (VIP)', () => {
      it('VIP用户应该能够获取VIP价格', async () => {
        const response = await agent
          .get('/api/v1/products/pricing')
          .query({ level: 'VIP' })
          .asUser('vip');

        assert.apiResponse(response, 200);
        // 验证返回的价格结构
      });

      it('VIP用户应该有更高的积分额度', async () => {
        const response = await agent
          .get('/api/v1/points/balance')
          .asUser('vip');

        assert.apiResponse(response, 200);
        expect(response.body.data.balance).toBeGreaterThan(10000);
      });
    });

    describe('3.3 星级店长 (STAR_1 到 STAR_5)', () => {
      const starLevels = ['STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5'];

      starLevels.forEach(level => {
        it(`星级店${level}应该能够创建店铺`, async () => {
          const shopData = {
            name: `${level}测试店铺`,
            type: 'CLOUD',
            description: '测试店铺描述'
          };

          const response = await agent
            .post('/api/v1/shops')
            .send(shopData)
            .asUser(level.toLowerCase().replace('_', ''));

          assert.apiResponse(response, 201);
          expect(response.body.data.shop.type).toBe('CLOUD');
        });

        it(`星级店${level}应该能够查看团队信息`, async () => {
          const response = await agent
            .get('/api/v1/team/members')
            .asUser(level.toLowerCase().replace('_', ''));

          assert.apiResponse(response, 200);
          expect(response.body.data).toHaveProperty('members');
        });
      });
    });

    describe('3.4 总监/管理员 (DIRECTOR)', () => {
      it('管理员应该能够访问所有管理接口', async () => {
        const response = await agent
          .get('/api/v1/admin/dashboard')
          .asAdmin();

        assert.apiResponse(response, 200);
        expect(response.body.data).toHaveProperty('stats');
      });

      it('管理员应该能够查看所有用户列表', async () => {
        const response = await agent
          .get('/api/v1/admin/users')
          .asAdmin();

        assert.apiResponse(response, 200);
        expect(Array.isArray(response.body.data.users)).toBe(true);
      });

      it('管理员应该能够管理系统配置', async () => {
        const configData = {
          key: 'test_config',
          value: 'test_value',
          description: '测试配置'
        };

        const response = await agent
          .post('/api/v1/admin/config')
          .send(configData)
          .asAdmin();

        assert.apiResponse(response, 201);
      });
    });
  });

  describe('4. Token刷新机制', () => {
    it('应该能够使用refresh token获取新的access token', async () => {
      // 先登录获取tokens
      const loginResponse = await agent
        .post('/api/v1/auth/wechat-login')
        .send({
          code: 'test_refresh_code',
          userInfo: { nickname: '刷新测试用户' }
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      // 使用refresh token获取新token
      const refreshResponse = await agent
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      assert.apiResponse(refreshResponse, 200);
      assert.jwtToken(refreshResponse.body.data.accessToken);
    });

    it('应该拒绝无效的refresh token', async () => {
      const response = await agent
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid_refresh_token' });

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });

    it('过期access token应该被拒绝', async () => {
      // 创建一个过期的token
      const expiredToken = TestAuthHelper.generateToken({
        sub: 'test_user_id',
        exp: Math.floor(Date.now() / 1000) - 3600 // 1小时前过期
      }, '1h');

      const response = await agent
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });
  });

  describe('5. 权限验证测试', () => {
    it('应该正确验证用户级别权限', async () => {
      // 测试只有VIP以上才能访问的接口
      const response = await agent
        .get('/api/v1/products/vip-pricing')
        .asNormalUser();

      assert.errorResponse(response, 403, 'FORBIDDEN');
    });

    it('应该正确验证角色权限', async () => {
      // 测试只有管理员才能访问的接口
      const endpoints = [
        '/api/v1/admin/users',
        '/api/v1/admin/orders',
        '/api/v1/admin/config',
        '/api/v1/admin/stats'
      ];

      for (const endpoint of endpoints) {
        const response = await agent
          .get(endpoint)
          .asNormalUser();

        assert.errorResponse(response, 403, 'FORBIDDEN');
      }
    });

    it('应该能够通过token获取用户信息', async () => {
      const response = await agent
        .get('/api/v1/auth/me')
        .asAdmin();

      assert.apiResponse(response, 200);
      expect(response.body.data.user).toMatchObject({
        id: expect.any(String),
        phone: expect.any(String),
        level: 'DIRECTOR',
        role: 'ADMIN'
      });
    });
  });

  describe('6. 登出功能', () => {
    it('应该能够成功登出', async () => {
      const response = await agent
        .post('/api/v1/auth/logout')
        .asAdmin();

      assert.apiResponse(response, 200);
      expect(response.body.data.message).toContain('登出成功');
    });

    it('登出后token应该失效', async () => {
      // 先登出
      await agent.post('/api/v1/auth/logout').asAdmin();

      // 然后尝试使用之前的token
      const response = await agent
        .get('/api/v1/auth/me')
        .asAdmin();

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });
  });

  describe('7. 并发认证测试', () => {
    it('应该能够处理多个用户同时认证', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        agent
          .post('/api/v1/auth/wechat-login')
          .send({
            code: `concurrent_test_${i}`,
            userInfo: { nickname: `并发测试用户${i}` }
          })
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        assert.apiResponse(response, 200);
        assert.jwtToken(response.body.data.tokens.accessToken);
      });
    });
  });

  describe('8. 安全性测试', () => {
    it('应该拒绝格式错误的Authorization头', async () => {
      const testCases = [
        'Bearer',
        'bearer token',
        'Token token',
        'InvalidFormat token',
        'Bearer token extra'
      ];

      for (const authHeader of testCases) {
        const response = await agent
          .get('/api/v1/auth/me')
          .set('Authorization', authHeader);

        assert.errorResponse(response, 401, 'UNAUTHORIZED');
      }
    });

    it('应该防止token伪造', async () => {
      // 尝试伪造token（错误的签名）
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const response = await agent
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${fakeToken}`);

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });

    it('应该验证token的iss和aud', async () => {
      // 创建错误issuer的token
      const wrongIssToken = TestAuthHelper.generateToken({
        sub: 'test_user_id'
      }, '24h', 'wrong_issuer');

      const response = await agent
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${wrongIssToken}`);

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
    });
  });

  describe('9. 错误处理', () => {
    it('应该正确处理认证中间件错误', async () => {
      // 模拟数据库错误等异常情况
      const response = await agent
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer malformed.jwt.token');

      assert.errorResponse(response, 401, 'UNAUTHORIZED');
      expect(response.body.error.message).toBeDefined();
    });

    it('应该返回结构化的错误响应', async () => {
      const response = await agent
        .get('/api/v1/admin/users')
        .asNormalUser();

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('10. 性能测试', () => {
    it('认证验证应该在合理时间内完成', async () => {
      const startTime = Date.now();

      const response = await agent
        .get('/api/v1/auth/me')
        .asAdmin();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
      assert.apiResponse(response, 200);
    });

    it('应该能够处理大量并发请求', async () => {
      const promises = Array.from({ length: 100 }, () =>
        agent
          .get('/api/v1/auth/me')
          .asAdmin()
      );

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // 5秒内完成100个请求
      responses.forEach(response => {
        assert.apiResponse(response, 200);
      });
    });
  });
});