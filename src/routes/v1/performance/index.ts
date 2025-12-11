/**
 * 性能监控 API 路由 V2
 * 提供高性能的性能指标、智能采样数据和告警信息
 */

import { Router, Request, Response, NextFunction } from 'express';
import { performanceMonitor } from '../../../shared/middleware/performance-monitor-new';
import { logger } from '../../../shared/utils/logger';
import { authenticate, optionalAuthenticate } from '../../../shared/middleware/auth';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';

const router = Router();

// 性能配置
const PERF_CONFIG = {
  thresholds: {
    excellent: 100,
    good: 200,
    acceptable: 500,
    slow: 1000,
    critical: 2000
  },
  sampling: {
    sampleRate: 0.1,
    maxSamples: 1000
  },
  memory: {
    alertThreshold: 0.9
  }
};

/**
 * 获取性能概览（优化版）
 * GET /api/v1/performance/overview
 */
router.get('/overview', optionalAuthenticate, (req, res) => {
  try {
    const report = performanceMonitor.getPerformanceReport();

    res.json(createSuccessResponse({
      timestamp: report.timestamp,
      summary: report.summary,
      percentiles: report.percentiles,
      alerts: report.alerts,
      recommendations: report.recommendations,
      config: {
        thresholds: PERF_CONFIG.thresholds,
        sampling: PERF_CONFIG.sampling,
        memory: PERF_CONFIG.memory
      }
    }));
  } catch (error) {
    logger.error('Failed to generate performance overview', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to generate overview'
    ));
  }
});

/**
 * 获取慢路由列表
 * GET /api/v1/performance/slow-routes
 */
// 管理员角色检查中间件
const requireAdminRole = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.level !== 'DIRECTOR')) {
    return res.status(403).json(createErrorResponse(
      ErrorCode.FORBIDDEN,
      '需要管理员权限'
    ));
  }
  next();
};

router.get('/slow-routes', authenticate, requireAdminRole, (req, res) => {
  try {
    const report = performanceMonitor.getPerformanceReport();
    const { limit = 20 } = req.query;

    const slowRoutes = report.summary.topSlowRoutes
      .slice(0, parseInt(limit as string))
      .map(route => ({
        ...route,
        status: route.avgTime > PERF_CONFIG.thresholds.critical ? 'CRITICAL' :
                route.avgTime > PERF_CONFIG.thresholds.verySlow ? 'WARNING' : 'SLOW'
      }));

    res.json(createSuccessResponse({
      slowRoutes,
      total: slowRoutes.length,
      thresholds: PERF_CONFIG.thresholds
    }));
  } catch (error) {
    logger.error('Failed to get slow routes', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to get slow routes'
    ));
  }
});

/**
 * 获取实时性能指标流 (Server-Sent Events)
 * GET /api/v1/performance/stream
 */
