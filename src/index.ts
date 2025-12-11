import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';

// &#x26A0; 关键！佋必须最先加载环境变量，在任何其他import之前
import './init-env';

// 导入配置模块（运行时读取环境变量）
import {config, validateConfig} from './config';

// 导入中间件
import {requestId} from './shared/middleware/requestId';
import {errorHandler, notFoundHandler} from './shared/middleware/error';
import {authenticate, optionalAuthenticate} from './shared/middleware/auth';
import {checkDatabaseHealth} from './shared/database/client';
import {xssProtection, inputValidation, rateLimit, securityHeaders} from './shared/middleware/security';
import {csrfProtection} from './shared/middleware/csrf';
import {performStartupSecurityCheck} from './shared/services/security-config';
import {enhancedSecurityHeaders, enhancedInputValidation} from './shared/middleware/enhanced-security';
import {securityMonitoring} from './shared/services/security-monitoring';
import {fileUploadSecurity} from './shared/middleware/file-upload-security';
import {performanceMonitor, getPerformanceSummary} from './shared/middleware/performance-monitor';
import {performanceMonitorV2 as enhancedPerformanceMonitor} from './shared/middleware/performance-monitor-v2';

// 导入响应工具
import {createSuccessResponse, createErrorResponse, ErrorCode} from './shared/types/response';

// 导入路由
import apiV1Routes from './routes/v1';

// 导入支付配置
import PaymentConfigLoader from './config/payments';

// 导入配置初始化
import {initializeConfigs} from './modules/config';

// 导入日志
import {logger} from './shared/utils/logger';

// 导入监控中间件
import {
  requestTimingMiddleware,
  apiLoggingMiddleware,
  healthCheckMiddleware,
  errorMonitoringMiddleware
} from './shared/middleware/monitoring';

// 导入新的监控系统
import {
  initializeMonitoring,
  getMonitoringMiddleware,
  setupGracefulShutdown
} from './monitoring/middleware/monitoring-integration';

// 导入 Swagger 文档
import swaggerSetup from './config/swagger';


// ✅ 验证必要的环境变量（运行时）
validateConfig();

// 初始化支付系统
PaymentConfigLoader.initializePaymentSystem();

const app = express();
const PORT = config.app.port;  // ✅ 从config对象读取端口号

// 监控页面路由（最先处理，避免被其他中间件拦截）
app.get('/monitoring.html', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/monitoring.html'));
});

// 启动时安全检查（静默模式，只记录日志）
if (process.env.NODE_ENV === 'production') {
    performStartupSecurityCheck();
}

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
    origin: [
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:8080',
        'https://zd-h5.aierxin.com',
        'https://zd-admin.aierxin.com/',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-CSRF-Token']
}));

// 安全监控和IP检查 - 临时禁用以诊断问题
// app.use(securityMonitoring as any);

// 压缩
app.use(compression());

// 静态文件服务
app.use(express.static('public'));

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

// 请求时间监控中间件
app.use(requestTimingMiddleware);

// API日志中间件
app.use(apiLoggingMiddleware);

// 性能监控中间件 - 使用增强版本
// 启用优化的性能监控V2
app.use(enhancedPerformanceMonitor);

// 新的监控系统中间件（已修复循环依赖）
const monitoringMiddleware = getMonitoringMiddleware();
app.use(monitoringMiddleware);

// 增强的输入验证 - 已修复过度拦截问题，重新启用
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
    app.use(morgan('combined', {
        skip: (req) => req.path === '/health'  // 健康检查日志过多，跳过
    }));
}

// 简单健康检查端点（兼容性）
app.get('/health', (req, res) => {
    res.json(createSuccessResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: config.app.nodeEnv,
        uptime: process.uptime()
    }));
});

// 详细健康检查端点（包含系统监控）
app.get('/health/detailed', healthCheckMiddleware);

// 数据库健康检查
app.get('/health/database', async (req, res) => {
    try {
        await checkDatabaseHealth();
        res.json(createSuccessResponse({
            status: 'ok',
            database: `mysql://${config.database.host}:${config.database.port}/${config.database.name}`,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        logger.error('数据库健康检查失败', {error});
        res.status(503).json(createErrorResponse(
            ErrorCode.INTERNAL_ERROR,
            '数据库连接失败',
            undefined,
            undefined,
            req.requestId
        ));
    }
});

// Redis健康检查
app.get('/health/redis', (req, res) => {
    // 注意：生产环境禁用Redis，此端点仅为兼容性
    res.json(createSuccessResponse({
        status: 'ok',
        cache: 'memory',  // 生产环境使用内存缓存
        timestamp: new Date().toISOString()
    }));
});

// 安全状态检查
app.get('/health/security', (req, res) => {
    try {
        const {securityConfigService} = require('./shared/services/security-config');
        const {securityMonitoringService} = require('./shared/services/security-monitoring');

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
        logger.error('安全状态检查失败', {error});
        res.status(500).json(createErrorResponse(
            'INTERNAL_ERROR' as any,
            '安全状态检查失败'
        ));
    }
});

// Swagger API 文档 (在健康检查之后，API路由之前)
swaggerSetup(app);

// 简单测试路由 - 在API路由之前
app.get('/api/v1/test-simple', (req, res) => {
  res.json({
    success: true,
    message: 'Test route working!',
    timestamp: new Date().toISOString()
  });
});

// API路由
app.use('/api/v1', apiV1Routes);

// 监控页面路由（必须在404处理之前）
app.get('/monitoring.html', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/monitoring.html'));
});

// 调试：添加日志查看路由是否被注册
console.log('🔍 API路由已注册到 /api/v1');

// 404处理
app.use(notFoundHandler);

// 错误监控中间件（在错误处理之前）
app.use(errorMonitoringMiddleware);

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
app.listen(PORT, async () => {
    // 简化的启动信息
    const isDev = process.env.NODE_ENV === 'development';

    // 检查数据库连接状态
    let dbStatus = '未知';
    try {
        const isHealthy = await checkDatabaseHealth();
        dbStatus = isHealthy ? '已连接' : '连接失败';
    } catch (error) {
        dbStatus = '连接失败';
    }

    // 启动监控系统
    console.log('🔄 正在启动监控系统...');
    try {
        await initializeMonitoring();
        console.log('✅ 监控系统启动成功');
    } catch (error) {
        console.error('❌ 监控系统启动失败:', error);
        // 不阻塞应用启动
    }

    // 设置优雅关闭
    setupGracefulShutdown();

    console.log(`\n🚀 中道商城系统启动成功！`);
    console.log(`📍 端口: ${PORT}`);
    console.log(`🌍 环境: ${isDev ? '开发模式' : '生产模式'}`);
    console.log(`🗄️ 数据库: ${dbStatus} (${config.database.host}:${config.database.port}/${config.database.name})`);
    console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
    console.log(`📊 监控面板: http://localhost:${PORT}/api/v1/monitoring/page`);
    console.log(`📚 API文档: http://localhost:${PORT}/api-docs\n`);

    // 🚀 优化：测试环境跳过配置初始化，避免数据库连接池竞争
    if (process.env.NODE_ENV === 'test') {
      console.log('🧪 测试环境：跳过系统配置初始化');
    } else {
      // 异步初始化系统配置，不阻塞服务器启动
      console.log('🔄 异步初始化系统配置...');
      // 延迟5秒执行配置初始化，避免与API请求竞争数据库连接
      setTimeout(() => {
        initializeConfigs().catch(error => {
          console.error('❌ 系统配置初始化失败:', error);
        });
      }, 5000);
    }
});

export default app;