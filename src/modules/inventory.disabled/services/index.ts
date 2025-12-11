// 导出所有类型
export * from './types';

// 导出各个服务类
export { BatchManagerService, batchManagerService } from './batch-manager.service';
export { InventoryLoggerService, inventoryLoggerService } from './inventory-logger.service';
export { InventoryAlertService, inventoryAlertService } from './inventory-alert.service';
export { StockOperationService, stockOperationService } from './stock-operation.service';
export { PlatformWarehouseService, platformWarehouseService } from './platform-warehouse.service';
export { CloudWarehouseService, cloudWarehouseService } from './cloud-warehouse.service';
export { LocalWarehouseService, localWarehouseService } from './local-warehouse.service';
export { StatisticsService, statisticsService } from './statistics.service';

// 导入必要的依赖
import { logger } from '../../../shared/utils/logger';
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
import { StockOperationService } from './stock-operation.service';
import { PlatformWarehouseService } from './platform-warehouse.service';
import { CloudWarehouseService } from './cloud-warehouse.service';
import { LocalWarehouseService } from './local-warehouse.service';
import { BatchManagerService } from './batch-manager.service';
import { InventoryLoggerService } from './inventory-logger.service';
import { InventoryAlertService } from './inventory-alert.service';
import { StatisticsService } from './statistics.service';
import { prisma } from '../../../shared/database/client';

/**
 * 库存管理服务类
 * 负责管理平台总仓、店长云仓、店长本地仓的三级库存体系
 *
 * @deprecated 建议使用具体的服务类：
 *   - PlatformWarehouseService (平台总仓管理)
 *   - CloudWarehouseService (云仓管理)
 *   - LocalWarehouseService (本地仓管理)
 *   - StockOperationService (通用库存操作)
 *   - BatchManagerService (批次管理)
 *   - InventoryAlertService (库存预警)
 *   - StatisticsService (库存统计)
 */
export class InventoryService {
  private stockOperation: StockOperationService;
  private platformWarehouse: PlatformWarehouseService;
  private cloudWarehouse: CloudWarehouseService;
  private localWarehouse: LocalWarehouseService;
  private batchManager: BatchManagerService;
  private inventoryLogger: InventoryLoggerService;
  private inventoryAlert: InventoryAlertService;
  private statistics: StatisticsService;

  constructor() {
    // 初始化各个服务
    this.batchManager = new BatchManagerService();
    this.inventoryLogger = new InventoryLoggerService();
    this.inventoryAlert = new InventoryAlertService();
    this.stockOperation = new StockOperationService(
      this.batchManager,
      this.inventoryLogger,
      this.inventoryAlert
    );
    this.platformWarehouse = new PlatformWarehouseService(this.stockOperation);
    this.cloudWarehouse = new CloudWarehouseService(this.stockOperation);
    this.localWarehouse = new LocalWarehouseService(this.stockOperation);
    this.statistics = new StatisticsService();
  }

  /**
   * 生成批次号
   */
  private generateBatchNumber(): string {
    return this.batchManager.generateBatchNumber();
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
    return await this.stockOperation.getOrCreateStock(
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      batchNumber
    );
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
    return await this.stockOperation.getStock(
      productId,
      specId,
      warehouseType,
      userId,
      shopId,
      batchNumber
    );
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
    options: {
      operatorId?: string;
      userId?: string;
      shopId?: string;
      batchNumber?: string;
      relatedOrderId?: string;
      relatedPurchaseId?: string;
      adjustmentReason?: string;
      remarks?: string;
    } = {}
  ): Promise<InventoryLog> {
    return await this.inventoryLogger.createLog(
      operationType,
      quantity,
      quantityBefore,
      quantityAfter,
      warehouseType,
      productId,
      specId,
      operatorType,
      options
    );
  }

  /**
   * 更新库存数量
   */
  private async updateStockQuantity(
    stock: InventoryStock,
    quantityChange: number,
    operationType: InventoryOperationType
  ): Promise<InventoryStock> {
    const newQuantity = stock.quantity + quantityChange;

    if (newQuantity < 0) {
      throw new Error('库存数量不能为负数');
    }

    const updatedStock = await prisma.inventoryStocks.update({
      where: { id: stock.id },
      data: {
        quantity: newQuantity,
        availableQuantity: newQuantity - stock.reservedQuantity,
        updatedAt: new Date()
      }
    });

    return updatedStock as InventoryStock;
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
    await this.inventoryAlert.checkInventoryAlert(
      productId,
      specId,
      warehouseType,
      userId,
      shopId
    );
  }

