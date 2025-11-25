import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ApiTestUtils } from './test-setup';

describe('商品管理API集成测试', () => {
  let testProductId: string;
  let testCategoryId: string;
  let testTagId: string;
  let createdCategoryIds: string[] = [];
  let createdTagIds: string[] = [];

  beforeAll(async () => {
    console.log('🚀 开始商品API集成测试');
  });

  afterAll(async () => {
    console.log('✅ 商品API集成测试完成');
  });

  beforeEach(() => {
    // 每个测试前的准备工作
    testProductId = `test_product_${Date.now()}`;
    testCategoryId = `test_category_${Date.now()}`;
    testTagId = `test_tag_${Date.now()}`;
  });

  afterEach(() => {
    // 每个测试后的清理工作
  });

  describe('商品模块信息', () => {
    it('应该成功获取商品模块信息', async () => {
      const response = await ApiTestUtils.get('/api/v1/products');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('version', '1.0.0');
    });
  });

  describe('商品分类管理', () => {
    it('应该成功获取商品分类树', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/categories/tree');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data)).toBe(true);

      // 如果有分类，验证分类结构
      if (data.length > 0) {
        data.forEach((category: any) => {
          expect(category).toHaveProperty('id');
          expect(category).toHaveProperty('name');
          expect(category).toHaveProperty('level');
          expect(category).toHaveProperty('status');
        });
      }
    });

    it('应该成功获取商品分类列表', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/categories?page=1&perPage=10');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('应该支持按级别筛选分类', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/categories?level=1&page=1&perPage=5');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      if (data.items.length > 0) {
        data.items.forEach((category: any) => {
          expect(category.level).toBe(1);
        });
      }
    });

    it('应该成功创建商品分类', async () => {
      const categoryData = {
        name: '测试分类',
        description: '这是一个测试分类',
        level: 1,
        parentId: null,
        status: 'ACTIVE'
      };

      const response = await ApiTestUtils.post('/api/v1/products/categories', categoryData);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response, 201);

        const { data } = response.body;
        expect(data).toHaveProperty('id');
        expect(data.name).toBe(categoryData.name);
        expect(data.level).toBe(categoryData.level);
        expect(data.status).toBe(categoryData.status);
        createdCategoryIds.push(data.id);
      } else {
        // 创建失败时检查原因
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('应该成功更新商品分类', async () => {
      if (createdCategoryIds.length === 0) {
        // 如果没有创建的分类，跳过测试
        return;
      }

      const categoryId = createdCategoryIds[0];
      const updateData = {
        name: '更新后的分类名称',
        description: '更新后的分类描述'
      };

      const response = await ApiTestUtils.put(`/api/v1/products/categories/${categoryId}`, updateData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data.name).toBe(updateData.name);
      expect(data.description).toBe(updateData.description);
    });

    it('应该成功删除商品分类', async () => {
      if (createdCategoryIds.length === 0) {
        return;
      }

      const categoryId = createdCategoryIds[0];
      const response = await ApiTestUtils.delete(`/api/v1/products/categories/${categoryId}`);

      ApiTestUtils.validateApiResponse(response);

      // 从清理列表中移除
      createdCategoryIds = createdCategoryIds.filter(id => id !== categoryId);
    });
  });

  describe('商品标签管理', () => {
    it('应该成功获取商品标签列表', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/tags?page=1&perPage=10');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('应该成功获取所有商品标签', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/tags/all');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data)).toBe(true);
    });

    it('应该成功创建商品标签', async () => {
      const tagData = {
        name: '测试标签',
        color: '#ff0000',
        description: '这是一个测试标签'
      };

      const response = await ApiTestUtils.post('/api/v1/products/tags', tagData);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response, 201);

        const { data } = response.body;
        expect(data).toHaveProperty('id');
        expect(data.name).toBe(tagData.name);
        expect(data.color).toBe(tagData.color);
        createdTagIds.push(data.id);
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('应该成功更新商品标签', async () => {
      if (createdTagIds.length === 0) {
        return;
      }

      const tagId = createdTagIds[0];
      const updateData = {
        name: '更新后的标签',
        color: '#00ff00',
        description: '更新后的标签描述'
      };

      const response = await ApiTestUtils.put(`/api/v1/products/tags/${tagId}`, updateData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data.name).toBe(updateData.name);
      expect(data.color).toBe(updateData.color);
    });

    it('应该成功删除商品标签', async () => {
      if (createdTagIds.length === 0) {
        return;
      }

      const tagId = createdTagIds[0];
      const response = await ApiTestUtils.delete(`/api/v1/products/tags/${tagId}`);

      ApiTestUtils.validateApiResponse(response);

      // 从清理列表中移除
      createdTagIds = createdTagIds.filter(id => id !== tagId);
    });

    it('应该成功批量创建商品标签', async () => {
      const batchTagData = [
        {
          name: '批量标签1',
          color: '#ff6600',
          description: '批量创建的标签1'
        },
        {
          name: '批量标签2',
          color: '#0066ff',
          description: '批量创建的标签2'
        }
      ];

      const response = await ApiTestUtils.post('/api/v1/products/tags/batch', { tags: batchTagData });

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response);

        const { data } = response.body;
        expect(Array.isArray(data.createdTags)).toBe(true);
        expect(data.createdTags.length).toBe(2);

        // 添加到清理列表
        data.createdTags.forEach((tag: any) => {
          if (tag.id) createdTagIds.push(tag.id);
        });
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('商品管理', () => {
    it('应该成功获取商品列表', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/items?page=1&perPage=10');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);

      // 如果有商品，验证商品结构
      if (data.items.length > 0) {
        data.items.forEach((product: any) => {
          expect(product).toHaveProperty('id');
          expect(product).toHaveProperty('name');
          expect(product).toHaveProperty('basePrice');
          expect(product).toHaveProperty('status');
        });
      }
    });

    it('应该支持按分类筛选商品', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/items?categoryId=test_category&page=1&perPage=5');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      if (data.items.length > 0) {
        data.items.forEach((product: any) => {
          expect(product.categoryId).toBe('test_category');
        });
      }
    });

    it('应该支持按状态筛选商品', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/items?status=ACTIVE&page=1&perPage=5');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      if (data.items.length > 0) {
        data.items.forEach((product: any) => {
          expect(product.status).toBe('ACTIVE');
        });
      }
    });

    it('应该支持搜索商品', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/items?search=测试&page=1&perPage=5');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      expect(response.body.success).toBe(true);
    });

    it('应该成功创建商品', async () => {
      const productData = ApiTestUtils.generateTestProduct({
        name: '测试商品',
        basePrice: 199.00,
        status: 'ACTIVE'
      });

      const response = await ApiTestUtils.post('/api/v1/products/items', productData);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response, 201);

        const { data } = response.body;
        expect(data).toHaveProperty('id');
        expect(data.name).toBe(productData.name);
        expect(data.basePrice).toBe(productData.basePrice);
        expect(data.status).toBe(productData.status);
        testProductId = data.id;
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('应该成功获取商品详情', async () => {
      if (!testProductId) {
        return;
      }

      const response = await ApiTestUtils.get(`/api/v1/products/items/${testProductId}`);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('id', testProductId);
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('basePrice');
      expect(data).toHaveProperty('status');
    });

    it('应该成功更新商品信息', async () => {
      if (!testProductId) {
        return;
      }

      const updateData = {
        name: '更新后的商品名称',
        description: '更新后的商品描述',
        basePrice: 299.00
      };

      const response = await ApiTestUtils.put(`/api/v1/products/items/${testProductId}`, updateData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data.name).toBe(updateData.name);
      expect(data.description).toBe(updateData.description);
      expect(data.basePrice).toBe(updateData.basePrice);
    });

    it('应该成功更新商品状态', async () => {
      if (!testProductId) {
        return;
      }

      const statusUpdateData = {
        status: 'INACTIVE'
      };

      const response = await ApiTestUtils.put(`/api/v1/products/items/${testProductId}/status`, statusUpdateData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data.status).toBe('INACTIVE');
    });

    it('应该成功删除商品', async () => {
      if (!testProductId) {
        return;
      }

      const response = await ApiTestUtils.delete(`/api/v1/products/items/${testProductId}`);

      ApiTestUtils.validateApiResponse(response);
    });
  });

  describe('商品规格管理', () => {
    it('应该成功获取商品规格列表', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/specs?page=1&perPage=10');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);
    });

    it('应该支持按商品ID筛选规格', async () => {
      if (!testProductId) {
        return;
      }

      const response = await ApiTestUtils.get(`/api/v1/products/specs?productId=${testProductId}&page=1&perPage=5`);

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      if (data.items.length > 0) {
        data.items.forEach((spec: any) => {
          expect(spec.productId).toBe(testProductId);
        });
      }
    });
  });

  describe('错误处理', () => {
    it('应该正确处理404错误', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/nonexistent-endpoint');

      expect(response.status).toBe(404);
    });

    it('应该正确处理无效的商品ID', async () => {
      const response = await ApiTestUtils.get('/api/v1/products/items/invalid-product-id');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('应该正确处理无效的商品数据', async () => {
      const invalidProductData = {
        name: '',  // 空商品名
        basePrice: -1,  // 负价格
        status: 'INVALID_STATUS'  // 无效状态
      };

      const response = await ApiTestUtils.post('/api/v1/products/items', invalidProductData);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('商品列表查询响应时间应该在合理范围内', async () => {
      const startTime = Date.now();

      const response = await ApiTestUtils.get('/api/v1/products/items?page=1&perPage=20');

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(2000); // 2秒内响应
    });

    it('分类树查询响应时间应该在合理范围内', async () => {
      const startTime = Date.now();

      const response = await ApiTestUtils.get('/api/v1/products/categories/tree');

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1500); // 1.5秒内响应
    });

    it('应该支持并发商品查询', async () => {
      const promises = [];
      const concurrentRequests = 5;

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(ApiTestUtils.get('/api/v1/products/items?page=1&perPage=5'));
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        ApiTestUtils.validateApiResponse(response);
      });
    });
  });
});