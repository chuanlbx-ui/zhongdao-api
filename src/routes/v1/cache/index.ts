import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { createSuccessResponse } from '../../../shared/types/response';
import { cacheManager } from '../../../shared/cache/CacheManager';
import { cacheMonitor } from '../../../shared/cache/monitor/CacheMonitor';
import { UserCacheService } from '../../../modules/users/cache';
import { ProductCacheService } from '../../../modules/products/cache';
import { TeamCacheService } from '../../../modules/team/cache';
import { PointsCacheService } from '../../../modules/points/cache';
import { logger } from '../../../shared/utils/logger';

const router = Router();
const userCacheService = new UserCacheService();
const productCacheService = new ProductCacheService();
const teamCacheService = new TeamCacheService();
const pointsCacheService = new PointsCacheService();

// 获取缓存统计概览
router.get('/stats/overview',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const stats = await cacheManager.getStats();
      const config = cacheManager.getConfig();
      const health = await cacheManager.healthCheck();
      const metrics = cacheMonitor.getCurrentMetrics();
      const alerts = cacheMonitor.getActiveAlerts();
      const cacheHealth = await cacheMonitor.getHealth();

      // 获取各模块缓存统计
      const [userStats, productStats, teamStats, pointsStats] = await Promise.all([
        userCacheService.getUserCacheStats('') || Promise.resolve(null),
        productCacheService.getCacheStats(),
        teamCacheService.getCacheStats(),
        pointsCacheService.getCacheStats()
      ]);

      const overview = {
        global: {
          ...stats,
          health,
          config,
          healthScore: cacheHealth.score,
          healthStatus: cacheHealth.status
        },
        metrics,
        alerts: {
          total: alerts.length,
          active: alerts.filter(a => !a.resolved).length,
          critical: alerts.filter(a => a.severity === 'critical' && !a.resolved).length,
          recent: alerts.slice(-10)
        },
        modules: {
          users: userStats,
          products: productStats,
          team: teamStats,
          points: pointsStats
        }
      };

      res.json(createSuccessResponse(overview, '获取缓存统计成功'));
    } catch (error) {
      logger.error('获取缓存统计失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_CACHE_STATS_FAILED',
          message: '获取缓存统计失败'
        }
      });
    }
  })
);

// 获取性能指标
router.get('/metrics',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { duration = 3600000 } = req.query; // 默认1小时
      const report = cacheMonitor.getPerformanceReport(Number(duration));

      res.json(createSuccessResponse(report, '获取性能指标成功'));
    } catch (error) {
      logger.error('获取性能指标失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_METRICS_FAILED',
          message: '获取性能指标失败'
        }
      });
    }
  })
);

// 获取健康状态
router.get('/health',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const health = await cacheMonitor.getHealth();

      res.json(createSuccessResponse(health, '获取健康状态成功'));
    } catch (error) {
      logger.error('获取健康状态失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_HEALTH_FAILED',
          message: '获取健康状态失败'
        }
      });
    }
  })
);

// 获取警报列表
router.get('/alerts',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { active = 'true' } = req.query;
      const alerts = active === 'true'
        ? cacheMonitor.getActiveAlerts()
        : cacheMonitor.getAllAlerts();

      res.json(createSuccessResponse({
        alerts,
        count: alerts.length,
        activeCount: cacheMonitor.getActiveAlerts().length
      }, '获取警报列表成功'));
    } catch (error) {
      logger.error('获取警报列表失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ALERTS_FAILED',
          message: '获取警报列表失败'
        }
      });
    }
  })
);

// 解决警报
router.post('/alerts/:alertId/resolve',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { alertId } = req.params;
      cacheMonitor.resolveAlert(alertId);

      res.json(createSuccessResponse({ alertId }, '警报已解决'));
    } catch (error) {
      logger.error('解决警报失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RESOLVE_ALERT_FAILED',
          message: '解决警报失败'
        }
      });
    }
  })
);

// 获取监控阈值
router.get('/thresholds',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const thresholds = cacheMonitor.getThresholds();

      res.json(createSuccessResponse(thresholds, '获取监控阈值成功'));
    } catch (error) {
      logger.error('获取监控阈值失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_THRESHOLDS_FAILED',
          message: '获取监控阈值失败'
        }
      });
    }
  })
);

