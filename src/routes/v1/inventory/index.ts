/**
 * 库存管理路由
 * 处理库存查询、调整、调拨、盘点等功能
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { createId } from '@paralleldrive/cuid2';

const router = Router();

/**
 * GET /api/v1/inventory - 获取库存列表
 */
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, perPage = 10, warehouseType, productId } = req.query;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  // 检查权限：管理员或店主可以查看所有库存，普通用户只能查看自己的库存
  const isAdmin = userRole === 'ADMIN';

  const where: any = {};

  if (!isAdmin) {
    // 普通用户只能查看自己的库存
    where.userId = userId;
  }

  if (warehouseType) {
    where.warehouseType = warehouseType;
  }

  if (productId) {
    where.productsId = productId;
  }

  const skip = (Number(page) - 1) * Number(perPage);

  const [inventories, total] = await Promise.all([
    prisma.inventoryStocks.findMany({
      where,
      skip,
      take: Number(perPage),
      include: {
        products: {
          select: {
            id: true,
            name: true,
            code: true,
            sku: true,
            basePrice: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.inventoryStocks.count({ where })
  ]);

  res.json(createSuccessResponse({
    items: inventories,
    total,
    page: Number(page),
    perPage: Number(perPage)
  }, '获取库存列表成功'));
}));

/**
 * GET /api/v1/inventory/low-stock - 获取低库存预警列表
 */
router.get('/low-stock', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, perPage = 10, threshold } = req.query;
  const userRole = req.user!.role;

  // 检查权限：只有管理员和总监可以查看低库存预警
  const allowedRoles = ['ADMIN', 'DIRECTOR'];
  if (!allowedRoles.includes(userRole)) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限查看低库存预警',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  const where: any = {
    OR: [
      {
        quantity: {
          lte: Number(threshold) || 10
        }
      },
      {
        availableQuantity: {
          lte: Number(threshold) || 10
        }
      }
    ]
  };

  const skip = (Number(page) - 1) * Number(perPage);

  const lowStockItems = await prisma.inventoryStocks.findMany({
    where,
    skip,
    take: Number(perPage),
    include: {
      products: {
        select: {
          id: true,
          name: true,
          code: true,
          sku: true
        }
      }
    },
    orderBy: { quantity: 'asc' }
  });

  res.json(createSuccessResponse(lowStockItems, '获取低库存预警列表成功'));
}));

/**
 * GET /api/v1/inventory/movements - 获取库存变动记录
 */
router.get('/movements', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, perPage = 10, inventoryId, movementType, startDate, endDate } = req.query;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  // 检查inventoryLogs表是否存在
  try {
    await prisma.inventoryLogs.findFirst();
  } catch (error) {
    // 如果inventoryLogs表不存在，返回空列表
    return res.json(createSuccessResponse({
      items: [],
      total: 0,
      page: Number(page),
      perPage: Number(perPage)
    }, '库存变动记录功能暂未启用'));
  }

  const isAdmin = userRole === 'ADMIN';
  const where: any = {};

  // 非管理员只能查看自己的库存变动
  if (!isAdmin) {
    where.inventory = {
      userId: userId
    };
  }

  if (inventoryId) {
    where.inventoryId = inventoryId;
  }

  if (movementType) {
    where.type = movementType;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate as string);
    }
  }

  const skip = (Number(page) - 1) * Number(perPage);

  try {
    const [movements, total] = await Promise.all([
      prisma.inventoryLogs.findMany({
        where,
        skip,
        take: Number(perPage),
        include: {
          inventory: {
            include: {
              products: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.inventoryLogs.count({ where })
    ]);

    res.json(createSuccessResponse({
      items: movements,
      total,
      page: Number(page),
      perPage: Number(perPage)
    }, '获取库存变动记录成功'));
  } catch (error) {
    res.json(createSuccessResponse({
      items: [],
      total: 0,
      page: Number(page),
      perPage: Number(perPage)
    }, '获取库存变动记录成功'));
  }
}));

/**
 * GET /api/v1/inventory/summary - 获取库存汇总信息
 */
router.get('/summary', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { warehouseType, startDate } = req.query;
  const userRole = req.user!.role;

  // 检查权限：只有管理员和总监可以查看库存汇总
  const allowedRoles = ['ADMIN', 'DIRECTOR'];
  if (!allowedRoles.includes(userRole)) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限查看库存汇总',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  const where: any = {};
  if (warehouseType) {
    where.warehouseType = warehouseType;
  }

  // 统计数据
  const [
    totalItems,
    totalValue,
    lowStockItems,
    outOfStockItems
  ] = await Promise.all([
    prisma.inventoryStocks.count({ where }),
    prisma.inventoryStocks.aggregate({
      where,
      _sum: { cost: true }
    }),
    prisma.inventoryStocks.count({
      where: {
        ...where,
        quantity: { lte: 10 }
      }
    }),
    prisma.inventoryStocks.count({
      where: {
        ...where,
        quantity: { lte: 0 }
      }
    })
  ]);

  const summary = {
    totalItems,
    totalValue: totalValue._sum.cost || 0,
    lowStockItems,
    outOfStockItems,
    warehouseType: warehouseType || 'ALL'
  };

  res.json(createSuccessResponse(summary, '获取库存汇总信息成功'));
}));

