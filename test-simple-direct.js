// 直接测试categories查询逻辑
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
    const pageNum = parseInt(page.toString());
    const perPageNum = parseInt(perPage.toString());
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
      params.push(parseInt(level.toString()));
    }

    if (parentId) {
      whereConditions.push(`parentId = ?`);
      params.push(parentId.toString());
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

    if (responseTime < 100) {
      console.log('🎉 性能优秀！API逻辑本身没有问题。');
    } else {
      console.log('⚠️ API逻辑耗时较长，需要进一步优化。');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDirectCategories().catch(console.error);