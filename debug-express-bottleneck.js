// 诊断Express应用层性能瓶颈
require('dotenv').config({ path: '.env' });

console.log('🔍 诊断Express应用层性能瓶颈');
console.log('=====================================');

const express = require('express');
const { PrismaClient } = require('@prisma/client');

// 创建精简的Express应用
const app = express();
app.use(express.json());

// 简化的健康检查路由
app.get('/health-simple', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 数据库连接测试路由
app.get('/test-db-simple', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1 as test`;
    const time = Date.now() - start;
    res.json({ status: 'ok', dbTime: time, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// 完整的分类查询（有问题的查询）
app.get('/test-categories-full', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 10;
    const skip = (page - 1) * perPage;

    console.log('🚀 开始完整分类查询测试...', { page, perPage, skip });
    const totalStart = Date.now();

    // 复现有问题的查询逻辑
    const whereConditions = ['isActive = ?'];
    const params = [true];

    const whereClause = whereConditions.join(' AND ');

    console.log('🔍 执行并行COUNT+SELECT查询...');
    const queryStart = Date.now();

    const [totalResult, categories] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as total
        FROM productCategories
        WHERE ${whereClause}
      `, ...params),

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
        WHERE ${whereClause}
        ORDER BY level ASC, sort ASC, createdAt ASC
        LIMIT ? OFFSET ?
      `, ...params, perPage, skip)
    ]);

    const queryTime = Date.now() - queryStart;
    const totalTime = Date.now() - totalStart;

    console.log(`✅ 查询完成: ${queryTime}ms (数据库), ${totalTime}ms (总计)`);

    const total = totalResult[0]?.total || 0;
    const finalCategories = categories.slice(0, Math.min(perPage, Math.max(0, total - skip)));

    const processingTime = Date.now() - totalStart;
    console.log(`📊 处理完成: ${processingTime}ms`);

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
        totalTime,
        processingTime
      }
    });

  } catch (error) {
    console.error('❌ 查询错误:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  } finally {
    await prisma.$disconnect();
  }
});

// 仅SELECT查询（无COUNT）
app.get('/test-categories-select-only', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.perPage) || 10;
    const skip = (page - 1) * perPage;

    console.log('🔍 开始仅SELECT查询测试...', { page, perPage, skip });
    const start = Date.now();

    const categories = await prisma.$queryRawUnsafe(`
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
    `, true, perPage, skip);

    const time = Date.now() - start;
    console.log(`✅ SELECT查询完成: ${time}ms`);

    res.json({
      success: true,
      data: { categories },
      timing: { time }
    });

  } catch (error) {
    console.error('❌ 查询错误:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await prisma.$disconnect();
  }
});

// 启动测试服务器
const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 测试服务器启动在端口 ${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health-simple`);
  console.log(`🔍 数据库测试: http://localhost:${PORT}/test-db-simple`);
  console.log(`⚠️ 完整分类查询: http://localhost:${PORT}/test-categories-full`);
  console.log(`⚡ 仅SELECT查询: http://localhost:${PORT}/test-categories-select-only`);

  // 自动测试
  setTimeout(() => runTests(), 1000);
});

// 运行测试
async function runTests() {
  console.log('\n🧪 开始自动测试...');

  const tests = [
    { name: '健康检查', url: `http://localhost:${PORT}/health-simple` },
    { name: '数据库连接', url: `http://localhost:${PORT}/test-db-simple` },
    { name: '仅SELECT查询', url: `http://localhost:${PORT}/test-categories-select-only` },
    { name: '完整分类查询', url: `http://localhost:${PORT}/test-categories-full` }
  ];

  for (const test of tests) {
    console.log(`\n🔍 测试: ${test.name}`);
    const start = Date.now();

    try {
      const response = await fetch(test.url);
      const data = await response.json();
      const time = Date.now() - start;

      console.log(`✅ ${test.name} - ${time}ms`);
      if (data.timing) {
        console.log(`   - 数据库查询: ${data.timing.queryTime || data.timing.time}ms`);
        console.log(`   - 总处理时间: ${data.timing.totalTime || data.timing.time}ms`);
      }
    } catch (error) {
      const time = Date.now() - start;
      console.log(`❌ ${test.name} - ${time}ms - 错误: ${error.message}`);
    }
  }

  console.log('\n🎯 测试完成，服务器保持运行中...');
  console.log('💡 手动测试: curl http://localhost:3001/test-categories-full');
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});