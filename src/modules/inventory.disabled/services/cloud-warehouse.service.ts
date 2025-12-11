
import { prisma } from '../../../shared/database/client';
import { logger } from '../../../shared/utils/logger';
import { StockOperationService } from './stock-operation.service';
import {
  InventoryAdjustmentResult,
  InventoryQuery,
  InventoryServiceResponse,
  InventoryStock,
  ManualInParams,
  ManualOutParams,
  PurchaseInParams,
  WarehouseType
} from './types';

/**
 * 云仓管理服务
 * 负责管理店长云仓的库存操作和业务逻辑
 */
export class CloudWarehouseService {
  constructor(private stockOperation: StockOperationService) {}

  /**
   * 店长手动入库到云仓
   */
  async manualIn(
    params: ManualInParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const { userId, warehouseType, ...rest } = params;

    if (warehouseType !== WarehouseType.CLOUD) {
      throw new Error('仓库类型必须是云仓');
    }

    if (!userId) {
      throw new Error('用户ID不能为空');
    }

    try {
      return await this.stockOperation.stockIn({
        ...rest,
        warehouseType: WarehouseType.CLOUD,
        userId,
        operatorId,
        operatorType: 'ADMIN',
        operationType: 'MANUAL_IN',
        reason: rest.reason || '云仓手动入库',
        remarks: rest.remarks || `手动入库数量：${rest.quantity}`
      });
    } catch (error) {
      logger.error('云仓手动入库失败', {
        userId,
        params: rest,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 店长手动出库（从云仓到本地仓）
   */
  async manualOut(
    params: ManualOutParams,
    operatorId: string
  ): Promise<InventoryAdjustmentResult> {
    const { userId, warehouseType, ...rest } = params;

    if (warehouseType !== WarehouseType.CLOUD) {
      throw new Error('仓库类型必须是云仓');
    }

    if (!userId) {
      throw new Error('用户ID不能为空');
    }

    try {
      return await this.stockOperation.stockOut({
        ...rest,
        warehouseType: WarehouseType.CLOUD,
        userId,
        operatorId,
        operatorType: 'ADMIN',
        operationType: 'MANUAL_OUT',
        reason: rest.reason || '云仓手动出库',
        remarks: rest.remarks || `手动出库数量：${rest.quantity}`
      });
    } catch (error) {
      logger.error('云仓手动出库失败', {
        userId,
        params: rest,
        operatorId,
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
        const fromStock = await this.stockOperation.getStock(
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
        const toStock = await this.stockOperation.getOrCreateStock(
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
        const outLog = await tx.inventoryLog.create({
          data: {
            operationType: 'PURCHASE_IN',
            quantity: -quantity,
            quantityBefore: fromQuantityBefore,
            quantityAfter: fromQuantityAfter,
            warehouseType: WarehouseType.CLOUD,
            userId: fromUserId,
            productId,
            specId,
            batchNumber: fromStock.batchNumber,
            relatedOrderId,
            operatorType: 'AUTO',
            adjustmentReason: `采购出库：${quantity}件，单价：${unitPrice}元`,
            remarks: `总金额：${totalAmount}元`
          }
        });

        // 创建入库流水记录
        const inLog = await tx.inventoryLog.create({
          data: {
            operationType: 'PURCHASE_IN',
            quantity: quantity,
            quantityBefore: toQuantityBefore,
            quantityAfter: toQuantityAfter,
            warehouseType: WarehouseType.CLOUD,
            userId: toUserId,
            productId,
            specId,
            batchNumber: fromStock.batchNumber,
            relatedOrderId,
            operatorType: 'AUTO',
            adjustmentReason: `采购入库：${quantity}件，单价：${unitPrice}元`,
            remarks: `总金额：${totalAmount}元`
          }
        });

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
   * 获取店长云仓库存信息
   */
  async getCloudStock(
    userId: string,
    productId: string,
    specId: string
  ): Promise<InventoryStock | null> {
    try {
      return await this.stockOperation.getStock(
        productId,
        specId,
        WarehouseType.CLOUD,
        userId
      );
    } catch (error) {
      logger.error('获取云仓库存信息失败', {
        userId,
        productId,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取店长云仓库存列表
   */
  async getCloudStockList(
    userId: string,
    query: Omit<InventoryQuery, 'warehouseType' | 'userId'> & {
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
        warehouseType: WarehouseType.CLOUD,
        userId
      };

      if (rest.productsId) {
        where.productsId = rest.productsId;
      }

      if (rest.specsId) {
        where.specsId = rest.specsId;
      }

      if (rest.shopId) {
        where.shopId = rest.shopId;
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
      logger.error('获取云仓库存列表失败', {
        userId,
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取店长云仓统计
   */
  async getCloudStatistics(userId: string): Promise<{
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
            warehouseType: WarehouseType.CLOUD,
            userId,
            quantity: { gt: 0 }
          }
        }),
        prisma.inventoryStocks.aggregate({
          where: {
            warehouseType: WarehouseType.CLOUD,
            userId
          },
          _sum: {
            quantity: true
          }
        }),
        prisma.inventoryStocks.findMany({
          where: {
            warehouseType: WarehouseType.CLOUD,
            userId
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
      logger.error('获取云仓统计失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 检查店长是否有足够的云仓库存进行销售
   */
  async checkSalesAvailability(
    userId: string,
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
        const stock = await this.getCloudStock(userId, item.productsId, item.specsId);
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
      logger.error('检查云仓销售可用性失败', {
        userId,
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
   * 从云仓调拨到本地仓
   */
  async transferToLocal(
    userId: string,
    shopId: string,
    productId: string,
    specId: string,
    quantity: number,
    reason?: string
  ): Promise<InventoryAdjustmentResult> {
    if (quantity <= 0) {
      throw new Error('调拨数量必须大于0');
    }

    try {
      return await this.stockOperation.transfer({
        productId,
        specId,
        fromWarehouse: WarehouseType.CLOUD,
        toWarehouse: WarehouseType.LOCAL,
        fromUserId: userId,
        toUserId: userId,
        toShopId: shopId,
        quantity,
        reason: reason || '云仓到本地仓调拨',
        remarks: `店长 ${userId} 调拨 ${quantity} 件到本地仓`
      }, userId);
    } catch (error) {
      logger.error('云仓到本地仓调拨失败', {
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
   * 批量检查多个店长的云仓库存
   */
  async batchCheckCloudStock(
    userIds: string[],
    productId?: string,
    specId?: string
  ): Promise<InventoryServiceResponse<Array<{
    userId: string;
    stocks: InventoryStock[];
    totalQuantity: number;
    totalValue: number;
  }>>> {
    try {
      const results = [];

      for (const userId of userIds) {
        const where: any = {
          warehouseType: WarehouseType.CLOUD,
          userId
        };

        if (productId) {
          where.productsId = productId;
        }

        if (specId) {
          where.specsId = specId;
        }

        const stocks = await prisma.inventoryStocks.findMany({
          where,
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

        let totalQuantity = 0;
        let totalValue = 0;

        for (const stock of stocks) {
          totalQuantity += stock.quantity;
          const price = stock.specs?.price || stock.products?.price || 0;
          totalValue += stock.quantity * price;
        }

        results.push({
          userId,
          stocks: stocks as InventoryStock[],
          totalQuantity,
          totalValue
        });
      }

      return {
        success: true,
        data: results,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('批量检查云仓库存失败', {
        userIds,
        productId,
        specId,
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
   * 获取店长可采购的上级库存列表
   */
  async getAvailableParentStocks(
    userId: string,
    productId: string,
    specId: string
  ): Promise<InventoryServiceResponse<Array<{
    parentUserId: string;
    parentUserName: string;
    stock: InventoryStock;
    availableQuantity: number;
    unitPrice?: number;
  }>>> {
    try {
      // 获取用户的上级（这里需要根据实际业务逻辑实现）
      const parentUsers = await this.getParentUsers(userId);
      const results = [];

      for (const parentUser of parentUsers) {
        const stock = await this.getCloudStock(parentUser.id, productId, specId);

        if (stock && stock.availableQuantity > 0) {
          // 获取采购价格（这里需要根据业务规则计算）
          const unitPrice = await this.calculatePurchasePrice(userId, parentUser.id, productId, specId);

          results.push({
            parentUserId: parentUser.id,
            parentUserName: parentUser.nickname || parentUser.phone,
            stock,
            availableQuantity: stock.availableQuantity,
            unitPrice
          });
        }
      }

      // 按可用数量和价格排序
      results.sort((a, b) => {
        // 优先按可用数量排序
        if (b.availableQuantity !== a.availableQuantity) {
          return b.availableQuantity - a.availableQuantity;
        }
        // 其次按价格排序
        if (a.unitPrice && b.unitPrice) {
          return a.unitPrice - b.unitPrice;
        }
        return 0;
      });

      return {
        success: true,
        data: results,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('获取可采购的上级库存失败', {
        userId,
        productId,
        specId,
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
   * 获取用户的上级列表（示例实现，需要根据实际业务调整）
   */
  private async getParentUsers(userId: string): Promise<Array<{
    id: string;
    nickname?: string;
    phone?: string;
  }>> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          parentId: true
        }
      });

      const parents = [];
      let currentParentId = user?.parentId;

      while (currentParentId) {
        const parent = await prisma.users.findUnique({
          where: { id: currentParentId },
          select: {
            id: true,
            nickname: true,
            phone: true,
            parentId: true
          }
        });

        if (parent) {
          parents.push({
            id: parent.id,
            nickname: parent.nickname || undefined,
            phone: parent.phone || undefined
          });
          currentParentId = parent.parentId;
        } else {
          break;
        }

        // 限制层级深度，避免无限循环
        if (parents.length > 10) {
          break;
        }
      }

      return parents;
    } catch (error) {
      logger.error('获取用户上级列表失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 计算采购价格（示例实现，需要根据实际业务规则调整）
   */
  private async calculatePurchasePrice(
    userId: string,
    parentUserId: string,
    productId: string,
    specId: string
  ): Promise<number | undefined> {
    try {
      // 获取产品的基础价格
      const product = await prisma.productsss.findUnique({
        where: { id: productId },
        select: { basePrice: true }
      });

      const spec = await prisma.productSpecs.findUnique({
        where: { id: specId },
        select: { price: true }
      });

      // 使用规格价格，如果没有则使用产品基础价格
      const basePrice = spec?.price || product?.basePrice;

      if (!basePrice) {
        return undefined;
      }

      // 根据用户等级计算折扣（示例逻辑）
      const [user, parentUser] = await Promise.all([
        prisma.userss.findUnique({
          where: { id: userId },
          select: { level: true }
        }),
        prisma.userss.findUnique({
          where: { id: parentUserId },
          select: { level: true }
        })
      ]);

      // 这里可以根据业务规则实现更复杂的价格计算
      // 例如：根据等级差、促销活动等
      return basePrice;
    } catch (error) {
      logger.error('计算采购价格失败', {
        userId,
        parentUserId,
        productId,
        specId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return undefined;
    }
  }
}

// 延迟初始化以避免循环依赖
let cloudWarehouseServiceInstance: CloudWarehouseService;

export const cloudWarehouseService = {
  get instance(): CloudWarehouseService {
    if (!cloudWarehouseServiceInstance) {
      const { batchManagerService } = require('./batch-manager.service');
      const { inventoryLoggerService } = require('./inventory-logger.service');
      const { inventoryAlertService } = require('./inventory-alert.service');
      const stockOperationService = new StockOperationService(
        batchManagerService,
        inventoryLoggerService,
        inventoryAlertService
      );
      cloudWarehouseServiceInstance = new CloudWarehouseService(stockOperationService);
    }
    return cloudWarehouseServiceInstance;
  }
};