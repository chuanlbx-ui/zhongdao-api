import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import {
  WarehouseType,
  InventoryStock,
  InventoryQuery,
  ManualInParams,
  ManualOutParams,
  InventoryAdjustmentResult,
  InventoryServiceResponse,
  OrderOutParams
} from './types';
import { StockOperationService } from './stock-operation.service';

/**
 * 本地仓管理服务
 * 负责管理店长本地仓的库存操作和业务逻辑
 */
export class LocalWarehouseService {
  constructor(private stockOperation: StockOperationService) {}

  /**
   * 店长手动入库到本地仓
   */
  async manualIn(
    params: ManualInParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const { userId, shopId, warehouseType, ...rest } = params;

    if (warehouseType !== WarehouseType.LOCAL) {
      throw new Error('仓库类型必须是本地仓');
    }

    if (!userId) {
      throw new Error('用户ID不能为空');
    }

    if (!shopId) {
      throw new Error('店铺ID不能为空');
    }

    try {
      return await this.stockOperation.stockIn({
        ...rest,
        warehouseType: WarehouseType.LOCAL,
        userId,
        shopId,
        operatorId,
        operatorType: 'ADMIN',
        operationType: 'MANUAL_IN',
        reason: rest.reason || '本地仓手动入库',
        remarks: rest.remarks || `手动入库数量：${rest.quantity}`
      });
    } catch (error) {
      logger.error('本地仓手动入库失败', {
        userId,
        shopId,
        params: rest,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 店长手动出库（本地仓出库）
   */
  async manualOut(
    params: ManualOutParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const { userId, shopId, warehouseType, ...rest } = params;

    if (warehouseType !== WarehouseType.LOCAL) {
      throw new Error('仓库类型必须是本地仓');
    }

    if (!userId) {
      throw new Error('用户ID不能为空');
    }

    if (!shopId) {
      throw new Error('店铺ID不能为空');
    }

    try {
      return await this.stockOperation.stockOut({
        ...rest,
        warehouseType: WarehouseType.LOCAL,
        userId,
        shopId,
        operatorId,
        operatorType: 'ADMIN',
        operationType: 'MANUAL_OUT',
        reason: rest.reason || '本地仓手动出库',
        remarks: rest.remarks || `手动出库数量：${rest.quantity}`
      });
    } catch (error) {
      logger.error('本地仓手动出库失败', {
        userId,
        shopId,
        params: rest,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 销售出库（从云仓到本地仓，供发货使用）
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
        const cloudStock = await this.stockOperation.getStock(
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
        const localStock = await this.stockOperation.getOrCreateStock(
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
        const cloudOutLog = await tx.inventoryLog.create({
          data: {
            operationType: 'ORDER_OUT',
            quantity: -quantity,
            quantityBefore: cloudQuantityBefore,
            quantityAfter: cloudQuantityAfter,
            warehouseType: WarehouseType.CLOUD,
            userId,
            productId,
            specId,
            batchNumber: cloudStock.batchNumber,
            relatedOrderId,
            operatorType: 'AUTO',
            adjustmentReason: '订单出库：云仓到本地仓',
            remarks: `发货地址：${deliveryAddress || '默认地址'}`
          }
        });

        // 创建本地仓入库流水记录
        const localInLog = await tx.inventoryLog.create({
          data: {
            operationType: 'ORDER_OUT',
            quantity: quantity,
            quantityBefore: localQuantityBefore,
            quantityAfter: localQuantityAfter,
            warehouseType: WarehouseType.LOCAL,
            userId,
            shopId,
            productId,
            specId,
            batchNumber: cloudStock.batchNumber,
            relatedOrderId,
            operatorType: 'AUTO',
            adjustmentReason: '订单入库：云仓到本地仓',
            remarks: `发货地址：${deliveryAddress || '默认地址'}`
          }
        });

        // 更新平台总库存
        const platformStock = await this.stockOperation.getStock(
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
          await tx.inventoryLog.create({
            data: {
              operationType: 'ORDER_OUT',
              quantity: -quantity,
              quantityBefore: platformQuantityBefore,
              quantityAfter: platformQuantityAfter,
              warehouseType: WarehouseType.PLATFORM,
              productId,
              specId,
              batchNumber: platformStock.batchNumber,
              relatedOrderId,
              operatorType: 'AUTO',
              adjustmentReason: '订单出库：平台总库存减少',
              remarks: `店长：${userId}，数量：${quantity}`
            }
          });
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
   * 获取店长本地仓库存信息
   */
  async getLocalStock(
    userId: string,
    shopId: string,
    productId: string,
    specId: string
  ): Promise<InventoryStock | null> {
    try {
      return await this.stockOperation.getStock(
        productId,
        specId,
        WarehouseType.LOCAL,
        userId,
        shopId
      );
    } catch (error) {
      logger.error('获取本地仓库存信息失败', {
        userId,
        shopId,
        productId,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取店长本地仓库存列表
   */
  async getLocalStockList(
    userId: string,
    shopId: string,
    query: Omit<InventoryQuery, 'warehouseType' | 'userId' | 'shopId'> & {
      lowStockThreshold?: number;
    } = {}
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
        warehouseType: WarehouseType.LOCAL,
        userId,
        shopId
      };

      if (rest.productsId) {
        where.productsId = rest.productsId;
      }

      if (rest.specsId) {
        where.specsId = rest.specsId;
      }

      if (rest.batchNumber) {
        where.batchNumber = rest.batchNumber;
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
      logger.error('获取本地仓库存列表失败', {
        userId,
        shopId,
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取店长本地仓统计
   */
  async getLocalStatistics(
    userId: string,
    shopId: string
  ): Promise<{
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
    locationStats: Array<{
      location: string;
      productCount: number;
      totalQuantity: number;
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
            warehouseType: WarehouseType.LOCAL,
            userId,
            shopId,
            quantity: { gt: 0 }
          }
        }),
        prisma.inventoryStocks.aggregate({
          where: {
            warehouseType: WarehouseType.LOCAL,
            userId,
            shopId
          },
          _sum: {
            quantity: true
          }
        }),
        prisma.inventoryStocks.findMany({
          where: {
            warehouseType: WarehouseType.LOCAL,
            userId,
            shopId
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

      // 按库位统计
      const locationMap = new Map<string, {
        productCount: number;
        totalQuantity: number;
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

        // 库位统计
        const location = stock.location || '未指定';
        if (!locationMap.has(location)) {
          locationMap.set(location, {
            productCount: 0,
            totalQuantity: 0
          });
        }

        const locationStat = locationMap.get(location)!;
        locationStat.productsCount++;
        locationStat.totalQuantity += stock.quantity;
      }

      const categoryStats = Array.from(categoryMap.entries()).map(([id, stat]) => ({
        categoryId: id,
        ...stat
      }));

      const locationStats = Array.from(locationMap.entries()).map(([location, stat]) => ({
        location,
        ...stat
      }));

      return {
        totalProducts,
        totalQuantity: Number(totalQuantityResult._sum.quantity || 0),
        totalValue,
        lowStockProducts,
        outOfStockProducts,
        categoryStats,
        locationStats
      };
    } catch (error) {
      logger.error('获取本地仓统计失败', {
        userId,
        shopId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 更新本地仓库存位置
   */
  async updateLocation(
    userId: string,
    shopId: string,
    productId: string,
    specId: string,
    location: string
  ): Promise<boolean> {
    try {
      await prisma.inventoryStocks.updateMany({
        where: {
          productId,
          specId,
          warehouseType: WarehouseType.LOCAL,
          userId,
          shopId
        },
        data: {
          location,
          updatedAt: new Date()
        }
      });

      logger.info('更新本地仓位置成功', {
        userId,
        shopId,
        productId,
        specId,
        location
      });

      return true;
    } catch (error) {
      logger.error('更新本地仓位置失败', {
        userId,
        shopId,
        productId,
        specId,
        location,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 批量更新本地仓位置
   */
  async batchUpdateLocation(
    userId: string,
    shopId: string,
    updates: Array<{
      productId: string;
      specId: string;
      location: string;
    }>
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

      for (const update of updates) {
        try {
          await this.updateLocation(
            userId,
            shopId,
            update.productsId,
            update.specsId,
            update.location
          );

          results.push({
            productId: update.productsId,
            specId: update.specsId,
            success: true
          });
          successCount++;
        } catch (error) {
          results.push({
            productId: update.productsId,
            specId: update.specsId,
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
          });
          failureCount++;
        }
      }

      logger.info('批量更新本地仓位置完成', {
        userId,
        shopId,
        totalUpdates: updates.length,
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
      logger.error('批量更新本地仓位置失败', {
        userId,
        shopId,
        updatesCount: updates.length,
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
   * 获取本地仓库存位置分布
   */
  async getLocationDistribution(
    userId: string,
    shopId: string
  ): Promise<InventoryServiceResponse<Array<{
    location: string;
    productCount: number;
    totalQuantity: number;
    totalValue: number;
    products: Array<{
      productId: string;
      productName: string;
      specId: string;
      specName: string;
      quantity: number;
      value: number;
    }>;
  }>>> {
    try {
      const stocks = await prisma.inventoryStocks.findMany({
        where: {
          warehouseType: WarehouseType.LOCAL,
          userId,
          shopId,
          quantity: { gt: 0 }
        },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              code: true,
              price: true
            }
          },
          specs: {
            select: {
              id: true,
              name: true,
              price: true
            }
          }
        }
      });

      // 按位置分组
      const locationMap = new Map<string, {
        productCount: number;
        totalQuantity: number;
        totalValue: number;
        products: Array<{
          productId: string;
          productName: string;
          specId: string;
          specName: string;
          quantity: number;
          value: number;
        }>;
      }>();

      for (const stock of stocks) {
        const location = stock.location || '未指定';
        const price = stock.specs?.price || stock.products?.price || 0;
        const value = stock.quantity * price;

        if (!locationMap.has(location)) {
          locationMap.set(location, {
            productCount: 0,
            totalQuantity: 0,
            totalValue: 0,
            products: []
          });
        }

        const locationStat = locationMap.get(location)!;
        locationStat.productsCount++;
        locationStat.totalQuantity += stock.quantity;
        locationStat.totalValue += value;
        locationStat.productss.push({
          productId: stock.products.id,
          productName: stock.products.name,
          specId: stock.specs.id,
          specName: stock.specs.name,
          quantity: stock.quantity,
          value
        });
      }

      const results = Array.from(locationMap.entries()).map(([location, stat]) => ({
        location,
        ...stat
      }));

      // 按总价值排序
      results.sort((a, b) => b.totalValue - a.totalValue);

      return {
        success: true,
        data: results,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('获取本地仓位置分布失败', {
        userId,
        shopId,
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
   * 生成本地仓库存报告
   */
  async generateInventoryReport(
    userId: string,
    shopId: string,
    options: {
      includeZeroStock?: boolean;
      categoryIds?: string[];
      locationIds?: string[];
    } = {}
  ): Promise<InventoryServiceResponse<{
    summary: {
      totalProducts: number;
      totalQuantity: number;
      totalValue: number;
      locations: number;
      categories: number;
    };
    stocks: Array<{
      products: {
        id: string;
        name: string;
        code: string;
        categoryName: string;
      };
      specs: {
        id: string;
        name: string;
        sku: string;
      };
      stock: {
        quantity: number;
        reservedQuantity: number;
        availableQuantity: number;
        location: string;
        batchNumber: string;
        value: number;
      };
    }>;
  }>> {
    try {
      const { includeZeroStock, categoryIds, locationIds } = options;

      // 构建查询条件
      const where: any = {
        warehouseType: WarehouseType.LOCAL,
        userId,
        shopId
      };

      if (!includeZeroStock) {
        where.quantity = { gt: 0 };
      }

      const stocks = await prisma.inventoryStocks.findMany({
        where,
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
              id: true,
              name: true,
              sku: true,
              price: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        }
      });

      // 过滤和转换数据
      let filteredStocks = stocks;

      if (categoryIds && categoryIds.length > 0) {
        filteredStocks = filteredStocks.filter(
          stock => stock.products.categoryId && categoryIds.includes(stock.products.categoryId)
        );
      }

      if (locationIds && locationIds.length > 0) {
        filteredStocks = filteredStocks.filter(
          stock => stock.location && locationIds.includes(stock.location)
        );
      }

      // 转换为报告格式
      const reportStocks = filteredStocks.map(stock => {
        const price = stock.specs?.price || stock.products?.price || 0;
        const value = stock.quantity * price;

        return {
          products: {
            id: stock.products.id,
            name: stock.products.name,
            code: stock.products.code,
            categoryName: stock.products.category?.name || '未分类'
          },
          specs: {
            id: stock.specs.id,
            name: stock.specs.name,
            sku: stock.specs.sku
          },
          stock: {
            quantity: stock.quantity,
            reservedQuantity: stock.reservedQuantity,
            availableQuantity: stock.availableQuantity,
            location: stock.location || '未指定',
            batchNumber: stock.batchNumber || '无批次',
            value
          }
        };
      });

      // 计算汇总信息
      const totalProducts = reportStocks.length;
      const totalQuantity = reportStocks.reduce((sum, item) => sum + item.stock.quantity, 0);
      const totalValue = reportStocks.reduce((sum, item) => sum + item.stock.value, 0);
      const locations = new Set(reportStocks.map(item => item.stock.location)).size;
      const categories = new Set(reportStocks.map(item => item.products.categoryName)).size;

      const summary = {
        totalProducts,
        totalQuantity,
        totalValue,
        locations,
        categories
      };

      return {
        success: true,
        data: {
          summary,
          stocks: reportStocks
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('生成本地仓库存报告失败', {
        userId,
        shopId,
        options,
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

// 导出单例实例
export const localWarehouseService = new LocalWarehouseService(
  new StockOperationService(
    new (await import('./batch-manager.service')).batchManagerService(),
    new (await import('./inventory-logger.service')).inventoryLoggerService(),
    new (await import('./inventory-alert.service')).inventoryAlertService()
  )
);