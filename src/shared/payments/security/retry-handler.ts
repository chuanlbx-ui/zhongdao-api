/**
 * 支付重试处理器
 * 处理支付失败时的重试、回滚和补偿机制
 */

import { logger } from '../../utils/logger';
import { prisma } from '../../database/client';
import { CommissionService } from '../../services/commission';
import { inventoryService } from '../../services/inventory';
import { NotifyData } from '../base/provider';
import { EventEmitter } from 'events';

/**
 * 重试配置
 */
interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // 基础延迟（毫秒）
  maxDelay: number; // 最大延迟（毫秒）
  backoffMultiplier: number; // 退避倍数
  jitter: boolean; // 是否添加随机抖动
}

/**
 * 重试任务
 */
interface RetryTask {
  id: string;
  type: 'PAYMENT_PROCESS' | 'COMMISSION_CALC' | 'INVENTORY_ADJUST' | 'REFUND_PROCESS';
  data: any;
  attempt: number;
  maxRetries: number;
  nextRetryAt: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 补偿记录
 */
interface CompensationRecord {
  id: string;
  orderId: string;
  transactionId?: string;
  type: 'ROLLBACK_ORDER' | 'REFUND_PAYMENT' | 'ADJUST_INVENTORY' | 'CANCEL_COMMISSION';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  reason: string;
  data: any;
  createdAt: Date;
  processedAt?: Date;
}

/**
 * 支付重试处理器
 */
export class PaymentRetryHandler extends EventEmitter {
  private retryQueue: Map<string, RetryTask> = new Map();
  private retryConfig: RetryConfig;
  private isProcessing = false;

  constructor(config?: Partial<RetryConfig>) {
    super();
    this.retryConfig = {
      maxRetries: 5,
      retryDelay: 1000, // 1秒
      maxDelay: 60000, // 1分钟
      backoffMultiplier: 2,
      jitter: true,
      ...config
    };

    // 启动重试处理器
    this.startRetryProcessor();
  }

  /**
   * 添加重试任务
   */
  async addRetryTask(
    type: RetryTask['type'],
    data: any,
    options?: { maxRetries?: number; delay?: number }
  ): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task: RetryTask = {
      id: taskId,
      type,
      data,
      attempt: 0,
      maxRetries: options?.maxRetries || this.retryConfig.maxRetries,
      nextRetryAt: new Date(Date.now() + (options?.delay || this.retryConfig.retryDelay)),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.retryQueue.set(taskId, task);

    // 持久化到数据库
    await this.persistRetryTask(task);

    logger.info('添加重试任务', {
      taskId,
      type,
      data,
      nextRetryAt: task.nextRetryAt
    });

    return taskId;
  }

