/**
 * 健康检查路由
 * 提供全面的系统健康状态检查端点
 */

import { Router } from 'express';
import { monitoringCenter } from '../../../monitoring/core/monitoring-center';
import { HealthChecker } from '../../../monitoring/core/health-checker';
import { logger } from '../../../shared/utils/logger';

const router = Router();

/**
 * GET /health
 * 基础健康检查 - 用于负载均衡器
 */
router.get('/', async (req, res) => {
  try {
    const healthChecker = monitoringCenter.getHealthChecker();
    const status = healthChecker.getLivenessStatus();

    res.status(200).json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('健康检查失败', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: '健康检查失败'
      }
    });
  }
});

/**
 * GET /health/detailed
 * 详细健康检查 - 包含所有组件状态
 */
router.get('/detailed', async (req, res) => {
  try {
    const healthChecker = monitoringCenter.getHealthChecker();
    const report = await healthChecker.getReport();

    res.status(200).json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('详细健康检查失败', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'DETAILED_HEALTH_CHECK_FAILED',
        message: '详细健康检查失败'
      }
    });
  }
});

/**
 * GET /health/database
 * 数据库健康检查
 */
router.get('/database', async (req, res) => {
  try {
    const healthChecker = monitoringCenter.getHealthChecker();
    await healthChecker.checkNow('database');
    const report = await healthChecker.getReport();
    const dbCheck = report.checks.find(c => c.name === 'database');

    if (!dbCheck) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_CHECK_NOT_FOUND',
          message: '未找到数据库健康检查'
        }
      });
    }

    const statusCode = dbCheck.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: dbCheck.status === 'healthy',
      data: dbCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('数据库健康检查失败', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_HEALTH_CHECK_FAILED',
        message: '数据库健康检查失败'
      }
    });
  }
});

/**
 * GET /health/cache
 * 缓存健康检查
 */
router.get('/cache', async (req, res) => {
  try {
    const healthChecker = monitoringCenter.getHealthChecker();
    await healthChecker.checkNow('cache');
    const report = await healthChecker.getReport();
    const cacheCheck = report.checks.find(c => c.name === 'cache');

    if (!cacheCheck) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'CACHE_CHECK_NOT_FOUND',
          message: '未找到缓存健康检查'
        }
      });
    }

    const statusCode = cacheCheck.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: cacheCheck.status === 'healthy',
      data: cacheCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('缓存健康检查失败', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'CACHE_HEALTH_CHECK_FAILED',
        message: '缓存健康检查失败'
      }
    });
  }
});

/**
 * GET /health/payment
 * 支付系统健康检查
 */
router.get('/payment', async (req, res) => {
  try {
    const healthChecker = monitoringCenter.getHealthChecker();
    await healthChecker.checkNow('payments');
    const report = await healthChecker.getReport();
    const paymentCheck = report.checks.find(c => c.name === 'payments');

    if (!paymentCheck) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'PAYMENT_CHECK_NOT_FOUND',
          message: '未找到支付系统健康检查'
        }
      });
    }

    const statusCode = paymentCheck.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      success: paymentCheck.status === 'healthy',
      data: paymentCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('支付系统健康检查失败', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'PAYMENT_HEALTH_CHECK_FAILED',
        message: '支付系统健康检查失败'
      }
    });
  }
});

/**
 * GET /health/ready
 * 就绪状态检查 - 用于Kubernetes
 */
router.get('/ready', async (req, res) => {
  try {
    const healthChecker = monitoringCenter.getHealthChecker();
    const readiness = await healthChecker.getReadinessStatus();

    const statusCode = readiness.status === 'ready' ? 200 : 503;

    res.status(statusCode).json({
      success: readiness.status === 'ready',
      data: readiness,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('就绪状态检查失败', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'READINESS_CHECK_FAILED',
        message: '就绪状态检查失败'
      }
    });
  }
});

/**
 * GET /health/live
 * 存活状态检查 - 用于Kubernetes
 */
router.get('/live', async (req, res) => {
  try {
    const healthChecker = monitoringCenter.getHealthChecker();
    const liveness = healthChecker.getLivenessStatus();

    res.status(200).json({
      success: true,
      data: liveness,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('存活状态检查失败', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'LIVENESS_CHECK_FAILED',
        message: '存活状态检查失败'
      }
    });
  }
});

/**
 * GET /health/metrics
 * 健康检查指标
 */
router.get('/metrics', async (req, res) => {
  try {
    const healthChecker = monitoringCenter.getHealthChecker();
    const report = await healthChecker.getReport();

    // 生成Prometheus格式的指标
    const metrics = [
      '# HELP health_check_status Health check status (1=healthy, 0=unhealthy)',
      '# TYPE health_check_status gauge',
      ...report.checks.map(check =>
        `health_check_status{name="${check.name}"} ${check.status === 'healthy' ? 1 : 0}`
      ),
      '',
      '# HELP health_check_response_time Health check response time in milliseconds',
      '# TYPE health_check_response_time gauge',
      ...report.checks.map(check =>
        `health_check_response_time{name="${check.name}"} ${check.responseTime || 0}`
      ),
      '',
      '# HELP health_check_consecutive_failures Health check consecutive failures',
      '# TYPE health_check_consecutive_failures gauge',
      ...report.checks.map(check =>
        `health_check_consecutive_failures{name="${check.name}"} ${check.consecutiveFailures}`
      )
    ];

    res.set('Content-Type', 'text/plain');
    res.send(metrics.join('\n'));
  } catch (error) {
    logger.error('获取健康检查指标失败', error);
    res.status(500).send('# Failed to generate metrics');
  }
});

export default router;