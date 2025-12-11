/**
 * 监控面板API路由
 * 提供监控数据的JSON API，供前端使用
 */

import { Router, Request, Response } from 'express';
import { monitoringCenter } from '../../../monitoring/core/monitoring-center';
import { MonitoringPanel } from '../../../monitoring/panel/monitoring-panel';
import { monitoringConfig } from '../../../monitoring/config/monitoring-config';
import { logger } from '../../../shared/utils/logger';

const router = Router();
const monitoringPanel = new MonitoringPanel(monitoringConfig);

// 访问控制中间件
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (monitoringConfig.panel.access.authRequired) {
    // 这里应该验证用户权限
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: '需要管理员权限'
        }
      });
    }
  }
  next();
};

// IP访问控制
const checkIPAccess = (req: Request, res: Response, next: Function) => {
  if (monitoringConfig.panel.access.enabled && monitoringConfig.panel.access.allowedIPs.length > 0) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const allowed = monitoringConfig.panel.access.allowedIPs.some(range => {
      // 简单的IP范围检查
      if (range.includes('/')) {
        const [network, mask] = range.split('/');
        // 这里应该实现proper CIDR检查
        return clientIP?.startsWith(network.split('.').slice(0, 2).join('.'));
      }
      return clientIP === range;
    });

    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: '访问被拒绝'
        }
      });
    }
  }
  next();
};

// 应用中间件
router.use(checkIPAccess);
router.use(requireAuth);

/**
 * GET /monitoring/dashboard
 * 获取仪表板数据
 */
router.get('/dashboard', async (req, res) => {
  try {
    const data = await monitoringPanel.getDashboardData();

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取仪表板数据失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_FETCH_FAILED',
        message: '获取仪表板数据失败'
      }
    });
  }
});

/**
 * GET /monitoring/overview
 * 获取系统概览
 */
router.get('/overview', async (req, res) => {
  try {
    const data = await monitoringPanel.getSystemOverview();

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取系统概览失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'OVERVIEW_FETCH_FAILED',
        message: '获取系统概览失败'
      }
    });
  }
});

/**
 * GET /monitoring/realtime
 * 获取实时数据
 */
router.get('/realtime', async (req, res) => {
  try {
    const data = await monitoringPanel.getRealtimeData();

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取实时数据失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REALTIME_FETCH_FAILED',
        message: '获取实时数据失败'
      }
    });
  }
});

/**
 * GET /monitoring/history/:metric
 * 获取历史数据
 */
router.get('/history/:metric', async (req, res) => {
  try {
    const { metric } = req.params;
    const { timeRange = '1h' } = req.query;

    const data = await monitoringPanel.getHistoryData(metric, timeRange as string);

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取历史数据失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'HISTORY_FETCH_FAILED',
        message: '获取历史数据失败'
      }
    });
  }
});

/**
 * GET /monitoring/alerts
 * 获取告警列表
 */
router.get('/alerts', async (req, res) => {
  try {
    const { severity, limit = '50' } = req.query;
    const alerts = await monitoringPanel.getAlerts(
      severity as string,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取告警列表失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_FETCH_FAILED',
        message: '获取告警列表失败'
      }
    });
  }
});

/**
 * GET /monitoring/business
 * 获取业务指标
 */
router.get('/business', async (req, res) => {
  try {
    const data = await monitoringPanel.getBusinessMetrics();

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取业务指标失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'BUSINESS_METRICS_FETCH_FAILED',
        message: '获取业务指标失败'
      }
    });
  }
});

/**
 * GET /monitoring/metrics
 * 获取完整的监控报告
 */
router.get('/metrics', async (req, res) => {
  try {
    const report = await monitoringCenter.getMonitoringReport();

    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取监控报告失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_FETCH_FAILED',
        message: '获取监控报告失败'
      }
    });
  }
});

/**
 * GET /monitoring/export
 * 导出监控数据
 */
router.get('/export', async (req, res) => {
  try {
    const { type = 'json', metrics = 'system.cpu,system.memory', timeRange = '1h' } = req.query;

    if (!['csv', 'json', 'excel'].includes(type as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EXPORT_TYPE',
          message: '不支持的导出类型'
        }
      });
    }

    const buffer = await monitoringPanel.exportData(
      type as 'csv' | 'json' | 'excel',
      (metrics as string).split(','),
      timeRange as string
    );

    const filename = `monitoring_export_${Date.now()}.${type}`;
    const contentType = type === 'json' ? 'application/json' : 'text/csv';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`
    });

    res.send(buffer);
  } catch (error) {
    logger.error('导出数据失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_FAILED',
        message: '导出数据失败'
      }
    });
  }
});

/**
 * GET /monitoring/status
 * 获取监控中心状态
 */
router.get('/status', async (req, res) => {
  try {
    const status = monitoringCenter.getStatus();

    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取监控状态失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_FETCH_FAILED',
        message: '获取监控状态失败'
      }
    });
  }
});

/**
 * GET /monitoring/config
 * 获取监控配置（敏感信息已过滤）
 */
router.get('/config', async (req, res) => {
  try {
    // 过滤敏感配置
    const safeConfig = {
      environment: monitoringConfig.environment,
      performance: {
        thresholds: monitoringConfig.performance.thresholds
      },
      system: {
        cpu: monitoringConfig.system.cpu,
        memory: monitoringConfig.system.memory,
        disk: monitoringConfig.system.disk
      },
      health: {
        checks: monitoringConfig.health.checks
      },
      alerts: {
        channels: {
          email: {
            enabled: monitoringConfig.alerts.channels.email.enabled
          },
          sms: {
            enabled: monitoringConfig.alerts.channels.sms.enabled
          },
          webhook: {
            enabled: monitoringConfig.alerts.channels.webhook.enabled
          }
        }
      },
      panel: {
        refreshInterval: monitoringConfig.panel.refreshInterval
      }
    };

    res.json({
      success: true,
      data: safeConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取监控配置失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_FETCH_FAILED',
        message: '获取监控配置失败'
      }
    });
  }
});

/**
 * POST /monitoring/acknowledge/:alertId
 * 确认告警
 */
router.post('/acknowledge/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = (req as any).user;

    const alertManager = monitoringCenter.getAlertManager();
    const success = await alertManager.acknowledge(alertId, userId);

    if (success) {
      res.json({
        success: true,
        message: '告警已确认'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: '未找到告警或告警已被确认'
        }
      });
    }
  } catch (error) {
    logger.error('确认告警失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ACKNOWLEDGE_FAILED',
        message: '确认告警失败'
      }
    });
  }
});

/**
 * POST /monitoring/resolve/:alertId
 * 解决告警
 */
router.post('/resolve/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { userId } = (req as any).user;

    const alertManager = monitoringCenter.getAlertManager();
    const success = await alertManager.resolve(alertId, userId);

    if (success) {
      res.json({
        success: true,
        message: '告警已解决'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: '未找到告警或告警已解决'
        }
      });
    }
  } catch (error) {
    logger.error('解决告警失败', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RESOLVE_FAILED',
        message: '解决告警失败'
      }
    });
  }
});

export default router;