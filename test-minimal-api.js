/**
 * 最小化API性能测试
 * 不经过中间件，直接测试数据库查询性能
 */

const { PrismaClient } = require('@prisma/client');
const express = require('express');

const prisma = new PrismaClient();

async function testMinimalAPI() {
  console.log('🔍 开始最小化API性能测试...\n');

  try {
    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    // 1. 直接数据库查询测试
    console.log('\n📊 测试1: 直接数据库查询');
    const directStart = Date.now();
    const directCategories = await prisma.productCategories.findMany({
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
      ],
      take: 10,
      skip: 0
    });
    const directTime = Date.now() - directStart;
    console.log(`   直接查询耗时: ${directTime}ms, 返回${directCategories.length}条记录`);

    // 2. 原生SQL查询测试
    console.log('\n🚀 测试2: 原生SQL查询');
    const sqlStart = Date.now();
    const [totalResult, sqlCategories] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*) as total FROM productCategories WHERE isActive = true`,
      prisma.$queryRaw`
        SELECT
          id, name, level, parentId, sort, icon, description, createdAt, updatedAt
        FROM productCategories
        WHERE isActive = true
        ORDER BY level ASC, sort ASC, createdAt ASC
        LIMIT 10 OFFSET 0
      `
    ]);
    const sqlTime = Date.now() - sqlStart;
    console.log(`   SQL查询耗时: ${sqlTime}ms, 总数: ${totalResult[0]?.total}`);

    // 3. Express简单路由测试（不带认证中间件）
    console.log('\n🌐 测试3: Express简单API');
    const app = express();
    app.use(express.json());

    // 最简单的路由，没有认证和中间件
    app.get('/test/categories', async (req, res) => {
      try {
        const apiStart = Date.now();
        const categories = await prisma.productCategories.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            level: true,
            parentId: true,
            sort: true,
            icon: true,
            description: true
          },
          orderBy: [
            { level: 'asc' },
            { sort: 'asc' },
            { createdAt: 'asc' }
          ],
          take: 10
        });
        const apiTime = Date.now() - apiStart;

        res.json({
          success: true,
          data: categories,
          performance: {
            queryTime: `${apiTime}ms`,
            count: categories.length
          }
        });
      } catch (error) {
        console.error('API错误:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    const server = app.listen(3001, async () => {
      console.log('   Express服务器启动在端口3001');

      // 测试Express API
      const requestStart = Date.now();
      const response = await fetch('http://localhost:3001/test/categories');
      const requestTime = Date.now() - requestStart;

      const result = await response.json();
      console.log(`   Express API总耗时: ${requestTime}ms`);
      console.log(`   API查询耗时: ${result.performance?.queryTime || 'unknown'}`);

      // 关闭服务器
      server.close();
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMinimalAPI().catch(console.error);