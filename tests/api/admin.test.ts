import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, TestAuthHelper, setupTestDatabase, cleanupTestDatabase } from '../setup';
import { getAuthHeaders, createTestUser, TestUserType } from '../helpers/auth.helper';
import { clearTestData } from '../database/test-database.helper';

describe('Admin基础功能测试', () => {
  let adminHeaders: Record<string, string>;
  let testUsers: any[] = [];

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建Admin用户
    const adminUser = await createTestUser(TestUserType.ADMIN);
    adminHeaders = getAuthHeaders(adminUser.token);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  describe('Admin认证测试', () => {
    it('Admin应能成功获取用户信息', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('ADMIN');
    });

    it('Admin应能访问系统健康状态', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });

  describe('Admin用户管理测试', () => {
    it('Admin应能创建普通用户', async () => {
      const userData = {
        phone: `1380013${Math.random().toString().slice(2, 6)}`,
        password: 'test123456',
        level: 'NORMAL',
        profile: {
          nickname: '测试用户',
          realName: '测试真实姓名'
        }
      };

      const response = await request(app)
        .post('/api/v1/admin/users')
        .set(adminHeaders)
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.level).toBe('NORMAL');
      testUsers.push(response.body.data.user);
    });

    it('Admin应能获取用户列表', async () => {
      // 先创建一些测试用户
      for (let i = 0; i < 5; i++) {
        const user = await createTestUser(TestUserType.NORMAL);
        testUsers.push(user);
      }

      const response = await request(app)
        .get('/api/v1/admin/users')
        .set(adminHeaders)
        .query({ perPage: 10, page: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('Admin应能更新用户信息', async () => {
      const testUser = await createTestUser(TestUserType.NORMAL);

      const updateData = {
        status: 'ACTIVE',
        profile: {
          nickname: '更新后的昵称'
        }
      };

      const response = await request(app)
        .put(`/api/v1/admin/users/${testUser.id}`)
        .set(adminHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.nickname).toBe('更新后的昵称');
    });
  });

  describe('Admin商品管理测试', () => {
    let testCategory: any;

    beforeEach(async () => {
      // 创建测试分类
      const categoryResponse = await request(app)
        .post('/api/v1/admin/products/categories')
        .set(adminHeaders)
        .send({
          name: '测试分类',
          code: 'TEST_CATEGORY',
          level: 1
        });

      testCategory = categoryResponse.body.data;
    });

    it('Admin应能创建商品', async () => {
      const productData = {
        name: 'Admin测试商品',
        description: '测试商品描述',
        categoryId: testCategory.id,
        specifications: [
          {
            name: '标准规格',
            sku: 'ADMIN-TEST-001',
            price: 199.99,
            stock: 1000
          }
        ],
        images: ['https://example.com/product.jpg'],
        status: 'ACTIVE'
      };

      const response = await request(app)
        .post('/api/v1/admin/products')
        .set(adminHeaders)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Admin测试商品');
    });

    it('Admin应能获取商品列表', async () => {
      const response = await request(app)
        .get('/api/v1/admin/products')
        .set(adminHeaders)
        .query({ perPage: 20, page: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.products)).toBe(true);
    });
  });

  describe('Admin订单管理测试', () => {
    it('Admin应能查看订单列表', async () => {
      const response = await request(app)
        .get('/api/v1/admin/orders')
        .set(adminHeaders)
        .query({ perPage: 20, page: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.orders)).toBe(true);
    });

    it('Admin应能筛选订单', async () => {
      const response = await request(app)
        .get('/api/v1/admin/orders')
        .set(adminHeaders)
        .query({
          status: 'COMPLETED',
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Admin积分管理测试', () => {
    it('Admin应能查看积分流水', async () => {
      const response = await request(app)
        .get('/api/v1/admin/points/transactions')
        .set(adminHeaders)
        .query({ perPage: 20, page: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.transactions)).toBe(true);
    });

    it('Admin应能查看用户积分余额', async () => {
      const testUser = await createTestUser(TestUserType.NORMAL);

      const response = await request(app)
        .get(`/api/v1/admin/users/${testUser.id}/points`)
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.balance).toBe('number');
    });
  });

  describe('Admin系统配置测试', () => {
    it('Admin应能获取系统配置', async () => {
      const response = await request(app)
        .get('/api/v1/admin/config')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('Admin应能更新系统配置', async () => {
      const configKey = `test.config.${Date.now()}`;
      const configData = {
        value: JSON.stringify({ enabled: true, testMode: true }),
        description: '测试配置'
      };

      const response = await request(app)
        .put(`/api/v1/admin/config/${configKey}`)
        .set(adminHeaders)
        .send(configData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Admin统计分析测试', () => {
    it('Admin应能查看用户统计', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/users')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.statistics).toBeDefined();
    });

    it('Admin应能查看订单统计', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/orders')
        .set(adminHeaders)
        .query({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('Admin应能查看商品统计', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/products')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Admin日志管理测试', () => {
    it('Admin应能查看系统日志', async () => {
      const response = await request(app)
        .get('/api/v1/admin/logs')
        .set(adminHeaders)
        .query({
          type: 'USER_LOGIN',
          perPage: 20
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.logs)).toBe(true);
    });
  });

  describe('权限控制测试', () => {
    it('普通用户不能访问Admin接口', async () => {
      const normalUser = await createTestUser(TestUserType.NORMAL);
      const normalHeaders = getAuthHeaders(normalUser.token);

      const response = await request(app)
        .get('/api/v1/admin/users')
        .set(normalHeaders)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toContain('PERMISSION');
    });
  });
});