/**
 * 认证API测试套件
 * 测试用户登录、注册、token刷新等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../setup';

const API_BASE = '/api/v1';

describe('认证API测试', () => {
  let authToken: string = '';
  let refreshToken: string = '';

  beforeAll(async () => {
    // 确保后端服务已启动
    console.log('开始认证API测试...');
  });

  describe('POST /auth/wechat-login', () => {
    it('应该能够使用微信登录码登录', async () => {
      // 模拟微信登录码
      const loginData = {
        code: 'test_mock_code',
        userInfo: {
          openid: 'test_openid_12345',
          nickname: '测试用户',
          avatar_url: 'https://example.com/avatar.jpg'
        }
      };

      const response = await request(app)
        .post(`${API_BASE}/auth/wechat-login`)
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');

      // 保存tokens用于后续测试
      authToken = response.body.data.token;
      refreshToken = response.body.data.refreshToken;

      expect(response.body.data.user.openid).toBe('test_openid_12345');
    });

    it('应该拒绝无效的登录码', async () => {
      const loginData = {
        code: 'invalid_code'
      };

      const response = await request(app)
        .post(`${API_BASE}/auth/wechat-login`)
        .send(loginData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code');
    });

    it('应该拒绝缺少必要参数的登录请求', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/wechat-login`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/refresh', () => {
    it('应该能够刷新访问令牌', async () => {
      if (!refreshToken) {
        console.warn('跳过token刷新测试 - 缺少refreshToken');
        return;
      }

      const response = await request(app)
        .post(`${API_BASE}/auth/refresh`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');

      // 更新tokens
      authToken = response.body.data.token;
      refreshToken = response.body.data.refreshToken;
    });

    it('应该拒绝无效的refreshToken', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/refresh`)
        .send({ refreshToken: 'invalid_refresh_token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /auth/logout', () => {
    it('应该能够成功登出', async () => {
      if (!authToken) {
        console.warn('跳过登出测试 - 缺少authToken');
        return;
      }

      const response = await request(app)
        .post(`${API_BASE}/auth/logout`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('登出成功');
    });

    it('应该拒绝未授权的登出请求', async () => {
      const response = await request(app)
        .post(`${API_BASE}/auth/logout`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /auth/me', () => {
    it('应该能够获取当前用户信息', async () => {
      if (!authToken) {
        console.warn('跳过用户信息测试 - 缺少authToken');
        return;
      }

      const response = await request(app)
        .get(`${API_BASE}/users/me`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('openid');
      expect(response.body.data).toHaveProperty('level');
      expect(response.body.data).toHaveProperty('points_balance');
    });

    it('应该拒绝未授权的用户信息请求', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/me`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});