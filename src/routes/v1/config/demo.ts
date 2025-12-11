/**
 * 参数配置模块使用演示
 *
 * 这个文件展示如何在实际业务中使用动态参数配置
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { configService } from '../../../modules/config';
import { logger } from '../../../shared/utils/logger';

const router = Router();

/**
 * 演示1: 读取单个配置参数
 */
router.get('/demo/single/:key', asyncHandler(async (req: Request, res: Response) => {
  const { key } = req.params;

  try {
    // 读取配置参数（带缓存，性能极佳）
    const value = await configService.getConfig(key);

    res.json(createSuccessResponse({
      key,
      value,
      message: `成功读取配置参数: ${key}`
    }, '参数读取演示'));
  } catch (error) {
    res.status(404).json(createErrorResponse(
      'CONFIG_NOT_FOUND',
      `配置参数 ${key} 不存在`,
      undefined,
      404
    ));
  }
}));

/**
 * 演示2: 批量读取某分类的所有配置
 */
router.get('/demo/category/:category', asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.params;

  try {
    // 批量获取某分类的所有配置
    const configs = await configService.getConfigsByCategory(category);

    res.json(createSuccessResponse({
      category,
      count: configs.length,
      configs,
      message: `成功读取 ${category} 分类的所有配置，共 ${configs.length} 项`
    }, '分类配置演示'));
  } catch (error) {
    res.status(500).json(createErrorResponse(
      'CONFIG_ERROR',
      '读取配置失败',
      error instanceof Error ? error.message : '未知错误'
    ));
  }
}));

/**
 * 演示3: 业务逻辑中使用配置参数
 * 模拟云店升级检查
 */
router.get('/demo/cloud-shop-check', asyncHandler(async (req: Request, res: Response) => {
  try {
    // 模拟用户数据（实际中从数据库获取）
    const mockUser = {
      id: 'user_123',
      totalBottles: 15,
      teamSize: 8,
      directMembers: 3,
      currentLevel: 'NORMAL'
    };

    // 动态读取配置参数（而不是硬编码）
    const level1MinBottles = await configService.getConfig<number>('cloud_shop_level_1_minBottles', 4);
    const level1MinTeamSize = await configService.getConfig<number>('cloud_shop_level_1_minTeamSize', 2);
    const level1MinDirectMembers = await configService.getConfig<number>('cloud_shop_level_1_minDirectMembers', 1);
    const level1PurchaseDiscount = await configService.getConfig<number>('cloud_shop_level_1_purchaseDiscount', 0.95);

    // 业务逻辑判断
    const canUpgrade =
      mockUser.totalBottles >= level1MinBottles &&
      mockUser.teamSize >= level1MinTeamSize &&
      mockUser.directMembers >= level1MinDirectMembers;

    const result = {
      user: mockUser,
      requirements: {
        minBottles: level1MinBottles,
        minTeamSize: level1MinTeamSize,
        minDirectMembers: level1MinDirectMembers
      },
      purchaseDiscount: level1PurchaseDiscount,
      canUpgrade,
      message: canUpgrade ? '满足云店升级条件！' : '暂不满足升级条件'
    };

    res.json(createSuccessResponse(result, '云店升级检查演示'));
  } catch (error) {
    logger.error('云店升级检查演示失败', { error });
    res.status(500).json(createErrorResponse(
      'DEMO_ERROR',
      '演示执行失败',
      error instanceof Error ? error.message : '未知错误'
    ));
  }
}));

/**
 * 演示4: 佣金计算中使用配置参数
 */
router.get('/demo/commission-calculation', asyncHandler(async (req: Request, res: Response) => {
  try {
    const salesAmount = 1000; // 模拟销售额

    // 动态读取佣金配置
    const personalRate = await configService.getConfig<number>('commission_personal_rate', 0.05);
    const directReferralRate = await configService.getConfig<number>('commission_direct_referral_rate', 0.02);
    const teamBonusRate = await configService.getConfig<number>('commission_team_bonus_rate', 0.03);

    // 计算佣金
    const personalCommission = salesAmount * personalRate;
    const referralCommission = salesAmount * directReferralRate;
    const teamBonus = salesAmount * teamBonusRate;
    const totalCommission = personalCommission + referralCommission + teamBonus;

    const result = {
      salesAmount,
      rates: {
        personal: `${(personalRate * 100).toFixed(1)}%`,
        referral: `${(directReferralRate * 100).toFixed(1)}%`,
        teamBonus: `${(teamBonusRate * 100).toFixed(1)}%`
      },
      commissions: {
        personal: personalCommission.toFixed(2),
        referral: referralCommission.toFixed(2),
        teamBonus: teamBonus.toFixed(2),
        total: totalCommission.toFixed(2)
      },
      message: `销售额 ¥${salesAmount} 的总佣金为 ¥${totalCommission.toFixed(2)}`
    };

    res.json(createSuccessResponse(result, '佣金计算演示'));
  } catch (error) {
    logger.error('佣金计算演示失败', { error });
    res.status(500).json(createErrorResponse(
      'DEMO_ERROR',
      '演示执行失败',
      error instanceof Error ? error.message : '未知错误'
    ));
  }
}));