// 更新监控阈值
router.put('/thresholds',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const thresholds = req.body;
      cacheMonitor.updateThresholds(thresholds);

      res.json(createSuccessResponse(thresholds, '更新监控阈值成功'));
    } catch (error) {
      logger.error('更新监控阈值失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_THRESHOLDS_FAILED',
          message: '更新监控阈值失败'
        }
      });
    }
  })
);

// 导出指标数据
router.get('/export',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { format = 'json' } = req.query;
      const data = cacheMonitor.exportMetrics(format as 'json' | 'csv');

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="cache-metrics.csv"');
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="cache-metrics.json"');
      }

      res.send(data);
    } catch (error) {
      logger.error('导出指标失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_METRICS_FAILED',
          message: '导出指标失败'
        }
      });
    }
  })
);

// 启动/停止监控
router.post('/monitoring/:action',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { action } = req.params;

      if (action === 'start') {
        await cacheMonitor.startMonitoring();
        res.json(createSuccessResponse(null, '监控已启动'));
      } else if (action === 'stop') {
        cacheMonitor.stopMonitoring();
        res.json(createSuccessResponse(null, '监控已停止'));
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: '无效的操作'
          }
        });
      }
    } catch (error) {
      logger.error('切换监控状态失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TOGGLE_MONITORING_FAILED',
          message: '切换监控状态失败'
        }
      });
    }
  })
);

// 清理缓存
router.post('/cleanup',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { type } = req.query; // expired, all, user, product, team, points

      let cleanedCount = 0;

      switch (type) {
        case 'expired':
          cleanedCount = await cacheManager.delPattern(''); // 需要实现清理过期缓存的方法
          break;
        case 'all':
          await cacheManager.flush();
          cleanedCount = -1; // 表示全部清理
          break;
        case 'user':
          await cacheManager.invalidateTags(['user']);
          break;
        case 'product':
          await cacheManager.invalidateTags(['product']);
          break;
        case 'team':
          await cacheManager.invalidateTags(['team']);
          break;
        case 'points':
          await cacheManager.invalidateTags(['points']);
          break;
        default:
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TYPE',
              message: '无效的清理类型'
            }
          });
          return;
      }

      res.json(createSuccessResponse({
        type,
        cleanedCount
      }, '缓存清理完成'));
    } catch (error) {
      logger.error('清理缓存失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CLEANUP_CACHE_FAILED',
          message: '清理缓存失败'
        }
      });
    }
  })
);

// 预热缓存
router.post('/warmup',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { module, ids } = req.body;

      let warmedCount = 0;

      switch (module) {
        case 'user':
          if (Array.isArray(ids)) {
            await userCacheService.warmupUserCaches(ids);
            warmedCount = ids.length;
          }
          break;
        case 'product':
          if (Array.isArray(ids)) {
            await productCacheService.warmupProductCaches(ids);
            warmedCount = ids.length;
          }
          break;
        case 'team':
          if (Array.isArray(ids)) {
            await teamCacheService.warmupTeamCaches(ids);
            warmedCount = ids.length;
          }
          break;
        case 'points':
          if (Array.isArray(ids)) {
            await pointsCacheService.warmupPointsCaches(ids);
            warmedCount = ids.length;
          }
          break;
        default:
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_MODULE',
              message: '无效的模块'
            }
          });
          return;
      }

      res.json(createSuccessResponse({
        module,
        warmedCount
      }, '缓存预热完成'));
    } catch (error) {
      logger.error('预热缓存失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'WARMUP_CACHE_FAILED',
          message: '预热缓存失败'
        }
      });
    }
  })
);

// 获取缓存详情
router.get('/details',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      const { pattern } = req.query;

      const details = await cacheManager.getInfo();

      res.json(createSuccessResponse({
        details,
        pattern
      }, '获取缓存详情成功'));
    } catch (error) {
      logger.error('获取缓存详情失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_CACHE_DETAILS_FAILED',
          message: '获取缓存详情失败'
        }
      });
    }
  })
);

// 重置监控指标
router.post('/reset',
  authenticate,
  asyncHandler(async (req, res) => {
    try {
      cacheMonitor.reset();

      res.json(createSuccessResponse(null, '监控指标已重置'));
    } catch (error) {
      logger.error('重置监控指标失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RESET_MONITORING_FAILED',
          message: '重置监控指标失败'
        }
      });
    }
  })
);

export default router;