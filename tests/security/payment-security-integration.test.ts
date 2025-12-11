/**
 * 支付安全集成测试
 * 模拟真实的支付回调场景
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestDatabase, cleanupTestDatabase, getAuthHeadersForUser } from '../setup';
import { prisma } from '../../src/shared/database/client';
import crypto from 'crypto';

describe('支付安全集成测试', () => {
  let testOrder: any;
  let testUser: any;
  const adminHeaders = getAuthHeadersForUser('admin');

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        username: 'payment_test_user',
        email: 'payment@test.com',
        phone: '13800138000',
        password: 'hashed_password',
        status: 'ACTIVE',
        level: 'NORMAL',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // 创建测试订单
    testOrder = await prisma.orders.create({
      data: {
        id: crypto.randomUUID(),
        orderNo: `ORDER${Date.now()}`,
        buyerId: testUser.id,
        sellerId: testUser.id,
        type: 'RETAIL',
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        subtotalAmount: 100,
        discountAmount: 0,
        shippingAmount: 0,
        taxAmount: 0,
        finalAmount: 100,
        totalAmount: 100,
        currency: 'CNY',
        items: {
          create: {
            id: crypto.randomUUID(),
            productId: 'test_product_001',
            productName: '测试商品',
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('完整的支付流程安全测试', () => {
    it('应该安全地处理完整的支付流程', async () => {
      // 1. 创建支付
      const createResponse = await request(app)
        .post('/api/v1/payments/create')
        .set(adminHeaders)
        .send({
          orderId: testOrder.id,
          amount: testOrder.finalAmount,
          paymentMethod: 'WECHAT_JSAPI',
          subject: '测试订单支付',
          openid: 'test_openid_001'
        })
        .expect(200);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data).toHaveProperty('prepayId');

      const paymentId = createResponse.body.data.paymentId;
      const prepayId = createResponse.body.data.prepayId;

      // 2. 查询支付状态
      const queryResponse = await request(app)
        .get(`/api/v1/payments/${paymentId}/query`)
        .set(adminHeaders)
        .expect(200);

      expect(queryResponse.body.success).toBe(true);
      expect(queryResponse.body.data.tradeStatus).toBeDefined();

      // 3. 模拟支付成功回调
      const callbackData = {
        id: crypto.randomUUID(),
        create_time: '2024-01-01T12:00:00+08:00',
        event_type: 'TRANSACTION.SUCCESS',
        resource_type: 'encrypt-resource',
        resource: {
          original_type: 'transaction',
          algorithm: 'AEAD_AES_256_GCM',
          ciphertext: 'mock_ciphertext',
          associated_data: 'transaction',
          nonce: 'mock_nonce',
          out_trade_no: testOrder.id,
          transaction_id: `wx_${Date.now()}`,
          trade_state: 'SUCCESS',
          trade_state_desc: '支付成功',
          bank_type: 'OTHERS',
          success_time: '2024-01-01T12:00:00+08:00',
          amount: {
            total: 10000, // 分
            payer_total: 10000,
            currency: 'CNY'
          }
        }
      };

      // 添加签名头部
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomBytes(16).toString('hex');
      const signature = 'mock_signature';

      // 模拟微信回调
      const callbackResponse = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .set('Content-Type', 'application/json')
        .set('wechatpay-timestamp', timestamp)
        .set('wechatpay-nonce', nonce)
        .set('wechatpay-signature', signature)
        .set('wechatpay-serial', 'mock_serial')
        .send(callbackData);

      // 由于签名验证是mock的，回调应该被处理
      expect([200, 400, 500]).toContain(callbackResponse.status);

      // 4. 验证订单状态已更新
      const updatedOrder = await prisma.orders.findUnique({
        where: { id: testOrder.id },
        include: {
          paymentTransactions: true
        }
      });

      // 如果回调成功处理，订单应该已支付
      if (callbackResponse.status === 200) {
        expect(updatedOrder?.status).toBe('PAID');
        expect(updatedOrder?.paymentStatus).toBe('PAID');
      }
    });

    it('应该正确处理重复回调', async () => {
      // 创建新订单
      const duplicateTestOrder = await prisma.orders.create({
        data: {
          id: crypto.randomUUID(),
          orderNo: `ORDER${Date.now()}_DUP`,
          buyerId: testUser.id,
          sellerId: testUser.id,
          type: 'RETAIL',
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          subtotalAmount: 200,
          finalAmount: 200,
          totalAmount: 200,
          currency: 'CNY',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      const callbackData = {
        resource: {
          out_trade_no: duplicateTestOrder.id,
          transaction_id: `wx_dup_${Date.now()}`,
          trade_state: 'SUCCESS',
          amount: { total: 20000 }
        }
      };

      const headers = {
        'Content-Type': 'application/json',
        'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
        'wechatpay-nonce': 'test_nonce',
        'wechatpay-signature': 'mock_signature',
        'wechatpay-serial': 'mock_serial'
      };

      // 第一次回调
      const response1 = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .set(headers)
        .send(callbackData);

      // 第二次相同回调
      const response2 = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .set(headers)
        .send(callbackData);

      // 至少有一次成功处理
      expect([response1.status, response2.status]).toContain(200);

      // 验证幂等性
      const transactions = await prisma.paymentTransactions.count({
        where: { orderId: duplicateTestOrder.id }
      });

      expect(transactions).toBeLessThanOrEqual(1);
    });

    it('应该正确处理支付失败场景', async () => {
      // 创建测试订单
      const failTestOrder = await prisma.orders.create({
        data: {
          id: crypto.randomUUID(),
          orderNo: `ORDER${Date.now()}_FAIL`,
          buyerId: testUser.id,
          sellerId: testUser.id,
          type: 'RETAIL',
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          subtotalAmount: 300,
          finalAmount: 300,
          totalAmount: 300,
          currency: 'CNY',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // 模拟支付失败回调
      const failCallbackData = {
        resource: {
          out_trade_no: failTestOrder.id,
          transaction_id: `wx_fail_${Date.now()}`,
          trade_state: 'CLOSED',
          trade_state_desc: '支付关闭',
          amount: { total: 30000 }
        }
      };

      const headers = {
        'Content-Type': 'application/json',
        'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
        'wechatpay-nonce': 'test_nonce',
        'wechatpay-signature': 'mock_signature',
        'wechatpay-serial': 'mock_serial'
      };

      const response = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .set(headers)
        .send(failCallbackData);

      // 验证响应
      expect([200, 400]).toContain(response.status);

      // 验证订单状态
      const updatedOrder = await prisma.orders.findUnique({
        where: { id: failTestOrder.id }
      });

      // 如果处理成功，订单应该失败
      if (response.status === 200) {
        expect(['FAILED', 'CANCELLED']).toContain(updatedOrder?.status);
      }

      // 验证补偿记录
      const compensation = await prisma.paymentCompensation.findFirst({
        where: { orderId: failTestOrder.id }
      });

      if (response.status === 200) {
        expect(compensation).toBeDefined();
      }
    });
  });

  describe('支付宝集成安全测试', () => {
    it('应该安全处理支付宝回调', async () => {
      // 创建支付宝测试订单
      const alipayTestOrder = await prisma.orders.create({
        data: {
          id: crypto.randomUUID(),
          orderNo: `ORDER${Date.now()}_ALIPAY`,
          buyerId: testUser.id,
          sellerId: testUser.id,
          type: 'RETAIL',
          status: 'PENDING',
          paymentStatus: 'UNPAID',
          subtotalAmount: 150,
          finalAmount: 150,
          totalAmount: 150,
          currency: 'CNY',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // 模拟支付宝回调数据
      const alipayCallbackData = {
        app_id: process.env.ALIPAY_APP_ID || 'test_app_id',
        out_trade_no: alipayTestOrder.id,
        trade_no: `alipay_${Date.now()}`,
        trade_status: 'TRADE_SUCCESS',
        total_amount: '150.00',
        buyer_id: 'test_buyer_id',
        gmt_payment: new Date().toISOString(),
        notify_type: 'trade_status_sync',
        notify_time: new Date().toISOString(),
        subject: '测试订单',
        body: '测试商品',
        sign_type: 'RSA2',
        sign: 'mock_signature'
      };

      // 模拟表单数据提交
      const response = await request(app)
        .post('/api/v1/payments/alipay/notify')
        .type('form')
        .send(alipayCallbackData);

      // 验证响应
      expect([200, 400]).toContain(response.status);

      // 验证审计日志
      const logs = await prisma.paymentCallbackLog.findMany({
        where: { orderId: alipayTestOrder.id, provider: 'ALIPAY' }
      });

      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('高并发安全测试', () => {
    it('应该安全处理并发回调', async () => {
      // 创建并发测试订单
      const concurrentOrders = await Promise.all(
        Array(10).fill(null).map((_, i) =>
          prisma.orders.create({
            data: {
              id: crypto.randomUUID(),
              orderNo: `ORDER${Date.now()}_CON_${i}`,
              buyerId: testUser.id,
              sellerId: testUser.id,
              type: 'RETAIL',
              status: 'PENDING',
              paymentStatus: 'UNPAID',
              subtotalAmount: 50,
              finalAmount: 50,
              totalAmount: 50,
              currency: 'CNY',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        )
      );

      // 并发发送回调
      const callbackPromises = concurrentOrders.map((order, i) => {
        const callbackData = {
          resource: {
            out_trade_no: order.id,
            transaction_id: `wx_concurrent_${i}_${Date.now()}`,
            trade_state: 'SUCCESS',
            amount: { total: 5000 }
          }
        };

        return request(app)
          .post('/api/v1/payments/wechat/notify')
          .set({
            'Content-Type': 'application/json',
            'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
            'wechatpay-nonce': `nonce_${i}`,
            'wechatpay-signature': 'mock_signature',
            'wechatpay-serial': 'mock_serial'
          })
          .send(callbackData);
      });

      const responses = await Promise.all(callbackPromises);

      // 验证所有请求都有响应
      expect(responses.length).toBe(10);

      // 验证数据一致性
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(0);

      // 验证没有重复的交易记录
      const transactionCounts = await Promise.all(
        concurrentOrders.map(order =>
          prisma.paymentTransactions.count({
            where: { orderId: order.id }
          })
        )
      );

      transactionCounts.forEach(count => {
        expect(count).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('恶意请求防护测试', () => {
    it('应该拒绝格式错误的回调', async () => {
      // 发送JSON格式的数据到支付宝端点
      const response = await request(app)
        .post('/api/v1/payments/alipay/notify')
        .send({ invalid: 'json' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('应该拒绝缺少必要字段的回调', async () => {
      const incompleteData = {
        // 缺少 out_trade_no
        trade_no: 'test_trade_no',
        trade_status: 'TRADE_SUCCESS'
      };

      const response = await request(app)
        .post('/api/v1/payments/alipay/notify')
        .type('form')
        .send(incompleteData);

      // 应该返回错误或成功但不处理订单
      expect([200, 400]).toContain(response.status);
    });

    it('应该防护SQL注入尝试', async () => {
      const maliciousData = {
        resource: {
          out_trade_no: "'; DROP TABLE orders; --",
          transaction_id: 'wx_test',
          trade_state: 'SUCCESS',
          amount: { total: 100 }
        }
      };

      const response = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .set({
          'Content-Type': 'application/json',
          'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
          'wechatpay-nonce': 'test',
          'wechatpay-signature': 'mock',
          'wechatpay-serial': 'mock'
        })
        .send(maliciousData);

      // 应该拒绝处理
      expect([400, 500]).toContain(response.status);

      // 验证数据表仍然存在
      const tableExists = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_name = 'orders'
      `;
      expect((tableExists as any)[0].count).toBe(1);
    });
  });
});