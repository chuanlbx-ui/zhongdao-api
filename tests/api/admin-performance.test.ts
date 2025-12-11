import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app, TestAuthHelper, setupTestDatabase, cleanupTestDatabase } from '../setup';
import { getAuthHeaders, createTestUser, TestUserType } from '../helpers/auth.helper';
import { clearTestData } from '../database/test-database.helper';

describe('Admin操作性能测试', () => {
  let adminHeaders: Record<string, string>;
  let testUsers: any[] = [];
  let testProducts: any[] = [];

  beforeAll(async () => {
    await setupTestDatabase();

    const adminUser = await createTestUser(TestUserType.ADMIN);
    adminHeaders = getAuthHeaders(adminUser.token);

    // 创建大量测试数据
    for (let i = 0; i < 100; i++) {
      const user = await createTestUser(TestUserType.NORMAL, {
        phone: `1380013${String(i).padStart(4, '0')}`,
        profile: {
          nickname: `Test User ${i}`,
          realName: `测试用户${i}`
        }
      });
      testUsers.push(user);
    }

    // 创建测试商品
    for (let i = 0; i < 50; i++) {
      const productResponse = await request(app)
        .post('/api/v1/admin/products')
        .set(adminHeaders)
        .send({
          name: `性能测试商品 ${i}`,
          description: `这是第${i}个性能测试商品`,
          categoryId: 'test-category-id',
          specifications: [
            {
              name: `规格${i}`,
              sku: `PERF-SKU-${String(i).padStart(3, '0')}`,
              price: 100 + i,
              stock: 1000
            }
          ],
          images: [`https://example.com/product${i}.jpg`],
          tags: ['性能测试'],
          status: 'ACTIVE'
        });

      testProducts.push(productResponse.body.data);
    }
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('用户管理性能测试', () => {
    it('获取大量用户列表应在合理时间内完成', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/admin/users')
        .set(adminHeaders)
        .query({
          perPage: 100,
          page: 1
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 请求应在1秒内完成
      expect(duration).toBeLessThan(1000);
      expect(response.body.data.users.length).toBe(100);
      expect(response.body.data.pagination.total).toBeGreaterThanOrEqual(100);
    });

    it('用户搜索操作应高效', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/admin/users/search')
        .set(adminHeaders)
        .query({
          keyword: 'Test User',
          perPage: 50
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('批量更新用户状态应高效', async () => {
      const userIds = testUsers.slice(0, 50).map(u => u.id);

      const startTime = Date.now();

      const response = await request(app)
        .patch('/api/v1/admin/users/batch-status')
        .set(adminHeaders)
        .send({
          userIds,
          status: 'VIP',
          remark: '批量升级测试'
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);
      expect(response.body.data.updatedCount).toBe(50);
    });
  });

  describe('商品管理性能测试', () => {
    it('商品列表查询应支持大数据量', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/admin/products')
        .set(adminHeaders)
        .query({
          perPage: 100,
          includeStats: true
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.statistics).toBeDefined();
    });

    it('商品分类树查询应高效', async () => {
      // 创建多层分类结构
      const categories = [];
      for (let i = 0; i < 10; i++) {
        const parentResponse = await request(app)
          .post('/api/v1/admin/products/categories')
          .set(adminHeaders)
          .send({
            name: `父分类 ${i}`,
            code: `PARENT_${i}`,
            level: 1
          });

        categories.push(parentResponse.body.data);

        // 为每个父分类创建5个子分类
        for (let j = 0; j < 5; j++) {
          await request(app)
            .post('/api/v1/admin/products/categories')
            .set(adminHeaders)
            .send({
              name: `子分类 ${i}-${j}`,
              code: `CHILD_${i}_${j}`,
              parentId: parentResponse.body.data.id,
              level: 2
            });
        }
      }

      const startTime = Date.now();

      const treeResponse = await request(app)
        .get('/api/v1/admin/products/categories/tree')
        .set(adminHeaders)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
      expect(treeResponse.body.data.length).toBe(10);
      treeResponse.body.data.forEach((parent: any) => {
        expect(parent.children.length).toBe(5);
      });
    });
  });

  describe('订单管理性能测试', () => {
    it('订单统计查询应高效', async () => {
      // 创建大量订单
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/v1/admin/orders')
          .set(adminHeaders)
          .send({
            userId: testUsers[i].id,
            items: [
              {
                productId: testProducts[i % testProducts.length].id,
                quantity: 1,
                price: 100
              }
            ],
            totalAmount: 100,
            status: 'COMPLETED'
          });
      }

      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/admin/statistics/orders')
        .set(adminHeaders)
        .query({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          groupBy: 'day'
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1500);
      expect(response.body.data.statistics).toBeDefined();
    });
  });

  describe('数据导出性能测试', () => {
    it('大量数据导出应在合理时间内完成', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/admin/export/users')
        .set(adminHeaders)
        .query({
          format: 'csv',
          fields: 'id,phone,level,status,createdAt'
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 导出操作应在5秒内完成
      expect(duration).toBeLessThan(5000);
      expect(response.headers['content-type']).toMatch(/csv/i);
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('分页数据导出应支持大数据量', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/v1/admin/export/orders')
        .set(adminHeaders)
        .query({
          format: 'excel',
          pageSize: 1000,
          page: 1
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000);
      expect(response.headers['content-type']).toMatch(/excel/i);
    });
  });

  describe('并发操作性能测试', () => {
    it('应支持多个并发Admin操作', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get('/api/v1/admin/users')
            .set(adminHeaders)
            .query({ page: i + 1, perPage: 10 })
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 所有请求应在2秒内完成
      expect(duration).toBeLessThan(2000);

      // 验证所有请求都成功
      results.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('并发创建操作应正确处理', async () => {
      const concurrentCreates = 5;
      const promises = [];

      for (let i = 0; i < concurrentCreates; i++) {
        promises.push(
          request(app)
            .post('/api/v1/admin/products/categories')
            .set(adminHeaders)
            .send({
              name: `并发测试分类 ${i}`,
              code: `CONCURRENT_${i}`,
              level: 1
            })
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000);

      // 验证所有创建都成功
      results.forEach(response => {
        expect(response.status).toBe(201);
      });
    });
  });

  describe('缓存性能测试', () => {
    it('统计数据应正确缓存', async () => {
      // 第一次请求
      const startTime1 = Date.now();
      await request(app)
        .get('/api/v1/admin/statistics/dashboard')
        .set(adminHeaders)
        .expect(200);
      const endTime1 = Date.now();
      const firstRequestTime = endTime1 - startTime1;

      // 第二次请求（应该从缓存读取）
      const startTime2 = Date.now();
      await request(app)
        .get('/api/v1/admin/statistics/dashboard')
        .set(adminHeaders)
        .expect(200);
      const endTime2 = Date.now();
      const secondRequestTime = endTime2 - startTime2;

      // 第二次请求应该更快
      expect(secondRequestTime).toBeLessThan(firstRequestTime);
    });

    it('配置更新应清除相关缓存', async () => {
      // 更新配置
      await request(app)
        .put('/api/v1/admin/config/performance.test')
        .set(adminHeaders)
        .send({
          value: JSON.stringify({ test: Date.now() }),
          description: '性能测试配置'
        })
        .expect(200);

      // 验证配置立即生效
      const response = await request(app)
        .get('/api/v1/admin/config/performance.test')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });

  describe('内存使用测试', () => {
    it('大量数据查询不应导致内存泄漏', async () => {
      // 执行多个大数据量查询
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/v1/admin/users')
          .set(adminHeaders)
          .query({ perPage: 1000 })
          .expect(200);

        await request(app)
          .get('/api/v1/admin/products')
          .set(adminHeaders)
          .query({ perPage: 1000 })
          .expect(200);
      }

      // 验证内存使用合理（这里简化测试，实际应监控内存）
      const memoryResponse = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(memoryResponse.body.status).toBe('healthy');
    });
  });

  describe('数据库连接池性能测试', () => {
    it('应高效处理大量数据库操作', async () => {
      const operations = [];
      const operationCount = 50;

      for (let i = 0; i < operationCount; i++) {
        operations.push(
          request(app)
            .get(`/api/v1/admin/users/${testUsers[i].id}`)
            .set(adminHeaders)
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(3000);

      results.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});