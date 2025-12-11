/**
 * 五通店权益API测试
 * 测试五通店买10赠1权益、赠品申请、发放等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { TestAuthHelper, createTestUser, getAuthHeaders } from '../helpers/auth.helper';
import { PrismaClient, shops_shopType, orders_status, orders_type } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = '/api/v1';

describe('五通店权益API测试', () => {
  let normalUserToken: string;
  let star2UserToken: string;
  let star3UserToken: string;
  let directorToken: string;
  let testProductId: string;
  let testOrderId: string;
  let wutongShopId: string;
  let star2UserId: string;
  let star3UserId: string;

  beforeAll(async () => {
    console.log('开始五通店权益API测试...');

    // 创建测试用户并获取token
    const normalUser = await createTestUser('normal');
    normalUserToken = normalUser.tokens.accessToken;

    const star2User = await createTestUser('star2');
    star2UserToken = star2User.tokens.accessToken;
    star2UserId = star2User.id;

    const star3User = await createTestUser('star3');
    star3UserToken = star3User.tokens.accessToken;
    star3UserId = star3User.id;

    const directorUser = await createTestUser('director');
    directorToken = directorUser.tokens.accessToken;

    // 先创建一个测试分类
    const category = await prisma.productCategories.create({
      data: {
        id: `cmi${Date.now()}`,
        name: '五通商品分类',
        level: 1,
        isActive: true,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // 创建测试商品
    const timestamp = Date.now();
    const product = await prisma.products.create({
      data: {
        id: `cmi${timestamp + 1}`,
        code: `WT_TEST_${timestamp + 1}`,
        name: '测试商品五通装',
        sku: `WT_TEST_${timestamp}`,
        basePrice: 399,
        status: 'ACTIVE',
        categoryId: category.id,
        images: '[]',
        isFeatured: false,
        sort: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    testProductId = product.id;

    // 创建五通店
    const wutongShop = await prisma.shops.create({
      data: {
        id: `cmi${Date.now()}`,
        userId: star2UserId,
        shopType: shops_shopType.WUTONG,
        shopName: `${star2User.nickname}的五通店`,
        shopLevel: 1,
        status: 'ACTIVE',
        contactName: star2User.nickname,
        contactPhone: '13800138000',
        address: '五通店地址',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    wutongShopId = wutongShop.id;

    // 创建测试订单
    const order = await prisma.orders.create({
      data: {
        id: `cmi${timestamp + 2}`,
        orderNo: `WTORDER${timestamp}`,
        buyerId: star2UserId,
        totalAmount: 3990,
        finalAmount: 3990,
        type: orders_type.RETAIL,
        status: orders_status.DELIVERED,
        paymentStatus: 'PAID',
        deliveredAt: new Date(),
        metadata: JSON.stringify({
          wutong_benefit: true,
          qualifies_for_gift: true,
          bottles_purchased: 10
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    testOrderId = order.id;

    // 创建订单项
    await prisma.orderItems.create({
      data: {
        id: `cmi${timestamp + 3}`,
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        quantity: 10,
        unitPrice: 399,
        finalPrice: 3990,
        totalPrice: 3990
      }
    });

    // 更新用户五通店状态
    await prisma.users.update({
      where: { id: star2UserId },
      data: { hasWutongShop: true }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /wutong/benefits', () => {
    it('应该能够获取五通店权益列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/benefits`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        const benefit = response.body.data[0];
        expect(benefit).toHaveProperty('type');
        expect(benefit).toHaveProperty('name');
        expect(benefit).toHaveProperty('description');
        expect(benefit).toHaveProperty('conditions');
      }
    });

    it('应该包含买10赠1权益', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/benefits`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .expect(200);

      const buyTenGetOne = response.body.data.find(
        (b: any) => b.type === 'BUY_TEN_GET_ONE'
      );
      expect(buyTenGetOne).toBeDefined();
      expect(buyTenGetOne.name).toContain('买10赠1');
    });

    it('非五通店用户不能查看权益', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/benefits`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('五通店');
    });
  });

  describe('GET /wutong/eligibility', () => {
    it('五通店用户应该能够查看权益资格', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/eligibility`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isWutongShopOwner');
      expect(response.body.data).toHaveProperty('activeBenefits');
      expect(response.body.data).toHaveProperty('usageHistory');
    });

    it('应该显示当前可用权益次数', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/eligibility`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .expect(200);

      if (response.body.data.activeBenefits) {
        response.body.data.activeBenefits.forEach((benefit: any) => {
          expect(benefit).toHaveProperty('remainingCount');
          expect(benefit).toHaveProperty('nextResetDate');
        });
      }
    });
  });

  describe('POST /wutong/claim-gift', () => {
    it('应该能够申请买10赠1赠品', async () => {
      // 创建符合条件的新订单
      const newTimestamp = Date.now();
      const newOrder = await prisma.orders.create({
        data: {
          id: `cmi${newTimestamp}`,
          orderNo: `WTORDER${newTimestamp}`,
          buyerId: star2UserId,
          totalAmount: 7980,
          finalAmount: 7980,
          type: orders_type.RETAIL,
          status: orders_status.DELIVERED,
          paymentStatus: 'PAID',
          deliveredAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      await prisma.orderItems.create({
        data: {
          id: `cmi${newTimestamp + 1}`,
          orderId: newOrder.id,
          productId: testProductId,
          productName: '测试商品五通装',
          quantity: 20,
          unitPrice: 399,
          finalPrice: 7980,
          totalPrice: 7980
        }
      });

      const claimData = {
        orderId: newOrder.id,
        productId: testProductId,
        purchasedQuantity: 20,
        reason: '买10赠1权益申请'
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/claim-gift`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .send(claimData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('giftRecord');
      expect(response.body.data).toHaveProperty('giftQuantity');
      expect(response.body.data.giftQuantity).toBe(2); // 20瓶送2瓶
    });

    it('应该验证购买数量', async () => {
      const claimData = {
        orderId: 'invalid_order',
        productId: testProductId,
        purchasedQuantity: 5 // 不足10瓶
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/claim-gift`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .send(claimData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('购买数量');
    });

    it('非五通店用户不能申请赠品', async () => {
      const claimData = {
        productId: testProductId,
        purchasedQuantity: 15
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/claim-gift`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(claimData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('重复申请应该返回错误', async () => {
      // 先申请一次
      await request(app)
        .post(`${API_BASE}/wutong/claim-gift`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .send({
          orderId: testOrderId,
          productId: testProductId,
          purchasedQuantity: 10
        })
        .expect(200);

      // 再次申请
      const response = await request(app)
        .post(`${API_BASE}/wutong/claim-gift`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .send({
          orderId: testOrderId,
          productId: testProductId,
          purchasedQuantity: 10
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('已申请');
    });
  });

  describe('GET /wutong/gifts', () => {
    it('应该能够获取赠品记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/gifts`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .query({
          page: 1,
          perPage: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(Array.isArray(response.body.data.items)).toBe(true);

      if (response.body.data.items.length > 0) {
        const gift = response.body.data.items[0];
        expect(gift).toHaveProperty('productId');
        expect(gift).toHaveProperty('quantity');
        expect(gift).toHaveProperty('status');
        expect(gift).toHaveProperty('createdAt');
      }
    });

    it('应该支持按状态筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/gifts`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .query({
          page: 1,
          perPage: 10,
          status: 'COMPLETED'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('管理员应该能查看所有赠品记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/gifts`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          page: 1,
          perPage: 10,
          allUsers: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /wutong/gifts/:id/ship', () => {
    let testGiftId: string;

    beforeEach(async () => {
      // 创建一个待发货的赠品记录
      const gift = await prisma.giftRecords.create({
        data: {
          id: `cmi${Date.now()}`,
          userId: star2UserId,
          orderId: testOrderId,
          productId: testProductId,
          quantity: 1,
          value: 399,
          type: 'WUTONG_BUY_TEN_GET_ONE',
          status: 'PENDING',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      testGiftId = gift.id;
    });

    it('管理员应该能够发货赠品', async () => {
      const shipData = {
        trackingNumber: 'SF1234567890',
        carrier: '顺丰快递',
        shippedAt: new Date().toISOString(),
        remark: '五通店赠品发货'
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/gifts/${testGiftId}/ship`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(shipData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('SHIPPED');
      expect(response.body.data.trackingNumber).toBe(shipData.trackingNumber);
    });

    it('应该验证快递信息', async () => {
      const shipData = {
        trackingNumber: '',
        carrier: ''
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/gifts/${testGiftId}/ship`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(shipData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('普通用户不能发货赠品', async () => {
      const response = await request(app)
        .post(`${API_BASE}/wutong/gifts/${testGiftId}/ship`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({
          trackingNumber: 'TEST123'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /wutong/statistics', () => {
    it('应该能够获取五通店权益统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/statistics`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalWutongShops');
      expect(response.body.data).toHaveProperty('totalGiftsGiven');
      expect(response.body.data).toHaveProperty('totalGiftValue');
      expect(response.body.data).toHaveProperty('monthlyStats');
    });

    it('应该包含月度统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/statistics`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          period: 'month',
          months: 6
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.monthlyStats) {
        expect(Array.isArray(response.body.data.monthlyStats)).toBe(true);
      }
    });
  });

  describe('GET /wutong/products', () => {
    it('应该能够获取参与权益的商品', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/products`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .query({
          page: 1,
          perPage: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('应该显示商品的权益信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/products`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .expect(200);

      if (response.body.data.items.length > 0) {
        const product = response.body.data.items[0];
        expect(product).toHaveProperty('wutongEligible');
        if (product.wutongEligible) {
          expect(product).toHaveProperty('giftRatio');
          expect(product).toHaveProperty('maxGiftQuantity');
        }
      }
    });
  });

  describe('POST /wutong/open', () => {
    it('二星店长应该能够开通五通店', async () => {
      const newStar2User = await createTestUser('star2');

      // 确保用户没有五通店
      await prisma.users.update({
        where: { id: newStar2User.id },
        data: { hasWutongShop: false }
      });

      const openData = {
        shopName: '新开的五通店',
        contactName: '店主姓名',
        contactPhone: '13800138001',
        address: '店铺地址',
        businessLicense: '营业执照图片URL',
        agreementAccepted: true
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/open`)
        .set('Authorization', `Bearer ${newStar2User.tokens.accessToken}`)
        .send(openData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shopType).toBe('WUTONG');
    });

    it('应该验证开通条件', async () => {
      const openData = {
        shopName: '',
        contactPhone: 'invalid'
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/open`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(openData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('必须同意协议', async () => {
      const anotherStar2User = await createTestUser('star2');

      // 确保用户没有五通店
      await prisma.users.update({
        where: { id: anotherStar2User.id },
        data: { hasWutongShop: false }
      });

      const openData = {
        shopName: '测试店铺',
        contactName: '测试联系人',
        contactPhone: '13800138000',
        address: '测试地址',
        agreementAccepted: false
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/open`)
        .set('Authorization', `Bearer ${anotherStar2User.tokens.accessToken}`)
        .send(openData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('协议');
    });
  });

  describe('GET /wutong/agreement', () => {
    it('应该能够获取五通店协议', async () => {
      const response = await request(app)
        .get(`${API_BASE}/wutong/agreement`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('title');
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data).toHaveProperty('version');
    });
  });

  describe('POST /wutong/close', () => {
    it('应该能够关闭五通店', async () => {
      // 创建一个测试五通店
      const closeStar2User = await createTestUser('star2');
      const shop = await prisma.shops.create({
        data: {
          id: `cmi${Date.now()}`,
          userId: closeStar2User.id,
          shopType: shops_shopType.WUTONG,
          shopName: '待关闭的五通店',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const closeData = {
        shopId: shop.id,
        reason: '业务调整',
        agreeToTerms: true
      };

      const response = await request(app)
        .post(`${API_BASE}/wutong/close`)
        .set('Authorization', `Bearer ${closeStar2User.tokens.accessToken}`)
        .send(closeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CLOSED');
    });

    it('应该验证关闭条件', async () => {
      const response = await request(app)
        .post(`${API_BASE}/wutong/close`)
        .set('Authorization', `Bearer ${star2UserToken}`)
        .send({
          shopId: wutongShopId,
          agreeToTerms: false
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});