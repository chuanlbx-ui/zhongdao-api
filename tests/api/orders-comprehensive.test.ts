/**
 * 完整的订单创建和状态测试
 * 覆盖订单生命周期管理的所有场景
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app, setupTestDatabase, cleanupTestDatabase, createTestAgent, assert, generateTestData } from '../setup';
import { TestDataFactory } from '../factories/test-data.factory';
import { DatabaseIsolation } from '../isolation/database-isolation';

describe('完整订单管理测试', () => {
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
    const contextId = await isolation.startIsolation('order-test');
    (global as any).currentTestContextId = contextId;
  });

  afterEach(async () => {
    const contextId = (global as any).currentTestContextId;
    if (contextId) {
      await isolation.endIsolation(contextId);
    }
  });

  describe('1. 创建订单', () => {
    it('应该能够创建基础订单', async () => {
      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 2,
            price: testDataSet.products[0].basePrice
          },
          {
            productId: testDataSet.products[1].id,
            quantity: 1,
            price: testDataSet.products[1].basePrice
          }
        ],
        shippingAddress: {
          province: '浙江省',
          city: '杭州市',
          district: '西湖区',
          detail: '文三路123号',
          receiver: '测试收货人',
          phone: '13800138000'
        },
        buyerNotes: '测试订单备注'
      };

      const response = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      assert.apiResponse(response, 201);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data.order.status).toBe('PENDING');
      expect(response.body.data.order.orderNo).toMatch(/^TEST-/);
      expect(response.body.data.order.totalAmount).toBeGreaterThan(0);
    });

    it('应该根据用户等级应用正确价格', async () => {
      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 1
          }
        ],
        shippingAddress: {
          province: '北京市',
          city: '北京市',
          district: '朝阳区',
          detail: '测试地址',
          receiver: 'VIP用户',
          phone: '13900139000'
        }
      };

      // 普通用户价格
      const normalResponse = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      // VIP用户价格
      const vipResponse = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('vip');

      expect(normalResponse.body.data.order.totalAmount)
        .toBeGreaterThan(vipResponse.body.data.order.totalAmount);
    });

    it('应该验证库存可用性', async () => {
      // 创建一个库存为0的商品
      const outOfStockProduct = await testDataFactory.prisma.products.create({
        data: {
          id: TestDataFactory.generateUniqueId('prod'),
          name: '缺货测试商品',
          code: 'OUT-OF-STOCK',
          sku: 'OOS001',
          categoryId: testDataSet.categories[0].id,
          basePrice: 100,
          totalStock: 0,
          minStock: 0,
          status: 'ACTIVE'
        }
      });

      const orderData = {
        items: [
          {
            productId: outOfStockProduct.id,
            quantity: 1
          }
        ],
        shippingAddress: {
          province: '上海市',
          city: '上海市',
          district: '浦东新区',
          detail: '测试地址',
          receiver: '测试用户',
          phone: '13700137000'
        }
      };

      const response = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      assert.errorResponse(response, 400, 'INSUFFICIENT_STOCK');
    });

    it('应该验证采购权限（只能从高级别采购）', async () => {
      // 普通用户尝试从另一个普通用户采购
      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 1
          }
        ],
        sellerId: testDataSet.users.find(u => u.level === 'NORMAL')?.id,
        shippingAddress: {
          province: '广东省',
          city: '深圳市',
          district: '南山区',
          detail: '测试地址',
          receiver: '测试用户',
          phone: '13600136000'
        }
      };

      const response = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      assert.errorResponse(response, 400, 'INVALID_PURCHASE_PATH');
    });

    it('应该验证必填字段', async () => {
      const invalidOrderData = {
        items: [
          {
            productId: testDataSet.products[0].id
            // 缺少 quantity
          }
        ]
        // 缺少 shippingAddress
      };

      const response = await agent
        .post('/api/v1/orders')
        .send(invalidOrderData)
        .asUser('normal');

      assert.errorResponse(response, 400);
    });

    it('应该支持批量创建订单', async () => {
      const batchOrderData = {
        orders: [
          {
            items: [{ productId: testDataSet.products[0].id, quantity: 1 }],
            shippingAddress: {
              province: '江苏省',
              city: '南京市',
              district: '鼓楼区',
              detail: '地址1',
              receiver: '收货人1',
              phone: '13500135000'
            }
          },
          {
            items: [{ productId: testDataSet.products[1].id, quantity: 2 }],
            shippingAddress: {
              province: '江苏省',
              city: '南京市',
              district: '鼓楼区',
              detail: '地址2',
              receiver: '收货人2',
              phone: '13500135001'
            }
          }
        ]
      };

      const response = await agent
        .post('/api/v1/orders/batch')
        .send(batchOrderData)
        .asUser('normal');

      assert.apiResponse(response, 201);
      expect(response.body.data).toHaveProperty('orders');
      expect(Array.isArray(response.body.data.orders)).toBe(true);
      expect(response.body.data.orders).toHaveLength(2);
    });
  });

  describe('2. 订单查询', () => {
    let testOrder: any;

    beforeEach(async () => {
      // 创建测试订单
      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 1,
            price: testDataSet.products[0].basePrice
          }
        ],
        shippingAddress: {
          province: '湖北省',
          city: '武汉市',
          district: '武昌区',
          detail: '测试查询地址',
          receiver: '查询测试',
          phone: '13400134000'
        }
      };

      const response = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      testOrder = response.body.data.order;
    });

    it('应该能够查询订单详情', async () => {
      const response = await agent
        .get(`/api/v1/orders/${testOrder.id}`)
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data.order.id).toBe(testOrder.id);
      expect(response.body.data.order.items).toBeDefined();
      expect(response.body.data.order.items).toHaveLength(1);
    });

    it('应该能够查询订单列表', async () => {
      const response = await agent
        .get('/api/v1/orders')
        .asUser('normal');

      assert.apiResponse(response, 200);
      assert.paginatedResponse(response);
      expect(Array.isArray(response.body.data.items)).toBe(true);
      expect(response.body.data.items.some((item: any) => item.id === testOrder.id)).toBe(true);
    });

    it('应该支持按状态筛选订单', async () => {
      const response = await agent
        .get('/api/v1/orders')
        .query({ status: 'PENDING' })
        .asUser('normal');

      assert.apiResponse(response, 200);
      response.body.data.items.forEach((item: any) => {
        expect(item.status).toBe('PENDING');
      });
    });

    it('应该支持按时间范围筛选', async () => {
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      const response = await agent
        .get('/api/v1/orders')
        .query({
          startDate: yesterday.toISOString(),
          endDate: today.toISOString()
        })
        .asUser('normal');

      assert.apiResponse(response, 200);
    });

    it('应该验证订单访问权限', async () => {
      const response = await agent
        .get(`/api/v1/orders/${testOrder.id}`)
        .asUser('vip'); // 不同用户

      assert.errorResponse(response, 403, 'FORBIDDEN');
    });
  });

  describe('3. 订单状态流转', () => {
    let testOrder: any;

    beforeEach(async () => {
      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 1
          }
        ],
        shippingAddress: {
          province: '四川省',
          city: '成都市',
          district: '高新区',
          detail: '状态测试地址',
          receiver: '状态测试',
          phone: '13300133000'
        }
      };

      const response = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      testOrder = response.body.data.order;
    });

    it('应该能够取消待支付订单', async () => {
      const response = await agent
        .post(`/api/v1/orders/${testOrder.id}/cancel`)
        .send({ reason: '测试取消' })
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data.order.status).toBe('CANCELLED');
    });

    it('应该能够支付订单', async () => {
      // 先支付
      const paymentData = {
        orderId: testOrder.id,
        amount: testOrder.totalAmount,
        paymentMethod: 'POINTS',
        usePoints: Math.floor(testOrder.totalAmount),
        description: '订单支付测试'
      };

      const paymentResponse = await agent
        .post('/api/v1/payments/create')
        .send(paymentData)
        .asUser('normal');

      // 验证订单状态已更新
      const orderResponse = await agent
        .get(`/api/v1/orders/${testOrder.id}`)
        .asUser('normal');

      expect(orderResponse.body.data.order.status).toBe('PAID');
      expect(orderResponse.body.data.order.paymentStatus).toBe('PAID');
    });

    it('应该能够发货已支付订单', async () => {
      // 先支付
      await agent
        .post('/api/v1/payments/create')
        .send({
          orderId: testOrder.id,
          amount: testOrder.totalAmount,
          paymentMethod: 'POINTS',
          usePoints: Math.floor(testOrder.totalAmount)
        })
        .asUser('normal');

      // 发货
      const shippingData = {
        trackingNumber: 'SF1234567890',
        shippingCompany: '顺丰快递',
        shippedAt: new Date().toISOString()
      };

      const response = await agent
        .post(`/api/v1/orders/${testOrder.id}/ship`)
        .send(shippingData)
        .asUser('star3'); // 需要店长权限

      assert.apiResponse(response, 200);
      expect(response.body.data.order.status).toBe('SHIPPED');
    });

    it('应该能够确认收货', async () => {
      // 完整流程：支付 -> 发货 -> 收货
      await agent
        .post('/api/v1/payments/create')
        .send({
          orderId: testOrder.id,
          amount: testOrder.totalAmount,
          paymentMethod: 'POINTS',
          usePoints: Math.floor(testOrder.totalAmount)
        })
        .asUser('normal');

      await agent
        .post(`/api/v1/orders/${testOrder.id}/ship`)
        .send({
          trackingNumber: 'SF0987654321',
          shippingCompany: '顺丰快递'
        })
        .asUser('star3');

      // 确认收货
      const response = await agent
        .post(`/api/v1/orders/${testOrder.id}/confirm-receipt`)
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data.order.status).toBe('DELIVERED');
    });

    it('应该防止无效状态转换', async () => {
      // 已取消的订单不能支付
      await agent
        .post(`/api/v1/orders/${testOrder.id}/cancel`)
        .send({ reason: '测试取消' })
        .asUser('normal');

      const paymentData = {
        orderId: testOrder.id,
        amount: testOrder.totalAmount,
        paymentMethod: 'WECHAT',
        description: '尝试支付已取消订单'
      };

      const response = await agent
        .post('/api/v1/payments/create')
        .send(paymentData)
        .asUser('normal');

      assert.errorResponse(response, 400, 'INVALID_ORDER_STATUS');
    });
  });

  describe('4. 订单修改', () => {
    let testOrder: any;

    beforeEach(async () => {
      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 1
          }
        ],
        shippingAddress: {
          province: '陕西省',
          city: '西安市',
          district: '雁塔区',
          detail: '修改测试地址',
          receiver: '修改测试',
          phone: '13200132000'
        }
      };

      const response = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      testOrder = response.body.data.order;
    });

    it('应该能够修改待支付订单的收货地址', async () => {
      const newAddress = {
        province: '河南省',
        city: '郑州市',
        district: '金水区',
        detail: '新收货地址',
        receiver: '新收货人',
        phone: '13100131000'
      };

      const response = await agent
        .put(`/api/v1/orders/${testOrder.id}/address`)
        .send(newAddress)
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data.order.shippingAddress).toMatchObject(newAddress);
    });

    it('应该能够添加订单备注', async () => {
      const response = await agent
        .put(`/api/v1/orders/${testOrder.id}/notes`)
        .send({ notes: '新添加的订单备注' })
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data.order.buyerNotes).toBe('新添加的订单备注');
    });

    it('应该不能修改已支付订单的商品', async () => {
      // 先支付
      await agent
        .post('/api/v1/payments/create')
        .send({
          orderId: testOrder.id,
          amount: testOrder.totalAmount,
          paymentMethod: 'POINTS',
          usePoints: Math.floor(testOrder.totalAmount)
        })
        .asUser('normal');

      // 尝试修改商品
      const itemUpdate = {
        itemId: testOrder.items[0].id,
        quantity: 3
      };

      const response = await agent
        .put(`/api/v1/orders/${testOrder.id}/items`)
        .send(itemUpdate)
        .asUser('normal');

      assert.errorResponse(response, 400, 'ORDER_NOT_MODIFIABLE');
    });
  });

  describe('5. 订单评价', () => {
    let deliveredOrder: any;

    beforeEach(async () => {
      // 创建并完成一个订单
      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 1
          }
        ],
        shippingAddress: {
          province: '山东省',
          city: '青岛市',
          district: '市南区',
          detail: '评价测试地址',
          receiver: '评价测试',
          phone: '13000130000'
        }
      };

      const orderResponse = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      deliveredOrder = orderResponse.body.data.order;

      // 快速完成订单流程（测试环境）
      await agent
        .post('/api/v1/payments/create')
        .send({
          orderId: deliveredOrder.id,
          amount: deliveredOrder.totalAmount,
          paymentMethod: 'POINTS',
          usePoints: Math.floor(deliveredOrder.totalAmount)
        })
        .asUser('normal');

      await agent
        .post(`/api/v1/orders/${deliveredOrder.id}/ship`)
        .send({
          trackingNumber: 'TEST_TRACKING',
          shippingCompany: '测试快递'
        })
        .asUser('star3');

      await agent
        .post(`/api/v1/orders/${deliveredOrder.id}/confirm-receipt`)
        .asUser('normal');
    });

    it('应该能够评价商品', async () => {
      const reviewData = {
        items: [
          {
            itemId: deliveredOrder.items[0].id,
            rating: 5,
            content: '非常好的商品，质量不错！',
            images: ['https://example.com/review1.jpg']
          }
        ]
      };

      const response = await agent
        .post(`/api/v1/orders/${deliveredOrder.id}/review`)
        .send(reviewData)
        .asUser('normal');

      assert.apiResponse(response, 201);
      expect(response.body.data).toHaveProperty('reviews');
      expect(response.body.data.reviews).toHaveLength(1);
      expect(response.body.data.reviews[0].rating).toBe(5);
    });

    it('应该能够追加评价', async () => {
      // 先创建评价
      await agent
        .post(`/api/v1/orders/${deliveredOrder.id}/review`)
        .send({
          items: [
            {
              itemId: deliveredOrder.items[0].id,
              rating: 4,
              content: '初次评价'
            }
          ]
        })
        .asUser('normal');

      // 追加评价
      const response = await agent
        .post(`/api/v1/orders/${deliveredOrder.id}/review/append`)
        .send({
          itemId: deliveredOrder.items[0].id,
          content: '使用了一段时间后，感觉更满意了！',
          images: ['https://example.com/review2.jpg']
        })
        .asUser('normal');

      assert.apiResponse(response, 200);
    });

    it('应该验证评价权限', async () => {
      const response = await agent
        .post(`/api/v1/orders/${deliveredOrder.id}/review`)
        .send({
          items: [
            {
              itemId: deliveredOrder.items[0].id,
              rating: 3,
              content: '无效用户评价'
            }
          ]
        })
        .asUser('vip'); // 不同用户

      assert.errorResponse(response, 403, 'FORBIDDEN');
    });

    it('应该防止重复评价', async () => {
      // 第一次评价
      await agent
        .post(`/api/v1/orders/${deliveredOrder.id}/review`)
        .send({
          items: [
            {
              itemId: deliveredOrder.items[0].id,
              rating: 5,
              content: '第一次评价'
            }
          ]
        })
        .asUser('normal');

      // 第二次评价
      const response = await agent
        .post(`/api/v1/orders/${deliveredOrder.id}/review`)
        .send({
          items: [
            {
              itemId: deliveredOrder.items[0].id,
              rating: 4,
              content: '第二次评价'
            }
          ]
        })
        .asUser('normal');

      assert.errorResponse(response, 400, 'REVIEW_EXISTS');
    });
  });

  describe('6. 订单统计', () => {
    it('应该返回用户订单统计', async () => {
      const response = await agent
        .get('/api/v1/orders/stats')
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('totalOrders');
      expect(response.body.data).toHaveProperty('totalAmount');
      expect(response.body.data).toHaveProperty('statusCounts');
      expect(response.body.data).toHaveProperty('recentOrders');
    });

    it('应该返回管理员订单统计', async () => {
      const response = await agent
        .get('/api/v1/admin/orders/stats')
        .asAdmin();

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('todayOrders');
      expect(response.body.data).toHaveProperty('monthOrders');
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('averageOrderValue');
    });

    it('应该支持按时间范围统计', async () => {
      const response = await agent
        .get('/api/v1/admin/orders/stats')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .asAdmin();

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('period');
    });
  });

  describe('7. 订单导出', () => {
    it('应该能够导出订单列表', async () => {
      const response = await agent
        .get('/api/v1/admin/orders/export')
        .query({
          format: 'csv',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .asAdmin();

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('应该支持Excel格式导出', async () => {
      const response = await agent
        .get('/api/v1/admin/orders/export')
        .query({
          format: 'excel',
          status: 'PAID'
        })
        .asAdmin();

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument');
    });

    it('应该验证导出权限', async () => {
      const response = await agent
        .get('/api/v1/admin/orders/export')
        .query({ format: 'csv' })
        .asUser('normal');

      assert.errorResponse(response, 403, 'FORBIDDEN');
    });
  });

  describe('8. 批量操作', () => {
    it('应该能够批量发货', async () => {
      // 先创建多个已支付订单
      const orders = [];
      for (let i = 0; i < 3; i++) {
        const orderData = {
          items: [
            {
              productId: testDataSet.products[i].id,
              quantity: 1
            }
          ],
          shippingAddress: {
            province: '福建省',
            city: '厦门市',
            district: '思明区',
            detail: `批量发货测试${i}`,
            receiver: `收货人${i}`,
            phone: `1290012900${i}`
          }
        };

        const orderResponse = await agent
          .post('/api/v1/orders')
          .send(orderData)
          .asUser('normal');

        const order = orderResponse.body.data.order;

        // 支付订单
        await agent
          .post('/api/v1/payments/create')
          .send({
            orderId: order.id,
            amount: order.totalAmount,
            paymentMethod: 'POINTS',
            usePoints: Math.floor(order.totalAmount)
          })
          .asUser('normal');

        orders.push(order);
      }

      // 批量发货
      const batchShipData = {
        orders: orders.map(order => ({
          orderId: order.id,
          trackingNumber: `BATCH${Date.now()}${order.id.slice(-4)}`,
          shippingCompany: '批量测试快递'
        }))
      };

      const response = await agent
        .post('/api/v1/admin/orders/batch-ship')
        .send(batchShipData)
        .asAdmin();

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data.results).toHaveLength(3);
    });

    it('应该能够批量取消订单', async () => {
      // 创建多个待支付订单
      const orders = [];
      for (let i = 0; i < 3; i++) {
        const orderData = {
          items: [
            {
              productId: testDataSet.products[0].id,
              quantity: 1
            }
          ],
          shippingAddress: {
            province: '江西省',
            city: '南昌市',
            district: '东湖区',
            detail: `批量取消${i}`,
            receiver: `收货人${i}`,
            phone: `1280012800${i}`
          }
        };

        const orderResponse = await agent
          .post('/api/v1/orders')
          .send(orderData)
          .asUser('normal');

        orders.push(orderResponse.body.data.order);
      }

      // 批量取消
      const response = await agent
        .post('/api/v1/orders/batch-cancel')
        .send({
          orderIds: orders.map(o => o.id),
          reason: '批量测试取消'
        })
        .asUser('normal');

      assert.apiResponse(response, 200);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data.results).toHaveLength(3);
    });
  });

  describe('9. 异常处理', () => {
    it('应该处理并发订单创建', async () => {
      const product = testDataSet.products[0];
      const promises = Array.from({ length: 10 }, () => {
        const orderData = {
          items: [
            {
              productId: product.id,
              quantity: 1
            }
          ],
          shippingAddress: {
            province: '云南省',
            city: '昆明市',
            district: '盘龙区',
            detail: '并发测试',
            receiver: '并发测试',
            phone: '12700127000'
          }
        };

        return agent
          .post('/api/v1/orders')
          .send(orderData)
          .asUser('normal');
      });

      const responses = await Promise.all(promises);

      // 检查是否有库存超卖
      const createdOrders = responses.filter(r => r.status === 201);
      expect(createdOrders.length).toBeLessThanOrEqual(product.totalStock);
    });

    it('应该恢复失败的订单操作', async () => {
      // 模拟支付中断
      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 1
          }
        ],
        shippingAddress: {
          province: '贵州省',
          city: '贵阳市',
          district: '南明区',
          detail: '事务测试',
          receiver: '事务测试',
          phone: '12600126000'
        }
      };

      const orderResponse = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      const orderId = orderResponse.body.data.order.id;

      // 尝试支付失败
      const invalidPayment = {
        orderId: orderId,
        amount: -100, // 无效金额
        paymentMethod: 'WECHAT'
      };

      await agent
        .post('/api/v1/payments/create')
        .send(invalidPayment)
        .asUser('normal');

      // 验证订单状态未被改变
      const orderStatusResponse = await agent
        .get(`/api/v1/orders/${orderId}`)
        .asUser('normal');

      expect(orderStatusResponse.body.data.order.status).toBe('PENDING');
    });
  });

  describe('10. 性能测试', () => {
    it('订单创建应该在合理时间内完成', async () => {
      const startTime = Date.now();

      const orderData = {
        items: [
          {
            productId: testDataSet.products[0].id,
            quantity: 1
          }
        ],
        shippingAddress: {
          province: '甘肃省',
          city: '兰州市',
          district: '城关区',
          detail: '性能测试',
          receiver: '性能测试',
          phone: '12500125000'
        }
      };

      const response = await agent
        .post('/api/v1/orders')
        .send(orderData)
        .asUser('normal');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // 2秒内完成
      assert.apiResponse(response, 201);
    });

    it('应该能够处理大量订单查询', async () => {
      // 先创建多个订单
      for (let i = 0; i < 20; i++) {
        await agent
          .post('/api/v1/orders')
          .send({
            items: [
              {
                productId: testDataSet.products[i % testDataSet.products.length].id,
                quantity: 1
              }
            ],
            shippingAddress: {
              province: '测试省',
              city: '测试市',
              district: '测试区',
              detail: `性能测试${i}`,
              receiver: `收货人${i}`,
              phone: `1240012400${i.toString().padStart(2, '0')}`
            }
          })
          .asUser('normal');
      }

      const startTime = Date.now();

      const response = await agent
        .get('/api/v1/orders')
        .query({ page: 1, perPage: 20 })
        .asUser('normal');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(3000); // 3秒内完成
      assert.apiResponse(response, 200);
      assert.paginatedResponse(response);
    });
  });
});