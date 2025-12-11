/**
 * 系统配置初始化脚本
 * 用于初始化所有默认配置到数据库
 */

import { configService } from './config.service';
import { logger } from '@/shared/utils/logger';
import type { CloudShopLevelConfig, CommissionConfig, PointsConfig, OrderConfig, InventoryConfig } from './config.types';

/**
 * 默认的云店等级配置
 */
const defaultCloudShopLevels: Record<number, CloudShopLevelConfig> = {
  1: {
    level: 1,
    name: '一星店长',
    minBottles: 4,
    minTeamSize: 0,
    minDirectMembers: 0,
    purchaseDiscount: 0.4,
    monthlyTarget: 2400,
    monthlyCommission: 600,
    description: '基础店长等级，无团队要求'
  },
  2: {
    level: 2,
    name: '二星店长',
    minBottles: 20,
    minTeamSize: 2,
    minDirectMembers: 2,
    purchaseDiscount: 0.35,
    monthlyTarget: 12000,
    monthlyCommission: 3000,
    description: '需要2个一星店长直推'
  },
  3: {
    level: 3,
    name: '三星店长',
    minBottles: 120,
    minTeamSize: 4,
    minDirectMembers: 2,
    purchaseDiscount: 0.3,
    monthlyTarget: 72000,
    monthlyCommission: 15000,
    description: '需要2个二星店长直推'
  },
  4: {
    level: 4,
    name: '四星店长',
    minBottles: 600,
    minTeamSize: 8,
    minDirectMembers: 2,
    purchaseDiscount: 0.26,
    monthlyTarget: 360000,
    monthlyCommission: 72000,
    description: '需要2个三星店长直推'
  },
  5: {
    level: 5,
    name: '五星店长',
    minBottles: 2400,
    minTeamSize: 16,
    minDirectMembers: 2,
    purchaseDiscount: 0.24,
    monthlyTarget: 1200000,
    monthlyCommission: 288000,
    description: '需要2个四星店长直推'
  },
  6: {
    level: 6,
    name: '董事',
    minBottles: 12000,
    minTeamSize: 32,
    minDirectMembers: 2,
    purchaseDiscount: 0.22,
    monthlyTarget: 6000000,
    monthlyCommission: 1320000,
    description: '需要2个五星店长直推'
  }
};

/**
 * 默认佣金配置
 */
const defaultCommissionConfig: CommissionConfig = {
  personalCommissionRate: 0.05,      // 个人销售5%佣金
  directReferralRate: 0.02,          // 直推2%佣金
  indirectReferralRate: 0.01,        // 间接推荐1%佣金
  teamBonusRate: 0.03,               // 团队奖金3%
  levelBonusRate: 0.02,              // 等级奖金2%
  performanceBonusThreshold: 10000   // 业绩奖金阈值10000元
};

/**
 * 默认通券配置
 */
const defaultPointsConfig: PointsConfig = {
  minTransferAmount: 1,              // 最低转账1元
  maxTransferAmount: 100000,         // 最高转账10万元
  dailyTransferLimit: 1000000,       // 每日转账限额100万元
  transferFeeRate: 0.01,             // 转账手续费1%
  freezeThreshold: 100000            // 冻结阈值10万元
};

/**
 * 默认订单配置
 */
const defaultOrderConfig: OrderConfig = {
  autoCancelMinutes: 30,             // 30分钟未支付自动取消
  refundDays: 7,                     // 7天退款期限
  defaultShippingFee: 10,            // 默认运费10元
  freeShippingThreshold: 200         // 满200包邮
};

/**
 * 默认库存配置
 */
const defaultInventoryConfig: InventoryConfig = {
  warningThreshold: 10,              // 库存少于10件预警
  autoReorderEnabled: false,         // 不启用自动补货
  autoReorderQuantity: 100           // 自动补货数量100
};

/**
 * 初始化所有配置
 */
