import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/database/client';
import { userLevelService } from '../user/level.service';
import { PurchaseValidator } from './purchase-validator';
import { SupplyChainPathFinder } from './supply-chain-path-finder';
import { CommissionCalculator } from './commission-calculator';
import {
  PurchaseOrder,
  PurchaseStatus,
  CreatePurchaseParams,
  PurchaseValidationResult
} from './types';

/**
 * 采购服务（重构版）
 * 负责采购业务的核心逻辑和模块协调
 */
export class PurchaseService {
  private validator: PurchaseValidator;
  private pathFinder: SupplyChainPathFinder;
  private commissionCalculator: CommissionCalculator;

  constructor() {
    this.validator = new PurchaseValidator();
    this.pathFinder = new SupplyChainPathFinder();
    this.commissionCalculator = new CommissionCalculator();
  }

  /**
   * 验证采购权限 - 委托给验证器
   */
  async validatePurchasePermission(
    buyerId: string,
    sellerId: string,
    productId: string,
    quantity: number
  ): Promise<PurchaseValidationResult> {
    return this.validator.validatePurchasePermission(buyerId, sellerId, productId, quantity);
  }

  /**
   * 保持向后兼容的旧方法
   * @deprecated 使用 validatePurchasePermission 替代
   */
  async validatePurchasePermissions(
    buyerId: string,
    sellerId: string,
    productId: string,
    quantity: number
  ): Promise<PurchaseValidationResult> {
    logger.warn('使用了已废弃的 validatePurchasePermissions 方法，建议使用 validatePurchasePermission');
    return this.validatePurchasePermission(buyerId, sellerId, productId, quantity);
  }

  /**
   * 创建采购订单
   */
  async createPurchaseOrder(params: CreatePurchaseParams): Promise<{
    success: boolean;
    order?: PurchaseOrder;
    error?: string;
    message: string;
  }> {
    try {
      // 1. 验证采购权限
      const validation = await this.validatePurchasePermission(
        params.buyerId,
        params.sellerId,
        params.productId,
        params.quantity
      );

      if (!validation.canPurchase) {
        return {
          success: false,
          error: validation.reasons.join('; '),
          message: '采购验证失败'
        };
      }

      // 2. 获取产品信息
      const product = await prisma.products.findUnique({
        where: { id: params.productId },
        select: {
          id: true,
          name: true,
          sku: {
            select: {
              id: true,
              price: true,
              bottlesPerCase: true,
              stock: true
            }
          }
        }
      });

      if (!product || !product.sku) {
        return {
          success: false,
          error: '产品信息不完整',
          message: '创建采购订单失败'
        };
      }

      // 3. 计算订单金额
      const unitPrice = product.sku.price;
      const totalAmount = unitPrice * params.quantity;
      const totalBottles = product.sku.bottlesPerCase * params.quantity;

      // 4. 创建采购订单
      const order = await prisma.$transaction(async (tx) => {
        // 创建订单
        const newOrder = await tx.purchaseOrder.create({
          data: {
            orderNo: this.generateOrderNo(),
            buyerId: params.buyerId,
            sellerId: params.sellerId,
            productId: params.productId,
            skuId: params.skuId,
            quantity: params.quantity,
            unitPrice,
            totalAmount,
            totalBottles,
            status: PurchaseStatus.PENDING,
            paymentStatus: 'UNPAID',
            shippingAddress: params.shippingAddress,
            notes: params.notes,
            metadata: {
              productName: product.name,
              bottlesPerCase: product.sku.bottlesPerCase,
              validation: validation
            }
          }
        });

        // 预扣库存（可选）
        await tx.productSkus.update({
          where: { id: params.skuId },
          data: {
            reservedStock: {
              increment: params.quantity
            }
          }
        });

        return newOrder;
      });

      logger.info('采购订单创建成功', {
        orderId: order.id,
        orderNo: order.orderNo,
        buyerId: params.buyerId,
        sellerId: params.sellerId,
        totalAmount
      });

      return {
        success: true,
        order: this.formatOrder(order),
        message: '采购订单创建成功'
      };
    } catch (error) {
      logger.error('创建采购订单失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建失败',
        message: '创建采购订单失败'
      };
    }
  }

