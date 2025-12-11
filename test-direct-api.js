// 直接测试API路由，绕过HTTP层
import express from 'express';
import { authenticate } from './src/shared/middleware/auth';
import categoriesRouter from './src/routes/v1/products/categories';

const app = express();
app.use(express.json());

// 模拟用户
const mockUser = {
  id: 'cmi4ndwmo0000eddyd3o50j4n',
  phone: '13800138888',
  role: 'ADMIN',
  level: 'DIRECTOR',
  scope: ['active', 'user'],
  type: 'access',
  iat: 1764992183,
  exp: 1765078583,
  aud: 'zhongdao-mall-users',
  iss: 'zhongdao-mall-test'
};

// 添加认证中间件，直接设置用户
app.use((req, res, next) => {
  req.user = mockUser;
  next();
});

// 挂载categories路由
app.use('/api/v1/products/categories', categoriesRouter);

async function testDirectAPI() {
  console.log('🔍 直接测试API路由（绕过HTTP）...\n');

  const req = {
    query: { page: '1', perPage: '10' },
    user: mockUser
  };

  const res = {
    json: (data) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`✅ API响应完成，耗时: ${duration}ms`);
      console.log('响应数据:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
    },
    status: (code) => {
      console.log(`响应状态码: ${code}`);
      return res;
    }
  };

  try {
    const startTime = Date.now();

    // 模拟Express路由调用
    const router = express.Router();
    router.get('/', authenticate, async (req, res) => {
      console.log('📥 进入categories处理函数');

      const queryStart = Date.now();

      // 这里直接复制categories.ts的逻辑
      const { level, parentId, page = 1, perPage = 50 } = req.query;

      // 分页参数
      const pageNum = parseInt(page as string);
      const perPageNum = parseInt(perPage as string);
      const skip = (pageNum - 1) * perPageNum;

      // 构建安全的查询条件
      const whereConditions: string[] = [];
      const params: any[] = [];

      // 始终添加活跃条件
      whereConditions.push(`isActive = ?`);
      params.push(true);

      if (level) {
        whereConditions.push(`level = ?`);
        params.push(parseInt(level as string));
      }

      if (parentId) {
        whereConditions.push(`parentId = ?`);
        params.push(parentId as string);
      } else if (level && level !== '1') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUERY',
            message: '查询非第一级分类时必须指定父分类ID',
            timestamp: new Date().toISOString()
          }
        });
      }

      const whereClause = whereConditions.join(' AND ');

      console.log(`⏱️ 查询构建耗时: ${Date.now() - queryStart}ms`);

      // 🚀 性能优化：并行执行COUNT和SELECT查询
      const dbStart = Date.now();

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
        `, ...params, perPageNum, skip)
      ]);

      console.log(`⏱️ 数据库查询耗时: ${Date.now() - dbStart}ms`);

      const total = totalResult[0]?.total || 0;

      // 如果总数不足，过滤多余的查询结果
      const finalCategories = categories.slice(0, Math.min(perPageNum, Math.max(0, total - skip)));

      const responseStart = Date.now();
      res.json({
        success: true,
        data: {
          categories: finalCategories,
          pagination: {
            page: pageNum,
            perPage: perPageNum,
            total,
            totalPages: Math.ceil(total / perPageNum),
            hasNext: skip + finalCategories.length < total,
            hasPrev: pageNum > 1
          }
        },
        message: '获取商品分类列表成功',
        timestamp: new Date().toISOString()
      });

      console.log(`⏱️ 响应构建耗时: ${Date.now() - responseStart}ms`);
    });

    // 执行路由
    await router.get('/', authenticate, async (req, res) => {
      // 这里是实际的路由处理逻辑
      // 由于需要prisma，我们简化测试
      console.log('开始模拟API处理...');

      await new Promise(resolve => setTimeout(resolve, 10)); // 模拟10ms处理

      res.json({
        success: true,
        message: '测试完成',
        timestamp: new Date().toISOString()
      });
    })(req, res);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 由于需要导入Prisma，我们改为更简单的测试
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDirectCategories() {
  console.log('🔍 直接测试categories查询逻辑...\n');

  try {
    const startTime = Date.now();

    // 模拟API中的完整逻辑
    const level = undefined;
    const parentId = undefined;
    const page = 1;
    const perPage = 10;

    // 分页参数
    const pageNum = parseInt(page as string);
    const perPageNum = parseInt(perPage as string);
    const skip = (pageNum - 1) * perPageNum;

    console.log('⏱️ 参数解析完成');

    // 构建安全的查询条件
    const whereConditions: string[] = [];
    const params: any[] = [];

    // 始终添加活跃条件
    whereConditions.push(`isActive = ?`);
    params.push(true);

    if (level) {
      whereConditions.push(`level = ?`);
      params.push(parseInt(level as string));
    }

    if (parentId) {
      whereConditions.push(`parentId = ?`);
      params.push(parentId as string);
    }

    const whereClause = whereConditions.join(' AND ');

    console.log(`⏱️ 查询条件构建完成，耗时: ${Date.now() - startTime}ms`);

    // 🚀 性能优化：并行执行COUNT和SELECT查询
    const dbStart = Date.now();

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
      `, ...params, perPageNum, skip)
    ]);

    const dbTime = Date.now() - dbStart;
    console.log(`⏱️ 数据库查询完成，耗时: ${dbTime}ms`);

    const total = totalResult[0]?.total || 0;

    // 如果总数不足，过滤多余的查询结果
    const finalCategories = categories.slice(0, Math.min(perPageNum, Math.max(0, total - skip)));

    const responseTime = Date.now() - startTime;
    console.log(`✅ 完整逻辑耗时: ${responseTime}ms`);
    console.log(`   - 数据库查询: ${dbTime}ms (${((dbTime/responseTime)*100).toFixed(1)}%)`);
    console.log(`   - 其他逻辑: ${responseTime - dbTime}ms (${(((responseTime - dbTime)/responseTime)*100).toFixed(1)}%)`);
    console.log(`   - 返回数据: ${finalCategories.length}条，总计: ${total}条`);

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDirectCategories().catch(console.error);