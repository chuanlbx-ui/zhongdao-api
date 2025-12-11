/**
 * API性能测试
 * 测试API的响应时间、并发处理能力、大数据量查询等性能指标
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { TestAuthHelper } from '../helpers/auth.helper';
import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';

const prisma = new PrismaClient();
const API_BASE = '/api/v1';

describe('API性能测试', () => {
  let authHelper: TestAuthHelper;
  let normalUserToken: string;
  let directorToken: string;

  beforeAll(async () => {
    console.log('开始API性能测试...');
    authHelper = new TestAuthHelper();

    // 创建测试用户
    normalUserToken = (await authHelper.createTestUser('normal')).token;
    directorToken = (await authHelper.createTestUser('director')).token;

    // 创建大量测试数据用于性能测试
    await createPerformanceTestData();
  });

  afterAll(async () => {
    await cleanupPerformanceTestData();
    await prisma.$disconnect();
  });

  async function createPerformanceTestData() {
    // 创建1000个用户
    const users = [];
    for (let i = 0; i < 1000; i++) {
      users.push({
        id: `perf_user_${i}`,
        openid: `perf_openid_${i}`,
        nickname: `性能测试用户${i}`,
        phone: `1380013${String(i).padStart(4, '0')}`,
        level: 'NORMAL',
        status: 'ACTIVE',
        pointsBalance: Math.floor(Math.random() * 10000),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    await prisma.users.createMany({ data: users, skipDuplicates: true });

    // 创建100个商品
    const products = [];
    for (let i = 0; i < 100; i++) {
      products.push({
        id: `perf_product_${i}`,
        name: `性能测试商品${i}`,
        sku: `PERF_SKU_${i}`,
        basePrice: Math.floor(Math.random() * 1000) + 100,
        status: 'ACTIVE',
        categoryId: 'perf_category_id',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    await prisma.products.createMany({ data: products, skipDuplicates: true });

    // 创建500个订单
    const orders = [];
    for (let i = 0; i < 500; i++) {
      orders.push({
        id: `perf_order_${i}`,
        orderNo: `PERF${String(i).padStart(6, '0')}`,
        buyerId: `perf_user_${i % 1000}`,
        totalAmount: Math.floor(Math.random() * 5000) + 500,
        finalAmount: Math.floor(Math.random() * 5000) + 500,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      });
    }
    await prisma.orders.createMany({ data: orders, skipDuplicates: true });
  }

  async function cleanupPerformanceTestData() {
    // 清理性能测试数据
    await prisma.orders.deleteMany({
      where: { orderNo: { startsWith: 'PERF' } }
    });
    await prisma.products.deleteMany({
      where: { sku: { startsWith: 'PERF' } }
    });
    await prisma.users.deleteMany({
      where: { openid: { startsWith: 'perf_openid' } }
    });
  }

  describe('响应时间测试', () => {
    it('用户信息查询应在100ms内响应', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(100);
      console.log(`用户信息查询响应时间: ${responseTime.toFixed(2)}ms`);
    });

    it('商品列表查询应在200ms内响应', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/products`)
        .query({ page: 1, perPage: 20 })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(200);
      console.log(`商品列表查询响应时间: ${responseTime.toFixed(2)}ms`);
    });

    it('订单列表查询应在300ms内响应', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({ page: 1, perPage: 20 })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(300);
      console.log(`订单列表查询响应时间: ${responseTime.toFixed(2)}ms`);
    });

    it('团队统计查询应在500ms内响应', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/teams/statistics`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(500);
      console.log(`团队统计查询响应时间: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('并发请求测试', () => {
    it('应该能够处理100个并发用户注册', async () => {
      const concurrentRequests = 100;
      const promises = [];

      const startTime = performance.now();

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post(`${API_BASE}/auth/register`)
            .send({
              openid: `concurrent_${i}_${Date.now()}`,
              nickname: `并发用户${i}`,
              phone: `139${String(i).padStart(8, '0')}`
            })
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 201
      ).length;

      expect(successCount).toBeGreaterThan(90); // 至少90%成功
      expect(totalTime).toBeLessThan(5000); // 总时间小于5秒

      console.log(`并发注册测试: ${successCount}/${concurrentRequests} 成功`);
      console.log(`总耗时: ${totalTime.toFixed(2)}ms`);
      console.log(`平均响应时间: ${(totalTime / concurrentRequests).toFixed(2)}ms`);
    });

    it('应该能够处理50个并发订单查询', async () => {
      const concurrentRequests = 50;
      const promises = [];

      const startTime = performance.now();

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .get(`${API_BASE}/orders/perf_order_${i}`)
            .set('Authorization', `Bearer ${directorToken}`)
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200
      ).length;

      expect(successCount).toBeGreaterThan(40); // 至少80%成功
      expect(totalTime).toBeLessThan(3000); // 总时间小于3秒

      console.log(`并发订单查询测试: ${successCount}/${concurrentRequests} 成功`);
      console.log(`总耗时: ${totalTime.toFixed(2)}ms`);
    });

    it('应该能够处理30个并发积分转账', async () => {
      // 创建测试用户用于转账
      const sender = await authHelper.createTestUser('normal');
      const recipients = await Promise.all(
        Array.from({ length: 30 }, () => authHelper.createTestUser('normal'))
      );

      // 给发送者充值足够积分
      await prisma.users.update({
        where: { id: sender.id },
        data: { pointsBalance: 10000 }
      });

      const promises = [];
      const startTime = performance.now();

      for (let i = 0; i < 30; i++) {
        promises.push(
          request(app)
            .post(`${API_BASE}/points/transfer`)
            .set('Authorization', `Bearer ${sender.token}`)
            .send({
              toUserId: recipients[i].id,
              amount: 100,
              remark: `并发转账${i}`
            })
        );
      }

      const results = await Promise.allSettled(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.status === 200
      ).length;

      expect(successCount).toBeGreaterThan(25); // 至少80%成功
      expect(totalTime).toBeLessThan(10000); // 总时间小于10秒

      console.log(`并发积分转账测试: ${successCount}/30 成功`);
      console.log(`总耗时: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('大数据量查询测试', () => {
    it('应该能够高效分页查询大量用户', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/admin/users`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          page: 1,
          perPage: 100,
          level: 'NORMAL'
        })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBeGreaterThan(50);
      expect(responseTime).toBeLessThan(500);

      console.log(`大数据量用户查询响应时间: ${responseTime.toFixed(2)}ms`);
      console.log(`返回用户数: ${response.body.data.items.length}`);
    });

    it('应该能够高效查询一个月的订单数据', async () => {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const endDate = new Date();

      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/admin/orders`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          page: 1,
          perPage: 200,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          status: 'DELIVERED'
        })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(1000);

      console.log(`月度订单数据查询响应时间: ${responseTime.toFixed(2)}ms`);
      console.log(`返回订单数: ${response.body.data.items.length}`);
    });

    it('应该能够高效生成团队业绩报表', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/commission/statistics`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          period: 'month',
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          includeDetails: true
        })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(2000);

      console.log(`团队业绩报表生成响应时间: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('复杂查询性能测试', () => {
    it('多条件筛选查询应在合理时间内完成', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/products/search`)
        .query({
          keyword: '测试',
          categoryId: 'perf_category_id',
          minPrice: 100,
          maxPrice: 1000,
          sortBy: 'price',
          sortOrder: 'desc',
          page: 1,
          perPage: 50
        })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(800);

      console.log(`复杂商品搜索响应时间: ${responseTime.toFixed(2)}ms`);
    });

    it('团队层级查询应优化性能', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .get(`${API_BASE}/teams/tree`)
        .set('Authorization', `Bearer ${directorToken}`)
        .query({
          maxDepth: 5,
          includeInactive: false,
          minSales: 100
        })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(1500);

      console.log(`团队层级查询响应时间: ${responseTime.toFixed(2)}ms`);
    });

    it('佣金计算应在合理时间内完成', async () => {
      // 创建复杂的订单数据
      const orderData = {
        orderId: 'complex_order_001',
        buyerId: 'perf_user_1',
        sellerId: 'perf_user_2',
        orderAmount: 10000,
        products: Array.from({ length: 50 }, (_, i) => ({
          productId: `perf_product_${i}`,
          quantity: Math.floor(Math.random() * 10) + 1,
          unitPrice: Math.floor(Math.random() * 500) + 100,
          commissionRate: 0.1
        }))
      };

      const startTime = performance.now();

      const response = await request(app)
        .post(`${API_BASE}/commission/calculate`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send(orderData)
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(3000);

      console.log(`复杂佣金计算响应时间: ${responseTime.toFixed(2)}ms`);
      console.log(`计算商品数: ${orderData.products.length}`);
    });
  });

  describe('缓存性能测试', () => {
    it('热点数据查询应该使用缓存', async () => {
      // 第一次查询
      const startTime1 = performance.now();
      await request(app)
        .get(`${API_BASE}/products/perf_product_1`)
        .expect(200);
      const firstQueryTime = performance.now() - startTime1;

      // 第二次查询（应该使用缓存）
      const startTime2 = performance.now();
      await request(app)
        .get(`${API_BASE}/products/perf_product_1`)
        .expect(200);
      const secondQueryTime = performance.now() - startTime2;

      // 缓存的查询应该更快
      expect(secondQueryTime).toBeLessThan(firstQueryTime * 0.8);

      console.log(`首次查询时间: ${firstQueryTime.toFixed(2)}ms`);
      console.log(`缓存查询时间: ${secondQueryTime.toFixed(2)}ms`);
      console.log(`性能提升: ${((firstQueryTime - secondQueryTime) / firstQueryTime * 100).toFixed(2)}%`);
    });

    it('配置数据查询应该使用缓存', async () => {
      // 第一次查询配置
      const startTime1 = performance.now();
      await request(app)
        .get(`${API_BASE}/system/config`)
        .query({ keys: 'commission.rates,user.levels' })
        .expect(200);
      const firstQueryTime = performance.now() - startTime1;

      // 第二次查询
      const startTime2 = performance.now();
      await request(app)
        .get(`${API_BASE}/system/config`)
        .query({ keys: 'commission.rates,user.levels' })
        .expect(200);
      const secondQueryTime = performance.now() - startTime2;

      expect(secondQueryTime).toBeLessThan(firstQueryTime * 0.5);

      console.log(`配置首次查询: ${firstQueryTime.toFixed(2)}ms`);
      console.log(`配置缓存查询: ${secondQueryTime.toFixed(2)}ms`);
    });
  });

  describe('压力测试', () => {
    it('应该能够承受持续请求压力', async () => {
      const duration = 10000; // 10秒压力测试
      const requestInterval = 10; // 每10ms一个请求
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;

      const startTime = performance.now();

      while (performance.now() - startTime < duration) {
        const promise = request(app)
          .get(`${API_BASE}/users/profile`)
          .set('Authorization', `Bearer ${normalUserToken}`)
          .then((res) => {
            if (res.status === 200) successCount++;
          })
          .catch(() => {
            errorCount++;
          });

        // 使用setImmediate避免阻塞
        setImmediate(() => promise);
        requestCount++;

        // 等待下一个请求间隔
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }

      const totalTime = performance.now() - startTime;
      const requestsPerSecond = (requestCount / totalTime) * 1000;

      expect(successCount / requestCount).toBeGreaterThan(0.95); // 95%成功率
      expect(requestsPerSecond).toBeGreaterThan(50); // 每秒至少50个请求

      console.log(`压力测试结果:`);
      console.log(`- 总请求数: ${requestCount}`);
      console.log(`- 成功数: ${successCount}`);
      console.log(`- 失败数: ${errorCount}`);
      console.log(`- 成功率: ${((successCount / requestCount) * 100).toFixed(2)}%`);
      console.log(`- QPS: ${requestsPerSecond.toFixed(2)}`);
    });
  });
});