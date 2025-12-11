/**
 * 完整的支付流程测试
 * 集成真实的支付接口（微信支付、支付宝）
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app, setupTestDatabase, cleanupTestDatabase, createTestAgent, assert } from '../setup';
import { TestDataFactory } from '../factories/test-data.factory';
import { DatabaseIsolation } from '../isolation/database-isolation';

describe('完整支付流程测试', () => {
  let isolation: DatabaseIsolation;
  let agent: any;
  let testDataFactory: TestDataFactory;
  let testDataSet: any;

  beforeAll(async () => {
    await setupTestDatabase();
    const prisma = (app as any).prisma || global.prisma;
    isolation = new DatabaseIsolation(prisma);
    agent = createTestAgent(app);
    testDataFactory = TestDataFactory.getInstance(prisma);

    // 创建测试数据集
    testDataSet = await testDataFactory.createCompleteTestDataSet();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await isolation.cleanupAllContexts();
  });

  beforeEach(async () => {
    const contextId = await isolation.startIsolation('payment-test');
    (global as any).currentTestContextId = contextId;
  });

  afterEach(async () => {
    const contextId = (global as any).currentTestContextId;
    if (contextId) {
      await isolation.endIsolation(contextId);
    }
  });

  describe('1. 支付方式查询', () => {
    it('应该返回所有可用的支付方式', async () => {
      const response = await agent
        .get('/api/v1/payments/methods')
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(Array.isArray(response.body.data.methods)).toBe(true);
      expect(response.body.data.methods).toContain('WECHAT');
      expect(response.body.data.methods).toContain('ALIPAY');
    });

    it('应该返回各支付方式的配置信息', async () => {
      const response = await agent
        .get('/api/v1/payments/config')
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('wechat');
      expect(response.body.data).toHaveProperty('alipay');
    });
  });

  describe('2. 创建支付订单', () => {
    it('应该能够创建微信支付订单', async () => {
      const orderData = {
        orderId: testDataSet.orders[0].id,
        amount: 100,
        paymentMethod: 'WECHAT',
        description: '测试微信支付',
        openid: 'test_openid_123456'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.apiResponse(response, 201);
      expect(response.body.data).toHaveProperty('paymentId');
      expect(response.body.data).toHaveProperty('prepayId');
      expect(response.body.data).toHaveProperty('paySign');
    });

    it('应该能够创建支付宝支付订单', async () => {
      const orderData = {
        orderId: testDataSet.orders[1].id,
        amount: 200,
        paymentMethod: 'ALIPAY',
        description: '测试支付宝支付',
        returnUrl: 'https://example.com/return',
        notifyUrl: 'https://example.com/notify'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.apiResponse(response, 201);
      expect(response.body.data).toHaveProperty('paymentId');
      expect(response.body.data).toHaveProperty('orderString');
    });

    it('应该拒绝无效的支付方式', async () => {
      const orderData = {
        orderId: testDataSet.orders[0].id,
        amount: 100,
        paymentMethod: 'INVALID_METHOD',
        description: '测试无效支付方式'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.errorResponse(response, 400, 'INVALID_PAYMENT_METHOD');
    });

    it('应该验证订单金额', async () => {
      const orderData = {
        orderId: testDataSet.orders[0].id,
        amount: -100, // 负金额
        paymentMethod: 'WECHAT',
        description: '测试负金额'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.errorResponse(response, 400);
    });

    it('应该验证订单归属', async () => {
      // 尝试用其他用户的订单创建支付
      const orderData = {
        orderId: testDataSet.orders[0].id,
        amount: 100,
        paymentMethod: 'WECHAT',
        description: '测试订单归属验证'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('vip'); // 使用不同用户

      assert.errorResponse(response, 403, 'FORBIDDEN');
    });
  });

  describe('3. 查询支付状态', () => {
    let paymentId: string;

    beforeEach(async () => {
      // 创建一个支付订单用于测试
      const orderData = {
        orderId: testDataSet.orders[2].id,
        amount: 300,
        paymentMethod: 'WECHAT',
        description: '支付状态测试'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      paymentId = response.body.data.paymentId;
    });

    it('应该能够查询支付状态', async () => {
      const response = await agent
        .get(`/api/v1/payments/${paymentId}/status`)
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('paymentId', paymentId);
      expect(response.body.data).toHaveProperty('status');
      expect(['PENDING', 'PAID', 'CANCELLED', 'FAILED']).toContain(response.body.data.status);
    });

    it('应该拒绝查询不存在的支付订单', async () => {
      const response = await agent
        .get('/api/v1/payments/nonexistent_payment/status')
        .asUser('normal');

      assert.errorResponse(response, 404, 'PAYMENT_NOT_FOUND');
    });

    it('应该验证支付订单归属', async () => {
      const response = await agent
        .get(`/api/v1/payments/${paymentId}/status`)
        .asUser('vip'); // 使用不同用户

      assert.errorResponse(response, 403, 'FORBIDDEN');
    });
  });

  describe('4. 支付回调处理', () => {
    it('应该正确处理微信支付回调', async () => {
      // 先创建支付订单
      const orderData = {
        orderId: testDataSet.orders[3].id,
        amount: 400,
        paymentMethod: 'WECHAT',
        description: '微信回调测试'
      };

      const createResponse = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      const paymentId = createResponse.body.data.paymentId;
      const prepayId = createResponse.body.data.prepayId;

      // 模拟微信支付回调数据
      const callbackData = {
        transaction_id: `wx_transaction_${Date.now()}`,
        out_trade_no: paymentId,
        result_code: 'SUCCESS',
        total_fee: 40000, // 分
        time_end: new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14),
        openid: 'test_openid_123456'
      };

      const response = await agent
        .post('/api/v1/payments/wechat/callback')
        .send(callbackData);

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('status', 'SUCCESS');

      // 验证支付状态已更新
      const statusResponse = await agent
        .get(`/api/v1/payments/${paymentId}/status`)
        .asUser('normal');

      expect(statusResponse.body.data.status).toBe('PAID');
    });

    it('应该正确处理支付宝回调', async () => {
      // 先创建支付订单
      const orderData = {
        orderId: testDataSet.orders[4].id,
        amount: 500,
        paymentMethod: 'ALIPAY',
        description: '支付宝回调测试'
      };

      const createResponse = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      const paymentId = createResponse.body.data.paymentId;

      // 模拟支付宝回调数据
      const callbackData = {
        trade_no: `alipay_trade_${Date.now()}`,
        out_trade_no: paymentId,
        trade_status: 'TRADE_SUCCESS',
        total_amount: '500.00',
        gmt_payment: new Date().toISOString()
      };

      const response = await agent
        .post('/api/v1/payments/alipay/callback')
        .send(callbackData);

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('status', 'SUCCESS');
    });

    it('应该拒绝重复的支付回调', async () => {
      // 创建支付订单并处理第一次回调
      const orderData = {
        orderId: testDataSet.orders[5].id,
        amount: 600,
        paymentMethod: 'WECHAT',
        description: '重复回调测试'
      };

      const createResponse = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      const paymentId = createResponse.body.data.paymentId;
      const callbackData = {
        transaction_id: `wx_repeat_${Date.now()}`,
        out_trade_no: paymentId,
        result_code: 'SUCCESS',
        total_fee: 60000
      };

      // 第一次回调
      await agent
        .post('/api/v1/payments/wechat/callback')
        .send(callbackData);

      // 第二次相同回调
      const response = await agent
        .post('/api/v1/payments/wechat/callback')
        .send(callbackData);

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('status', 'SUCCESS');
      expect(response.body.data.message).toContain('重复');
    });

    it('应该验证回调签名', async () => {
      const callbackData = {
        trade_no: 'fake_trade_no',
        out_trade_no: 'fake_payment_id',
        trade_status: 'TRADE_SUCCESS'
        // 没有签名
      };

      const response = await agent
        .post('/api/v1/payments/alipay/callback')
        .send(callbackData);

      assert.errorResponse(response, 400, 'INVALID_SIGNATURE');
    });
  });

  describe('5. 取消支付', () => {
    let paymentId: string;

    beforeEach(async () => {
      const orderData = {
        orderId: testDataSet.orders[6].id,
        amount: 700,
        paymentMethod: 'WECHAT',
        description: '取消支付测试'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      paymentId = response.body.data.paymentId;
    });

    it('应该能够取消未支付的订单', async () => {
      const response = await agent
        .post(`/api/v1/payments/${paymentId}/cancel`)
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('应该拒绝取消已支付的订单', async () => {
      // 先模拟支付成功
      const callbackData = {
        transaction_id: `wx_cancel_test_${Date.now()}`,
        out_trade_no: paymentId,
        result_code: 'SUCCESS',
        total_fee: 70000
      };

      await agent
        .post('/api/v1/payments/wechat/callback')
        .send(callbackData);

      // 尝试取消
      const response = await agent
        .post(`/api/v1/payments/${paymentId}/cancel`)
        .asUser('normal');

      assert.errorResponse(response, 400, 'ALREADY_PAID');
    });

    it('应该验证取消权限', async () => {
      const response = await agent
        .post(`/api/v1/payments/${paymentId}/cancel`)
        .asUser('vip'); // 不同用户

      assert.errorResponse(response, 403, 'FORBIDDEN');
    });
  });

  describe('6. 退款流程', () => {
    let paymentId: string;

    beforeEach(async () => {
      // 创建并完成支付
      const orderData = {
        orderId: testDataSet.orders[7].id,
        amount: 800,
        paymentMethod: 'WECHAT',
        description: '退款测试'
      };

      const createResponse = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      paymentId = createResponse.body.data.paymentId;

      // 模拟支付成功
      const callbackData = {
        transaction_id: `wx_refund_${Date.now()}`,
        out_trade_no: paymentId,
        result_code: 'SUCCESS',
        total_fee: 80000
      };

      await agent
        .post('/api/v1/payments/wechat/callback')
        .send(callbackData);
    });

    it('应该能够申请退款', async () => {
      const refundData = {
        amount: 400, // 部分退款
        reason: '测试退款'
      };

      const response = await agent
        .post(`/api/v1/payments/${paymentId}/refund`)
        .send(refundData)
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('refundId');
      expect(response.body.data).toHaveProperty('status', 'PROCESSING');
    });

    it('应该验证退款金额', async () => {
      const refundData = {
        amount: 1000, // 超过支付金额
        reason: '测试超额退款'
      };

      const response = await agent
        .post(`/api/v1/payments/${paymentId}/refund`)
        .send(refundData)
        .asUser('normal');

      assert.errorResponse(response, 400, 'INVALID_REFUND_AMOUNT');
    });

    it('应该查询退款状态', async () => {
      // 先申请退款
      const refundData = {
        amount: 200,
        reason: '查询状态测试'
      };

      const refundResponse = await agent
        .post(`/api/v1/payments/${paymentId}/refund`)
        .send(refundData)
        .asUser('normal');

      const refundId = refundResponse.body.data.refundId;

      // 查询退款状态
      const response = await agent
        .get(`/api/v1/payments/refunds/${refundId}`)
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('refundId', refundId);
      expect(response.body.data).toHaveProperty('status');
    });
  });

  describe('7. 积分支付', () => {
    it('应该能够使用积分支付', async () => {
      const orderData = {
        orderId: testDataSet.orders[8].id,
        paymentMethod: 'POINTS',
        usePoints: 5000,
        description: '积分支付测试'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.apiResponse(response, 201);
      expect(response.body.data.status).toBe('PAID'); // 积分支付直接成功
      expect(response.body.data).toHaveProperty('pointsUsed', 5000);
    });

    it('应该验证积分余额', async () => {
      const orderData = {
        orderId: testDataSet.orders[9].id,
        paymentMethod: 'POINTS',
        usePoints: 999999, // 超过余额
        description: '积分不足测试'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.errorResponse(response, 400, 'INSUFFICIENT_POINTS');
    });

    it('应该记录积分交易', async () => {
      const orderData = {
        orderId: testDataSet.orders[10].id,
        paymentMethod: 'POINTS',
        usePoints: 3000,
        description: '积分交易记录'
      };

      await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      // 查询积分交易记录
      const response = await agent
        .get('/api/v1/points/transactions')
        .query({ type: 'PURCHASE' })
        .asUser('normal');

      assert.apiResponse(response, 200);
      const transactions = response.body.data.transactions;
      const lastTransaction = transactions[transactions.length - 1];
      expect(lastTransaction.amount).toBe(-3000);
      expect(lastTransaction.type).toBe('PURCHASE');
    });
  });

  describe('8. 支付统计', () => {
    it('应该返回支付统计信息', async () => {
      const response = await agent
        .get('/api/v1/payments/stats')
        .query({ period: '7d' })
        .asAdmin();

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('totalAmount');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('successRate');
      expect(response.body.data).toHaveProperty('methodStats');
    });

    it('应该按时间范围筛选统计', async () => {
      const response = await agent
        .get('/api/v1/payments/stats')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .asAdmin();

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('period');
    });
  });

  describe('9. 支付安全', () => {
    it('应该防止重复支付', async () => {
      const orderData = {
        orderId: testDataSet.orders[11].id,
        amount: 900,
        paymentMethod: 'WECHAT',
        description: '重复支付测试'
      };

      // 创建第一次支付
      await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      // 尝试创建第二次相同订单的支付
      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.errorResponse(response, 400, 'PAYMENT_EXISTS');
    });

    it('应该验证支付金额限制', async () => {
      const orderData = {
        orderId: testDataSet.orders[12].id,
        amount: 999999999, // 超大金额
        paymentMethod: 'WECHAT',
        description: '金额限制测试'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.errorResponse(response, 400, 'AMOUNT_EXCEEDS_LIMIT');
    });

    it('应该记录支付审计日志', async () => {
      const orderData = {
        orderId: testDataSet.orders[13].id,
        amount: 1000,
        paymentMethod: 'WECHAT',
        description: '审计日志测试'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      assert.apiResponse(response, 201);

      // 查询审计日志
      const auditResponse = await agent
        .get('/api/v1/admin/audit-logs')
        .query({ action: 'PAYMENT_CREATE' })
        .asAdmin();

      assert.apiResponse(auditResponse, 200);
      const logs = auditResponse.body.data.logs;
      expect(logs.some((log: any) => log.paymentId === response.body.data.paymentId)).toBe(true);
    });
  });

  describe('10. 性能测试', () => {
    it('支付创建应该在合理时间内完成', async () => {
      const startTime = Date.now();

      const orderData = {
        orderId: testDataSet.orders[14].id,
        amount: 1100,
        paymentMethod: 'WECHAT',
        description: '性能测试'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(orderData)
        .asUser('normal');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // 3秒内完成
      assert.apiResponse(response, 201);
    });

    it('应该能够处理并发支付请求', async () => {
      const promises = Array.from({ length: 50 }, (_, i) => {
        const orderData = {
          orderId: testDataSet.orders[i % testDataSet.orders.length].id,
          amount: 100 + i,
          paymentMethod: i % 2 === 0 ? 'WECHAT' : 'ALIPAY',
          description: `并发支付测试${i}`
        };

        return agent
          .post('/api/v1/payments/create')
          .send(orderData)
          .asUser(i % 3 === 0 ? 'normal' : i % 3 === 1 ? 'vip' : 'star1');
      });

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10000); // 10秒内完成50个请求
      responses.forEach(response => {
        assert.apiResponse(response, 201);
      });
    });
  });
});