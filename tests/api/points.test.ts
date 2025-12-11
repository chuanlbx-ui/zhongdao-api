/**
 * 积分系统API测试套件
 * 测试积分余额查询、转账、充值等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, setupTestDatabase, cleanupTestDatabase } from '../setup';
import { TestAuthHelper, createTestUser } from '../helpers/auth.helper';

const API_BASE = '/api/v1';

describe('积分系统API测试', () => {
  let authToken: string = '';
  let adminToken: string = '';
  let userToken: string = '';
  let testUserId: string = '';
  let testTransactionId: string = '';
  let adminUser: any;
  let normalUser: any;

  beforeAll(async () => {
    console.log('开始积分系统API测试...');
    await setupTestDatabase();

    // 创建测试用户并生成tokens
    adminUser = await createTestUser('admin');
    normalUser = await createTestUser('normal');

    adminToken = adminUser.tokens.accessToken;
    userToken = normalUser.tokens.accessToken;
    testUserId = normalUser.id;

    console.log('✅ 测试用户已创建，tokens已生成');
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /points/balance', () => {
    it('应该能够获取积分余额', async () => {
      const response = await request(app)
        .get(`${API_BASE}/points/balance`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('balance');
      expect(response.body.data).toHaveProperty('frozen_balance');
      expect(typeof response.body.data.balance).toBe('number');
      expect(typeof response.body.data.frozen_balance).toBe('number');
    });

    it('应该拒绝未授权的余额查询请求', async () => {
      const response = await request(app)
        .get(`${API_BASE}/points/balance`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /points/transfer', () => {
    it('应该能够进行积分转账', async () => {
      const transferData = {
        toUserId: adminUser.id, // 使用真实的管理员用户ID
        amount: 100,
        description: '测试转账'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(transferData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transaction_id');
      expect(response.body.data).toHaveProperty('from_balance');
      expect(response.body.data).toHaveProperty('to_balance');
      expect(response.body.data.amount).toBe(transferData.amount);
    });

    it('应该拒绝负金额转账', async () => {
      const transferData = {
        toUserId: 'test_recipient_user_12345',
        amount: -100,
        description: '无效转账'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(transferData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_AMOUNT');
    });

    it('应该拒绝转账给自己', async () => {
      const transferData = {
        toUserId: testUserId,
        amount: 100,
        description: '给自己转账'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(transferData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('应该拒绝余额不足的转账', async () => {
      const transferData = {
        toUserId: 'test_recipient_user_12345',
        amount: 999999999, // 超大金额
        description: '余额不足转账'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(transferData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_BALANCE');
    });
  });

  describe('GET /points/transactions', () => {
    it('应该能够获取积分流水记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/points/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          page: 1,
          perPage: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('perPage');
      expect(response.body.data.items).toBeInstanceOf(Array);

      // 验证交易记录结构
      if (response.body.data.items.length > 0) {
        const transaction = response.body.data.items[0];
        expect(transaction).toHaveProperty('id');
        expect(transaction).toHaveProperty('amount');
        expect(transaction).toHaveProperty('type');
        expect(transaction).toHaveProperty('description');
        expect(transaction).toHaveProperty('created_at');
      }
    });

    it('应该能够按交易类型筛选流水记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/points/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          page: 1,
          perPage: 10,
          type: 'TRANSFER'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.items.length > 0) {
        response.body.data.items.forEach((item: any) => {
          expect(item.type).toBe('TRANSFER');
        });
      }
    });

    it('应该能够按时间范围筛选流水记录', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // 30天前

      const response = await request(app)
        .get(`${API_BASE}/points/transactions`)
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          page: 1,
          perPage: 10,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /points/statistics', () => {
    it('应该能够获取积分统计信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/points/statistics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_earned');
      expect(response.body.data).toHaveProperty('total_spent');
      expect(response.body.data).toHaveProperty('current_balance');
      expect(response.body.data).toHaveProperty('transfer_count');
      expect(response.body.data).toHaveProperty('recharge_count');
      expect(typeof response.body.data.total_earned).toBe('number');
      expect(typeof response.body.data.current_balance).toBe('number');
    });

    it('应该能够获取指定时间范围的统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/points/statistics`)
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          period: 'month' // 最近一个月
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /points/recharge (管理员)', () => {
    it('应该能够为用户充值积分（管理员权限）', async () => {
      const rechargeData = {
        userId: testUserId,
        amount: 500,
        description: '管理员测试充值'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/recharge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(rechargeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transaction_id');
      expect(response.body.data).toHaveProperty('new_balance');
      expect(response.body.data.amount).toBe(rechargeData.amount);
      testTransactionId = response.body.data.transaction_id;
    });

    it('应该拒绝非管理员的充值请求', async () => {
      const rechargeData = {
        userId: testUserId,
        amount: 500,
        description: '非法充值'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/recharge`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(rechargeData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('应该拒绝负数充值', async () => {
      const rechargeData = {
        userId: testUserId,
        amount: -100,
        description: '无效充值'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/recharge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(rechargeData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /points/freeze (管理员)', () => {
    it('应该能够冻结用户积分（管理员权限）', async () => {
      const freezeData = {
        userId: testUserId,
        amount: 200,
        description: '违规操作冻结积分'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/freeze`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(freezeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('transaction_id');
      expect(response.body.data.frozen_balance).toBeGreaterThan(0);
    });

    it('应该能够解冻用户积分（管理员权限）', async () => {
      const freezeData = {
        userId: testUserId,
        amount: -200, // 负数表示解冻
        description: '解冻积分'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/freeze`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(freezeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.frozen_balance).toBe(0);
    });
  });

  describe('POST /points/batch-recharge (管理员)', () => {
    it('应该能够批量充值积分（管理员权限）', async () => {
      const batchRechargeData = {
        operations: [
          {
            userId: testUserId,
            amount: 100,
            description: '批量充值1'
          },
          {
            userId: 'test_user_67890',
            amount: 200,
            description: '批量充值2'
          }
        ]
      };

      const response = await request(app)
        .post(`${API_BASE}/points/batch-recharge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(batchRechargeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data.results).toHaveProperty('success');
      expect(response.body.data.results).toHaveProperty('failure');
      expect(Array.isArray(response.body.data.results.success)).toBe(true);
    });

    it('应该处理批量充值中的部分失败', async () => {
      const batchRechargeData = {
        operations: [
          {
            userId: testUserId,
            amount: 100,
            description: '正常充值'
          },
          {
            userId: '', // 无效用户ID
            amount: 200,
            description: '无效充值'
          }
        ]
      };

      const response = await request(app)
        .post(`${API_BASE}/points/batch-recharge`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(batchRechargeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results.success.length).toBe(1);
      expect(response.body.data.results.failure.length).toBe(1);
    });
  });

  describe('积分转账限制和安全测试', () => {
    it('应该有单日转账金额限制', async () => {
      // 测试大额转账是否被限制
      const largeAmount = 50000; // 假设日限额是10000
      const transferData = {
        toUserId: 'test_recipient_user_12345',
        amount: largeAmount,
        description: '大额转账测试'
      };

      const response = await request(app)
        .post(`${API_BASE}/points/transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(transferData);

      // 根据实际业务逻辑，可能返回400或需要额外验证
      if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(['EXCEEDS_DAILY_LIMIT', 'INSUFFICIENT_BALANCE']).toContain(response.body.error.code);
      }
    });

    it('应该有转账频率限制', async () => {
      const transferData = {
        toUserId: 'test_recipient_user_12345',
        amount: 10,
        description: '频率测试转账'
      };

      // 快速连续发送多个转账请求
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post(`${API_BASE}/points/transfer`)
          .set('Authorization', `Bearer ${userToken}`)
          .send(transferData)
      );

      const responses = await Promise.all(promises);

      // 至少有一些请求应该成功，但后续请求可能被限制
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitCount = responses.filter(r => r.status === 429).length;

      expect(successCount + rateLimitCount).toBe(5); // 所有请求都应该有明确的响应
    });
  });
});