  /**
   * 手动入库
   */
  async manualIn(
    params: ManualInParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    // 根据仓库类型调用相应的服务
    if (params.warehouseType === WarehouseType.PLATFORM) {
      return await this.platformWarehouse.replenish(params, operatorId);
    } else if (params.warehouseType === WarehouseType.CLOUD) {
      return await this.cloudWarehouse.manualIn(params, operatorId);
    } else if (params.warehouseType === WarehouseType.LOCAL) {
      return await this.localWarehouse.manualIn(params, operatorId);
    } else {
      throw new Error('无效的仓库类型');
    }
  }

  /**
   * 手动出库
   */
  async manualOut(
    params: ManualOutParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    // 根据仓库类型调用相应的服务
    if (params.warehouseType === WarehouseType.PLATFORM) {
      return await this.platformWarehouse.distribute(params, operatorId);
    } else if (params.warehouseType === WarehouseType.CLOUD) {
      return await this.cloudWarehouse.manualOut(params, operatorId);
    } else if (params.warehouseType === WarehouseType.LOCAL) {
      return await this.localWarehouse.manualOut(params, operatorId);
    } else {
      throw new Error('无效的仓库类型');
    }
  }

  /**
   * 库存调拨
   */
  async transfer(
    params: TransferParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    return await this.stockOperation.transfer({ ...params, operatorId });
  }

  /**
   * 库存报损
   */
  async damage(
    params: DamageParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    return await this.stockOperation.stockOut({
      productId: params.productsId,
      specId: params.specsId,
      warehouseType: params.warehouseType,
      userId: params.userId,
      shopId: params.shopId,
      quantity: params.quantity,
      batchNumber: params.batchNumber,
      operatorId,
      operatorType: OperatorType.SYSTEM,
      operationType: InventoryOperationType.DAMAGE_OUT,
      reason: params.reason,
      remarks: params.remarks
    });
  }

  /**
   * 采购入库（店长向上级采购）
   */
  async purchaseIn(
    params: PurchaseInParams
  ): Promise<InventoryAdjustmentResult> {
    return await this.cloudWarehouse.purchaseIn(params);
  }

  /**
   * 销售出库（店长从云仓到本地仓）
   */
  async orderOut(
    params: OrderOutParams
  ): Promise<InventoryAdjustmentResult> {
    return await this.localWarehouse.orderOut(params);
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
      where.productsId = productId;
    }

    if (specId) {
      where.specsId = specId;
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
        prisma.inventoryStocks.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { updatedAt: 'desc' },
          include: {
            products: {
              select: {
                id: true,
                name: true,
                code: true,
                sku: true
              }
            },
            specs: {
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
        prisma.inventoryStocks.count({ where })
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
   * 获取库存流水记录
   */
  async getInventoryLogs(query: InventoryLogQuery) {
    return await this.inventoryLogger.getLogs(query);
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
    return await this.inventoryAlert.getAlerts(query);
  }

  /**
   * 批量检查库存预警
   */
  async checkAllInventoryAlerts(): Promise<void> {
    const result = await this.inventoryAlert.checkAllInventoryAlerts();
    logger.info('批量检查库存预警完成', result);
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
        targetUserId = null;
      }

      const stock = await prisma.inventoryStocks.findFirst({
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
        available: stock.availableQuantity,
        total: stock.quantity,
        reserved: stock.reservedQuantity
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
    return await this.stockOperation.reserveStock(
      productId,
      specId,
      warehouseType as WarehouseType,
      quantity,
      userId
    );
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
    return await this.stockOperation.releaseReservedStock(
      productId,
      specId,
      warehouseType as WarehouseType,
      quantity,
      userId
    );
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
    return await this.stockOperation.consumeReservedStock(
      productId,
      specId,
      warehouseType as WarehouseType,
      quantity,
      userId
    );
  }
}

// 导出单例实例（保持向后兼容）
export const inventoryService = new InventoryService();