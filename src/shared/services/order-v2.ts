import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import { sagaEngine, CommonSagas, SagaDefinition } from '../workflows/saga-engine';
import { ruleManager } from '../rules';
import { eventBus } from '../services/event-bus';
import { cacheService } from '../services/cache';
import { OrderType, OrderStatus, PaymentStatus, PaymentMethod, CreateOrderParams, OrderValidationResult } from '../types/order';
import { UserLevel } from '../../modules/user/level.service';

/**
 * 订单服务 V2 - 使用Saga模式和规则引擎
 * 确保订单处理的事务一致性和业务灵活性
 */

export interface OrderCreationSagaData {
  orderId?: string;
  orderNo?: string;
  buyerId: string;
  sellerId?: string;
  items: Array<{
    productId: string;
    skuId: string;
    quantity: number;
  }>;
  orderType: OrderType;
  paymentMethod?: PaymentMethod;
  pointsAmount?: number;
  shippingAddress?: any;
  buyerNotes?: string;
  metadata?: Record<string, any>;
}

export interface OrderCreationResult {
  success: boolean;
  order?: any;
  error?: string;
  sagaInstanceId?: string;
}

export class OrderServiceV2 {
  private cachePrefix = 'order:v2:';
  private cacheTTL = 5 * 60; // 5分钟

  constructor() {
    this.registerOrderSaga();
  }

  /**
   * 创建订单 - 使用Saga确保一致性
   */
  async createOrder(params: CreateOrderParams): Promise<OrderCreationResult> {
    const sagaData: OrderCreationSagaData = {
      buyerId: params.buyerId,
      sellerId: params.sellerId,
      items: params.items,
      orderType: params.type,
      paymentMethod: params.paymentMethod,
      pointsAmount: params.pointsAmount,
      shippingAddress: params.shippingAddress,
      buyerNotes: params.buyerNotes,
      metadata: params.metadata
    };

    try {
      logger.info('开始创建订单Saga', {
        buyerId: params.buyerId,
        orderType: params.type,
        itemsCount: params.items.length
      });

      // 执行订单创建Saga
      const sagaResult = await sagaEngine.executeSaga(
        'order_creation',
        sagaData,
        {
          timeout: 60000 // 60秒超时
        }
      );

      if (sagaResult.status === 'COMPLETED') {
        const order = await this.getOrderById(sagaData.orderId!);

        logger.info('订单创建成功', {
          orderId: order?.id,
          orderNo: order?.orderNo,
          sagaInstanceId: sagaResult.sagaId
        });

        return {
          success: true,
          order,
          sagaInstanceId: sagaResult.sagaId
        };
      } else {
        logger.error('订单创建Saga失败', {
          sagaInstanceId: sagaResult.sagaId,
          status: sagaResult.status,
          error: sagaResult.error
        });

        return {
          success: false,
          error: sagaResult.error || '订单创建失败',
          sagaInstanceId: sagaResult.sagaId
        };
      }
    } catch (error) {
      logger.error('创建订单异常', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '创建失败'
      };
    }
  }

  /**
   * 订单支付 - 使用Saga确保一致性
   */
  async processPayment(
    orderId: string,
    paymentMethod: PaymentMethod,
    paymentData: any = {}
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    try {
      // 获取订单信息
      const order = await this.getOrderById(orderId);
      if (!order) {
        return { success: false, error: '订单不存在' };
      }

      if (order.paymentStatus !== PaymentStatus.UNPAID) {
        return { success: false, error: '订单已支付或状态异常' };
      }

      // 创建支付Saga数据
      const paymentSagaData = {
        orderId,
        orderNo: order.orderNo,
        amount: order.finalAmount,
        paymentMethod,
        buyerId: order.buyerId,
        ...paymentData
      };

      // 执行支付Saga
      const sagaResult = await sagaEngine.executeSaga('order_payment', paymentSagaData);

      if (sagaResult.status === 'COMPLETED') {
        logger.info('订单支付成功', {
          orderId,
          paymentId: paymentSagaData.paymentId,
          amount: order.finalAmount
        });

        return {
          success: true,
          paymentId: paymentSagaData.paymentId
        };
      } else {
        logger.error('订单支付失败', {
          orderId,
          sagaInstanceId: sagaResult.sagaId,
          error: sagaResult.error
        });

        return {
          success: false,
          error: sagaResult.error || '支付失败'
        };
      }
    } catch (error) {
      logger.error('处理支付异常', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '支付异常'
      };
    }
  }

