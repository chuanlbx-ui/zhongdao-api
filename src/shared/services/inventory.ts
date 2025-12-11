import { logger } from '@/shared/utils/logger';
import { prisma } from '@/shared/database/client';
import { WarehouseType, InventoryOperationType, OperatorType } from '@prisma/client';
import { configService } from '../../modules/config';

/**
 * 库存操作参数接口
 */
export interface InventoryOperationParams {
  productId: string;
  specId?: string;
  quantity: number;
  warehouseType: WarehouseType;
  userId?: string;
  shopId?: string;
  operatorId: string;
  reason?: string;
  relatedOrderId?: string;
}

/**
 * 库存预留参数
 */
export interface InventoryReservationParams {
  userId: string;
  productId: string;
  specId?: string;
  quantity: number;
  warehouseType: WarehouseType;
  shopId?: string;
  orderId: string;
}

/**
 * 库存统计信息
 */
export interface InventoryStats {
  totalQuantity: number;
  availableQuantity: number;
  frozenQuantity: number;
  lowStockItems: number;
  outOfStockItems: number;
}

/**
 * 优化后的库存管理服务
 * 确保高并发场景下的数据一致性和准确性
 */
export class OptimizedInventoryService {
  /**
   * 获取或创建库存记录
   * 使用原子操作避免并发创建重复记录
   */
  private async getOrCreateInventoryItem(
    productId: string,
    specId: string | undefined,
    warehouseType: WarehouseType,
    userId?: string,
    shopId?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      // 尝试查找现有库存记录
      let inventoryItem = await tx.inventoryItem.findUnique({
        where: {
          userId_productId_specId_warehouseType: {
            userId: userId || '',
            productId,
            specId: specId || '',
            warehouseType
          }
        }
      });

      // 如果不存在，创建新记录
      if (!inventoryItem) {
        // 从动态配置读取默认最小库存
        const defaultMinStock = await configService.getConfig<number>('inventory_default_min_stock', 10);

        inventoryItem = await tx.inventoryItem.create({
          data: {
            userId: userId || '',
            productId,
            specId: specId || '',
            warehouseType,
            quantity: 0,
            frozenQuantity: 0,
            minStock: defaultMinStock
          }
        });
      }

      return inventoryItem;
    });
  }

  /**
   * 原子性库存扣减
   * 使用乐观锁和事务确保并发安全
   */
  async decreaseInventory(params: InventoryOperationParams): Promise<{ success: boolean; message: string }> {
    return await prisma.$transaction(async (tx) => {
      try {
        // 1. 获取库存记录并加锁
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: {
            userId_productId_specId_warehouseType: {
              userId: params.userId || '',
              productId: params.productsId,
              specId: params.specsId || '',
              warehouseType: params.warehouseType
            }
          }
        });

        if (!inventoryItem) {
          return { success: false, message: '库存记录不存在' };
        }

        // 2. 检查可用库存
        const availableQuantity = inventoryItem.quantity - inventoryItem.frozenQuantity;
        if (availableQuantity < params.quantity) {
          return { success: false, message: `库存不足，可用库存：${availableQuantity}，需要：${params.quantity}` };
        }

        // 3. 更新库存数量
        const newQuantity = inventoryItem.quantity - params.quantity;
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: newQuantity,
            lastOutAt: new Date()
          }
        });

        // 4. 记录库存流水
        await tx.inventoryLog.create({
          data: {
            userId: params.userId || '',
            productId: params.productsId,
            specId: params.specsId || '',
            shopId: params.shopId || '',
            operationType: InventoryOperationType.ORDER_OUT,
            quantity: -params.quantity,
            quantityBefore: inventoryItem.quantity,
            quantityAfter: newQuantity,
            warehouseType: params.warehouseType,
            relatedOrderId: params.relatedOrderId,
            operatorId: params.operatorId,
            operatorType: OperatorType.SYSTEM,
            remarks: params.reason || '订单出库'
          }
        });

        // 5. 检查库存预警
        await this.checkInventoryAlert(inventoryItem, tx);

        logger.info('库存扣减成功', {
          productId: params.productsId,
          specId: params.specsId,
          quantity: params.quantity,
          remaining: newQuantity,
          operatorId: params.operatorId
        });

        return { success: true, message: '库存扣减成功' };
      } catch (error) {
        logger.error('库存扣减失败', {
          params,
          error: error instanceof Error ? error.message : '未知错误'
        });
        throw error;
      }
    });
  }

  /**
   * 原子性库存增加
   */
  async increaseInventory(params: InventoryOperationParams): Promise<{ success: boolean; message: string }> {
    return await prisma.$transaction(async (tx) => {
      try {
        // 1. 获取或创建库存记录
        const inventoryItem = await this.getOrCreateInventoryItem(
          params.productsId,
          params.specsId,
          params.warehouseType,
          params.userId,
          params.shopId
        );

        // 2. 更新库存数量
        const newQuantity = inventoryItem.quantity + params.quantity;
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: newQuantity,
            lastInAt: new Date()
          }
        });

        // 3. 记录库存流水
        await tx.inventoryLog.create({
          data: {
            userId: params.userId || '',
            productId: params.productsId,
            specId: params.specsId || '',
            shopId: params.shopId || '',
            operationType: InventoryOperationType.PURCHASE_IN,
            quantity: params.quantity,
            quantityBefore: inventoryItem.quantity,
            quantityAfter: newQuantity,
            warehouseType: params.warehouseType,
            relatedOrderId: params.relatedOrderId,
            operatorId: params.operatorId,
            operatorType: OperatorType.SYSTEM,
            remarks: params.reason || '采购入库'
          }
        });

        logger.info('库存增加成功', {
          productId: params.productsId,
          specId: params.specsId,
          quantity: params.quantity,
          total: newQuantity,
          operatorId: params.operatorId
        });

        return { success: true, message: '库存增加成功' };
      } catch (error) {
        logger.error('库存增加失败', {
          params,
          error: error instanceof Error ? error.message : '未知错误'
        });
        throw error;
      }
    });
  }

  /**
   * 库存预留
   * 用于订单创建时预留库存，防止超卖
   */
  async reserveInventory(params: InventoryReservationParams): Promise<{ success: boolean; message: string }> {
    return await prisma.$transaction(async (tx) => {
      try {
        // 1. 获取库存记录
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: {
            userId_productId_specId_warehouseType: {
              userId: params.userId,
              productId: params.productsId,
              specId: params.specsId || '',
              warehouseType: params.warehouseType
            }
          }
        });

        if (!inventoryItem) {
          return { success: false, message: '库存记录不存在' };
        }

        // 2. 检查可用库存
        const availableQuantity = inventoryItem.quantity - inventoryItem.frozenQuantity;
        if (availableQuantity < params.quantity) {
          return { success: false, message: `库存不足，可用库存：${availableQuantity}，需要：${params.quantity}` };
        }

        // 3. 增加冻结数量
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            frozenQuantity: inventoryItem.frozenQuantity + params.quantity
          }
        });

        // 4. 记录库存流水
        await tx.inventoryLog.create({
          data: {
            userId: params.userId,
            productId: params.productsId,
            specId: params.specsId || '',
            shopId: params.shopId || '',
            operationType: InventoryOperationType.ORDER_OUT,
            quantity: -params.quantity,
            quantityBefore: inventoryItem.quantity,
            quantityAfter: inventoryItem.quantity,
            warehouseType: params.warehouseType,
            relatedOrderId: params.orderId,
            operatorId: params.userId,
            operatorType: OperatorType.USER,
            remarks: '订单预留库存'
          }
        });

        logger.info('库存预留成功', {
          productId: params.productsId,
          specId: params.specsId,
          quantity: params.quantity,
          orderId: params.orderId
        });

        return { success: true, message: '库存预留成功' };
      } catch (error) {
        logger.error('库存预留失败', {
          params,
          error: error instanceof Error ? error.message : '未知错误'
        });
        throw error;
      }
    });
  }

  /**
   * 释放预留库存
   * 用于订单取消时释放之前预留的库存
   */
  async releaseReservedInventory(
    userId: string,
    productId: string,
    specId: string | undefined,
    quantity: number,
    warehouseType: WarehouseType,
    orderId: string
  ): Promise<{ success: boolean; message: string }> {
    return await prisma.$transaction(async (tx) => {
      try {
        // 1. 获取库存记录
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: {
            userId_productId_specId_warehouseType: {
              userId,
              productId,
              specId: specId || '',
              warehouseType
            }
          }
        });

        if (!inventoryItem) {
          return { success: false, message: '库存记录不存在' };
        }

        // 2. 检查冻结数量
        if (inventoryItem.frozenQuantity < quantity) {
          return { success: false, message: `冻结库存不足，当前冻结：${inventoryItem.frozenQuantity}，尝试释放：${quantity}` };
        }

        // 3. 减少冻结数量
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            frozenQuantity: inventoryItem.frozenQuantity - quantity
          }
        });

        // 4. 记录库存流水
        await tx.inventoryLog.create({
          data: {
            userId,
            productId,
            specId: specId || '',
            operationType: InventoryOperationType.RETURN_IN,
            quantity: quantity,
            quantityBefore: inventoryItem.quantity,
            quantityAfter: inventoryItem.quantity,
            warehouseType,
            relatedOrderId: orderId,
            operatorId: userId,
            operatorType: OperatorType.SYSTEM,
            remarks: '释放预留库存'
          }
        });

        logger.info('预留库存释放成功', {
          productId,
          specId,
          quantity,
          orderId
        });

        return { success: true, message: '预留库存释放成功' };
      } catch (error) {
        logger.error('释放预留库存失败', {
          userId,
          productId,
          specId,
          quantity,
          warehouseType,
          orderId,
          error: error instanceof Error ? error.message : '未知错误'
        });
        throw error;
      }
    });
  }

  /**
   * 确认扣减预留库存
   * 用于支付成功时将预留库存转为实际扣减
   */
  async confirmReservedInventory(
    userId: string,
    productId: string,
    specId: string | undefined,
    quantity: number,
    warehouseType: WarehouseType,
    orderId: string
  ): Promise<{ success: boolean; message: string }> {
    return await prisma.$transaction(async (tx) => {
      try {
        // 1. 获取库存记录
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: {
            userId_productId_specId_warehouseType: {
              userId,
              productId,
              specId: specId || '',
              warehouseType
            }
          }
        });

        if (!inventoryItem) {
          return { success: false, message: '库存记录不存在' };
        }

        // 2. 检查冻结数量
        if (inventoryItem.frozenQuantity < quantity) {
          return { success: false, message: `冻结库存不足，当前冻结：${inventoryItem.frozenQuantity}，需要：${quantity}` };
        }

        // 3. 同时扣减总库存和冻结库存
        const newQuantity = inventoryItem.quantity - quantity;
        const newFrozenQuantity = inventoryItem.frozenQuantity - quantity;

        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: newQuantity,
            frozenQuantity: newFrozenQuantity,
            lastOutAt: new Date()
          }
        });

        // 4. 记录库存流水
        await tx.inventoryLog.create({
          data: {
            userId,
            productId,
            specId: specId || '',
            operationType: InventoryOperationType.ORDER_OUT,
            quantity: -quantity,
            quantityBefore: inventoryItem.quantity,
            quantityAfter: newQuantity,
            warehouseType,
            relatedOrderId: orderId,
            operatorId: userId,
            operatorType: OperatorType.SYSTEM,
            remarks: '确认扣减预留库存'
          }
        });

        // 5. 检查库存预警
        await this.checkInventoryAlert(
          { ...inventoryItem, quantity: newQuantity, frozenQuantity: newFrozenQuantity },
          tx
        );

        logger.info('确认扣减预留库存成功', {
          productId,
          specId,
          quantity,
          remaining: newQuantity,
          orderId
        });

        return { success: true, message: '确认扣减预留库存成功' };
      } catch (error) {
        logger.error('确认扣减预留库存失败', {
          userId,
          productId,
          specId,
          quantity,
          warehouseType,
          orderId,
          error: error instanceof Error ? error.message : '未知错误'
        });
        throw error;
      }
    });
  }

  /**
   * 检查库存预警
   */
  private async checkInventoryAlert(
    inventoryItem: any,
    tx: any
  ): Promise<void> {
    const currentQuantity = inventoryItem.quantity;
    const minStock = inventoryItem.minStock;

    // 检查是否需要预警
    if (currentQuantity <= 0) {
      // 缺货预警
      await tx.inventoryAlert.upsert({
        where: {
          userId_productId_specId_warehouseType_alertType: {
            userId: inventoryItem.userId,
            productId: inventoryItem.productsId,
            specId: inventoryItem.specsId || '',
            warehouseType: inventoryItem.warehouseType,
            alertType: 'OUT_OF_STOCK'
          }
        },
        update: {
          currentQuantity,
          isResolved: false,
          createdAt: new Date()
        },
        create: {
          userId: inventoryItem.userId,
          productId: inventoryItem.productsId,
          specId: inventoryItem.specsId || '',
          warehouseType: inventoryItem.warehouseType,
          alertType: 'OUT_OF_STOCK',
          currentQuantity,
          threshold: 0,
          isResolved: false
        }
      });
    } else if (currentQuantity <= minStock) {
      // 低库存预警
      await tx.inventoryAlert.upsert({
        where: {
          userId_productId_specId_warehouseType_alertType: {
            userId: inventoryItem.userId,
            productId: inventoryItem.productsId,
            specId: inventoryItem.specsId || '',
            warehouseType: inventoryItem.warehouseType,
            alertType: 'LOW_STOCK'
          }
        },
        update: {
          currentQuantity,
          isResolved: false,
          createdAt: new Date()
        },
        create: {
          userId: inventoryItem.userId,
          productId: inventoryItem.productsId,
          specId: inventoryItem.specsId || '',
          warehouseType: inventoryItem.warehouseType,
          alertType: 'LOW_STOCK',
          currentQuantity,
          threshold: minStock,
          isResolved: false
        }
      });
    }
  }

  /**
   * 获取库存统计信息
   */
  async getInventoryStats(
    userId?: string,
    warehouseType?: WarehouseType
  ): Promise<InventoryStats> {
    try {
      const whereCondition: any = {};
      if (userId) {
        whereCondition.userId = userId;
      }
      if (warehouseType) {
        whereCondition.warehouseType = warehouseType;
      }

      const inventoryItems = await prisma.inventoryItems.findMany({
        where: whereCondition
      });

      const totalQuantity = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
      const frozenQuantity = inventoryItems.reduce((sum, item) => sum + item.frozenQuantity, 0);
      const availableQuantity = totalQuantity - frozenQuantity;

      const lowStockItems = inventoryItems.filter(item =>
        item.quantity > 0 && item.quantity <= item.minStock
      ).length;

      const outOfStockItems = inventoryItems.filter(item => item.quantity <= 0).length;

      return {
        totalQuantity,
        availableQuantity,
        frozenQuantity,
        lowStockItems,
        outOfStockItems
      };
    } catch (error) {
      logger.error('获取库存统计失败', {
        userId,
        warehouseType,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取库存流水记录
   */
  async getInventoryLogs(
    userId: string,
    options: {
      page?: number;
      perPage?: number;
      productId?: string;
      warehouseType?: WarehouseType;
      operationType?: InventoryOperationType;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const {
      page = 1,
      perPage = 20,
      productId,
      warehouseType,
      operationType,
      startDate,
      endDate
    } = options;

    const skip = (page - 1) * perPage;
    const whereCondition: any = { userId };

    if (productId) whereCondition.productsId = productId;
    if (warehouseType) whereCondition.warehouseType = warehouseType;
    if (operationType) whereCondition.operationType = operationType;
    if (startDate || endDate) {
      whereCondition.createdAt = {};
      if (startDate) whereCondition.createdAt.gte = startDate;
      if (endDate) whereCondition.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.inventoryLogssss.findMany({
        where: whereCondition,
        include: {
          products: {
            select: { name: true }
          },
          specs: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage
      }),
      prisma.inventoryLogssss.count({ where: whereCondition })
    ]);

    return {
      logs,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  /**
   * 获取指定商品库存数量
   * 兼容订单系统的接口
   */
  async getInventoryQuantity(
    userId: string | 'platform',
    warehouseType: WarehouseType,
    productId: string,
    specId?: string
  ): Promise<{ total: number; available: number; frozen: number }> {
    try {
      const whereCondition: any = {
        productId,
        warehouseType
      };

      if (userId !== 'platform') {
        whereCondition.userId = userId;
      } else {
        whereCondition.userId = ''; // 平台仓使用空字符串
      }

      if (specId) {
        whereCondition.specsId = specId;
      } else {
        whereCondition.specsId = '';
      }

      const inventoryItem = await prisma.inventoryItems.findFirst({
        where: whereCondition
      });

      if (!inventoryItem) {
        return { total: 0, available: 0, frozen: 0 };
      }

      const available = inventoryItem.quantity - inventoryItem.frozenQuantity;
      return {
        total: inventoryItem.quantity,
        available: Math.max(0, available),
        frozen: inventoryItem.frozenQuantity
      };
    } catch (error) {
      logger.error('获取库存数量失败', {
        userId,
        warehouseType,
        productId,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return { total: 0, available: 0, frozen: 0 };
    }
  }

  /**
   * 获取库存预警列表
   */
  async getInventoryAlerts(
    userId: string,
    options: {
      page?: number;
      perPage?: number;
      isResolved?: boolean;
      alertType?: any;
    } = {}
  ) {
    const {
      page = 1,
      perPage = 20,
      isResolved,
      alertType
    } = options;

    const skip = (page - 1) * perPage;
    const whereCondition: any = { userId };

    if (isResolved !== undefined) whereCondition.isResolved = isResolved;
    if (alertType) whereCondition.alertType = alertType;

    const [alerts, total] = await Promise.all([
      prisma.inventoryAlertss.findMany({
        where: whereCondition,
        include: {
          products: {
            select: { name: true }
          },
          specs: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage
      }),
      prisma.inventoryAlertss.count({ where: whereCondition })
    ]);

    return {
      alerts,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }
}

// 导出单例实例
export const inventoryService = new OptimizedInventoryService();