/**
 * 团队业绩服务使用示例
 * 展示如何使用业绩统计系统的各项功能
 */

import { performanceService } from './performance.service';
import { TeamRole, CommissionType } from './types';

// ==================== 基础使用示例 ====================

/**
 * 示例1: 计算用户当月个人业绩
 */
export async function example1_CalculatePersonalPerformance() {
  try {
    const userId = 'user123';
    const period = '2025-11'; // 2025年11月

    const personalPerformance = await performanceService.calculatePersonalPerformance(userId, period);

// [DEBUG REMOVED]     console.log('=== 个人业绩统计 ===');
// [DEBUG REMOVED]     console.log(`用户ID: ${userId}`);
// [DEBUG REMOVED]     console.log(`统计周期: ${period}`);
// [DEBUG REMOVED]     console.log(`销售额: ¥${personalPerformance.salesAmount.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`订单数: ${personalPerformance.orderCount}`);
// [DEBUG REMOVED]     console.log(`新客数: ${personalPerformance.newCustomers}`);
// [DEBUG REMOVED]     console.log(`复购率: ${(personalPerformance.repeatRate * 100).toFixed(2)}%`);
// [DEBUG REMOVED]     console.log(`平均订单价值: ¥${personalPerformance.averageOrderValue.toFixed(2)}`);
// [DEBUG REMOVED]     console.log(`月至今: ¥${personalPerformance.monthToDate.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`年至今: ¥${personalPerformance.yearToDate.toLocaleString()}`);

    return personalPerformance;
  } catch (error) {
    console.error('计算个人业绩失败:', error);
    throw error;
  }
}

/**
 * 示例2: 计算用户团队业绩
 */
export async function example2_CalculateTeamPerformance() {
  try {
    const userId = 'leader456';
    const period = '2025-11';

    const teamPerformance = await performanceService.calculateTeamPerformance(userId, period);

// [DEBUG REMOVED]     console.log('=== 团队业绩统计 ===');
// [DEBUG REMOVED]     console.log(`团队负责人ID: ${userId}`);
// [DEBUG REMOVED]     console.log(`团队销售额: ¥${teamPerformance.teamSales.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`团队订单数: ${teamPerformance.teamOrders}`);
// [DEBUG REMOVED]     console.log(`新增成员: ${teamPerformance.newMembers}人`);
// [DEBUG REMOVED]     console.log(`团队活跃率: ${(teamPerformance.activeRate * 100).toFixed(2)}%`);
// [DEBUG REMOVED]     console.log(`人均生产力: ¥${teamPerformance.productivity.toFixed(2)}`);

// [DEBUG REMOVED]     console.log('\n=== 层级分布 ===');
    teamPerformance.levelDistribution.forEach(level => {
// [DEBUG REMOVED]       console.log(`层级${level.level}: ${level.memberCount}人, 销售额¥${level.sales.toLocaleString()}`);
    });

    return teamPerformance;
  } catch (error) {
    console.error('计算团队业绩失败:', error);
    throw error;
  }
}

/**
 * 示例3: 计算推荐业绩
 */
export async function example3_CalculateReferralPerformance() {
  try {
    const userId = 'referrer789';
    const period = '2025-11';

    const performanceServiceData = await performanceService.calculateReferralPerformance(userId, period);

// [DEBUG REMOVED]     console.log('=== 推荐业绩统计 ===');
// [DEBUG REMOVED]     console.log(`推荐人ID: ${userId}`);
// [DEBUG REMOVED]     console.log(`直推人数: ${null.directReferrals}人`);
// [DEBUG REMOVED]     console.log(`间推人数: ${null.indirectReferrals}人`);
// [DEBUG REMOVED]     console.log(`推荐收入: ¥${null.referralRevenue.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`网络增长率: ${(null.networkGrowth * 100).toFixed(2)}%`);
// [DEBUG REMOVED]     console.log(`活跃推荐人: ${null.activeReferrals}人`);
// [DEBUG REMOVED]     console.log(`转化率: ${(null.conversionRate * 100).toFixed(2)}%`);

    return null;
  } catch (error) {
    console.error('计算推荐业绩失败:', error);
    throw error;
  }
}

