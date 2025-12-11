import { logger } from '../utils/logger';
import { prisma } from '../database/client';
import {
  Order,
  OrderType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  LogisticsStatus,
  ExchangeStatus,
  OrderItem,
  ExchangeRequest,
  CreateOrderParams,
  OrderQueryParams,
  CreateExchangeParams,
  OrderValidationResult,
  InventoryValidationResult,
  OrderStatistics,
  ShippingAddress,
  PaymentRecord,
  LogisticsInfo,
  ExchangeItem
} from '../types/order';
import { UserLevel, userLevelService } from '../../modules/user/level.service';
import { teamService } from '../../modules/user/team.service';
import { pointsService } from './points';
import { inventoryService } from './inventory';
import { configService } from '../../modules/config';

export class OrderService {
  // 生成订单号
  private generateOrderNo(type: OrderType): string {
    const prefix = {
      [OrderType.RETAIL]: 'RO',
      [OrderType.PURCHASE]: 'PO',
      [OrderType.TEAM]: 'TO',
      [OrderType.EXCHANGE]: 'EO'
    }[type];

    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }

  // 验证订单创建权限（简化版本）
  async validateOrderCreation(params: CreateOrderParams): Promise<OrderValidationResult> {
    try {
      const reasons: string[] = [];
      let canCreate = true;

      // 1. 检查用户是否存在
      const buyer = await prisma.users.findUnique({
        where: { id: params.buyerId },
        select: { id: true, level: true, status: true }
      });

      if (!buyer) {
        reasons.push('买方用户不存在');
        return { isValid: false, canCreate: false, reasons };
      }

      // 2. 检查用户状态
      if (buyer.status !== 'ACTIVE') {
        reasons.push('买方账户状态异常');
        canCreate = false;
      }

      // 3. 根据订单类型进行特定验证
      switch (params.type) {
        case OrderType.RETAIL:
          const retailValidation = await this.validateRetailOrder(params);
          reasons.push(...retailValidation.reasons);
          canCreate = canCreate && retailValidation.canCreate;
          break;

        case OrderType.PURCHASE:
          const purchaseValidation = await this.validatePurchaseOrder(params);
          reasons.push(...purchaseValidation.reasons);
          canCreate = canCreate && purchaseValidation.canCreate;
          break;

        case OrderType.TEAM:
          const teamValidation = await this.validateTeamOrder(params);
          reasons.push(...teamValidation.reasons);
          canCreate = canCreate && teamValidation.canCreate;
          break;

        default:
          reasons.push('不支持的订单类型');
          canCreate = false;
      }

      // 4. 检查库存
      for (const item of params.items) {
        const inventoryCheck = await this.validateInventoryAvailability(
          item.productId,
          item.skuId,
          item.quantity,
          params.type,
          params.buyerId
        );

        if (!inventoryCheck.sufficient) {
          reasons.push(`商品库存不足：${inventoryCheck.requestedQuantity}件 > ${inventoryCheck.availableQuantity}件`);
          canCreate = false;
        }
      }

      return {
        isValid: reasons.length === 0,
        canCreate,
        reasons
      };
    } catch (error) {
      logger.error('验证订单创建失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        isValid: false,
        canCreate: false,
        reasons: ['验证过程中发生错误']
      };
    }
  }

  // 验证零售订单
  private async validateRetailOrder(params: CreateOrderParams): Promise<{ canCreate: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let canCreate = true;

    // 零售订单需要收货地址
    if (!params.shippingAddress) {
      reasons.push('零售订单必须提供收货地址');
      canCreate = false;
    }

    // 检查是否为店长
    const user = await prisma.users.findUnique({
      where: { id: params.buyerId },
      select: { level: true }
    });

    if (!user || !user.level || user.level === UserLevel.NORMAL) {
      reasons.push('只有店长才能创建零售订单');
      canCreate = false;
    }

    return { canCreate, reasons };
  }

