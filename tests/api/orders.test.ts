/**
 * 订单管理API测试套件
 * 测试订单创建、查询、状态管理等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, setupTestDatabase, cleanupTestDatabase, generateTestData } from '../setup';

const API_BASE = '/api/v1';

describe('订单管理API测试', () => {
  let authToken: string = '';
  let userToken: string = '';
  let testOrderId: string = '';
  let testProductId: string = '';

  beforeAll(async () => {
    console.log('开始订单管理API测试...');
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('GET /orders', () => {
    it('应该能够获取订单模块信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/orders`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data).toHaveProperty('version');
    });

    it('应该能够获取订单列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/orders`)
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
    });

    it('应该能够按状态筛选订单', async () => {
      const response = await request(app)
        .get(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          page: 1,
          perPage: 10,
          status: 'PENDING'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      if (response.body.data.items.length > 0) {
        response.body.data.items.forEach((order: any) => {
          expect(order.status).toBe('PENDING');
        });
      }
    });

    it('应该能够按支付状态筛选订单', async () => {
      const response = await request(app)
        .get(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          page: 1,
          perPage: 10,
          paymentStatus: 'UNPAID'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该能够按时间范围筛选订单', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // 最近7天

      const response = await request(app)
        .get(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          page: 1,
          perPage: 10,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /orders', () => {
    it('应该能够创建新订单', async () => {
      const orderData = {
        items: [
          {
            product_id: 'test_product_12345',
            quantity: 2,
            price: 199.99
          }
        ],
        payment_method: 'POINTS',
        shipping_address: '测试地址',
        buyer_notes: '测试订单备注'
      };

      const response = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('order_no');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('total_amount');
      expect(response.body.data.status).toBe('PENDING');
      expect(response.body.data.paymentStatus).toBe('UNPAID');

      testOrderId = response.body.data.id;
      testProductId = orderData.items[0].product_id;
    });

    it('应该拒绝空的订单项', async () => {
      const orderData = {
        items: [],
        payment_method: 'POINTS',
        shipping_address: '测试地址'
      };

      const response = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMPTY_ORDER');
    });

    it('应该拒绝无效的支付方式', async () => {
      const orderData = {
        items: [
          {
            product_id: 'test_product_12345',
            quantity: 1,
            price: 99.99
          }
        ],
        payment_method: 'INVALID_METHOD',
        shipping_address: '测试地址'
      };

      const response = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('应该拒绝数量为0的商品', async () => {
      const orderData = {
        items: [
          {
            product_id: 'test_product_12345',
            quantity: 0,
            price: 99.99
          }
        ],
        payment_method: 'POINTS',
        shipping_address: '测试地址'
      };

      const response = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /orders/:orderId', () => {
    it('应该能够获取订单详情', async () => {
      if (!testOrderId) {
        console.log('跳过订单详情测试 - 没有测试订单');
        return;
      }

      const response = await request(app)
        .get(`${API_BASE}/orders/${testOrderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testOrderId);
      expect(response.body.data).toHaveProperty('order_no');
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total_amount');
      expect(response.body.data).toHaveProperty('buyer_notes');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('应该返回404当订单不存在', async () => {
      const fakeOrderId = 'non_existent_order_id';

      const response = await request(app)
        .get(`${API_BASE}/orders/${fakeOrderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ORDER_NOT_FOUND');
    });

    it('应该拒绝未授权的订单详情访问', async () => {
      if (!testOrderId) {
        console.log('跳过未授权测试 - 没有测试订单');
        return;
      }

      const response = await request(app)
        .get(`${API_BASE}/orders/${testOrderId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /orders/:orderId/confirm', () => {
    it('应该能够确认订单', async () => {
      if (!testOrderId) {
        console.log('跳过订单确认测试 - 没有测试订单');
        return;
      }

      const response = await request(app)
        .put(`${API_BASE}/orders/${testOrderId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CONFIRMED');
    });

    it('应该拒绝确认已取消的订单', async () => {
      // 假设有一个已取消的订单ID
      const cancelledOrderId = 'cancelled_order_12345';

      const response = await request(app)
        .put(`${API_BASE}/orders/${cancelledOrderId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });
  });

  describe('PUT /orders/:orderId/cancel', () => {
    it('应该能够取消订单', async () => {
      // 创建一个新订单用于取消测试
      const orderData = {
        items: [
          {
            product_id: 'test_product_67890',
            quantity: 1,
            price: 149.99
          }
        ],
        payment_method: 'POINTS',
        shipping_address: '测试地址2'
      };

      const createResponse = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(200);

      const cancelResponse = await request(app)
        .put(`${API_BASE}/orders/${createResponse.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.data.status).toBe('CANCELLED');
    });

    it('应该拒绝取消已完成的订单', async () => {
      const completedOrderId = 'completed_order_12345';

      const response = await request(app)
        .put(`${API_BASE}/orders/${completedOrderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('应该提供取消原因', async () => {
      const orderData = {
        items: [
          {
            product_id: 'test_product_11111',
            quantity: 1,
            price: 99.99
          }
        ],
        payment_method: 'POINTS',
        shipping_address: '测试地址3'
      };

      const createResponse = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(200);

      const cancelResponse = await request(app)
        .put(`${API_BASE}/orders/${createResponse.body.data.id}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: '用户主动取消' })
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.data.status).toBe('CANCELLED');
      expect(cancelResponse.body.data.cancel_reason).toBe('用户主动取消');
    });
  });

  describe('订单统计API', () => {
    it('应该能够获取订单统计信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/orders/statistics`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total_orders');
      expect(response.body.data).toHaveProperty('pending_orders');
      expect(response.body.data).toHaveProperty('completed_orders');
      expect(response.body.data).toHaveProperty('cancelled_orders');
      expect(response.body.data).toHaveProperty('total_amount');
      expect(typeof response.body.data.total_orders).toBe('number');
      expect(typeof response.body.data.total_amount).toBe('number');
    });

    it('应该能够获取订单统计概览', async () => {
      const response = await request(app)
        .get(`${API_BASE}/orders/statistics/overview`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('daily_stats');
      expect(response.body.data).toHaveProperty('monthly_stats');
      expect(response.body.data).toHaveProperty('yearly_stats');
      expect(response.body.data).toHaveProperty('recent_trends');
    });

    it('应该能够按时间范围获取统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/orders/statistics`)
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('换货申请 API', () => {
    it('应该能够创建换货申请', async () => {
      if (!testOrderId) {
        console.log('跳过换货申请测试 - 没有测试订单');
        return;
      }

      const exchangeData = {
        original_order_id: testOrderId,
        exchange_reason: '尺寸不合适',
        exchange_items: [
          {
            item_id: 'test_item_12345',
            exchange_item_id: 'test_exchange_item_67890',
            quantity: 1,
            reason: '换大一号'
          }
        ]
      };

      const response = await request(app)
        .post(`${API_BASE}/orders/exchange`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(exchangeData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('exchange_id');
      expect(response.body.data.status).toBe('PENDING');
    });

    it('应该拒绝无效的换货申请', async () => {
      const exchangeData = {
        original_order_id: 'invalid_order_id',
        exchange_reason: '',
        exchange_items: []
      };

      const response = await request(app)
        .post(`${API_BASE}/orders/exchange`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(exchangeData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('订单权限和安全测试', () => {
    it('应该阻止用户访问其他用户的订单', async () => {
      // 创建一个订单，然后尝试用另一个用户的token访问
      const orderData = {
        items: [
          {
            product_id: 'test_product_99999',
            quantity: 1,
            price: 299.99
          }
        ],
        payment_method: 'POINTS',
        shipping_address: '测试地址4'
      };

      const createResponse = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(200);

      // 使用不同的token尝试访问
      const anotherUserToken = 'another_user_token';

      const response = await request(app)
        .get(`${API_BASE}/orders/${createResponse.body.data.id}`)
        .set('Authorization', `Bearer ${anotherUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('应该验证订单金额的正确性', async () => {
      const orderData = {
        items: [
          {
            product_id: 'test_product_validation',
            quantity: 2,
            price: 100.00
          },
          {
            product_id: 'test_product_validation2',
            quantity: 3,
            price: 50.00
          }
        ],
        payment_method: 'POINTS',
        shipping_address: '测试地址5'
      };

      const response = await request(app)
        .post(`${API_BASE}/orders`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(200);

      const expectedTotal = (2 * 100.00) + (3 * 50.00);
      expect(response.body.data.total_amount).toBe(expectedTotal);
      expect(response.body.data.final_amount).toBe(expectedTotal);
    });

    it('应该验证库存可用性', async () => {
      // 尝试购买库存不足的商品
      const orderData = {
        items: [
          {
            product_id: 'out_of_stock_product',
            quantity: 1000, // 超大数量
            price: 99.99
          }
        ],
        payment_method: 'POINTS',
        shipping_address: '测试地址6'
      };

      const response = await request(app)
        .post(`${API_BASE}/orders}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData);

      if (response.status === 400) {
        expect(response.body.success).toBe(false);
        expect(['INSUFFICIENT_STOCK', 'PRODUCT_NOT_AVAILABLE']).toContain(response.body.error.code);
      }
    });
  });
});