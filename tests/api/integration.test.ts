/**
 * API集成测试
 * 测试完整的业务流程，包括用户注册、升级、开店、下单、佣金结算等
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { TestAuthHelper } from '../helpers/auth.helper';
import { PrismaClient, UserLevel, ShopType, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = '/api/v1';

describe('API集成测试', () => {
  let authHelper: TestAuthHelper;
  let testFlowData: {
    normalUser: any;
    vipUser: any;
    star1User: any;
    star2User: any;
    directorUser: any;
    testShop: any;
    testProduct: any;
    testOrder: any;
  };

  beforeAll(async () => {
    console.log('开始API集成测试...');
    authHelper = new TestAuthHelper();
    testFlowData = {
      normalUser: null,
      vipUser: null,
      star1User: null,
      star2User: null,
      directorUser: null,
      testShop: null,
      testProduct: null,
      testOrder: null
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('完整用户升级流程', () => {
    it('应该能够从普通用户升级到VIP', async () => {
      // 1. 创建普通用户
      testFlowData.normalUser = await authHelper.createTestUser('normal');

      // 2. 模拟消费达到VIP要求
      await prisma.orders.createMany({
        data: [
          {
            orderNo: 'VIP001',
            buyerId: testFlowData.normalUser.id,
            totalAmount: 1000,
            finalAmount: 1000,
            status: OrderStatus.DELIVERED,
            paymentStatus: 'PAID'
          },
          {
            orderNo: 'VIP002',
            buyerId: testFlowData.normalUser.id,
            totalAmount: 1500,
            finalAmount: 1500,
            status: OrderStatus.DELIVERED,
            paymentStatus: 'PAID'
          }
        ]
      });

      // 3. 申请升级VIP
      const response = await request(app)
        .post(`${API_BASE}/users/level-upgrade`)
        .set('Authorization', `Bearer ${testFlowData.normalUser.token}`)
        .send({
          targetLevel: 'VIP',
          upgradeReason: '累计消费达到要求'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING');

      // 4. 管理员批准升级
      const directorUser = await authHelper.createTestUser('director');
      await request(app)
        .post(`${API_BASE}/admin/users/${testFlowData.normalUser.id}/level-upgrade/approve`)
        .set('Authorization', `Bearer ${directorUser.token}`)
        .send({
          remark: '批准升级'
        })
        .expect(200);

      // 5. 验证用户等级
      const userResponse = await request(app)
        .get(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${testFlowData.normalUser.token}`)
        .expect(200);

      expect(userResponse.body.data.level).toBe('VIP');
    });

    it('应该能够从VIP升级到一星店长', async () => {
      // 1. 创建VIP用户
      testFlowData.vipUser = await authHelper.createTestUser('vip');

      // 2. 创建推荐关系
      await request(app)
        .post(`${API_BASE}/teams/invite`)
        .set('Authorization', `Bearer ${testFlowData.vipUser.token}`)
        .send({
          inviteePhone: '13800138000',
          inviteeName: '被推荐人'
        });

      // 3. 满足升级条件（推荐3人）
      for (let i = 0; i < 3; i++) {
        await authHelper.createTestUser('normal', testFlowData.vipUser.id);
      }

      // 4. 申请升级
      const response = await request(app)
        .post(`${API_BASE}/users/level-upgrade`)
        .set('Authorization', `Bearer ${testFlowData.vipUser.token}`)
        .send({
          targetLevel: 'STAR_1',
          upgradeReason: '推荐人数达标'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('完整开店流程', () => {
    it('VIP用户应该能够开设云店', async () => {
      // 1. VIP用户开店
      testFlowData.vipUser = await authHelper.createTestUser('vip');

      const shopData = {
        shopName: '我的云店',
        shopType: 'CLOUD',
        contactName: '店主',
        contactPhone: '13800138001',
        address: '店铺地址'
      };

      const response = await request(app)
        .post(`${API_BASE}/shops`)
        .set('Authorization', `Bearer ${testFlowData.vipUser.token}`)
        .send(shopData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shopType).toBe(ShopType.CLOUD);
      testFlowData.testShop = response.body.data;

      // 2. 添加商品到店铺
      const product = await prisma.products.create({
        data: {
          name: '测试商品',
          sku: 'TEST001',
          basePrice: 199,
          status: 'ACTIVE',
          categoryId: 'category_id'
        }
      });

      await request(app)
        .post(`${API_BASE}/shops/${testFlowData.testShop.id}/products`)
        .set('Authorization', `Bearer ${testFlowData.vipUser.token}`)
        .send({
          productId: product.id,
          price: 299,
          stock: 100
        })
        .expect(200);

      // 3. 验证店铺商品
      const shopProducts = await request(app)
        .get(`${API_BASE}/shops/${testFlowData.testShop.id}/products`)
        .set('Authorization', `Bearer ${testFlowData.vipUser.token}`)
        .expect(200);

      expect(shopProducts.body.data.items.length).toBeGreaterThan(0);
    });

    it('二星店长应该能够开通五通店', async () => {
      // 1. 创建二星店长
      testFlowData.star2User = await authHelper.createTestUser('star2');

      // 2. 开通五通店
      const response = await request(app)
        .post(`${API_BASE}/wutong/open`)
        .set('Authorization', `Bearer ${testFlowData.star2User.token}`)
        .send({
          shopName: '五通店测试',
          contactName: '五通店主',
          contactPhone: '13800138002',
          address: '五通店地址',
          agreementAccepted: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shopType).toBe(ShopType.WUTONG);
    });
  });

  describe('完整订单流程', () => {
    it('应该能够完成完整的购买流程', async () => {
      // 1. 创建商品
      testFlowData.testProduct = await prisma.products.create({
        data: {
          name: '集成测试商品',
          sku: 'INT_TEST_001',
          basePrice: 299,
          status: 'ACTIVE',
          categoryId: 'test_category_id',
          specifications: {
            brand: '测试品牌'
          }
        }
      });

      // 2. 创建库存
      await prisma.inventoryItems.create({
        data: {
          productId: testFlowData.testProduct.id,
          warehouseId: 'WH01',
          warehouseType: 'CLOUD',
          availableQuantity: 100,
          totalQuantity: 100,
          unitCost: 150
        }
      });

      // 3. 用户下单
      const buyer = await authHelper.createTestUser('normal');
      const orderData = {
        items: [
          {
            productId: testFlowData.testProduct.id,
            quantity: 5,
            unitPrice: testFlowData.testProduct.basePrice
          }
        ],
        deliveryAddress: {
          name: '收货人',
          phone: '13800138000',
          address: '收货地址',
          city: '城市',
          province: '省份'
        }
      };

      const orderResponse = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .send(orderData)
        .expect(201);

      expect(orderResponse.body.success).toBe(true);
      testFlowData.testOrder = orderResponse.body.data;

      // 4. 支付订单
      const paymentResponse = await request(app)
        .post(`${API_BASE}/payments/pay`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .send({
          orderId: testFlowData.testOrder.id,
          paymentMethod: 'POINTS',
          amount: testFlowData.testOrder.finalAmount
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);

      // 5. 验证订单状态
      const updatedOrder = await request(app)
        .get(`${API_BASE}/orders/${testFlowData.testOrder.id}`)
        .set('Authorization', `Bearer ${buyer.token}`)
        .expect(200);

      expect(updatedOrder.body.data.status).toBe(OrderStatus.PAID);
      expect(updatedOrder.body.data.paymentStatus).toBe('PAID');
    });
  });

  describe('完整佣金计算流程', () => {
    it('应该能够计算并结算多级佣金', async () => {
      // 1. 创建用户层级
      const director = await authHelper.createTestUser('director');
      const star5 = await authHelper.createTestUser('star5', director.id);
      const star3 = await authHelper.createTestUser('star3', star5.id);
      const star1 = await authHelper.createTestUser('star1', star3.id);
      const normal = await authHelper.createTestUser('normal', star1.id);

      // 2. 创建商品
      const product = await prisma.products.create({
        data: {
          name: '佣金测试商品',
          sku: 'COMM_TEST_001',
          basePrice: 1000,
          status: 'ACTIVE'
        }
      });

      // 3. 创建订单
      const order = await prisma.orders.create({
        data: {
          orderNo: 'COMM001',
          buyerId: normal.id,
          sellerId: star1.id,
          totalAmount: 1000,
          finalAmount: 1000,
          status: OrderStatus.DELIVERED,
          paymentStatus: 'PAID'
        }
      });

      await prisma.orderItems.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity: 1,
          unitPrice: 1000,
          totalPrice: 1000
        }
      });

      // 4. 计算佣金
      const commissionResponse = await request(app)
        .post(`${API_BASE}/commission/calculate`)
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          orderId: order.id,
          buyerId: normal.id,
          sellerId: star1.id,
          orderAmount: 1000,
          products: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: 1000,
              commissionRate: 0.1
            }
          ]
        })
        .expect(200);

      expect(commissionResponse.body.success).toBe(true);
      expect(commissionResponse.body.data.commissionDetails.length).toBeGreaterThan(0);

      // 5. 结算佣金
      const commissionIds = commissionResponse.body.data.commissionDetails.map(
        (d: any) => d.commissionId
      ).filter(Boolean);

      if (commissionIds.length > 0) {
        const settleResponse = await request(app)
          .post(`${API_BASE}/commission/settle`)
          .set('Authorization', `Bearer ${director.token}`)
          .send({
            commissionIds: commissionIds,
            remark: '测试结算'
          })
          .expect(200);

        expect(settleResponse.body.success).toBe(true);
      }
    });
  });

  describe('完整五通店权益流程', () => {
    it('应该能够完成买10赠1的完整流程', async () => {
      // 1. 开通五通店
      const star2User = await authHelper.createTestUser('star2');
      await request(app)
        .post(`${API_BASE}/wutong/open`)
        .set('Authorization', `Bearer ${star2User.token}`)
        .send({
          shopName: '权益测试店',
          contactName: '店主',
          contactPhone: '13800138003',
          agreementAccepted: true
        })
        .expect(200);

      // 2. 创建符合条件订单
      const product = await prisma.products.create({
        data: {
          name: '五通店专品',
          sku: 'WT_SPEC_001',
          basePrice: 300,
          status: 'ACTIVE'
        }
      });

      const order = await prisma.orders.create({
        data: {
          orderNo: 'WT_BENEFIT_001',
          buyerId: star2User.id,
          totalAmount: 3000,
          finalAmount: 3000,
          status: OrderStatus.DELIVERED,
          paymentStatus: 'PAID'
        }
      });

      await prisma.orderItems.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity: 10,
          unitPrice: 300,
          totalPrice: 3000
        }
      });

      // 3. 申请赠品
      const giftResponse = await request(app)
        .post(`${API_BASE}/wutong/claim-gift`)
        .set('Authorization', `Bearer ${star2User.token}`)
        .send({
          orderId: order.id,
          productId: product.id,
          purchasedQuantity: 10
        })
        .expect(200);

      expect(giftResponse.body.success).toBe(true);
      expect(giftResponse.body.data.giftQuantity).toBe(1);

      // 4. 管理员发货赠品
      const director = await authHelper.createTestUser('director');
      const shipResponse = await request(app)
        .post(`${API_BASE}/wutong/gifts/${giftResponse.body.data.giftRecord.id}/ship`)
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          trackingNumber: 'SF9876543210',
          carrier: '顺丰快递'
        })
        .expect(200);

      expect(shipResponse.body.success).toBe(true);
      expect(shipResponse.body.data.status).toBe('SHIPPED');
    });
  });

  describe('完整积分流转流程', () => {
    it('应该能够完成积分的完整流转', async () => {
      // 1. 创建用户
      const user = await authHelper.createTestUser('normal');

      // 2. 充值积分
      const rechargeResponse = await request(app)
        .post(`${API_BASE}/points/recharge`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          amount: 1000,
          paymentMethod: 'ALIPAY',
          transactionId: 'TXN' + Date.now()
        })
        .expect(200);

      expect(rechargeResponse.body.success).toBe(true);

      // 3. 验证余额
      const balanceResponse = await request(app)
        .get(`${API_BASE}/points/balance`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(balanceResponse.body.data.balance).toBe(1000);

      // 4. 转账积分
      const recipient = await authHelper.createTestUser('normal');
      const transferResponse = await request(app)
        .post(`${API_BASE}/points/transfer`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          toUserId: recipient.id,
          amount: 200,
          remark: '积分转账'
        })
        .expect(200);

      expect(transferResponse.body.success).toBe(true);

      // 5. 验证转账后余额
      const newBalanceResponse = await request(app)
        .get(`${API_BASE}/points/balance`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(newBalanceResponse.body.data.balance).toBe(800);

      // 6. 接收方验证余额
      const recipientBalanceResponse = await request(app)
        .get(`${API_BASE}/points/balance`)
        .set('Authorization', `Bearer ${recipient.token}`)
        .expect(200);

      expect(recipientBalanceResponse.body.data.balance).toBe(200);

      // 7. 提现积分
      const withdrawResponse = await request(app)
        .post(`${API_BASE}/points/withdraw`)
        .set('Authorization', `Bearer ${recipient.token}`)
        .send({
          amount: 100,
          withdrawMethod: 'BANK',
          accountInfo: {
            bankName: '测试银行',
            accountNumber: '6222021234567890',
            accountName: '测试用户'
          }
        })
        .expect(200);

      expect(withdrawResponse.body.success).toBe(true);
    });
  });

  describe('完整库存流转流程', () => {
    it('应该能够完成库存的完整流转', async () => {
      // 1. 创建商品和云仓库存
      const product = await prisma.products.create({
        data: {
          name: '库存测试商品',
          sku: 'INV_TEST_001',
          basePrice: 199,
          status: 'ACTIVE'
        }
      });

      const cloudInventory = await prisma.inventoryItems.create({
        data: {
          productId: product.id,
          warehouseId: 'WH_CLOUD_01',
          warehouseType: 'CLOUD',
          availableQuantity: 100,
          totalQuantity: 100,
          unitCost: 100
        }
      });

      // 2. 调拨到本地仓
      const localInventory = await prisma.inventoryItems.create({
        data: {
          productId: product.id,
          warehouseId: 'WH_LOCAL_01',
          warehouseType: 'LOCAL',
          availableQuantity: 0,
          totalQuantity: 0,
          unitCost: 100
        }
      });

      const director = await authHelper.createTestUser('director');
      const transferResponse = await request(app)
        .post(`${API_BASE}/inventory/transfer`)
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          fromInventoryId: cloudInventory.id,
          toInventoryId: localInventory.id,
          quantity: 50,
          reason: '调拨到本地仓'
        })
        .expect(200);

      expect(transferResponse.body.success).toBe(true);

      // 3. 验证库存变化
      const updatedCloudInventory = await prisma.inventoryItems.findUnique({
        where: { id: cloudInventory.id }
      });
      expect(updatedCloudInventory?.availableQuantity).toBe(50);

      const updatedLocalInventory = await prisma.inventoryItems.findUnique({
        where: { id: localInventory.id }
      });
      expect(updatedLocalInventory?.availableQuantity).toBe(50);

      // 4. 创建订单并预留库存
      const buyer = await authHelper.createTestUser('normal');
      const order = await prisma.orders.create({
        data: {
          orderNo: 'INV_ORDER_001',
          buyerId: buyer.id,
          totalAmount: 1990,
          finalAmount: 1990
        }
      });

      const reserveResponse = await request(app)
        .post(`${API_BASE}/inventory/reserve`)
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          inventoryId: localInventory.id,
          quantity: 10,
          orderId: order.id
        })
        .expect(200);

      expect(reserveResponse.body.success).toBe(true);

      // 5. 确认订单并扣减库存
      await prisma.orders.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID }
      });

      const releaseResponse = await request(app)
        .post(`${API_BASE}/inventory/release`)
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          inventoryId: localInventory.id,
          quantity: 10,
          orderId: order.id,
          deduct: true
        })
        .expect(200);

      expect(releaseResponse.body.success).toBe(true);
    });
  });
});