// ==================== 排行榜示例 ====================

/**
 * 示例4: 获取个人销售排行榜
 */
export async function example4_GetPersonalLeaderboard() {
  try {
    const period = '2025-11';
    const limit = 20;

    const leaderboard = await performanceService.getPerformanceLeaderboard('personal', period, limit);

// [DEBUG REMOVED]     console.log('=== 个人销售排行榜 ===');
// [DEBUG REMOVED]     console.log(`统计周期: ${period}`);
// [DEBUG REMOVED]     console.log(`显示前${limit}名\n`);

    leaderboard.forEach((item, index) => {
      const changeSymbol = item.change > 0 ? '↑' : item.change < 0 ? '↓' : '→';
// [DEBUG REMOVED]       console.log(`${item.rank.toString().padStart(2)}. ${item.nickname.padEnd(12)} ${item.role.padEnd(8)} ¥${item.value.toLocaleString().padStart(10)} ${changeSymbol}${Math.abs(item.change)}`);
    });

    return leaderboard;
  } catch (error) {
    console.error('获取个人排行榜失败:', error);
    throw error;
  }
}

/**
 * 示例5: 查看用户在排行榜中的位置
 */
export async function example5_GetUserRanking() {
  try {
    const userId = 'user123';
    const period = '2025-11';

    const ranking = await performanceService.getLeaderboardRanking(userId, 'personal', period);

// [DEBUG REMOVED]     console.log('=== 用户排行榜位置 ===');
// [DEBUG REMOVED]     console.log(`用户ID: ${userId}`);
// [DEBUG REMOVED]     console.log(`统计周期: ${period}`);

    if (ranking.rank === -1) {
// [DEBUG REMOVED]       console.log('用户未进入排行榜');
    } else {
// [DEBUG REMOVED]       console.log(`当前排名: ${ranking.rank}`);
// [DEBUG REMOVED]       console.log(`总参与人数: ${ranking.total}`);
// [DEBUG REMOVED]       console.log(`百分位排名: 前${ranking.percentile.toFixed(2)}%`);

      if (ranking.item) {
// [DEBUG REMOVED]         console.log(`销售业绩: ¥${ranking.item.value.toLocaleString()}`);
// [DEBUG REMOVED]         console.log(`团队名称: ${ranking.item.teamName || '无'}`);
      }
    }

    return ranking;
  } catch (error) {
    console.error('获取用户排名失败:', error);
    throw error;
  }
}

// ==================== 晋级进度示例 ====================

/**
 * 示例6: 分析用户晋级进度
 */
export async function example6_AnalyzeUpgradeProgress() {
  try {
    const userId = 'user456';
    const targetLevel = TeamRole.DIRECTOR; // 三星店长

    const progress = await performanceService.getUpgradeProgress(userId, targetLevel);

// [DEBUG REMOVED]     console.log('=== 晋级进度分析 ===');
// [DEBUG REMOVED]     console.log(`用户ID: ${userId}`);
// [DEBUG REMOVED]     console.log(`当前等级: ${progress.currentLevel}`);
// [DEBUG REMOVED]     console.log(`目标等级: ${progress.targetLevel}`);
// [DEBUG REMOVED]     console.log(`总体进度: ${progress.progressPercentage.toFixed(2)}%`);
// [DEBUG REMOVED]     console.log(`月增长率: ${(progress.monthlyGrowthRate * 100).toFixed(2)}%`);

    if (progress.estimatedTime !== undefined) {
// [DEBUG REMOVED]       console.log(`预计晋级时间: ${progress.estimatedTime}天后`);
    }

// [DEBUG REMOVED]     console.log('\n=== 具体要求完成情况 ===');
    progress.requirementsMet.forEach(req => {
      const status = req.met ? '✅' : '❌';
      const progressBar = '█'.repeat(Math.floor(req.percentage / 5)) + '░'.repeat(20 - Math.floor(req.percentage / 5));
// [DEBUG REMOVED]       console.log(`${status} ${req.requirement.padEnd(12)} ${req.current}/${req.required} ${progressBar} ${req.percentage.toFixed(1)}%`);
    });

    return progress;
  } catch (error) {
    console.error('分析晋级进度失败:', error);
    throw error;
  }
}