  // 验证采购订单
  private async validatePurchaseOrder(params: CreateOrderParams): Promise<{ canCreate: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let canCreate = true;

    // 采购订单需要卖方
    if (!params.sellerId) {
      reasons.push('采购订单必须指定卖方');
      canCreate = false;
    }

    if (!params.sellerId) return { canCreate, reasons };

    // 检查团队关系
    const teamRelation = await teamService.validateTeamRelationship(
      params.sellerId,
      params.buyerId
    );

    if (!teamRelation.isValid || teamRelation.distance <= 0) {
      reasons.push('采购方与销售方无有效团队关系');
      canCreate = false;
    }

    // 检查等级权限（采购方等级必须低于销售方）
    const [buyer, seller] = await Promise.all([
      prisma.users.findUnique({
        where: { id: params.buyerId },
        select: { level: true }
      }),
      prisma.users.findUnique({
        where: { id: params.sellerId },
        select: { level: true }
      })
    ]);

    if (buyer && seller) {
      const levels = Object.values(UserLevel);
      const buyerLevel = buyer.level as UserLevel;
      const sellerLevel = seller.level as UserLevel;

      if (levels.indexOf(buyerLevel) >= levels.indexOf(sellerLevel)) {
        reasons.push('采购方等级必须低于销售方等级');
        canCreate = false;
      }
    }

    return { canCreate, reasons };
  }

  // 验证团队订单
  private async validateTeamOrder(params: CreateOrderParams): Promise<{ canCreate: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let canCreate = true;

    // 团队订单只有管理员可以创建
    const user = await prisma.users.findUnique({
      where: { id: params.buyerId },
      select: { level: true }
    });

    if (!user || !user.level || !['DIRECTOR', 'ADMIN'].includes(user.level)) {
      reasons.push('只有管理员才能创建团队订单');
      canCreate = false;
    }

    return { canCreate, reasons };
  }

  // 验证库存可用性
  private async validateInventoryAvailability(
    productId: string,
    skuId: string,
    quantity: number,
    orderType: OrderType,
    userId: string
  ): Promise<InventoryValidationResult> {
    try {
      let availableQuantity = 0;

      switch (orderType) {
        case OrderType.RETAIL:
          // 零售订单使用本地仓库存
          const localInventory = await inventoryService.getInventoryQuantity(
            userId,
            'LOCAL',
            productId,
            skuId
          );
          availableQuantity = localInventory.available;
          break;

        case OrderType.PURCHASE:
          // 采购订单使用卖方云仓库存
          if (userId) {
            const cloudInventory = await inventoryService.getInventoryQuantity(
              userId,
              'CLOUD',
              productId,
              skuId
            );
            availableQuantity = cloudInventory.available;
          }
          break;

        case OrderType.TEAM:
          // 团队订单使用平台总仓库存
          const platformInventory = await inventoryService.getInventoryQuantity(
            'platform',
            'PLATFORM',
            productId,
            skuId
          );
          availableQuantity = platformInventory.available;
          break;

        default:
          availableQuantity = 0;
      }

      return {
        isValid: true,
        sufficient: availableQuantity >= quantity,
        availableQuantity,
        requestedQuantity: quantity,
        shortage: Math.max(0, quantity - availableQuantity),
        suggestions: availableQuantity < quantity ? [
          `当前可用库存：${availableQuantity}件`,
          `需要库存：${quantity}件`,
          `缺少：${quantity - availableQuantity}件`
        ] : []
      };
    } catch (error) {
      logger.error('验证库存可用性失败', {
        productId,
        skuId,
        quantity,
        orderType,
        userId
      });
      return {
        isValid: false,
        sufficient: false,
        availableQuantity: 0,
        requestedQuantity: quantity,
        shortage: quantity,
        suggestions: ['库存查询失败']
      };
    }
  }

