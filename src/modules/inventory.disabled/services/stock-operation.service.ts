import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import {
  InventoryOperationType,
  OperatorType,
  InventoryStock,
  InventoryAdjustmentResult,
  StockOperationParams,
  TransferParams,
  WarehouseType,
  InventoryServiceResponse
} from './types';
import { BatchManagerService } from './batch-manager.service';
import { InventoryLoggerService } from './inventory-logger.service';
import { InventoryAlertService } from './inventory-alert.service';

/**
 * 库存操作服务
 * 负责处理所有库存变动操作，包括入库、出库、调拨等
 */
export class StockOperationService {
  constructor(
    private batchManager: BatchManagerService,
    private logger: InventoryLoggerService,
    private alertService: InventoryAlertService
  ) {}

  /**
   * 获取或创建库存记录
   */
  async getOrCreateStock(
    productId: string,
    specId: string,
    warehouseType: WarehouseType,
    userId?: string,
    shopId?: string,
    batchNumber?: string
  ): Promise<InventoryStock> {
    try {
      // 先查找现有库存
      let stock = await prisma.inventoryStocks.findFirst({
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
        stock = await prisma.inventoryStocks.create({
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
   * 获取库存记录
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
      const stock = await prisma.inventoryStocks.findFirst({
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
      logger.error('获取库存记录失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        batchNumber,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 执行库存入库操作
   */
  async stockIn(
    params: StockOperationParams & {
      productId: string;
      specId: string;
      warehouseType: WarehouseType;
      userId?: string;
      shopId?: string;
    }
  ): Promise<InventoryAdjustmentResult> {
    const {
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      quantity,
      batchNumber,
      location,
      expiryDate,
      operatorId,
      operatorType,
      operationType,
      reason,
      remarks
    } = params;

    if (quantity <= 0) {
      throw new Error('入库数量必须大于0');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 生成批次号（如果没有提供）
        const finalBatchNumber = batchNumber || this.batchManager.generateBatchNumber();

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
            expiryDate: expiryDate || stock.expiryDate,
            updatedAt: new Date()
          }
        });

        // 创建库存流水记录
        const log = await this.logger.createLog(
          operationType,
          quantity,
          quantityBefore,
          quantityAfter,
          warehouseType,
          productId,
          specId,
          operatorType,
          {
            operatorId,
            userId,
            shopId,
            batchNumber: finalBatchNumber,
            adjustmentReason: reason,
            remarks
          }
        );

        // 记录库存同步事件
        await this.logger.logStockSync({
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          batchNumber: finalBatchNumber,
          quantityBefore,
          quantityAfter,
          operationType
        });

        // 检查库存预警
        await this.alertService.checkInventoryAlert(
          productId,
          specId,
          warehouseType,
          userId,
          shopId
        );

        logger.info('库存入库成功', {
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          quantity,
          batchNumber: finalBatchNumber,
          operatorId,
          operationType,
          logId: log.id
        });

        return {
          success: true,
          logId: log.id,
          beforeQuantity: quantityBefore,
          afterQuantity: quantityAfter,
          message: `${operationType}成功`
        };
      });
    } catch (error) {
      logger.error('库存入库失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        quantity,
        operationType,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 执行库存出库操作
   */
  async stockOut(
    params: StockOperationParams & {
      productId: string;
      specId: string;
      warehouseType: WarehouseType;
      userId?: string;
      shopId?: string;
    }
  ): Promise<InventoryAdjustmentResult> {
    const {
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      quantity,
      batchNumber,
      operatorId,
      operatorType,
      operationType,
      reason,
      remarks
    } = params;

    if (quantity <= 0) {
      throw new Error('出库数量必须大于0');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 获取库存记录
        let stock: InventoryStock | null;

        if (batchNumber) {
          // 指定批次号
          stock = await this.getStock(
            productId,
            specId,
            warehouseType,
            userId,
            shopId,
            batchNumber
          );
        } else {
          // 自动选择批次（先进先出）
          const selectedBatchNumber = await this.batchManager.selectBatchForOperation(
            productId,
            specId,
            warehouseType,
            userId,
            shopId,
            quantity
          );

          if (!selectedBatchNumber) {
            throw new Error('没有可用的库存批次');
          }

          stock = await this.getStock(
            productId,
            specId,
            warehouseType,
            userId,
            shopId,
            selectedBatchNumber
          );
        }

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
        const log = await this.logger.createLog(
          operationType,
          -quantity,
          quantityBefore,
          quantityAfter,
          warehouseType,
          productId,
          specId,
          operatorType,
          {
            operatorId,
            userId,
            shopId,
            batchNumber: stock.batchNumber,
            adjustmentReason: reason,
            remarks
          }
        );

        // 记录库存同步事件
        await this.logger.logStockSync({
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          batchNumber: stock.batchNumber,
          quantityBefore,
          quantityAfter,
          operationType
        });

        // 检查库存预警
        await this.alertService.checkInventoryAlert(
          productId,
          specId,
          warehouseType,
          userId,
          shopId
        );

        logger.info('库存出库成功', {
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          quantity,
          batchNumber: stock.batchNumber,
          operatorId,
          operationType,
          logId: log.id
        });

        return {
          success: true,
          logId: log.id,
          beforeQuantity: quantityBefore,
          afterQuantity: quantityAfter,
          message: `${operationType}成功`
        };
      });
    } catch (error) {
      logger.error('库存出库失败', {
        productId,
        specId,
        warehouseType,
        userId,
        shopId,
        quantity,
        operationType,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 执行库存调拨操作
   */
  async transfer(
    params: TransferParams & { operatorId: string }
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
      remarks,
      operatorId
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
        const outLog = await this.logger.createLog(
          InventoryOperationType.TRANSFER_OUT,
          -quantity,
          fromQuantityBefore,
          fromQuantityAfter,
          fromWarehouse,
          productId,
          specId,
          OperatorType.SYSTEM,
          {
            operatorId,
            userId: fromUserId,
            shopId: fromShopId,
            batchNumber: fromStock.batchNumber,
            adjustmentReason: reason,
            remarks
          }
        );

        // 创建入库流水记录
        const inLog = await this.logger.createLog(
          InventoryOperationType.TRANSFER_IN,
          quantity,
          toQuantityBefore,
          toQuantityAfter,
          toWarehouse,
          productId,
          specId,
          OperatorType.SYSTEM,
          {
            operatorId,
            userId: toUserId,
            shopId: toShopId,
            batchNumber: fromStock.batchNumber,
            adjustmentReason: reason,
            remarks
          }
        );

        // 记录库存同步事件
        await this.logger.logStockSync({
          productId,
          specId,
          warehouseType: fromWarehouse,
          userId: fromUserId,
          shopId: fromShopId,
          batchNumber: fromStock.batchNumber,
          quantityBefore: fromQuantityBefore,
          quantityAfter: fromQuantityAfter,
          operationType: InventoryOperationType.TRANSFER_OUT
        });

        await this.logger.logStockSync({
          productId,
          specId,
          warehouseType: toWarehouse,
          userId: toUserId,
          shopId: toShopId,
          batchNumber: fromStock.batchNumber,
          quantityBefore: toQuantityBefore,
          quantityAfter: toQuantityAfter,
          operationType: InventoryOperationType.TRANSFER_IN
        });

        // 检查库存预警
        await this.alertService.checkInventoryAlert(
          productId,
          specId,
          fromWarehouse,
          fromUserId,
          fromShopId
        );

        await this.alertService.checkInventoryAlert(
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
   * 预留库存
   */
  async reserveStock(
    productId: string,
    specId: string,
    warehouseType: WarehouseType,
    quantity: number,
    userId?: string,
    shopId?: string,
    orderId?: string
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        const stock = await tx.inventoryStock.findFirst({
          where: {
            productId,
            specId,
            warehouseType,
            userId: userId || null,
            shopId: shopId || null,
            availableQuantity: { gte: quantity }
          }
        });

        if (!stock) {
          return false;
        }

        // 更新预留库存
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            reservedQuantity: stock.reservedQuantity + quantity,
            availableQuantity: stock.availableQuantity - quantity,
            updatedAt: new Date()
          }
        });

        // 创建预留流水记录
        await this.logger.createLog(
          InventoryOperationType.MANUAL_OUT, // 或创建新的操作类型
          quantity,
          stock.quantity,
          stock.quantity,
          warehouseType,
          productId,
          specId,
          OperatorType.SYSTEM,
          {
            operatorId: 'system',
            userId,
            shopId,
            batchNumber: stock.batchNumber,
            relatedOrderId: orderId,
            adjustmentReason: '预留库存',
            remarks: `为订单 ${orderId} 预留库存`
          }
        );

        logger.info('预留库存成功', {
          productId,
          specId,
          warehouseType,
          quantity,
          userId,
          shopId,
          orderId
        });

        return true;
      });
    } catch (error) {
      logger.error('预留库存失败', {
        productId,
        specId,
        warehouseType,
        quantity,
        userId,
        shopId,
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 释放预留库存
   */
  async releaseReservedStock(
    productId: string,
    specId: string,
    warehouseType: WarehouseType,
    quantity: number,
    userId?: string,
    shopId?: string,
    orderId?: string
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        const stock = await tx.inventoryStock.findFirst({
          where: {
            productId,
            specId,
            warehouseType,
            userId: userId || null,
            shopId: shopId || null,
            reservedQuantity: { gte: quantity }
          }
        });

        if (!stock) {
          return false;
        }

        // 更新预留库存
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            reservedQuantity: stock.reservedQuantity - quantity,
            availableQuantity: stock.availableQuantity + quantity,
            updatedAt: new Date()
          }
        });

        // 创建释放流水记录
        await this.logger.createLog(
          InventoryOperationType.MANUAL_IN, // 或创建新的操作类型
          quantity,
          stock.quantity,
          stock.quantity,
          warehouseType,
          productId,
          specId,
          OperatorType.SYSTEM,
          {
            operatorId: 'system',
            userId,
            shopId,
            batchNumber: stock.batchNumber,
            relatedOrderId: orderId,
            adjustmentReason: '释放预留库存',
            remarks: `释放订单 ${orderId} 的预留库存`
          }
        );

        logger.info('释放预留库存成功', {
          productId,
          specId,
          warehouseType,
          quantity,
          userId,
          shopId,
          orderId
        });

        return true;
      });
    } catch (error) {
      logger.error('释放预留库存失败', {
        productId,
        specId,
        warehouseType,
        quantity,
        userId,
        shopId,
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 扣减预留库存（订单确认时）
   */
  async consumeReservedStock(
    productId: string,
    specId: string,
    warehouseType: WarehouseType,
    quantity: number,
    userId?: string,
    shopId?: string,
    orderId?: string
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (tx) => {
        const stock = await tx.inventoryStock.findFirst({
          where: {
            productId,
            specId,
            warehouseType,
            userId: userId || null,
            shopId: shopId || null,
            reservedQuantity: { gte: quantity }
          }
        });

        if (!stock) {
          return false;
        }

        const quantityBefore = stock.quantity;
        const quantityAfter = quantityBefore - quantity;

        // 更新库存
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            quantity: quantityAfter,
            reservedQuantity: stock.reservedQuantity - quantity,
            updatedAt: new Date()
          }
        });

        // 创建出库流水记录
        await this.logger.createLog(
          InventoryOperationType.ORDER_OUT,
          -quantity,
          quantityBefore,
          quantityAfter,
          warehouseType,
          productId,
          specId,
          OperatorType.SYSTEM,
          {
            operatorId: 'system',
            userId,
            shopId,
            batchNumber: stock.batchNumber,
            relatedOrderId: orderId,
            adjustmentReason: '订单出库',
            remarks: `订单 ${orderId} 确认出库`
          }
        );

        // 记录库存同步事件
        await this.logger.logStockSync({
          productId,
          specId,
          warehouseType,
          userId,
          shopId,
          batchNumber: stock.batchNumber,
          quantityBefore,
          quantityAfter,
          operationType: InventoryOperationType.ORDER_OUT
        });

        // 检查库存预警
        await this.alertService.checkInventoryAlert(
          productId,
          specId,
          warehouseType,
          userId,
          shopId
        );

        logger.info('扣减预留库存成功', {
          productId,
          specId,
          warehouseType,
          quantity,
          userId,
          shopId,
          orderId
        });

        return true;
      });
    } catch (error) {
      logger.error('扣减预留库存失败', {
        productId,
        specId,
        warehouseType,
        quantity,
        userId,
        shopId,
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
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
   * 批量操作验证
   */
  async validateBatchOperation(
    operations: Array<{
      productId: string;
      specId: string;
      warehouseType: WarehouseType;
      quantity: number;
      userId?: string;
      shopId?: string;
    }>
  ): Promise<InventoryServiceResponse<{
    valid: boolean;
    insufficientStocks: Array<{
      productId: string;
      specId: string;
      requested: number;
      available: number;
    }>;
  }>> {
    try {
      const insufficientStocks: Array<{
        productId: string;
        specId: string;
        requested: number;
        available: number;
      }> = [];

      for (const op of operations) {
        const stock = await this.getStock(
          op.productsId,
          op.specsId,
          op.warehouseType,
          op.userId,
          op.shopId
        );

        if (!stock || stock.availableQuantity < op.quantity) {
          insufficientStocks.push({
            productId: op.productsId,
            specId: op.specsId,
            requested: op.quantity,
            available: stock?.availableQuantity || 0
          });
        }
      }

      const valid = insufficientStocks.length === 0;

      return {
        success: true,
        data: {
          valid,
          insufficientStocks
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      };
    }
  }
}

// 导出单例实例
export const stockOperationService = new StockOperationService(
  new BatchManagerService(),
  new InventoryLoggerService(),
  new InventoryAlertService()
);