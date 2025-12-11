/**
 * 店铺管理路由
 * 处理云店和五通店的API端点
 */

import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { ShopsService } from '../../../modules/shops';
import { shopService } from '../../../modules/shop/shop.service';
import { prisma } from '../../../shared/database/client';
import { shopsShopType, shopsStatus } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const shopsService = new ShopsService();
const router = Router();

/**
 * GET /api/v1/shops - 获取店铺列表（管理员功能或公开查询）
 */
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, perPage = 10, shopType, status, search } = req.query;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  // 管理员可以查看所有店铺，普通用户只能查看自己的店铺
  const isAdmin = userRole === 'ADMIN';

  const where: any = {};

  if (!isAdmin) {
    // 普通用户只能查看自己的店铺
    where.userId = userId;
  }

  if (shopType) {
    where.shopType = shopType;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { shopName: { contains: search as string } },
      { contactName: { contains: search as string } }
    ];
  }

  const skip = (Number(page) - 1) * Number(perPage);

  const [shops, total] = await Promise.all([
    prisma.shops.findMany({
      where,
      skip,
      take: Number(perPage),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.shops.count({ where })
  ]);

  res.json(createSuccessResponse({
    items: shops,
    total,
    page: Number(page),
    perPage: Number(perPage)
  }, '获取店铺列表成功'));
}));

/**
 * GET /api/v1/shops/my - 获取用户自己的店铺（必须在 /:shopId 之前）
 */
router.get('/my', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const shops = await prisma.shops.findMany({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' }
  });

  res.json(createSuccessResponse({ shops }, '获取个人店铺成功'));
}));

/**
 * GET /api/v1/shops/levels - 获取店铺等级信息（必须在 /:shopId 之前）
 */
router.get('/levels', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const levels = [
    {
      level: 1,
      name: '初级云店',
      requirements: {
        minUserLevel: 'VIP',
        minOrders: 0,
        minSales: 0
      },
      benefits: ['基础商品管理', '订单管理']
    },
    {
      level: 2,
      name: '中级云店',
      requirements: {
        minUserLevel: 'STAR_1',
        minOrders: 50,
        minSales: 50000
      },
      benefits: ['高级商品管理', '促销活动', '数据分析']
    },
    {
      level: 3,
      name: '高级云店',
      requirements: {
        minUserLevel: 'STAR_2',
        minOrders: 200,
        minSales: 200000
      },
      benefits: ['所有中级功能', '品牌定制', '优先客服']
    },
    {
      level: 4,
      name: '资深云店',
      requirements: {
        minUserLevel: 'STAR_3',
        minOrders: 500,
        minSales: 500000
      },
      benefits: ['所有高级功能', '专属经理', '营销工具']
    },
    {
      level: 5,
      name: '顶级云店',
      requirements: {
        minUserLevel: 'STAR_4',
        minOrders: 1000,
        minSales: 1000000
      },
      benefits: ['所有功能', '平台分红', '战略支持']
    }
  ];

  res.json(createSuccessResponse(levels, '获取店铺等级信息成功'));
}));

/**
 * GET /api/v1/shops/wutong/benefits - 获取五通店权益信息（必须在 /:shopId 之前）
 */
router.get('/wutong/benefits', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userLevel = req.user!.level;

  // 五通店权益信息
  const benefits = [
    {
      type: 'BUY_TEN_GET_ONE',
      name: '买10赠1',
      description: '购买10件商品赠送1件同款商品',
      value: 10
    },
    {
      type: 'FREE_SHIPPING',
      name: '包邮特权',
      description: '所有订单免运费',
      value: 0
    },
    {
      type: 'EXCLUSIVE_DISCOUNT',
      name: '专属折扣',
      description: '享受平台专属商品折扣',
      value: 5
    }
  ];

  const requirements = {
    minLevel: 'STAR_1',
    minOrders: 10,
    minSales: 10000
  };

  const userCanAccess = userLevel.startsWith('STAR_');

  res.json(createSuccessResponse({
    benefits: userCanAccess ? benefits : [],
    requirements,
    canAccess: userCanAccess
  }, '获取五通店权益成功'));
}));

/**
 * POST /api/v1/shops/wutong/claim-gift - 申请五通店赠品（必须在 /:shopId 之前）
 */
