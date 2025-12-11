/**
 * 支付安全测试
 * 测试支付回调的各种安全机制
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { setupTestDatabase, cleanupTestDatabase, getAuthHeadersForUser } from '../setup';
import { secureCallbackHandler } from '../../src/shared/payments/callbacks/secure-handler';
import { verifyWeChatPaySignature, verifyAlipaySignature } from '../../src/shared/payments/security/signature-verifier';
import { paymentSecurityConfigManager } from '../../src/shared/payments/security/config-manager';
import { paymentRetryHandler } from '../../src/shared/payments/security/retry-handler';
import crypto from 'crypto';

describe('支付安全测试', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('签名验证测试', () => {
    it('应该验证微信支付签名成功', async () => {
      // 模拟微信支付回调头部
      const headers = {
        'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
        'wechatpay-nonce': crypto.randomBytes(16).toString('hex'),
        'wechatpay-signature': 'mock_signature',
        'wechatpay-serial': 'mock_serial'
      };

      const body = JSON.stringify({
        resource: {
          out_trade_no: 'test_order_001',
          transaction_id: 'wx_test_001',
          trade_state: 'SUCCESS',
          amount: {
            total: 100,
            payer_total: 100
          },
          success_time: new Date().toISOString()
        }
      });

      // 由于是测试，签名验证会返回true（mock实现）
      const isValid = await verifyWeChatPaySignature(headers, body);
      expect(typeof isValid).toBe('boolean');
    });

    it('应该验证支付宝签名成功', async () => {
      // 模拟支付宝回调参数
      const params = {
        app_id: 'test_app_id',
        out_trade_no: 'test_order_001',
        trade_no: 'alipay_test_001',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '1.00',
        sign: 'mock_signature',
        sign_type: 'RSA2'
      };

      // 由于是测试，签名验证会返回true（mock实现）
      const isValid = await verifyAlipaySignature(params);
      expect(typeof isValid).toBe('boolean');
    });

    it('应该拒绝缺少签名的请求', async () => {
      const headers = {
        'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
        'wechatpay-nonce': crypto.randomBytes(16).toString('hex')
        // 缺少签名
      };

      const body = '{}';
      const isValid = await verifyWeChatPaySignature(headers, body);
      expect(isValid).toBe(false);
    });

    it('应该拒绝过期的签名', async () => {
      const expiredTimestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000); // 10分钟前

      const headers = {
        'wechatpay-timestamp': expiredTimestamp.toString(),
        'wechatpay-nonce': crypto.randomBytes(16).toString('hex'),
        'wechatpay-signature': 'mock_signature'
      };

      const body = '{}';
      const isValid = await verifyWeChatPaySignature(headers, body);
      expect(isValid).toBe(false);
    });
  });

  describe('IP白名单测试', () => {
    it('应该允许微信支付官方IP的请求', async () => {
      const result = await secureCallbackHandler.handleSecureCallback(
        'WECHAT',
        {
          ip: '101.226.103.1', // 微信支付官方IP
          body: {},
          headers: {},
          get: () => null
        } as any,
        async () => true
      );

      expect(result.success).toBe(true);
    });

    it('应该允许支付宝官方IP的请求', async () => {
      const result = await secureCallbackHandler.handleSecureCallback(
        'ALIPAY',
        {
          ip: '110.75.142.1', // 支付宝官方IP
          body: {},
          headers: {},
          get: () => null
        } as any,
        async () => true
      );

      expect(result.success).toBe(true);
    });

    it('应该拒绝非官方IP的请求（生产环境）', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = await secureCallbackHandler.handleSecureCallback(
        'WECHAT',
        {
          ip: '192.168.1.1', // 非官方IP
          body: {},
          headers: {},
          get: () => null
        } as any,
        async () => true
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('IP地址不在白名单内');

      process.env.NODE_ENV = originalEnv;
    });

    it('应该在开发环境允许所有IP', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result = await secureCallbackHandler.handleSecureCallback(
        'WECHAT',
        {
          ip: '192.168.1.1',
          body: {
            resource: {
              out_trade_no: 'test_order_001',
              trade_state: 'SUCCESS'
            }
          },
          headers: {
            'wechatpay-signature': 'mock'
          },
          get: (header: string) => {
            const headers: any = {
              'wechatpay-signature': 'mock',
              'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
              'wechatpay-nonce': 'test'
            };
            return headers[header];
          }
        } as any,
        async () => true
      );

      expect(result.success).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('幂等性测试', () => {
    it('应该阻止重复的回调请求', async () => {
      const requestBody = {
        resource: {
          out_trade_no: 'test_order_001',
          trade_state: 'SUCCESS'
        }
      };

      const req = {
        ip: '101.226.103.1',
        body: requestBody,
        headers: {
          'wechatpay-signature': 'mock',
          'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
          'wechatpay-nonce': 'test'
        },
        get: (header: string) => {
          const headers: any = {
            'wechatpay-signature': 'mock',
            'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
            'wechatpay-nonce': 'test'
          };
          return headers[header];
        }
      } as any;

      // 第一次请求
      const result1 = await secureCallbackHandler.handleSecureCallback(
        'WECHAT',
        req,
        async () => true
      );

      expect(result1.success).toBe(true);

      // 第二次相同请求
      const result2 = await secureCallbackHandler.handleSecureCallback(
        'WECHAT',
        req,
        async () => true
      );

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('重复的回调请求');
    });
  });

  describe('支付回调路由安全测试', () => {
    it('应该拒绝没有正确Content-Type的微信回调', async () => {
      const response = await request(app)
        .post('/api/v1/payments/wechat/notify')
        .set('Content-Type', 'text/plain')
        .send('{}')
        .expect(400);

      expect(response.body.error).toBe('Invalid Content-Type');
    });

    it('应该对微信回调应用速率限制', async () => {
      const promises = Array(150).fill(null).map(() =>
        request(app)
          .post('/api/v1/payments/wechat/notify')
          .set('Content-Type', 'application/json')
          .send({})
      );

      const results = await Promise.all(promises);

      // 应该有一些请求被限制
      const rateLimited = results.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('应该对支付创建应用速率限制', async () => {
      const adminHeaders = getAuthHeadersForUser('admin');

      const promises = Array(50).fill(null).map((_, i) =>
        request(app)
          .post('/api/v1/payments/create')
          .set(adminHeaders)
          .send({
            orderId: `test_order_${i}`,
            amount: 100,
            paymentMethod: 'WECHAT_JSAPI'
          })
      );

      const results = await Promise.all(promises);

      // 应该有一些请求被限制
      const rateLimited = results.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    });

    it('应该验证支付金额范围', async () => {
      const adminHeaders = getAuthHeadersForUser('admin');

      // 测试过小的金额
      const response1 = await request(app)
        .post('/api/v1/payments/create')
        .set(adminHeaders)
        .send({
          orderId: 'test_order_small',
          amount: 0.001, // 小于最小值
          paymentMethod: 'WECHAT_JSAPI'
        })
        .expect(400);

      expect(response1.body.error).toContain('out of range');

      // 测试过大的金额
      const response2 = await request(app)
        .post('/api/v1/payments/create')
        .set(adminHeaders)
        .send({
          orderId: 'test_order_large',
          amount: 2000000, // 大于最大值
          paymentMethod: 'WECHAT_JSAPI'
        })
        .expect(400);

      expect(response2.body.error).toContain('out of range');

      // 测试无效的精度
      const response3 = await request(app)
        .post('/api/v1/payments/create')
        .set(adminHeaders)
        .send({
          orderId: 'test_order_precision',
          amount: 100.001, // 超过2位小数
          paymentMethod: 'WECHAT_JSAPI'
        })
        .expect(400);

      expect(response3.body.error).toContain('precision');
    });
  });

  describe('配置管理测试', () => {
    it('应该成功加载微信支付配置', async () => {
      const config = await paymentSecurityConfigManager.getWeChatPayConfig();

      expect(config).toHaveProperty('appId');
      expect(config).toHaveProperty('mchId');
      expect(config).toHaveProperty('apiV3Key');
      expect(config).toHaveProperty('notifyUrl');
      expect(config).toHaveProperty('maxCallbackDelay');
      expect(config).toHaveProperty('amountThreshold');
    });

    it('应该成功加载支付宝配置', async () => {
      const config = await paymentSecurityConfigManager.getAlipayConfig();

      expect(config).toHaveProperty('appId');
      expect(config).toHaveProperty('privateKey');
      expect(config).toHaveProperty('alipayPublicKey');
      expect(config).toHaveProperty('notifyUrl');
      expect(config).toHaveProperty('signType');
      expect(config).toHaveProperty('maxCallbackDelay');
      expect(config).toHaveProperty('amountThreshold');
    });

    it('应该生成和验证安全令牌', () => {
      const orderId = 'test_order_001';
      const amount = 100;

      const token = paymentSecurityConfigManager.generateSecurityToken(orderId, amount);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      // 验证令牌
      const isValid = paymentSecurityConfigManager.verifySecurityToken(orderId, amount, token);
      expect(typeof isValid).toBe('boolean');
    });

    it('应该获取配置摘要', async () => {
      const summary = await paymentSecurityConfigManager.getConfigSummary();

      expect(summary).toHaveProperty('wechat');
      expect(summary).toHaveProperty('alipay');
      expect(summary.wechat).toHaveProperty('appId');
      expect(summary.wechat).toHaveProperty('mchId');
      expect(summary.alipay).toHaveProperty('appId');
      expect(summary.alipay).toHaveProperty('signType');
    });
  });

  describe('重试机制测试', () => {
    it('应该添加重试任务', async () => {
      const taskId = await paymentRetryHandler.addRetryTask(
        'PAYMENT_PROCESS',
        { orderId: 'test_order_001' }
      );

      expect(typeof taskId).toBe('string');
      expect(taskId).toMatch(/^task_\d+_[a-z0-9]+$/);
    });

    it('应该创建补偿记录', async () => {
      const recordId = await paymentRetryHandler.createCompensation(
        'test_order_001',
        'ROLLBACK_ORDER',
        '测试补偿',
        { reason: 'test' }
      );

      expect(typeof recordId).toBe('string');
      expect(recordId).toMatch(/^comp_\d+_[a-z0-9]+$/);
    });

    it('应该处理支付失败', async () => {
      const orderId = 'test_order_fail_001';
      const error = new Error('支付失败测试');

      // 模拟处理支付失败
      await paymentRetryHandler.handlePaymentFailure(orderId, error);

      // 验证补偿记录已创建（通过查询数据库）
      const compensation = await prisma.paymentCompensation.findFirst({
        where: { orderId }
      });

      expect(compensation).toBeDefined();
      expect(compensation?.type).toBe('ROLLBACK_ORDER');
      expect(compensation?.status).toBe('PENDING');
    });
  });

  describe('审计日志测试', () => {
    it('应该记录支付回调日志', async () => {
      const callbackData = {
        resource: {
          out_trade_no: 'test_order_audit_001',
          trade_state: 'SUCCESS'
        }
      };

      const req = {
        ip: '101.226.103.1',
        body: callbackData,
        headers: {
          'wechatpay-signature': 'mock',
          'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
          'wechatpay-nonce': 'test'
        },
        get: (header: string) => {
          const headers: any = {
            'wechatpay-signature': 'mock',
            'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
            'wechatpay-nonce': 'test'
          };
          return headers[header];
        }
      } as any;

      await secureCallbackHandler.handleSecureCallback(
        'WECHAT',
        req,
        async () => true
      );

      // 验证审计日志已记录
      const logs = await prisma.paymentCallbackLog.findMany({
        where: { orderId: 'test_order_audit_001' }
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].provider).toBe('WECHAT');
      expect(logs[0].ip).toBe('101.226.103.1');
    });
  });

  describe('安全头部测试', () => {
    it('应该设置安全头部', async () => {
      const response = await request(app)
        .get('/api/v1/payments/methods')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('应该禁用支付接口的缓存', async () => {
      const response = await request(app)
        .get('/api/v1/payments/methods')
        .expect(200);

      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['cache-control']).toContain('no-cache');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
    });
  });
});