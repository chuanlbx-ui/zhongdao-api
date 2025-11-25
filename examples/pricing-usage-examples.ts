/**
 * 差异化定价系统使用示例
 * 展示如何在实际业务场景中使用定价服务
 */

import {
  pricingService,
  UserLevel,
  BatchPriceCalculationParams,
  PriceUpdateParams,
  BatchPriceUpdateParams
} from '../src/modules/products';

/**
 * 示例1: 基础价格计算
 */
async function basicPriceCalculationExample() {
  console.log('=== 基础价格计算示例 ===');

  try {
    // 为不同等级用户计算商品价格
    const productId = 'prod-001';
    const levels = [
      UserLevel.NORMAL,
      UserLevel.VIP,
      UserLevel.STAR_1,
      UserLevel.STAR_3,
      UserLevel.DIRECTOR
    ];

    for (const level of levels) {
      const priceResult = await pricingService.calculatePrice(productId, level);

      const discountInfo = pricingService.getLevelDiscountInfo(level);

      console.log(`${discountInfo.displayName}:`);
      console.log(`  基础价格: ¥${priceResult.basePrice}`);
      console.log(`  最终价格: ¥${priceResult.finalPrice}`);
      console.log(`  折扣率: ${(priceResult.discountRate * 100).toFixed(1)}%`);
      console.log(`  节省金额: ¥${priceResult.discountAmount}`);
      console.log(`  特殊定价: ${priceResult.isSpecialPrice ? '是' : '否'}`);
      console.log('---');
    }
  } catch (error) {
    console.error('价格计算失败:', error);
  }
}

/**
 * 示例2: 批量价格计算
 */
async function batchPriceCalculationExample() {
  console.log('=== 批量价格计算示例 ===');

  try {
    const params: BatchPriceCalculationParams = {
      userLevel: UserLevel.STAR_2,
      items: [
        { productId: 'prod-001', quantity: 2 },
        { productId: 'prod-002', quantity: 1 },
        { productId: 'prod-003', specId: 'spec-001', quantity: 3 },
        { productId: 'prod-004', quantity: 1 }
      ]
    };

    const results = await pricingService.batchCalculatePrices(params);

    console.log(`为${pricingService.getLevelDiscountInfo(params.userLevel).name}计算的批量价格:`);
    let totalAmount = 0;
    let totalSaved = 0;

    results.forEach((result, index) => {
      const item = params.items[index];
      totalAmount += result.finalPrice;
      totalSaved += result.discountAmount;

      console.log(`商品${index + 1}: ¥${result.finalPrice} (节省¥${result.discountAmount})`);
      if (item.specId) {
        console.log(`  规格: ${item.specId}`);
      }
      if (item.quantity && item.quantity > 1) {
        console.log(`  数量: ${item.quantity} x 单价¥${(result.finalPrice / item.quantity).toFixed(2)}`);
      }
    });

    console.log(`总计: ¥${totalAmount.toFixed(2)} (共节省¥${totalSaved.toFixed(2)})`);
  } catch (error) {
    console.error('批量价格计算失败:', error);
  }
}

/**
 * 示例3: 特殊定价设置
 */
async function specialPricingExample() {
  console.log('=== 特殊定价设置示例 ===');

  try {
    // 为VIP会员设置特殊定价
    const specialPriceUpdate: PriceUpdateParams = {
      productId: 'prod-001',
      userLevel: UserLevel.VIP,
      price: 85, // 特殊价格，不是按5%折扣计算
      isSpecialPrice: true
    };

    const updateResult = await pricingService.updateProductPricing(specialPriceUpdate);

    if (updateResult.success) {
      console.log('✓ 特殊定价设置成功');

      // 验证特殊定价是否生效
      const priceResult = await pricingService.calculatePrice('prod-001', UserLevel.VIP);
      console.log(`VIP会员特殊价格: ¥${priceResult.finalPrice}`);
      console.log(`是否特殊定价: ${priceResult.isSpecialPrice ? '是' : '否'}`);
    } else {
      console.log('✗ 特殊定价设置失败:', updateResult.message);
    }
  } catch (error) {
    console.error('特殊定价设置失败:', error);
  }
}

/**
 * 示例4: 批量价格管理
 */
