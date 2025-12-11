// 最小化Express服务器测试 - 直接测试categories路由
require('dotenv').config({ path: '.env' });

const express = require('express');
const cors = require('cors');

console.log('🚀 创建最小化Express服务器');
console.log('=====================================');

const app = express();

// 只使用最基本的中间件
app.use(cors());
app.use(express.json());

// 模拟JWT认证中间件 - 简化版本
app.use((req, res, next) => {
  // 跳过认证，直接设置用户信息
  req.user = {
    id: 'crho9e2hrp50xqkh2xum9rbp', // 普通用户ID
    level: 'NORMAL',
    role: 'USER'
  };
  next();
});

// 数据库连接
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 直接复制categories.ts的核心逻辑
app.get('/api/v1/products/categories', async (req, res) => {
  try {
    const start = Date.now();

    const page = parseInt(req.query.page) || 1;
    const perPage = Math.min(parseInt(req.query.perPage) || 10, 100);
    const skip = (page - 1) * perPage;

    // 构建查询条件
    const whereConditions = ['isActive = ?'];
    const params = [true];

    const level = req.query.level;
    if (level) {
      whereConditions.push('level = ?');
      params.push(parseInt(level));
    }

    const parentId = req.query.parentId;
    if (parentId) {
      whereConditions.push('parentId = ?');
      params.push(parentId);
    }

    const whereClause = whereConditions.join(' AND ');

    console.log('🔍 执行并行COUNT+SELECT查询...');
    const queryStart = Date.now();

    // 并行执行COUNT和SELECT查询
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
    const totalTime = Date.now() - start;

    console.log(`✅ 查询完成: ${queryTime}ms (数据库), ${totalTime}ms (总计)`);

    const total = Number(totalResult[0]?.total || 0);
    const finalCategories = categories.slice(0, Math.min(perPage, Math.max(0, total - skip)));

    const response = {
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
        totalTime
      }
    };

    res.json(response);

  } catch (error) {
    console.error('❌ 查询错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// categories tree 路由
app.get('/api/v1/products/categories/tree', async (req, res) => {
  try {
    const start = Date.now();

    console.log('🌳 构建分类树...');

    const categories = await prisma.productCategories.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        level: true,
        parentId: true,
        sort: true,
        icon: true,
        description: true,
        createdAt: true
      },
      orderBy: [
        { level: 'asc' },
        { sort: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    const queryTime = Date.now() - start;

    // 构建树形结构
    const categoryMap = new Map();
    const rootCategories = [];

    // 创建映射
    categories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // 构建树形结构
    categories.forEach(category => {
      const node = categoryMap.get(category.id);
      if (category.parentId && categoryMap.has(category.parentId)) {
        categoryMap.get(category.parentId).children.push(node);
      } else {
        rootCategories.push(node);
      }
    });

    const totalTime = Date.now() - start;
    console.log(`✅ 分类树构建完成: ${queryTime}ms (查询), ${totalTime}ms (总计)`);

    res.json({
      success: true,
      data: {
        categories: rootCategories,
        total: categories.length
      },
      timing: {
        queryTime,
        totalTime
      }
    });

  } catch (error) {
    console.error('❌ 分类树错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: '最小化服务器运行正常'
  });
});

// 启动服务器
const PORT = 3002;
const server = app.listen(PORT, () => {
  console.log(`🚀 最小化服务器启动在端口 ${PORT}`);
  console.log(`📊 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔍 分类列表: http://localhost:${PORT}/api/v1/products/categories?page=1&perPage=10`);
  console.log(`🌳 分类树: http://localhost:${PORT}/api/v1/products/categories/tree`);

  // 自动测试
  setTimeout(() => runTests(), 1000);
});

// 测试函数
async function runTests() {
  console.log('\n🧪 开始最小化服务器测试...');

  const tests = [
    { name: '健康检查', url: `http://localhost:${PORT}/health` },
    { name: '分类列表', url: `http://localhost:${PORT}/api/v1/products/categories?page=1&perPage=10` },
    { name: '分类树', url: `http://localhost:${PORT}/api/v1/products/categories/tree` }
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
        console.log(`   - 数据库查询: ${data.timing.queryTime}ms`);
        console.log(`   - 总处理时间: ${data.timing.totalTime}ms`);
      }
      console.log(`   - 响应状态: ${response.status}`);
    } catch (error) {
      const time = Date.now() - start;
      console.log(`❌ ${test.name} - ${time}ms - 错误: ${error.message}`);
    }
  }

  console.log('\n🎯 最小化服务器测试完成');
  console.log('💡 如果这些测试很快，说明瓶颈在主应用的中间件');
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭最小化服务器...');
  server.close(() => {
    console.log('✅ 最小化服务器已关闭');
    process.exit(0);
  });
});