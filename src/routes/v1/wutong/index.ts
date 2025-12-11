/**
 * 五通店权益相关路由
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 权限检查辅助函数
const requireRole = (req: Request, allowedRoles: string[]): boolean => {
  if (!req.user || !req.user.role) return false;
  return allowedRoles.includes(req.user.role);
};

// GET /api/v1/wutong/benefits - 获取五通店权益列表
router.get('/benefits', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // 检查用户是否有五通店
  const user = await prisma.users.findUnique({
    where: { id: req.user!.id },
    select: { hasWutongShop: true }
  });

  if (!user?.hasWutongShop) {
    return res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '非五通店用户无法查看权益'
    ));
  }

  // 返回模拟的权益数据
  const benefits = [
    {
      type: 'BUY_TEN_GET_ONE',
      name: '买10赠1',
      description: '购买10瓶商品赠送1瓶同款商品',
      conditions: {
        minQuantity: 10,
        maxGiftsPerMonth: 5,
        applicableProducts: ['all']
      }
    }
  ];

  res.json(createSuccessResponse(benefits, '获取权益列表成功'));
}));

// GET /api/v1/wutong/eligibility - 获取权益资格
router.get('/eligibility', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // 检查用户是否有五通店
  const user = await prisma.users.findUnique({
    where: { id: req.user!.id },
    select: { hasWutongShop: true }
  });

  if (!user?.hasWutongShop) {
    return res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '非五通店用户无法查看权益'
    ));
  }

  const eligibility = {
    isWutongShopOwner: true,
    activeBenefits: [
      {
        type: 'BUY_TEN_GET_ONE',
        remainingCount: 5,
        nextResetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    usageHistory: []
  };

  res.json(createSuccessResponse(eligibility, '获取权益资格成功'));
}));

// POST /api/v1/wutong/claim-gift - 申请赠品
router.post('/claim-gift', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { orderId, productId, purchasedQuantity } = req.body;

  // 验证购买数量
  if (!purchasedQuantity || purchasedQuantity < 10) {
    return res.status(400).json(createErrorResponse(
      ErrorCode.INVALID_REQUEST,
      '购买数量不足10瓶，无法申请赠品'
    ));
  }

  // 检查用户是否有五通店
  const user = await prisma.users.findUnique({
    where: { id: req.user!.id },
    select: { hasWutongShop: true }
  });

  if (!user?.hasWutongShop) {
    return res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '非五通店用户无法申请赠品'
    ));
  }

  // 检查是否已经申请过该订单的赠品
  const existingGift = await prisma.giftRecords.findFirst({
    where: {
      userId: req.user!.id,
      orderId,
      productId
    }
  });

  if (existingGift) {
    return res.status(400).json(createErrorResponse(
      ErrorCode.INVALID_REQUEST,
      '该订单已申请过赠品'
    ));
  }

  // 计算赠品数量
  const giftQuantity = Math.floor(purchasedQuantity / 10);

  // 创建赠品记录
  const giftRecord = await prisma.giftRecords.create({
    data: {
      id: `cmi${Date.now()}`,
      userId: req.user!.id,
      orderId,
      productId,
      quantity: giftQuantity,
      value: giftQuantity * 399, // 假设每瓶399元
      type: 'WUTONG_BUY_TEN_GET_ONE',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  res.json(createSuccessResponse({
    giftRecord,
    giftQuantity
  }, '赠品申请成功'));
}));

// GET /api/v1/wutong/gifts - 获取赠品记录
router.get('/gifts', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, perPage = 10, status, allUsers } = req.query;
  const skip = (Number(page) - 1) * Number(perPage);

  let where: any = {};

  if (status) {
    where.status = status;
  }

  if (!allUsers) {
    where.userId = req.user!.id;
  }

  const [gifts, total] = await Promise.all([
    prisma.giftRecords.findMany({
      where,
      skip,
      take: Number(perPage),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.giftRecords.count({ where })
  ]);

  res.json(createSuccessResponse({
    items: gifts,
    total,
    page: Number(page),
    perPage: Number(perPage)
  }, '获取赠品记录成功'));
}));

// POST /api/v1/wutong/gifts/:id/ship - 发货赠品
router.post('/gifts/:id/ship', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // 检查管理员权限
  if (!requireRole(req, ['ADMIN', 'DIRECTOR'])) {
    return res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '只有管理员可以发货赠品'
    ));
  }
  const { id } = req.params;
  const { trackingNumber, carrier, shippedAt, remark } = req.body;

  // 验证快递信息
  if (!trackingNumber || !carrier) {
    return res.status(400).json(createErrorResponse(
      ErrorCode.INVALID_REQUEST,
      '快递信息不完整'
    ));
  }

  const updatedGift = await prisma.giftRecords.update({
    where: { id },
    data: {
      status: 'SHIPPED',
      shippedAt: shippedAt ? new Date(shippedAt) : new Date(),
      metadata: JSON.stringify({
        trackingNumber,
        carrier,
        remark
      }),
      updatedAt: new Date()
    }
  });

  // 解析metadata并将快递信息提取到顶层
  const metadata = JSON.parse(updatedGift.metadata || '{}');
  const responseGift = {
    ...updatedGift,
    trackingNumber: metadata.trackingNumber,
    carrier: metadata.carrier,
    remark: metadata.remark
  };

  res.json(createSuccessResponse(responseGift, '赠品发货成功'));
}));

// GET /api/v1/wutong/statistics - 获取五通店权益统计
router.get('/statistics', authenticate, asyncHandler(async (req: Request, res: Response) => {
  // 检查管理员权限
  if (!requireRole(req, ['ADMIN', 'DIRECTOR'])) {
    return res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '只有管理员可以查看统计数据'
    ));
  }
  const { period = 'month' } = req.query;

  const statistics = {
    totalWutongShops: 0,
    totalGiftsGiven: 0,
    totalGiftValue: 0,
    monthlyStats: []
  };

  res.json(createSuccessResponse(statistics, '获取统计数据成功'));
}));

// GET /api/v1/wutong/products - 获取参与权益的商品
router.get('/products', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, perPage = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(perPage);

  const [products, total] = await Promise.all([
    prisma.productssss.findMany({
      where: { status: 'ACTIVE' },
      skip,
      take: Number(perPage),
      select: {
        id: true,
        name: true,
        basePrice: true,
        images: true
      }
    }),
    prisma.productssss.count({ where: { status: 'ACTIVE' } })
  ]);

  // 添加五通权益信息
  const productsWithBenefits = products.map(product => ({
    ...products,
    wutongEligible: true,
    giftRatio: '1:10', // 买10赠1
    maxGiftQuantity: 5
  }));

  res.json(createSuccessResponse({
    items: productsWithBenefits,
    total,
    page: Number(page),
    perPage: Number(perPage)
  }, '获取商品列表成功'));
}));

// POST /api/v1/wutong/open - 开通五通店
router.post('/open', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopName, contactName, contactPhone, address, agreementAccepted } = req.body;

  // 获取用户信息并检查等级
  const user = await prisma.users.findUnique({
    where: { id: req.user!.id },
    select: { level: true, hasWutongShop: true }
  });

  if (!user) {
    return res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '用户不存在'
    ));
  }

  // 检查是否已经拥有五通店
  if (user.hasWutongShop) {
    return res.status(400).json(createErrorResponse(
      ErrorCode.INVALID_REQUEST,
      '您已经拥有五通店'
    ));
  }

  // 验证用户等级（需要二星及以上店长）
  const levelOrder = ['NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'];
  const currentLevelIndex = levelOrder.indexOf(user.level);

  if (currentLevelIndex < 3) { // STAR_2 是索引 3
    return res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '需要二星及以上店长才能开通五通店'
    ));
  }

  // 验证开通条件
  if (!shopName || !contactName || !contactPhone || !address) {
    return res.status(400).json(createErrorResponse(
      ErrorCode.INVALID_REQUEST,
      '开店信息不完整'
    ));
  }

  if (!agreementAccepted) {
    return res.status(400).json(createErrorResponse(
      ErrorCode.INVALID_REQUEST,
      '必须同意五通店协议'
    ));
  }

  // 创建五通店
  const wutongShop = await prisma.shops.create({
    data: {
      id: `cmi${Date.now()}`,
      userId: req.user!.id,
      shopType: 'WUTONG',
      shopName,
      shopLevel: 1,
      status: 'ACTIVE',
      contactName,
      contactPhone,
      address,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });

  // 更新用户状态
  await prisma.users.update({
    where: { id: req.user!.id },
    data: { hasWutongShop: true }
  });

  res.json(createSuccessResponse(wutongShop, '五通店开通成功'));
}));

// GET /api/v1/wutong/agreement - 获取五通店协议
router.get('/agreement', asyncHandler(async (req: Request, res: Response) => {
  const agreement = {
    title: '中道商城五通店合作协议',
    content: '这里是五通店合作协议的内容...',
    version: '1.0.0',
    updatedAt: new Date().toISOString()
  };

  res.json(createSuccessResponse(agreement, '获取协议成功'));
}));

// POST /api/v1/wutong/close - 关闭五通店
router.post('/close', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopId, reason, agreeToTerms } = req.body;

  if (!agreeToTerms) {
    return res.status(400).json(createErrorResponse(
      ErrorCode.INVALID_REQUEST,
      '必须同意关闭条款'
    ));
  }

  // 关闭店铺
  const closedShop = await prisma.shops.update({
    where: { id: shopId, userId: req.user!.id },
    data: {
      status: 'CLOSED',
      updatedAt: new Date()
    }
  });

  // 更新用户状态
  await prisma.users.update({
    where: { id: req.user!.id },
    data: { hasWutongShop: false }
  });

  res.json(createSuccessResponse(closedShop, '五通店关闭成功'));
}));

export default router;