/**
 * 示例7: 批量检查团队晋级情况
 */
export async function example7_BatchCheckTeamUpgrades() {
  try {
    const leaderId = 'teamLeader789';
    const teamMembers = ['member1', 'member2', 'member3', 'member4', 'member5'];

// [DEBUG REMOVED]     console.log('=== 团队晋级情况检查 ===');
// [DEBUG REMOVED]     console.log(`团队负责人: ${leaderId}`);

    const results = await Promise.all(
      teamMembers.map(async memberId => {
        try {
          const progress = await performanceService.getUpgradeProgress(memberId);
          return {
            memberId,
            success: true,
            currentLevel: progress.currentLevel,
            targetLevel: progress.targetLevel,
            progressPercentage: progress.progressPercentage,
            canUpgradeSoon: progress.progressPercentage > 80
          };
        } catch (error) {
          return {
            memberId,
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
          };
        }
      })
    );

    results.forEach(result => {
      if (result.success) {
        const upgradeStatus = result.canUpgradeSoon ? '🚀 即将晋级' : '📈 努力中';
// [DEBUG REMOVED]         console.log(`${result.memberId.padEnd(12)} ${result.currentLevel.padEnd(8)} → ${result.targetLevel.padEnd(8)} ${result.progressPercentage.toFixed(1)}% ${upgradeStatus}`);
      } else {
// [DEBUG REMOVED]         console.log(`${result.memberId.padEnd(12)} 检查失败: ${result.error}`);
      }
    });

    return results;
  } catch (error) {
    console.error('批量检查团队晋级失败:', error);
    throw error;
  }
}

// ==================== 佣金预测示例 ====================

/**
 * 示例8: 预测用户佣金收入
 */
export async function example8_PredictCommission() {
  try {
    const userId = 'user123';
    const period = '2025-11';

    const forecast = await performanceService.predictCommission(userId, period);

// [DEBUG REMOVED]     console.log('=== 佣金预测分析 ===');
// [DEBUG REMOVED]     console.log(`用户ID: ${userId}`);
// [DEBUG REMOVED]     console.log(`预测周期: ${period}`);

// [DEBUG REMOVED]     console.log('\n--- 当前周期 ---');
// [DEBUG REMOVED]     console.log(`预计佣金: ¥${forecast.currentPeriod.estimatedCommission.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`实际已得: ¥${forecast.currentPeriod.actualToDate.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`周期预测: ¥${forecast.currentPeriod.projection.toLocaleString()}`);

// [DEBUG REMOVED]     console.log('\n--- 下期预测 ---');
// [DEBUG REMOVED]     console.log(`预计佣金: ¥${forecast.nextPeriod.estimatedCommission.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`预测置信度: ${forecast.nextPeriod.confidence}%`);

// [DEBUG REMOVED]     console.log('\n--- 佣金构成 ---');
    forecast.breakdown.forEach(item => {
// [DEBUG REMOVED]       console.log(`${item.type.padEnd(20)} 当前: ¥${item.current.toLocaleString().padStart(10)} 预测: ¥${item.projected.toLocaleString().padStart(10)} 占比: ${item.percentage}%`);
    });

// [DEBUG REMOVED]     console.log('\n--- 容量分析 ---');
// [DEBUG REMOVED]     console.log(`最大潜力: ¥${forecast.capacityAnalysis.maxCapacity.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`当前利用率: ${(forecast.capacityAnalysis.utilizationRate * 100).toFixed(2)}%`);
// [DEBUG REMOVED]     console.log(`增长潜力: ${(forecast.capacityAnalysis.growthPotential * 100).toFixed(2)}%`);

    return forecast;
  } catch (error) {
    console.error('预测佣金失败:', error);
    throw error;
  }
}