/**
 * GET /api/v1/inventory/products/:productId/stock - 查询商品在各仓库的库存
 */
router.get('/products/:productId/stock', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;

  // 检查商品是否存在
  const product = await prisma.products.findUnique({
    where: { id: productId }
  });

  if (!product) {
    res.status(404).json(createErrorResponse(
      ErrorCode.NOT_FOUND,
      '商品不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 获取该商品在所有仓库的库存
  const stocks = await prisma.inventoryStocks.findMany({
    where: {
      productId: productId
    },
    include: {
      users: {
        select: {
          id: true,
          nickname: true,
          phone: true
        }
      }
    },
    orderBy: { warehouseType: 'asc' }
  });

  res.json(createSuccessResponse(stocks, '获取商品库存成功'));
}));

/**
 * POST /api/v1/inventory/adjust - 调整库存数量
 */
router.post('/adjust', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { inventoryId, adjustmentType, quantity, reason, costPrice } = req.body;
  const userRole = req.user!.role;

  // 检查权限：只有管理员和总监可以调整库存
  const allowedRoles = ['ADMIN', 'DIRECTOR'];
  if (!allowedRoles.includes(userRole)) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限调整库存',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  if (!inventoryId || !adjustmentType || quantity === undefined || !reason) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['inventoryId', 'adjustmentType', 'quantity', 'reason'] },
      undefined,
      req.requestId
    ));
    return;
  }

  if (!['INCREASE', 'DECREASE'].includes(adjustmentType)) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '无效的调整类型',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  if (quantity <= 0) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '调整数量必须大于0',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 获取当前库存记录
  const inventory = await prisma.inventoryStocks.findUnique({
    where: { id: inventoryId }
  });

  if (!inventory) {
    res.status(404).json(createErrorResponse(
      ErrorCode.NOT_FOUND,
      '库存记录不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 计算新库存
  let newQuantity: number;
  if (adjustmentType === 'INCREASE') {
    newQuantity = inventory.quantity + quantity;
  } else {
    newQuantity = inventory.quantity - quantity;
    if (newQuantity < 0) {
      res.status(400).json(createErrorResponse(
        ErrorCode.BUSINESS_RULE_VIOLATION,
        '减少数量不能大于当前库存',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }
  }

  // 更新库存
  const updatedInventory = await prisma.inventoryStocks.update({
    where: { id: inventoryId },
    data: {
      quantity: newQuantity,
      availableQuantity: newQuantity - inventory.reservedQuantity,
      updatedAt: new Date()
    }
  });

  // 创建库存调整记录（简化版本）
  // 注意：如果inventoryLogs表不存在，暂时跳过
  try {
    await prisma.inventoryLogs.create({
      data: {
        id: `cmi${createId()}`,
        userId: inventory.userId,
        productId: inventory.productsId,
        operationType: adjustmentType === 'INCREASE' ? 'MANUAL_IN' : 'MANUAL_OUT',
        quantity: quantity,
        quantityBefore: inventory.quantity,
        quantityAfter: newQuantity,
        warehouseType: inventory.warehouseType,
        adjustmentReason: reason,
        operatorId: req.user!.id,
        operatorType: 'USER'
      }
    });
  } catch (logError) {
    // 如果inventoryLogs表不存在，记录日志但不影响主要功能
    console.warn('库存日志记录失败（表可能不存在）:', logError.message);
  }

  res.json(createSuccessResponse({
    inventoryId,
    newQuantity,
    adjustmentType,
    quantity
  }, '库存调整成功'));
}));

/**
 * POST /api/v1/inventory/transfer - 库存调拨
 */
router.post('/transfer', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { fromInventoryId, toInventoryId, quantity, reason } = req.body;
  const userRole = req.user!.role;

  // 检查权限：只有管理员和总监可以调拨库存
  const allowedRoles = ['ADMIN', 'DIRECTOR'];
  if (!allowedRoles.includes(userRole)) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限调拨库存',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  if (!fromInventoryId || !toInventoryId || quantity === undefined || !reason) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['fromInventoryId', 'toInventoryId', 'quantity', 'reason'] },
      undefined,
      req.requestId
    ));
    return;
  }

  if (quantity <= 0) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '调拨数量必须大于0',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 获取源库存和目标库存
  const [fromInventory, toInventory] = await Promise.all([
    prisma.inventoryStocks.findUnique({ where: { id: fromInventoryId } }),
    prisma.inventoryStocks.findUnique({ where: { id: toInventoryId } })
  ]);

  if (!fromInventory || !toInventory) {
    res.status(404).json(createErrorResponse(
      ErrorCode.NOT_FOUND,
      '库存记录不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查源库存是否足够
  if (fromInventory.availableQuantity < quantity) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      '源库存可用数量不足',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 执行调拨
  await Promise.all([
    // 更新源库存
    prisma.inventoryStocks.update({
      where: { id: fromInventoryId },
      data: {
        quantity: fromInventory.quantity - quantity,
        availableQuantity: fromInventory.availableQuantity - quantity,
        updatedAt: new Date()
      }
    }),
    // 更新目标库存
    prisma.inventoryStocks.update({
      where: { id: toInventoryId },
      data: {
        quantity: toInventory.quantity + quantity,
        availableQuantity: toInventory.availableQuantity + quantity,
        updatedAt: new Date()
      }
    })
  ]);

  // 创建调拨记录
  const transferId = `cmi${createId()}`;
  try {
    await prisma.inventoryLogs.createMany({
      data: [
        {
          id: `cmi${createId()}`,
          userId: fromInventory.userId,
          productId: fromInventory.productsId,
          operationType: 'TRANSFER_OUT',
          quantity: quantity,
          quantityBefore: fromInventory.quantity,
          quantityAfter: fromInventory.quantity - quantity,
          warehouseType: fromInventory.warehouseType,
          adjustmentReason: `${reason} - 调出`,
          operatorId: req.user!.id,
          operatorType: 'USER'
        },
        {
          id: `cmi${createId()}`,
          userId: toInventory.userId,
          productId: toInventory.productsId,
          operationType: 'TRANSFER_IN',
          quantity: quantity,
          quantityBefore: toInventory.quantity,
          quantityAfter: toInventory.quantity + quantity,
          warehouseType: toInventory.warehouseType,
          adjustmentReason: `${reason} - 调入`,
          operatorId: req.user!.id,
          operatorType: 'USER'
        }
      ]
    });
  } catch (logError) {
    console.warn('调拨日志记录失败（表可能不存在）:', logError.message);
  }

  res.json(createSuccessResponse({
    transferId,
    fromInventoryId,
    toInventoryId,
    quantity
  }, '库存调拨成功'));
}));

