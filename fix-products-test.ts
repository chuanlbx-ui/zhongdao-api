import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { createTestUser } from '../helpers/auth.helper';

const API_BASE = '/api/v1';

describe('商品管理API测试', () => {
  let normalUserToken: string;
  let adminToken: string;

  beforeAll(async () => {
    console.log('开始商品管理API测试...');

    // 创建测试用户并获取token
    const normalUser = await createTestUser('normal');
    normalUserToken = normalUser.tokens.accessToken;

    const adminUser = await createTestUser('director');
    adminToken = adminUser.tokens.accessToken;
  });

  // 辅助函数：为请求添加认证头
  const makeAuthenticatedRequest = (method: string, url: string, token: string = normalUserToken) => {
    const req = request(app)[method.toLowerCase()](url);
    req.set('Authorization', `Bearer ${token}`);
    return req;
  };

  // 辅助函数：为管理员请求添加认证头
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
    }, 10000);

    it('应该能够获取商品分类列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/categories`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('perPage');
    }, 10000);

    it('应该能够按级别筛选商品分类', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/categories?level=1`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      // 验证返回的分类都是1级分类
      response.body.data.categories.forEach((category: any) => {
        expect(category.level).toBe(1);
      });
    }, 10000);

    it('应该能够按父级ID筛选子分类', async () => {
      // 先获取1级分类
      const categoriesResponse = await makeAuthenticatedRequest('GET', `${API_BASE}/products/categories?level=1`);

      if (categoriesResponse.body.data.categories.length > 0) {
        const parentId = categoriesResponse.body.data.categories[0].id;

        const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/categories?parentId=${parentId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.categories).toBeInstanceOf(Array);
        // 验证返回的分类都是指定父级的子分类
        response.body.data.categories.forEach((category: any) => {
          expect(category.parentId).toBe(parentId);
        });
      }
    }, 10000);
  });

  describe('商品标签API', () => {
    it('应该能够获取商品标签列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/tags?page=1&perPage=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 10000);

    it('应该能够获取所有商品标签', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/tags/all`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toBeInstanceOf(Array);
    }, 10000);

    it('应该能够创建新的商品标签', async () => {
      const tagData = {
        name: `测试标签_${Date.now()}`,
        color: '#FF0000',
        description: '这是一个测试标签'
      };

      const response = await makeAdminRequest('POST', `${API_BASE}/products/tags`)
        .send(tagData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(tagData.name);
      expect(response.body.data.color).toBe(tagData.color);
    }, 15000);
  });

  describe('商品列表API', () => {
    it('应该能够获取商品列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/items?page=1&perPage=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('perPage');
    }, 10000);

    it('应该能够按状态筛选商品', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/items?page=1&perPage=10&status=ACTIVE`)
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.products.length > 0) {
        response.body.data.products.forEach((item: any) => {
          expect(item.status).toBe('ACTIVE');
        });
      }
    }, 10000);

    it('应该能够搜索商品', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/items?page=1&perPage=10&search=测试`)
        .expect(200);

      expect(response.body.success).toBe(true);
    }, 10000);
  });

  describe('商品规格API', () => {
    it('应该能够获取商品规格列表', async () => {
      const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/specs?page=1&perPage=10`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.specs).toBeInstanceOf(Array);
      expect(response.body.data).toHaveProperty('pagination');
    }, 10000);

    it('应该能够按商品ID筛选规格', async () => {
      // 先获取商品列表
      const listResponse = await makeAuthenticatedRequest('GET', `${API_BASE}/products/items?page=1&perPage=1`);

      if (listResponse.body.data.products.length > 0) {
        const productId = listResponse.body.data.products[0].id;

        const response = await makeAuthenticatedRequest('GET', `${API_BASE}/products/specs?page=1&perPage=10&productId=${productId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        if (response.body.data.specs.length > 0) {
          response.body.data.specs.forEach((spec: any) => {
            expect(spec.productId).toBe(productId);
          });
        }
      }
    }, 10000);
  });
});