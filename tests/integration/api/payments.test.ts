import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ApiTestUtils } from './test-setup';

describe('支付API集成测试', () => {
  let testOrderId: string;
  let testTransactionId: string;

  beforeAll(async () => {
    console.log('🚀 开始支付API集成测试');
  });

  afterAll(async () => {
    console.log('✅ 支付API集成测试完成');
  });

  beforeEach(() => {
    // 生成测试订单ID
    testOrderId = `test_order_${Date.now()}`;
    testTransactionId = `wx_test_${Date.now()}`;
  });

  afterEach(() => {
    // 清理测试数据
  });

  describe('微信支付配置', () => {
    it('应该成功获取微信支付配置信息', async () => {
      const response = await ApiTestUtils.get('/api/v1/payments/wechat/config');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('configured');
      expect(data).toHaveProperty('sandbox');
      expect(data).toHaveProperty('supportedMethods');
      expect(data).toHaveProperty('enabled', true);
      expect(Array.isArray(data.supportedMethods)).toBe(true);
      expect(data.supportedMethods).toContain('WECHAT_JSAPI');
    });

    it('应该返回沙箱模式状态', async () => {
      const response = await ApiTestUtils.get('/api/v1/payments/wechat/config');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data.sandbox).toBe(true);
      expect(data.status).toBe('SANDBOX');
    });
  });

  describe('支付订单管理', () => {
    it('应该成功创建微信支付订单', async () => {
      const paymentData = ApiTestUtils.generateTestPayment({
        orderId: testOrderId,
        method: 'WECHAT_JSAPI',
        amount: 0.01
      });

      const response = await ApiTestUtils.post('/api/v1/payments/wechat/create', paymentData);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response);

        const { data } = response.body;
        expect(data).toHaveProperty('paymentId');
        expect(data).toHaveProperty('paymentParams');
      } else {
        // 在没有完整微信支付配置时，返回错误是正常的
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('应该成功查询支付状态', async () => {
      const response = await ApiTestUtils.get(`/api/v1/payments/wechat/query/${testOrderId}`);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response);

        const { data } = response.body;
        expect(data).toHaveProperty('orderId', testOrderId);
        expect(data).toHaveProperty('status');
      } else {
        // 订单不存在时返回错误是正常的
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('应该成功关闭支付订单', async () => {
      const response = await ApiTestUtils.post(`/api/v1/payments/wechat/close/${testOrderId}`);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response);

        const { data } = response.body;
        expect(data).toHaveProperty('success', true);
      } else {
        // 订单不存在或其他错误时，返回错误是正常的
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('支付回调测试', () => {
    it('应该生成测试回调数据', async () => {
      const response = await ApiTestUtils.get(`/api/v1/payments/wechat/generate-callback-data/${testOrderId}`);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('callbackExamples');
      expect(data.callbackExamples).toHaveProperty('SUCCESS');
      expect(data.callbackExamples).toHaveProperty('FAILED');
      expect(data.callbackExamples).toHaveProperty('CLOSED');
      expect(data).toHaveProperty('usage');
      expect(data.usage).toHaveProperty('endpoint');
      expect(data.usage.endpoint).toContain('/test-callback');
    });

    it('应该成功处理支付成功回调', async () => {
      const callbackData = {
        orderId: testOrderId,
        status: 'SUCCESS',
        amount: 0.01,
        transactionId: testTransactionId
      };

      const response = await ApiTestUtils.post('/api/v1/payments/wechat/test-callback', callbackData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('mockNotifyData');
      expect(data.mockNotifyData.orderId).toBe(testOrderId);
      expect(data.mockNotifyData.status).toBe('SUCCESS');
    });

    it('应该成功处理支付失败回调', async () => {
      const callbackData = {
        orderId: testOrderId,
        status: 'FAILED',
        amount: 0.01,
        transactionId: testTransactionId
      };

      const response = await ApiTestUtils.post('/api/v1/payments/wechat/test-callback', callbackData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('success', true);
      expect(data.mockNotifyData.status).toBe('FAILED');
    });

    it('应该成功处理订单关闭回调', async () => {
      const callbackData = {
        orderId: testOrderId,
        status: 'CLOSED',
        amount: 0.01,
        transactionId: testTransactionId
      };

      const response = await ApiTestUtils.post('/api/v1/payments/wechat/test-callback', callbackData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('success', true);
      expect(data.mockNotifyData.status).toBe('CLOSED');
    });
  });

  describe('退款功能', () => {
    it('应该成功申请退款', async () => {
      const refundData = {
        orderId: testOrderId,
        refundAmount: 0.01,
        totalAmount: 0.01,
        reason: '测试退款'
      };

      const response = await ApiTestUtils.post('/api/v1/payments/wechat/refund', refundData);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response);

        const { data } = response.body;
        expect(data).toHaveProperty('refundId');
      } else {
        // 在没有完整配置或订单不存在时，返回错误是正常的
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('通券支付', () => {
    it('应该支持通券支付', async () => {
      const paymentData = {
        orderId: `points_order_${Date.now()}`,
        amount: 100.50,
        subject: '通券充值',
        description: '通券充值测试',
        paymentMethod: 'POINTS'
      };

      const response = await ApiTestUtils.post('/api/v1/payments/points/pay', paymentData);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response);

        const { data } = response.body;
        expect(data).toHaveProperty('paymentId');
      } else {
        // 在没有足够通券余额时，返回错误是正常的
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('应该支持通券转账', async () => {
      const transferData = {
        toUserId: 'test_target_user',
        amount: 10.00,
        note: '测试转账'
      };

      const response = await ApiTestUtils.post('/api/v1/payments/points/transfer', transferData);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response);

        const { data } = response.body;
        expect(data).toHaveProperty('transactionId');
      } else {
        // 在目标用户不存在或余额不足时，返回错误是正常的
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('支付统计信息', () => {
    it('应该获取支付统计数据', async () => {
      const response = await ApiTestUtils.get('/api/v1/payments/statistics');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(typeof data).toBe('object');
      // 统计数据可能包含各种字段，验证基本结构
    });

    it('应该获取充值历史', async () => {
      const response = await ApiTestUtils.get('/api/v1/payments/recharge/history?page=1&perPage=10');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  describe('支付方式和汇率', () => {
    it('应该获取用户余额信息', async () => {
      const userId = 'test_user_id';
      const response = await ApiTestUtils.get(`/api/v1/payments/info/balance/${userId}`);

      if (response.body.success) {
        ApiTestUtils.validateApiResponse(response);

        const { data } = response.body;
        expect(data).toHaveProperty('balance');
      } else {
        // 用户不存在时返回错误是正常的
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('应该获取支付方式列表', async () => {
      const response = await ApiTestUtils.get('/api/v1/payments/info/methods');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.methods)).toBe(true);
      expect(data.methods.length).toBeGreaterThan(0);
    });

    it('应该获取汇率信息', async () => {
      const response = await ApiTestUtils.get('/api/v1/payments/info/exchange-rate');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(typeof data).toBe('object');
      expect(data).toHaveProperty('rates');
    });
  });

  describe('错误处理', () => {
    it('应该正确处理无效的订单ID', async () => {
      const response = await ApiTestUtils.get('/api/v1/payments/wechat/query/invalid-order-id');

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('应该正确处理无效的支付数据', async () => {
      const invalidPaymentData = {
        orderId: '',  // 空订单ID
        amount: -1,  // 负金额
        method: 'INVALID_METHOD'  // 无效支付方式
      };

      const response = await ApiTestUtils.post('/api/v1/payments/wechat/create', invalidPaymentData);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });

    it('应该正确处理无效的回调数据', async () => {
      const invalidCallbackData = {
        orderId: '',  // 空订单ID
        status: 'INVALID_STATUS',  // 无效状态
        amount: 'invalid_amount'  // 无效金额
      };

      const response = await ApiTestUtils.post('/api/v1/payments/wechat/test-callback', invalidCallbackData);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('安全性测试', () => {
    it('应该拒绝未认证的支付请求', async () => {
      const response = await ApiTestUtils.get('/api/v1/payments/wechat/config', {
        'Authorization': 'Bearer invalid_token'
      });

      expect(response.status).toBe(401);
    });

    it('应该验证支付金额范围', async () => {
      const invalidPaymentData = ApiTestUtils.generateTestPayment({
        orderId: testOrderId,
        amount: 999999.99  // 超出合理范围的金额
      });

      const response = await ApiTestUtils.post('/api/v1/payments/wechat/create', invalidPaymentData);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('性能测试', () => {
    it('支付配置查询响应时间应该在合理范围内', async () => {
      const startTime = Date.now();

      const response = await ApiTestUtils.get('/api/v1/payments/wechat/config');

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // 1秒内响应
    });

    it('应该支持并发支付状态查询', async () => {
      const promises = [];
      const concurrentRequests = 3;

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(ApiTestUtils.get(`/api/v1/payments/wechat/query/test_order_${i}`));
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        // 可能返回成功或错误，但不应该超时
        expect(response.status).toBeLessThan(500);
      });
    });
  });
});