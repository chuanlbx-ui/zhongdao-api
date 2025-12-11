// 中间件性能诊断脚本 - 逐个禁用中间件定位15秒延迟的元凶
require('dotenv').config({ path: '.env' });

console.log('🔍 中间件性能诊断');
console.log('==================');

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

// 从主应用复制所有中间件
const helmet = require('helmet');
const compression = require('compression');
// const rateLimit = require('express-rate-limit'); // 临时禁用

// 模拟性能监控中间件
const mockPerformanceMonitor = (req, res, next) => {
  const start = Date.now();

  // 监听响应完成
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[性能监控] ${req.method} ${req.path} - ${duration}ms - ${res.statusCode}`);
  });

  next();
};

// 模拟安全监控中间件（简化版）
const mockSecurityMonitor = (req, res, next) => {
  // 模拟IP检查
  const clientIP = req.ip || req.connection.remoteAddress;

  // 模拟可疑行为检测
  const suspiciousPatterns = ['<script', 'javascript:', 'data:'];
  const isSuspicious = suspiciousPatterns.some(pattern =>
    JSON.stringify(req.body).includes(pattern)
  );

  // 模拟安全日志记录
  if (isSuspicious) {
    console.log(`[安全监控] 检测到可疑请求: ${clientIP}`);
  }

  next();
};

// 模拟CSRF中间件（简化版）
const mockCSRF = (req, res, next) => {
  // 跳过GET请求
  if (req.method === 'GET') {
    return next();
  }

  // 模拟CSRF令牌验证
  const csrfToken = req.get('X-CSRF-Token') || req.body._csrf;
  if (!csrfToken) {
    return res.status(403).json({ error: 'CSRF token missing' });
  }

  next();
};

// 模拟JWT认证中间件（简化版）
const mockJWTAuth = (req, res, next) => {
  // 跳过健康检查等路由
  if (req.path.startsWith('/health') || req.path.startsWith('/test-')) {
    return next();
  }

  // 从Authorization头提取token
  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '认证失败 - 缺少Bearer token' });
  }

  const token = authHeader.substring(7);

  try {
    // 模拟JWT验证（这里简化处理，直接设置用户）
    if (token.length > 50) { // 简单验证
      req.user = {
        id: 'crho9e2hrp50xqkh2xum9rbp',
        level: 'NORMAL',
        role: 'USER'
      };
      next();
    } else {
      res.status(401).json({ error: '认证失败 - 无效token' });
    }
  } catch (error) {
    res.status(401).json({ error: '认证失败 - ' + error.message });
  }
};

// 测试配置 - 不同的中间件组合
const middlewareConfigs = [
  {
    name: '基础配置（仅必需中间件）',
    middlewares: [cors(), express.json(), express.urlencoded({ extended: true })]
  },
  {
    name: '基础 + 性能监控',
    middlewares: [cors(), express.json(), mockPerformanceMonitor]
  },
  {
    name: '基础 + 安全监控',
    middlewares: [cors(), express.json(), mockSecurityMonitor]
  },
  {
    name: '基础 + CSRF防护',
    middlewares: [cors(), express.json(), mockCSRF]
  },
  {
    name: '基础 + JWT认证',
    middlewares: [cors(), express.json(), mockJWTAuth]
  },
  {
    name: '基础 + Helmet安全头',
    middlewares: [cors(), express.json(), helmet()]
  },
  {
    name: '基础 + 压缩',
    middlewares: [cors(), express.json(), compression()]
  },
  // {
  //   name: '基础 + 限流',
  //   middlewares: [
  //     cors(),
  //     express.json(),
  //     rateLimit({
  //       windowMs: 15 * 60 * 1000, // 15分钟
  //       max: 1000, // 限制每个IP 1000个请求
  //       message: { error: '请求过于频繁' }
  //     })
  //   ]
  // },
  {
    name: '完整中间件栈',
    middlewares: [
      helmet(),
      cors(),
      compression(),
      express.json(),
      express.urlencoded({ extended: true }),
      mockPerformanceMonitor,
      mockSecurityMonitor,
      mockCSRF,
      mockJWTAuth
      // rateLimit({
      //   windowMs: 15 * 60 * 1000,
      //   max: 1000,
      //   message: { error: '请求过于频繁' }
      // })
    ]
  }
];

// 创建测试函数
async function createTestServer(config) {
  const app = express();

  // 应用中间件
  app.use(config.middlewares);

  // 添加测试路由
  app.get('/api/v1/products/categories', async (req, res) => {
    const start = Date.now();

    try {
      const page = parseInt(req.query.page) || 1;
      const perPage = Math.min(parseInt(req.query.perPage) || 10, 100);
      const skip = (page - 1) * perPage;

      const prisma = new PrismaClient();

      // 执行查询
      const [totalResult, categories] = await Promise.all([
        prisma.$queryRawUnsafe(`
          SELECT COUNT(*) as total
          FROM productCategories
          WHERE isActive = ?
        `, true),

        prisma.$queryRawUnsafe(`
          SELECT
            id,
            name,
            level,
            parentId,
            sort,
            icon,
            description,
            createdAt,
            updatedAt
          FROM productCategories
          WHERE isActive = ?
          ORDER BY level ASC, sort ASC, createdAt ASC
          LIMIT ? OFFSET ?
        `, true, perPage, skip)
      ]);

      await prisma.$disconnect();

      const total = Number(totalResult[0]?.total || 0);
      const finalCategories = categories.slice(0, Math.min(perPage, Math.max(0, total - skip)));

      const queryTime = Date.now() - start;

      res.json({
        success: true,
        data: {
          categories: finalCategories,
          pagination: {
            page,
            perPage,
            total,
            totalPages: Math.ceil(total / perPage)
          }
        },
        timing: {
          queryTime,
          totalTime: queryTime
        },
        config: config.name
      });

    } catch (error) {
      console.error('查询错误:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        config: config.name
      });
    }
  });

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      config: config.name,
      timestamp: new Date().toISOString()
    });
  });

  return app;
}

// 运行测试
async function runMiddlewareTests() {
  const results = [];

  for (const config of middlewareConfigs) {
    console.log(`\n🧪 测试配置: ${config.name}`);
    console.log('=====================================');

    const app = await createTestServer(config);
    const server = app.listen(3003); // 使用不同端口

    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 运行测试
    const start = Date.now();

    try {
      const response = await fetch('http://localhost:3003/api/v1/products/categories?page=1&perPage=10');
      const data = await response.json();
      const time = Date.now() - start;

      results.push({
        config: config.name,
        time: time,
        status: response.status,
        success: data.success,
        queryTime: data.timing?.queryTime || 0
      });

      console.log(`✅ ${config.name}`);
      console.log(`   总耗时: ${time}ms`);
      console.log(`   响应状态: ${response.status}`);
      if (data.timing) {
        console.log(`   查询时间: ${data.timing.queryTime}ms`);
        console.log(`   中间件耗时: ${time - data.timing.queryTime}ms`);
      }

    } catch (error) {
      const time = Date.now() - start;
      console.log(`❌ ${config.name} - 错误: ${error.message}`);

      results.push({
        config: config.name,
        time: time,
        status: 'ERROR',
        success: false,
        error: error.message
      });
    }

    // 关闭服务器
    server.close();

    // 等待服务器完全关闭
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 输出结果对比
  console.log('\n📊 中间件性能对比结果');
  console.log('========================');
  console.table(results);

  // 找出最慢的配置
  const slowestConfig = results.reduce((prev, current) =>
    (prev.time > current.time) ? prev : current
  );

  const fastestConfig = results.reduce((prev, current) =>
    (prev.time < current.time) ? prev : current
  );

  console.log(`\n🏆 最快配置: ${fastestConfig.config} - ${fastestConfig.time}ms`);
  console.log(`🐌 最慢配置: ${slowestConfig.config} - ${slowestConfig.time}ms`);

  if (slowestConfig.time > 5000) { // 超过5秒
    console.log('\n⚠️ 检测到严重性能瓶颈！超过5秒的配置：');
    results
      .filter(r => r.time > 5000)
      .forEach(r => console.log(`   - ${r.config}: ${r.time}ms`));
  }

  // 分析中间件开销
  const baseTime = results.find(r => r.config === '基础配置（仅必需中间件）')?.time || 0;

  console.log('\n📈 中间件开销分析（相对于基础配置）：');
  results.forEach(result => {
    if (result.config !== '基础配置（仅必需中间件）' && result.time > 0) {
      const overhead = result.time - baseTime;
      const overheadPercent = ((overhead / baseTime) * 100).toFixed(1);
      console.log(`   ${result.config}: +${overhead}ms (+${overheadPercent}%)`);
    }
  });
}

// 启动测试
console.log('🚀 开始中间件性能诊断...');
runMiddlewareTests()
  .then(() => {
    console.log('\n✅ 中间件性能诊断完成');
    console.log('💡 查看结果表找出导致15秒延迟的具体中间件');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 诊断失败:', error);
    process.exit(1);
  });