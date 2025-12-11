import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import {
  AlertLevel,
  AlertStatus,
  InventoryAlert,
  AlertQuery,
  AlertTriggerEvent,
  WarehouseType,
  InventoryStock
} from './types';

/**
 * 库存预警服务
 * 负责监控库存水平，触发和管理库存预警
 */
export class InventoryAlertService {
  /**
   * 检查单个库存的预警状态
   */
  async checkInventoryAlert(
    productId: string,
    specId: string,
    warehouseType: WarehouseType,
    userId?: string,
    shopId?: string
  ): Promise<InventoryAlert | null> {
    try {
      // 获取商品规格的预警阈值
      const spec = await prisma.productSpecs.findUnique({
        where: { id: specId },
        select: {
          lowStockThreshold: true,
          outOfStockThreshold: true
        }
      });

      if (!spec) {
        return null;
      }

      // 获取当前库存
      const stock = await prisma.inventoryStocks.findFirst({
        where: {
          productId,
          specId,
          warehouseType,
          userId: userId || null,
          shopId: shopId || null
        }
      });

      if (!stock) {
        return null;
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
      const existingAlert = await prisma.inventoryAlertss.findFirst({
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

        let alert: InventoryAlert;

        if (existingAlert) {
          // 更新现有预警
          const updatedAlert = await prisma.inventoryAlertss.update({
            where: { id: existingAlert.id },
            data: {
              currentStock,
              alertLevel,
              threshold,
              updatedAt: new Date()
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
          });

          alert = updatedAlert as InventoryAlert;
        } else {
          // 创建新预警
          const newAlert = await prisma.inventoryAlertss.create({
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
          });

          alert = newAlert as InventoryAlert;

          // 触发预警事件
          await this.triggerAlertEvent({
            productId,
            specId,
            warehouseType,
            userId,
            shopId,
            currentStock,
            threshold,
            alertLevel
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

        return alert;
      } else if (existingAlert) {
        // 库存恢复正常，解决预警
        await prisma.inventoryAlertss.update({
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

        return null;
      }

      return null;
    } catch (error) {
      logger.error('检查库存预警失败', {
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
   * 批量检查库存预警
   */
  async checkAllInventoryAlerts(): Promise<{
    checkedCount: number;
    newAlerts: InventoryAlert[];
    resolvedAlerts: number;
  }> {
    try {
      // 获取所有有库存的商品规格
      const stocks = await prisma.inventoryStocks.findMany({
        where: {
          quantity: { gte: 0 } // 包括0库存
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

      const newAlerts: InventoryAlert[] = [];
      let resolvedAlerts = 0;

      for (const stock of stocks) {
        const existingAlert = await prisma.inventoryAlertss.findFirst({
          where: {
            productId: stock.productsId,
            specId: stock.specsId,
            warehouseType: stock.warehouseType,
            userId: stock.userId || null,
            shopId: stock.shopId || null,
            status: AlertStatus.ACTIVE
          }
        });

        const alert = await this.checkInventoryAlert(
          stock.productsId,
          stock.specsId,
          stock.warehouseType,
          stock.userId || undefined,
          stock.shopId || undefined
        );

        if (alert && !existingAlert) {
          newAlerts.push(alert);
        } else if (!alert && existingAlert) {
          resolvedAlerts++;
        }
      }

      logger.info('批量检查库存预警完成', {
        checkedStocks: stocks.length,
        newAlerts: newAlerts.length,
        resolvedAlerts
      });

      return {
        checkedCount: stocks.length,
        newAlerts,
        resolvedAlerts
      };
    } catch (error) {
      logger.error('批量检查库存预警失败', {
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
    try {
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

      if (alertLevel) {
        where.alertLevel = alertLevel;
      }

      if (status) {
        where.status = status;
      }

      if (typeof isRead === 'boolean') {
        where.isRead = isRead;
      }

      const [alerts, total] = await Promise.all([
        prisma.inventoryAlertss.findMany({
          where,
          skip,
          take: perPage,
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
            }
          }
        }),
        prisma.inventoryAlertss.count({ where })
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
   * 标记预警为已读
   */
  async markAlertAsRead(alertId: string, userId: string): Promise<boolean> {
    try {
      await prisma.inventoryAlertss.update({
        where: { id: alertId },
        data: {
          isRead: true,
          resolvedBy: userId,
          resolvedAt: new Date(),
          status: AlertStatus.RESOLVED,
          resolveReason: '手动标记为已处理'
        }
      });

      logger.info('预警标记为已读', {
        alertId,
        userId
      });

      return true;
    } catch (error) {
      logger.error('标记预警为已读失败', {
        alertId,
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 批量标记预警为已读
   */
  async markMultipleAlertsAsRead(
    alertIds: string[],
    userId: string
  ): Promise<number> {
    try {
      const result = await prisma.inventoryAlertss.updateMany({
        where: {
          id: { in: alertIds },
          status: AlertStatus.ACTIVE
        },
        data: {
          isRead: true,
          resolvedBy: userId,
          resolvedAt: new Date(),
          status: AlertStatus.RESOLVED,
          resolveReason: '批量标记为已处理'
        }
      });

      logger.info('批量标记预警为已读', {
        alertIds,
        userId,
        affectedCount: result.count
      });

      return result.count;
    } catch (error) {
      logger.error('批量标记预警为已读失败', {
        alertIds,
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 忽略预警
   */
  async ignoreAlert(
    alertId: string,
    userId: string,
    reason: string
  ): Promise<boolean> {
    try {
      await prisma.inventoryAlertss.update({
        where: { id: alertId },
        data: {
          status: AlertStatus.IGNORED,
          resolvedBy: userId,
          resolvedAt: new Date(),
          resolveReason: reason
        }
      });

      logger.info('预警已忽略', {
        alertId,
        userId,
        reason
      });

      return true;
    } catch (error) {
      logger.error('忽略预警失败', {
        alertId,
        userId,
        reason,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取预警统计
   */
  async getAlertStatistics(): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    resolvedAlerts: number;
    ignoredAlerts: number;
    criticalAlerts: number;
    lowStockAlerts: number;
    outOfStockAlerts: number;
    unreadAlerts: number;
  }> {
    try {
      const [
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        ignoredAlerts,
        criticalAlerts,
        lowStockAlerts,
        outOfStockAlerts,
        unreadAlerts
      ] = await Promise.all([
        prisma.inventoryAlertss.count(),
        prisma.inventoryAlertss.count({
          where: { status: AlertStatus.ACTIVE }
        }),
        prisma.inventoryAlertss.count({
          where: { status: AlertStatus.RESOLVED }
        }),
        prisma.inventoryAlertss.count({
          where: { status: AlertStatus.IGNORED }
        }),
        prisma.inventoryAlertss.count({
          where: {
            alertLevel: AlertLevel.CRITICAL,
            status: AlertStatus.ACTIVE
          }
        }),
        prisma.inventoryAlertss.count({
          where: {
            alertLevel: AlertLevel.LOW,
            status: AlertStatus.ACTIVE
          }
        }),
        prisma.inventoryAlertss.count({
          where: {
            alertLevel: AlertLevel.OUT_OF_STOCK,
            status: AlertStatus.ACTIVE
          }
        }),
        prisma.inventoryAlertss.count({
          where: {
            isRead: false,
            status: AlertStatus.ACTIVE
          }
        })
      ]);

      return {
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        ignoredAlerts,
        criticalAlerts,
        lowStockAlerts,
        outOfStockAlerts,
        unreadAlerts
      };
    } catch (error) {
      logger.error('获取预警统计失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 触发预警事件
   */
  private async triggerAlertEvent(event: AlertTriggerEvent): Promise<void> {
    try {
      // 这里可以添加各种预警触发逻辑：
      // 1. 发送邮件通知
      // 2. 发送短信通知
      // 3. 发送微信消息
      // 4. 发送到消息队列供其他系统消费
      // 5. 更新缓存
      // 6. 记录审计日志

      logger.info('触发库存预警事件', {
        ...event,
        timestamp: new Date()
      });

      // 示例：发送通知给相关用户
      if (event.userId) {
        // 可以调用通知服务
        // await notificationService.sendStockAlert(event.userId, event);
      }

      // 示例：发送通知给管理员
      // await notificationService.sendAdminAlert(event);
    } catch (error) {
      logger.error('触发预警事件失败', {
        event,
        error: error instanceof Error ? error.message : '未知错误'
      });
    }
  }

  /**
   * 设置预警阈值
   */
  async setAlertThreshold(
    specId: string,
    thresholds: {
      lowStockThreshold?: number;
      outOfStockThreshold?: number;
    }
  ): Promise<boolean> {
    try {
      await prisma.productSpecs.update({
        where: { id: specId },
        data: thresholds
      });

      // 重新检查该规格的所有库存预警
      const stocks = await prisma.inventoryStocks.findMany({
        where: { specId },
        select: {
          productId: true,
          specId: true,
          warehouseType: true,
          userId: true,
          shopId: true
        }
      });

      for (const stock of stocks) {
        await this.checkInventoryAlert(
          stock.productsId,
          stock.specsId,
          stock.warehouseType,
          stock.userId || undefined,
          stock.shopId || undefined
        );
      }

      logger.info('预警阈值设置成功', {
        specId,
        thresholds
      });

      return true;
    } catch (error) {
      logger.error('设置预警阈值失败', {
        specId,
        thresholds,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 清理已解决的旧预警
   */
  async cleanResolvedAlerts(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.inventoryAlertss.deleteMany({
        where: {
          status: AlertStatus.RESOLVED,
          resolvedAt: {
            lt: cutoffDate
          }
        }
      });

      logger.info('清理已解决的预警完成', {
        daysToKeep,
        cutoffDate,
        deletedCount: result.count
      });

      return result.count;
    } catch (error) {
      logger.error('清理已解决的预警失败', {
        daysToKeep,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }
}

// 导出单例实例
export const inventoryAlertService = new InventoryAlertService();