/**
 * 示例9: 佣金优化建议
 */
export async function example9_CommissionOptimizationAdvice() {
  try {
    const userId = 'user456';
    const period = '2025-11';

    const [forecast, personalPerf, teamPerf, referralPerf] = await Promise.all([
      performanceService.predictCommission(userId, period),
      performanceService.calculatePersonalPerformance(userId, period),
      performanceService.calculateTeamPerformance(userId, period),
      performanceService.calculateReferralPerformance(userId, period)
    ]);

// [DEBUG REMOVED]     console.log('=== 佣金优化建议 ===');

    const suggestions = [];

    // 分析个人销售
    if (personalPerf.salesAmount < 20000) {
      suggestions.push('💡 建议增加个人销售频率，提升客户复购率');
    }

    // 分析团队表现
    if (teamPerf.activeRate < 0.7) {
      suggestions.push('👥 建议加强团队培训，提高团队活跃度');
    }

    // 分析推荐业务
    if (referralPerf.directReferrals < 3) {
      suggestions.push('🎯 建议加大推荐力度，扩大团队规模');
    }

    // 分析佣金容量
    if (forecast.capacityAnalysis.utilizationRate < 0.5) {
      suggestions.push('🚀 您的佣金潜力巨大，建议制定更高目标');
    }

    if (suggestions.length === 0) {
      suggestions.push('🎉 表现优秀！继续保持当前势头');
    }

    suggestions.forEach((suggestion, index) => {
// [DEBUG REMOVED]       console.log(`${index + 1}. ${suggestion}`);
    });

    return suggestions;
  } catch (error) {
    console.error('生成优化建议失败:', error);
    throw error;
  }
}

// ==================== 数据管理示例 ====================

/**
 * 示例10: 数据验证和修复
 */
