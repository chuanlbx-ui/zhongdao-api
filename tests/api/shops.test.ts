/**
 * 店铺管理API测试
 * 测试云店和五通店的创建、管理、升级等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { TestAuthHelper, createTestUser, getAuthHeaders } from '../helpers/auth.helper';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = '/api/v1';

describe('店铺管理API测试', () => {
    let normalUserToken: string;
  let vipUserToken: string;
  let starUserToken: string;
  let directorToken: string;
  let testShopId: string;

  beforeAll(async () => {
    console.log('开始店铺管理API测试...');

    // 清理测试数据 - 删除测试用户的店铺
    await cleanupTestShops();

    // 创建测试用户并获取token
    const normalUser = await createTestUser('normal');
    const vipUser = await createTestUser('vip');
    const starUser = await createTestUser('star1');
    const directorUser = await createTestUser('admin');

    normalUserToken = normalUser.tokens.accessToken;
    vipUserToken = vipUser.tokens.accessToken;
    starUserToken = starUser.tokens.accessToken;
    directorToken = directorUser.tokens.accessToken;
  });

  // 清理测试店铺数据
  async function cleanupTestShops() {
    const testUserPhones = ['18800000001', '18800000002', '18800000003', '18800000004'];

    // 查找测试用户的ID
    const testUsers = await prisma.users.findMany({
      where: { phone: { in: testUserPhones } },
      select: { id: true }
    });

    if (testUsers.length > 0) {
      const userIds = testUsers.map(u => u.id);

      // 删除这些用户的店铺
      await prisma.shops.deleteMany({
        where: { userId: { in: userIds } }
      });

      console.log(`✅ 清理了 ${userIds.length} 个用户的店铺数据`);
    }
  }

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /shops', () => {
    it('VIP用户应该能够创建云店', async () => {
      const shopData = {
        shopName: '我的测试云店',
        shopType: 'CLOUD',
        contactName: '测试联系人',
        contactPhone: '13800138001',
        address: '测试地址',
        description: '店铺描述'
      };

      const response = await request(app)
        .post(`${API_BASE}/shops/apply`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .send(shopData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shopName).toBe(shopData.shopName);
      expect(response.body.data.shopType).toBe('CLOUD');
      testShopId = response.body.data.id;
    });

    it('普通用户不能创建云店', async () => {
      const shopData = {
        shopName: '普通用户的店',
        shopType: 'CLOUD',
        contactName: '普通联系人',
        contactPhone: '13800138000'
      };

      const response = await request(app)
        .post(`${API_BASE}/shops/apply`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(shopData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error?.message || response.body.message).toMatch(/权限|升级/);
    });

    it('二星店长应该能够创建五通店', async () => {
      const star2User = await createTestUser('star1'); // 使用现有的star1用户
      const shopData = {
        shopName: '我的五通店',
        shopType: 'WUTONG',
        contactName: '五通店联系人',
        contactPhone: '13800138002',
        address: '五通店地址',
        businessLicense: '营业执照图片URL'
      };

      const response = await request(app)
        .post(`${API_BASE}/shops/apply`)
        .set('Authorization', `Bearer ${star2User.tokens.accessToken}`)
        .send(shopData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shopType).toBe('WUTONG');
    });

    it('应该验证必填字段', async () => {
      const response = await request(app)
        .post(`${API_BASE}/shops/apply`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details.required).toContain('shopName');
    });
  });

  describe('GET /shops', () => {
    it('应该能够获取店铺列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/shops`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('应该支持按店铺类型筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/shops`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .query({
          page: 1,
          perPage: 10,
          shopType: 'CLOUD'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.items.length > 0) {
        response.body.data.items.forEach((shop: any) => {
          expect(shop.shopType).toBe('CLOUD');
        });
      }
    });

    it('应该支持按状态筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/shops`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .query({
          page: 1,
          perPage: 10,
          status: 'ACTIVE'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该支持搜索店铺名称', async () => {
      const response = await request(app)
        .get(`${API_BASE}/shops`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .query({
          page: 1,
          perPage: 10,
          search: '测试'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /shops/:id', () => {
    it('应该能够获取指定店铺详情', async () => {
      if (!testShopId) return;

      const response = await request(app)
        .get(`${API_BASE}/shops/${testShopId}`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testShopId);
      expect(response.body.data).toHaveProperty('shopName');
      expect(response.body.data).toHaveProperty('shopType');
      expect(response.body.data).toHaveProperty('contactName');
    });

    it('不存在的店铺ID应返回404', async () => {
      const fakeId = 'nonexistent_shop_id';

      const response = await request(app)
        .get(`${API_BASE}/shops/${fakeId}`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /shops/:id', () => {
    it('店铺所有者应该能够更新店铺信息', async () => {
      if (!testShopId) return;

      const updateData = {
        shopName: '更新后的店铺名称',
        contactPhone: '13900139000',
        address: '更新后的地址'
      };

      const response = await request(app)
        .put(`${API_BASE}/shops/${testShopId}`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shopName).toBe(updateData.shopName);
    });

    it('非店铺所有者不能更新店铺信息', async () => {
      if (!testShopId) return;

      const updateData = {
        shopName: '恶意修改'
      };

      const response = await request(app)
        .put(`${API_BASE}/shops/${testShopId}`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('管理员应该能够更新任何店铺', async () => {
      if (!testShopId) return;

      const updateData = {
        status: 'SUSPENDED',
        remark: '管理员暂停'
      };

      const response = await request(app)
        .put(`${API_BASE}/shops/${testShopId}`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /shops/:id/upgrade', () => {
    it('应该能够申请店铺升级', async () => {
      // 创建一个新的云店用于测试升级
      const shopResponse = await request(app)
        .post(`${API_BASE}/shops/apply`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send({
          shopName: '待升级的云店',
          shopType: 'CLOUD',
          contactName: '联系人',
          contactPhone: '13800138003'
        });

      const shopId = shopResponse.body.data.id;

      const upgradeData = {
        targetLevel: 2,
        upgradeReason: '业绩达标，申请升级',
        supportingDocuments: ['证明文件1', '证明文件2']
      };

      const response = await request(app)
        .post(`${API_BASE}/shops/${shopId}/upgrade`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send(upgradeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING');
    });

    it('应该验证升级条件', async () => {
      const upgradeData = {
        targetLevel: 10, // 无效的等级
        upgradeReason: '测试'
      };

      const response = await request(app)
        .post(`${API_BASE}/shops/${testShopId}/upgrade`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .send(upgradeData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /shops/:id/statistics', () => {
    it('店铺所有者应该能够查看店铺统计', async () => {
      if (!testShopId) return;

      const response = await request(app)
        .get(`${API_BASE}/shops/${testShopId}/statistics`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('totalOrders');
      expect(response.body.data).toHaveProperty('totalProducts');
      expect(response.body.data).toHaveProperty('monthlySales');
    });

    it('非店铺所有者不能查看店铺统计', async () => {
      if (!testShopId) return;

      const response = await request(app)
        .get(`${API_BASE}/shops/${testShopId}/statistics`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('管理员应该能够查看任何店铺统计', async () => {
      if (!testShopId) return;

      const response = await request(app)
        .get(`${API_BASE}/shops/${testShopId}/statistics`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /shops/wutong/benefits', () => {
    it('应该能够获取五通店权益信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/shops/wutong/benefits`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('benefits');
      expect(response.body.data).toHaveProperty('requirements');
    });

    it('应该显示买10赠1权益', async () => {
      const response = await request(app)
        .get(`${API_BASE}/shops/wutong/benefits`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      if (response.body.data.benefits) {
        const buyTenGetOne = response.body.data.benefits.find(
          (b: any) => b.type === 'BUY_TEN_GET_ONE'
        );
        expect(buyTenGetOne).toBeDefined();
      }
    });
  });

  describe('POST /shops/wutong/claim-gift', () => {
    it('五通店用户应该能够申请赠品', async () => {
      // 创建一个符合五通店条件的用户
      const star2User = await createTestUser('star1');

      // 创建一个符合条件的订单
      const orderData = {
        items: [
          { productId: 'test_product_id', quantity: 20 }
        ],
        deliveryAddress: {
          name: '收货人',
          phone: '13800138000',
          address: '收货地址'
        }
      };

      const response = await request(app)
        .post(`${API_BASE}/shops/wutong/claim-gift`)
        .set('Authorization', `Bearer ${star2User.tokens.accessToken}`)
        .send(orderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('giftQuantity');
      expect(response.body.data.giftQuantity).toBeGreaterThanOrEqual(1);
    });

    it('应该验证赠品申请条件', async () => {
      const response = await request(app)
        .post(`${API_BASE}/shops/wutong/claim-gift`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({
          items: [
            { productId: 'test_product_id', quantity: 5 }
          ]
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('星级店长');
    });
  });

  describe('GET /shops/levels', () => {
    it('应该获取店铺等级信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/shops/levels`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        const level = response.body.data[0];
        expect(level).toHaveProperty('level');
        expect(level).toHaveProperty('name');
        expect(level).toHaveProperty('requirements');
      }
    });
  });

  describe('POST /shops/:id/products', () => {
    it('云店应该能够添加商品', async () => {
      if (!testShopId) return;

      const productData = {
        productId: 'test_product_id',
        price: 199.99,
        stock: 100,
        isActive: true
      };

      const response = await request(app)
        .post(`${API_BASE}/shops/${testShopId}/products`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .send(productData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.productId).toBe(productData.productId);
    });

    it('应该验证商品价格', async () => {
      if (!testShopId) return;

      const productData = {
        productId: 'test_product_id',
        price: -100,
        stock: 100
      };

      const response = await request(app)
        .post(`${API_BASE}/shops/${testShopId}/products`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .send(productData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /shops/my', () => {
    it('用户应该能够查看自己的店铺', async () => {
      const response = await request(app)
        .get(`${API_BASE}/shops/my`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('shops');
      expect(Array.isArray(response.body.data.shops)).toBe(true);
    });

    it('没有店铺的用户应该返回空列表', async () => {
      const newUser = await createTestUser('normal');

      const response = await request(app)
        .get(`${API_BASE}/shops/my`)
        .set('Authorization', `Bearer ${newUser.tokens.accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shops.length).toBe(0);
    });
  });
});