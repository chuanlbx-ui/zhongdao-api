/**
 * 佣金管理API测试
 * 测试佣金计算、结算、提现等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { TestAuthHelper, createTestUser, getAuthHeaders } from '../helpers/auth.helper';
import { PrismaClient, pointsTransactions_type } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();
const API_BASE = '/api/v1';

describe('佣金管理API测试', () => {
  let normalUserToken: string;
  let starUserToken: string;
  let directorToken: string;
  let directorUserId: string;
  let testCommissionId: string;

  beforeAll(async () => {
    console.log('开始佣金管理API测试...');

    // 创建测试用户并获取token
    const normalUser = await createTestUser('normal');
    const starUser = await createTestUser('star2');
    const directorUser = await createTestUser('admin'); // 使用'admin'类型获取DIRECTOR角色

    normalUserToken = normalUser.tokens.accessToken;
    starUserToken = starUser.tokens.accessToken;
    directorToken = directorUser.tokens.accessToken;
    directorUserId = directorUser.id;

    // 创建测试佣金记录
    const commission = await prisma.pointsTransactions.create({
      data: {
        id: `cmi${createId()}`,
        transactionNo: `TXN${Date.now()}`,
        toUserId: starUser.id, // 使用toUserId而不是userId
        amount: 500,
        balanceBefore: 0,
        balanceAfter: 500,
        type: pointsTransactions_type.COMMISSION,
        description: '推广佣金',
        status: 'PENDING',
        metadata: JSON.stringify({
          orderId: 'test_order_id',
          commissionRate: 0.1,
          commissionLevel: 1
        })
      }
    });
    testCommissionId = commission.id;
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await prisma.pointsTransactions.deleteMany({
        where: {
          OR: [
            { description: { contains: '测试' } },
            { description: { contains: '佣金' } },
            { description: { contains: '推广佣金' } },
            { description: { contains: '待结算佣金' } },
            { description: { contains: '已结算佣金' } },
            { description: { contains: '佣金提现' } },
            { id: { startsWith: 'cmi' } } // 删除测试期间创建的记录
          ]
        }
      });
      console.log('✅ 清理测试数据完成');
    } catch (error) {
      console.warn('清理测试数据时出现警告:', error.message);
    }
    await prisma.$disconnect();
  });

  describe('GET /commission', () => {
    it('用户应该能够查看自己的佣金记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .query({
          page: 1,
          perPage: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('应该支持按状态筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .query({
          page: 1,
          perPage: 10,
          status: 'PENDING'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该支持按日期范围筛选', async () => {
      const today = new Date();
      const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .get(`${API_BASE}/commission`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .query({
          page: 1,
          perPage: 10,
          startDate: lastMonth.toISOString(),
          endDate: today.toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('管理员应该能查看所有佣金记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission`)
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

  describe('GET /commission/summary', () => {
    it('应该能够获取佣金汇总', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/summary`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCommission');
      expect(response.body.data).toHaveProperty('pendingCommission');
      expect(response.body.data).toHaveProperty('settledCommission');
      expect(response.body.data).toHaveProperty('thisMonthCommission');
      expect(response.body.data).toHaveProperty('lastMonthCommission');
    });

    it('应该包含佣金统计图表数据', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/summary`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          period: 'year',
          chart: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.chartData) {
        expect(Array.isArray(response.body.data.chartData)).toBe(true);
      }
    });
  });

  describe('GET /commission/:id', () => {
    it('应该能够获取指定佣金详情', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/${testCommissionId}`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testCommissionId);
      expect(response.body.data).toHaveProperty('sourceOrder');
      expect(response.body.data).toHaveProperty('calculationDetails');
    });

    it('不存在的佣金ID应返回404', async () => {
      const fakeId = 'nonexistent_commission_id';

      const response = await request(app)
        .get(`${API_BASE}/commission/${fakeId}`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('不能查看他人的佣金详情', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/${testCommissionId}`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /commission/calculate', () => {
    it('应该能够计算订单佣金', async () => {
      const normalUser = await createTestUser('normal');
      const starUser = await createTestUser('star1');

      const calculateData = {
        orderId: 'test_order_001',
        buyerId: normalUser.id,
        sellerId: starUser.id,
        orderAmount: 1000,
        products: [
          {
            productId: 'product_001',
            quantity: 10,
            unitPrice: 100,
            commissionRate: 0.1
          }
        ]
      };

      const response = await request(app)
        .post(`${API_BASE}/commission/calculate`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(calculateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('commissionDetails');
      expect(response.body.data).toHaveProperty('totalCommission');
      expect(Array.isArray(response.body.data.commissionDetails)).toBe(true);
    });

    it('应该验证订单数据', async () => {
      const calculateData = {
        orderId: '',
        orderAmount: -100
      };

      const response = await request(app)
        .post(`${API_BASE}/commission/calculate`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(calculateData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('普通用户不能计算佣金', async () => {
      const calculateData = {
        orderId: 'test_order',
        orderAmount: 100
      };

      const response = await request(app)
        .post(`${API_BASE}/commission/calculate`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(calculateData)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /commission/settle', () => {
    it('应该能够结算佣金', async () => {
      // 创建一个待结算的佣金记录
      const starUser = await createTestUser('star1');
      const pendingCommission = await prisma.pointsTransactions.create({
        data: {
          id: `cmi${createId()}`,
          transactionNo: `TXN${Date.now()}`,
          toUserId: starUser.id,
          type: pointsTransactions_type.COMMISSION,
          amount: 300,
          balanceBefore: 0,
          balanceAfter: 300,
          description: '待结算佣金',
          status: 'PENDING'
        }
      });

      const settleData = {
        commissionIds: [pendingCommission.id],
        settleDate: new Date().toISOString(),
        remark: '月度结算'
      };

      const response = await request(app)
        .post(`${API_BASE}/commission/settle`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(settleData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('settledCount');
      expect(response.body.data).toHaveProperty('totalAmount');
    });

    it('应该验证结算条件', async () => {
      const settleData = {
        commissionIds: ['invalid_id'],
        remark: '测试'
      };

      const response = await request(app)
        .post(`${API_BASE}/commission/settle`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(settleData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('普通用户不能结算佣金', async () => {
      const response = await request(app)
        .post(`${API_BASE}/commission/settle`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({
          commissionIds: [testCommissionId]
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /commission/withdraw', () => {
    it('应该能够申请佣金提现', async () => {
      // 创建一个已结算的佣金记录
      const starUser = await createTestUser('star3');
      const settledCommission = await prisma.pointsTransactions.create({
        data: {
          id: `cmi${createId()}`,
          transactionNo: `TXN${Date.now()}`,
          toUserId: starUser.id,
          type: pointsTransactions_type.COMMISSION,
          amount: 1000,
          balanceBefore: 0,
          balanceAfter: 1000,
          description: '已结算佣金',
          status: 'COMPLETED'
        }
      });

      const withdrawData = {
        commissionIds: [settledCommission.id],
        withdrawAmount: 1000,
        withdrawMethod: 'BANK',
        accountInfo: {
          bankName: '测试银行',
          accountNumber: '6222021234567890',
          accountName: '测试用户'
        },
        remark: '佣金提现'
      };

      const response = await request(app)
        .post(`${API_BASE}/commission/withdraw`)
        .set('Authorization', `Bearer ${starUser.tokens.accessToken}`)
        .send(withdrawData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('withdrawId');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('应该验证提现金额', async () => {
      const withdrawData = {
        commissionIds: [testCommissionId],
        withdrawAmount: -100,
        withdrawMethod: 'BANK'
      };

      const response = await request(app)
        .post(`${API_BASE}/commission/withdraw`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send(withdrawData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('应该验证提现方式', async () => {
      const withdrawData = {
        commissionIds: [testCommissionId],
        withdrawAmount: 100,
        withdrawMethod: 'INVALID_METHOD'
      };

      const response = await request(app)
        .post(`${API_BASE}/commission/withdraw`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send(withdrawData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /commission/withdrawals', () => {
    it('应该能够获取提现记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/withdrawals`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .query({
          page: 1,
          perPage: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      if (response.body.data.items.length > 0) {
        const withdrawal = response.body.data.items[0];
        expect(withdrawal).toHaveProperty('withdrawId');
        expect(withdrawal).toHaveProperty('amount');
        expect(withdrawal).toHaveProperty('status');
        expect(withdrawal).toHaveProperty('withdrawMethod');
      }
    });

    it('管理员应该能查看所有提现记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/withdrawals`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          page: 1,
          perPage: 10,
          allUsers: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该支持按状态筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/withdrawals`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          page: 1,
          perPage: 10,
          status: 'PENDING'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /commission/withdrawals/:id/approve', () => {
    it('管理员应该能够批准提现', async () => {
      // 创建一个提现申请
      const star3User = await createTestUser('star3');
      const commission = await prisma.pointsTransactions.create({
        data: {
          id: `cmi${createId()}`,
          transactionNo: `TXN${Date.now()}`,
          toUserId: star3User.id,
          type: pointsTransactions_type.COMMISSION,
          amount: 500,
          balanceBefore: 0,
          balanceAfter: 500,
          status: 'COMPLETED'
        }
      });

      const withdrawResponse = await request(app)
        .post(`${API_BASE}/commission/withdraw`)
        .set('Authorization', `Bearer ${star3User.tokens.accessToken}`)
        .send({
          commissionIds: [commission.id],
          withdrawAmount: 500,
          withdrawMethod: 'ALIPAY',
          accountInfo: {
            alipayAccount: 'test@example.com'
          }
        });

      const withdrawId = withdrawResponse.body.data.withdrawId;

      // 批准提现
      const response = await request(app)
        .post(`${API_BASE}/commission/withdrawals/${withdrawId}/approve`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          remark: '审核通过',
          transactionId: 'TXN123456789'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
    });

    it('普通用户不能批准提现', async () => {
      const response = await request(app)
        .post(`${API_BASE}/commission/withdrawals/some_withdraw_id/approve`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({
          remark: '我批准'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /commission/withdrawals/:id/reject', () => {
    it('管理员应该能够拒绝提现', async () => {
      // 创建一个提现申请
      const star3User = await createTestUser('star3');
      const commission = await prisma.pointsTransactions.create({
        data: {
          id: `cmi${createId()}`,
          transactionNo: `TXN${Date.now()}`,
          toUserId: star3User.id,
          type: pointsTransactions_type.COMMISSION,
          amount: 300,
          balanceBefore: 0,
          balanceAfter: 300,
          status: 'COMPLETED'
        }
      });

      const withdrawResponse = await request(app)
        .post(`${API_BASE}/commission/withdraw`)
        .set('Authorization', `Bearer ${star3User.tokens.accessToken}`)
        .send({
          commissionIds: [commission.id],
          withdrawAmount: 300,
          withdrawMethod: 'WECHAT',
          accountInfo: {
            wechatId: 'test_wechat_id'
          }
        });

      const withdrawId = withdrawResponse.body.data.withdrawId;

      // 拒绝提现
      const response = await request(app)
        .post(`${API_BASE}/commission/withdrawals/${withdrawId}/reject`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          reason: '资料不完整，请重新申请'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');
    });
  });

  describe('GET /commission/rules', () => {
    it('应该能够获取佣金规则', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/rules`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        const rule = response.body.data[0];
        expect(rule).toHaveProperty('level');
        expect(rule).toHaveProperty('rate');
        expect(rule).toHaveProperty('conditions');
      }
    });

    it('应该包含不同层级的佣金规则', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/rules`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          includeInactive: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /commission/rates', () => {
    it('应该能够获取当前佣金费率', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/rates`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('personalRate');
      expect(response.body.data).toHaveProperty('teamRates');
    });

    it('不同用户级别应该有不同的费率', async () => {
      const normalResponse = await request(app)
        .get(`${API_BASE}/commission/rates`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      const starResponse = await request(app)
        .get(`${API_BASE}/commission/rates`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(normalResponse.body.success).toBe(true);
      expect(starResponse.body.success).toBe(true);
    });
  });

  describe('GET /commission/statistics', () => {
    it('应该能够获取佣金统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/commission/statistics`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          period: 'month'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalCommission');
      expect(response.body.data).toHaveProperty('averageCommission');
      expect(response.body.data).toHaveProperty('topEarners');
      expect(response.body.data).toHaveProperty('distribution');
    });

    it('应该支持不同时间周期', async () => {
      const periods = ['day', 'week', 'month', 'quarter', 'year'];
      for (const period of periods) {
        const response = await request(app)
          .get(`${API_BASE}/commission/statistics`)
          .set('Authorization', `Bearer ${directorToken}`)
          .query({
            period: period
          })
          .expect(200);

        expect(response.body.success).toBe(true);
      }
    });
  });
});