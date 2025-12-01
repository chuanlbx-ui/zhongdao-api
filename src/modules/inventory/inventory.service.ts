// @ts-nocheck
import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import {
  WarehouseType,
  InventoryOperationType,
  OperatorType,
  AdjustmentType,
  AlertLevel,
  AlertStatus,
  InventoryStock,
  InventoryLog,
  InventoryAlert,
  ManualInParams,
  ManualOutParams,
  TransferParams,
  DamageParams,
  InventoryAdjustmentResult,
  InventoryStatistics,
  InventoryLogQuery,
  InventoryQuery,
  AlertQuery,
  PurchaseInParams,
  OrderOutParams
} from './types';

/**
 * 库存管理服务类
 * 负责管理平台总仓、店长云仓、店长本地仓的三级库存体系
 */
export class InventoryService {
  /**
   * 生成批次号
   */
  private generateBatchNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `B${timestamp}${random}`.toUpperCase();
  }

  /**
   * 获取或创建库存记录
   */
  private async getOrCreateStock(
    productId: string,
    specId: string,
    warehouseType: WarehouseType,
    userId?: string,
    shopId?: string,
    batchNumber?: string
  ): Promise<InventoryStock> {
    try {
      // 先查找现有库存
      let stock = await prisma.inventoryStock.findFirst({
        where: {
          productId,
          specId,
          warehouseType,
          userId: userId || null,
          shopId: shopId || null,
          batchNumber: batchNumber || null
        }
      });

      // 如果不存在，创建新库存记录
      if (!stock) {
        stock = await prisma.inventoryStock.create({
          data: {
            productId,
            specId,
            warehouseType,
            userId: userId || null,
            shopId: shopId || null,
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            batchNumber: batchNumber || null,
            location: this.getDefaultLocation(warehouseType)
          }
        });
      }

      return stock as InventoryStock;
    } catch (error) {
      logger.error('获取或创建库存记录失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取默认库位
   */
  private getDefaultLocation(warehouseType: WarehouseType): string {
    switch (warehouseType) {
      case WarehouseType.PLATFORM:
        return 'PLATFORM-DEFAULT';
      case WarehouseType.CLOUD:
        return 'CLOUD-DEFAULT';
      case WarehouseType.LOCAL:
        return 'LOCAL-DEFAULT';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * 创建库存流水记录
   */
  private async createInventoryLog(
    operationType: InventoryOperationType,
    quantity: number,
    quantityBefore: number,
    quantityAfter: number,
    warehouseType: WarehouseType,
    productId: string,
    specId: string,
    operatorType: OperatorType,
    operatorId?: string,
    userId?: string,
    shopId?: string,
    batchNumber?: string,
    relatedOrderId?: string,
    relatedPurchaseId?: string,
    adjustmentReason?: string,
    remarks?: string
  ): Promise<InventoryLog> {
    try {
      const log = await prisma.inventoryLog.create({
        data: {
          operationType,
          quantity,
          quantityBefore,
          quantityAfter,
          warehouseType,
          userId: userId || null,
          shopId: shopId || null,
          productId,
          specId,
          batchNumber: batchNumber || null,
          relatedOrderId: relatedOrderId || null,
          relatedPurchaseId: relatedPurchaseId || null,
          adjustmentReason: adjustmentReason || null,
          operatorType,
          operatorId: operatorId || null,
          remarks: remarks || null
        },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              phone: true,
              level: true
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              code: true,
              sku: true
            }
          },
          spec: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          },
          shop: {
            select: {
              id: true,
              shopName: true,
              shopType: true
            }
          },
          operator: {
            select: {
              id: true,
              nickname: true,
              phone: true,
              level: true
            }
          }
        }
      });

      return log as InventoryLog;
    } catch (error) {
      logger.error('创建库存流水记录失败', {
        operationType,
        quantity,
        warehouseType,
        productId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 更新库存数量
   */
  private async updateStockQuantity(
    stock: InventoryStock,
    quantityChange: number,
    operationType: InventoryOperationType
  ): Promise<InventoryStock> {
    try {
      const newQuantity = stock.quantity + quantityChange;

      if (newQuantity < 0) {
        throw new Error('库存数量不能为负数');
      }

      const updatedStock = await prisma.inventoryStock.update({
        where: { id: stock.id },
        data: {
          quantity: newQuantity,
          availableQuantity: newQuantity - stock.reservedQuantity,
          updatedAt: new Date()
        }
      });

      return updatedStock as InventoryStock;
    } catch (error) {
      logger.error('更新库存数量失败', {
        stockId: stock.id,
        quantityChange,
        operationType,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 检查库存预警
   */
  private async checkInventoryAlert(
    productId: string,
    specId: string,
    warehouseType: WarehouseType,
    userId?: string,
    shopId?: string
  ): Promise<void> {
    try {
      // 获取商品规格的预警阈值
      const spec = await prisma.productSpec.findUnique({
        where: { id: specId },
        select: {
          lowStockThreshold: true,
          outOfStockThreshold: true
        }
      });

      if (!spec) {
        return;
      }

      // 获取当前库存
      const stock = await this.getStock(
        productId,
        specId,
        warehouseType,
        userId,
        shopId
      );

      if (!stock) {
        return;
      }

      const currentStock = stock.quantity;
      let alertLevel: AlertLevel | null = null;

      // 判断预警级别
      if (currentStock <= 0) {
        alertLevel = AlertLevel.OUT_OF_STOCK;
      } else if (currentStock <= (spec.outOfStockThreshold || 0)) {
        alertLevel = AlertLevel.CRITICAL;
      } else if (currentStock <= (spec.lowStockThreshold || 0)) {
        alertLevel = AlertLevel.LOW;
      }

      // 检查是否已有活跃的预警
      const existingAlert = await prisma.inventoryAlert.findFirst({
        where: {
          productId,
          specId,
          warehouseType,
          userId: userId || null,
          shopId: shopId || null,
          status: AlertStatus.ACTIVE
        }
      });

      if (alertLevel) {
        // 需要创建或更新预警
        const threshold = alertLevel === AlertLevel.LOW
          ? (spec.lowStockThreshold || 0)
          : (spec.outOfStockThreshold || 0);

        if (existingAlert) {
          // 更新现有预警
          await prisma.inventoryAlert.update({
            where: { id: existingAlert.id },
            data: {
              currentStock,
              alertLevel,
              threshold,
              updatedAt: new Date()
            }
          });
        } else {
          // 创建新预警
          await prisma.inventoryAlert.create({
            data: {
              productId,
              specId,
              warehouseType,
              userId: userId || null,
              shopId: shopId || null,
              currentStock,
              alertLevel,
              threshold,
              status: AlertStatus.ACTIVE,
              isRead: false
            }
          });
        }

        logger.info('库存预警已触发', {
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          currentStock,
          alertLevel
        });
      } else if (existingAlert) {
        // 库存恢复正常，解决预警
        await prisma.inventoryAlert.update({
          where: { id: existingAlert.id },
          data: {
            status: AlertStatus.RESOLVED,
            resolvedAt: new Date(),
            resolveReason: '库存已恢复到正常水平'
          }
        });

        logger.info('库存预警已自动解决', {
          alertId: existingAlert.id,
          productId,
          specId,
          warehouseType,
          currentStock
        });
      }
    } catch (error) {
      logger.error('检查库存预警失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 手动入库
   */
  async manualIn(
    params: ManualInParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const {
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      quantity,
      batchNumber,
      expiryDate,
      location,
      reason,
      remarks
    } = params;

    if (quantity <= 0) {
      throw new Error('入库数量必须大于0');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 生成批次号（如果没有提供）
        const finalBatchNumber = batchNumber || this.generateBatchNumber();

        // 获取或创建库存记录
        const stock = await this.getOrCreateStock(
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          finalBatchNumber
        );

        const quantityBefore = stock.quantity;
        const quantityAfter = quantityBefore + quantity;

        // 更新库存数量
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantity: quantityAfter,
            availableQuantity: quantityAfter - stock.reservedQuantity,
            location: location || stock.location,
            updatedAt: new Date()
          }
        });

        // 创建库存流水记录
        const log = await this.createInventoryLog(
          InventoryOperationType.MANUAL_IN,
          quantity,
          quantityBefore,
          quantityAfter,
          warehouseType,
          productId,
          specId,
          OperatorType.ADMIN,
          operatorId,
          userId,
          shopId,
          finalBatchNumber,
          undefined,
          undefined,
          reason,
          remarks
        );

        // 检查库存预警
        await this.checkInventoryAlert(
          productId,
          specId,
          warehouseType,
          userId,
          shopId
        );

        logger.info('手动入库成功', {
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          quantity,
          batchNumber: finalBatchNumber,
          operatorId,
          logId: log.id
        });

        return {
          success: true,
          logId: log.id,
          beforeQuantity: quantityBefore,
          afterQuantity: quantityAfter,
          message: '手动入库成功'
        };
      });
    } catch (error) {
      logger.error('手动入库失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 手动出库
   */
  async manualOut(
    params: ManualOutParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const {
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      quantity,
      reason,
      remarks
    } = params;

    if (quantity <= 0) {
      throw new Error('出库数量必须大于0');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 获取库存记录
        const stock = await this.getStock(
          productId,
          specId,
          warehouseType,
          userId,
          shopId
        );

        if (!stock) {
          throw new Error('库存记录不存在');
        }

        const availableQuantity = stock.quantity - stock.reservedQuantity;
        if (availableQuantity < quantity) {
          throw new Error(`可用库存不足，当前可用：${availableQuantity}，需要：${quantity}`);
        }

        const quantityBefore = stock.quantity;
        const quantityAfter = quantityBefore - quantity;

        // 更新库存数量
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantity: quantityAfter,
            availableQuantity: quantityAfter - stock.reservedQuantity,
            updatedAt: new Date()
          }
        });

        // 创建库存流水记录
        const log = await this.createInventoryLog(
          InventoryOperationType.MANUAL_OUT,
          -quantity,
          quantityBefore,
          quantityAfter,
          warehouseType,
          productId,
          specId,
          OperatorType.ADMIN,
          operatorId,
          userId,
          shopId,
          stock.batchNumber,
          undefined,
          undefined,
          reason,
          remarks
        );

        // 检查库存预警
        await this.checkInventoryAlert(
          productId,
          specId,
          warehouseType,
          userId,
          shopId
        );

        logger.info('手动出库成功', {
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          quantity,
          operatorId,
          logId: log.id
        });

        return {
          success: true,
          logId: log.id,
          beforeQuantity: quantityBefore,
          afterQuantity: quantityAfter,
          message: '手动出库成功'
        };
      });
    } catch (error) {
      logger.error('手动出库失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 库存调拨
   */
  async transfer(
    params: TransferParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const {
      productId,
      specId,
      fromWarehouse,
      toWarehouse,
      fromUserId,
      toUserId,
      fromShopId,
      toShopId,
      quantity,
      reason,
      remarks
    } = params;

    if (quantity <= 0) {
      throw new Error('调拨数量必须大于0');
    }

    if (fromWarehouse === toWarehouse &&
        fromUserId === toUserId &&
        fromShopId === toShopId) {
      throw new Error('源仓库和目标仓库不能相同');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 获取源仓库库存
        const fromStock = await this.getStock(
          productId,
          specId,
          fromWarehouse,
          fromUserId,
          fromShopId
        );

        if (!fromStock) {
          throw new Error('源仓库库存记录不存在');
        }

        const availableQuantity = fromStock.quantity - fromStock.reservedQuantity;
        if (availableQuantity < quantity) {
          throw new Error(`源仓库可用库存不足，当前可用：${availableQuantity}，需要：${quantity}`);
        }

        const fromQuantityBefore = fromStock.quantity;
        const fromQuantityAfter = fromQuantityBefore - quantity;

        // 获取或创建目标仓库库存
        const toStock = await this.getOrCreateStock(
          productId,
          specId,
          toWarehouse,
          toUserId,
          toShopId,
          fromStock.batchNumber
        );

        const toQuantityBefore = toStock.quantity;
        const toQuantityAfter = toQuantityBefore + quantity;

        // 更新源仓库库存
        await tx.inventoryStock.update({
          where: { id: fromStock.id },
          data: {
            quantity: fromQuantityAfter,
            availableQuantity: fromQuantityAfter - fromStock.reservedQuantity,
            updatedAt: new Date()
          }
        });

        // 更新目标仓库库存
        await tx.inventoryStock.update({
          where: { id: toStock.id },
          data: {
            quantity: toQuantityAfter,
            availableQuantity: toQuantityAfter - toStock.reservedQuantity,
            updatedAt: new Date()
          }
        });

        // 创建出库流水记录
        const outLog = await this.createInventoryLog(
          InventoryOperationType.TRANSFER_OUT,
          -quantity,
          fromQuantityBefore,
          fromQuantityAfter,
          fromWarehouse,
          productId,
          specId,
          OperatorType.ADMIN,
          operatorId,
          fromUserId,
          fromShopId,
          fromStock.batchNumber,
          undefined,
          undefined,
          reason,
          remarks
        );

        // 创建入库流水记录
        const inLog = await this.createInventoryLog(
          InventoryOperationType.TRANSFER_IN,
          quantity,
          toQuantityBefore,
          toQuantityAfter,
          toWarehouse,
          productId,
          specId,
          OperatorType.ADMIN,
          operatorId,
          toUserId,
          toShopId,
          fromStock.batchNumber,
          undefined,
          undefined,
          reason,
          remarks
        );

        // 检查库存预警
        await this.checkInventoryAlert(
          productId,
          specId,
          fromWarehouse,
          fromUserId,
          fromShopId
        );

        await this.checkInventoryAlert(
          productId,
          specId,
          toWarehouse,
          toUserId,
          toShopId
        );

        logger.info('库存调拨成功', {
          productId,
          specId,
          fromWarehouse,
          toWarehouse,
          fromUserId,
          toUserId,
          quantity,
          operatorId,
          outLogId: outLog.id,
          inLogId: inLog.id
        });

        return {
          success: true,
          logId: outLog.id,
          beforeQuantity: fromQuantityBefore,
          afterQuantity: fromQuantityAfter,
          message: '库存调拨成功'
        };
      });
    } catch (error) {
      logger.error('库存调拨失败', {
        productId,
        specId,
        fromWarehouse,
        toWarehouse,
        fromUserId,
        toUserId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 库存报损
   */
  async damage(
    params: DamageParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const {
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      quantity,
      batchNumber,
      reason,
      remarks
    } = params;

    if (quantity <= 0) {
      throw new Error('报损数量必须大于0');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 获取库存记录
        const stock = await this.getStock(
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          batchNumber
        );

        if (!stock) {
          throw new Error('库存记录不存在');
        }

        const availableQuantity = stock.quantity - stock.reservedQuantity;
        if (availableQuantity < quantity) {
          throw new Error(`可用库存不足，当前可用：${availableQuantity}，需要：${quantity}`);
        }

        const quantityBefore = stock.quantity;
        const quantityAfter = quantityBefore - quantity;

        // 更新库存数量
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantity: quantityAfter,
            availableQuantity: quantityAfter - stock.reservedQuantity,
            updatedAt: new Date()
          }
        });

        // 创建库存流水记录
        const log = await this.createInventoryLog(
          InventoryOperationType.DAMAGE_OUT,
          -quantity,
          quantityBefore,
          quantityAfter,
          warehouseType,
          productId,
          specId,
          OperatorType.ADMIN,
          operatorId,
          userId,
          shopId,
          stock.batchNumber,
          undefined,
          undefined,
          reason,
          remarks
        );

        // 检查库存预警
        await this.checkInventoryAlert(
          productId,
          specId,
          warehouseType,
          userId,
          shopId
        );

        logger.info('库存报损成功', {
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          quantity,
          batchNumber,
          operatorId,
          logId: log.id
        });

        return {
          success: true,
          logId: log.id,
          beforeQuantity: quantityBefore,
          afterQuantity: quantityAfter,
          message: '库存报损成功'
        };
      });
    } catch (error) {
      logger.error('库存报损失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 采购入库（店长向上级采购）
   */
  async purchaseIn(
    params: PurchaseInParams
  ): Promise<InventoryAdjustmentResult> {
    const {
      fromUserId,
      toUserId,
      productId,
      specId,
      quantity,
      unitPrice,
      totalAmount,
      relatedOrderId
    } = params;

    if (quantity <= 0) {
      throw new Error('采购数量必须大于0');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 获取上级用户云仓库存
        const fromStock = await this.getStock(
          productId,
          specId,
          WarehouseType.CLOUD,
          fromUserId
        );

        if (!fromStock) {
          throw new Error('上级用户云仓库存不存在');
        }

        const availableQuantity = fromStock.quantity - fromStock.reservedQuantity;
        if (availableQuantity < quantity) {
          throw new Error(`上级用户云仓库存不足，当前可用：${availableQuantity}，需要：${quantity}`);
        }

        const fromQuantityBefore = fromStock.quantity;
        const fromQuantityAfter = fromQuantityBefore - quantity;

        // 获取或创建采购用户云仓库存
        const toStock = await this.getOrCreateStock(
          productId,
          specId,
          WarehouseType.CLOUD,
          toUserId,
          undefined,
          fromStock.batchNumber
        );

        const toQuantityBefore = toStock.quantity;
        const toQuantityAfter = toQuantityBefore + quantity;

        // 更新上级用户库存
        await tx.inventoryStock.update({
          where: { id: fromStock.id },
          data: {
            quantity: fromQuantityAfter,
            availableQuantity: fromQuantityAfter - fromStock.reservedQuantity,
            updatedAt: new Date()
          }
        });

        // 更新采购用户库存
        await tx.inventoryStock.update({
          where: { id: toStock.id },
          data: {
            quantity: toQuantityAfter,
            availableQuantity: toQuantityAfter - toStock.reservedQuantity,
            updatedAt: new Date()
          }
        });

        // 创建出库流水记录
        const outLog = await this.createInventoryLog(
          InventoryOperationType.PURCHASE_IN,
          -quantity,
          fromQuantityBefore,
          fromQuantityAfter,
          WarehouseType.CLOUD,
          productId,
          specId,
          OperatorType.AUTO,
          undefined,
          fromUserId,
          undefined,
          fromStock.batchNumber,
          relatedOrderId,
          undefined,
          `采购出库：${quantity}件，单价：${unitPrice}元`,
          `总金额：${totalAmount}元`
        );

        // 创建入库流水记录
        const inLog = await this.createInventoryLog(
          InventoryOperationType.PURCHASE_IN,
          quantity,
          toQuantityBefore,
          toQuantityAfter,
          WarehouseType.CLOUD,
          productId,
          specId,
          OperatorType.AUTO,
          undefined,
          toUserId,
          undefined,
          fromStock.batchNumber,
          relatedOrderId,
          undefined,
          `采购入库：${quantity}件，单价：${unitPrice}元`,
          `总金额：${totalAmount}元`
        );

        // 检查库存预警
        await this.checkInventoryAlert(
          productId,
          specId,
          WarehouseType.CLOUD,
          fromUserId
        );

        await this.checkInventoryAlert(
          productId,
          specId,
          WarehouseType.CLOUD,
          toUserId
        );

        logger.info('采购入库成功', {
          fromUserId,
          toUserId,
          productId,
          specId,
          quantity,
          unitPrice,
          totalAmount,
          relatedOrderId,
          outLogId: outLog.id,
          inLogId: inLog.id
        });

        return {
          success: true,
          logId: inLog.id,
          beforeQuantity: toQuantityBefore,
          afterQuantity: toQuantityAfter,
          message: '采购入库成功'
        };
      });
    } catch (error) {
      logger.error('采购入库失败', {
        fromUserId,
        toUserId,
        productId,
        specId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 销售出库（店长从云仓到本地仓）
   */
  async orderOut(
    params: OrderOutParams
  ): Promise<InventoryAdjustmentResult> {
    const {
      userId,
      shopId,
      productId,
      specId,
      quantity,
      deliveryAddress,
      relatedOrderId
    } = params;

    if (quantity <= 0) {
      throw new Error('出库数量必须大于0');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 获取店长云仓库存
        const cloudStock = await this.getStock(
          productId,
          specId,
          WarehouseType.CLOUD,
          userId
        );

        if (!cloudStock) {
          throw new Error('店长云仓库存不存在');
        }

        const availableQuantity = cloudStock.quantity - cloudStock.reservedQuantity;
        if (availableQuantity < quantity) {
          throw new Error(`云仓可用库存不足，当前可用：${availableQuantity}，需要：${quantity}`);
        }

        const cloudQuantityBefore = cloudStock.quantity;
        const cloudQuantityAfter = cloudQuantityBefore - quantity;

        // 获取或创建店长本地仓库存
        const localStock = await this.getOrCreateStock(
          productId,
          specId,
          WarehouseType.LOCAL,
          userId,
          shopId,
          cloudStock.batchNumber
        );

        const localQuantityBefore = localStock.quantity;
        const localQuantityAfter = localQuantityBefore + quantity;

        // 更新云仓库存
        await tx.inventoryStock.update({
          where: { id: cloudStock.id },
          data: {
            quantity: cloudQuantityAfter,
            availableQuantity: cloudQuantityAfter - cloudStock.reservedQuantity,
            updatedAt: new Date()
          }
        });

        // 更新本地仓库存
        await tx.inventoryStock.update({
          where: { id: localStock.id },
          data: {
            quantity: localQuantityAfter,
            availableQuantity: localQuantityAfter - localStock.reservedQuantity,
            location: deliveryAddress || localStock.location,
            updatedAt: new Date()
          }
        });

        // 创建云仓出库流水记录
        const cloudOutLog = await this.createInventoryLog(
          InventoryOperationType.ORDER_OUT,
          -quantity,
          cloudQuantityBefore,
          cloudQuantityAfter,
          WarehouseType.CLOUD,
          productId,
          specId,
          OperatorType.AUTO,
          undefined,
          userId,
          shopId,
          cloudStock.batchNumber,
          relatedOrderId,
          undefined,
          '订单出库：云仓到本地仓',
          `发货地址：${deliveryAddress || '默认地址'}`
        );

        // 创建本地仓入库流水记录
        const localInLog = await this.createInventoryLog(
          InventoryOperationType.ORDER_OUT,
          quantity,
          localQuantityBefore,
          localQuantityAfter,
          WarehouseType.LOCAL,
          productId,
          specId,
          OperatorType.AUTO,
          undefined,
          userId,
          shopId,
          cloudStock.batchNumber,
          relatedOrderId,
          undefined,
          '订单入库：云仓到本地仓',
          `发货地址：${deliveryAddress || '默认地址'}`
        );

        // 更新平台总库存
        const platformStock = await this.getStock(
          productId,
          specId,
          WarehouseType.PLATFORM
        );

        if (platformStock) {
          const platformQuantityBefore = platformStock.quantity;
          const platformQuantityAfter = platformQuantityBefore - quantity;

          await tx.inventoryStock.update({
            where: { id: platformStock.id },
            data: {
              quantity: platformQuantityAfter,
              availableQuantity: platformQuantityAfter - platformStock.reservedQuantity,
              updatedAt: new Date()
            }
          });

          // 创建平台总仓出库流水记录
          await this.createInventoryLog(
            InventoryOperationType.ORDER_OUT,
            -quantity,
            platformQuantityBefore,
            platformQuantityAfter,
            WarehouseType.PLATFORM,
            productId,
            specId,
            OperatorType.AUTO,
            undefined,
            undefined,
            undefined,
            platformStock.batchNumber,
            relatedOrderId,
            undefined,
            '订单出库：平台总库存减少',
            `店长：${userId}，数量：${quantity}`
          );
        }

        // 检查库存预警
        await this.checkInventoryAlert(
          productId,
          specId,
          WarehouseType.CLOUD,
          userId
        );

        await this.checkInventoryAlert(
          productId,
          specId,
          WarehouseType.LOCAL,
          userId,
          shopId
        );

        if (platformStock) {
          await this.checkInventoryAlert(
            productId,
            specId,
            WarehouseType.PLATFORM
          );
        }

        logger.info('销售出库成功', {
          userId,
          shopId,
          productId,
          specId,
          quantity,
          deliveryAddress,
          relatedOrderId,
          cloudOutLogId: cloudOutLog.id,
          localInLogId: localInLog.id
        });

        return {
          success: true,
          logId: localInLog.id,
          beforeQuantity: localQuantityBefore,
          afterQuantity: localQuantityAfter,
          message: '销售出库成功'
        };
      });
    } catch (error) {
      logger.error('销售出库失败', {
        userId,
        shopId,
        productId,
        specId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取库存信息
   */
  async getStock(
    productId: string,
    specId: string,
    warehouseType: WarehouseType,
    userId?: string,
    shopId?: string,
    batchNumber?: string
  ): Promise<InventoryStock | null> {
    try {
      const stock = await prisma.inventoryStock.findFirst({
        where: {
          productId,
          specId,
          warehouseType,
          userId: userId || null,
          shopId: shopId || null,
          batchNumber: batchNumber || null
        }
      });

      return stock as InventoryStock | null;
    } catch (error) {
      logger.error('获取库存信息失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取库存列表
   */
  async getStockList(query: InventoryQuery): Promise<{
    stocks: InventoryStock[];
    total: number;
    pagination: {
      page: number;
      perPage: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      batchNumber,
      lowStock,
      page = 1,
      perPage = 20
    } = query;

    const skip = (page - 1) * perPage;
    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (specId) {
      where.specId = specId;
    }

    if (warehouseType) {
      where.warehouseType = warehouseType;
    }

    if (userId) {
      where.userId = userId;
    }

    if (shopId) {
      where.shopId = shopId;
    }

    if (batchNumber) {
      where.batchNumber = batchNumber;
    }

    if (lowStock) {
      where.quantity = { lte: 10 }; // 假设10件以下为低库存
    }

    try {
      const [stocks, total] = await Promise.all([
        prisma.inventoryStock.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { updatedAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                sku: true
              }
            },
            spec: {
              select: {
                id: true,
                name: true,
                sku: true,
                lowStockThreshold: true,
                outOfStockThreshold: true
              }
            },
            user: {
              select: {
                id: true,
                nickname: true,
                phone: true,
                level: true
              }
            },
            shop: {
              select: {
                id: true,
                shopName: true,
                shopType: true
              }
            }
          }
        }),
        prisma.inventoryStock.count({ where })
      ]);

      return {
        stocks: stocks as InventoryStock[],
        total,
        pagination: {
          page,
          perPage,
          totalPages: Math.ceil(total / perPage),
          hasNext: page < Math.ceil(total / perPage),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('获取库存列表失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取库存流水记录（复用路由中的逻辑）
   */
  async getInventoryLogs(query: InventoryLogQuery) {
    const {
      productId,
      specId,
      warehouseType,
      operationType,
      startDate,
      endDate,
      page = 1,
      perPage = 20
    } = query;

    const skip = (page - 1) * perPage;
    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (specId) {
      where.specId = specId;
    }

    if (warehouseType) {
      where.warehouseType = warehouseType;
    }

    if (operationType) {
      where.operationType = operationType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    try {
      const [logs, total] = await Promise.all([
        prisma.inventoryLog.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                phone: true,
                level: true
              }
            },
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                sku: true
              }
            },
            spec: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            shop: {
              select: {
                id: true,
                shopName: true,
                shopType: true
              }
            },
            operator: {
              select: {
                id: true,
                nickname: true,
                phone: true,
                level: true
              }
            }
          }
        }),
        prisma.inventoryLog.count({ where })
      ]);

      return {
        logs: logs as InventoryLog[],
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
          hasNext: page < Math.ceil(total / perPage),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('获取库存流水记录失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取库存预警列表
   */
  async getAlerts(query: AlertQuery): Promise<{
    alerts: InventoryAlert[];
    total: number;
    pagination: {
      page: number;
      perPage: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const {
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      alertLevel,
      status,
      isRead,
      page = 1,
      perPage = 20
    } = query;

    const skip = (page - 1) * perPage;
    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (specId) {
      where.specId = specId;
    }

    if (warehouseType) {
      where.warehouseType = warehouseType;
    }

    if (userId) {
      where.userId = userId;
    }

    if (shopId) {
      where.shopId = shopId;
    }

    if (alertLevel) {
      where.alertLevel = alertLevel;
    }

    if (status) {
      where.status = status;
    }

    if (typeof isRead === 'boolean') {
      where.isRead = isRead;
    }

    try {
      const [alerts, total] = await Promise.all([
        prisma.inventoryAlert.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                sku: true
              }
            },
            spec: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            user: {
              select: {
                id: true,
                nickname: true,
                phone: true,
                level: true
              }
            },
            shop: {
              select: {
                id: true,
                shopName: true,
                shopType: true
              }
            }
          }
        }),
        prisma.inventoryAlert.count({ where })
      ]);

      return {
        alerts: alerts as InventoryAlert[],
        total,
        pagination: {
          page,
          perPage,
          totalPages: Math.ceil(total / perPage),
          hasNext: page < Math.ceil(total / perPage),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error('获取库存预警列表失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 批量检查库存预警
   */
  async checkAllInventoryAlerts(): Promise<void> {
    try {
      // 获取所有有库存的商品规格
      const stocks = await prisma.inventoryStock.findMany({
        where: {
          quantity: { gt: 0 }
        },
        select: {
          productId: true,
          specId: true,
          warehouseType: true,
          userId: true,
          shopId: true,
          quantity: true
        }
      });

      for (const stock of stocks) {
        await this.checkInventoryAlert(
          stock.productId,
          stock.specId,
          stock.warehouseType,
          stock.userId || undefined,
          stock.shopId || undefined
        );
      }

      logger.info('批量检查库存预警完成', {
        checkedStocks: stocks.length
      });
    } catch (error) {
      logger.error('批量检查库存预警失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取库存可用数量（为订单系统提供）
   */
  async getInventoryQuantity(
    userId: string,
    warehouseType: string,
    productId: string,
    specId: string
  ): Promise<{
    available: number;
    total: number;
    reserved: number;
  }> {
    try {
      let targetUserId = userId;

      // 平台总仓特殊处理
      if (userId === 'platform' && warehouseType === 'PLATFORM') {
        targetUserId = 'platform';
      }

      const stock = await prisma.inventoryItem.findFirst({
        where: {
          productId,
          specId,
          warehouseType: warehouseType as any,
          userId: targetUserId
        }
      });

      if (!stock) {
        return {
          available: 0,
          total: 0,
          reserved: 0
        };
      }

      return {
        available: stock.available,
        total: stock.total,
        reserved: stock.reserved || 0
      };
    } catch (error) {
      logger.error('获取库存数量失败', {
        userId,
        warehouseType,
        productId,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        available: 0,
        total: 0,
        reserved: 0
      };
    }
  }

  /**
   * 预留库存（为订单系统提供）
   */
  async reserveInventory(
    userId: string,
    warehouseType: string,
    productId: string,
    specId: string,
    quantity: number
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        const stock = await tx.inventoryItem.findFirst({
          where: {
            productId,
            specId,
            warehouseType: warehouseType as any,
            userId
          }
        });

        if (!stock || stock.available < quantity) {
          return false;
        }

        // 更新库存
        await tx.inventoryItem.update({
          where: { id: stock.id },
          data: {
            available: stock.available - quantity,
            reserved: (stock.reserved || 0) + quantity,
            updatedAt: new Date()
          }
        });

        // 创建操作记录
        await tx.inventoryLog.create({
          data: {
            productId,
            specId,
            warehouseType: warehouseType as any,
            userId,
            operationType: 'RESERVE',
            operatorType: 'SYSTEM',
            quantity,
            beforeTotal: stock.total,
            afterTotal: stock.total,
            beforeAvailable: stock.available,
            afterAvailable: stock.available - quantity,
            beforeReserved: stock.reserved || 0,
            afterReserved: (stock.reserved || 0) + quantity,
            batchNumber: stock.batchNumber,
            operatorId: 'system',
            operatorName: '订单系统',
            notes: `预留库存用于订单创建`
          }
        });

        return true;
      });
    } catch (error) {
      logger.error('预留库存失败', {
        userId,
        warehouseType,
        productId,
        specId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 释放预留库存
   */
  async releaseReservedInventory(
    userId: string,
    warehouseType: string,
    productId: string,
    specId: string,
    quantity: number
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        const stock = await tx.inventoryItem.findFirst({
          where: {
            productId,
            specId,
            warehouseType: warehouseType as any,
            userId
          }
        });

        if (!stock || (stock.reserved || 0) < quantity) {
          return false;
        }

        // 更新库存
        await tx.inventoryItem.update({
          where: { id: stock.id },
          data: {
            available: stock.available + quantity,
            reserved: (stock.reserved || 0) - quantity,
            updatedAt: new Date()
          }
        });

        // 创建操作记录
        await tx.inventoryLog.create({
          data: {
            productId,
            specId,
            warehouseType: warehouseType as any,
            userId,
            operationType: 'RELEASE',
            operatorType: 'SYSTEM',
            quantity,
            beforeTotal: stock.total,
            afterTotal: stock.total,
            beforeAvailable: stock.available,
            afterAvailable: stock.available + quantity,
            beforeReserved: stock.reserved || 0,
            afterReserved: (stock.reserved || 0) - quantity,
            batchNumber: stock.batchNumber,
            operatorId: 'system',
            operatorName: '订单系统',
            notes: `释放预留库存`
          }
        });

        return true;
      });
    } catch (error) {
      logger.error('释放预留库存失败', {
        userId,
        warehouseType,
        productId,
        specId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 扣减库存（订单确认时使用）
   */
  async reduceInventory(
    userId: string,
    warehouseType: string,
    productId: string,
    specId: string,
    quantity: number
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        const stock = await tx.inventoryItem.findFirst({
          where: {
            productId,
            specId,
            warehouseType: warehouseType as any,
            userId
          }
        });

        if (!stock || (stock.reserved || 0) < quantity) {
          return false;
        }

        // 更新库存
        await tx.inventoryItem.update({
          where: { id: stock.id },
          data: {
            total: stock.total - quantity,
            reserved: (stock.reserved || 0) - quantity,
            updatedAt: new Date()
          }
        });

        // 创建操作记录
        await tx.inventoryLog.create({
          data: {
            productId,
            specId,
            warehouseType: warehouseType as any,
            userId,
            operationType: 'ORDER_OUT',
            operatorType: 'SYSTEM',
            quantity,
            beforeTotal: stock.total,
            afterTotal: stock.total - quantity,
            beforeAvailable: stock.available,
            afterAvailable: stock.available,
            beforeReserved: stock.reserved || 0,
            afterReserved: (stock.reserved || 0) - quantity,
            batchNumber: stock.batchNumber,
            operatorId: 'system',
            operatorName: '订单系统',
            notes: `订单出库扣减库存`
          }
        });

        return true;
      });
    } catch (error) {
      logger.error('扣减库存失败', {
        userId,
        warehouseType,
        productId,
        specId,
        quantity,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }
}

// 导出单例实例
export const inventoryService = new InventoryService();