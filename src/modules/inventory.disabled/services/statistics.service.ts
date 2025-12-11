import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import {
  WarehouseType,
  InventoryStatistics,
  InventoryOperationType,
  InventoryLog,
  InventoryServiceResponse
} from './types';

/**
 * 库存统计服务
 * 负责生成各种库存统计报表和分析数据
 */
export class StatisticsService {
  /**
   * 获取综合库存统计
   */
  async getInventoryStatistics(
    options: {
      warehouseType?: WarehouseType;
      userId?: string;
      shopId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<InventoryStatistics> {
    try {
      const { warehouseType, userId, shopId, startDate, endDate } = options;

      // 构建查询条件
      const stockWhere: any = {};
      if (warehouseType) {
        stockWhere.warehouseType = warehouseType;
      }
      if (userId) {
        stockWhere.userId = userId;
      }
      if (shopId) {
        stockWhere.shopId = shopId;
      }

      const logWhere: any = {};
      if (warehouseType) {
        logWhere.warehouseType = warehouseType;
      }
      if (userId) {
        logWhere.userId = userId;
      }
      if (shopId) {
        logWhere.shopId = shopId;
      }
      if (startDate || endDate) {
        logWhere.createdAt = {};
        if (startDate) {
          logWhere.createdAt.gte = startDate;
        }
        if (endDate) {
          logWhere.createdAt.lte = endDate;
        }
      }

      // 并行获取各项数据
      const [
        totalProductsResult,
        totalQuantityResult,
        warehouseStats,
        operationStats,
        alertStats,
        recentLogs
      ] = await Promise.all([
        // 总产品数（有库存的）
        prisma.inventoryStocks.groupBy({
          by: ['productId'],
          where: stockWhere,
          having: {
            quantity: { _sum: { gt: 0 } }
          }
        }),
        // 总库存数量
        prisma.inventoryStocks.aggregate({
          where: stockWhere,
          _sum: {
            quantity: true
          }
        }),
        // 仓库统计
        prisma.inventoryStocks.groupBy({
          by: ['warehouseType'],
          where: stockWhere,
          _count: { id: true },
          _sum: { quantity: true }
        }),
        // 操作统计
        prisma.inventoryLogssss.groupBy({
          by: ['operationType'],
          where: logWhere,
          _count: { id: true },
          _sum: { quantity: true }
        }),
        // 预警统计
        this.getAlertStatistics(warehouseType, userId, shopId),
        // 最近日志
        prisma.inventoryLogssss.findMany({
          where: logWhere,
          take: 10,
          orderBy: { createdAt: 'desc' },
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
        })
      ]);

      // 计算总价值
      let totalValue = 0;
      const stocks = await prisma.inventoryStocks.findMany({
        where: stockWhere,
        include: {
          products: {
            select: {
              price: true
            }
          },
          specs: {
            select: {
              price: true
            }
          }
        }
      });

      for (const stock of stocks) {
        const price = stock.specs?.price || stock.products?.price || 0;
        totalValue += stock.quantity * price;
      }

      // 转换统计数据格式
      const warehouseStatsFormatted = warehouseStats.map(stat => ({
        warehouseType: stat.warehouseType as WarehouseType,
        totalQuantity: Number(stat._sum.quantity || 0),
        totalValue: 0, // 需要另外计算
        productCount: stat._count.id
      }));

      // 计算各仓库的总价值
      for (const warehouseStat of warehouseStatsFormatted) {
        const warehouseStocks = stocks.filter(
          stock => stock.warehouseType === warehouseStat.warehouseType
        );
        for (const stock of warehouseStocks) {
          const price = stock.specs?.price || stock.products?.price || 0;
          warehouseStat.totalValue += stock.quantity * price;
        }
      }

      const operationStatsFormatted = operationStats.map(stat => ({
        operationType: stat.operationType as InventoryOperationType,
        count: stat._count.id,
        totalQuantity: Number(stat._sum.quantity || 0)
      }));

      return {
        totalProducts: totalProductsResult.length,
        totalQuantity: Number(totalQuantityResult._sum.quantity || 0),
        totalValue,
        warehouseStats: warehouseStatsFormatted,
        operationStats: operationStatsFormatted,
        alertStats,
        recentLogs: recentLogs as InventoryLog[]
      };
    } catch (error) {
      logger.error('获取库存统计失败', {
        options,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取预警统计
   */
  private async getAlertStatistics(
    warehouseType?: WarehouseType,
    userId?: string,
    shopId?: string
  ): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    criticalAlerts: number;
  }> {
    const where: any = {};
    if (warehouseType) {
      where.warehouseType = warehouseType;
    }
    if (userId) {
      where.userId = userId;
    }
    if (shopId) {
      where.shopId = shopId;
    }

    const [
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      criticalAlerts
    ] = await Promise.all([
      prisma.inventoryAlertss.count({ where }),
      prisma.inventoryAlertss.count({
        where: { ...where, status: 'ACTIVE' }
      }),
      prisma.inventoryAlertss.count({
        where: { ...where, status: 'RESOLVED' }
      }),
      prisma.inventoryAlertss.count({
        where: { ...where, status: 'ACTIVE', alertLevel: 'CRITICAL' }
      })
    ]);

    return {
      totalAlerts,
      activeAlerts,
      resolvedAlerts,
      criticalAlerts
    };
  }

  /**
   * 获取库存周转率分析
   */
  async getInventoryTurnoverAnalysis(
    options: {
      warehouseType?: WarehouseType;
      userId?: string;
      shopId?: string;
      days?: number; // 分析天数，默认30天
    } = {}
  ): Promise<InventoryServiceResponse<{
    turnoverRate: number;
    turnoverDays: number;
    categories: Array<{
      categoryId: string;
      categoryName: string;
      turnoverRate: number;
      turnoverDays: number;
      avgStockValue: number;
    }>;
    products: Array<{
      productId: string;
      productName: string;
      turnoverRate: number;
      turnoverDays: number;
      avgStock: number;
      avgStockValue: number;
    }>;
  }>> {
    try {
      const { warehouseType, userId, shopId, days = 30 } = options;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      // 获取分析期间的出库总量
      const outLogs = await prisma.inventoryLogssss.findMany({
        where: {
          warehouseType,
          userId,
          shopId,
          quantity: { lt: 0 }, // 出库
          createdAt: {
            gte: startDate,
            lte: endDate
          }
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
              price: true
            }
          }
        }
      });

      // 获取期末库存
      const endStocks = await prisma.inventoryStocks.findMany({
        where: {
          warehouseType,
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
              price: true
            }
          }
        }
      });

      // 计算总出库价值
      let totalOutValue = 0;
      const categoryOutMap = new Map<string, number>();
      const productOutMap = new Map<string, number>();

      for (const log of outLogs) {
        const price = log.specs?.price || log.products?.price || 0;
        const value = Math.abs(log.quantity) * price;
        totalOutValue += value;

        // 分类统计
        if (log.products.categoryId) {
          categoryOutMap.set(
            log.products.categoryId,
            (categoryOutMap.get(log.products.categoryId) || 0) + value
          );
        }

        // 产品统计
        productOutMap.set(
          log.productsId,
          (productOutMap.get(log.productsId) || 0) + value
        );
      }

      // 计算总库存价值
      let totalStockValue = 0;
      const categoryStockMap = new Map<string, { count: number; value: number }>();
      const productStockMap = new Map<string, { quantity: number; value: number }>();

      for (const stock of endStocks) {
        const price = stock.specs?.price || stock.products?.price || 0;
        const value = stock.quantity * price;
        totalStockValue += value;

        // 分类统计
        if (stock.products.categoryId) {
          const current = categoryStockMap.get(stock.products.categoryId) || { count: 0, value: 0 };
          categoryStockMap.set(stock.products.categoryId, {
            count: current.count + 1,
            value: current.value + value
          });
        }

        // 产品统计
        productStockMap.set(stock.productsId, {
          quantity: stock.quantity,
          value
        });
      }

      // 计算周转率
      const turnoverRate = totalStockValue > 0 ? (totalOutValue / totalStockValue) * (365 / days) : 0;
      const turnoverDays = turnoverRate > 0 ? 365 / turnoverRate : 0;

      // 分类周转分析
      const categories = [];
      for (const [categoryId, outValue] of categoryOutMap) {
        const stockInfo = categoryStockMap.get(categoryId);
        if (stockInfo) {
          const categoryTurnoverRate = stockInfo.value > 0
            ? (outValue / stockInfo.value) * (365 / days)
            : 0;
          const categoryTurnoverDays = categoryTurnoverRate > 0 ? 365 / categoryTurnoverRate : 0;

          categories.push({
            categoryId,
            categoryName: endStocks.find(s => s.products.categoryId === categoryId)?.products.category?.name || '未知分类',
            turnoverRate: Math.round(categoryTurnoverRate * 100) / 100,
            turnoverDays: Math.round(categoryTurnoverDays * 100) / 100,
            avgStockValue: Math.round(stockInfo.value / stockInfo.count * 100) / 100
          });
        }
      }

      // 产品周转分析
      const products = [];
      for (const [productId, outValue] of productOutMap) {
        const stockInfo = productStockMap.get(productId);
        if (stockInfo) {
          const productTurnoverRate = stockInfo.value > 0
            ? (outValue / stockInfo.value) * (365 / days)
            : 0;
          const productTurnoverDays = productTurnoverRate > 0 ? 365 / productTurnoverRate : 0;
          const product = endStocks.find(s => s.productsId === productId);

          products.push({
            productId,
            productName: product?.products.name || '未知产品',
            turnoverRate: Math.round(productTurnoverRate * 100) / 100,
            turnoverDays: Math.round(productTurnoverDays * 100) / 100,
            avgStock: stockInfo.quantity,
            avgStockValue: stockInfo.value
          });
        }
      }

      // 排序
      categories.sort((a, b) => b.turnoverRate - a.turnoverRate);
      products.sort((a, b) => b.turnoverRate - a.turnoverRate);

      return {
        success: true,
        data: {
          turnoverRate: Math.round(turnoverRate * 100) / 100,
          turnoverDays: Math.round(turnoverDays * 100) / 100,
          categories,
          products: products.slice(0, 50) // 返回前50个产品
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('获取库存周转分析失败', {
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

  /**
   * 获取库存趋势分析
   */
  async getInventoryTrendAnalysis(
    options: {
      warehouseType?: WarehouseType;
      userId?: string;
      shopId?: string;
      days?: number; // 分析天数，默认30天
      productId?: string;
      specId?: string;
    } = {}
  ): Promise<InventoryServiceResponse<{
    dailyData: Array<{
      date: string;
      stockIn: number;
      stockOut: number;
      netChange: number;
      endStock: number;
      stockValue: number;
    }>;
    summary: {
      totalIn: number;
      totalOut: number;
      netChange: number;
      averageDailyStock: number;
      peakStock: number;
      lowestStock: number;
    };
  }>> {
    try {
      const { warehouseType, userId, shopId, days = 30, productId, specId } = options;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      // 获取每日库存变动数据
      const dailyLogs = await prisma.$queryRaw<Array<{
        date: string;
        stockIn: number;
        stockOut: number;
        netChange: number;
      }>>`
        SELECT
          DATE(createdAt) as date,
          SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) as stockIn,
          SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END) as stockOut,
          SUM(quantity) as netChange
        FROM inventory_logs
        WHERE createdAt >= ${startDate}
          AND createdAt <= ${endDate}
          ${warehouseType ? `AND warehouse_type = '${warehouseType}'` : ''}
          ${userId ? `AND userId = '${userId}'` : ''}
          ${shopId ? `AND shopId = '${shopId}'` : ''}
          ${productId ? `AND productId = '${productId}'` : ''}
          ${specId ? `AND spec_id = '${specId}'` : ''}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `;

      // 获取期初库存
      const startStock = await prisma.inventoryStocks.findMany({
        where: {
          warehouseType,
          userId,
          shopId,
          ...(productId && { productId }),
          ...(specId && { specId })
        }
      });

      // 计算期初总库存
      let totalStartStock = 0;
      let startStockValue = 0;
      for (const stock of startStock) {
        totalStartStock += stock.quantity;
        // 这里需要获取产品价格，简化处理
        // startStockValue += stock.quantity * price;
      }

      // 生成每日数据
      const dailyData = [];
      let currentStock = totalStartStock;
      const dateMap = new Map<string, typeof dailyLogs[0]>();

      // 将日志数据按日期组织
      for (const log of dailyLogs) {
        dateMap.set(log.date, log);
      }

      // 生成每日数据
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayLog = dateMap.get(dateStr);

        const stockIn = dayLog?.stockIn || 0;
        const stockOut = dayLog?.stockOut || 0;
        const netChange = dayLog?.netChange || 0;

        currentStock += netChange;

        // 简化处理库存价值
        const stockValue = currentStock * 10; // 假设平均单价10元

        dailyData.push({
          date: dateStr,
          stockIn,
          stockOut,
          netChange,
          endStock: currentStock,
          stockValue
        });
      }

      // 计算汇总数据
      const totalIn = dailyData.reduce((sum, day) => sum + day.stockIn, 0);
      const totalOut = dailyData.reduce((sum, day) => sum + day.stockOut, 0);
      const netChange = dailyData.reduce((sum, day) => sum + day.netChange, 0);
      const averageDailyStock = dailyData.length > 0
        ? dailyData.reduce((sum, day) => sum + day.endStock, 0) / dailyData.length
        : 0;
      const peakStock = Math.max(...dailyData.map(day => day.endStock));
      const lowestStock = Math.min(...dailyData.map(day => day.endStock));

      return {
        success: true,
        data: {
          dailyData,
          summary: {
            totalIn,
            totalOut,
            netChange,
            averageDailyStock: Math.round(averageDailyStock * 100) / 100,
            peakStock,
            lowestStock
          }
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('获取库存趋势分析失败', {
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

  /**
   * 获取库存健康度报告
   */
  async getInventoryHealthReport(
    options: {
      warehouseType?: WarehouseType;
      userId?: string;
      shopId?: string;
    } = {}
  ): Promise<InventoryServiceResponse<{
    overallHealth: {
      score: number; // 0-100
      level: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
      issues: string[];
    };
    metrics: {
      lowStockItems: number;
      outOfStockItems: number;
      excessStockItems: number; // 超储商品
      expiredItems: number;
      expiringItems: number; // 即将过期
      slowMovingItems: number; // 滞销商品
    };
    recommendations: string[];
  }>> {
    try {
      const { warehouseType, userId, shopId } = options;

      // 获取所有库存
      const stocks = await prisma.inventoryStocks.findMany({
        where: {
          warehouseType,
          userId,
          shopId
        },
        include: {
          products: {
            select: {
              name: true
            }
          },
          specs: {
            select: {
              lowStockThreshold: true,
              outOfStockThreshold: true
            }
          }
        }
      });

      // 统计各种问题
      let lowStockItems = 0;
      let outOfStockItems = 0;
      let excessStockItems = 0;
      let expiredItems = 0;
      let expiringItems = 0;
      let slowMovingItems = 0;

      const issues: string[] = [];
      const recommendations: string[] = [];

      // 分析每个库存项
      for (const stock of stocks) {
        const quantity = stock.quantity;
        const lowThreshold = stock.specs?.lowStockThreshold || 10;
        const outThreshold = stock.specs?.outOfStockThreshold || 0;
        const excessThreshold = lowThreshold * 5; // 超储阈值为低库存阈值的5倍

        // 检查缺货
        if (quantity === 0) {
          outOfStockItems++;
          issues.push(`商品 ${stock.products.name} 缺货`);
        } else if (quantity <= outThreshold) {
          outOfStockItems++;
          issues.push(`商品 ${stock.products.name} 库存严重不足`);
        } else if (quantity <= lowThreshold) {
          lowStockItems++;
        } else if (quantity > excessThreshold) {
          excessStockItems++;
          issues.push(`商品 ${stock.products.name} 库存过多`);
          recommendations.push(`考虑促销商品 ${stock.products.name} 以减少库存`);
        }

        // 检查过期情况（简化处理）
        if (stock.expiryDate) {
          const now = new Date();
          const thirtyDaysLater = new Date();
          thirtyDaysLater.setDate(now.getDate() + 30);

          if (stock.expiryDate < now) {
            expiredItems++;
            issues.push(`商品 ${stock.products.name} 已过期`);
          } else if (stock.expiryDate < thirtyDaysLater) {
            expiringItems++;
            recommendations.push(`商品 ${stock.products.name} 即将过期，建议优先销售`);
          }
        }

        // 检查滞销（简化处理：假设60天没有变动为滞销）
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(now.getDate() - 60);

        const hasRecentActivity = await prisma.inventoryLogssss.findFirst({
          where: {
            productId: stock.productsId,
            specId: stock.specsId,
            warehouseType: stock.warehouseType,
            userId: stock.userId,
            shopId: stock.shopId,
            createdAt: { gte: sixtyDaysAgo }
          }
        });

        if (!hasRecentActivity && quantity > 0) {
          slowMovingItems++;
          recommendations.push(`商品 ${stock.products.name} 长期未销售，考虑促销活动`);
        }
      }

      // 计算健康度分数
      const totalItems = stocks.length;
      const problemItems = outOfStockItems + expiredItems + slowMovingItems;
      const warningItems = lowStockItems + expiringItems;

      let score = 100;
      if (totalItems > 0) {
        score -= (problemItems / totalItems) * 50; // 问题项影响50分
        score -= (warningItems / totalItems) * 20;  // 警告项影响20分
        score -= Math.min((excessStockItems / totalItems) * 10, 10); // 超储影响最多10分
      }

      score = Math.max(0, Math.min(100, score));

      // 确定健康等级
      let level: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
      if (score >= 90) {
        level = 'EXCELLENT';
      } else if (score >= 75) {
        level = 'GOOD';
      } else if (score >= 60) {
        level = 'FAIR';
      } else if (score >= 40) {
        level = 'POOR';
      } else {
        level = 'CRITICAL';
      }

      // 生成通用建议
      if (outOfStockItems > 0) {
        recommendations.unshift('立即补货缺货商品');
      }
      if (expiredItems > 0) {
        recommendations.unshift('及时清理过期商品');
      }
      if (slowMovingItems > totalItems * 0.3) {
        recommendations.unshift('分析滞销原因，调整采购策略');
      }

      return {
        success: true,
        data: {
          overallHealth: {
            score: Math.round(score),
            level,
            issues: issues.slice(0, 10) // 最多返回10个问题
          },
          metrics: {
            lowStockItems,
            outOfStockItems,
            excessStockItems,
            expiredItems,
            expiringItems,
            slowMovingItems
          },
          recommendations: Array.from(new Set(recommendations)).slice(0, 10) // 去重并限制数量
        },
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('获取库存健康度报告失败', {
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
export const statisticsService = new StatisticsService();