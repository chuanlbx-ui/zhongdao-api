import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../setup';
import { setupTestDatabase, cleanupTestDatabase, getAuthHeadersForUser } from '../../setup';

describe('支付系统压力测试', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    adminToken = getAuthHeadersForUser('admin').Authorization;
    userToken = getAuthHeadersForUser('normal').Authorization;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('高并发支付创建测试', () => {
    it('should handle 1000 concurrent payment creations', async () => {
      const paymentCount = 1000;
      const payments = Array(paymentCount).fill(null).map((_, index) => ({
        orderId: `stress-order-${index}`,
        amount: 100 + (index % 1000), // 100-1099
        method: 'wechat',
        userId: `user-${index % 100}` // 100个不同用户
      }));

      const startTime = Date.now();

      // 并发创建支付
      const promises = payments.map(payment =>
        request(app)
          .post('/api/v1/payments')
          .set('Authorization', userToken)
          .send(payment)
          .expect(res => [200, 201, 429].includes(res.status)) // 允许成功或限流
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // 统计成功和失败的请求
      const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      console.log(`处理 ${paymentCount} 个支付请求耗时: ${duration}ms`);
      console.log(`成功: ${successCount}, 限流: ${rateLimitedCount}`);

      // 验证性能指标
      expect(duration).toBeLessThan(10000); // 10秒内完成
      expect(successCount).toBeGreaterThan(paymentCount * 0.8); // 至少80%成功率
      expect(rateLimitedCount).toBeLessThan(paymentCount * 0.2); // 限流不超过20%

      // 验证平均响应时间
      const avgResponseTime = duration / paymentCount;
      expect(avgResponseTime).toBeLessThan(100); // 平均响应时间小于100ms
    }, 30000);

    it('should maintain payment data integrity under high load', async () => {
      const batchId = `batch-${Date.now()}`;
      const paymentCount = 500;

      // 创建带批次ID的支付
      const payments = Array(paymentCount).fill(null).map((_, index) => ({
        orderId: `integrity-order-${index}`,
        amount: 100,
        method: 'alipay',
        metadata: {
          batchId,
          sequence: index
        }
      }));

      // 并发创建
      const promises = payments.map(payment =>
        request(app)
          .post('/api/v1/payments')
          .set('Authorization', userToken)
          .send(payment)
      );

      const responses = await Promise.all(promises);

      // 验证所有成功的支付都有正确的批次ID
      const successfulPayments = responses.filter(r => r.status === 201);

      for (const response of successfulPayments) {
        expect(response.body.data.metadata.batchId).toBe(batchId);
        expect(response.body.data.metadata.sequence).toBeDefined();
        expect(response.body.data.status).toBe('pending');
      }

      // 查询批次中的所有支付
      const batchQuery = await request(app)
        .get(`/api/v1/payments?batchId=${batchId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(batchQuery.body.data.payments.length).toBe(successfulPayments.length);
    });

    it('should handle payment amount overflow correctly', async () => {
      const maxAmount = Number.MAX_SAFE_INTEGER;

      // 测试极大金额
      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'overflow-test',
          amount: maxAmount,
          method: 'points'
        });

      // 应该拒绝或正确处理大金额
      expect([400, 422].includes(response.status)).toBe(true);

      if (response.status === 400) {
        expect(response.body.error).toContain('amount');
      }
    });

    it('should prevent duplicate payment creation', async () => {
      const duplicateOrder = {
        orderId: 'duplicate-order-123',
        amount: 100,
        method: 'wechat'
      };

      // 第一次创建应该成功
      const firstResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send(duplicateOrder)
        .expect(201);

      // 第二次创建应该失败
      const secondResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send(duplicateOrder)
        .expect(409);

      expect(secondResponse.body.error).toContain('already exists');
    });
  });

  describe('支付回调并发处理测试', () => {
    it('should handle 1000 concurrent payment callbacks', async () => {
      // 首先创建一批支付
      const paymentCount = 1000;
      const createdPayments = [];

      for (let i = 0; i < paymentCount; i++) {
        const response = await request(app)
          .post('/api/v1/payments')
          .set('Authorization', userToken)
          .send({
            orderId: `callback-order-${i}`,
            amount: 100,
            method: 'wechat'
          });

        if (response.status === 201) {
          createdPayments.push(response.body.data);
        }
      }

      // 并发发送支付成功回调
      const callbacks = createdPayments.map(payment =>
        request(app)
          .post(`/api/v1/payments/${payment.id}/callback`)
          .send({
            transactionId: `txn-${Date.now()}-${Math.random()}`,
            status: 'success',
            paidAt: new Date().toISOString(),
            signature: 'mock-signature'
          })
          .expect(res => [200, 202, 400].includes(res.status))
      );

      const startTime = Date.now();
      const responses = await Promise.all(callbacks);
      const duration = Date.now() - startTime;

      console.log(`处理 ${callbacks.length} 个回调耗时: ${duration}ms`);

      // 验证回调处理
      const successCallbacks = responses.filter(r => r.status === 200 || r.status === 202);
      const errorCallbacks = responses.filter(r => r.status === 400);

      expect(successCallbacks.length).toBeGreaterThan(callbacks.length * 0.9);
      expect(duration).toBeLessThan(15000);

      // 验证支付状态已更新
      const updatedPayments = await Promise.all(
        createdPayments.slice(0, 10).map(payment =>
          request(app)
            .get(`/api/v1/payments/${payment.id}`)
            .set('Authorization', adminToken)
        )
      );

      updatedPayments.forEach(response => {
        expect(response.body.data.status).toBe('completed');
      });
    }, 45000);

    it('should handle callback idempotency correctly', async () => {
      // 创建支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'idempotency-test',
          amount: 100,
          method: 'alipay'
        })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;
      const callbackData = {
        transactionId: 'txn-123',
        status: 'success',
        paidAt: new Date().toISOString()
      };

      // 发送第一次回调
      const firstCallback = await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send(callbackData)
        .expect(200);

      // 发送相同的回调（幂等测试）
      const secondCallback = await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send(callbackData)
        .expect(200);

      // 两次回调应该返回相同结果
      expect(firstCallback.body).toEqual(secondCallback.body);

      // 验证支付状态只更新一次
      const payment = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(payment.body.data.status).toBe('completed');
      expect(payment.body.data.callbackCount).toBe(1);
    });

    it('should process callbacks in correct order', async () => {
      // 创建支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'order-callback-sequence',
          amount: 100,
          method: 'wechat'
        })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;

      // 快速发送多个状态回调
      const callbacks = [
        { status: 'processing', transactionId: 'txn-1' },
        { status: 'success', transactionId: 'txn-2' },
        { status: 'success', transactionId: 'txn-2' } // 重复的成功回调
      ];

      const responses = await Promise.all(
        callbacks.map((callback, index) =>
          setTimeout(() => {
            return request(app)
              .post(`/api/v1/payments/${paymentId}/callback`)
              .send({
                ...callback,
                paidAt: new Date().toISOString()
              });
          }, index * 10)
        )
      );

      // 最终状态应该是成功
      const finalPayment = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(finalPayment.body.data.status).toBe('completed');
      expect(finalPayment.body.data.transactionId).toBe('txn-2');
    });
  });

  describe('退款流程压力测试', () => {
    it('should handle 500 concurrent refund requests', async () => {
      // 创建并完成一批支付
      const paymentCount = 500;
      const completedPayments = [];

      for (let i = 0; i < paymentCount; i++) {
        // 创建支付
        const paymentResponse = await request(app)
          .post('/api/v1/payments')
          .set('Authorization', userToken)
          .send({
            orderId: `refund-order-${i}`,
            amount: 100,
            method: 'alipay'
          })
          .expect(201);

        // 模拟支付完成
        await request(app)
          .post(`/api/v1/payments/${paymentResponse.body.data.id}/callback`)
          .send({
            transactionId: `txn-${i}`,
            status: 'success',
            paidAt: new Date().toISOString()
          })
          .expect(200);

        completedPayments.push(paymentResponse.body.data);
      }

      // 并发发起退款
      const refundPromises = completedPayments.map(payment =>
        request(app)
          .post('/api/v1/payments/refund')
          .set('Authorization', userToken)
          .send({
            paymentId: payment.id,
            amount: 100,
            reason: 'Pressure test refund'
          })
          .expect(res => [200, 201, 429].includes(res.status))
      );

      const startTime = Date.now();
      const responses = await Promise.all(refundPromises);
      const duration = Date.now() - startTime;

      console.log(`处理 ${responses.length} 个退款请求耗时: ${duration}ms`);

      // 验证退款处理
      const successRefunds = responses.filter(r => r.status === 200 || r.status === 201);
      const rateLimited = responses.filter(r => r.status === 429);

      expect(successRefunds.length).toBeGreaterThan(responses.length * 0.8);
      expect(rateLimited.length).toBeLessThan(responses.length * 0.2);
      expect(duration).toBeLessThan(20000);

      // 验证退款状态
      const refundChecks = await Promise.all(
        successRefunds.slice(0, 10).map(response =>
          request(app)
            .get(`/api/v1/payments/${response.body.data.paymentId}`)
            .set('Authorization', adminToken)
        )
      );

      refundChecks.forEach(response => {
        expect(['refunding', 'refunded'].includes(response.body.data.status)).toBe(true);
      });
    }, 60000);

    it('should handle partial refunds correctly', async () => {
      // 创建大额支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'partial-refund-order',
          amount: 1000,
          method: 'alipay'
        })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;

      // 完成支付
      await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send({
          transactionId: 'txn-1000',
          status: 'success',
          paidAt: new Date().toISOString()
        })
        .expect(200);

      // 多次部分退款
      const refunds = [
        { amount: 300, reason: 'First partial refund' },
        { amount: 400, reason: 'Second partial refund' }
      ];

      for (const refund of refunds) {
        const response = await request(app)
          .post('/api/v1/payments/refund')
          .set('Authorization', userToken)
          .send({
            paymentId,
            ...refund
          })
          .expect(200);

        expect(response.body.data.amount).toBe(refund.amount);
        expect(response.body.data.type).toBe('partial');
      }

      // 验证剩余可退款金额
      const payment = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(payment.body.data.refundedAmount).toBe(700);
      expect(payment.body.data.refundableAmount).toBe(300);
    });

    it('should prevent over-refunding', async () => {
      // 创建支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'over-refund-order',
          amount: 100,
          method: 'wechat'
        })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;

      // 完成支付
      await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send({
          transactionId: 'txn-100',
          status: 'success',
          paidAt: new Date().toISOString()
        })
        .expect(200);

      // 尝试超过原金额的退款
      await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', userToken)
        .send({
          paymentId,
          amount: 150, // 超过原金额
          reason: 'Over refund attempt'
        })
        .expect(400);

      // 尝试重复全额退款
      await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', userToken)
        .send({
          paymentId,
          amount: 100,
          reason: 'Full refund'
        })
        .expect(200);

      // 第二次全额退款应该失败
      await request(app)
        .post('/api/v1/payments/refund')
        .set('Authorization', userToken)
        .send({
          paymentId,
          amount: 100,
          reason: 'Duplicate full refund'
        })
        .expect(400);
    });
  });

  describe('支付安全验证测试', () => {
    it('should prevent payment tampering attacks', async () => {
      // 创建正常支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'tamper-test-order',
          amount: 100,
          method: 'wechat'
        })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;

      // 尝试通过API直接修改支付金额（应该失败）
      await request(app)
        .patch(`/api/v1/payments/${paymentId}`)
        .set('Authorization', adminToken)
        .send({
          amount: 1000
        })
        .expect(400);

      // 尝试修改支付状态（应该失败）
      await request(app)
        .patch(`/api/v1/payments/${paymentId}`)
        .set('Authorization', adminToken)
        .send({
          status: 'completed'
        })
        .expect(400);
    });

    it('should validate payment signatures', async () => {
      // 创建支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'signature-test-order',
          amount: 100,
          method: 'alipay'
        })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;

      // 发送无签名的回调（应该失败）
      await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send({
          transactionId: 'txn-invalid',
          status: 'success',
          paidAt: new Date().toISOString()
        })
        .expect(400);

      // 发送错误签名的回调（应该失败）
      await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send({
          transactionId: 'txn-bad-signature',
          status: 'success',
          paidAt: new Date().toISOString(),
          signature: 'invalid-signature'
        })
        .expect(400);
    });

    it('should handle payment timeout and cancellation', async () => {
      // 创建支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'timeout-test-order',
          amount: 100,
          method: 'wechat',
          expiresAt: new Date(Date.now() + 1000).toISOString() // 1秒后过期
        })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;

      // 等待支付过期
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 尝试完成过期支付（应该失败）
      await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send({
          transactionId: 'txn-late',
          status: 'success',
          paidAt: new Date().toISOString()
        })
        .expect(400);

      // 验证支付已过期
      const payment = await request(app)
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', adminToken)
        .expect(200);

      expect(payment.body.data.status).toBe('expired');
    });

    it('should prevent payment replay attacks', async () => {
      // 创建支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: 'replay-test-order',
          amount: 100,
          method: 'wechat'
        })
        .expect(201);

      const paymentId = paymentResponse.body.data.id;
      const callbackData = {
        transactionId: 'txn-replay-123',
        status: 'success',
        paidAt: new Date().toISOString(),
        timestamp: Date.now(),
        nonce: 'unique-nonce-123'
      };

      // 第一次回调（成功）
      await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send(callbackData)
        .expect(200);

      // 使用相同nonce的重放攻击（应该失败）
      await request(app)
        .post(`/api/v1/payments/${paymentId}/callback`)
        .send({
          ...callbackData,
          paidAt: new Date().toISOString() // 更新时间戳
        })
        .expect(400);
    });

    it('should rate limit payment attempts', async () => {
      const paymentAttempts = 50;
      const promises = [];

      // 快速连续创建支付
      for (let i = 0; i < paymentAttempts; i++) {
        promises.push(
          request(app)
            .post('/api/v1/payments')
            .set('Authorization', userToken)
            .send({
              orderId: `rate-limit-${i}`,
              amount: 10,
              method: 'points'
            })
        );
      }

      const responses = await Promise.all(promises);

      // 统计被限流的请求
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      const successCount = responses.filter(r => r.status === 201).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThan(paymentAttempts);

      // 验证限流响应头
      const rateLimitedResponse = responses.find(r => r.status === 429);
      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers).toHaveProperty('retry-after');
      }
    });
  });

  describe('支付系统性能监控', () => {
    it('should track payment processing metrics', async () => {
      // 获取初始指标
      const initialMetrics = await request(app)
        .get('/api/v1/admin/payments/metrics')
        .set('Authorization', adminToken)
        .expect(200);

      // 执行一些支付操作
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/v1/payments')
          .set('Authorization', userToken)
          .send({
            orderId: `metrics-order-${i}`,
            amount: 100,
            method: 'wechat'
          });
      }

      // 获取更新后的指标
      const updatedMetrics = await request(app)
        .get('/api/v1/admin/payments/metrics')
        .set('Authorization', adminToken)
        .expect(200);

      // 验证指标更新
      expect(updatedMetrics.body.data.totalPayments).toBeGreaterThan(
        initialMetrics.body.data.totalPayments
      );
      expect(updatedMetrics.body.data.pendingPayments).toBeGreaterThan(0);
    });

    it('should generate payment performance reports', async () => {
      const response = await request(app)
        .get('/api/v1/admin/payments/report')
        .set('Authorization', adminToken)
        .query({
          startDate: new Date(Date.now() - 3600000).toISOString(),
          endDate: new Date().toISOString(),
          includeDetails: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('report');
      expect(response.body.report).toHaveProperty('summary');
      expect(response.body.report).toHaveProperty('byMethod');
      expect(response.body.report).toHaveProperty('byStatus');
      expect(response.body.report).toHaveProperty('performance');

      // 验证性能指标
      const performance = response.body.report.performance;
      expect(performance).toHaveProperty('averageProcessingTime');
      expect(performance).toHaveProperty('successRate');
      expect(performance).toHaveProperty('errorRate');
    });
  });
});