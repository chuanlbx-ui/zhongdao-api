import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, TestAuthHelper, setupTestDatabase, cleanupTestDatabase } from '../setup';
import { getAuthHeaders, createTestUser, TestUserType } from '../helpers/auth.helper';
import { clearTestData } from '../database/test-database.helper';

describe('Admin用户角色和权限详细测试', () => {
  let adminHeaders: Record<string, string>;
  let directorHeaders: Record<string, string>;
  let normalHeaders: Record<string, string>;
  let testUsers: any[] = [];

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建不同权限级别的测试用户
    const adminUser = await createTestUser(TestUserType.ADMIN);
    const directorUser = await createTestUser(TestUserType.DIRECTOR);
    const normalUser = await createTestUser(TestUserType.NORMAL);

    testUsers.push(adminUser, directorUser, normalUser);

    adminHeaders = getAuthHeaders(adminUser.token);
    directorHeaders = getAuthHeaders(directorUser.token);
    normalHeaders = getAuthHeaders(normalUser.token);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  describe('Admin用户认证测试', () => {
    it('Admin用户应能成功访问系统', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.data.role).toBe('ADMIN');
      expect(response.body.data.permissions).toContain('admin:access');
    });

    it('Admin用户应能访问所有管理端点', async () => {
      const adminEndpoints = [
        '/api/v1/admin/users',
        '/api/v1/admin/shops',
        '/api/v1/admin/orders',
        '/api/v1/admin/products',
        '/api/v1/admin/payments',
        '/api/v1/admin/points',
        '/api/v1/admin/inventory',
        '/api/v1/admin/teams',
        '/api/v1/admin/commissions',
        '/api/v1/admin/statistics',
        '/api/v1/admin/config',
        '/api/v1/admin/logs'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set(adminHeaders)
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('Admin用户管理权限测试', () => {
    it('Admin应能创建所有类型的用户', async () => {
      const userTypes = ['NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'];

      for (const userType of userTypes) {
        const userData = {
          phone: `1380013${Math.random().toString().slice(2, 6)}`,
          password: 'test123456',
          level: userType,
          wechatOpenId: `test_wechat_${userType.toLowerCase()}_${Date.now()}`,
          profile: {
            nickname: `Test ${userType} User`,
            realName: `测试${userType}用户`,
            avatar: `https://example.com/avatar-${userType.toLowerCase()}.jpg`
          }
        };

        const response = await request(app)
          .post('/api/v1/admin/users')
          .set(adminHeaders)
          .send(userData)
          .expect(201);

        expect(response.body.data.user.level).toBe(userType);
      }
    });

    it('Admin应能修改任何用户的信息', async () => {
      // 先创建一个普通用户
      const testUser = await createTestUser(TestUserType.NORMAL);

      const updateData = {
        level: 'VIP',
        status: 'ACTIVE',
        profile: {
          nickname: 'Updated by Admin',
          realName: '管理员更新'
        }
      };

      const response = await request(app)
        .put(`/api/v1/admin/users/${testUser.id}`)
        .set(adminHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.data.level).toBe('VIP');
      expect(response.body.data.profile.nickname).toBe('Updated by Admin');
    });

    it('Admin应能禁用/启用用户', async () => {
      const testUser = await createTestUser(TestUserType.NORMAL);

      // 禁用用户
      await request(app)
        .patch(`/api/v1/admin/users/${testUser.id}/disable`)
        .set(adminHeaders)
        .expect(200);

      // 验证用户被禁用
      const disabledResponse = await request(app)
        .get(`/api/v1/admin/users/${testUser.id}`)
        .set(adminHeaders)
        .expect(200);

      expect(disabledResponse.body.data.status).toBe('DISABLED');

      // 启用用户
      await request(app)
        .patch(`/api/v1/admin/users/${testUser.id}/enable`)
        .set(adminHeaders)
        .expect(200);

      // 验证用户被启用
      const enabledResponse = await request(app)
        .get(`/api/v1/admin/users/${testUser.id}`)
        .set(adminHeaders)
        .expect(200);

      expect(enabledResponse.body.data.status).toBe('ACTIVE');
    });
  });

  describe('Admin商品管理权限测试', () => {
    let testCategory: any;
    let testProduct: any;

    beforeEach(async () => {
      // 创建测试分类
      const categoryResponse = await request(app)
        .post('/api/v1/admin/products/categories')
        .set(adminHeaders)
        .send({
          name: '测试分类',
          code: 'TEST_CATEGORY',
          level: 1,
          commissionRate: 0.1
        });

      testCategory = categoryResponse.body.data;
    });

    it('Admin应能创建商品分类', async () => {
      const categoryData = {
        name: 'Admin创建的分类',
        code: 'ADMIN_CATEGORY',
        parentId: testCategory.id,
        level: 2,
        commissionRate: 0.15
      };

      const response = await request(app)
        .post('/api/v1/admin/products/categories')
        .set(adminHeaders)
        .send(categoryData)
        .expect(201);

      expect(response.body.data.name).toBe('Admin创建的分类');
      expect(response.body.data.parentId).toBe(testCategory.id);
    });

    it('Admin应能创建和管理商品', async () => {
      // 创建商品
      const productData = {
        name: 'Admin测试商品',
        description: '这是管理员创建的测试商品',
        categoryId: testCategory.id,
        specifications: [
          {
            name: '规格1',
            sku: 'ADMIN-SKU-001',
            price: 199.99,
            vipPrice: 179.99,
            stock: 1000
          }
        ],
        images: ['https://example.com/product1.jpg'],
        tags: ['新品', '热卖'],
        status: 'ACTIVE'
      };

      const createResponse = await request(app)
        .post('/api/v1/admin/products')
        .set(adminHeaders)
        .send(productData)
        .expect(201);

      testProduct = createResponse.body.data;

      // 更新商品
      const updateData = {
        name: '更新后的商品名称',
        status: 'INACTIVE'
      };

      const updateResponse = await request(app)
        .put(`/api/v1/admin/products/${testProduct.id}`)
        .set(adminHeaders)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.name).toBe('更新后的商品名称');
      expect(updateResponse.body.data.status).toBe('INACTIVE');

      // 删除商品
      await request(app)
        .delete(`/api/v1/admin/products/${testProduct.id}`)
        .set(adminHeaders)
        .expect(204);
    });
  });

  describe('Admin订单管理权限测试', () {
    it('Admin应能查看所有订单', async () => {
      const response = await request(app)
        .get('/api/v1/admin/orders')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.orders)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('Admin应能修改订单状态', async () => {
      // 先创建一个测试订单
      const testUser = await createTestUser(TestUserType.NORMAL);

      const orderData = {
        userId: testUser.id,
        items: [
          {
            productId: 'test-product-id',
            specificationId: 'test-spec-id',
            quantity: 2,
            price: 100
          }
        ],
        totalAmount: 200,
        paymentMethod: 'POINTS'
      };

      const orderResponse = await request(app)
        .post('/api/v1/admin/orders')
        .set(adminHeaders)
        .send(orderData)
        .expect(201);

      const orderId = orderResponse.body.data.id;

      // 更新订单状态
      const statusUpdate = {
        status: 'PROCESSING',
        remark: '管理员处理中'
      };

      const updateResponse = await request(app)
        .patch(`/api/v1/admin/orders/${orderId}/status`)
        .set(adminHeaders)
        .send(statusUpdate)
        .expect(200);

      expect(updateResponse.body.data.status).toBe('PROCESSING');
    });
  });

  describe('Admin积分管理权限测试', ()) => {
    it('Admin应能给用户充值积分', async () => {
      const testUser = await createTestUser(TestUserType.NORMAL);

      const rechargeData = {
        userId: testUser.id,
        amount: 10000,
        type: 'RECHARGE',
        remark: '管理员充值测试'
      };

      const response = await request(app)
        .post('/api/v1/admin/points/recharge')
        .set(adminHeaders)
        .send(rechargeData)
        .expect(201);

      expect(response.body.data.amount).toBe(10000);
      expect(response.body.data.type).toBe('RECHARGE');

      // 验证用户余额
      const balanceResponse = await request(app)
        .get(`/api/v1/admin/users/${testUser.id}/points`)
        .set(adminHeaders)
        .expect(200);

      expect(balanceResponse.body.data.balance).toBeGreaterThan(0);
    });

    it('Admin应能冻结/解冻用户积分', async () => {
      const testUser = await createTestUser(TestUserType.NORMAL);

      // 冻结积分
      await request(app)
        .post(`/api/v1/admin/points/freeze`)
        .set(adminHeaders)
        .send({
          userId: testUser.id,
          amount: 5000,
          reason: '违规操作冻结'
        })
        .expect(201);

      // 解冻积分
      await request(app)
        .post(`/api/v1/admin/points/unfreeze`)
        .set(adminHeaders)
        .send({
          userId: testUser.id,
          amount: 5000,
          reason: '解冻'
        })
        .expect(201);
    });
  });

  describe('Admin系统配置权限测试', () => {
    it('Admin应能修改系统配置', async () => {
      const configData = {
        key: 'test.admin.config',
        value: JSON.stringify({
          enabled: true,
          maxUsers: 10000,
          maintenance: false
        }),
        description: '管理员测试配置'
      };

      const response = await request(app)
        .put('/api/v1/admin/config/test.admin.config')
        .set(adminHeaders)
        .send(configData)
        .expect(200);

      expect(response.body.data.value).toBe(configData.value);
    });

    it('Admin应能查看系统日志', async () => {
      const response = await request(app)
        .get('/api/v1/admin/logs')
        .set(adminHeaders)
        .query({
          type: 'USER_LOGIN',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.logs)).toBe(true);
    });
  });

  describe('Admin数据统计权限测试', () => {
    it('Admin应能查看所有统计数据', async () => {
      const statisticsEndpoints = [
        '/api/v1/admin/statistics/users',
        '/api/v1/admin/statistics/orders',
        '/api/v1/admin/statistics/products',
        '/api/v1/admin/statistics/revenue',
        '/api/v1/admin/statistics/commissions',
        '/api/v1/admin/statistics/points'
      ];

      for (const endpoint of statisticsEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set(adminHeaders)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      }
    });

    it('Admin应能导出数据', async () => {
      const exportEndpoints = [
        '/api/v1/admin/export/users',
        '/api/v1/admin/export/orders',
        '/api/v1/admin/export/products',
        '/api/v1/admin/export/commissions'
      ];

      for (const endpoint of exportEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set(adminHeaders)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/csv|excel/i);
      }
    });
  });

  describe('权限隔离测试', () => {
    it('非Admin用户不能访问管理端点', async () => {
      const adminEndpoints = [
        '/api/v1/admin/users',
        '/api/v1/admin/products',
        '/api/v1/admin/orders',
        '/api/v1/admin/statistics',
        '/api/v1/admin/config'
      ];

      // 测试总监权限
      for (const endpoint of adminEndpoints) {
        await request(app)
          .get(endpoint)
          .set(directorHeaders)
          .expect(403);
      }

      // 测试普通用户权限
      for (const endpoint of adminEndpoints) {
        await request(app)
          .get(endpoint)
          .set(normalHeaders)
          .expect(403);
      }
    });

    it('不同权限级别应有不同的操作范围', async () => {
      const testUser = await createTestUser(TestUserType.NORMAL);

      // Admin可以操作任何用户
      await request(app)
        .get(`/api/v1/admin/users/${testUser.id}`)
        .set(adminHeaders)
        .expect(200);

      // Director不能访问其他用户的详细信息
      await request(app)
        .get(`/api/v1/admin/users/${testUser.id}`)
        .set(directorHeaders)
        .expect(403);

      // 普通用户只能访问自己的信息
      await request(app)
        .get(`/api/v1/users/${testUser.id}`)
        .set(normalHeaders)
        .expect(403); // 不能访问admin接口
    });
  });

  describe('Admin操作审计测试', () => {
    it('所有Admin操作都应被记录', async () => {
      // 执行一些Admin操作
      await request(app)
        .get('/api/v1/admin/users')
        .set(adminHeaders)
        .expect(200);

      await request(app)
        .post('/api/v1/admin/products/categories')
        .set(adminHeaders)
        .send({
          name: '审计测试分类',
          code: 'AUDIT_TEST'
        })
        .expect(201);

      // 检查审计日志
      const auditResponse = await request(app)
        .get('/api/v1/admin/logs')
        .set(adminHeaders)
        .query({
          type: 'ADMIN_OPERATION',
          userId: testUsers[0].id
        })
        .expect(200);

      expect(auditResponse.body.data.logs.length).toBeGreaterThan(0);
      auditResponse.body.data.logs.forEach((log: any) => {
        expect(log.type).toBe('ADMIN_OPERATION');
        expect(log.userId).toBe(testUsers[0].id);
      });
    });
  });
});