/**
 * 演示5: 通券转账限制检查
 */
router.get('/demo/points-transfer-check', asyncHandler(async (req: Request, res: Response) => {
  try {
    const transferAmount = 500; // 模拟转账金额

    // 动态读取通券配置
    const minAmount = await configService.getConfig<number>('points_min_transfer_amount', 1);
    const maxAmount = await configService.getConfig<number>('points_max_transfer_amount', 100000);
    const dailyLimit = await configService.getConfig<number>('points_daily_transfer_limit', 1000000);
    const feeRate = await configService.getConfig<number>('points_transfer_fee_rate', 0.01);

    // 业务逻辑验证
    const isValid = transferAmount >= minAmount && transferAmount <= maxAmount;
    const fee = isValid ? transferAmount * feeRate : 0;
    const actualAmount = isValid ? transferAmount - fee : 0;

    const result = {
      transferAmount,
      limits: {
        min: minAmount,
        max: maxAmount,
        dailyLimit,
        feeRate: `${(feeRate * 100).toFixed(1)}%`
      },
      validation: {
        isValid,
        fee: fee.toFixed(2),
        actualAmount: actualAmount.toFixed(2),
        reason: isValid ? '转账金额有效' : '转账金额超出限制范围'
      }
    };

    res.json(createSuccessResponse(result, '通券转账检查演示'));
  } catch (error) {
    logger.error('通券转账检查演示失败', { error });
    res.status(500).json(createErrorResponse(
      'DEMO_ERROR',
      '演示执行失败',
      error instanceof Error ? error.message : '未知错误'
    ));
  }
}));

/**
 * 演示6: 动态修改配置参数
 * （生产环境中需要权限验证）
 */
router.post('/demo/update-config', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;

    if (!key || value === undefined) {
      return res.status(400).json(createErrorResponse(
        'VALIDATION_ERROR',
        '缺少必要参数：key 和 value'
      ));
    }

    // 更新配置（这会立即生效，无需重启应用）
    await configService.updateConfig(key, value, {
      lastModifiedBy: 'demo_user'
    });

    // 验证更新是否成功
    const updatedValue = await configService.getConfig(key);

    const result = {
      key,
      oldValue: '（演示中省略）',
      newValue: updatedValue,
      timestamp: new Date().toISOString(),
      message: `配置参数 ${key} 已成功更新为 ${value}`
    };

    // 记录日志
    logger.info('配置参数更新演示', { key, value, result });

    res.json(createSuccessResponse(result, '配置更新演示'));
  } catch (error) {
    logger.error('配置更新演示失败', { error });
    res.status(500).json(createErrorResponse(
      'CONFIG_UPDATE_ERROR',
      '配置更新失败',
      error instanceof Error ? error.message : '未知错误'
    ));
  }
}));

/**
 * 演示7: 缓存性能测试
 */
router.get('/demo/cache-performance', asyncHandler(async (req: Request, res: Response) => {
  try {
    const testKey = 'commission_personal_rate';
    const iterations = 100;

    // 第一次读取（从数据库）
    const startTime1 = Date.now();
    const value1 = await configService.getConfig<number>(testKey);
    const dbTime = Date.now() - startTime1;

    // 后续读取（从缓存）
    const startTime2 = Date.now();
    for (let i = 0; i < iterations; i++) {
      await configService.getConfig<number>(testKey);
    }
    const cacheTime = Date.now() - startTime2;
    const avgCacheTime = cacheTime / iterations;

    const result = {
      testKey,
      value: value1,
      performance: {
        firstRead: `${dbTime}ms (从数据库)`,
        subsequentReads: `${avgCacheTime.toFixed(2)}ms 平均 (从缓存)`,
        improvement: `${(dbTime / avgCacheTime).toFixed(0)}x 更快`
      },
      cacheInfo: {
        timeout: '5分钟',
        autoClear: true
      }
    };

    res.json(createSuccessResponse(result, '缓存性能演示'));
  } catch (error) {
    logger.error('缓存性能演示失败', { error });
    res.status(500).json(createErrorResponse(
      'DEMO_ERROR',
      '演示执行失败',
      error instanceof Error ? error.message : '未知错误'
    ));
  }
}));

export default router;