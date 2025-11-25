/**
 * 采购权限验证功能使用示例
 *
 * 这个文件展示了如何使用中道商城系统的采购权限验证功能
 */

import { purchaseService } from '../src/modules/purchase/purchase.service';
import { UserLevel } from '../src/modules/user/level.service';

/**
 * 基本使用示例
 */
async function basicExample() {
  console.log('=== 基本使用示例 ===');

  // 模拟采购验证请求
  const buyerId = 'user-normal-001';
  const sellerId = 'user-vip-001';
  const productId = 'product-001';
  const quantity = 10;

  try {
    const result = await purchaseService.validatePurchasePermission(
      buyerId,
      sellerId,
      productId,
      quantity
    );

    console.log('验证结果:', {
      isValid: result.isValid,
      canPurchase: result.canPurchase,
      reasons: result.reasons,
      restrictions: result.restrictions,
      metadata: result.metadata
    });

    if (result.canPurchase) {
      console.log('✅ 采购权限验证通过，可以进行采购');
    } else {
      console.log('❌ 采购权限验证失败，原因:', result.reasons.join('; '));
    }
  } catch (error) {
    console.error('验证过程中发生错误:', error);
  }
}

/**
 * 复杂业务场景示例
 */
async function complexScenarioExample() {
  console.log('\n=== 复杂业务场景示例 ===');

  // 场景：NORMAL用户尝试向平级VIP用户采购，需要找到更高级别的上级
  const scenarios = [
    {
      name: '正常采购：NORMAL -> VIP',
      buyerId: 'user-normal-001',
      sellerId: 'user-vip-001',
      expected: true
    },
    {
      name: '违规采购：STAR_2 -> VIP（等级过高）',
      buyerId: 'user-star2-001',
      sellerId: 'user-vip-001',
      expected: false
    },
    {
      name: '平级处理：STAR_1 -> STAR_1（需要找上级）',
      buyerId: 'user-star1-001',
      sellerId: 'user-star1-002',
      expected: true
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n场景: ${scenario.name}`);

    try {
      const result = await purchaseService.validatePurchasePermission(
        scenario.buyerId,
        scenario.sellerId,
        'product-001',
        5
      );

      const status = result.canPurchase ? '✅' : '❌';
      console.log(`${status} 结果: ${result.canPurchase ? '通过' : '失败'}`);

      if (result.reasons.length > 0) {
        console.log(`   原因: ${result.reasons.join('; ')}`);
      }

      // 显示性能信息
      if (result.metadata?.performance) {
        console.log(`   响应时间: ${result.metadata.performance.responseTime}ms`);
        console.log(`   缓存命中率: ${result.metadata.performance.cacheHitRate.toFixed(1)}%`);
      }

      // 显示等级比较信息
      if (result.metadata?.levelComparison) {
        const lc = result.metadata.levelComparison;
        console.log(`   等级比较: ${lc.buyerLevel} -> ${lc.finalSellerLevel || lc.originalSellerLevel}`);
      }
    } catch (error) {
      console.error(`场景 ${scenario.name} 执行失败:`, error);
    }
  }
}

/**
 * 性能监控示例
 */
async function performanceMonitoringExample() {
  console.log('\n=== 性能监控示例 ===');

  // 执行多次验证以生成性能数据
  const requests = Array.from({ length: 20 }, (_, i) => ({
    buyerId: `user-${i % 2 === 0 ? 'normal' : 'vip'}-001`,
    sellerId: `user-${i % 2 === 0 ? 'vip' : 'star1'}-001`,
    productId: 'product-001',
    quantity: Math.floor(Math.random() * 10) + 1
  }));

  console.log(`执行 ${requests.length} 次验证请求...`);

  const startTime = Date.now();

  // 并行执行验证
  const results = await Promise.allSettled(
    requests.map(req =>
      purchaseService.validatePurchasePermission(
        req.buyerId,
        req.sellerId,
        req.productId,
        req.quantity
      )
    )
  );

  const totalTime = Date.now() - startTime;

  // 统计结果
  const successful = results.filter(r =>
    r.status === 'fulfilled' && r.value.canPurchase
  ).length;

  const failed = results.filter(r =>
    r.status === 'fulfilled' && !r.value.canPurchase
  ).length;

  const errors = results.filter(r => r.status === 'rejected').length;

  console.log('\n执行结果统计:');
  console.log(`✅ 成功: ${successful}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`💥 错误: ${errors}`);
  console.log(`⏱️  总耗时: ${totalTime}ms`);
  console.log(`⚡ 平均响应时间: ${(totalTime / requests.length).toFixed(1)}ms`);

  // 显示性能统计
  const stats = purchaseService.getPerformanceStats();
  console.log('\n性能统计:');
  console.log(`总验证次数: ${stats.totalValidations}`);
  console.log(`缓存命中: ${stats.cacheHits}`);
  console.log(`缓存未命中: ${stats.cacheMisses}`);
  console.log(`缓存命中率: ${stats.cacheHitRate.toFixed(1)}%`);
  console.log(`平均响应时间: ${stats.averageResponseTime.toFixed(1)}ms`);
  console.log(`缓存大小:`, stats.cacheSize);
}

/**
 * 缓存管理示例
 */
async function cacheManagementExample() {
  console.log('\n=== 缓存管理示例 ===');

  // 查看当前缓存状态
  const statsBefore = purchaseService.getPerformanceStats();
  console.log('清理前缓存状态:', statsBefore.cacheSize);

  // 执行一些验证以填充缓存
  await purchaseService.validatePurchasePermission('user-1', 'user-2', 'product-1', 5);
  await purchaseService.validatePurchasePermission('user-3', 'user-4', 'product-2', 3);

  const statsAfter = purchaseService.getPerformanceStats();
  console.log('填充后缓存状态:', statsAfter.cacheSize);

  // 清理缓存
  purchaseService.clearCache();

  const statsAfterClear = purchaseService.getPerformanceStats();
  console.log('清理后缓存状态:', statsAfterClear.cacheSize);
}

/**
 * 错误处理示例
 */
async function errorHandlingExample() {
  console.log('\n=== 错误处理示例 ===');

  // 测试各种错误情况
  const errorScenarios = [
    {
      name: '采购用户不存在',
      params: ['nonexistent-buyer', 'user-vip-001', 'product-001', 5]
    },
    {
      name: '销售用户不存在',
      params: ['user-normal-001', 'nonexistent-seller', 'product-001', 5]
    },
    {
      name: '商品不存在',
      params: ['user-normal-001', 'user-vip-001', 'nonexistent-product', 5]
    }
  ];

  for (const scenario of errorScenarios) {
    console.log(`\n测试: ${scenario.name}`);

    try {
      const result = await purchaseService.validatePurchasePermission(
        ...scenario.params as [string, string, string, number]
      );

      if (!result.isValid) {
        console.log(`✅ 正确捕获错误: ${result.reasons.join('; ')}`);
      } else {
        console.log(`⚠️  预期错误但验证通过`);
      }
    } catch (error) {
      console.log(`✅ 正确捕获异常: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 中道商城系统 - 采购权限验证功能示例\n');

  try {
    await basicExample();
    await complexScenarioExample();
    await performanceMonitoringExample();
    await cacheManagementExample();
    await errorHandlingExample();

    console.log('\n✅ 所有示例执行完成');
  } catch (error) {
    console.error('\n💥 示例执行过程中发生错误:', error);
  }
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicExample,
  complexScenarioExample,
  performanceMonitoringExample,
  cacheManagementExample,
  errorHandlingExample
};