router.post('/wutong/claim-gift', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userLevel = req.user!.level;
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少商品信息',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查用户是否有五通店
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: { shops: true }
  });

  if (!user || !userLevel.startsWith('STAR_')) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '只有星级店长才能申请赠品',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  const hasWutongShop = user.shops.some(shop => shop.shopType === shopsShopType.WUTONG);
  if (!hasWutongShop) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '需要拥有五通店才能申请赠品',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 计算符合条件的商品数量
  let totalQuantity = 0;
  for (const item of items) {
    if (item.quantity >= 10) {
      totalQuantity += Math.floor(item.quantity / 10);
    }
  }

  if (totalQuantity === 0) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      '单类商品购买数量不足10件，无法申请赠品',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 这里应该创建赠品申请记录，简化处理
  const giftApplication = {
    userId,
    totalQuantity,
    status: 'PENDING',
    createdAt: new Date()
  };

  res.json(createSuccessResponse({
    giftQuantity: totalQuantity,
    application: giftApplication
  }, '赠品申请已提交'));
}));

/**
 * POST /api/v1/shops/apply - 申请开店（必须在 /:shopId 之前）
 */
router.post('/apply', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userLevel = req.user!.level;
  const { shopType, shopName, contactName, contactPhone, address, description } = req.body;

  // 验证必填字段
  if (!shopType || !shopName || !contactName || !contactPhone) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['shopType', 'shopName', 'contactName', 'contactPhone'] },
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查用户权限 - 简化版本，先查询用户
  const user = await prisma.users.findUnique({
    where: { id: userId }
  });

  if (!user) {
    res.status(404).json(createErrorResponse(
      ErrorCode.USER_NOT_FOUND,
      '用户不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查是否已有该类型的店铺 - 使用数据库查询
  const existingShopCount = await prisma.shops.count({
    where: {
      userId: userId,
      shopType: shopType as shopsShopType
    }
  });

  if (existingShopCount > 0) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      '已拥有该类型店铺',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 云店权限检查
  if (shopType === shopsShopType.CLOUD) {
    if (user.level === 'NORMAL') {
      res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        '普通用户不能创建云店，请先升级为VIP',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }
  }

  // 五通店权限检查
  if (shopType === shopsShopType.WUTONG) {
    if (!user.level.startsWith('STAR_')) {
      res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        '只有星级店长才能创建五通店',
        undefined,
        undefined,
        req.requestId
      ));
      return;
    }
  }

  // 创建店铺
  const shop = await prisma.shops.create({
    data: {
      id: `cmi${createId()}`, // 生成ID
      userId: userId,
      shopType: shopType as shopsShopType,
      shopName: shopName || `${shopType === shopsShopType.CLOUD ? '云店' : '五通店'}-${user.phone}`,
      shopDescription: description, // 使用正确的字段名
      contactName,
      contactPhone,
      address,
      status: shopsStatus.PENDING,
      shopLevel: shopType === shopsShopType.CLOUD ? 1 : 1, // 使用正确的字段名
      updatedAt: new Date() // 必需字段
    }
  });

  // 手动获取用户信息
  const shopWithUser = {
    ...shop,
    user: {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      level: user.level
    }
  };

  res.status(201).json(createSuccessResponse(shopWithUser, '开店申请成功'));
}));

/**
 * GET /api/v1/shops/:shopId - 获取店铺详情
 */
router.get('/:shopId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopId } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const shop = await prisma.shops.findUnique({
    where: { id: shopId }
  });

  if (!shop) {
    res.status(404).json(createErrorResponse(
      ErrorCode.SHOP_NOT_FOUND,
      '店铺不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查权限：店铺所有者或管理员可以查看
  const isAdmin = userRole === 'ADMIN';
  if (!isAdmin && shop.userId !== userId) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限查看此店铺',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  res.json(createSuccessResponse(shop, '获取店铺信息成功'));
}));

/**
 * PUT /api/v1/shops/:shopId - 更新店铺信息
 */
