import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { BatchInfo } from './types';

/**
 * 批次管理服务
 * 负责管理库存批次，包括批次号生成、批次信息跟踪等
 */
export class BatchManagerService {
  /**
   * 生成批次号
   * 格式：B{时间戳}{随机字符串}
   */
  generateBatchNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `B${timestamp}${random}`.toUpperCase();
  }

  /**
   * 获取批次信息
   */
  async getBatchInfo(batchNumber: string): Promise<BatchInfo | null> {
    try {
      const batch = await prisma.inventoryStocks.findFirst({
        where: {
          batchNumber
        },
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

      if (!batch) {
        return null;
      }

      // 计算批次状态
      let status: 'ACTIVE' | 'EXPIRED' | 'USED_UP' = 'ACTIVE';
      const now = new Date();

      if (batch.expiryDate && batch.expiryDate < now) {
        status = 'EXPIRED';
      } else if (batch.quantity <= 0) {
        status = 'USED_UP';
      }

      return {
        batchNumber: batch.batchNumber!,
        productId: batch.productsId,
        specId: batch.specsId,
        quantity: batch.quantity,
        availableQuantity: batch.availableQuantity,
        manufacturingDate: undefined, // 如果需要可以从其他地方获取
        expiryDate: batch.expiryDate || undefined,
        location: batch.location,
        status
      };
    } catch (error) {
      logger.error('获取批次信息失败', {
        batchNumber,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取产品的所有批次
   */
  async getProductBatches(
    productId: string,
    specId?: string,
    warehouseType?: string,
    userId?: string
  ): Promise<BatchInfo[]> {
    try {
      const where: any = {
        productId,
        batchNumber: { not: null }
      };

      if (specId) {
        where.specsId = specId;
      }

      if (warehouseType) {
        where.warehouseType = warehouseType;
      }

      if (userId) {
        where.userId = userId;
      }

      const batches = await prisma.inventoryStocks.findMany({
        where,
        select: {
          batchNumber: true,
          productId: true,
          specId: true,
          quantity: true,
          availableQuantity: true,
          expiryDate: true,
          location: true
        }
      });

      // 转换为批次信息格式
      const batchInfos: BatchInfo[] = [];
      const now = new Date();

      for (const batch of batches) {
        if (!batch.batchNumber) continue;

        let status: 'ACTIVE' | 'EXPIRED' | 'USED_UP' = 'ACTIVE';

        if (batch.expiryDate && batch.expiryDate < now) {
          status = 'EXPIRED';
        } else if (batch.quantity <= 0) {
          status = 'USED_UP';
        }

        batchInfos.push({
          batchNumber: batch.batchNumber,
          productId: batch.productsId,
          specId: batch.specsId,
          quantity: batch.quantity,
          availableQuantity: batch.availableQuantity,
          expiryDate: batch.expiryDate || undefined,
          location: batch.location,
          status
        });
      }

      return batchInfos.sort((a, b) => {
        // 优先返回未过期的批次
        if (a.status !== b.status) {
          if (a.status === 'ACTIVE') return -1;
          if (b.status === 'ACTIVE') return 1;
          if (a.status === 'EXPIRED') return -1;
          if (b.status === 'EXPIRED') return 1;
        }

        // 同状态的按过期日期排序
        if (a.expiryDate && b.expiryDate) {
          return a.expiryDate.getTime() - b.expiryDate.getTime();
        }

        return 0;
      });
    } catch (error) {
      logger.error('获取产品批次列表失败', {
        productId,
        specId,
        warehouseType,
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 检查批次是否过期
   */
  async checkBatchExpiry(batchNumber: string): Promise<{
    isExpired: boolean;
    daysUntilExpiry: number | null;
    expiryDate: Date | null;
  }> {
    try {
      const batch = await prisma.inventoryStocks.findFirst({
        where: {
          batchNumber
        },
        select: {
          expiryDate: true
        }
      });

      if (!batch || !batch.expiryDate) {
        return {
          isExpired: false,
          daysUntilExpiry: null,
          expiryDate: null
        };
      }

      const now = new Date();
      const expiryDate = new Date(batch.expiryDate);
      const isExpired = expiryDate < now;
      const daysUntilExpiry = isExpired
        ? 0
        : Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        isExpired,
        daysUntilExpiry,
        expiryDate
      };
    } catch (error) {
      logger.error('检查批次过期状态失败', {
        batchNumber,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取即将过期的批次列表
   */
  async getExpiringBatches(daysThreshold: number = 30): Promise<BatchInfo[]> {
    try {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

      const batches = await prisma.inventoryStocks.findMany({
        where: {
          batchNumber: { not: null },
          expiryDate: {
            not: null,
            lte: thresholdDate,
            gte: new Date()
          },
          quantity: { gt: 0 }
        },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          specs: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          }
        },
        orderBy: {
          expiryDate: 'asc'
        }
      });

      const batchInfos: BatchInfo[] = [];
      const now = new Date();

      for (const batch of batches) {
        if (!batch.batchNumber || !batch.expiryDate) continue;

        batchInfos.push({
          batchNumber: batch.batchNumber,
          productId: batch.productsId,
          specId: batch.specsId,
          quantity: batch.quantity,
          availableQuantity: batch.availableQuantity,
          expiryDate: batch.expiryDate,
          location: batch.location,
          status: batch.expiryDate < now ? 'EXPIRED' : 'ACTIVE'
        });
      }

      return batchInfos;
    } catch (error) {
      logger.error('获取即将过期批次列表失败', {
        daysThreshold,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 更新批次信息
   */
  async updateBatchInfo(
    batchNumber: string,
    updates: {
      location?: string;
      expiryDate?: Date;
    }
  ): Promise<boolean> {
    try {
      await prisma.inventoryStocks.updateMany({
        where: {
          batchNumber
        },
        data: updates
      });

      logger.info('更新批次信息成功', {
        batchNumber,
        updates
      });

      return true;
    } catch (error) {
      logger.error('更新批次信息失败', {
        batchNumber,
        updates,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 根据先进先出(FIFO)原则选择批次
   */
  async selectBatchForOperation(
    productId: string,
    specId: string,
    warehouseType: string,
    userId?: string,
    shopId?: string,
    quantity: number = 1
  ): Promise<string | null> {
    try {
      // 获取符合条件的批次，按创建时间排序（先进先出）
      const batches = await prisma.inventoryStocks.findMany({
        where: {
          productId,
          specId,
          warehouseType,
          userId: userId || null,
          shopId: shopId || null,
          availableQuantity: { gte: quantity },
          batchNumber: { not: null }
        },
        select: {
          batchNumber: true,
          createdAt: true,
          expiryDate: true
        },
        orderBy: [
          { expiryDate: 'asc' }, // 优先使用即将过期的
          { createdAt: 'asc' }   // 其次是先进先出
        ]
      });

      if (batches.length === 0) {
        return null;
      }

      // 返回第一个符合条件的批次
      return batches[0].batchNumber;
    } catch (error) {
      logger.error('选择操作批次失败', {
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
   * 获取批次库存统计
   */
  async getBatchStatistics(): Promise<{
    totalBatches: number;
    activeBatches: number;
    expiredBatches: number;
    usedUpBatches: number;
    expiringSoonBatches: number;
  }> {
    try {
      const now = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(now.getDate() + 30);

      const [
        totalBatches,
        activeBatches,
        expiredBatches,
        usedUpBatches,
        expiringSoonBatches
      ] = await Promise.all([
        // 总批次数
        prisma.inventoryStocks.count({
          where: {
            batchNumber: { not: null }
          }
        }),
        // 活跃批次数（未过期且有库存）
        prisma.inventoryStocks.count({
          where: {
            batchNumber: { not: null },
            quantity: { gt: 0 },
            OR: [
              { expiryDate: null },
              { expiryDate: { gt: now } }
            ]
          }
        }),
        // 过期批次数
        prisma.inventoryStocks.count({
          where: {
            batchNumber: { not: null },
            expiryDate: {
              not: null,
              lte: now
            }
          }
        }),
        // 已用完批次数
        prisma.inventoryStocks.count({
          where: {
            batchNumber: { not: null },
            quantity: { lte: 0 }
          }
        }),
        // 即将过期批次数（30天内）
        prisma.inventoryStocks.count({
          where: {
            batchNumber: { not: null },
            quantity: { gt: 0 },
            expiryDate: {
              not: null,
              lte: thirtyDaysLater,
              gt: now
            }
          }
        })
      ]);

      return {
        totalBatches,
        activeBatches,
        expiredBatches,
        usedUpBatches,
        expiringSoonBatches
      };
    } catch (error) {
      logger.error('获取批次统计失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const batchManagerService = new BatchManagerService();