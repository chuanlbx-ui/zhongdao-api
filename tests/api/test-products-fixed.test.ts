import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../tests/setup';

const API_BASE = '/api/v1';

describe('商品管理API测试 - 修复版', () => {
  let normalUserToken: string;
  let adminToken: string;

  beforeAll(async () => {
    console.log('🚀 开始商品管理API测试...');

    // 生成新的token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';

    const now = Math.floor(Date.now() / 1000);
    const exp = now + (7 * 24 * 60 * 60);

    normalUserToken = jwt.sign({
      sub: 'crho9e2hrp50xqkx2um9rbp',
      phone: '13800138001',
      role: 'USER',
      level: 'NORMAL',
      scope: ['active', 'user'],
      type: 'access',
      iat: now,
      exp: exp,
      aud: 'zhongdao-mall-users',
      iss: 'zhongdao-mall-test'
    }, JWT_SECRET);

    adminToken = jwt.sign({
      sub: 'ja4x4705a4emvkga2e73e5ne',
      phone: '13800138888',
      role: 'ADMIN',
      level: 'DIRECTOR',
      scope: ['active', 'user'],
      type: 'access',
      iat: now,
      exp: exp,
      aud: 'zhongdao-mall-users',
      iss: 'zhongdao-mall-test'
    }, JWT_SECRET);
  });

  // 辅助函数
  const makeAuthenticatedRequest = (method: string, url: string, token: string = normalUserToken) => {
    const req = request(app)[method.toLowerCase()](url);
    req.set('Authorization', `Bearer ${token}`);
    req.timeout(30000); // 30秒超时
    return req;
  };

  const makeAdminRequest = (method: string, url: string) => {
    return makeAuthenticatedRequest(method, url, adminToken);
  };

  describe('商品分类API', () => {
    it('应该能够获取商品分类树', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/categories/tree`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('total');
    }, 30000);

    it('应该能够获取商品分类列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/categories`)
        .query({ page: 1, perPage: 5 })  // 减少每页数量
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 30000);
  });

  describe('商品标签API', () => {
    it('应该能够获取所有商品标签', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/tags/all`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toBeInstanceOf(Array);
    }, 30000);

    it('应该能够获取商品标签列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/tags`)
        .query({ page: 1, perPage: 5 })  // 减少每页数量
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 30000);
  });

  describe('商品列表API', () => {
    it('应该能够获取商品列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/items`)
        .query({ page: 1, perPage: 5 })  // 减少每页数量
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 30000);
  });
});