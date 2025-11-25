/**
 * 店铺管理路由
 * 处理云店和五通店的API端点
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { shopService } from '../../../modules/shop/shop.service';

const router = Router();

/**
 * GET /api/v1/shops - 获取用户的所有店铺
 */
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const shops = await shopService.getUserShops(userId);
  res.json(createSuccessResponse(shops, '获取店铺列表成功'));
}));

/**
 * GET /api/v1/shops/:shopId - 获取店铺详情
 */
router.get('/:shopId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopId } = req.params;
  const shop = await shopService.getShopInfo(shopId);

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

  res.json(createSuccessResponse(shop, '获取店铺信息成功'));
}));

/**
 * GET /api/v1/shops/:shopId/statistics - 获取店铺统计
 */
router.get('/:shopId/statistics', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { shopId } = req.params;
  const stats = await shopService.getShopStatistics(shopId);

  if (!stats) {
    res.status(404).json(createErrorResponse(
      ErrorCode.SHOP_NOT_FOUND,
      '店铺不存在',
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  res.json(createSuccessResponse(stats, '获取店铺统计成功'));
}));

/**
 * POST /api/v1/shops/apply - 申请开店
 * Body: { shopType: 'CLOUD' | 'WUTONG', shopName?, shopDescription?, contactName, contactPhone, address? }
 */
router.post('/apply', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { shopType, shopName, shopDescription, contactName, contactPhone, address } = req.body;

  // 验证必填字段
  if (!shopType || !contactName || !contactPhone) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['shopType', 'contactName', 'contactPhone'] },
      undefined,
      req.requestId
    ));
    return;
  }

  const result = await shopService.applyShop(userId, {
    shopType,
    shopName,
    shopDescription,
    contactName,
    contactPhone,
    address
  });

  if (!result.success) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      result.message,
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  res.status(201).json(createSuccessResponse(result, '开店申请成功'));
}));

/**
 * GET /api/v1/shops/cloud/upgrade-check - 检查云店升级条件
 */
router.get('/cloud/upgrade-check', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const upgradeCheck = await shopService.checkCloudShopUpgrade(userId);
  res.json(createSuccessResponse(upgradeCheck, '获取升级条件成功'));
}));

/**
 * POST /api/v1/shops/cloud/upgrade - 执行云店升级
 */
router.post('/cloud/upgrade', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const result = await shopService.upgradeCloudShop(userId);

  if (!result.success) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      result.message,
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  res.json(createSuccessResponse(result, '云店升级成功'));
}));

/**
 * POST /api/v1/shops/wutong/purchase - 购买五通店
 * Body: { contactName, contactPhone, address?, paymentMethod: 'wechat' | 'alipay' | 'bank' }
 */
router.post('/wutong/purchase', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { contactName, contactPhone, address, paymentMethod } = req.body;

  // 验证必填字段
  if (!contactName || !contactPhone || !paymentMethod) {
    res.status(400).json(createErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      '缺少必填字段',
      { required: ['contactName', 'contactPhone', 'paymentMethod'] },
      undefined,
      req.requestId
    ));
    return;
  }

  const result = await shopService.purchaseWutongShop(userId, {
    userId,
    contactName,
    contactPhone,
    address,
    paymentMethod: paymentMethod as 'wechat' | 'alipay' | 'bank'
  });

  if (!result.success) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      result.message,
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  res.status(201).json(createSuccessResponse(result, '五通店购买申请已创建'));
}));

/**
 * POST /api/v1/shops/wutong/:shopId/confirm-payment - 确认五通店支付
 * 由支付服务回调调用
 */
router.post('/wutong/:shopId/confirm-payment', asyncHandler(async (req: Request, res: Response) => {
  const { shopId } = req.params;
  const result = await shopService.confirmWutongShopPayment(shopId);

  if (!result.success) {
    res.status(400).json(createErrorResponse(
      ErrorCode.BUSINESS_RULE_VIOLATION,
      result.message,
      undefined,
      undefined,
      req.requestId
    ));
    return;
  }

  res.json(createSuccessResponse(result, '支付确认成功'));
}));

export default router;
