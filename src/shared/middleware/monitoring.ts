import { Request, Response, NextFunction } from 'express';
import { systemMonitor } from '../services/systemMonitor';
import { logger } from '../utils/logger';
import { prisma } from '../database/client';

// 请求时间记录中间件
export const requestTimingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // 监听响应结束
  res.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // 记录请求指标
    systemMonitor.recordRequest(req, res, responseTime);
  });

  // 监听错误
  res.on('error', (err: Error) => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // 记录错误请求
    systemMonitor.recordRequest(req, res, responseTime, err);
  });

  next();
};

// API日志中间件
export const apiLoggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.requestId || Math.random().toString(36).substring(7);
  req.requestId = requestId;

  // 记录请求开始
  logger.apiRequest(req.method, req.url, req.user?.id, requestId);

  // 记录响应
  res.on('finish', () => {
    logger.info('API响应', {
      requestId,
      statusCode: res.statusCode,
      userId: req.user?.id
    });
  });

  next();
};

// 健康检查中间件
export const healthCheckMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const healthStatus = await systemMonitor.getHealthStatus();

    res.status(healthStatus.status === 'healthy' ? 200 :
                   healthStatus.status === 'degraded' ? 200 : 503)
       .json({
         status: healthStatus.status,
         timestamp: new Date().toISOString(),
         metrics: healthStatus.metrics,
         issues: healthStatus.issues
       });
  } catch (error) {
    logger.error('健康检查失败', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
};

// 错误监控中间件
export const errorMonitoringMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.requestId || 'unknown';
  const userId = req.user?.id || 'anonymous';

  // 记录错误
  logger.error('请求处理错误', {
    error: err.message,
    stack: err.stack,
    requestId,
    userId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 可以选择发送错误报告到监控系统
  if (err.statusCode && err.statusCode >= 500) {
    // 严重错误，发送警报
    sendErrorAlert(err, req);
  }

  next(err);
};

// 发送错误警报（示例实现）
function sendErrorAlert(err: Error, req: Request): void {
  // 这里可以集成到实际的警报系统
  // 例如：邮件、短信、Slack、钉钉等

  logger.warn('发送错误警报', {
    error: err.message,
    url: req.url,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
}

// 数据库性能监控中间件
export const dbPerformanceMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

  // 修改prisma实例以监控查询
  const originalQueryRaw = prisma.$queryRaw;

  // TODO: 这里可以hook prisma的查询方法来记录慢查询

  next();
};

// 内存使用监控
export const memoryMonitor = {
  start: () => {
    setInterval(() => {
      const memUsage = process.memoryUsage();

      // 内存使用超过阈值时记录警告
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 1024) { // 1GB
        logger.warn('内存使用过高', {
          heapUsed: `${heapUsedMB.toFixed(2)}MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`
        });
      }
    }, 60000); // 每分钟检查一次
  }
};

// 启动内存监控
memoryMonitor.start();