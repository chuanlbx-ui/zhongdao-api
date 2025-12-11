import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../setup';
import { setupTestDatabase, cleanupTestDatabase } from '../../setup';

describe('端到端业务流程集成测试', () => {
  let directorUser: any;
  let managerUser: any;
  let vipUser: any;
  let normalUser: any;
  let testProduct: any;
  let testShop: any;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    // 清理测试数据
  });

  describe('完整用户注册-升级-开店流程', () => {
    it('should complete user lifecycle from registration to shop opening', async () => {
      // 1. 用户注册
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phone: '13800138888',
          password: 'Test123456',
          referrerPhone: '13800138887' // 推荐人
        })
        .expect(201);

      const userId = registerResponse.body.data.id;
      const authToken = registerResponse.body.data.token;

      // 2. 验证用户初始状态
      const userProfile = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(userProfile.body.data.level).toBe('NORMAL');
      expect(userProfile.body.data.parentPhone).toBe('13800138887');

      // 3. 充值积分（模拟）
      await request(app)
        .post('/api/v1/users/recharge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 10000,
          method: 'alipay'
        })
        .expect(201);

      // 4. 创建店铺
      const shopResponse = await request(app)
        .post('/api/v1/shops')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '测试店铺',
          type: 'CLOUD',
          description: '店铺描述',
          address: '测试地址'
        })
        .expect(201);

      testShop = shopResponse.body.data;
      expect(testShop.status).toBe('pending');

      // 5. 上架商品
      const productResponse = await request(app)
        .post('/api/v1/shops/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '测试商品',
          price: 100,
          categoryId: 'test-category',
          description: '商品描述',
          stock: 100
        })
        .expect(201);

      testProduct = productResponse.body.data;

      // 6. 完成首次购买（提升等级）
      const purchaseResponse = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [{
            productId: testProduct.id,
            quantity: 1,
            price: 100
          }],
          paymentMethod: 'points'
        })
        .expect(201);

      // 7. 完成支付
      await request(app)
        .post(`/api/v1/payments/${purchaseResponse.body.data.paymentId}/complete`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          method: 'points'
        })
        .expect(200);

      // 8. 验证用户升级
      const updatedProfile = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(['VIP', 'STAR_1'].includes(updatedProfile.body.data.level)).toBe(true);

      // 9. 店铺自动激活
      const updatedShop = await request(app)
        .get(`/api/v1/shops/${testShop.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedShop.body.data.status).toBe('active');

      // 10. 验证团队关系
      const teamStats = await request(app)
        .get('/api/v1/users/team/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(teamStats.body.data).toHaveProperty('parent');
      expect(teamStats.body.data).toHaveProperty('level');
    });

    it('should handle multi-level team building', async () => {
      // 创建多级用户结构
      const users = [];
      let currentPhone = '13900000000';

      // 5级用户结构
      for (let level = 0; level < 5; level++) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            phone: currentPhone,
            password: 'Test123456',
            referrerPhone: level > 0 ? users[level - 1].phone : null
          })
          .expect(201);

        users.push({
          phone: currentPhone,
          id: response.body.data.id,
          token: response.body.data.token,
          level: level
        });

        currentPhone = String(parseInt(currentPhone) + 1);
      }

      // 验证团队层级关系
      const topUser = users[0];
      const teamTree = await request(app)
        .get('/api/v1/users/team/tree')
        .set('Authorization', `Bearer ${topUser.token}`)
        .expect(200);

      expect(teamTree.body.data.depth).toBe(5);
      expect(teamTree.body.data.members.length).toBe(4); // 不包括自己

      // 验证佣金分配链
      const testOrder = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${users[4].token}`) // 最底层用户下单
        .send({
          items: [{
            productId: testProduct.id,
            quantity: 1,
            price: 1000
          }],
          paymentMethod: 'points'
        })
        .expect(201);

      // 检查佣金记录
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待佣金计算

      const commissionRecords = await Promise.all(
        users.slice(0, 4).map(user => // 排除下单者
          request(app)
            .get('/api/v1/users/commissions')
            .set('Authorization', `Bearer ${user.token}`)
        )
      );

      // 验证佣金逐级分配
      commissionRecords.forEach((record, index) => {
        if (record.status === 200) {
          expect(record.body.data.total).toBeGreaterThan(0);
          // 佣金应该逐级递减
          if (index > 0 && commissionRecords[index - 1].status === 200) {
            expect(record.body.data.total).toBeLessThanOrEqual(
              commissionRecords[index - 1].body.data.total
            );
          }
        }
      });
    });
  });

  describe('完整下单-支付-发货流程', () => {
    it('should complete order lifecycle from creation to delivery', async () => {
      // 1. 创建买家账号
      const buyerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          phone: '13700137777',
          password: 'Test123456'
        })
        .expect(201);

      const buyerToken = buyerResponse.body.data.token;

      // 2. 浏览商品
      const productList = await request(app)
        .get('/api/v1/products')
        .query({
          categoryId: testProduct.categoryId,
          minPrice: 50,
          maxPrice: 200
        })
        .expect(200);

      expect(productList.body.data.products.length).toBeGreaterThan(0);

      // 3. 加入购物车
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: testProduct.id,
          quantity: 2
        })
        .expect(201);

      // 4. 创建订单
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          items: [{
            productId: testProduct.id,
            quantity: 2,
            price: testProduct.price
          }],
          address: {
            province: '广东省',
            city: '深圳市',
            district: '南山区',
            detail: '科技园测试地址',
            zipCode: '518000'
          },
          paymentMethod: 'wechat',
          remark: '测试订单'
        })
        .expect(201);

      const order = orderResponse.body.data;
      expect(order.status).toBe('pending');
      expect(order.totalAmount).toBe(200);

      // 5. 创建支付
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          orderId: order.id,
          method: 'wechat',
          amount: order.totalAmount
        })
        .expect(201);

      const payment = paymentResponse.body.data;
      expect(payment.status).toBe('pending');

      // 6. 模拟支付成功回调
      await request(app)
        .post(`/api/v1/payments/${payment.id}/callback`)
        .send({
          transactionId: `wx_txn_${Date.now()}`,
          status: 'success',
          paidAt: new Date().toISOString(),
          signature: 'mock_signature'
        })
        .expect(200);

      // 7. 验证订单状态更新
      const updatedOrder = await request(app)
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(updatedOrder.body.data.status).toBe('paid');

      // 8. 库存扣减验证
      const updatedProduct = await request(app)
        .get(`/api/v1/products/${testProduct.id}`)
        .expect(200);

      expect(updatedProduct.body.data.stock).toBe(98); // 原始100 - 2

      // 9. 卖家发货
      const sellerToken = normalUser?.token || buyerToken;
      await request(app)
        .post(`/api/v1/orders/${order.id}/ship`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          trackingNumber: 'SF1234567890',
          carrier: '顺丰快递',
          shippedAt: new Date().toISOString()
        })
        .expect(200);

      // 10. 验证物流信息
      const logisticsInfo = await request(app)
        .get(`/api/v1/orders/${order.id}/logistics`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(logisticsInfo.body.data.trackingNumber).toBe('SF1234567890');

      // 11. 买家确认收货
      await request(app)
        .post(`/api/v1/orders/${order.id}/confirm`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          rating: 5,
          review: '商品很好，物流很快'
        })
        .expect(200);

      // 12. 订单完成验证
      const finalOrder = await request(app)
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(finalOrder.body.data.status).toBe('completed');
      expect(finalOrder.body.data.review.rating).toBe(5);

      // 13. 佣金到账验证（给卖家）
      if (sellerToken !== buyerToken) {
        const sellerBalance = await request(app)
          .get('/api/v1/users/balance')
          .set('Authorization', `Bearer ${sellerToken}`)
          .expect(200);

        expect(sellerBalance.body.data.available).toBeGreaterThan(0);
      }
    });

    it('should handle order cancellation and refund flow', async () => {
      // 1. 创建订单
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', userToken)
        .send({
          items: [{
            productId: testProduct.id,
            quantity: 1,
            price: 100
          }],
          paymentMethod: 'alipay'
        })
        .expect(201);

      const order = orderResponse.body.data;

      // 2. 支付订单
      const paymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', userToken)
        .send({
          orderId: order.id,
          method: 'alipay',
          amount: 100
        })
        .expect(201);

      // 3. 模拟支付成功
      await request(app)
        .post(`/api/v1/payments/${paymentResponse.body.data.id}/callback`)
        .send({
          transactionId: `ali_txn_${Date.now()}`,
          status: 'success'
        })
        .expect(200);

      // 4. 买家取消订单（在发货前）
      await request(app)
        .post(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', userToken)
        .send({
          reason: '不想买了'
        })
        .expect(200);

      // 5. 验证订单状态
      const cancelledOrder = await request(app)
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', userToken)
        .expect(200);

      expect(cancelledOrder.body.data.status).toBe('cancelled');

      // 6. 自动创建退款
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待退款创建

      const refunds = await request(app)
        .get('/api/v1/users/refunds')
        .set('Authorization', userToken)
        .expect(200);

      expect(refunds.body.data.refunds.length).toBeGreaterThan(0);
      expect(refunds.body.data.refunds[0].status).toBe('pending');

      // 7. 模拟退款成功
      const refundId = refunds.body.data.refunds[0].id;
      await request(app)
        .post(`/api/v1/admin/refunds/${refundId}/approve`)
        .set('Authorization', adminToken)
        .send({
          approved: true,
          remark: '同意退款'
        })
        .expect(200);

      // 8. 验证退款完成
      const updatedRefund = await request(app)
        .get(`/api/v1/refunds/${refundId}`)
        .set('Authorization', userToken)
        .expect(200);

      expect(updatedRefund.body.data.status).toBe('completed');

      // 9. 验证库存恢复
      const productAfterRefund = await request(app)
        .get(`/api/v1/products/${testProduct.id}`)
        .expect(200);

      // 库存应该恢复
      expect(productAfterRefund.body.data.stock).toBe(99);
    });
  });

  describe('完整佣金分配流程', () => {
    it('should distribute commission correctly through team levels', async () => {
      // 1. 创建5级团队
      const teamMembers = [];
      let referrerPhone = null;
      const baseCommissionRate = 0.1; // 10%基础佣金

      for (let i = 0; i < 5; i++) {
        const memberPhone = `1388888888${i}`;
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            phone: memberPhone,
            password: 'Test123456',
            referrerPhone
          })
          .expect(201);

        // 设置用户等级（模拟）
        await request(app)
          .patch(`/api/v1/users/${response.body.data.id}/level`)
          .set('Authorization', adminToken)
          .send({
            level: i === 0 ? 'DIRECTOR' : `STAR_${5 - i}`
          });

        teamMembers.push({
          phone: memberPhone,
          id: response.body.data.id,
          token: response.body.data.token,
          level: i === 0 ? 'DIRECTOR' : `STAR_${5 - i}`
        });

        referrerPhone = memberPhone;
      }

      // 2. 最底层用户创建大额订单
      const bottomMember = teamMembers[teamMembers.length - 1];
      const largeOrder = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${bottomMember.token}`)
        .send({
          items: [{
            productId: testProduct.id,
            quantity: 10,
            price: 1000
          }],
          paymentMethod: 'points'
        })
        .expect(201);

      const orderAmount = 10000;

      // 3. 完成支付
      const payment = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${bottomMember.token}`)
        .send({
          orderId: largeOrder.body.data.id,
          method: 'points',
          amount: orderAmount
        })
        .expect(201);

      await request(app)
        .post(`/api/v1/payments/${payment.body.data.id}/complete`)
        .set('Authorization', `Bearer ${bottomMember.token}`)
        .send({ method: 'points' })
        .expect(200);

      // 4. 等待佣金计算
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 5. 验证佣金分配
      const commissionChecks = await Promise.all(
        teamMembers.slice(0, -1).map(member => // 排除下单者
          request(app)
            .get('/api/v1/users/commissions')
            .query({ orderId: largeOrder.body.data.id })
            .set('Authorization', `Bearer ${member.token}`)
        )
      );

      // 6. 验证佣金比例正确
      commissionChecks.forEach((check, index) => {
        if (check.status === 200 && check.body.data.commissions.length > 0) {
          const commission = check.body.data.commissions[0];
          expect(commission.amount).toBeGreaterThan(0);
          expect(commission.orderId).toBe(largeOrder.body.data.id);

          // 上级佣金应该大于下级
          if (index > 0 && commissionChecks[index - 1].status === 200) {
            const prevCommission = commissionChecks[index - 1].body.data.commissions[0];
            expect(commission.amount).toBeLessThanOrEqual(prevCommission.amount);
          }
        }
      });

      // 7. 验证佣金结算
      const director = teamMembers[0];
      const withdrawal = await request(app)
        .post('/api/v1/users/withdrawal')
        .set('Authorization', `Bearer ${director.token}`)
        .send({
          amount: 1000, // 提取部分佣金
          method: 'alipay',
          account: 'director@example.com'
        })
        .expect(201);

      expect(withdrawal.body.data.status).toBe('pending');
    });
  });

  describe('库存同步测试', () => {
    it('should synchronize inventory across warehouses correctly', async () => {
      // 1. 创建多仓库商品
      const warehouseProduct = await request(app)
        .post('/api/v1/admin/products')
        .set('Authorization', adminToken)
        .send({
          name: '多仓库商品',
          price: 200,
          categoryId: 'test-category',
          warehouses: [
            { type: 'PLATFORM', stock: 1000 },
            { type: 'CLOUD', stock: 500 },
            { type: 'LOCAL', stock: 100 }
          ]
        })
        .expect(201);

      const productId = warehouseProduct.body.data.id;

      // 2. 创建多个订单消耗不同仓库库存
      const orders = await Promise.all([
        // 平台仓订单
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', userToken)
          .send({
            items: [{
              productId,
              quantity: 100,
              price: 200,
              warehouse: 'PLATFORM'
            }]
          }),
        // 云仓订单
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', userToken)
          .send({
            items: [{
              productId,
              quantity: 50,
              price: 200,
              warehouse: 'CLOUD'
            }]
          }),
        // 本地仓订单
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', userToken)
          .send({
            items: [{
              productId,
              quantity: 20,
              price: 200,
              warehouse: 'LOCAL'
            }]
          })
      ]);

      // 3. 完成所有支付
      const payments = await Promise.all(
        orders.map(order =>
          order.status === 201 ? request(app)
            .post('/api/v1/payments')
            .set('Authorization', userToken)
            .send({
              orderId: order.body.data.id,
              method: 'points',
              amount: order.body.data.totalAmount
            }) : null
        )
      );

      // 4. 验证库存同步
      const inventory = await request(app)
        .get(`/api/v1/products/${productId}/inventory`)
        .expect(200);

      const warehouses = inventory.body.data.warehouses;

      expect(warehouses.find(w => w.type === 'PLATFORM').stock).toBe(900);
      expect(warehouses.find(w => w.type === 'CLOUD').stock).toBe(450);
      expect(warehouses.find(w => w.type === 'LOCAL').stock).toBe(80);

      // 5. 测试仓库间调拨
      await request(app)
        .post('/api/v1/admin/inventory/transfer')
        .set('Authorization', adminToken)
        .send({
          productId,
          from: 'PLATFORM',
          to: 'CLOUD',
          quantity: 100,
          reason: '库存调拨'
        })
        .expect(200);

      // 6. 验证调拨后库存
      const updatedInventory = await request(app)
        .get(`/api/v1/products/${productId}/inventory`)
        .expect(200);

      const updatedWarehouses = updatedInventory.body.data.warehouses;

      expect(updatedWarehouses.find(w => w.type === 'PLATFORM').stock).toBe(800);
      expect(updatedWarehouses.find(w => w.type === 'CLOUD').stock).toBe(550);
      expect(updatedWarehouses.find(w => w.type === 'LOCAL').stock).toBe(80);

      // 7. 测试库存不足时的处理
      const lowStockOrder = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', userToken)
        .send({
          items: [{
            productId,
            quantity: 1000, // 超过本地仓库存
            price: 200,
            warehouse: 'LOCAL'
          }]
        });

      // 应该自动从其他仓库调货或返回错误
      expect([201, 400].includes(lowStockOrder.status)).toBe(true);
    });
  });

  describe('促销活动集成测试', () => {
    it('should apply discounts and promotions correctly', async () => {
      // 1. 创建促销活动
      const promotion = await request(app)
        .post('/api/v1/admin/promotions')
        .set('Authorization', adminToken)
        .send({
          name: '限时特惠',
          type: 'DISCOUNT',
          discount: 0.8, // 8折
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(), // 1小时后
          applicableProducts: [testProduct.id],
          minOrderAmount: 200
        })
        .expect(201);

      // 2. 创建优惠券
      const coupon = await request(app)
        .post('/api/v1/admin/coupons')
        .set('Authorization', adminToken)
        .send({
          name: '新用户优惠券',
          code: 'NEWUSER2024',
          type: 'FIXED',
          value: 50,
          minOrderAmount: 300,
          maxDiscount: 100,
          usageLimit: 100
        })
        .expect(201);

      // 3. 用户领取优惠券
      await request(app)
        .post('/api/v1/coupons/claim')
        .set('Authorization', userToken)
        .send({
          code: 'NEWUSER2024'
        })
        .expect(201);

      // 4. 创建符合优惠条件的订单
      const orderWithPromotion = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', userToken)
        .send({
          items: [{
            productId: testProduct.id,
            quantity: 5, // 500元，满足满减条件
            price: 100
          }],
          couponCode: 'NEWUSER2024',
          promotionId: promotion.body.data.id
        })
        .expect(201);

      // 5. 验证优惠计算
      const orderDetails = await request(app)
        .get(`/api/v1/orders/${orderWithPromotion.body.data.id}`)
        .set('Authorization', userToken)
        .expect(200);

      const originalAmount = 500;
      const promotionDiscount = originalAmount * 0.2; // 8折优惠100元
      const couponDiscount = 50;
      const expectedFinalAmount = originalAmount - promotionDiscount - couponDiscount; // 350元

      expect(orderDetails.body.data.originalAmount).toBe(originalAmount);
      expect(orderDetails.body.data.promotionDiscount).toBe(promotionDiscount);
      expect(orderDetails.body.data.couponDiscount).toBe(couponDiscount);
      expect(orderDetails.body.data.finalAmount).toBe(expectedFinalAmount);

      // 6. 验证优惠使用记录
      const couponUsage = await request(app)
        .get('/api/v1/users/coupons')
        .set('Authorization', userToken)
        .expect(200);

      const usedCoupon = couponUsage.body.data.coupons.find(
        c => c.code === 'NEWUSER2024'
      );
      expect(usedCoupon.status).toBe('used');
    });
  });
});