  /**
   * 确认采购订单
   */
  async confirmPurchaseOrder(
    orderId: string,
    operatorId: string
  ): Promise<{
    success: boolean;
    order?: PurchaseOrder;
    error?: string;
    message: string;
  }> {
    try {
      const order = await prisma.purchaseOrderss.findUnique({
        where: { id: orderId },
        include: {
          buyer: { select: { id: true, level: true } },
          seller: { select: { id: true, level: true } },
          products: {
            select: {
              id: true,
              name: true,
              sku: { select: { stock: true, bottlesPerCase: true } }
            }
          }
        }
      });

      if (!order) {
        return {
          success: false,
          error: '订单不存在',
          message: '确认订单失败'
        };
      }

      if (order.status !== PurchaseStatus.PENDING) {
        return {
          success: false,
          error: '订单状态不允许确认',
          message: '确认订单失败'
        };
      }

      // 检查库存
      if (order.product.sku.stock < order.quantity) {
        return {
          success: false,
          error: '库存不足',
          message: '确认订单失败'
        };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 更新订单状态
        const updated = await tx.purchaseOrder.update({
          where: { id: orderId },
          data: {
            status: PurchaseStatus.CONFIRMED,
            confirmedAt: new Date(),
            metadata: {
              ...order.metadata,
              confirmedBy: operatorId,
              confirmedAt: new Date().toISOString()
            }
          }
        });

        // 扣除库存
        await tx.productSkus.update({
          where: { id: order.skuId },
          data: {
            stock: { decrement: order.quantity },
            reservedStock: { decrement: order.quantity }
          }
        });

        return updated;
      });

      logger.info('采购订单确认成功', {
        orderId,
        orderNo: order.orderNo,
        operatorId
      });

      return {
        success: true,
        order: this.formatOrder(updatedOrder),
        message: '订单确认成功'
      };
    } catch (error) {
      logger.error('确认采购订单失败', {
        orderId,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '确认失败',
        message: '确认订单失败'
      };
    }
  }

  /**
   * 完成采购订单（支付完成或发货完成）
   */
  async completePurchaseOrder(
    orderId: string,
    operatorId: string
  ): Promise<{
    success: boolean;
    order?: PurchaseOrder;
    commissionRecords?: any[];
    error?: string;
    message: string;
  }> {
    try {
      const order = await prisma.purchaseOrderss.findUnique({
        where: { id: orderId },
        include: {
          buyer: { select: { id: true, level: true, referrerId: true } },
          seller: { select: { id: true, level: true, referrerId: true } }
        }
      });

      if (!order) {
        return {
          success: false,
          error: '订单不存在',
          message: '完成订单失败'
        };
      }

      if (order.status !== PurchaseStatus.CONFIRMED && order.status !== PurchaseStatus.PROCESSING) {
        return {
          success: false,
          error: '订单状态不允许完成',
          message: '完成订单失败'
        };
      }

      const result = await prisma.$transaction(async (tx) => {
        // 更新订单状态
        const updatedOrder = await tx.purchaseOrder.update({
          where: { id: orderId },
          data: {
            status: PurchaseStatus.COMPLETED,
            paymentStatus: 'PAID',
            completedAt: new Date(),
            metadata: {
              ...order.metadata,
              completedBy: operatorId,
              completedAt: new Date().toISOString()
            }
          }
        });

        // 使用佣金计算器计算和分配佣金
        const commissionRecords = await this.commissionCalculator.calculateAndDistributeCommission(
          {
            orderId: order.id,
            sellerId: order.sellerId,
            totalAmount: order.totalAmount,
            sellerLevel: order.seller.level
          },
          tx
        );

        // 更新用户业绩统计
        await this.updateUserPurchaseStats(order.buyerId, order.totalAmount, order.totalBottles, tx);

        // 检查并触发升级检查
        await this.checkAndTriggerUpgrade(order.buyerId, tx);

        return {
          order: updatedOrder,
          commissionRecords
        };
      });

      logger.info('采购订单完成成功', {
        orderId,
        orderNo: order.orderNo,
        totalAmount: order.totalAmount,
        commissionCount: result.commissionRecords.length
      });

      return {
        success: true,
        order: this.formatOrder(result.order),
        commissionRecords: result.commissionRecords,
        message: '订单完成成功'
      };
    } catch (error) {
      logger.error('完成采购订单失败', {
        orderId,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '完成失败',
        message: '完成订单失败'
      };
    }
  }

  /**
   * 获取用户采购订单列表
   */
  async getUserPurchaseOrders(
    userId: string,
    type: 'buyer' | 'seller' = 'buyer',
    page: number = 1,
    perPage: number = 20,
    status?: PurchaseStatus
  ): Promise<{
    orders: PurchaseOrder[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const skip = (page - 1) * perPage;
      const where: any = {};

      if (type === 'buyer') {
        where.buyerId = userId;
      } else {
        where.sellerId = userId;
      }

      if (status) {
        where.status = status;
      }

      const [orders, total] = await Promise.all([
        prisma.purchaseOrderss.findMany({
          where,
          include: {
            buyer: {
              select: { id: true, nickname: true }
            },
            seller: {
              select: { id: true, nickname: true }
            },
            products: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: perPage
        }),
        prisma.purchaseOrderss.count({ where })
      ]);

      const formattedOrders = orders.map(order => this.formatOrder(order));

      return {
        orders: formattedOrders,
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage)
        }
      };
    } catch (error) {
      logger.error('获取用户采购订单失败', {
        userId,
        type,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 取消采购订单
   */
  async cancelPurchaseOrder(
    orderId: string,
    reason: string,
    operatorId: string
  ): Promise<{
    success: boolean;
    order?: PurchaseOrder;
    error?: string;
    message: string;
  }> {
    try {
      const order = await prisma.purchaseOrderss.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, skuId: true, quantity: true }
      });

      if (!order) {
        return {
          success: false,
          error: '订单不存在',
          message: '取消订单失败'
        };
      }

      if (order.status === PurchaseStatus.COMPLETED || order.status === PurchaseStatus.CANCELLED) {
        return {
          success: false,
          error: '订单状态不允许取消',
          message: '取消订单失败'
        };
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 更新订单状态
        const updated = await tx.purchaseOrder.update({
          where: { id: orderId },
          data: {
            status: PurchaseStatus.CANCELLED,
            metadata: {
              cancelReason: reason,
              cancelledBy: operatorId,
              cancelledAt: new Date().toISOString()
            }
          }
        });

        // 恢复库存
        if (order.status !== PurchaseStatus.PENDING) {
          await tx.productSkus.update({
            where: { id: order.skuId },
            data: {
              stock: { increment: order.quantity },
              reservedStock: { decrement: order.quantity }
            }
          });
        }

        return updated;
      });

      logger.info('采购订单取消成功', {
        orderId,
        reason,
        operatorId
      });

      return {
        success: true,
        order: this.formatOrder(updatedOrder),
        message: '订单取消成功'
      };
    } catch (error) {
      logger.error('取消采购订单失败', {
        orderId,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '取消失败',
        message: '取消订单失败'
      };
    }
  }

  /**
   * 查找最优采购路径
   * 委托给路径查找器
   */
  async findOptimalPurchasePath(userId: string, maxDepth?: number) {
    return this.pathFinder.findOptimalSupplyPath(userId, maxDepth);
  }

  /**
   * 预览佣金
   * 委托给佣金计算器
   */
  async previewCommission(
    sellerId: string,
    sellerLevel: any,
    totalAmount: number,
    maxDepth?: number
  ) {
    return this.commissionCalculator.previewCommission({
      sellerId,
      sellerLevel,
      totalAmount,
      maxDepth
    });
  }

  /**
   * 获取性能统计信息
   */
  public getPerformanceStats() {
    return this.validator.getPerformanceStats();
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    this.pathFinder.clearCache();
    logger.info('采购服务缓存已清理');
  }

  // ==================== 私有方法 ====================

  /**
   * 生成采购订单号
   */
  private generateOrderNo(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8);
    return `PO${timestamp}${random}`.toUpperCase();
  }