async function batchPriceManagementExample() {
  console.log('=== 批量价格管理示例 ===');

  try {
    // 批量设置多个商品的定价
    const batchUpdate: BatchPriceUpdateParams = {
      updatedBy: 'admin-001',
      updates: [
        { productId: 'prod-001', userLevel: UserLevel.STAR_1, price: 50 },
        { productId: 'prod-001', userLevel: UserLevel.STAR_2, price: 45 },
        { productId: 'prod-002', userLevel: UserLevel.VIP, price: 88 },
        { productId: 'prod-002', userLevel: UserLevel.STAR_1, price: 55 },
        { productId: 'prod-003', userLevel: UserLevel.DIRECTOR, price: 30 }
      ]
    };

    const batchResult = await pricingService.batchUpdateProductPricing(batchUpdate);

    console.log(`批量更新完成: ${batchResult.successCount}成功, ${batchResult.failCount}失败`);

    batchResult.results.forEach(result => {
      const status = result.success ? '✓' : '✗';
      const levelName = pricingService.getLevelDiscountInfo(result.userLevel).name;
      console.log(`${status} 商品${result.productId} ${levelName}: ${result.message}`);
    });
  } catch (error) {
    console.error('批量价格管理失败:', error);
  }
}

/**
 * 示例5: 获取商品的所有等级定价
 */
async function getAllLevelsPricingExample() {
  console.log('=== 商品所有等级定价示例 ===');

  try {
    const productId = 'prod-001';
    const allLevelPrices = await pricingService.getProductPricingForAllLevels(productId);

    console.log(`商品 ${productId} 的所有等级定价:`);

    allLevelPrices.forEach(priceResult => {
      const discountInfo = pricingService.getLevelDiscountInfo(priceResult.userLevel);
      console.log(`${discountInfo.displayName}: ¥${priceResult.finalPrice} (${(priceResult.discountRate * 100).toFixed(1)}%折扣)`);
    });

    // 获取所有等级折扣配置
    const allDiscounts = pricingService.getAllLevelDiscounts();
    console.log('\n所有等级折扣配置:');
    Object.entries(allDiscounts).forEach(([level, config]) => {
      console.log(`${config.displayName}: ${(config.rate * 100).toFixed(1)}%折扣`);
    });
  } catch (error) {
    console.error('获取所有等级定价失败:', error);
  }
}

/**
 * 示例6: 定价缓存管理
 */
async function cacheManagementExample() {
  console.log('=== 定价缓存管理示例 ===');

  try {
    // 获取缓存统计
    const cacheStats = pricingService.getCacheStats();
    console.log('当前缓存统计:', cacheStats);

    // 计算一些价格来填充缓存
    await pricingService.calculatePrice('prod-001', UserLevel.VIP);
    await pricingService.calculatePrice('prod-001', UserLevel.STAR_1);
    await pricingService.calculatePrice('prod-002', UserLevel.DIRECTOR);

    // 再次获取缓存统计
    const updatedCacheStats = pricingService.getCacheStats();
    console.log('填充后的缓存统计:', updatedCacheStats);

    // 设置自定义缓存TTL
    pricingService.setCacheTTL(10 * 60 * 1000); // 10分钟
    console.log('缓存TTL已设置为10分钟');

    // 清除所有缓存
    pricingService.clearAllCache();
    const clearedCacheStats = pricingService.getCacheStats();
    console.log('清除后的缓存统计:', clearedCacheStats);
  } catch (error) {
    console.error('缓存管理失败:', error);
  }
}

/**
 * 示例7: 删除定价
 */
async function deletePricingExample() {
  console.log('=== 删除定价示例 ===');

  try {
    // 删除特定商品和等级的定价
    const deleteResult = await pricingService.deleteProductPricing(
      'prod-001',
      UserLevel.VIP
    );

    if (deleteResult.success) {
      console.log('✓', deleteResult.message);

      // 验证删除后是否使用默认折扣
      const priceResult = await pricingService.calculatePrice('prod-001', UserLevel.VIP);
      console.log(`删除后的VIP价格: ¥${priceResult.finalPrice} (特殊定价: ${priceResult.isSpecialPrice})`);
    } else {
      console.log('✗', deleteResult.message);
    }
  } catch (error) {
    console.error('删除定价失败:', error);
  }
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  console.log('开始运行差异化定价系统示例...\n');

  await basicPriceCalculationExample();
  console.log('\n');

  await batchPriceCalculationExample();
  console.log('\n');

  await specialPricingExample();
  console.log('\n');

  await batchPriceManagementExample();
  console.log('\n');

  await getAllLevelsPricingExample();
  console.log('\n');

  await cacheManagementExample();
  console.log('\n');

  await deletePricingExample();
  console.log('\n');

  console.log('所有示例运行完成！');
}

// 如果直接运行此文件，则执行所有示例
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  basicPriceCalculationExample,
  batchPriceCalculationExample,
  specialPricingExample,
  batchPriceManagementExample,
  getAllLevelsPricingExample,
  cacheManagementExample,
  deletePricingExample,
  runAllExamples
};