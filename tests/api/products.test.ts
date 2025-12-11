import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../setup';

const API_BASE = '/api/v1';

describe('商品管理API测试 - 简化版', () => {
  let normalUserToken: string;
  let adminToken: string;

  beforeAll(async () => {
    console.log('🚀 开始商品管理API测试...');

    // 使用新生成的JWT token（7天有效期）
    normalUserToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjcmhvOWUyaHJwNTB4cWt4MnVtOXJicCIsInBob25lIjoiMTM4MDAxMzgwMDEiLCJyb2xlIjoiVVNFUiIsImxldmVsIjoiTk9STUFMIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzY1MjkzMjYzLCJleHAiOjE3NjU4OTgwNjMsImF1ZCI6Inpob25nZGFvLW1hbGwtdXNlcnMiLCJpc3MiOiJ6aG9uZ2Rhby1tYWxsLXRlc3QifQ.khhOhKik0mPYdSoOHcIV6kDkX-XPE9__b_03WXuI6nk';
    adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkFETUlOIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI5MzI2MywiZXhwIjoxNzY1ODk4MDYzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.bp9AQRDQsFX2iIMpurNn66hZ86Phj3R8uX52ASdvhZI';
  });

  // 辅助函数
  const makeAuthenticatedRequest = (method: string, url: string, token: string = normalUserToken) => {
    const req = request(app)[method.toLowerCase()](url);
    req.set('Authorization', `Bearer ${token}`);
    return req;
  };

  const makeAdminRequest = (method: string, url: string) => {
    return makeAuthenticatedRequest(method, url, adminToken);
  };

  describe('商品分类API', () => {
    it('应该能够获取商品分类树', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/categories/tree`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('total');
    }, 30000);

    it('应该能够获取商品分类列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/categories`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .query({ page: 1, perPage: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 30000);

    it('应该能够按级别筛选商品分类', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/categories?level=1`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
    }, 30000);
  });

  describe('商品标签API', () => {
    it('应该能够获取商品标签列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/tags?page=1&perPage=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 30000);

    it('应该能够获取所有商品标签', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/tags/all`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toBeInstanceOf(Array);
    }, 30000);

    it('应该能够创建新的商品标签', async () => {
      const tagData = {
        name: 'test-tag-' + Math.random().toString(36).substring(7),
        color: '#FF0000',
        description: '测试标签'
      };

      const response = await makeAdminRequest('POST', `${API_BASE}/products/tags`)
        .send(tagData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(tagData.name);
    }, 30000);
  });

  describe('商品列表API', () => {
    it('应该能够获取商品列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/items?page=1&perPage=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 30000);

    it('应该能够按状态筛选商品', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/items?page=1&perPage=10&status=ACTIVE`)
        .expect(200);

      expect(response.body.success).toBe(true);
    }, 30000);
  });

  describe('商品规格API', () => {
    it('应该能够获取商品规格列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/specs?page=1&perPage=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.specs).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 30000);
  });
});