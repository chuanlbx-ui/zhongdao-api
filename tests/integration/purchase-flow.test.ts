import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestDatabase, cleanupTestDatabase, getAuthHeadersForUser } from '../setup';
import { prisma } from '../../src/shared/database/client';
import { UserLevel } from '../../src/modules/user/level.service';
import { PaymentStatus } from '../../src/modules/payment/types';

describe('采购流程集成测试', () => {
  let buyerToken: string;
  let sellerToken: string;
  let adminToken: string;
  let testProduct: any;
  let testBuyer: any;
  let testSeller: any;

  beforeEach(async () => {
    await setupTestDatabase();

    // 创建测试用户
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone: '13800138001',
        password: 'password123',
        nickname: 'Test Buyer',
        inviteCode: 'TESTINVITE'
      });

    testBuyer = response.body.data.user;
    buyerToken = response.body.data.token;

    // 创建销售用户
    const sellerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone: '13800138002',
        password: 'password123',
        nickname: 'Test Seller',
        inviteCode: 'TESTINVITE'
      });

    testSeller = sellerResponse.body.data.user;
    sellerToken = sellerResponse.body.data.token;

    // 创建管理员
    const adminResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone: '13800138003',
        password: 'password123',
        nickname: 'Test Admin',
        role: 'ADMIN'
      });

    adminToken = adminResponse.body.data.token;

    // 设置用户等级
    await prisma.users.update({
      where: { id: testBuyer.id },
      data: { level: UserLevel.NORMAL }
    });

    await prisma.users.update({
      where: { id: testSeller.id },
      data: { level: UserLevel.STAR_1 }
    });

    // 建立团队关系
    await prisma.users.update({
      where: { id: testBuyer.id },
      data: { parentId: testSeller.id }
    });

    // 创建测试商品
    const productResponse = await request(app)
      .post('/api/v1/products')
      .set(getAuthHeadersForUser('admin'))
      .send({
        name: '测试商品',
        description: '测试商品描述',
        basePrice: 100,
        categoryId: 'cat-001',
        specs: [
          {
            name: '规格1',
            price: 100,
            stock: 100
          }
        ],
        tags: ['test']
      });

    testProduct = productResponse.body.data;
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('完整的采购流程', () => {
    it('应该成功完成端到端采购流程', async () => {
      // 1. 采购方查看商品列表
      const productsResponse = await request(app)
        .get('/api/v1/products')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      expect(productsResponse.body.data.records).toBeInstanceOf(Array);
      expect(productsResponse.body.data.records.length).toBeGreaterThan(0);

      // 2. 采购方创建订单
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          items: [
            {
              productId: testProduct.id,
              specId: testProduct.specs[0].id,
              quantity: 2
            }
          ],
          shippingAddress: {
            name: 'Test Address',
            phone: '13800138000',
            province: 'Beijing',
            city: 'Beijing',
            district: 'Chaoyang',
            detail: 'Test Detail'
          }
        })
        .expect(201);

      const order = orderResponse.body.data;
      expect(order.status).toBe('PENDING');
      expect(order.totalAmount).toBe(200);

      // 3. 采购方使用积分支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments/points')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          orderId: order.id,
          amount: 200,
          password: 'password123'
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);

      // 4. 验证订单状态已更新
      const updatedOrderResponse = await request(app)
        .get(`/api/v1/orders/${order.id}`)
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      const updatedOrder = updatedOrderResponse.body.data;
      expect(updatedOrder.paymentStatus).toBe(PaymentStatus.PAID);
      expect(updatedOrder.status).toBe('PAID');

      // 5. 验证销售方的积分增加
      const sellerPointsResponse = await request(app)
        .get('/api/v1/points/balance')
        .set({ Authorization: `Bearer ${sellerToken}` })
        .expect(200);

      expect(sellerPointsResponse.body.data.balance).toBeGreaterThan(0);

      // 6. 验证佣金记录已创建
      const commissionResponse = await request(app)
        .get('/api/v1/commission/list')
        .set({ Authorization: `Bearer ${sellerToken}` })
        .expect(200);

      expect(commissionResponse.body.data.records).toBeInstanceOf(Array);
      expect(commissionResponse.body.data.records.length).toBeGreaterThan(0);

      // 7. 验证库存已更新
      const productResponse = await request(app)
        .get(`/api/v1/products/${testProduct.id}`)
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      const updatedProduct = productResponse.body.data;
      expect(updatedProduct.specs[0].stock).toBe(98); // 100 - 2
    });

    it('应该拒绝无效的采购请求 - 等级不足', async () => {
      // 创建高级商品（需要VIP以上才能购买）
      const premiumProductResponse = await request(app)
        .post('/api/v1/products')
        .set(getAuthHeadersForUser('admin'))
        .send({
          name: '高级商品',
          description: '需要VIP等级',
          basePrice: 1000,
          categoryId: 'cat-001',
          minLevel: UserLevel.VIP,
          specs: [
            {
              name: '高级规格',
              price: 1000,
              stock: 50
            }
          ]
        })
        .expect(201);

      const premiumProduct = premiumProductResponse.body.data;

      // 尝试用普通用户购买
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          items: [
            {
              productId: premiumProduct.id,
              specId: premiumProduct.specs[0].id,
              quantity: 1
            }
          ],
          shippingAddress: {
            name: 'Test Address',
            phone: '13800138000',
            province: 'Beijing',
            city: 'Beijing',
            district: 'Chaoyang',
            detail: 'Test Detail'
          }
        })
        .expect(400);

      expect(orderResponse.body.message).toContain('用户等级不足');
    });

    it('应该拒绝无效的采购请求 - 库存不足', async () => {
      // 创建库存不足的商品
      const lowStockProductResponse = await request(app)
        .post('/api/v1/products')
        .set(getAuthHeadersForUser('admin'))
        .send({
          name: '低库存商品',
          description: '只有1个库存',
          basePrice: 100,
          categoryId: 'cat-001',
          specs: [
            {
              name: '低库存规格',
              price: 100,
              stock: 1
            }
          ]
        })
        .expect(201);

      const lowStockProduct = lowStockProductResponse.body.data;

      // 尝试购买超过库存的数量
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          items: [
            {
              productId: lowStockProduct.id,
              specId: lowStockProduct.specs[0].id,
              quantity: 5 // 超过库存
            }
          ],
          shippingAddress: {
            name: 'Test Address',
            phone: '13800138000',
            province: 'Beijing',
            city: 'Beijing',
            district: 'Chaoyang',
            detail: 'Test Detail'
          }
        })
        .expect(400);

      expect(orderResponse.body.message).toContain('库存不足');
    });

    it('应该处理退款流程', async () => {
      // 1. 创建并支付订单
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          items: [
            {
              productId: testProduct.id,
              specId: testProduct.specs[0].id,
              quantity: 1
            }
          ],
          shippingAddress: {
            name: 'Test Address',
            phone: '13800138000',
            province: 'Beijing',
            city: 'Beijing',
            district: 'Chaoyang',
            detail: 'Test Detail'
          }
        })
        .expect(201);

      const order = orderResponse.body.data;

      await request(app)
        .post('/api/v1/payments/points')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          orderId: order.id,
          amount: order.totalAmount,
          password: 'password123'
        })
        .expect(200);

      // 2. 申请退款
      const refundResponse = await request(app)
        .post('/api/v1/payments/refund')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          orderId: order.id,
          refundAmount: 50,
          refundReason: '用户申请退款'
        })
        .expect(200);

      expect(refundResponse.body.success).toBe(true);

      // 3. 管理员批准退款
      await request(app)
        .post(`/api/v1/admin/refunds/${refundResponse.body.data.refundId}/approve`)
        .set(getAuthHeadersForUser('admin'))
        .send({
          approved: true,
          comment: '同意退款'
        })
        .expect(200);

      // 4. 验证退款状态
      const refundStatusResponse = await request(app)
        .get(`/api/v1/payments/refunds/${refundResponse.body.data.refundId}`)
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      expect(refundStatusResponse.body.data.status).toBe('SUCCESS');
    });
  });

  describe('支付回调集成测试', () => {
    it('应该正确处理微信支付回调', async () => {
      // 1. 创建订单
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          items: [
            {
              productId: testProduct.id,
              specId: testProduct.specs[0].id,
              quantity: 1
            }
          ],
          shippingAddress: {
            name: 'Test Address',
            phone: '13800138000',
            province: 'Beijing',
            city: 'Beijing',
            district: 'Chaoyang',
            detail: 'Test Detail'
          }
        })
        .expect(201);

      const order = orderResponse.body.data;

      // 2. 创建微信支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments/wechat')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          orderId: order.id,
          amount: order.totalAmount
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);

      // 3. 模拟微信支付回调
      const callbackResponse = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .send({
          transaction_id: 'wx_test_transaction_001',
          out_trade_no: order.orderNo,
          result_code: 'SUCCESS',
          total_fee: (order.totalAmount * 100).toString(), // 微信支付使用分为单位
          sign: 'test_signature'
        })
        .expect(200);

      expect(callbackResponse.text).toContain('SUCCESS');

      // 4. 验证订单状态
      const updatedOrderResponse = await request(app)
        .get(`/api/v1/orders/${order.id}`)
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      const updatedOrder = updatedOrderResponse.body.data;
      expect(updatedOrder.paymentStatus).toBe(PaymentStatus.PAID);
    });

    it('应该处理重复的支付回调', async () => {
      // 1. 创建并支付订单
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          items: [
            {
              productId: testProduct.id,
              specId: testProduct.specs[0].id,
              quantity: 1
            }
          ],
          shippingAddress: {
            name: 'Test Address',
            phone: '13800138000',
            province: 'Beijing',
            city: 'Beijing',
            district: 'Chaoyang',
            detail: 'Test Detail'
          }
        })
        .expect(201);

      const order = orderResponse.body.data;

      await request(app)
        .post('/api/v1/payments/wechat')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .send({
          orderId: order.id,
          amount: order.totalAmount
        })
        .expect(200);

      // 2. 第一次回调
      const firstCallback = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .send({
          transaction_id: 'wx_test_transaction_002',
          out_trade_no: order.orderNo,
          result_code: 'SUCCESS',
          total_fee: (order.totalAmount * 100).toString(),
          sign: 'test_signature'
        })
        .expect(200);

      // 3. 第二次相同回调
      const secondCallback = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .send({
          transaction_id: 'wx_test_transaction_002',
          out_trade_no: order.orderNo,
          result_code: 'SUCCESS',
          total_fee: (order.totalAmount * 100).toString(),
          sign: 'test_signature'
        })
        .expect(200);

      expect(secondCallback.text).toContain('SUCCESS');

      // 验证订单只被处理了一次
      const paymentRecords = await prisma.paymentRecords.findMany({
        where: { orderId: order.id }
      });
      expect(paymentRecords).toHaveLength(1);
      expect(paymentRecords[0].status).toBe(PaymentStatus.PAID);
    });
  });

  describe('缓存一致性测试', () => {
    it('应该在商品价格更新后更新缓存', async () => {
      // 1. 获取商品价格
      const initialResponse = await request(app)
        .get(`/api/v1/products/${testProduct.id}`)
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      const initialPrice = initialResponse.body.data.basePrice;

      // 2. 更新商品价格
      const newPrice = initialPrice + 50;
      await request(app)
        .put(`/api/v1/products/${testProduct.id}`)
        .set(getAuthHeadersForUser('admin'))
        .send({
          name: testProduct.name,
          description: testProduct.description,
          basePrice: newPrice,
          categoryId: testProduct.categoryId,
          specs: testProduct.specs,
          tags: testProduct.tags
        })
        .expect(200);

      // 3. 再次获取商品价格
      const updatedResponse = await request(app)
        .get(`/api/v1/products/${testProduct.id}`)
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      // 验证价格已更新
      expect(updatedResponse.body.data.basePrice).toBe(newPrice);
      expect(updatedResponse.body.data.basePrice).not.toBe(initialPrice);
    });

    it('应该在用户等级更新后刷新相关缓存', async () => {
      // 1. 验证初始等级权益
      const initialBenefitsResponse = await request(app)
        .get('/api/v1/users/benefits')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      const initialBenefits = initialBenefitsResponse.body.data;
      expect(initialBenefits.level).toBe(UserLevel.NORMAL);

      // 2. 管理员提升用户等级
      await request(app)
        .put(`/api/v1/admin/users/${testBuyer.id}/level`)
        .set(getAuthHeadersForUser('admin'))
        .send({
          level: UserLevel.VIP
        })
        .expect(200);

      // 3. 重新获取用户权益
      const updatedBenefitsResponse = await request(app)
        .get('/api/v1/users/benefits')
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      const updatedBenefits = updatedBenefitsResponse.body.data;
      expect(updatedBenefits.level).toBe(UserLevel.VIP);
      expect(updatedBenefits.maxPurchaseQuantity).toBeGreaterThan(initialBenefits.maxPurchaseQuantity);
      expect(updatedBenefits.commissionRate).toBeGreaterThan(initialBenefits.commissionRate);
    });
  });

  describe('并发测试', () => {
    it('应该正确处理并发订单创建', async () => {
      // 创建足够的库存
      await request(app)
        .put(`/api/v1/products/${testProduct.id}/stock`)
        .set(getAuthHeadersForUser('admin'))
        .send({
          specId: testProduct.specs[0].id,
          stock: 100
        })
        .expect(200);

      // 创建多个并发订单请求
      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/v1/orders')
          .set({ Authorization: `Bearer ${buyerToken}` })
          .send({
            items: [
              {
                productId: testProduct.id,
                specId: testProduct.specs[0].id,
                quantity: 1
              }
            ],
            shippingAddress: {
              name: `Test Address ${i}`,
              phone: '13800138000',
              province: 'Beijing',
              city: 'Beijing',
              district: 'Chaoyang',
              detail: `Test Detail ${i}`
            }
          })
      );

      // 并发执行
      const responses = await Promise.allSettled(concurrentRequests);

      // 验证结果
      let successfulOrders = 0;
      let failedOrders = 0;

      responses.forEach((response) => {
        if (response.status === 'fulfilled' && response.value.status === 201) {
          successfulOrders++;
        } else {
          failedOrders++;
        }
      });

      expect(successfulOrders).toBeGreaterThan(0);
      expect(successfulOrders + failedOrders).toBe(10);

      // 验证库存正确扣减
      const finalProductResponse = await request(app)
        .get(`/api/v1/products/${testProduct.id}`)
        .set({ Authorization: `Bearer ${buyerToken}` })
        .expect(200);

      const finalStock = finalProductResponse.body.data.specs[0].stock;
      expect(finalStock).toBe(100 - successfulOrders);
    });
  });
});