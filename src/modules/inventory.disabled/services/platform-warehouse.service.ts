import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import {
  WarehouseType,
  InventoryStock,
  InventoryQuery,
  ManualInParams,
  ManualOutParams,
  InventoryAdjustmentResult,
  InventoryServiceResponse
} from './types';
import { StockOperationService } from './stock-operation.service';

/**
 * 平台总仓管理服务
 * 负责管理平台总仓的库存操作和统计
 */
export class PlatformWarehouseService {
  constructor(private stockOperation: StockOperationService) {}

  /**
   * 初始化平台总仓库存
   */
  async initializePlatformStock(
    productId: string,
    specId: string,
    initialQuantity: number,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    try {
      // 检查是否已存在库存
      const existingStock = await this.stockOperation.getStock(
        productId,
        specId,
        WarehouseType.PLATFORM
      );

      if (existingStock && existingStock.quantity > 0) {
        throw new Error('平台总仓已有库存，无法重复初始化');
      }

      return await this.stockOperation.stockIn({
        productId,
        specId,
        warehouseType: WarehouseType.PLATFORM,
        quantity: initialQuantity,
        operatorId,
        operatorType: 'ADMIN',
        operationType: 'INITIAL',
        reason: '初始化平台总仓库存',
        remarks: `初始数量：${initialQuantity}`
      });
    } catch (error) {
      logger.error('初始化平台总仓库存失败', {
        productId,
        specId,
        initialQuantity,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 向平台总仓补货
   */
  async replenish(
    params: ManualInParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const { productId, specId, quantity, reason, remarks, ...rest } = params;

    if (params.warehouseType !== WarehouseType.PLATFORM) {
      throw new Error('仓库类型必须是平台总仓');
    }

    try {
      return await this.stockOperation.stockIn({
        productId,
        specId,
        warehouseType: WarehouseType.PLATFORM,
        quantity,
        operatorId,
        operatorType: 'ADMIN',
        operationType: 'MANUAL_IN',
        reason: reason || '平台总仓补货',
        remarks: remarks || `补货数量：${quantity}`,
        ...rest
      });
    } catch (error) {
      logger.error('平台总仓补货失败', {
        productId,
        specId,
        quantity,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 从平台总仓出库（分配给下级）
   */
  async distribute(
    params: ManualOutParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const { productId, specId, quantity, reason, remarks } = params;

    if (params.warehouseType !== WarehouseType.PLATFORM) {
      throw new Error('仓库类型必须是平台总仓');
    }

    try {
      return await this.stockOperation.stockOut({
        productId,
        specId,
        warehouseType: WarehouseType.PLATFORM,
        quantity,
        operatorId,
        operatorType: 'ADMIN',
        operationType: 'MANUAL_OUT',
        reason: reason || '平台总仓分配',
        remarks: remarks || `分配数量：${quantity}`
      });
    } catch (error) {
      logger.error('平台总仓出库失败', {
        productId,
        specId,
        quantity,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取平台总仓库存信息
   */
  async getPlatformStock(
    productId: string,
    specId: string
  ): Promise<InventoryStock | null> {
    try {
      return await this.stockOperation.getStock(
        productId,
        specId,
        WarehouseType.PLATFORM
      );
    } catch (error) {
      logger.error('获取平台总仓库存信息失败', {
        productId,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取平台总仓库存列表
   */
  async getPlatformStockList(
    query: Omit<InventoryQuery, 'warehouseType'> & {
      lowStockThreshold?: number;
    }
  ): Promise<{
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
    try {
      const { lowStockThreshold, ...rest } = query;

      // 构建查询条件
      const where: any = {
        warehouseType: WarehouseType.PLATFORM
      };

      if (rest.productsId) {
        where.productsId = rest.productsId;
      }

      if (rest.specsId) {
        where.specsId = rest.specsId;
      }

      if (lowStockThreshold) {
        where.quantity = { lte: lowStockThreshold };
      } else if (rest.lowStock) {
        where.quantity = { lte: 10 }; // 默认低库存阈值
      }

      const skip = ((rest.page || 1) - 1) * (rest.perPage || 20);

      const [stocks, total] = await Promise.all([
        prisma.inventoryStocks.findMany({
          where,
          skip,
          take: rest.perPage || 20,
          orderBy: { updatedAt: 'desc' },
          include: {
            products: {
              select: {
                id: true,
                name: true,
                code: true,
                sku: true,
                price: true
              }
            },
            specs: {
              select: {
                id: true,
                name: true,
                sku: true,
                lowStockThreshold: true,
                outOfStockThreshold: true,
                price: true
              }
            }
          }
        }),
        prisma.inventoryStocks.count({ where })
      ]);

      const page = rest.page || 1;
      const perPage = rest.perPage || 20;

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
      logger.error('获取平台总仓库存列表失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取平台总仓库存统计
   */
  async getPlatformStatistics(): Promise<{
    totalProducts: number;
    totalQuantity: number;
    totalValue: number;
    lowStockProducts: number;
    outOfStockProducts: number;
    categoryStats: Array<{
      categoryId: string;
      categoryName: string;
      productCount: number;
      totalQuantity: number;
      totalValue: number;
    }>;
  }> {
    try {
      // 获取基本统计
      const [
        totalProducts,
        totalQuantityResult,
        stocks
      ] = await Promise.all([
        prisma.inventoryStocks.count({
          where: {
            warehouseType: WarehouseType.PLATFORM,
            quantity: { gt: 0 }
          }
        }),
        prisma.inventoryStocks.aggregate({
          where: {
            warehouseType: WarehouseType.PLATFORM
          },
          _sum: {
            quantity: true
          }
        }),
        prisma.inventoryStocks.findMany({
          where: {
            warehouseType: WarehouseType.PLATFORM
          },
          include: {
            products: {
              include: {
                category: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              },
              select: {
                id: true,
                name: true,
                code: true,
                price: true,
                category: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            specs: {
              select: {
                price: true
              }
            }
          }
        })
      ]);

      // 计算总价值和低库存产品
      let totalValue = 0;
      let lowStockProducts = 0;
      let outOfStockProducts = 0;

      // 按分类统计
      const categoryMap = new Map<string, {
        categoryName: string;
        productCount: number;
        totalQuantity: number;
        totalValue: number;
      }>();

      for (const stock of stocks) {
        const price = stock.specs?.price || stock.products?.price || 0;
        const value = stock.quantity * price;
        totalValue += value;

        if (stock.quantity === 0) {
          outOfStockProducts++;
        } else if (stock.quantity <= 10) { // 假设10以下为低库存
          lowStockProducts++;
        }

        // 分类统计
        if (stock.products.category) {
          const categoryId = stock.products.category.id;
          if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, {
              categoryName: stock.products.category.name,
              productCount: 0,
              totalQuantity: 0,
              totalValue: 0
            });
          }

          const categoryStat = categoryMap.get(categoryId)!;
          categoryStat.productsCount++;
          categoryStat.totalQuantity += stock.quantity;
          categoryStat.totalValue += value;
        }
      }

      const categoryStats = Array.from(categoryMap.entries()).map(([id, stat]) => ({
        categoryId: id,
        ...stat
      }));

      return {
        totalProducts,
        totalQuantity: Number(totalQuantityResult._sum.quantity || 0),
        totalValue,
        lowStockProducts,
        outOfStockProducts,
        categoryStats
      };
    } catch (error) {
      logger.error('获取平台总仓统计失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 批量设置平台总仓库存
   */
  async batchSetStock(
    stocks: Array<{
      productId: string;
      specId: string;
      quantity: number;
      reason?: string;
    }>,
    operatorId: string
  ): Promise<InventoryServiceResponse<{
    successCount: number;
    failureCount: number;
    results: Array<{
      productId: string;
      specId: string;
      success: boolean;
      error?: string;
    }>;
  }>> {
    try {
      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (const stockItem of stocks) {
        try {
          // 获取当前库存
          const currentStock = await this.getPlatformStock(
            stockItem.productsId,
            stockItem.specsId
          );

          if (currentStock) {
            // 调整库存
            const difference = stockItem.quantity - currentStock.quantity;
            if (difference > 0) {
              // 入库
              await this.replenish({
                productId: stockItem.productsId,
                specId: stockItem.specsId,
                warehouseType: WarehouseType.PLATFORM,
                quantity: difference,
                reason: stockItem.reason || '批量设置库存',
                remarks: `从 ${currentStock.quantity} 调整到 ${stockItem.quantity}`
              }, operatorId);
            } else if (difference < 0) {
              // 出库
              await this.distribute({
                productId: stockItem.productsId,
                specId: stockItem.specsId,
                warehouseType: WarehouseType.PLATFORM,
                quantity: Math.abs(difference),
                reason: stockItem.reason || '批量设置库存',
                remarks: `从 ${currentStock.quantity} 调整到 ${stockItem.quantity}`
              }, operatorId);
            }
          } else {
            // 初始化库存
            await this.initializePlatformStock(
              stockItem.productsId,
              stockItem.specsId,
              stockItem.quantity,
              operatorId
            );
          }

          results.push({
            productId: stockItem.productsId,
            specId: stockItem.specsId,
            success: true
          });
          successCount++;
        } catch (error) {
          results.push({
            productId: stockItem.productsId,
            specId: stockItem.specsId,
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
          });
          failureCount++;
        }
      }

      logger.info('批量设置平台总仓库存完成', {
        totalStocks: stocks.length,
        successCount,
        failureCount
      });

      return {
        success: true,
        data: {
          successCount,
          failureCount,
          results
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('批量设置平台总仓库存失败', {
        stocksCount: stocks.length,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      };
    }
  }

  /**
   * 检查平台总仓库存是否充足
   */
  async checkStockAvailability(
    items: Array<{
      productId: string;
      specId: string;
      quantity: number;
    }>
  ): Promise<InventoryServiceResponse<{
    allAvailable: boolean;
    insufficientItems: Array<{
      productId: string;
      specId: string;
      requested: number;
      available: number;
      shortage: number;
    }>;
  }>> {
    try {
      const insufficientItems = [];
      let allAvailable = true;

      for (const item of items) {
        const stock = await this.getPlatformStock(item.productsId, item.specsId);
        const available = stock?.availableQuantity || 0;

        if (available < item.quantity) {
          insufficientItems.push({
            productId: item.productsId,
            specId: item.specsId,
            requested: item.quantity,
            available,
            shortage: item.quantity - available
          });
          allAvailable = false;
        }
      }

      return {
        success: true,
        data: {
          allAvailable,
          insufficientItems
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('检查平台总仓库存可用性失败', {
        items,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      };
    }
  }

  /**
   * 同步平台总仓库存到缓存
   */
  async syncToCache(
    productIds?: string[]
  ): Promise<InventoryServiceResponse<{
    syncedCount: number;
  }>> {
    try {
      const where: any = {
        warehouseType: WarehouseType.PLATFORM
      };

      if (productIds && productIds.length > 0) {
        where.productsId = { in: productIds };
      }

      const stocks = await prisma.inventoryStocks.findMany({
        where,
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
              sku: true
            }
          }
        }
      });

      // 这里可以将库存同步到Redis或其他缓存系统
      // 示例：假设有一个缓存服务
      // for (const stock of stocks) {
      //   await cacheService.set(
      //     `platform_stock:${stock.productsId}:${stock.specsId}`,
      //     {
      //       quantity: stock.quantity,
      //       availableQuantity: stock.availableQuantity,
      //       reservedQuantity: stock.reservedQuantity
      //     },
      //     3600 // 1小时过期
      //   );
      // }

      logger.info('平台总仓库存同步到缓存完成', {
        syncedCount: stocks.length
      });

      return {
        success: true,
        data: {
          syncedCount: stocks.length
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('同步平台总仓库存到缓存失败', {
        productIds,
        error: error instanceof Error ? error.message : '未知错误'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date()
      };
    }
  }
}

// 延迟初始化以避免循环依赖
let platformWarehouseServiceInstance: PlatformWarehouseService;

export const platformWarehouseService = {
  get instance(): PlatformWarehouseService {
    if (!platformWarehouseServiceInstance) {
      const { batchManagerService } = require('./batch-manager.service');
      const { inventoryLoggerService } = require('./inventory-logger.service');
      const { inventoryAlertService } = require('./inventory-alert.service');
      const stockOperationService = new StockOperationService(
        batchManagerService,
        inventoryLoggerService,
        inventoryAlertService
      );
      platformWarehouseServiceInstance = new PlatformWarehouseService(stockOperationService);
    }
    return platformWarehouseServiceInstance;
  }
};