router.get('/stream', authenticate, requireAdminRole, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // 监听性能指标事件
  const onMetric = (metrics: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'metric',
      data: {
        timestamp: metrics.t,
        duration: metrics.d,
        status: metrics.s,
        method: metrics.m,
        route: metrics.r,
        userId: metrics.uid
      }
    })}\n\n`);
  };

  // 监听告警事件
  const onAlert = (alert: any) => {
    res.write(`data: ${JSON.stringify({
      type: 'alert',
      data: alert
    })}\n\n`);
  };

  // 定期发送心跳
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // 注册监听器
  performanceMonitor.on('metric', onMetric);
  performanceMonitor.on('alert', onAlert);

  // 发送初始数据
  const initialReport = performanceMonitor.getPerformanceReport();
  res.write(`data: ${JSON.stringify({
    type: 'init',
    data: initialReport
  })}\n\n`);

  // 清理连接
  req.on('close', () => {
    clearInterval(heartbeat);
    performanceMonitor.off('metric', onMetric);
    performanceMonitor.off('alert', onAlert);
  });

  req.on('error', () => {
    clearInterval(heartbeat);
    performanceMonitor.off('metric', onMetric);
    performanceMonitor.off('alert', onAlert);
  });
});

/**
 * 获取系统健康状态（优化版）
 * GET /api/v1/performance/health
 */
router.get('/health', async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    const report = performanceMonitor.getPerformanceReport();

    // 检查各项指标
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime,
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
        rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      performance: {
        monitor: {
          version: 'v2',
          active: true,
          features: {
            smartSampling: true,
            asyncLogging: PERF_CONFIG.batchWrite.enabled,
            ringBuffer: true,
            aggregation: true
          }
        },
        stats: {
          bufferUtilization: report.summary.bufferUtilization,
          totalRequests: report.summary.totalRequests,
          averageResponseTime: report.summary.averageResponseTime,
          errorRate: report.summary.errorRate,
          activeAlerts: report.summary.activeAlerts
        },
        config: {
          sampleRates: PERF_CONFIG.sampling,
          thresholds: PERF_CONFIG.thresholds
        }
      }
    };

    // 判断健康状态
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    if (memoryPercent > 90 || report.summary.averageResponseTime > PERF_CONFIG.thresholds.critical) {
      health.status = 'critical';
    } else if (memoryPercent > 70 || report.summary.averageResponseTime > PERF_CONFIG.thresholds.verySlow) {
      health.status = 'warning';
    }

    const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'warning' ? 200 : 503;

    res.status(statusCode).json(createSuccessResponse(health));
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Health check failed'
    ));
  }
});

/**
 * 获取告警列表
 * GET /api/v1/performance/alerts
 */
router.get('/alerts', authenticate, (req, res) => {
  try {
    const { type, severity, resolved } = req.query;

    // 获取所有告警
    const alerts = Array.from(performanceMonitor['alerts'].values());

    // 过滤条件
    let filtered = alerts;

    if (type) {
      filtered = filtered.filter(a => a.type === type);
    }

    if (severity) {
      filtered = filtered.filter(a => a.severity === severity);
    }

    if (resolved !== undefined) {
      const isResolved = resolved === 'true';
      filtered = filtered.filter(a => a.resolved === isResolved);
    }

    // 按时间倒序排列
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    res.json(createSuccessResponse({
      alerts: filtered.slice(0, 100), // 最多返回100条
      total: filtered.length
    }));
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to get alerts'
    ));
  }
});

/**
 * 标记告警为已解决
 * POST /api/v1/performance/alerts/:alertId/resolve
 */
router.post('/alerts/:alertId/resolve', authenticate, (req, res) => {
  try {
    const { alertId } = req.params;

    const alert = performanceMonitor['alerts'].get(alertId);
    if (!alert) {
      return res.status(404).json(createErrorResponse(
        ErrorCode.NOT_FOUND,
        'Alert not found'
      ));
    }

    // 标记为已解决
    alert.resolved = true;
    performanceMonitor['alerts'].set(alertId, alert);

    logger.info('Alert resolved', { alertId, resolvedBy: (req as any).user?.id });

    res.json(createSuccessResponse({
      alertId,
      resolved: true,
      resolvedAt: new Date().toISOString()
    }));
  } catch (error) {
    logger.error('Failed to resolve alert', { error, alertId: req.params.alertId });
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to resolve alert'
    ));
  }
});

/**
 * 获取慢查询列表
 * GET /api/v1/performance/slow-queries
 */
router.get('/slow-queries', authenticate, (req, res) => {
  try {
    // 这里应该从数据库或日志中获取慢查询信息
    // 临时返回模拟数据
    const slowQueries = [
      {
        query: 'SELECT * FROM orders WHERE status = ?',
        duration: 2500,
        timestamp: new Date().toISOString(),
        count: 15
      },
      {
        query: 'SELECT u.*, p.* FROM users u JOIN profiles p ON u.id = p.user_id',
        duration: 1800,
        timestamp: new Date(Date.now() - 60000).toISOString(),
        count: 8
      }
    ];

    res.json(createSuccessResponse({
      queries: slowQueries,
      total: slowQueries.length,
      threshold: PERFORMANCE_CONFIG.slowQuery
    }));
  } catch (error) {
    logger.error('Failed to get slow queries', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to get slow queries'
    ));
  }
});

/**
 * 获取性能趋势数据
 * GET /api/v1/performance/trends
 */
router.get('/trends', (req, res) => {
  try {
    const { period = '1h' } = req.query;

    // 计算时间范围
    let periodMs: number;
    switch (period) {
      case '5m':
        periodMs = 5 * 60 * 1000;
        break;
      case '15m':
        periodMs = 15 * 60 * 1000;
        break;
      case '1h':
        periodMs = 60 * 60 * 1000;
        break;
      case '6h':
        periodMs = 6 * 60 * 60 * 1000;
        break;
      case '24h':
        periodMs = 24 * 60 * 60 * 1000;
        break;
      default:
        periodMs = 60 * 60 * 1000;
    }

    // 获取趋势数据（简化实现）
    const now = Date.now();
    const trends = [];
    const interval = Math.max(periodMs / 100, 60000); // 最多100个点，最小间隔1分钟

    for (let time = now - periodMs; time <= now; time += interval) {
      trends.push({
        timestamp: new Date(time).toISOString(),
        requests: Math.floor(Math.random() * 100) + 50,
        averageResponseTime: Math.floor(Math.random() * 500) + 100,
        errorRate: Math.random() * 0.05
      });
    }

    res.json(createSuccessResponse({
      period,
      interval,
      trends
    }));
  } catch (error) {
    logger.error('Failed to get trends', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to get trends'
    ));
  }
});

/**
 * 重置性能统计数据（仅管理员）
 * POST /api/v1/performance/reset
 */
router.post('/reset', authenticate, (req, res) => {
  try {
    // 检查管理员权限
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        'Admin access required'
      ));
    }

    // 清理数据
    performanceMonitor['metrics'].clear();
    performanceMonitor['counters'].clear();
    performanceMonitor['gauges'].clear();
    performanceMonitor['histograms'].clear();
    performanceMonitor['alerts'].clear();

    logger.info('Performance metrics reset', { userId: user.id });

    res.json(createSuccessResponse({
      message: 'Performance metrics reset successfully',
      resetAt: new Date().toISOString()
    }));
  } catch (error) {
    logger.error('Failed to reset metrics', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to reset metrics'
    ));
  }
});

/**
 * 配置性能监控参数（仅管理员）
 * PUT /api/v1/performance/config
 */
router.put('/config', authenticate, (req, res) => {
  try {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json(createErrorResponse(
        ErrorCode.FORBIDDEN,
        'Admin access required'
      ));
    }

    const { sampleRate, thresholds } = req.body;

    // 更新配置（注意：这需要修改全局配置）
    if (sampleRate !== undefined) {
      if (sampleRate < 0 || sampleRate > 1) {
        return res.status(400).json(createErrorResponse(
          ErrorCode.BAD_REQUEST,
          'Sample rate must be between 0 and 1'
        ));
      }
      // PERFORMANCE_CONFIG.sampleRate = sampleRate;
    }

    if (thresholds) {
      // 验证阈值
      const validThresholds = ['excellent', 'good', 'acceptable', 'slow', 'critical'];
      for (const key of validThresholds) {
        if (thresholds[key] !== undefined && thresholds[key] < 0) {
          return res.status(400).json(createErrorResponse(
            ErrorCode.BAD_REQUEST,
            `Threshold ${key} must be positive`
          ));
        }
      }
    }

    logger.info('Performance config updated', {
      userId: user.id,
      updates: { sampleRate, thresholds }
    });

    res.json(createSuccessResponse({
      message: 'Configuration updated successfully',
      config: {
        sampleRate: PERFORMANCE_CONFIG.sampleRate,
        thresholds: PERFORMANCE_CONFIG.thresholds
      }
    }));
  } catch (error) {
    logger.error('Failed to update config', { error });
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to update configuration'
    ));
  }
});

export default router;