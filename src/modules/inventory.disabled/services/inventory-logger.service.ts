import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import {
  InventoryOperationType,
  OperatorType,
  InventoryLog,
  StockSyncEvent,
  InventoryServiceResponse
} from './types';

/**
 * 库存日志记录服务
 * 负责记录所有库存操作的流水日志
 */
export class InventoryLoggerService {
  /**
   * 创建库存流水记录
   */
  async createLog(
    operationType: InventoryOperationType,
    quantity: number,
    quantityBefore: number,
    quantityAfter: number,
    warehouseType: string,
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
    try {
      const log = await prisma.inventoryLogssss.create({
        data: {
          operationType,
          quantity,
          quantityBefore,
          quantityAfter,
          warehouseType: warehouseType as any,
          userId: options.userId || null,
          shopId: options.shopId || null,
          productId,
          specId,
          batchNumber: options.batchNumber || null,
          relatedOrderId: options.relatedOrderId || null,
          relatedPurchaseId: options.relatedPurchaseId || null,
          adjustmentReason: options.adjustmentReason || null,
          operatorType,
          operatorId: options.operatorId || null,
          remarks: options.remarks || null
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
   * 批量创建库存日志（用于批量操作）
   */
  async createBatchLogs(logs: Array<{
    operationType: InventoryOperationType;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    warehouseType: string;
    productId: string;
    specId: string;
    operatorType: OperatorType;
    options?: {
      operatorId?: string;
      userId?: string;
      shopId?: string;
      batchNumber?: string;
      relatedOrderId?: string;
      relatedPurchaseId?: string;
      adjustmentReason?: string;
      remarks?: string;
    };
  }>): Promise<InventoryLog[]> {
    try {
      const createData = logs.map(log => ({
        operationType: log.operationType,
        quantity: log.quantity,
        quantityBefore: log.quantityBefore,
        quantityAfter: log.quantityAfter,
        warehouseType: log.warehouseType as any,
        userId: log.options?.userId || null,
        shopId: log.options?.shopId || null,
        productId: log.productsId,
        specId: log.specsId,
        batchNumber: log.options?.batchNumber || null,
        relatedOrderId: log.options?.relatedOrderId || null,
        relatedPurchaseId: log.options?.relatedPurchaseId || null,
        adjustmentReason: log.options?.adjustmentReason || null,
        operatorType: log.operatorType,
        operatorId: log.options?.operatorId || null,
        remarks: log.options?.remarks || null
      }));

      const createdLogs = await prisma.inventoryLogssss.createMany({
        data: createData
      });

      logger.info('批量创建库存日志成功', {
        count: createdLogs.count
      });

      // 获取创建的日志
      return await this.getRecentLogs(logs.length);
    } catch (error) {
      logger.error('批量创建库存日志失败', {
        logCount: logs.length,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 记录库存同步事件
   */
  async logStockSync(event: StockSyncEvent): Promise<void> {
    try {
      logger.info('库存同步事件', {
        productId: event.productsId,
        specId: event.specsId,
        warehouseType: event.warehouseType,
        userId: event.userId,
        shopId: event.shopId,
        batchNumber: event.batchNumber,
        quantityBefore: event.quantityBefore,
        quantityAfter: event.quantityAfter,
        operationType: event.operationType,
        timestamp: new Date()
      });

      // 这里可以添加额外的处理逻辑，比如：
      // 1. 发送事件到消息队列
      // 2. 触发其他系统的同步
      // 3. 更新缓存等
    } catch (error) {
      logger.error('记录库存同步事件失败', {
        event,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 获取库存日志列表
   */
  async getLogs(query: {
    productId?: string;
    specId?: string;
    warehouseType?: string;
    operationType?: InventoryOperationType;
    operatorId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    perPage?: number;
  }): Promise<{
    logs: InventoryLog[];
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
      const {
        productId,
        specId,
        warehouseType,
        operationType,
        operatorId,
        startDate,
        endDate,
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

      if (operationType) {
        where.operationType = operationType;
      }

      if (operatorId) {
        where.operatorId = operatorId;
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

      const [logs, total] = await Promise.all([
        prisma.inventoryLogssss.findMany({
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
        prisma.inventoryLogssss.count({ where })
      ]);

      return {
        logs: logs as InventoryLog[],
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
      logger.error('获取库存日志列表失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取最近的日志
   */
  async getRecentLogs(limit: number = 10): Promise<InventoryLog[]> {
    try {
      const logs = await prisma.inventoryLogssss.findMany({
        take: limit,
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

      return logs as InventoryLog[];
    } catch (error) {
      logger.error('获取最近库存日志失败', {
        limit,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取操作日志统计
   */
  async getLogStatistics(query: {
    startDate?: Date;
    endDate?: Date;
    warehouseType?: string;
  } = {}): Promise<{
    totalOperations: number;
    operationStats: Array<{
      operationType: InventoryOperationType;
      count: number;
      totalQuantity: number;
    }>;
    warehouseStats: Array<{
      warehouseType: string;
      count: number;
      totalQuantity: number;
    }>;
    dailyStats: Array<{
      date: string;
      count: number;
      totalQuantity: number;
    }>;
  }> {
    try {
      const { startDate, endDate, warehouseType } = query;
      const where: any = {};

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = startDate;
        }
        if (endDate) {
          where.createdAt.lte = endDate;
        }
      }

      if (warehouseType) {
        where.warehouseType = warehouseType;
      }

      // 获取总体统计
      const [totalOperations, operationStats, warehouseStats] = await Promise.all([
        prisma.inventoryLogssss.count({ where }),
        prisma.inventoryLogssss.groupBy({
          by: ['operationType'],
          where,
          _count: { id: true },
          _sum: { quantity: true }
        }),
        prisma.inventoryLogssss.groupBy({
          by: ['warehouseType'],
          where,
          _count: { id: true },
          _sum: { quantity: true }
        })
      ]);

      // 获取每日统计
      const dailyLogs = await prisma.$queryRaw<Array<{
        date: string;
        count: BigInt;
        totalQuantity: BigInt;
      }>>`
        SELECT
          DATE(createdAt) as date,
          COUNT(*) as count,
          SUM(quantity) as totalQuantity
        FROM inventory_logs
        ${startDate || endDate ? `WHERE` : ``}
        ${startDate ? `createdAt >= ${startDate}` : ``}
        ${startDate && endDate ? `AND` : ``}
        ${endDate ? `createdAt <= ${endDate}` : ``}
        ${warehouseType ? `${startDate || endDate ? `AND` : `WHERE`} warehouse_type = '${warehouseType}'` : ``}
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
        LIMIT 30
      `;

      return {
        totalOperations,
        operationStats: operationStats.map(stat => ({
          operationType: stat.operationType as InventoryOperationType,
          count: stat._count.id,
          totalQuantity: Number(stat._sum.quantity || 0)
        })),
        warehouseStats: warehouseStats.map(stat => ({
          warehouseType: stat.warehouseType,
          count: stat._count.id,
          totalQuantity: Number(stat._sum.quantity || 0)
        })),
        dailyStats: dailyLogs.map(stat => ({
          date: stat.date,
          count: Number(stat.count),
          totalQuantity: Number(stat.totalQuantity)
        }))
      };
    } catch (error) {
      logger.error('获取日志统计失败', {
        query,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 清理旧日志（定期任务）
   */
  async cleanOldLogs(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.inventoryLogssss.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      logger.info('清理旧库存日志完成', {
        daysToKeep,
        cutoffDate,
        deletedCount: result.count
      });

      return result.count;
    } catch (error) {
      logger.error('清理旧库存日志失败', {
        daysToKeep,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 导出日志到文件
   */
  async exportLogs(query: {
    startDate?: Date;
    endDate?: Date;
    warehouseType?: string;
    operationType?: InventoryOperationType;
  }): Promise<InventoryServiceResponse<string>> {
    try {
      const logs = await this.getLogs({
        ...query,
        page: 1,
        perPage: 10000 // 导出限制
      });

      // 转换为CSV格式
      const csvHeader = [
        '创建时间',
        '操作类型',
        '数量变化',
        '操作前库存',
        '操作后库存',
        '仓库类型',
        '产品ID',
        '规格ID',
        '操作人类型',
        '操作人ID',
        '批次号',
        '关联订单',
        '调整原因',
        '备注'
      ].join(',');

      const csvRows = logs.logs.map(log => [
        log.createdAt.toISOString(),
        log.operationType,
        log.quantity,
        log.quantityBefore,
        log.quantityAfter,
        log.warehouseType,
        log.productsId,
        log.specsId,
        log.operatorType,
        log.operatorId || '',
        log.batchNumber || '',
        log.relatedOrderId || '',
        log.adjustmentReason || '',
        log.remarks || ''
      ].map(field => `"${field}"`).join(','));

      const csvContent = [csvHeader, ...csvRows].join('\n');

      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `inventory-logs-${timestamp}.csv`;

      // 这里可以将文件保存到云存储或本地文件系统
      // 简化处理，直接返回CSV内容

      return {
        success: true,
        data: csvContent,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('导出库存日志失败', {
        query,
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
export const inventoryLoggerService = new InventoryLoggerService();