/**
 * POST /api/v1/inventory/stocktake - 创建库存盘点任务
 */
router.post('/stocktake', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId, items, remark } = req.body;
  const userRole = req.user!.role;

  // 检查权限：只有管理员和总监可以创建盘点任务
  const allowedRoles = ['ADMIN', 'DIRECTOR'];
  if (!allowedRoles.includes(userRole)) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限创建盘点任务',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  if (!warehouseId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段或盘点项目为空',
      { required: ['warehouseId', 'items'] },
      undefined,
      req.requestId
    ));
    return;
  }

  // 创建盘点任务（简化版本）
  const stocktakeId = `cmi${createId()}`;

  // 处理每个盘点项目
  for (const item of items) {
    const { inventoryId, systemQuantity, actualQuantity, reason } = item;

    if (!inventoryId || systemQuantity === undefined || actualQuantity === undefined) {
      continue;
    }

    // 获取当前库存
    const inventory = await prisma.inventoryStocks.findUnique({
      where: { id: inventoryId }
    });

    if (!inventory) {
      continue;
    }

    // 如果有差异，更新库存
    if (systemQuantity !== actualQuantity) {
      const adjustmentType = actualQuantity > systemQuantity ? 'INCREASE' : 'DECREASE';
      const difference = Math.abs(actualQuantity - systemQuantity);

      await prisma.inventoryStocks.update({
        where: { id: inventoryId },
        data: {
          quantity: actualQuantity,
          availableQuantity: actualQuantity - inventory.reservedQuantity,
          updatedAt: new Date()
        }
      });

      // 创建盘点记录
      try {
        await prisma.inventoryLogs.create({
          data: {
            id: `cmi${createId()}`,
            userId: inventory.userId,
            productId: inventory.productsId,
            operationType: 'ADJUSTMENT',
            quantity: difference,
            quantityBefore: systemQuantity,
            quantityAfter: actualQuantity,
            warehouseType: inventory.warehouseType,
            adjustmentReason: reason || '盘点差异',
            operatorId: req.user!.id,
            operatorType: 'USER'
          }
        });
      } catch (logError) {
        console.warn('盘点日志记录失败（表可能不存在）:', logError.message);
      }
    }
  }

  res.json(createSuccessResponse({
    stocktakeId,
    warehouseId,
    itemsCount: items.length,
    remark
  }, '库存盘点任务创建成功'));
}));