  /**
   * 取消订单 - 使用Saga确保补偿
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    operatorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await this.getOrderById(orderId);
      if (!order) {
        return { success: false, error: '订单不存在' };
      }

      // 检查订单是否可取消
      if (![OrderStatus.PENDING, OrderStatus.PAID].includes(order.status)) {
        return { success: false, error: '订单状态不允许取消' };
      }

      // 创建取消Saga数据
      const cancelSagaData = {
        orderId,
        orderNo: order.orderNo,
        reason,
        operatorId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        items: order.items
      };

      // 执行取消Saga
      const sagaResult = await sagaEngine.executeSaga('order_cancellation', cancelSagaData);

      if (sagaResult.status === 'COMPLETED') {
        logger.info('订单取消成功', {
          orderId,
          reason,
          operatorId
        });

        return { success: true };
      } else {
        logger.error('订单取消失败', {
          orderId,
          sagaInstanceId: sagaResult.sagaId,
          error: sagaResult.error
        });

        return {
          success: false,
          error: sagaResult.error || '取消失败'
        };
      }
    } catch (error) {
      logger.error('取消订单异常', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '取消异常'
      };
    }
  }

  /**
   * 完成订单 - 使用Saga处理后续流程
   */
  async completeOrder(orderId: string, operatorId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await this.getOrderById(orderId);
      if (!order) {
        return { success: false, error: '订单不存在' };
      }

      if (order.status !== OrderStatus.SHIPPED) {
        return { success: false, error: '订单状态不允许完成' };
      }

      // 创建完成Saga数据
      const completeSagaData = {
        orderId,
        orderNo: order.orderNo,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        totalAmount: order.finalAmount,
        operatorId: operatorId || 'system',
        items: order.items
      };

      // 执行完成Saga
      const sagaResult = await sagaEngine.executeSaga('order_completion', completeSagaData);

      if (sagaResult.status === 'COMPLETED') {
        logger.info('订单完成成功', {
          orderId,
          operatorId
        });

        return { success: true };
      } else {
        logger.error('订单完成失败', {
          orderId,
          sagaInstanceId: sagaResult.sagaId,
          error: sagaResult.error
        });

        return {
          success: false,
          error: sagaResult.error || '完成失败'
        };
      }
    } catch (error) {
      logger.error('完成订单异常', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '完成异常'
      };
    }
  }

  /**
   * 获取订单详情（带缓存）
   */
  async getOrderById(orderId: string): Promise<any | null> {
    const cacheKey = `${this.cachePrefix}order:${orderId}`;

    // 尝试从缓存获取
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          paymentRecords: true,
          logistics: true,
          buyer: {
            select: { id: true, nickname: true, level: true }
          },
          seller: {
            select: { id: true, nickname: true, level: true }
          }
        }
      });

      if (order) {
        const formattedOrder = this.formatOrder(order);

        // 缓存结果
        await cacheService.set(cacheKey, formattedOrder, this.cacheTTL);

        return formattedOrder;
      }

      return null;
    } catch (error) {
      logger.error('获取订单详情失败', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }

  /**
   * 批量获取订单状态
   */
  async batchGetOrderStatus(orderIds: string[]): Promise<Map<string, OrderStatus>> {
    const results = new Map<string, OrderStatus>();

    // 批量查询数据库
    const orders = await prisma.orders.findMany({
      where: { id: { in: orderIds } },
      select: { id: true, status: true }
    });

    orders.forEach(order => {
      results.set(order.id, order.status as OrderStatus);
    });

    return results;
  }

  /**
   * 重新执行失败的Saga
   */
  async retryFailedSaga(sagaInstanceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 获取Saga状态
      const sagaStatus = await sagaEngine.getExecutionStatus(sagaInstanceId);
      if (!sagaStatus) {
        return { success: false, error: 'Saga实例不存在' };
      }

      if (sagaStatus.status !== 'FAILED') {
        return { success: false, error: 'Saga状态不是失败' };
      }

      // 补偿之前的执行
      await sagaEngine.compensateSaga(sagaInstanceId);

      // 重新执行
      const sagaType = sagaStatus.metadata.sagaDefinitionId;
      const newResult = await sagaEngine.executeSaga(sagaType, sagaStatus.data);

      return { success: newResult.status === 'COMPLETED' };
    } catch (error) {
      logger.error('重试Saga失败', {
        sagaInstanceId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '重试失败'
      };
    }
  }

  // ========== 私有方法 ==========

  /**
   * 注册订单相关的Saga
   */
  private registerOrderSaga(): void {
    // 订单创建Saga
    sagaEngine.registerSaga({
      id: 'order_creation',
      name: '订单创建流程',
      description: '处理订单创建、库存预留等流程',
      steps: [
        {
          id: 'validate_order',
          name: '验证订单',
          execute: async (context) => {
            // 使用规则引擎验证订单
            const validationResult = await this.validateOrderWithRules(context.data);

            if (!validationResult.isValid) {
              throw new Error(`订单验证失败：${validationResult.reasons.join(', ')}`);
            }

            context.data.validation = validationResult;
            return { success: true };
          }
        },
        {
          id: 'generate_order',
          name: '生成订单',
          execute: async (context) => {
            const orderData = context.data;
            const orderNo = this.generateOrderNo(orderData.orderType);

            // 创建订单记录
            const order = await prisma.orders.create({
              data: {
                orderNo,
                type: orderData.orderType,
                status: OrderStatus.PENDING,
                buyerId: orderData.buyerId,
                sellerId: orderData.sellerId,
                paymentStatus: PaymentStatus.UNPAID,
                paymentMethod: orderData.paymentMethod,
                buyerNotes: orderData.buyerNotes,
                shippingAddress: orderData.shippingAddress ? JSON.stringify(orderData.shippingAddress) : null,
                metadata: orderData.metadata ? JSON.stringify(orderData.metadata) : null
              }
            });

            context.data.orderId = order.id;
            context.data.orderNo = orderNo;

            return {
              success: true,
              compensable: true,
              data: { orderId: order.id, orderNo }
            };
          },
          compensate: async (context) => {
            // 删除订单记录
            if (context.data.orderId) {
              await prisma.orders.delete({
                where: { id: context.data.orderId }
              });
            }
            return { success: true };
          }
        },
        {
          id: 'create_order_items',
          name: '创建订单项',
          execute: async (context) => {
            const orderData = context.data;
            const items = await this.processOrderItems(orderData);

            // 批量创建订单项
            await prisma.orderItem.createMany({
              data: items.map(item => ({
                orderId: context.data.orderId,
                ...item
              }))
            });

            context.data.processedItems = items;

            return {
              success: true,
              compensable: true,
              data: { items }
            };
          },
          compensate: async (context) => {
            // 删除订单项
            if (context.data.orderId) {
              await prisma.orderItem.deleteMany({
                where: { orderId: context.data.orderId }
              });
            }
            return { success: true };
          }
        },
        {
          id: 'reserve_inventory',
          name: '预留库存',
          execute: async (context) => {
            const orderData = context.data;

            // 预留库存（根据订单类型）
            for (const item of orderData.items) {
              await this.reserveInventoryForOrder(
                orderData.orderType,
                orderData.buyerId,
                orderData.sellerId,
                item.productId,
                item.skuId,
                item.quantity
              );
            }

            return {
              success: true,
              compensable: true,
              data: { reservedItems: orderData.items }
            };
          },
          compensate: async (context) => {
            // 释放预留的库存
            if (context.data.reservedItems) {
              for (const item of context.data.reservedItems) {
                await this.releaseInventoryForOrder(
                  context.data.orderType,
                  context.data.buyerId,
                  context.data.sellerId,
                  item.productId,
                  item.skuId,
                  item.quantity
                );
              }
            }
            return { success: true };
          }
        },
        {
          id: 'calculate_pricing',
          name: '计算价格',
          execute: async (context) => {
            const pricing = await this.calculateOrderPricing(context.data);

            // 更新订单价格信息
            await prisma.orders.update({
              where: { id: context.data.orderId },
              data: {
                totalAmount: pricing.totalAmount,
                discountAmount: pricing.discountAmount,
                shippingFee: pricing.shippingFee,
                finalAmount: pricing.finalAmount,
                pointsAmount: pricing.pointsAmount,
                cashAmount: pricing.cashAmount
              }
            });

            context.data.pricing = pricing;

            return {
              success: true,
              data: pricing
            };
          }
        }
      ]
    });

    // 订单支付Saga
    sagaEngine.registerSaga({
      id: 'order_payment',
      name: '订单支付流程',
      description: '处理订单支付流程',
      steps: [
        {
          id: 'validate_payment',
          name: '验证支付',
          execute: async (context) => {
            // 验证支付信息
            const order = await prisma.orders.findUnique({
              where: { id: context.data.orderId }
            });

            if (!order || order.paymentStatus !== PaymentStatus.UNPAID) {
              throw new Error('订单状态异常');
            }

            context.data.order = order;
            return { success: true };
          }
        },
        {
          id: 'process_payment',
          name: '处理支付',
          execute: async (context) => {
            const paymentData = context.data;

            // 这里应该调用支付服务
            const paymentResult = await this.processPaymentMethod(
              paymentData.paymentMethod,
              paymentData.amount,
              paymentData
            );

            context.data.paymentId = paymentResult.paymentId;
            context.data.transactionId = paymentResult.transactionId;

            return {
              success: true,
              compensable: true,
              data: paymentResult
            };
          },
          compensate: async (context) => {
            // 退款
            if (context.data.paymentId) {
              await this.refundPayment(context.data.paymentId, context.data.amount);
            }
            return { success: true };
          }
        },
        {
          id: 'update_payment_status',
          name: '更新支付状态',
          execute: async (context) => {
            await prisma.orders.update({
              where: { id: context.data.orderId },
              data: {
                paymentStatus: PaymentStatus.PAID,
                paidAt: new Date(),
                status: OrderStatus.CONFIRMED
              }
            });

            // 创建支付记录
            await prisma.paymentRecord.create({
              data: {
                orderId: context.data.orderId,
                paymentMethod: context.data.paymentMethod,
                amount: context.data.amount,
                transactionId: context.data.transactionId,
                status: 'SUCCESS',
                paidAt: new Date()
              }
            });

            return { success: true };
          }
        },
        {
          id: 'trigger_commission',
          name: '触发佣金计算',
          execute: async (context) => {
            // 触发佣金计算
            const { commissionServiceV2 } = await import('./commission-v2');
            await commissionServiceV2.calculateOrderCommission({
              orderId: context.data.orderId,
              sellerId: context.data.order.sellerId,
              orderAmount: context.data.order.finalAmount,
              orderType: context.data.order.type
            });

            return { success: true };
          }
        }
      ]
    });

    // 订单取消Saga
    sagaEngine.registerSaga({
      id: 'order_cancellation',
      name: '订单取消流程',
      description: '处理订单取消和补偿',
      steps: [
        {
          id: 'update_order_status',
          name: '更新订单状态',
          execute: async (context) => {
            await prisma.orders.update({
              where: { id: context.data.orderId },
              data: {
                status: OrderStatus.CANCELLED,
                cancelledAt: new Date(),
                sellerNotes: context.data.reason
              }
            });

            return { success: true };
          }
        },
        {
          id: 'refund_payment',
          name: '退款',
          execute: async (context) => {
            if (context.data.paymentStatus === PaymentStatus.PAID) {
              // 查找支付记录
              const payment = await prisma.paymentRecord.findFirst({
                where: { orderId: context.data.orderId }
              });

              if (payment) {
                await this.refundPayment(payment.transactionId, payment.amount);
              }
            }

            return { success: true };
          }
        },
        {
          id: 'release_inventory',
          name: '释放库存',
          execute: async (context) => {
            // 获取订单信息
            const order = await prisma.orders.findUnique({
              where: { id: context.data.orderId },
              include: { items: true }
            });

            if (order) {
              // 释放库存
              for (const item of context.data.items) {
                await this.releaseInventoryForOrder(
                  order.type,
                  order.buyerId,
                  order.sellerId,
                  item.productId,
                  item.skuId,
                  item.quantity
                );
              }
            }

            return { success: true };
          }
        }
      ]
    });

    // 订单完成Saga
    sagaEngine.registerSaga({
      id: 'order_completion',
      name: '订单完成流程',
      description: '处理订单完成和后续流程',
      steps: [
        {
          id: 'update_order_status',
          name: '更新订单状态',
          execute: async (context) => {
            await prisma.orders.update({
              where: { id: context.data.orderId },
              data: {
                status: OrderStatus.COMPLETED,
                completedAt: new Date()
              }
            });

            return { success: true };
          }
        },
        {
          id: 'update_user_stats',
          name: '更新用户统计',
          execute: async (context) => {
            // 更新买方统计
            await this.updateUserPurchaseStats(
              context.data.buyerId,
              context.data.totalAmount
            );

            return { success: true };
          }
        },
        {
          id: 'check_user_upgrade',
          name: '检查用户升级',
          execute: async (context) => {
            // 检查并触发用户升级
            const { userLevelServiceV2 } = await import('../../modules/user/level.service.v2');
            const upgradeCheck = await userLevelServiceV2.checkUpgradeConditions(
              context.data.buyerId
            );

            if (upgradeCheck.canUpgrade) {
              await userLevelServiceV2.executeUserUpgrade({
                userId: context.data.buyerId,
                autoApprove: true
              });
            }

            return { success: true };
          }
        }
      ]
    });

    logger.info('订单Saga注册完成');
  }

  /**
   * 使用规则引擎验证订单
   */
  private async validateOrderWithRules(orderData: any): Promise<OrderValidationResult> {
    try {
      const context = {
        orderData,
        buyerId: orderData.buyerId,
        sellerId: orderData.sellerId,
        orderType: orderData.orderType
      };

      // 执行订单验证规则
      const ruleResults = await ruleManager.executeRulesByCategory(
        'ORDER' as any,
        context
      );

      const isValid = ruleResults.every(result => result.success);
      const reasons = ruleResults
        .filter(result => !result.success)
        .map(result => result.message || '验证失败');

      return {
        isValid,
        canCreate: isValid,
        reasons
      };
    } catch (error) {
      logger.error('订单验证失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        isValid: false,
        canCreate: false,
        reasons: ['验证过程中发生错误']
      };
    }
  }

  /**
   * 处理订单项
   */
  private async processOrderItems(orderData: any): Promise<any[]> {
    const items = [];

    for (const item of orderData.items) {
      // 获取产品信息
      const product = await prisma.products.findUnique({
        where: { id: item.productId },
        include: {
          sku: {
            where: { id: item.skuId },
            include: { product: true }
          }
        }
      });

      if (!product || !product.sku[0]) {
        throw new Error(`产品不存在: ${item.productId}`);
      }

      const sku = product.sku[0];
      const originalPrice = sku.price;

      // 应用折扣
      let unitPrice = originalPrice;
      if (orderData.orderType === 'PURCHASE') {
        const user = await prisma.users.findUnique({
          where: { id: orderData.buyerId },
          select: { level: true }
        });

        if (user) {
          const discountRate = this.getUserDiscountRate(user.level as UserLevel);
          unitPrice = originalPrice * discountRate;
        }
      }

      const totalPrice = unitPrice * item.quantity;
      const discountAmount = (originalPrice - unitPrice) * item.quantity;

      items.push({
        productId: item.productId,
        skuId: item.skuId,
        productName: product.name,
        productImage: product.images?.[0],
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        discountAmount,
        finalPrice: totalPrice,
        metadata: {
          originalPrice,
          category: product.category
        }
      });
    }

    return items;
  }

  /**
   * 预留库存
   */
  private async reserveInventoryForOrder(
    orderType: string,
    buyerId: string,
    sellerId: string | undefined,
    productId: string,
    skuId: string,
    quantity: number
  ): Promise<void> {
    // 根据订单类型预留不同的库存
    if (orderType === 'PURCHASE' && sellerId) {
      // 采购订单预留卖方云仓库存
      await prisma.productSKU.update({
        where: { id: skuId },
        data: {
          reservedStock: { increment: quantity }
        }
      });
    }
    // 其他订单类型的库存处理逻辑
  }

  /**
   * 释放库存
   */
  private async releaseInventoryForOrder(
    orderType: string,
    buyerId: string,
    sellerId: string | undefined,
    productId: string,
    skuId: string,
    quantity: number
  ): Promise<void> {
    // 释放预留的库存
    await prisma.productSKU.update({
      where: { id: skuId },
      data: {
        reservedStock: { decrement: quantity }
      }
    });
  }

  /**
   * 处理支付
   */
  private async processPaymentMethod(
    method: PaymentMethod,
    amount: number,
    data: any
  ): Promise<{ paymentId: string; transactionId: string }> {
    // 这里应该调用具体的支付服务
    const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 模拟支付处理
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      paymentId,
      transactionId
    };
  }

  /**
   * 退款
   */
  private async refundPayment(transactionId: string, amount: number): Promise<void> {
    // 这里应该调用退款服务
    logger.info('处理退款', { transactionId, amount });
  }

  /**
   * 计算订单定价
   */
  private async calculateOrderPricing(orderData: any): Promise<any> {
    // 计算总金额
    const totalAmount = orderData.processedItems?.reduce(
      (sum: number, item: any) => sum + item.finalPrice,
      0
    ) || 0;

    // 计算折扣
    const discountAmount = orderData.processedItems?.reduce(
      (sum: number, item: any) => sum + item.discountAmount,
      0
    ) || 0;

    // 计算运费
    const shippingFee = totalAmount >= 200 ? 0 : 10;

    // 应用积分抵扣
    let finalPointsAmount = 0;
    let finalCashAmount = totalAmount + shippingFee;

    if (orderData.pointsAmount && orderData.paymentMethod === PaymentMethod.POINTS) {
      finalPointsAmount = Math.min(orderData.pointsAmount, finalCashAmount);
      finalCashAmount -= finalPointsAmount;
    }

    const finalAmount = finalCashAmount;

    return {
      totalAmount,
      discountAmount,
      shippingFee,
      finalAmount,
      pointsAmount: finalPointsAmount,
      cashAmount: finalCashAmount
    };
  }

  /**
   * 更新用户购买统计
   */
  private async updateUserPurchaseStats(userId: string, amount: number): Promise<void> {
    await prisma.userStats.upsert({
      where: { userId },
      update: {
        totalPurchases: { increment: amount },
        purchaseCount: { increment: 1 },
        lastPurchaseAt: new Date()
      },
      create: {
        userId,
        totalPurchases: amount,
        purchaseCount: 1,
        lastPurchaseAt: new Date()
      }
    });
  }

  /**
   * 生成订单号
   */
  private generateOrderNo(type: OrderType): string {
    const prefix = {
      [OrderType.RETAIL]: 'RO',
      [OrderType.PURCHASE]: 'PO',
      [OrderType.TEAM]: 'TO',
      [OrderType.EXCHANGE]: 'EO'
    }[type];

    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  /**
   * 获取用户折扣率
   */
  private getUserDiscountRate(level: UserLevel): number {
    const rates = {
      [UserLevel.NORMAL]: 1.0,
      [UserLevel.VIP]: 0.5,
      [UserLevel.STAR_1]: 0.45,
      [UserLevel.STAR_2]: 0.4,
      [UserLevel.STAR_3]: 0.35,
      [UserLevel.STAR_4]: 0.3,
      [UserLevel.STAR_5]: 0.25,
      [UserLevel.DIRECTOR]: 0.2
    };
    return rates[level] || 1.0;
  }

  /**
   * 格式化订单数据
   */
  private formatOrder(order: any): any {
    return {
      id: order.id,
      orderNo: order.orderNo,
      type: order.type,
      status: order.status,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      finalAmount: order.finalAmount,
      pointsAmount: order.pointsAmount,
      cashAmount: order.cashAmount,
      items: order.orderItems || order.items,
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : undefined,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentRecords: order.paymentRecords || [],
      logistics: order.logistics,
      buyerNotes: order.buyerNotes,
      sellerNotes: order.sellerNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      metadata: order.metadata ? JSON.parse(order.metadata) : undefined
    };
  }
}

// 导出单例实例
export const orderServiceV2 = new OrderServiceV2();