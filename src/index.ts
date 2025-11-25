import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

// 导入中间件
import { requestId } from './shared/middleware/requestId';
import { errorHandler, notFoundHandler } from './shared/middleware/error';
import { authenticate, optionalAuthenticate } from './shared/middleware/auth';
import { checkDatabaseHealth } from './shared/database/client';
import { xssProtection, inputValidation, rateLimit, securityHeaders } from './shared/middleware/security';
import { csrfProtection } from './shared/middleware/csrf';
import { enhancedSecurityHeaders, enhancedInputValidation } from './shared/middleware/enhanced-security';
import { securityMonitoring } from './shared/services/security-monitoring';
import { fileUploadSecurity } from './shared/middleware/file-upload-security';
import { performStartupSecurityCheck } from './shared/services/security-config';

// 导入响应工具
import { createSuccessResponse, createErrorResponse, ErrorCode } from './shared/types/response';

// 导入路由
import apiV1Routes from './routes/v1';

// 导入支付配置
import PaymentConfigLoader from './config/payments';

// 导入配置初始化
import { initializeConfigs } from './modules/config';

// 导入日志
import { logger } from './shared/utils/logger';

// 导入 Swagger 文档
import swaggerSetup from './config/swagger';

// 加载环境变量
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

// 初始化支付系统
PaymentConfigLoader.initializePaymentSystem();

const app = express();
const PORT = process.env.PORT || 3000;

// 启动时安全检查
performStartupSecurityCheck();

// 基础安全中间件（按安全优先级排序）
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  }
}));

// 增强的安全头配置
app.use(enhancedSecurityHeaders);

// CORS配置
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// 安全监控和IP检查
app.use(securityMonitoring as any);

// 压缩
app.use(compression());

// 请求体大小限制和解析
app.use(express.json({
  limit: process.env.MAX_PAYLOAD_SIZE || '10mb',
  strict: true
}));
app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_PAYLOAD_SIZE || '10mb',
  parameterLimit: 100
}));

// 请求ID中间件
app.use(requestId);

// 增强的输入验证
app.use(enhancedInputValidation);

// CSRF防护（对状态变更请求）
app.use(csrfProtection);

// 文件上传安全保护
app.use('/api/v1/upload', fileUploadSecurity());

// XSS保护
app.use(xssProtection);

// 基础输入验证（保持向后兼容）
app.use(inputValidation);

// 通用限流（每分钟100次请求）
app.use(rateLimit(100, 60 * 1000));

// 日志中间件
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// 健康检查端点
app.get('/health', (req, res) => {
  res.json(createSuccessResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  }));
});

// 数据库健康检查
app.get('/health/database', async (req, res) => {
  try {
    await checkDatabaseHealth();
    res.json(createSuccessResponse({
      status: 'ok',
      database: 'mysql',
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    res.status(503).json(createErrorResponse(
      'DATABASE_ERROR' as any,
      '数据库连接失败',
      undefined,
      503,
      req.requestId
    ));
  }
});

// Redis健康检查
app.get('/health/redis', (req, res) => {
  // TODO: 实现Redis健康检查
  res.json(createSuccessResponse({
    status: 'ok',
    cache: 'redis',
    timestamp: new Date().toISOString()
  }));
});

// 安全状态检查
app.get('/health/security', (req, res) => {
  try {
    const { securityConfigService } = require('./shared/services/security-config');
    const { securityMonitoringService } = require('./shared/services/security-monitoring');

    const securityReport = securityConfigService.generateSecurityReport();
    const securityStats = securityMonitoringService.getSecurityStats();

    res.json(createSuccessResponse({
      securityLevel: securityReport.securityLevel,
      overallScore: securityReport.overallScore,
      timestamp: securityReport.timestamp,
      issues: {
        errors: securityReport.validationResults.errors.length,
        warnings: securityReport.validationResults.warnings.length
      },
      monitoring: {
        totalEvents: securityStats.totalEvents,
        blacklistedIPs: securityStats.blacklistedIPs,
        suspiciousIPs: securityStats.suspiciousIPs
      },
      recommendations: securityReport.recommendations.slice(0, 5) // 只返回前5个建议
    }));
  } catch (error) {
    logger.error('安全状态检查失败', { error });
    res.status(500).json(createErrorResponse(
      'INTERNAL_ERROR' as any,
      '安全状态检查失败'
    ));
  }
});

// Swagger API 文档 (在健康检查之后，API路由之前)
swaggerSetup(app);

// API路由
app.use('/api/v1', apiV1Routes);

// 404处理
app.use(notFoundHandler);

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
app.listen(PORT, async () => {
  console.log(`🚀 中道商城系统启动成功！`);
  console.log(`📍 端口: ${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV}`);
  console.log(`🕒 时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
  console.log(`📚 API文档: http://localhost:${PORT}/api-docs`);
  console.log(`🔧 API路由: http://localhost:${PORT}/api/v1`);
  console.log(`📄 JSON文档: http://localhost:${PORT}/api-docs.json`);

  // 初始化系统配置
  try {
    await initializeConfigs();
    console.log(`✅ 系统配置已初始化`);
  } catch (error) {
    logger.error('系统配置初始化失败', { error });
    console.error('❌ 系统配置初始化失败:', error);
  }
});

export default app;