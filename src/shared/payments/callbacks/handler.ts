import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { NotifyData, PaymentStatus } from '../base/provider';
import { inventoryService } from '../../services/inventory';
import { commissionService } from '../../services/commission';

/**
 * 支付回调处理器
 */
export class PaymentCallbackHandler {
  /**
   * 处理支付成功回调
   */
  static async handlePaymentSuccess(notifyData: NotifyData): Promise<boolean> {
    const { orderId, providerOrderId, tradeStatus, totalAmount, paidAmount, paidAt } = notifyData;

    try {
      // 使用数据库事务确保数据一致性
      await prisma.$transaction(async (tx) => {
        // 1. 查询订单信息
        const order = await tx.orders.findUnique({
          where: { id: orderId },
          include: {
            items: true,
            paymentTransactions: true
          }
        });

        if (!order) {
          throw new Error(`订单不存在: ${orderId}`);
        }

        // 2. 检查订单状态是否允许更新
        if (order.status === 'PAID' || order.status === 'COMPLETED') {
          logger.warn('订单已支付，跳过处理', { orderId, providerOrderId });
          return;
        }

        if (order.status !== 'PENDING') {
          throw new Error(`订单状态不允许支付: ${order.status}`);
        }

        // 3. 验证支付金额
        const expectedAmount = parseFloat(order.totalAmount.toString());
        if (Math.abs((totalAmount || 0) - expectedAmount) > 0.01) {
          throw new Error(`支付金额不匹配: 期望 ${expectedAmount}, 实际 ${totalAmount}`);
        }

        // 4. 创建支付交易记录
        const paymentTransaction = await tx.paymentTransactions.create({
          data: {
            orderId,
            providerOrderId: providerOrderId || '',
            provider: this.determineProvider(order.paymentMethod),
            amount: totalAmount || expectedAmount,
            status: 'SUCCESS',
            paymentMethod: order.paymentMethod,
            transactionType: 'PAYMENT',
            transactionTime: paidAt || new Date(),
            rawData: notifyData.raw as any
          }
        });

        // 5. 更新订单状态
        await tx.orders.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
            paymentStatus: 'PAID',
            paidAt: paidAt || new Date(),
            providerOrderId: providerOrderId || '',
            lastPaymentTransactionId: paymentTransaction.id
          }
        });

        // 6. 处理库存扣减
        await this.handleInventoryReduction(tx, order);

        // 7. 处理佣金和积分奖励
        await this.handleCommissionAndRewards(tx, order);

        logger.info('支付成功处理完成', {
          orderId,
          providerOrderId,
          amount: totalAmount,
          transactionId: paymentTransaction.id
        });
      });

      return true;
    } catch (error) {
      logger.error('处理支付成功回调失败', {
        orderId,
        providerOrderId,
        error: error instanceof Error ? error.message : '未知错误',
        notifyData
      });
      throw error;
    }
  }

  /**
   * 处理支付失败回调
   */
  static async handlePaymentFailure(notifyData: NotifyData): Promise<boolean> {
    const { orderId, providerOrderId, tradeStatus } = notifyData;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. 查询订单信息
        const order = await tx.orders.findUnique({
          where: { id: orderId },
          include: {
            paymentTransactions: true
          }
        });

        if (!order) {
          throw new Error(`订单不存在: ${orderId}`);
        }

        // 2. 创建失败交易记录
        await tx.paymentTransactions.create({
          data: {
            orderId,
            providerOrderId: providerOrderId || '',
            provider: this.determineProvider(order.paymentMethod),
            amount: parseFloat(order.totalAmount.toString()),
            status: 'FAILED',
            paymentMethod: order.paymentMethod,
            transactionType: 'PAYMENT',
            transactionTime: new Date(),
            rawData: notifyData.raw as any
          }
        });

        // 3. 更新订单状态
        await tx.orders.update({
          where: { id: orderId },
          data: {
            status: 'FAILED',
            paymentStatus: 'FAILED',
            providerOrderId: providerOrderId || '',
            failureReason: tradeStatus
          }
        });

        logger.info('支付失败处理完成', {
          orderId,
          providerOrderId,
          status: tradeStatus
        });
      });

      return true;
    } catch (error) {
      logger.error('处理支付失败回调失败', {
        orderId,
        providerOrderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 处理退款成功回调
   */
  static async handleRefundSuccess(notifyData: NotifyData): Promise<boolean> {
    const { orderId, providerOrderId, totalAmount, paidAt } = notifyData;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. 查询退款记录
        const refundRecord = await tx.paymentRefunds.findFirst({
          where: {
            orderId,
            providerRefundId: providerOrderId
          }
        });

        if (!refundRecord) {
          throw new Error(`退款记录不存在: ${orderId}, ${providerOrderId}`);
        }

        // 2. 更新退款状态
        await tx.paymentRefunds.update({
          where: { id: refundRecord.id },
          data: {
            status: 'SUCCESS',
            processedAt: paidAt || new Date(),
            providerRefundId: providerOrderId
          }
        });

        // 3. 创建退款交易记录
        await tx.paymentTransactions.create({
          data: {
            orderId,
            providerOrderId: providerOrderId || '',
            provider: this.determineProvider(refundRecord.paymentMethod),
            amount: totalAmount || refundRecord.refundAmount,
            status: 'SUCCESS',
            paymentMethod: refundRecord.paymentMethod,
            transactionType: 'REFUND',
            transactionTime: paidAt || new Date(),
            rawData: notifyData.raw as any
          }
        });

        // 4. 处理库存恢复
        await this.handleInventoryRestoration(tx, refundRecord);

        // 5. 处理佣金回退
        await this.handleCommissionReversal(tx, refundRecord);

        logger.info('退款成功处理完成', {
          orderId,
          providerOrderId,
          refundAmount: totalAmount
        });
      });

      return true;
    } catch (error) {
      logger.error('处理退款成功回调失败', {
        orderId,
        providerOrderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 处理库存扣减
   * 使用优化的库存服务确保高并发安全
   */
  private static async handleInventoryReduction(tx: any, order: any): Promise<void> {
    try {
      for (const item of orderItems) {
        // 确定仓库类型和用户ID
        let warehouseType: any = 'PLATFORM';
        let userId = '';

        switch (order.type) {
          case 'RETAIL':
            warehouseType = 'LOCAL';
            userId = order.buyerId;
            break;
          case 'PURCHASE':
            warehouseType = 'CLOUD';
            userId = order.sellerId || '';
            break;
          case 'TEAM':
            warehouseType = 'PLATFORM';
            userId = '';
            break;
          default:
            warehouseType = 'PLATFORM';
            userId = '';
        }

        // 使用优化的库存服务确认扣减预留库存
        const result = await inventoryService.confirmReservedInventory(
          userId,
          item.productsId,
          item.skuId || '',
          item.quantity,
          warehouseType,
          order.id
        );

        if (!result.success) {
          throw new Error(`库存扣减失败: ${result.message}`);
        }

        logger.info('支付成功库存扣减完成', {
          orderId: order.id,
          productId: item.productsId,
          quantity: item.quantity,
          warehouseType
        });
      }
    } catch (error) {
      logger.error('处理库存扣减失败', {
        orderId: order.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 处理库存恢复
   */
  private static async handleInventoryRestoration(tx: any, refundRecord: any): Promise<void> {
    try {
      // 查询原订单的库存扣减记录
      const inventoryLogs = await tx.inventoryLog.findMany({
        where: {
          referenceId: refundRecord.orderId,
          referenceType: 'ORDER',
          changeType: 'OUT'
        }
      });

      for (const log of inventoryLogs) {
        // 恢复库存
        await tx.inventoryItem.updateMany({
          where: {
            productId: log.productsId,
            specId: log.specsId,
            warehouseType: log.warehouseType
          },
          data: {
            total: {
              increment: log.quantity
            },
            available: {
              increment: log.quantity
            }
          }
        });

        // 记录库存恢复流水
        await tx.inventoryLog.create({
          data: {
            productId: log.productsId,
            specId: log.specsId,
            warehouseType: log.warehouseType,
            changeType: 'IN',
            quantity: log.quantity,
            operatorType: 'SYSTEM',
            operatorId: 'payment_system',
            reason: `退款恢复库存 - 退款记录: ${refundRecord.id}`,
            referenceId: refundRecord.id,
            referenceType: 'REFUND'
          }
        });
      }
    } catch (error) {
      logger.error('处理库存恢复失败', {
        refundId: refundRecord.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 处理佣金和积分奖励
   */
  private static async handleCommissionAndRewards(tx: any, order: any): Promise<void> {
    try {
      // 1. 计算订单佣金
      const commissionParams = {
        orderId: order.id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        orderAmount: order.finalAmount,
        productCount: orderItems?.length || 0,
        orderType: order.type,
        commissionDetails: order.commissionDetails
      };

      // 异步计算佣金（不阻塞主流程）
      setImmediate(async () => {
        try {
          const commissionResults = await commissionService.calculateOrderCommission(commissionParams);
          logger.info('订单佣金计算完成', {
            orderId: order.id,
            resultsCount: commissionResults.length,
            totalCommission: commissionResults.reduce((sum, r) => sum + r.totalCommission, 0)
          });
        } catch (error) {
          logger.error('异步佣金计算失败', {
            orderId: order.id,
            error: error instanceof Error ? error.message : '未知错误'
          });
        }
      });

      // 2. 检查用户等级升级
      if (order.sellerId) {
        setImmediate(async () => {
          try {
            await this.checkUserLevelUpgrade(order.sellerId);
          } catch (error) {
            logger.error('检查用户等级升级失败', {
              userId: order.sellerId,
              orderId: order.id,
              error: error instanceof Error ? error.message : '未知错误'
            });
          }
        });
      }

      logger.info('佣金和奖励处理完成', { orderId: order.id });
    } catch (error) {
      logger.error('处理佣金和奖励失败', {
        orderId: order.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
      // 这里不应该抛出错误，避免影响主流程
    }
  }

  /**
   * 处理佣金回退
   */
  private static async handleCommissionReversal(tx: any, refundRecord: any): Promise<void> {
    try {
      // TODO: 实现佣金回退逻辑
      logger.info('佣金回退处理', { refundId: refundRecord.id });
    } catch (error) {
      logger.error('处理佣金回退失败', {
        refundId: refundRecord.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
      // 这里不应该抛出错误，避免影响主流程
    }
  }

  /**
   * 检查用户等级升级
   */
  private static async checkUserLevelUpgrade(userId: string): Promise<void> {
    try {
      // 导入用户等级服务
      const { UserLevelService } = await import('../../modules/user/level.service');
      const levelService = new UserLevelService();

      // 检查是否满足升级条件
      const upgradeCheck = await levelService.checkUpgradeConditions(userId);

      if (upgradeCheck.canUpgrade && upgradeCheck.nextLevel) {
        // 执行升级
        await levelService.upgradeUser(userId, upgradeCheck.nextLevel);

        // 处理升级奖励
        const { commissionService } = await import('../services/commission');
        await commissionService.processUpgradeReward(
          userId,
          upgradeCheck.nextLevel,
          upgradeCheck.currentLevel
        );

        logger.info('用户升级完成', {
          userId,
          fromLevel: upgradeCheck.currentLevel,
          toLevel: upgradeCheck.nextLevel
        });
      }
    } catch (error) {
      logger.error('检查用户等级升级失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 根据支付方式确定支付提供商
   */
  private static determineProvider(paymentMethod: string): string {
    if (paymentMethod.startsWith('WECHAT')) {
      return 'WECHAT';
    } else if (paymentMethod.startsWith('ALIPAY')) {
      return 'ALIPAY';
    } else if (paymentMethod === 'POINTS') {
      return 'POINTS';
    } else {
      return 'UNKNOWN';
    }
  }
}