  // 创建订单
  async createOrder(params: CreateOrderParams): Promise<{
    success: boolean;
    order?: Order;
    error?: string;
    message: string;
  }> {
    try {
      // 1. 验证订单
      const validation = await this.validateOrderCreation(params);
      if (!validation.canCreate) {
        return {
          success: false,
          error: validation.reasons.join('; '),
          message: '订单验证失败'
        };
      }

      // 2. 获取商品信息并计算价格
      const productInfo = await this.getProductPricingInfo(params.items, params.buyerId, params.type);
      if (!productInfo.success) {
        return {
          success: false,
          error: productInfo.error,
          message: '获取商品信息失败'
        };
      }

      // 3. 计算订单金额
      const orderPricing = await this.calculateOrderPricing(
        productInfo.items,
        params.paymentMethod,
        params.pointsAmount
      );

      // 4. 创建订单
      const order = await prisma.$transaction(async (tx) => {
        // 创建主订单
        const newOrder = await tx.order.create({
          data: {
            orderNo: this.generateOrderNo(params.type),
            type: params.type,
            status: OrderStatus.PENDING,
            buyerId: params.buyerId,
            sellerId: params.sellerId,
            totalAmount: orderPricing.totalAmount,
            discountAmount: orderPricing.discountAmount,
            shippingFee: orderPricing.shippingFee,
            finalAmount: orderPricing.finalAmount,
            pointsAmount: orderPricing.pointsAmount,
            cashAmount: orderPricing.cashAmount,
            paymentStatus: PaymentStatus.UNPAID,
            buyerNotes: params.buyerNotes,
            shippingAddress: params.shippingAddress ? JSON.stringify(params.shippingAddress) : null,
            promotionInfo: orderPricing.promotionInfo ? JSON.stringify(orderPricing.promotionInfo) : null,
            metadata: params.metadata ? JSON.stringify(params.metadata) : null
          }
        });

        // 创建订单项
        for (const item of productInfo.items) {
          await tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: item.productId,
              skuId: item.skuId,
              productName: item.productsName,
              productImage: item.productsImage,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              discountAmount: item.discountAmount,
              finalPrice: item.finalPrice,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null
            }
          });
        }

        // 如果是采购订单，预扣库存
        if (params.type === OrderType.PURCHASE) {
          for (const item of params.items) {
            await inventoryService.reserveInventory(
              params.sellerId!,
              'CLOUD',
              item.productId,
              item.skuId,
              item.quantity
            );
          }
        }

        return newOrder;
      });

      // 5. 格式化返回
      const formattedOrder = await this.getOrderById(order.id);

      logger.info('订单创建成功', {
        orderId: order.id,
        orderNo: order.orderNo,
        type: params.type,
        buyerId: params.buyerId,
        finalAmount: orderPricing.finalAmount
      });

      return {
        success: true,
        order: formattedOrder!,
        message: '订单创建成功'
      };
    } catch (error) {
      logger.error('创建订单失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建失败',
        message: '创建订单失败'
      };
    }
  }

  // 获取商品定价信息
  private async getProductPricingInfo(
    items: Array<{ productId: string; skuId: string; quantity: number }>,
    buyerId: string,
    orderType: OrderType
  ): Promise<{
    success: boolean;
    items?: Array<{
      productId: string;
      skuId: string;
      productName: string;
      productImage?: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      discountAmount: number;
      finalPrice: number;
      metadata?: Record<string, any>;
    }>;
    error?: string;
  }> {
    try {
      const result = [];

      for (const item of items) {
        const product = await prisma.products.findUnique({
          where: { id: item.productId },
          include: {
            sku: {
              where: { id: item.skuId },
              include: { product: true }
            }
          }
        });

        if (!product || !products.sku[0]) {
          return {
            success: false,
            error: `商品不存在：${item.productId}`
          };
        }

        const sku = products.sku[0];
        const originalPrice = sku.price;

        // 根据订单类型和买方等级计算价格
        let unitPrice = originalPrice;

        if (orderType === OrderType.PURCHASE) {
          // 采购订单使用买方等级折扣
          const buyer = await prisma.users.findUnique({
            where: { id: buyerId },
            select: { level: true }
          });

          if (buyer) {
            // 从动态配置读取用户等级折扣率
            const discountRate = await this.getUserDiscountRate(buyer.level as UserLevel);
            unitPrice = originalPrice * discountRate;
          }
        }

        const totalPrice = unitPrice * item.quantity;
        const discountAmount = (originalPrice - unitPrice) * item.quantity;
        const finalPrice = totalPrice;

        result.push({
          productId: item.productId,
          skuId: item.skuId,
          productName: products.name,
          productImage: products.images?.[0],
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          discountAmount,
          finalPrice,
          metadata: {
            originalPrice,
            category: products.category
          }
        });
      }

      return { success: true, items: result };
    } catch (error) {
      logger.error('获取商品定价信息失败', {
        items,
        buyerId,
        orderType
      });
      return {
        success: false,
        error: '获取商品定价信息失败'
      };
    }
  }

  // 计算订单定价
  private async calculateOrderPricing(
    items: Array<{
      totalPrice: number;
      discountAmount: number;
      finalPrice: number;
    }>,
    paymentMethod?: PaymentMethod,
    pointsAmount?: number
  ) {
    const totalAmount = items.reduce((sum, item) => sum + item.finalPrice, 0);
    const totalDiscountAmount = items.reduce((sum, item) => sum + item.discountAmount, 0);

    // 计算运费
    const shippingFee = await this.calculateShippingFee(totalAmount);

    // 应用积分抵扣
    let finalPointsAmount = 0;
    let finalCashAmount = totalAmount + shippingFee;

    if (pointsAmount && paymentMethod === PaymentMethod.POINTS) {
      finalPointsAmount = Math.min(pointsAmount, finalCashAmount);
      finalCashAmount -= finalPointsAmount;
    }

    const finalAmount = finalCashAmount + finalPointsAmount;

    // 检查五通店买10赠1优惠
    const promotionInfo = await this.calculatePromotion(totalAmount);

    return {
      totalAmount,
      discountAmount: totalDiscountAmount,
      shippingFee,
      finalAmount,
      pointsAmount: finalPointsAmount,
      cashAmount: finalCashAmount,
      promotionInfo
    };
  }

  // 获取订单详情
  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          paymentRecords: true,
          logistics: true,
          buyer: {
            select: { id: true, nickname: true, level: true }
          },
          seller: {
            select: { id: true, nickname: true, level: true }
          }
        }
      });

      if (!order) return null;

      return this.formatOrder(order);
    } catch (error) {
      logger.error('获取订单详情失败', {
        orderId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }

  // 格式化订单数据
  private formatOrder(order: any): Order {
    return {
      id: order.id,
      orderNo: order.orderNo,
      type: order.type as OrderType,
      status: order.status as OrderStatus,
      buyerId: order.buyerId,
      sellerId: order.sellerId,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      finalAmount: order.finalAmount,
      pointsAmount: order.pointsAmount,
      cashAmount: order.cashAmount,
      items: orderItems.map((item: any) => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        skuId: item.skuId,
        productName: item.productsName,
        productImage: item.productsImage,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        discountAmount: item.discountAmount,
        finalPrice: item.finalPrice,
        metadata: item.metadata ? JSON.parse(item.metadata) : undefined
      })),
      shippingAddress: order.shippingAddress ? JSON.parse(order.shippingAddress) : undefined,
      paymentMethod: order.paymentMethod as PaymentMethod,
      paymentStatus: order.paymentStatus as PaymentStatus,
      paymentRecords: order.paymentRecords || [],
      logistics: order.logistics ? this.formatLogistics(order.logistics) : undefined,
      promotionInfo: order.promotionInfo ? JSON.parse(order.promotionInfo) : undefined,
      buyerNotes: order.buyerNotes,
      sellerNotes: order.sellerNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      completedAt: order.completedAt,
      cancelledAt: order.cancelledAt,
      metadata: order.metadata ? JSON.parse(order.metadata) : undefined
    };
  }

  // 格式化物流信息
  private formatLogistics(logistics: any): LogisticsInfo {
    return {
      id: logistics.id,
      orderId: logistics.orderId,
      expressCompany: logistics.expressCompany,
      trackingNumber: logistics.trackingNumber,
      status: logistics.status as LogisticsStatus,
      currentLocation: logistics.currentLocation,
      estimatedDeliveryDate: logistics.estimatedDeliveryDate,
      createdAt: logistics.createdAt,
      updatedAt: logistics.updatedAt,
      tracks: logistics.tracks ? JSON.parse(logistics.tracks) : []
    };
  }

  // 获取用户订单列表
  async getUserOrders(
    userId: string,
    params: OrderQueryParams = {}
  ): Promise<{
    orders: Order[];
    pagination: {
      page: number;
      perPage: number;
      total: number;
      totalPages: number;
    };
  }> {
    try {
      const page = params.page || 1;
      const perPage = params.perPage || 20;
      const skip = (page - 1) * perPage;

      const where: any = {};

      // 查询用户相关的订单
      where.OR = [
        { buyerId: userId },
        { sellerId: userId }
      ];

      if (params.type) {
        where.type = params.type;
      }

      if (params.status) {
        where.status = params.status;
      }

      if (params.paymentStatus) {
        where.paymentStatus = params.paymentStatus;
      }

      if (params.startDate || params.endDate) {
        where.createdAt = {};
        if (params.startDate) {
          where.createdAt.gte = params.startDate;
        }
        if (params.endDate) {
          where.createdAt.lte = params.endDate;
        }
      }

      const [orders, total] = await Promise.all([
        prisma.orders.findMany({
          where,
          include: {
            items: true,
            paymentRecords: true,
            logistics: true,
            buyer: {
              select: { id: true, nickname: true, level: true }
            },
            seller: {
              select: { id: true, nickname: true, level: true }
            }
          },
          orderBy: {
            [params.sortBy || 'createdAt']: params.sortOrder || 'desc'
          },
          skip,
          take: perPage
        }),
        prisma.orders.count({ where })
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
      logger.error('获取用户订单列表失败', {
        userId,
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 创建换货申请
  async createExchangeRequest(params: CreateExchangeParams): Promise<{
    success: boolean;
    exchange?: ExchangeRequest;
    error?: string;
    message: string;
  }> {
    try {
      // 1. 验证原订单
      const originalOrder = await this.getOrderById(params.originalOrderId);
      if (!originalOrder) {
        return {
          success: false,
          error: '原订单不存在',
          message: '创建换货申请失败'
        };
      }

      // 2. 验证换货权限
      const requester = await prisma.users.findUnique({
        where: { id: originalOrder.buyerId },
        select: { level: true }
      });

      if (!requester || !requester.level || requester.level === UserLevel.NORMAL) {
        return {
          success: false,
          error: '只有店长才能申请换货',
          message: '创建换货申请失败'
        };
      }

      // 3. 计算换货价格差异
      const priceCalculation = await this.calculateExchangePriceDifference(params);

      // 4. 创建换货申请
      const exchange = await prisma.exchangeRequests.create({
        data: {
          orderNo: this.generateOrderNo(OrderType.EXCHANGE),
          originalOrderId: params.originalOrderId,
          requesterId: originalOrder.buyerId,
          targetUserId: params.targetUserId,
          outItems: JSON.stringify(params.outItems),
          inItems: JSON.stringify(params.inItems),
          priceDifference: priceCalculation.priceDifference,
          status: ExchangeStatus.PENDING,
          reason: params.reason,
          description: params.description,
          metadata: JSON.stringify({
            originalOrderNo: originalOrder.orderNo,
            calculation: priceCalculation
          })
        }
      });

      logger.info('换货申请创建成功', {
        exchangeId: exchange.id,
        orderNo: exchange.orderNo,
        originalOrderId: params.originalOrderId,
        priceDifference: priceCalculation.priceDifference
      });

      return {
        success: true,
        exchange: this.formatExchangeRequest(exchange),
        message: '换货申请创建成功'
      };
    } catch (error) {
      logger.error('创建换货申请失败', {
        params,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建失败',
        message: '创建换货申请失败'
      };
    }
  }

  // 计算换货价格差异
  private async calculateExchangePriceDifference(params: CreateExchangeParams): Promise<{
    priceDifference: number;
    outTotal: number;
    inTotal: number;
    calculation: any;
  }> {
    try {
      // 获取申请人等级价格
      const requester = await prisma.users.findUnique({
        where: { id: params.originalOrderId },
        select: { level: true }
      });

      const discountRates = {
        [UserLevel.VIP]: 0.5,
        [UserLevel.STAR_1]: 0.45,
        [UserLevel.STAR_2]: 0.4,
        [UserLevel.STAR_3]: 0.35,
        [UserLevel.STAR_4]: 0.3,
        [UserLevel.STAR_5]: 0.25,
        [UserLevel.DIRECTOR]: 0.2
      };

      const discountRate = requester?.level ?
        discountRates[requester.level as UserLevel] || 1 : 1;

      // 计算换出商品总价值
      let outTotal = 0;
      for (const outItem of params.outItems) {
        const product = await prisma.productsSKU.findUnique({
          where: { id: outItem.skuId },
          include: { product: true }
        });

        if (product) {
          outTotal += products.price * outItem.quantity * discountRate;
        }
      }

      // 计算换入商品总价值
      let inTotal = 0;
      for (const inItem of params.inItems) {
        const product = await prisma.productsSKU.findUnique({
          where: { id: inItem.skuId },
          include: { product: true }
        });

        if (product) {
          inTotal += products.price * inItem.quantity * discountRate;
        }
      }

      // 计算价格差异（正数表示需要补差价）
      const priceDifference = Math.round((inTotal - outTotal) * 100) / 100;

      return {
        priceDifference,
        outTotal,
        inTotal,
        calculation: {
          discountRate,
          outItems: params.outItems,
          inItems: params.inItems
        }
      };
    } catch (error) {
      logger.error('计算换货价格差异失败', {
        params
      });
      return {
        priceDifference: 0,
        outTotal: 0,
        inTotal: 0,
        calculation: null
      };
    }
  }

  // 格式化换货申请
  private formatExchangeRequest(exchange: any): ExchangeRequest {
    return {
      id: exchange.id,
      orderNo: exchange.orderNo,
      originalOrderId: exchange.originalOrderId,
      requesterId: exchange.requesterId,
      targetUserId: exchange.targetUserId,
      outItems: JSON.parse(exchange.outItems),
      inItems: JSON.parse(exchange.inItems),
      priceDifference: exchange.priceDifference,
      status: exchange.status as ExchangeStatus,
      reason: exchange.reason,
      description: exchange.description,
      reviewedBy: exchange.reviewedBy,
      reviewedAt: exchange.reviewedAt,
      reviewNotes: exchange.reviewNotes,
      processedBy: exchange.processedBy,
      processedAt: exchange.processedAt,
      createdAt: exchange.createdAt,
      updatedAt: exchange.updatedAt,
      metadata: exchange.metadata ? JSON.parse(exchange.metadata) : undefined
    };
  }

  // 获取订单统计
  async getOrderStatistics(userId?: string): Promise<OrderStatistics> {
    try {
      const where = userId ? {
        OR: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      } : {};

      const [
        totalOrders,
        totalAmount,
        paidOrders,
        completedOrders,
        cancelledOrders,
        retailOrders,
        purchaseOrders,
        exchangeOrders,
        pendingOrders,
        processingOrders,
        shippedOrders
      ] = await Promise.all([
        prisma.orders.count({ where }),
        prisma.orders.aggregate({
          where,
          _sum: { finalAmount: true }
        }),
        prisma.orders.count({
          where: { ...where, paymentStatus: PaymentStatus.PAID }
        }),
        prisma.orders.count({
          where: { ...where, status: OrderStatus.COMPLETED }
        }),
        prisma.orders.count({
          where: { ...where, status: OrderStatus.CANCELLED }
        }),
        prisma.orders.count({
          where: { ...where, type: OrderType.RETAIL }
        }),
        prisma.orders.count({
          where: { ...where, type: OrderType.PURCHASE }
        }),
        prisma.exchangeRequests.count({ where: { requesterId: userId } }),
        prisma.orders.count({
          where: { ...where, status: OrderStatus.PENDING }
        }),
        prisma.orders.count({
          where: { ...where, status: OrderStatus.PROCESSING }
        }),
        prisma.orders.count({
          where: { ...where, status: OrderStatus.SHIPPED }
        })
      ]);

      const totalOrderAmount = totalAmount._sum.finalAmount || 0;
      const averageOrderValue = totalOrders > 0 ? totalOrderAmount / totalOrders : 0;

      return {
        totalOrders,
        totalAmount: totalOrderAmount,
        paidOrders,
        completedOrders,
        cancelledOrders,
        averageOrderValue,
        retailOrders,
        purchaseOrders,
        exchangeOrders,
        pendingOrders,
        processingOrders,
        shippedOrders
      };
    } catch (error) {
      logger.error('获取订单统计失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 确认订单
  async confirmOrder(orderId: string, userId: string): Promise<Order | null> {
    try {
      const order = await prisma.orders.findUnique({
        where: { id: orderId }
      });

      if (!order) {
        throw new Error('订单不存在');
      }

      if (order.buyerId !== userId) {
        throw new Error('无权限操作此订单');
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new Error('订单状态不正确，无法确认');
      }

      const updatedOrder = await prisma.orders.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paymentStatus: PaymentStatus.PAID,
          paidAt: new Date()
        },
        include: {
          items: true,
          paymentRecords: true,
          logistics: true,
          buyer: {
            select: { id: true, nickname: true, level: true }
          },
          seller: {
            select: { id: true, nickname: true, level: true }
          }
        }
      });

      logger.info('订单确认成功', {
        orderId,
        userId,
        orderNo: updatedOrder.orderNo
      });

      return this.formatOrder(updatedOrder);
    } catch (error) {
      logger.error('确认订单失败', {
        orderId,
        userId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  // 取消订单
  async cancelOrder(orderId: string, userId: string, reason?: string): Promise<Order | null> {
    try {
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!order) {
        throw new Error('订单不存在');
      }

      if (order.buyerId !== userId) {
        throw new Error('无权限操作此订单');
      }

      if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAID) {
        throw new Error('订单状态不正确，无法取消');
      }

      return await prisma.$transaction(async (tx) => {
        // 如果是采购订单且已付款，释放预留库存
        if (order.type === OrderType.PURCHASE && order.status === OrderStatus.PAID) {
          for (const item of orderItems) {
            if (item.skuId) {
              await inventoryService.releaseReservedInventory(
                order.sellerId!,
                'CLOUD',
                item.productId,
                item.skuId,
                item.quantity
              );
            }
          }
        }

        const updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
            sellerNotes: reason || '用户取消订单'
          },
          include: {
            items: true,
            paymentRecords: true,
            logistics: true,
            buyer: {
              select: { id: true, nickname: true, level: true }
            },
            seller: {
              select: { id: true, nickname: true, level: true }
            }
          }
        });

        logger.info('订单取消成功', {
          orderId,
          userId,
          orderNo: updatedOrder.orderNo,
          reason
        });

        return this.formatOrder(updatedOrder);
      });
    } catch (error) {
      logger.error('取消订单失败', {
        orderId,
        userId,
        reason,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取用户等级折扣率
   */
  private async getUserDiscountRate(level: UserLevel): Promise<number> {
    try {
      // 从动态配置读取用户等级折扣率
      const discountRateKey = `order_discount_rate_${level.toLowerCase()}`;

      // 默认折扣率配置
      const defaultDiscountRates = {
        [UserLevel.NORMAL]: 1.0,    // 普通用户无折扣
        [UserLevel.VIP]: 0.5,       // VIP用户5折
        [UserLevel.STAR_1]: 0.45,   // 1星用户4.5折
        [UserLevel.STAR_2]: 0.4,    // 2星用户4折
        [UserLevel.STAR_3]: 0.35,   // 3星用户3.5折
        [UserLevel.STAR_4]: 0.3,    // 4星用户3折
        [UserLevel.STAR_5]: 0.25,   // 5星用户2.5折
        [UserLevel.DIRECTOR]: 0.2   // 总监用户2折
      };

      const defaultRate = defaultDiscountRates[level] || 1.0;
      const discountRate = await configService.getConfig<number>(discountRateKey, defaultRate);

      logger.debug('获取用户等级折扣率', { level, discountRate });
      return discountRate;
    } catch (error) {
      logger.warn('获取用户等级折扣率失败，使用默认值', {
        level,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return 1.0; // 默认无折扣
    }
  }

  /**
   * 计算运费
   */
  private async calculateShippingFee(totalAmount: number): Promise<number> {
    try {
      // 从动态配置读取运费相关参数
      const freeShippingThreshold = await configService.getConfig<number>('order_free_shipping_threshold', 200);
      const defaultShippingFee = await configService.getConfig<number>('order_default_shipping_fee', 10);

      // 如果订单金额达到包邮阈值，免运费
      if (totalAmount >= freeShippingThreshold || totalAmount <= 0) {
        return 0;
      }

      return defaultShippingFee;
    } catch (error) {
      logger.warn('计算运费失败，使用默认值', {
        totalAmount,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return totalAmount > 0 && totalAmount < 200 ? 10 : 0; // 默认运费逻辑
    }
  }

  /**
   * 计算促销优惠
   */
  private async calculatePromotion(totalAmount: number): Promise<any> {
    try {
      // 从动态配置读取促销相关参数
      const promotionEnabled = await configService.getConfig<boolean>('order_promotion_enabled', false);

      if (!promotionEnabled) {
        return null;
      }

      const promotionThreshold = await configService.getConfig<number>('order_promotion_threshold', 5990);
      const promotionDiscount = await configService.getConfig<number>('order_promotion_discount', 599);
      const promotionDescription = await configService.getConfig<string>('order_promotion_description', '买10赠1优惠');

      // 如果订单金额达到促销阈值，应用促销
      if (totalAmount >= promotionThreshold) {
        return {
          type: 'BUY_10_GET_1',
          discount: promotionDiscount,
          description: promotionDescription,
          threshold: promotionThreshold
        };
      }

      return null;
    } catch (error) {
      logger.warn('计算促销优惠失败', {
        totalAmount,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return null;
    }
  }
}

// 导出单例实例
export const orderService = new OrderService();