  /**
   * 更新用户采购统计
   */
  private async updateUserPurchaseStats(
    userId: string,
    totalAmount: number,
    totalBottles: number,
    tx: any
  ): Promise<void> {
    try {
      await tx.userStats.upsert({
        where: { userId },
        update: {
          totalPurchases: { increment: totalAmount },
          totalBottles: { increment: totalBottles },
          purchaseCount: { increment: 1 },
          lastPurchaseAt: new Date()
        },
        create: {
          userId,
          totalPurchases: totalAmount,
          totalBottles,
          purchaseCount: 1,
          lastPurchaseAt: new Date()
        }
      });
    } catch (error) {
      logger.error('更新用户采购统计失败', { userId });
    }
  }

  /**
   * 检查并触发升级
   */
  private async checkAndTriggerUpgrade(userId: string, tx: any): Promise<void> {
    try {
      const upgradeCheck = await userLevelService.checkUpgradeConditions(userId);

      if (upgradeCheck.canUpgrade) {
        await tx.levelUpgradeRecord.create({
          data: {
            userId,
            previousLevel: upgradeCheck.currentLevel,
            newLevel: upgradeCheck.nextLevel!,
            upgradeType: 'AUTO',
            approvedById: 'system',
            stats: upgradeCheck.currentStats,
            requirements: upgradeCheck.requirements,
            status: 'PENDING'
          }
        });

        logger.info('触发用户升级检查', {
          userId,
          currentLevel: upgradeCheck.currentLevel,
          nextLevel: upgradeCheck.nextLevel
        });
      }
    } catch (error) {
      logger.error('检查用户升级失败', { userId });
    }
  }

  /**
   * 格式化订单数据
   */
  private formatOrder(order: any): PurchaseOrder {
    return {
      id: order.id,
      orderNo: order.orderNo,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      productId: order.productId,
      skuId: order.skuId,
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      totalAmount: order.totalAmount,
      totalBottles: order.totalBottles,
      status: order.status as PurchaseStatus,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      notes: order.notes,
      metadata: order.metadata,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      completedAt: order.completedAt
    };
  }
}

// 导出单例实例
export const purchaseService = new PurchaseService();