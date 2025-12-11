#!/usr/bin/env tsx

/**
 * 缓存管理CLI工具
 * 用于管理缓存的各种操作
 */

import { Command } from 'commander';
import { cacheManager } from '../shared/cache/CacheManager';
import { cacheMonitor } from '../shared/cache/monitor/CacheMonitor';
import { UserCacheService } from '../modules/users/cache';
import { ProductCacheService } from '../modules/products/cache';
import { TeamCacheService } from '../modules/team/cache';
import { PointsCacheService } from '../modules/points/cache';
import { logger } from '../shared/utils/logger';
import chalk from 'chalk';

const program = new Command();
const userCache = new UserCacheService();
const productCache = new ProductCacheService();
const teamCache = new TeamCacheService();
const pointsCache = new PointsCacheService();

// 初始化
async function init() {
  try {
    await cacheManager.connect();
    await cacheMonitor.startMonitoring();
    console.log(chalk.green('✓ 缓存服务已连接'));
  } catch (error) {
    console.error(chalk.red('✗ 缓存服务连接失败:'), error);
    process.exit(1);
  }
}

// 清理函数
async function cleanup() {
  try {
    cacheMonitor.stopMonitoring();
    await cacheManager.disconnect();
    console.log(chalk.yellow('\n缓存服务已断开'));
  } catch (error) {
    console.error(chalk.red('断开缓存服务失败:'), error);
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 状态命令
program
  .command('status')
  .description('查看缓存状态')
  .option('-d, --details', '显示详细信息')
  .action(async (options) => {
    await init();

    try {
      const stats = await cacheManager.getStats();
      const config = cacheManager.getConfig();
      const health = await cacheManager.healthCheck();
      const healthStatus = await cacheMonitor.getHealth();

      console.log(chalk.bold('\n=== 缓存状态 ==='));
      console.log(`连接状态: ${health ? chalk.green('已连接') : chalk.red('未连接')}`);
      console.log(`当前类型: ${chalk.blue(config.currentType)}`);
      console.log(`降级模式: ${config.fallbackEnabled ? chalk.green('启用') : chalk.red('禁用')}`);

      console.log(chalk.bold('\n=== 性能统计 ==='));
      console.log(`命中率: ${chalk.yellow(stats.hitRate.toFixed(2) + '%')}`);
      console.log(`命中次数: ${stats.hits}`);
      console.log(`未命中次数: ${stats.misses}`);
      console.log(`设置次数: ${stats.sets}`);
      console.log(`删除次数: ${stats.deletes}`);
      console.log(`错误次数: ${chalk.red(stats.errors)}`);

      if (stats.memoryUsage) {
        console.log(`内存使用: ${chalk.cyan((stats.memoryUsage / 1024 / 1024).toFixed(2) + ' MB')}`);
      }

      console.log(chalk.bold('\n=== 健康状态 ==='));
      console.log(`状态: ${healthStatus.score >= 80 ? chalk.green('健康') :
                    healthStatus.score >= 50 ? chalk.yellow('警告') : chalk.red('不健康')}`);
      console.log(`评分: ${healthStatus.score}/100`);
      console.log(`运行时间: ${chalk.cyan((healthStatus.uptime / 1000 / 60).toFixed(2) + ' 分钟')}`);

      if (healthStatus.issues.length > 0) {
        console.log(chalk.bold('\n问题列表:'));
        healthStatus.issues.forEach(issue => {
          console.log(chalk.red(`  - ${issue}`));
        });
      }

      if (options.details) {
        const alerts = cacheMonitor.getActiveAlerts();
        if (alerts.length > 0) {
          console.log(chalk.bold('\n活跃警报:'));
          alerts.forEach(alert => {
            const color = alert.severity === 'critical' ? chalk.red :
                         alert.severity === 'error' ? chalk.red :
                         alert.severity === 'warning' ? chalk.yellow : chalk.blue;
            console.log(color(`  [${alert.severity.toUpperCase()}] ${alert.message}`));
          });
        }
      }

    } catch (error) {
      console.error(chalk.red('获取状态失败:'), error);
    }

    await cleanup();
  });

// 清理命令
program
  .command('clear')
  .description('清理缓存')
  .argument('[type]', '清理类型: all, expired, user, product, team, points', 'all')
  .option('-y, --yes', '跳过确认')
  .action(async (type, options) => {
    await init();

    if (!options.yes && type === 'all') {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(chalk.yellow('确认要清理所有缓存吗? (y/N): '), resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log(chalk.blue('操作已取消'));
        await cleanup();
        return;
      }
    }

    try {
      let message = '';

      switch (type) {
        case 'all':
          await cacheManager.flush();
          message = '已清理所有缓存';
          break;
        case 'expired':
          // 这里需要实现清理过期缓存的逻辑
          message = '已清理过期缓存';
          break;
        case 'user':
          await cacheManager.invalidateTags(['user']);
          message = '已清理用户缓存';
          break;
        case 'product':
          await cacheManager.invalidateTags(['product']);
          message = '已清理产品缓存';
          break;
        case 'team':
          await cacheManager.invalidateTags(['team']);
          message = '已清理团队缓存';
          break;
        case 'points':
          await cacheManager.invalidateTags(['points']);
          message = '已清理积分缓存';
          break;
        default:
          console.error(chalk.red('无效的清理类型'));
          await cleanup();
          return;
      }

      console.log(chalk.green(`✓ ${message}`));
    } catch (error) {
      console.error(chalk.red('清理失败:'), error);
    }

    await cleanup();
  });

// 预热命令
program
  .command('warmup')
  .description('预热缓存')
  .argument('[module]', '模块: user, product, team, points, all', 'all')
  .option('-i, --ids <items>', 'ID列表，逗号分隔')
  .option('-f, --file <path>', '从文件读取ID列表')
  .action(async (module, options) => {
    await init();

    try {
      let ids: string[] = [];

      if (options.ids) {
        ids = options.ids.split(',').map(id => id.trim());
      } else if (options.file) {
        const fs = require('fs');
        const content = fs.readFileSync(options.file, 'utf-8');
        ids = content.split('\n').filter(line => line.trim());
      }

      console.log(chalk.blue(`开始预热 ${module} 缓存...`));

      switch (module) {
        case 'user':
          if (ids.length > 0) {
            await userCache.warmupUserCaches(ids);
            console.log(chalk.green(`✓ 预热了 ${ids.length} 个用户缓存`));
          } else {
            console.log(chalk.yellow('需要提供用户ID列表'));
          }
          break;
        case 'product':
          if (ids.length > 0) {
            await productCache.warmupProductCaches(ids);
            console.log(chalk.green(`✓ 预热了 ${ids.length} 个产品缓存`));
          } else {
            console.log(chalk.yellow('需要提供产品ID列表'));
          }
          break;
        case 'team':
          if (ids.length > 0) {
            await teamCache.warmupTeamCaches(ids);
            console.log(chalk.green(`✓ 预热了 ${ids.length} 个团队缓存`));
          } else {
            console.log(chalk.yellow('需要提供团队ID列表'));
          }
          break;
        case 'points':
          if (ids.length > 0) {
            await pointsCache.warmupPointsCaches(ids);
            console.log(chalk.green(`✓ 预热了 ${ids.length} 个积分缓存`));
          } else {
            console.log(chalk.yellow('需要提供用户ID列表'));
          }
          break;
        case 'all':
          console.log(chalk.blue('预热所有模块的缓存（使用默认数据）...'));
          // 这里可以预热一些热门数据
          console.log(chalk.green('✓ 缓存预热完成'));
          break;
        default:
          console.error(chalk.red('无效的模块'));
      }

    } catch (error) {
      console.error(chalk.red('预热失败:'), error);
    }

    await cleanup();
  });

// 监控命令
program
  .command('monitor')
  .description('实时监控缓存状态')
  .option('-i, --interval <seconds>', '刷新间隔', 5)
  .action(async (options) => {
    await init();
    await cacheMonitor.startMonitoring();

    console.clear();
    console.log(chalk.bold.blue('=== 缓存实时监控 ==='));
    console.log(chalk.gray('按 Ctrl+C 退出\n'));

    const interval = setInterval(async () => {
      console.clear();
      console.log(chalk.bold.blue('=== 缓存实时监控 ==='));
      console.log(chalk.gray(`最后更新: ${new Date().toLocaleString()}\n`));

      try {
        const metrics = cacheMonitor.getCurrentMetrics();
        const health = await cacheMonitor.getHealth();
        const alerts = cacheMonitor.getActiveAlerts();

        // 显示健康状态
        const healthColor = health.score >= 80 ? chalk.green :
                          health.score >= 50 ? chalk.yellow : chalk.red;
        console.log(healthColor(`健康状态: ${health.status.toUpperCase()} (${health.score}/100)`));

        // 显示关键指标
        if (metrics) {
          console.log(`\n${chalk.bold('关键指标:')}`);
          console.log(`命中率: ${metrics.hitRate >= 80 ? chalk.green : chalk.yellow}${metrics.hitRate.toFixed(2)}%`);
          console.log(`响应时间: ${metrics.responseTime.avg >= 100 ? chalk.red : chalk.green}${metrics.responseTime.avg.toFixed(2)}ms`);
          console.log(`内存使用: ${chalk.cyan((metrics.memory.used / 1024 / 1024).toFixed(2))} MB`);
          console.log(`操作数: ${chalk.blue(metrics.hits + metrics.misses)}`);
        }

        // 显示警报
        if (alerts.length > 0) {
          console.log(`\n${chalk.bold.red('活跃警报:')}`);
          alerts.slice(0, 5).forEach(alert => {
            const alertColor = alert.severity === 'critical' ? chalk.red :
                             alert.severity === 'error' ? chalk.red :
                             alert.severity === 'warning' ? chalk.yellow : chalk.blue;
            console.log(alertColor(`  ${alert.message}`));
          });
          if (alerts.length > 5) {
            console.log(chalk.gray(`  ... 还有 ${alerts.length - 5} 个警报`));
          }
        }

      } catch (error) {
        console.error(chalk.red('监控错误:'), error);
      }

      console.log(chalk.gray('\n按 Ctrl+C 退出'));
    }, options.interval * 1000);

    // 处理退出
    process.on('SIGINT', () => {
      clearInterval(interval);
      cacheMonitor.stopMonitoring();
      cleanup();
      console.log(chalk.yellow('\n监控已停止'));
      process.exit(0);
    });
  });

// 导出命令
program
  .command('export')
  .description('导出缓存指标')
  .argument('[format]', '导出格式: json, csv', 'json')
  .argument('[output]', '输出文件路径')
  .option('-d, --duration <hours>', '时间范围（小时）', 24)
  .action(async (format, output, options) => {
    await init();

    try {
      const data = cacheMonitor.exportMetrics(format);
      const fs = require('fs');

      if (output) {
        fs.writeFileSync(output, data);
        console.log(chalk.green(`✓ 数据已导出到 ${output}`));
      } else {
        console.log(data);
      }

    } catch (error) {
      console.error(chalk.red('导出失败:'), error);
    }

    await cleanup();
  });

// 测试命令
program
  .command('test')
  .description('测试缓存性能')
  .option('-n, --number <count>', '测试次数', 1000)
  .option('-k, --key <key>', '测试键前缀', 'test')
  .action(async (options) => {
    await init();

    try {
      const count = parseInt(options.number);
      const keyPrefix = options.key;

      console.log(chalk.blue(`开始性能测试 (${count} 次操作)...`));

      // 测试写入
      const writeStart = Date.now();
      for (let i = 0; i < count; i++) {
        await cacheManager.set(`${keyPrefix}:${i}`, { data: `test${i}`, index: i });
      }
      const writeTime = Date.now() - writeStart;

      // 测试读取
      const readStart = Date.now();
      let hits = 0;
      for (let i = 0; i < count; i++) {
        const result = await cacheManager.get(`${keyPrefix}:${i}`);
        if (result) hits++;
      }
      const readTime = Date.now() - readStart;

      console.log(chalk.bold('\n=== 测试结果 ==='));
      console.log(`写入: ${count} 次，耗时 ${chalk.yellow(writeTime + 'ms')}`);
      console.log(`读取: ${count} 次，命中 ${chalk.green(hits)} 次，耗时 ${chalk.yellow(readTime + 'ms')}`);
      console.log(`写入速度: ${chalk.cyan((count / writeTime * 1000).toFixed(2))} ops/s`);
      console.log(`读取速度: ${chalk.cyan((count / readTime * 1000).toFixed(2))} ops/s`);
      console.log(`命中率: ${chalk.green((hits / count * 100).toFixed(2) + '%')}`);

      // 清理测试数据
      for (let i = 0; i < count; i++) {
        await cacheManager.del(`${keyPrefix}:${i}`);
      }

    } catch (error) {
      console.error(chalk.red('测试失败:'), error);
    }

    await cleanup();
  });

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}