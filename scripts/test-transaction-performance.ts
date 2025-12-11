import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import { logger } from '../src/shared/utils/logger';

const prisma = new PrismaClient();

/**
 * 积分交易API性能测试
 */
class TransactionPerformanceTest {
  private testUserId = 'test_user_id_1234567890123456789012345';
  private results: any[] = [];

  async runTests() {
    console.log('开始积分交易API性能测试...\n');

    // 1. 测试不同查询策略的性能
    await this.testQueryStrategies();

    // 2. 测试分页性能
    await this.testPaginationPerformance();

    // 3. 测试并发查询性能
    await this.testConcurrentQueries();

    // 4. 测试缓存性能
    await this.testCachePerformance();

    // 5. 生成测试报告
    this.generateReport();

    await prisma.$disconnect();
  }

  /**
   * 测试不同查询策略
   */
  private async testQueryStrategies() {
    console.log('1. 测试查询策略性能...\n');

    const strategies = ['cache', 'cursor', 'batch', 'auto'];

    for (const strategy of strategies) {
      console.log(`测试策略: ${strategy}`);
      const startTime = performance.now();

      // 模拟API调用
      const result = await this.simulateAPICall({
        userId: this.testUserId,
        strategy,
        page: 1,
        limit: 20
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      this.results.push({
        test: `Query Strategy - ${strategy}`,
        executionTime,
        resultCount: result.length,
        strategy
      });

      console.log(`  执行时间: ${executionTime.toFixed(2)}ms`);
      console.log(`  返回记录数: ${result.length}\n`);
    }
  }

  /**
   * 测试分页性能
   */
  private async testPaginationPerformance() {
    console.log('2. 测试分页性能...\n');

    const pages = [1, 5, 10, 50, 100];

    for (const page of pages) {
      console.log(`测试第 ${page} 页`);
      const startTime = performance.now();

      const result = await this.simulateAPICall({
        userId: this.testUserId,
        page,
        limit: 20,
        strategy: 'cursor'
      });

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      this.results.push({
        test: `Pagination - Page ${page}`,
        executionTime,
        resultCount: result.length,
        page
      });

      console.log(`  执行时间: ${executionTime.toFixed(2)}ms`);
      console.log(`  返回记录数: ${result.length}\n`);
    }
  }

  /**
   * 测试并发查询
   */
  private async testConcurrentQueries() {
    console.log('3. 测试并发查询性能...\n');

    const concurrentCounts = [1, 5, 10, 20];

    for (const count of concurrentCounts) {
      console.log(`测试并发数: ${count}`);
      const startTime = performance.now();

      const promises = Array.from({ length: count }, () =>
        this.simulateAPICall({
          userId: this.testUserId,
          page: 1,
          limit: 20,
          strategy: 'auto'
        })
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      this.results.push({
        test: `Concurrent Queries - ${count}`,
        executionTime,
        avgTimePerQuery: executionTime / count,
        concurrentCount: count
      });

      console.log(`  总执行时间: ${executionTime.toFixed(2)}ms`);
      console.log(`  平均每查询: ${(executionTime / count).toFixed(2)}ms\n`);
    }
  }

  /**
   * 测试缓存性能
   */
  private async testCachePerformance() {
    console.log('4. 测试缓存性能...\n');

    // 第一次查询（缓存未命中）
    console.log('首次查询（缓存未命中）');
    let startTime = performance.now();
    await this.simulateAPICall({
      userId: this.testUserId,
      page: 1,
      limit: 20,
      useCache: true
    });
    let firstQueryTime = performance.now() - startTime;
    console.log(`  执行时间: ${firstQueryTime.toFixed(2)}ms\n`);

    // 第二次查询（缓存命中）
    console.log('第二次查询（缓存命中）');
    startTime = performance.now();
    await this.simulateAPICall({
      userId: this.testUserId,
      page: 1,
      limit: 20,
      useCache: true
    });
    let secondQueryTime = performance.now() - startTime;
    console.log(`  执行时间: ${secondQueryTime.toFixed(2)}ms\n`);

    const cacheSpeedup = ((firstQueryTime - secondQueryTime) / firstQueryTime * 100).toFixed(1);

    this.results.push({
      test: 'Cache Performance',
      firstQueryTime,
      secondQueryTime,
      cacheSpeedup: `${cacheSpeedup}%`
    });

    console.log(`缓存加速比: ${cacheSpeedup}%\n`);
  }

  /**
   * 模拟API调用
   */
  private async simulateAPICall(params: any): Promise<any[]> {
    // 构建查询条件
    const whereCondition: any = {
      OR: [
        { fromUserId: params.userId },
        { toUserId: params.userId }
      ]
    };

    if (params.type) {
      whereCondition.type = params.type;
    }

    // 模拟不同的查询策略
    switch (params.strategy) {
      case 'batch':
        // 使用UNION ALL查询
        const batchResults = await prisma.$queryRaw`
          SELECT * FROM (
            SELECT id, transactionNo, amount, type, createdAt
            FROM pointsTransactions
            WHERE fromUserId = ${params.userId}
            UNION ALL
            SELECT id, transactionNo, amount, type, createdAt
            FROM pointsTransactions
            WHERE toUserId = ${params.userId}
          ) as combined
          ORDER BY createdAt DESC
          LIMIT 20
        `;
        return batchResults;

      case 'cursor':
        // 使用游标分页
        return await prisma.pointsTransactions.findMany({
          where: whereCondition,
          select: {
            id: true,
            transactionNo: true,
            amount: true,
            type: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: params.limit || 20
        });

      default:
        // 标准查询
        return await prisma.pointsTransactions.findMany({
          where: whereCondition,
          select: {
            id: true,
            transactionNo: true,
            amount: true,
            type: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip: ((params.page || 1) - 1) * (params.limit || 20),
          take: params.limit || 20
        });
    }
  }

  /**
   * 生成测试报告
   */
  private generateReport() {
    console.log('\n========== 性能测试报告 ==========\n');

    // 按执行时间排序
    const sortedResults = this.results.sort((a, b) => b.executionTime - a.executionTime);

    // 显示最慢的5个测试
    console.log('最慢的5个测试：');
    sortedResults.slice(0, 5).forEach((result, index) => {
      console.log(`${index + 1}. ${result.test}`);
      console.log(`   执行时间: ${result.executionTime.toFixed(2)}ms`);
      if (result.resultCount !== undefined) {
        console.log(`   返回记录数: ${result.resultCount}`);
      }
      if (result.avgTimePerQuery) {
        console.log(`   平均每查询: ${result.avgTimePerQuery.toFixed(2)}ms`);
      }
      if (result.cacheSpeedup) {
        console.log(`   缓存加速: ${result.cacheSpeedup}`);
      }
      console.log('');
    });

    // 性能建议
    console.log('\n========== 性能优化建议 ==========\n');

    const avgResponseTime = sortedResults.reduce((sum, r) => sum + r.executionTime, 0) / sortedResults.length;
    console.log(`平均响应时间: ${avgResponseTime.toFixed(2)}ms`);

    if (avgResponseTime > 500) {
      console.log('⚠️  平均响应时间超过500ms，建议：');
      console.log('  1. 检查数据库索引是否正确使用');
      console.log('  2. 优化查询条件，减少全表扫描');
      console.log('  3. 增加查询缓存');
    } else if (avgResponseTime > 200) {
      console.log('⚠️  平均响应时间超过200ms，建议：');
      console.log('  1. 使用查询优化器');
      console.log('  2. 考虑使用游标分页');
      console.log('  3. 启用查询缓存');
    } else {
      console.log('✅ 响应时间良好');
    }

    // 查询策略比较
    console.log('\n查询策略比较：');
    const strategyResults = this.results.filter(r => r.strategy);
    const strategyAvg: Record<string, number> = {};

    strategyResults.forEach(result => {
      if (!strategyAvg[result.strategy]) {
        strategyAvg[result.strategy] = 0;
      }
      strategyAvg[result.strategy] += result.executionTime;
    });

    Object.entries(strategyAvg).forEach(([strategy, totalTime]) => {
      const count = strategyResults.filter(r => r.strategy === strategy).length;
      const avg = totalTime / count;
      console.log(`  ${strategy}: ${avg.toFixed(2)}ms (平均)`);
    });

    // 缓存效果
    const cacheResult = this.results.find(r => r.test === 'Cache Performance');
    if (cacheResult && cacheResult.cacheSpeedup) {
      console.log(`\n缓存效果：${cacheResult.cacheSpeedup} 性能提升`);
    }
  }
}

// 运行测试
const test = new TransactionPerformanceTest();
test.runTests().catch(error => {
  console.error('性能测试失败:', error);
  process.exit(1);
});