/**
 * POST /api/v1/inventory/reserve - 预留库存
 */
router.post('/reserve', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { inventoryId, quantity, orderId, reason } = req.body;
  const userRole = req.user!.role;

  // 检查权限：星级店长以上可以预留库存
  const userLevel = req.user!.level;
  const allowedRoles = ['ADMIN', 'DIRECTOR'];
  const allowedLevels = ['STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5'];

  if (!allowedRoles.includes(userRole) && !allowedLevels.includes(userLevel)) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限预留库存',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  if (!inventoryId || quantity === undefined || !orderId) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['inventoryId', 'quantity', 'orderId'] },
      undefined,
      req.requestId
    ));
    return;
  }

  if (quantity <= 0) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '预留数量必须大于0',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 获取库存记录
  const inventory = await prisma.inventoryStocks.findUnique({
    where: { id: inventoryId }
  });

  if (!inventory) {
    res.status(404).json(createErrorResponse(
      ErrorCode.NOT_FOUND,
      '库存记录不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查可用库存
  if (inventory.availableQuantity < quantity) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      '可用库存不足',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 更新预留库存
  await prisma.inventoryStocks.update({
    where: { id: inventoryId },
    data: {
      reservedQuantity: inventory.reservedQuantity + quantity,
      availableQuantity: inventory.availableQuantity - quantity,
      updatedAt: new Date()
    }
  });

  res.json(createSuccessResponse({
    inventoryId,
    reservedQuantity: quantity,
    totalReservedQuantity: inventory.reservedQuantity + quantity
  }, '库存预留成功'));
}));

/**
 * POST /api/v1/inventory/release - 释放预留库存
 */
router.post('/release', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { inventoryId, quantity, orderId } = req.body;
  const userRole = req.user!.role;

  // 检查权限：星级店长以上可以释放预留库存
  const userLevel = req.user!.level;
  const allowedRoles = ['ADMIN', 'DIRECTOR'];
  const allowedLevels = ['STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5'];

  if (!allowedRoles.includes(userRole) && !allowedLevels.includes(userLevel)) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限释放预留库存',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  if (!inventoryId || quantity === undefined || !orderId) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['inventoryId', 'quantity', 'orderId'] },
      undefined,
      req.requestId
    ));
    return;
  }

  if (quantity <= 0) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '释放数量必须大于0',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 获取库存记录
  const inventory = await prisma.inventoryStocks.findUnique({
    where: { id: inventoryId }
  });

  if (!inventory) {
    res.status(404).json(createErrorResponse(
      ErrorCode.NOT_FOUND,
      '库存记录不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查预留库存
  if (inventory.reservedQuantity < quantity) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      '预留库存不足',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 更新预留库存
  await prisma.inventoryStocks.update({
    where: { id: inventoryId },
    data: {
      reservedQuantity: inventory.reservedQuantity - quantity,
      availableQuantity: inventory.availableQuantity + quantity,
      updatedAt: new Date()
    }
  });

  res.json(createSuccessResponse({
    inventoryId,
    releasedQuantity: quantity,
    totalReservedQuantity: inventory.reservedQuantity - quantity
  }, '库存释放成功'));
}));

/**
 * GET /api/v1/inventory/:id - 获取库存详情
 * 注意：这个路由必须放在最后，因为它会匹配任何单段路径
 */
router.get('/:id', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const inventory = await prisma.inventoryStocks.findUnique({
    where: { id },
    include: {
      products: true
    }
  });

  if (!inventory) {
    res.status(404).json(createErrorResponse(
      ErrorCode.NOT_FOUND,
      '库存记录不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查权限：管理员或库存所有者可以查看
  const isAdmin = userRole === 'ADMIN';
  if (!isAdmin && inventory.userId !== userId) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限查看此库存记录',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  res.json(createSuccessResponse(inventory, '获取库存详情成功'));
}));

export default router;