export async function example10_DataValidationAndRepair() {
  try {
    const userId = 'user789';
    const period = '2025-11';

// [DEBUG REMOVED]     console.log('=== 数据验证和修复 ===');

    // 验证数据
    const validation = await performanceService.validatePerformanceData(userId, period);

// [DEBUG REMOVED]     console.log(`数据有效性: ${validation.isValid ? '✅ 有效' : '❌ 无效'}`);

    if (validation.errors.length > 0) {
// [DEBUG REMOVED]       console.log('\n错误信息:');
// [DEBUG REMOVED]       validation.errors.forEach(error => console.log(`  ❌ ${error}`));
    }

    if (validation.warnings.length > 0) {
// [DEBUG REMOVED]       console.log('\n警告信息:');
// [DEBUG REMOVED]       validation.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }

    // 如果数据无效，尝试重建
    if (!validation.isValid) {
// [DEBUG REMOVED]       console.log('\n开始重建业绩指标...');
      const rebuildResult = await performanceService.rebuildPerformanceMetrics(userId, period);

      if (rebuildResult.success) {
// [DEBUG REMOVED]         console.log('✅ 业绩指标重建成功');
// [DEBUG REMOVED]         console.log(`个人销售: ¥${rebuildResult.metrics?.personalMetrics.salesAmount.toLocaleString()}`);
// [DEBUG REMOVED]         console.log(`团队销售: ¥${rebuildResult.metrics?.teamMetrics.teamSales.toLocaleString()}`);
      } else {
// [DEBUG REMOVED]         console.log(`❌ 重建失败: ${rebuildResult.message}`);
      }
    }

    return validation;
  } catch (error) {
    console.error('数据验证和修复失败:', error);
    throw error;
  }
}

/**
 * 示例11: 缓存管理
 */
export async function example11_CacheManagement() {
  try {
    const userId = 'user123';

// [DEBUG REMOVED]     console.log('=== 缓存管理演示 ===');

    // 预热缓存
// [DEBUG REMOVED]     console.log('预热用户缓存...');
    await performanceService.warmupCache([userId]);

    // 计算业绩（应该从缓存读取）
// [DEBUG REMOVED]     console.log('第一次计算业绩（缓存读取）...');
    const start1 = Date.now();
    await performanceService.calculatePersonalPerformance(userId, '2025-11');
    const duration1 = Date.now() - start1;
// [DEBUG REMOVED]     console.log(`耗时: ${duration1}ms`);

    // 清除缓存
// [DEBUG REMOVED]     console.log('清除缓存...');
    performanceService.clearUserCache(userId);

    // 再次计算（需要重新查询数据库）
// [DEBUG REMOVED]     console.log('第二次计算业绩（数据库查询）...');
    const start2 = Date.now();
    await performanceService.calculatePersonalPerformance(userId, '2025-11');
    const duration2 = Date.now() - start2;
// [DEBUG REMOVED]     console.log(`耗时: ${duration2}ms`);

// [DEBUG REMOVED]     console.log(`缓存效果: 提升了 ${((duration2 - duration1) / duration2 * 100).toFixed(2)}% 的性能`);

  } catch (error) {
    console.error('缓存管理演示失败:', error);
    throw error;
  }
}

// ==================== 高级功能示例 ====================

/**
 * 示例12: 综合业绩报告
 */
export async function example12_ComprehensivePerformanceReport() {
  try {
    const userId = 'leader456';
    const period = '2025-11';

// [DEBUG REMOVED]     console.log('=== 综合业绩报告 ===');
// [DEBUG REMOVED]     console.log(`报告生成时间: ${new Date().toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`用户ID: ${userId}`);
// [DEBUG REMOVED]     console.log(`统计周期: ${period}\n`);

    // 并行获取所有数据
    const [personalPerf, teamPerf, referralPerf, ranking, upgradeProgress, commissionForecast] = await Promise.all([
      performanceService.calculatePersonalPerformance(userId, period),
      performanceService.calculateTeamPerformance(userId, period),
      performanceService.calculateReferralPerformance(userId, period),
      performanceService.getLeaderboardRanking(userId, 'personal', period),
      performanceService.getUpgradeProgress(userId),
      performanceService.predictCommission(userId, period)
    ]);

    // 个人业绩概览
// [DEBUG REMOVED]     console.log('📊 个人业绩概览');
// [DEBUG REMOVED]     console.log(`   销售额: ¥${personalPerf.salesAmount.toLocaleString()} (${personalPerf.monthToDate.toLocaleString()} 月至今)`);
// [DEBUG REMOVED]     console.log(`   订单数: ${personalPerf.orderCount} 单`);
// [DEBUG REMOVED]     console.log(`   客户数: ${personalPerf.newCustomers} 新客, ${(personalPerf.repeatRate * 100).toFixed(1)}% 复购率`);
// [DEBUG REMOVED]     console.log(`   平均客单: ¥${personalPerf.averageOrderValue.toFixed(2)}`);

    // 团队业绩概览
// [DEBUG REMOVED]     console.log('\n👥 团队业绩概览');
// [DEBUG REMOVED]     console.log(`   团队销售: ¥${teamPerf.teamSales.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`   团队订单: ${teamPerf.teamOrders} 单`);
// [DEBUG REMOVED]     console.log(`   团队规模: ${teamPerf.newMembers} 新增, ${(teamPerf.activeRate * 100).toFixed(1)}% 活跃率`);
// [DEBUG REMOVED]     console.log(`   人均产出: ¥${teamPerf.productivity.toFixed(2)}`);

    // 推荐业绩概览
// [DEBUG REMOVED]     console.log('\n🎯 推荐业绩概览');
// [DEBUG REMOVED]     console.log(`   直推人数: ${null.directReferrals} 人`);
// [DEBUG REMOVED]     console.log(`   推荐收入: ¥${null.referralRevenue.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`   网络增长: ${(null.networkGrowth * 100).toFixed(2)}%`);

    // 排名情况
// [DEBUG REMOVED]     console.log('\n🏆 排名情况');
    if (ranking.rank !== -1) {
// [DEBUG REMOVED]       console.log(`   当前排名: 第${ranking.rank}名 (前${ranking.percentile.toFixed(1)}%)`);
// [DEBUG REMOVED]       console.log(`   参与人数: ${ranking.total}人`);
    } else {
// [DEBUG REMOVED]       console.log('   暂未进入排行榜');
    }

    // 晋级进度
// [DEBUG REMOVED]     console.log('\n📈 晋级进度');
// [DEBUG REMOVED]     console.log(`   当前等级: ${upgradeProgress.currentLevel} → ${upgradeProgress.targetLevel}`);
// [DEBUG REMOVED]     console.log(`   完成进度: ${upgradeProgress.progressPercentage.toFixed(2)}%`);
    if (upgradeProgress.estimatedTime !== undefined) {
// [DEBUG REMOVED]       console.log(`   预计时间: ${upgradeProgress.estimatedTime}天后`);
    }

    // 佣金预测
// [DEBUG REMOVED]     console.log('\n💰 佣金预测');
// [DEBUG REMOVED]     console.log(`   本期预计: ¥${commissionForecast.currentPeriod.estimatedCommission.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`   下期预测: ¥${commissionForecast.nextPeriod.estimatedCommission.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`   潜力空间: ${(commissionForecast.capacityAnalysis.growthPotential * 100).toFixed(2)}%`);

    // 建议和总结
// [DEBUG REMOVED]     console.log('\n💡 智能建议');
    const suggestions = [];

    if (personalPerf.salesAmount < 30000) {
      suggestions.push('建议提升个人销售业绩');
    }
    if (teamPerf.activeRate < 0.8) {
      suggestions.push('建议加强团队管理和培训');
    }
    if (null.directReferrals < 5) {
      suggestions.push('建议扩大推荐网络');
    }
    if (upgradeProgress.progressPercentage > 80) {
      suggestions.push('🎉 恭喜！即将晋级到下一等级');
    }

    if (suggestions.length === 0) {
      suggestions.push('👍 表现优秀，继续保持！');
    }

    suggestions.forEach((suggestion, index) => {
// [DEBUG REMOVED]       console.log(`   ${index + 1}. ${suggestion}`);
    });

    return {
      personalPerformance: personalPerf,
      teamPerformance: teamPerf,
      null: referralPerf,
      ranking,
      upgradeProgress,
      commissionForecast
    };

  } catch (error) {
    console.error('生成综合业绩报告失败:', error);
    throw error;
  }
}

// ==================== 批量操作示例 ====================

/**
 * 示例13: 团队业绩批量分析
 */
export async function example13_BatchTeamAnalysis() {
  try {
    const teamLeaderId = 'leader123';
    const period = '2025-11';

// [DEBUG REMOVED]     console.log('=== 团队业绩批量分析 ===');

    // 获取团队所有成员
    const teamMembers = await performanceService['getAllTeamMembers'](teamLeaderId);
    const memberIds = teamMembers.map(member => member.userId);

// [DEBUG REMOVED]     console.log(`团队规模: ${memberIds.length}人`);

    // 批量计算业绩（限制并发数量避免数据库压力）
    const batchSize = 10;
    const allResults = [];

    for (let i = 0; i < memberIds.length; i += batchSize) {
      const batch = memberIds.slice(i, i + batchSize);
// [DEBUG REMOVED]       console.log(`处理第${Math.floor(i / batchSize) + 1}批，共${batch.length}人...`);

      const batchResults = await Promise.allSettled(
        batch.map(async memberId => {
          const [personalPerf, teamPerf, ranking] = await Promise.all([
            performanceService.calculatePersonalPerformance(memberId, period),
            performanceService.calculateTeamPerformance(memberId, period),
            performanceService.getLeaderboardRanking(memberId, 'personal', period)
          ]);

          return {
            memberId,
            personalSales: personalPerf.salesAmount,
            teamSales: teamPerf.teamSales,
            ranking: ranking.rank,
            performance: personalPerf.salesAmount + teamPerf.teamSales * 0.1 // 综合评分
          };
        })
      );

      allResults.push(...batchResults);
    }

    // 统计分析
    const successfulResults = allResults
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value);

    const totalPersonalSales = successfulResults.reduce((sum, result) => sum + result.personalSales, 0);
    const totalTeamSales = successfulResults.reduce((sum, result) => sum + result.teamSales, 0);
    const averagePerformance = totalPersonalSales / successfulResults.length;

// [DEBUG REMOVED]     console.log('\n=== 团队统计结果 ===');
// [DEBUG REMOVED]     console.log(`成功分析: ${successfulResults.length}/${memberIds.length}人`);
// [DEBUG REMOVED]     console.log(`总个人销售: ¥${totalPersonalSales.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`总团队销售: ¥${totalTeamSales.toLocaleString()}`);
// [DEBUG REMOVED]     console.log(`平均业绩: ¥${averagePerformance.toLocaleString()}`);

    // 表现最佳成员
    const topPerformers = successfulResults
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 5);

// [DEBUG REMOVED]     console.log('\n=== 表现最佳成员 ===');
    topPerformers.forEach((member, index) => {
      const rankText = member.ranking !== -1 ? `第${member.ranking}名` : '未上榜';
// [DEBUG REMOVED]       console.log(`${index + 1}. ${member.memberId} 综合评分:${member.performance.toFixed(0)} ${rankText}`);
    });

    return {
      teamSize: memberIds.length,
      analyzedCount: successfulResults.length,
      totalPersonalSales,
      totalTeamSales,
      averagePerformance,
      topPerformers
    };

  } catch (error) {
    console.error('团队批量分析失败:', error);
    throw error;
  }
}

