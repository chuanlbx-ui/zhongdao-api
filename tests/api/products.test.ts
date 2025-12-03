/**
 * 商品管理API测试套件
 * 测试商品分类、商品列表、商品详情等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, setupTestDatabase, cleanupTestDatabase, generateTestData } from '../setup';

const API_BASE = '/api/v1';

describe('商品管理API测试', () => {
  let authToken: string = '';
  let adminToken: string = '';
  let testCategoryId: string = '';
  let testProductId: string = '';

  beforeAll(async () => {
    console.log('开始商品管理API测试...');
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // 每个测试前可以重置token
  });

  describe('商品分类API', () => {
    it('应该能够获取商品分类树', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/categories/tree`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('应该能够获取商品分类列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/categories`)
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('perPage');
    });

    it('应该能够按级别筛选商品分类', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/categories`)
        .query({ level: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeInstanceOf(Array);
      // 验证返回的分类都是1级分类
      response.body.data.items.forEach((category: any) => {
        expect(category.level).toBe(1);
      });
    });

    it('应该能够按父级ID筛选子分类', async () => {
      // 先获取1级分类
      const categoriesResponse = await request(app)
        .get(`${API_BASE}/products/categories`)
        .query({ level: 1 });

      if (categoriesResponse.body.data.items.length > 0) {
        const parentId = categoriesResponse.body.data.items[0].id;

        const response = await request(app)
          .get(`${API_BASE}/products/categories`)
          .query({ parent_id: parentId })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.items).toBeInstanceOf(Array);
        // 验证返回的分类都是指定父级的子分类
        response.body.data.items.forEach((category: any) => {
          expect(category.parent_id).toBe(parentId);
        });
      }
    });
  });

  describe('商品标签API', () => {
    it('应该能够获取商品标签列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/tags`)
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });

    it('应该能够获取所有商品标签', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/tags/all`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('应该能够创建新的商品标签', async () => {
      const tagData = {
        name: `测试标签_${Date.now()}`,
        color: '#FF0000',
        description: '这是一个测试标签'
      };

      const response = await request(app)
        .post(`${API_BASE}/products/tags`)
        .send(tagData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(tagData.name);
      expect(response.body.data.color).toBe(tagData.color);
    });

    it('应该拒绝重复的标签名称', async () => {
      const tagData = {
        name: '新品', // 假设已存在
        color: '#00FF00'
      };

      const response = await request(app)
        .post(`${API_BASE}/products/tags`)
        .send(tagData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TAG_EXISTS');
    });
  });

  describe('商品列表API', () => {
    it('应该能够获取商品列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/items`)
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('perPage');
      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('应该能够按分类筛选商品', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/items`)
        .query({
          page: 1,
          perPage: 10,
          category_id: 'test_category_id'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该能够按状态筛选商品', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/items`)
        .query({
          page: 1,
          perPage: 10,
          status: 'ACTIVE'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.items.length > 0) {
        response.body.data.items.forEach((item: any) => {
          expect(item.status).toBe('ACTIVE');
        });
      }
    });

    it('应该能够搜索商品', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/items`)
        .query({
          page: 1,
          perPage: 10,
          search: '测试'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该能够按价格范围筛选商品', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/items`)
        .query({
          page: 1,
          perPage: 10,
          min_price: 100,
          max_price: 500
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('商品详情API', () => {
    it('应该能够获取商品详情', async () => {
      // 先获取商品列表找到一个存在的商品
      const listResponse = await request(app)
        .get(`${API_BASE}/products/items`)
        .query({ page: 1, perPage: 1 });

      if (listResponse.body.data.items.length > 0) {
        const productId = listResponse.body.data.items[0].id;

        const response = await request(app)
          .get(`${API_BASE}/products/items/${productId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(productId);
        expect(response.body.data).toHaveProperty('name');
        expect(response.body.data).toHaveProperty('description');
        expect(response.body.data).toHaveProperty('base_price');
        expect(response.body.data).toHaveProperty('status');
      } else {
        console.log('跳过商品详情测试 - 没有可用的商品');
      }
    });

    it('应该返回404当商品不存在', async () => {
      const fakeId = 'non_existent_product_id';

      const response = await request(app)
        .get(`${API_BASE}/products/items/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('商品规格API', () => {
    it('应该能够获取商品规格列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/products/specs`)
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('应该能够按商品ID筛选规格', async () => {
      // 先获取商品列表
      const listResponse = await request(app)
        .get(`${API_BASE}/products/items`)
        .query({ page: 1, perPage: 1 });

      if (listResponse.body.data.items.length > 0) {
        const productId = listResponse.body.data.items[0].id;

        const response = await request(app)
          .get(`${API_BASE}/products/specs`)
          .query({
            page: 1,
            perPage: 10,
            product_id: productId
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        if (response.body.data.items.length > 0) {
          response.body.data.items.forEach((spec: any) => {
            expect(spec.product_id).toBe(productId);
          });
        }
      }
    });
  });

  describe('管理员商品管理API', () => {
    beforeAll(async () => {
      // 模拟管理员token
      adminToken = 'mock_admin_token_for_testing';
    });

    it('应该能够创建新商品（需要管理员权限）', async () => {
      const productData = {
        name: `测试商品_${Date.now()}`,
        description: '这是一个测试商品',
        category_id: 'test_category_id',
        base_price: 199.99,
        total_stock: 100,
        min_stock: 10,
        status: 'ACTIVE',
        images: 'https://example.com/product.jpg'
      };

      const response = await request(app)
        .post(`${API_BASE}/products/items`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(productData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(productData.name);
      testProductId = response.body.data.id;
    });

    it('应该能够更新商品信息（需要管理员权限）', async () => {
      if (!testProductId) {
        console.log('跳过商品更新测试 - 没有测试商品');
        return;
      }

      const updateData = {
        name: `更新的测试商品_${Date.now()}`,
        base_price: 299.99
      };

      const response = await request(app)
        .put(`${API_BASE}/products/items/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.base_price).toBe(updateData.base_price);
    });

    it('应该能够更新商品状态（需要管理员权限）', async () => {
      if (!testProductId) {
        console.log('跳过商品状态更新测试 - 没有测试商品');
        return;
      }

      const response = await request(app)
        .put(`${API_BASE}/products/items/${testProductId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INACTIVE' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('INACTIVE');
    });

    it('应该拒绝未授权的管理员操作', async () => {
      const productData = {
        name: '未授权商品',
        base_price: 99.99
      };

      const response = await request(app)
        .post(`${API_BASE}/products/items`)
        .send(productData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('批量操作API', () => {
    it('应该能够批量创建商品标签', async () => {
      const tagsData = [
        { name: `批量标签1_${Date.now()}`, color: '#FF0000' },
        { name: `批量标签2_${Date.now()}`, color: '#00FF00' },
        { name: `批量标签3_${Date.now()}`, color: '#0000FF' }
      ];

      const response = await request(app)
        .post(`${API_BASE}/products/tags/batch`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tags: tagsData })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success.length).toBe(tagsData.length);
      expect(response.body.data.failure.length).toBe(0);
    });

    it('应该能够批量更新商品状态', async () => {
      // 如果有测试商品，执行批量状态更新
      if (testProductId) {
        const response = await request(app)
          .post(`${API_BASE}/products/items/batch-status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            ids: [testProductId],
            status: 'ACTIVE'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });
});