  /**
   * 创建补偿记录
   */
  async createCompensation(
    orderId: string,
    type: CompensationRecord['type'],
    reason: string,
    data: any
  ): Promise<string> {
    const recordId = `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const record: CompensationRecord = {
      id: recordId,
      orderId,
      transactionId: data.transactionId,
      type,
      status: 'PENDING',
      reason,
      data,
      createdAt: new Date()
    };

    // 保存到数据库
    await prisma.paymentCompensation.create({
      data: {
        id: record.id,
        orderId: record.orderId,
        transactionId: record.transactionId,
        type: record.type,
        status: record.status,
        reason: record.reason,
        data: JSON.stringify(record.data),
        createdAt: record.createdAt
      }
    });

    logger.warn('创建补偿记录', {
      recordId,
      orderId,
      type,
      reason
    });

    // 触发补偿处理
    this.processCompensation(record);

    return recordId;
  }

  /**
   * 处理支付失败
   */
  async handlePaymentFailure(
    orderId: string,
    error: Error,
    paymentData?: NotifyData
  ): Promise<void> {
    logger.error('处理支付失败', {
      orderId,
      error: error.message,
      paymentData
    });

    try {
      // 1. 查询订单信息
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) {
        logger.error('订单不存在', { orderId });
        return;
      }

      // 2. 创建补偿记录
      await this.createCompensation(
        orderId,
        'ROLLBACK_ORDER',
        `支付失败: ${error.message}`,
        {
          orderStatus: order.status,
          paymentData,
          error: error.message
        }
      );

      // 3. 如果已经扣减库存，需要回滚
      if (order.status === 'PAID') {
        await this.rollbackInventory(order);
      }

      // 4. 如果已经计算佣金，需要取消
      if (order.status === 'PAID') {
        await this.cancelCommission(order);
      }

      // 5. 更新订单状态
      await prisma.orders.update({
        where: { id: orderId },
        data: {
          status: 'FAILED',
          paymentStatus: 'FAILED',
          failureReason: error.message,
          updatedAt: new Date()
        }
      });

      // 6. 发送告警
      this.emit('payment_failure', {
        orderId,
        error: error.message,
        order
      });

    } catch (rollbackError) {
      logger.error('处理支付失败回滚时发生错误', {
        orderId,
        originalError: error.message,
        rollbackError: rollbackError instanceof Error ? rollbackError.message : '未知错误'
      });

      // 创建紧急任务进行后续处理
      await this.addRetryTask('ROLLBACK_ORDER', {
        orderId,
        error: error.message,
        rollbackError: rollbackError instanceof Error ? rollbackError.message : '未知错误'
      }, { maxRetries: 10 });
    }
  }

  /**
   * 回滚库存
   */
  private async rollbackInventory(order: any): Promise<void> {
    logger.info('回滚库存', { orderId: order.id });

    // 查询库存扣减记录
    const inventoryLogs = await prisma.inventoryLog.findMany({
      where: {
        referenceId: order.id,
        referenceType: 'ORDER',
        changeType: 'OUT'
      }
    });

    for (const log of inventoryLogs) {
      try {
        // 恢复库存
        await inventoryService.adjustInventory(
          log.productsId,
          log.specsId || '',
          log.quantity,
          'IN',
          'SYSTEM',
          `支付失败回滚: ${order.id}`,
          {
            referenceId: order.id,
            referenceType: 'ROLLBACK'
          }
        );
      } catch (error) {
        logger.error('恢复库存失败', {
          productId: log.productsId,
          quantity: log.quantity,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }
  }

  /**
   * 取消佣金
   */
  private async cancelCommission(order: any): Promise<void> {
    logger.info('取消佣金计算', { orderId: order.id });

    // 查询已计算的佣金
    const commissions = await prisma.commissionCalculations.findMany({
      where: {
        orderId: order.id,
        status: 'PENDING'
      }
    });

    for (const commission of commissions) {
      try {
        await prisma.commissionCalculations.update({
          where: { id: commission.id },
          data: {
            status: 'CANCELLED',
            updatedAt: new Date()
          }
        });
      } catch (error) {
        logger.error('取消佣金失败', {
          commissionId: commission.id,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }
  }

  /**
   * 处理补偿
   */
  private async processCompensation(record: CompensationRecord): Promise<void> {
    logger.info('处理补偿', { recordId: record.id, type: record.type });

    try {
      // 更新状态为处理中
      await prisma.paymentCompensation.update({
        where: { id: record.id },
        data: {
          status: 'PROCESSING',
          processedAt: new Date()
        }
      });

      // 根据类型处理补偿
      switch (record.type) {
        case 'ROLLBACK_ORDER':
          await this.processRollbackOrder(record);
          break;
        case 'REFUND_PAYMENT':
          await this.processRefundPayment(record);
          break;
        case 'ADJUST_INVENTORY':
          await this.processAdjustInventory(record);
          break;
        case 'CANCEL_COMMISSION':
          await this.processCancelCommission(record);
          break;
      }

      // 更新状态为已完成
      await prisma.paymentCompensation.update({
        where: { id: record.id },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      });

      logger.info('补偿处理完成', { recordId: record.id });

    } catch (error) {
      logger.error('补偿处理失败', {
        recordId: record.id,
        error: error instanceof Error ? error.message : '未知错误'
      });

      // 更新状态为失败
      await prisma.paymentCompensation.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          updatedAt: new Date()
        }
      });

      // 添加重试任务
      await this.addRetryTask('COMPENSATION', record, { delay: 30000 });
    }
  }

  /**
   * 处理订单回滚
   */
  private async processRollbackOrder(record: CompensationRecord): Promise<void> {
    const data = record.data as any;
    const orderId = record.orderId;

    // 更新订单状态
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED',
        updatedAt: new Date()
      }
    });

    // 如果有支付交易记录，也需要更新
    if (data.transactionId) {
      await prisma.paymentTransactions.updateMany({
        where: {
          orderId,
          status: 'SUCCESS'
        },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      });
    }
  }

  /**
   * 处理退款
   */
  private async processRefundPayment(record: CompensationRecord): Promise<void> {
    // TODO: 调用退款接口
    logger.info('执行退款', { recordId: record.id });
  }

  /**
   * 处理库存调整
   */
  private async processAdjustInventory(record: CompensationRecord): Promise<void> {
    const data = record.data as any;

    await inventoryService.adjustInventory(
      data.productId,
      data.skuId || '',
      data.quantity,
      data.changeType,
      'SYSTEM',
      `补偿调整: ${record.reason}`,
      {
        compensationId: record.id
      }
    );
  }

  /**
   * 处理佣金取消
   */
  private async processCancelCommission(record: CompensationRecord): Promise<void> {
    // 取消所有相关的待处理佣金
    await prisma.commissionCalculations.updateMany({
      where: {
        orderId: record.orderId,
        status: 'PENDING'
      },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });
  }

  /**
   * 启动重试处理器
   */
  private startRetryProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing) {
        return;
      }

      this.isProcessing = true;

      try {
        const now = new Date();
        const tasksToRetry: RetryTask[] = [];

        // 查找需要重试的任务
        for (const [taskId, task] of this.retryQueue.entries()) {
          if (task.nextRetryAt <= now && task.attempt < task.maxRetries) {
            tasksToRetry.push(task);
          }
        }

        // 处理重试任务
        for (const task of tasksToRetry) {
          await this.processRetryTask(task);
        }

      } catch (error) {
        logger.error('重试处理器异常', {
          error: error instanceof Error ? error.message : '未知错误'
        });
      } finally {
        this.isProcessing = false;
      }
    }, 5000); // 每5秒检查一次
  }

  /**
   * 处理重试任务
   */
  private async processRetryTask(task: RetryTask): Promise<void> {
    logger.info('处理重试任务', {
      taskId: task.id,
      type: task.type,
      attempt: task.attempt + 1
    });

    try {
      // 更新任务
      task.attempt++;
      task.updatedAt = new Date();

      let success = false;

      // 根据任务类型处理
      switch (task.type) {
        case 'PAYMENT_PROCESS':
          success = await this.retryPaymentProcess(task.data);
          break;
        case 'COMMISSION_CALC':
          success = await this.retryCommissionCalc(task.data);
          break;
        case 'INVENTORY_ADJUST':
          success = await this.retryInventoryAdjust(task.data);
          break;
        case 'REFUND_PROCESS':
          success = await this.retryRefundProcess(task.data);
          break;
        case 'COMPENSATION':
          success = await this.retryCompensation(task.data);
          break;
      }

      if (success) {
        // 成功则移除任务
        this.retryQueue.delete(task.id);
        await this.removeRetryTask(task.id);
        logger.info('重试任务成功', { taskId: task.id });
      } else {
        // 失败则安排下次重试
        if (task.attempt >= task.maxRetries) {
          // 达到最大重试次数，移除任务并发送告警
          this.retryQueue.delete(task.id);
          await this.removeRetryTask(task.id);

          this.emit('retry_exhausted', {
            taskId: task.id,
            type: task.type,
            data: task.data,
            attempts: task.attempt
          });

          logger.error('重试任务达到最大次数', {
            taskId: task.id,
            type: task.type,
            attempts: task.attempt
          });
        } else {
          // 计算下次重试时间
          const delay = this.calculateRetryDelay(task.attempt);
          task.nextRetryAt = new Date(Date.now() + delay);

          // 更新数据库
          await this.updateRetryTask(task);
        }
      }

    } catch (error) {
      logger.error('处理重试任务失败', {
        taskId: task.id,
        error: error instanceof Error ? error.message : '未知错误'
      });

      // 安排下次重试
      if (task.attempt < task.maxRetries) {
        const delay = this.calculateRetryDelay(task.attempt);
        task.nextRetryAt = new Date(Date.now() + delay);
        await this.updateRetryTask(task);
      }
    }
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(attempt: number): number {
    let delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, this.retryConfig.maxDelay);

    // 添加随机抖动
    if (this.retryConfig.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  // 重试方法实现
  private async retryPaymentProcess(data: any): Promise<boolean> {
    // TODO: 实现支付处理重试
    return false;
  }

  private async retryCommissionCalc(data: any): Promise<boolean> {
    try {
      const commissionService = new CommissionService();
      await commissionService.calculateOrderCommission(data);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async retryInventoryAdjust(data: any): Promise<boolean> {
    // TODO: 实现库存调整重试
    return false;
  }

  private async retryRefundProcess(data: any): Promise<boolean> {
    // TODO: 实现退款处理重试
    return false;
  }

  private async retryCompensation(data: any): Promise<boolean> {
    await this.processCompensation(data);
    return true;
  }

  // 数据库操作方法
  private async persistRetryTask(task: RetryTask): Promise<void> {
    try {
      await prisma.paymentRetryTask.create({
        data: {
          id: task.id,
          type: task.type,
          data: JSON.stringify(task.data),
          attempt: task.attempt,
          maxRetries: task.maxRetries,
          nextRetryAt: task.nextRetryAt,
          lastError: task.lastError,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        }
      });
    } catch (error) {
      logger.error('持久化重试任务失败', {
        taskId: task.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  private async updateRetryTask(task: RetryTask): Promise<void> {
    try {
      await prisma.paymentRetryTask.update({
        where: { id: task.id },
        data: {
          attempt: task.attempt,
          nextRetryAt: task.nextRetryAt,
          lastError: task.lastError,
          updatedAt: task.updatedAt
        }
      });
    } catch (error) {
      logger.error('更新重试任务失败', {
        taskId: task.id,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  private async removeRetryTask(taskId: string): Promise<void> {
    try {
      await prisma.paymentRetryTask.delete({
        where: { id: taskId }
      });
    } catch (error) {
      logger.error('删除重试任务失败', {
        taskId,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
}

// 创建全局实例
export const paymentRetryHandler = new PaymentRetryHandler();

// 监听事件
paymentRetryHandler.on('payment_failure', (data) => {
  logger.warn('支付失败事件', data);

  // 发送告警
  // TODO: 集成告警系统
});

paymentRetryHandler.on('retry_exhausted', (data) => {
  logger.error('重试耗尽事件', data);

  // 发送紧急告警
  // TODO: 集成告警系统
});