// ==================== 导出示例函数 ====================

export const performanceExamples = {
  calculatePersonalPerformance: example1_CalculatePersonalPerformance,
  calculateTeamPerformance: example2_CalculateTeamPerformance,
  calculateReferralPerformance: example3_CalculateReferralPerformance,
  getPersonalLeaderboard: example4_GetPersonalLeaderboard,
  getUserRanking: example5_GetUserRanking,
  analyzeUpgradeProgress: example6_AnalyzeUpgradeProgress,
  batchCheckTeamUpgrades: example7_BatchCheckTeamUpgrades,
  predictCommission: example8_PredictCommission,
  commissionOptimizationAdvice: example9_CommissionOptimizationAdvice,
  dataValidationAndRepair: example10_DataValidationAndRepair,
  cacheManagement: example11_CacheManagement,
  comprehensivePerformanceReport: example12_ComprehensivePerformanceReport,
  batchTeamAnalysis: example13_BatchTeamAnalysis
};

// 使用说明
export const usageInstructions = `
团队业绩实时统计系统使用指南

1. 基础功能
   - calculatePersonalPerformance(): 计算个人业绩
   - calculateTeamPerformance(): 计算团队业绩
   - calculateReferralPerformance(): 计算推荐业绩

2. 排行榜功能
   - getPerformanceLeaderboard(): 获取各类排行榜
   - getLeaderboardRanking(): 查看用户排名

3. 晋级分析
   - getUpgradeProgress(): 分析晋级进度
   - predictPromotionTime(): 预测晋级时间

4. 佣金预测
   - predictCommission(): 预测佣金收入
   - analyzeCommissionCapacity(): 分析佣金潜力

5. 数据管理
   - validatePerformanceData(): 验证数据完整性
   - rebuildPerformanceMetrics(): 重建业绩指标
   - warmupCache(): 预热缓存
   - clearUserCache(): 清除用户缓存

6. 性能优化
   - 系统采用智能缓存策略，减少数据库查询
   - 支持批量操作，提高处理效率
   - 异步计算，确保系统响应速度

调用示例：
   import { performanceExamples } from './performance.examples';
   await performanceExamples.calculatePersonalPerformance();
`;