export async function initializeConfigs(): Promise<void> {
  try {
    // 检查数据库连接
    const { checkDatabaseHealth } = require('../../shared/database/client');
    try {
      const isHealthy = await checkDatabaseHealth();
      if (!isHealthy) {
        // 数据库未连接，跳过配置初始化（静默处理）
        if (process.env.NODE_ENV === 'development') {
          console.log('⚠️ 数据库未连接，使用默认配置');
        }
        return;
      }
    } catch (dbError) {
      // 数据库未连接，跳过配置初始化（静默处理）
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ 数据库未连接，使用默认配置');
      }
      return;
    }

    logger.info('开始初始化系统配置...');

    // 初始化云店等级配置
    for (const [level, config] of Object.entries(defaultCloudShopLevels)) {
      const key = `cloud_shop_level_${level}`;
      try {
        await configService.updateConfig(key, config, {
          description: `${config.name}等级配置`,
          category: 'cloud_shop_levels',
          type: 'JSON'
        });
      } catch (error) {
        logger.warn(`⚠️ 配置 ${key} 初始化失败，使用默认值`);
      }
    }
    logger.info('✓ 云店等级配置初始化完成');

    // 初始化佣金配置
    const commissionKeys = {
      'commission_personal_rate': defaultCommissionConfig.personalCommissionRate,
      'commission_direct_referral_rate': defaultCommissionConfig.directReferralRate,
      'commission_indirect_referral_rate': defaultCommissionConfig.indirectReferralRate,
      'commission_team_bonus_rate': defaultCommissionConfig.teamBonusRate,
      'commission_level_bonus_rate': defaultCommissionConfig.levelBonusRate,
      'commission_performance_threshold': defaultCommissionConfig.performanceBonusThreshold
    };

    for (const [key, value] of Object.entries(commissionKeys)) {
      try {
        await configService.updateConfig(key, value, {
          category: 'commission',
          type: 'NUMBER'
        });
      } catch (error) {
        logger.warn(`⚠️ 配置 ${key} 初始化失败，使用默认值`);
      }
    }
    logger.info('✓ 佣金配置初始化完成');

    // 初始化通券配置
    const pointsKeys = {
      'points_min_transfer_amount': defaultPointsConfig.minTransferAmount,
      'points_max_transfer_amount': defaultPointsConfig.maxTransferAmount,
      'points_daily_transfer_limit': defaultPointsConfig.dailyTransferLimit,
      'points_transfer_fee_rate': defaultPointsConfig.transferFeeRate,
      'points_freeze_threshold': defaultPointsConfig.freezeThreshold
    };

    for (const [key, value] of Object.entries(pointsKeys)) {
      try {
        await configService.updateConfig(key, value, {
          category: 'points',
          type: 'NUMBER'
        });
      } catch (error) {
        logger.warn(`⚠️ 配置 ${key} 初始化失败，使用默认值`);
      }
    }
    logger.info('✓ 通券配置初始化完成');

    // 初始化订单配置
    const orderKeys = {
      'order_auto_cancel_minutes': defaultOrderConfig.autoCancelMinutes,
      'order_refund_days': defaultOrderConfig.refundDays,
      'order_default_shipping_fee': defaultOrderConfig.defaultShippingFee,
      'order_free_shipping_threshold': defaultOrderConfig.freeShippingThreshold
    };

    for (const [key, value] of Object.entries(orderKeys)) {
      try {
        await configService.updateConfig(key, value, {
          category: 'order',
          type: 'NUMBER'
        });
      } catch (error) {
        logger.warn(`⚠️ 配置 ${key} 初始化失败，使用默认值`);
      }
    }
    logger.info('✓ 订单配置初始化完成');

    // 初始化库存配置
    const inventoryKeys = {
      'inventory_warning_threshold': defaultInventoryConfig.warningThreshold,
      'inventory_auto_reorder_enabled': defaultInventoryConfig.autoReorderEnabled,
      'inventory_auto_reorder_quantity': defaultInventoryConfig.autoReorderQuantity
    };

    for (const [key, value] of Object.entries(inventoryKeys)) {
      try {
        await configService.updateConfig(key, value, {
          category: 'inventory',
          type: typeof value === 'boolean' ? 'BOOLEAN' : 'NUMBER'
        });
      } catch (error) {
        logger.warn(`⚠️ 配置 ${key} 初始化失败，使用默认值`);
      }
    }
    logger.info('✓ 库存配置初始化完成');

    logger.info('✅ 系统配置已初始化');
  } catch (error) {
    logger.warn('⚠️ 系统配置初始化失败，将使用默认配置');
    // 不抛出错误，让应用继续运行
  }
}

/**
 * 获取所有默认配置
 */
export function getDefaultConfigs() {
  return {
    cloudShopLevels: defaultCloudShopLevels,
    commissionConfig: defaultCommissionConfig,
    pointsConfig: defaultPointsConfig,
    orderConfig: defaultOrderConfig,
    inventoryConfig: defaultInventoryConfig
  };
}
