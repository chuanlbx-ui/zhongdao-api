import { Router, Request, Response } from 'express';
import {
  pricingService,
  UserLevel,
  PriceCalculationParams,
  BatchPriceCalculationParams,
  PriceUpdateParams,
  BatchPriceUpdateParams
} from '../../../modules/products';
import { logger } from '../../../shared/utils/logger';
import { validateUser } from '../../middleware/auth.middleware';

const router = Router();

/**
 * 验证用户等级参数
 */
function validateUserLevel(level: string): UserLevel {
  if (!Object.values(UserLevel).includes(level as UserLevel)) {
    throw new Error(`无效的用户等级: ${level}`);
  }
  return level as UserLevel;
}

/**
 * GET /api/v1/products/pricing/calculate
 * 计算单个商品价格
 */
router.get('/calculate', async (req: Request, res: Response) => {
  try {
    const {
      productId,
      userLevel,
      specId,
      quantity
    } = req.query as Record<string, string>;

    // 验证必需参数
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PRODUCT_ID',
          message: '缺少商品ID参数'
        }
      });
    }

    if (!userLevel) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_LEVEL',
          message: '缺少用户等级参数'
        }
      });
    }

    // 验证用户等级
    const validatedUserLevel = validateUserLevel(userLevel);

    // 计算价格
    const priceResult = await pricingService.calculatePrice(
      productId,
      validatedUserLevel,
      specId
    );

    // 如果有数量参数，计算总价
    if (quantity && parseInt(quantity) > 1) {
      const qty = parseInt(quantity);
      priceResult.finalPrice = priceResult.finalPrice * qty;
      priceResult.discountAmount = priceResult.discountAmount * qty;
    }

    res.json({
      success: true,
      data: priceResult,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('计算商品价格失败', {
      error: error instanceof Error ? error.message : '未知错误',
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CALCULATION_ERROR',
        message: '价格计算失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

/**
 * POST /api/v1/products/pricing/batch-calculate
 * 批量计算商品价格
 */
router.post('/batch-calculate', async (req: Request, res: Response) => {
  try {
    const { userLevel, items } = req.body as BatchPriceCalculationParams;

    // 验证参数
    if (!userLevel) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_LEVEL',
          message: '缺少用户等级参数'
        }
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ITEMS',
          message: '缺少商品列表或格式错误'
        }
      });
    }

    // 验证用户等级
    const validatedUserLevel = validateUserLevel(userLevel);

    // 验证商品列表
    for (const item of items) {
      if (!item.productsId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PRODUCT_ID',
            message: '商品列表中缺少商品ID'
          }
        });
      }
    }

    // 批量计算价格
    const results = await pricingService.batchCalculatePrices({
      userLevel: validatedUserLevel,
      items
    });

    // 计算汇总信息
    const summary = {
      totalItems: results.length,
      totalAmount: results.reduce((sum, result) => sum + result.finalPrice, 0),
      totalDiscount: results.reduce((sum, result) => sum + result.discountAmount, 0),
      averageDiscountRate: results.length > 0
        ? results.reduce((sum, result) => sum + result.discountRate, 0) / results.length
        : 0
    };

    res.json({
      success: true,
      data: {
        results,
        summary
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('批量计算商品价格失败', {
      error: error instanceof Error ? error.message : '未知错误',
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_CALCULATION_ERROR',
        message: '批量价格计算失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

/**
 * GET /api/v1/products/pricing/product/:productId/levels
 * 获取商品所有等级的定价
 */
router.get('/product/:productId/levels', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { specId } = req.query as Record<string, string>;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PRODUCT_ID',
          message: '缺少商品ID'
        }
      });
    }

    const allLevelPrices = await pricingService.getProductPricingForAllLevels(
      productId,
      specId
    );

    // 添加折扣信息
    const resultsWithDiscountInfo = allLevelPrices.map(priceResult => {
      const discountInfo = pricingService.getLevelDiscountInfo(priceResult.userLevel);
      return {
        ...priceResult,
        userLevelName: discountInfo.name,
        userLevelDisplayName: discountInfo.displayName
      };
    });

    res.json({
      success: true,
      data: resultsWithDiscountInfo,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('获取商品所有等级定价失败', {
      error: error instanceof Error ? error.message : '未知错误',
      params: req.params,
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ALL_LEVELS_ERROR',
        message: '获取商品所有等级定价失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

/**
 * POST /api/v1/products/pricing/update
 * 更新商品定价
 */
router.post('/update', validateUser, async (req: Request, res: Response) => {
  try {
    const { productId, userLevel, specId, price } = req.body as PriceUpdateParams;

    // 验证参数
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PRODUCT_ID',
          message: '缺少商品ID'
        }
      });
    }

    if (!userLevel) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_LEVEL',
          message: '缺少用户等级'
        }
      });
    }

    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PRICE',
          message: '价格必须是有效的非负数'
        }
      });
    }

    // 验证用户等级
    const validatedUserLevel = validateUserLevel(userLevel);

    // 更新定价
    const result = await pricingService.updateProductPricing({
      productId,
      specId,
      userLevel: validatedUserLevel,
      price,
      isSpecialPrice: true
    });

    res.json({
      success: result.success,
      data: result.pricing,
      message: result.message,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('更新商品定价失败', {
      error: error instanceof Error ? error.message : '未知错误',
      body: req.body,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PRICING_ERROR',
        message: '更新商品定价失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

/**
 * POST /api/v1/products/pricing/batch-update
 * 批量更新商品定价
 */
router.post('/batch-update', validateUser, async (req: Request, res: Response) => {
  try {
    const { updates } = req.body as BatchPriceUpdateParams;

    // 验证参数
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_UPDATES',
          message: '缺少更新列表或格式错误'
        }
      });
    }

    // 验证更新项
    for (const update of updates) {
      if (!update.productsId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PRODUCT_ID',
            message: '更新列表中缺少商品ID'
          }
        });
      }

      if (!update.userLevel) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_LEVEL',
            message: '更新列表中缺少用户等级'
          }
        });
      }

      if (typeof update.price !== 'number' || update.price < 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRICE',
            message: '价格必须是有效的非负数'
          }
        });
      }

      // 验证用户等级
      validateUserLevel(update.userLevel);
    }

    // 批量更新
    const result = await pricingService.batchUpdateProductPricing({
      updates,
      updatedBy: (req as any).user?.id
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalUpdates: updates.length,
          successCount: result.successCount,
          failCount: result.failCount
        },
        results: result.results
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('批量更新商品定价失败', {
      error: error instanceof Error ? error.message : '未知错误',
      body: req.body,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_UPDATE_ERROR',
        message: '批量更新商品定价失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

/**
 * DELETE /api/v1/products/pricing/delete
 * 删除商品定价
 */
router.delete('/delete', validateUser, async (req: Request, res: Response) => {
  try {
    const { productId, userLevel, specId } = req.query as Record<string, string>;

    // 验证参数
    if (!productId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PRODUCT_ID',
          message: '缺少商品ID'
        }
      });
    }

    if (!userLevel) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_USER_LEVEL',
          message: '缺少用户等级'
        }
      });
    }

    // 验证用户等级
    const validatedUserLevel = validateUserLevel(userLevel);

    // 删除定价
    const result = await pricingService.deleteProductPricing(
      productId,
      validatedUserLevel,
      specId
    );

    res.json({
      success: result.success,
      message: result.message,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('删除商品定价失败', {
      error: error instanceof Error ? error.message : '未知错误',
      query: req.query,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_PRICING_ERROR',
        message: '删除商品定价失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

/**
 * GET /api/v1/products/pricing/discounts/levels
 * 获取所有等级折扣配置
 */
router.get('/discounts/levels', async (req: Request, res: Response) => {
  try {
    const allDiscounts = pricingService.getAllLevelDiscounts();

    res.json({
      success: true,
      data: allDiscounts,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('获取等级折扣配置失败', {
      error: error instanceof Error ? error.message : '未知错误'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_DISCOUNTS_ERROR',
        message: '获取等级折扣配置失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

/**
 * GET /api/v1/products/pricing/cache/stats
 * 获取缓存统计信息
 */
router.get('/cache/stats', validateUser, async (req: Request, res: Response) => {
  try {
    const cacheStats = pricingService.getCacheStats();

    res.json({
      success: true,
      data: cacheStats,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('获取缓存统计失败', {
      error: error instanceof Error ? error.message : '未知错误'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'GET_CACHE_STATS_ERROR',
        message: '获取缓存统计失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

/**
 * POST /api/v1/products/pricing/cache/clear
 * 清除缓存
 */
router.post('/cache/clear', validateUser, async (req: Request, res: Response) => {
  try {
    const { productId } = req.body as { productId?: string };

    if (productId) {
      // 清除特定商品的缓存
      pricingService.clearCacheForProduct(productId);
    } else {
      // 清除所有缓存
      pricingService.clearAllCache();
    }

    const message = productId ? `商品 ${productId} 缓存已清除` : '所有缓存已清除';

    res.json({
      success: true,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.id
      }
    });
  } catch (error) {
    logger.error('清除缓存失败', {
      error: error instanceof Error ? error.message : '未知错误',
      body: req.body,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CLEAR_CACHE_ERROR',
        message: '清除缓存失败',
        details: error instanceof Error ? error.message : '未知错误'
      }
    });
  }
});

export default router;