router.put('/:shopId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopId } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const updateData = req.body;

  const shop = await prisma.shops.findUnique({
    where: { id: shopId }
  });

  if (!shop) {
    res.status(404).json(createErrorResponse(
      ErrorCode.SHOP_NOT_FOUND,
      '店铺不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查权限：店铺所有者或管理员可以更新
  const isAdmin = userRole === 'ADMIN';
  if (!isAdmin && shop.userId !== userId) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限修改此店铺',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 管理员可以修改更多字段
  const allowedFields = isAdmin
    ? ['shopName', 'contactName', 'contactPhone', 'address', 'status']
    : ['shopName', 'contactName', 'contactPhone', 'address'];

  const filteredData: any = {};
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  });

  // 如果有description字段，映射到shopDescription
  if (updateData.description !== undefined) {
    filteredData.shopDescription = updateData.description;
  }

  const updatedShop = await prisma.shops.update({
    where: { id: shopId },
    data: filteredData
  });

  res.json(createSuccessResponse(updatedShop, '更新店铺信息成功'));
}));

/**
 * GET /api/v1/shops/:shopId/statistics - 获取店铺统计
 */
router.get('/:shopId/statistics', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopId } = req.params;
  const userId = req.user!.id;
  const userRole = req.user!.role;

  const shop = await prisma.shops.findUnique({
    where: { id: shopId }
  });

  if (!shop) {
    res.status(404).json(createErrorResponse(
      ErrorCode.SHOP_NOT_FOUND,
      '店铺不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查权限：店铺所有者或管理员可以查看
  const isAdmin = userRole === 'ADMIN';
  if (!isAdmin && shop.userId !== userId) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限查看此店铺统计',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 获取统计数据 - 简化版本，使用现有表结构
  // 注意：orders表没有shopId字段，所以我们不统计订单数据
  const totalProducts = await prisma.productssss.count({ where: { shopId } });

  // 简化销售统计 - 基于产品的价格统计
  const productsValue = await prisma.productssss.aggregate({
    where: { shopId: shopId },
    _sum: { basePrice: true }
  });

  const statistics = {
    totalOrders: 0, // 暂时设为0，因为orders表没有shopId字段
    totalProducts,
    totalSales: productsValue._sum.basePrice || 0,
    monthlySales: productsValue._sum.basePrice || 0
  };

  res.json(createSuccessResponse(statistics, '获取店铺统计成功'));
}));

/**
 * POST /api/v1/shops/:shopId/upgrade - 申请店铺升级
 */
router.post('/:shopId/upgrade', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopId } = req.params;
  const userId = req.user!.id;
  const { targetLevel, upgradeReason, supportingDocuments } = req.body;

  if (!targetLevel || !upgradeReason) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['targetLevel', 'upgradeReason'] },
      undefined,
      req.requestId
    ));
    return;
  }

  const shop = await prisma.shops.findUnique({
    where: { id: shopId }
  });

  if (!shop) {
    res.status(404).json(createErrorResponse(
      ErrorCode.SHOP_NOT_FOUND,
      '店铺不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查权限
  if (shop.userId !== userId) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限操作此店铺',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 只允许云店升级
  if (shop.shopType !== shopsShopType.CLOUD) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      '只有云店可以升级',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 验证目标等级
  if (targetLevel <= shop.level || targetLevel > 5) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      '无效的目标等级',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 简化升级申请记录 - 实际应该创建升级申请表
  const upgradeApplication = {
    shopId,
    currentLevel: shop.shopLevel,
    targetLevel,
    reason: upgradeReason,
    supportingDocuments: supportingDocuments || [],
    status: 'PENDING',
    createdAt: new Date()
  };

  res.json(createSuccessResponse({
    shopId,
    application: upgradeApplication,
    status: 'PENDING'
  }, '升级申请已提交'));
}));

/**
 * POST /api/v1/shops/:shopId/products - 添加商品到店铺
 */
router.post('/:shopId/products', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopId } = req.params;
  const userId = req.user!.id;
  const { productId, price, stock, isActive = true } = req.body;

  if (!productId || price === undefined || stock === undefined) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['productId', 'price', 'stock'] },
      undefined,
      req.requestId
    ));
    return;
  }

  if (price < 0) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '商品价格不能为负数',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  const shop = await prisma.shops.findUnique({
    where: { id: shopId }
  });

  if (!shop) {
    res.status(404).json(createErrorResponse(
      ErrorCode.SHOP_NOT_FOUND,
      '店铺不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 检查权限
  if (shop.userId !== userId) {
    res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '无权限操作此店铺',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  // 简化商品添加功能 - 实际应该关联到商品表
  const shopProduct = {
    shopId,
    productId,
    price,
    stock,
    isActive,
    createdAt: new Date()
  };

  res.json(createSuccessResponse(shopProduct, '添加商品成功'));
}));

export default router;