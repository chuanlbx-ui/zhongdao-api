const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const port = 3001;

// 最简单的Express应用，专门调试性能问题
app.use(express.json());

// 添加请求时间日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - 开始处理`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - 完成，耗时: ${duration}ms`);
  });

  next();
});

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// 简化的JWT验证中间件
const mockAuth = (req, res, next) => {
  req.user = { id: 'test-user', level: 'DIRECTOR' };
  next();
};

app.use(mockAuth);

// 测试原始数据库查询性能
app.get('/test-raw-query', async (req, res) => {
  try {
    console.log('开始执行原始SQL查询...');
    const start = Date.now();

    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM productCategories WHERE isActive = true`;

    const queryTime = Date.now() - start;
    console.log(`原始SQL查询完成，耗时: ${queryTime}ms`);

    res.json({
      success: true,
      count: result[0].count,
      queryTime
    });
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 测试Prisma ORM查询性能
app.get('/test-prisma-query', async (req, res) => {
  try {
    console.log('开始执行Prisma ORM查询...');
    const start = Date.now();

    const count = await prisma.productCategories.count({
      where: { isActive: true }
    });

    const queryTime = Date.now() - start;
    console.log(`Prisma ORM查询完成，耗时: ${queryTime}ms`);

    res.json({
      success: true,
      count,
      queryTime
    });
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 测试API路由性能（复制categories路由的核心逻辑）
app.get('/test-categories-api', async (req, res) => {
  try {
    console.log('开始执行categories API逻辑...');
    const start = Date.now();

    // 模拟categories/list API的查询
    const page = 1;
    const perPage = 10;
    const skip = (page - 1) * perPage;

    console.log('执行主查询...');
    const queryStart = Date.now();

    const categories = await prisma.$queryRaw`
      SELECT
        id, name, level, parentId, sort, icon, description, createdAt
      FROM productCategories
      WHERE isActive = true
      ORDER BY sort ASC, createdAt ASC
      LIMIT ${perPage} OFFSET ${skip}
    `;

    const queryTime = Date.now() - queryStart;
    console.log(`主查询完成，耗时: ${queryTime}ms`);

    console.log('执行计数查询...');
    const countStart = Date.now();

    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM productCategories
      WHERE isActive = true
    `;

    const countTime = Date.now() - countStart;
    console.log(`计数查询完成，耗时: ${countTime}ms`);

    const totalTime = Date.now() - start;
    console.log(`API总耗时: ${totalTime}ms`);

    res.json({
      success: true,
      categories,
      total: Number(countResult[0]?.total || 0),
      pagination: {
        page,
        perPage,
        total: Number(countResult[0]?.total || 0),
        totalPages: Math.ceil(Number(countResult[0]?.total || 0) / perPage)
      },
      performance: {
        queryTime,
        countTime,
        totalTime
      }
    });
  } catch (error) {
    console.error('API错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 测试中间件性能
app.get('/test-middleware', (req, res) => {
  const start = Date.now();

  // 模拟一些中间件处理
  setTimeout(() => {
    const duration = Date.now() - start;
    res.json({
      message: '中间件测试完成',
      duration
    });
  }, 10);
});

app.listen(port, () => {
  console.log(`性能调试服务器启动在 http://localhost:${port}`);
  console.log('可用的测试端点:');
  console.log('  GET /test-raw-query - 测试原始SQL查询');
  console.log('  GET /test-prisma-query - 测试Prisma ORM查询');
  console.log('  GET /test-categories-api - 测试categories API逻辑');
  console.log('  GET /test-middleware - 测试中间件性能');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});