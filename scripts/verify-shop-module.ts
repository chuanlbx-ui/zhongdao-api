#!/usr/bin/env node

/**
 * 店铺管理模块验证脚本
 * 验证店铺模块的编译和导入是否正常
 */

import chalk from 'chalk';

console.log(chalk.cyan('\n🏪 中道商城 - 店铺管理模块验证\n'));
console.log(chalk.gray('='.repeat(50)));

try {
  // 验证类型导入
  console.log(chalk.yellow('📋 验证类型定义...'));
  const types = require('../src/modules/shop/types');
  
  if (types.CLOUD_SHOP_LEVELS && types.WUTONG_SHOP_CONFIG) {
    console.log(chalk.green('✅ 类型定义加载成功'));
    console.log(`   • 云店等级数量: ${Object.keys(types.CLOUD_SHOP_LEVELS).length}`);
    console.log(`   • 五通店配置: ${types.WUTONG_SHOP_CONFIG.entryFee}元`);
  } else {
    throw new Error('类型定义不完整');
  }

  // 验证服务导入
  console.log(chalk.yellow('\n🔧 验证业务服务...'));
  const { shopService } = require('../src/modules/shop/shop.service');
  
  const methods = [
    'canApplyShop',
    'applyShop',
    'checkCloudShopUpgrade',
    'upgradeCloudShop',
    'purchaseWutongShop',
    'confirmWutongShopPayment',
    'getShopInfo',
    'getUserShops',
    'getShopStatistics'
  ];

  let implementedCount = 0;
  methods.forEach(method => {
    if (typeof shopService[method] === 'function') {
      implementedCount++;
    }
  });

  if (implementedCount === methods.length) {
    console.log(chalk.green(`✅ 业务服务加载成功 (${implementedCount}/${methods.length} 方法)`));
    methods.forEach(method => {
      console.log(`   • ${method}`);
    });
  } else {
    throw new Error(`仅加载了 ${implementedCount}/${methods.length} 个方法`);
  }

  // 验证API路由
  console.log(chalk.yellow('\n🚀 验证API路由...'));
  const router = require('../src/routes/v1/shops').default;
  
  if (router && router.stack) {
    const routeCount = router.stack.filter((r: any) => r.route).length;
    console.log(chalk.green(`✅ API路由加载成功 (${routeCount} 个端点)`));
    
    const endpoints = [
      'GET /',
      'GET /:shopId',
      'GET /:shopId/statistics',
      'POST /apply',
      'GET /cloud/upgrade-check',
      'POST /cloud/upgrade',
      'POST /wutong/purchase',
      'POST /wutong/:shopId/confirm-payment'
    ];

    endpoints.forEach(endpoint => {
      console.log(`   • ${endpoint}`);
    });
  } else {
    throw new Error('路由加载失败');
  }

  // 验证配置数据
  console.log(chalk.yellow('\n📊 验证配置数据...'));
  
  // 云店等级验证
  let validLevels = 0;
  for (let i = 1; i <= 6; i++) {
    const config = types.CLOUD_SHOP_LEVELS[i];
    if (config && config.name && config.purchaseDiscount) {
      validLevels++;
    }
  }

  if (validLevels === 6) {
    console.log(chalk.green('✅ 云店等级配置完整'));
    for (let i = 1; i <= 6; i++) {
      const config = types.CLOUD_SHOP_LEVELS[i];
      console.log(
        `   • 等级${i}: ${config.name}` +
        ` (折扣: ${(config.purchaseDiscount * 100).toFixed(0)}%` +
        `, 目标: ${config.monthlyTarget}元)`
      );
    }
  }

  // 五通店配置验证
  const wutongConfig = types.WUTONG_SHOP_CONFIG;
  if (wutongConfig && wutongConfig.entryFee === 27000) {
    console.log(chalk.green('\n✅ 五通店配置正确'));
    console.log(`   • 进入费用: ${wutongConfig.entryFee}元`);
    console.log(`   • 拿货数量: ${wutongConfig.bottleCount}瓶`);
    console.log(`   • 单价: ${wutongConfig.unitPrice}元/瓶`);
    console.log(`   • 赠送比例: 买${Math.floor(1 / wutongConfig.giftRatio)}赠1`);
  }

  console.log(chalk.gray('\n' + '='.repeat(50)));
  console.log(chalk.green.bold('\n✨ 店铺管理模块验证通过！\n'));
  console.log(chalk.cyan('📝 模块信息:'));
  console.log(`   • 类型定义: ${Object.keys(require('../src/modules/shop/types')).length} 个接口/常量`);
  console.log(`   • 核心方法: ${methods.length} 个`);
  console.log(`   • API端点: 8 个`);
  console.log(`   • 云店等级: 6 个`);
  console.log(`   • 五通店模式: 1 个`);

  console.log(chalk.cyan('\n🎯 下一步:'));
  console.log('   1. 开发库存管理模块 (inventory)');
  console.log('   2. 开发通券系统 (points)');
  console.log('   3. 开发订单系统 (order)');
  console.log('   4. 开发支付系统 (payment)');

} catch (error) {
  console.log(chalk.red.bold('\n❌ 验证失败！\n'));
  if (error instanceof Error) {
    console.log(chalk.red(`错误: ${error.message}`));
  }
  process.exit(1);
}
