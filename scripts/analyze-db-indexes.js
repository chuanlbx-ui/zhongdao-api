const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeIndexes() {
  console.log('开始分析数据库索引...\n');

  try {
    // 1. 检查 pointsTransactions 表的索引
    console.log('1. pointsTransactions 表索引分析：');
    const transactionIndexes = await prisma.$queryRaw`
      SHOW INDEX FROM pointsTransactions
    `;
    console.table(transactionIndexes);

    // 2. 分析查询性能
    console.log('\n2. 分析查询执行计划：');

    // 模拟用户交易查询
    const testUserId = 'test_user_id_1234567890123456789012345';

    // 检查用户交易查询的执行计划
    const explainQuery = await prisma.$queryRaw`
      EXPLAIN FORMAT=JSON
      SELECT * FROM pointsTransactions
      WHERE fromUserId = ${testUserId} OR toUserId = ${testUserId}
      ORDER BY createdAt DESC
      LIMIT 20
    `;
    console.log('用户交易查询执行计划：');
    console.log(JSON.stringify(explainQuery, null, 2));

    // 3. 检查表大小和记录数
    console.log('\n3. 表统计信息：');
    const tableStats = await prisma.$queryRaw`
      SELECT
        table_name,
        table_rows,
        data_length,
        index_length,
        (data_length + index_length) as total_size
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'pointsTransactions'
    `;
    console.table(tableStats);

    // 4. 分析慢查询
    console.log('\n4. 检查慢查询日志：');
    try {
      const slowQueries = await prisma.$queryRaw`
        SELECT
          start_time,
          query_time,
          lock_time,
          rows_sent,
          rows_examined,
          sql_text
        FROM mysql.slow_log
        WHERE sql_text LIKE '%pointsTransactions%'
        ORDER BY start_time DESC
        LIMIT 10
      `;
      if (slowQueries.length > 0) {
        console.table(slowQueries);
      } else {
        console.log('未找到相关的慢查询记录');
      }
    } catch (error) {
      console.log('无法访问慢查询日志（可能未启用）');
    }

    // 5. 建议的索引优化
    console.log('\n5. 索引优化建议：');
    console.log('建议添加以下索引：');
    console.log('1. (toUserId, createdAt) 复合索引 - 用于优化收款记录查询');
    console.log('2. (fromUserId, createdAt) 复合索引 - 用于优化付款记录查询');
    console.log('3. (type, createdAt) 复合索引 - 用于优化按类型筛选的查询');
    console.log('4. (status, createdAt) 复合索引 - 用于优化按状态筛选的查询');
    console.log('5. (createdAt) 单列索引 - 用于优化时间排序');

    // 6. 生成创建索引的SQL
    console.log('\n6. 生成优化索引SQL：');
    const indexSQL = `
-- 优化积分交易表查询性能的索引
-- 1. 用户收款记录查询优化
CREATE INDEX IF NOT EXISTS idx_points_transactions_to_user_created
ON pointsTransactions (toUserId, createdAt DESC);

-- 2. 用户付款记录查询优化
CREATE INDEX IF NOT EXISTS idx_points_transactions_from_user_created
ON pointsTransactions (fromUserId, createdAt DESC);

-- 3. 交易类型查询优化
CREATE INDEX IF NOT EXISTS idx_points_transactions_type_created
ON pointsTransactions (type, createdAt DESC);

-- 4. 交易状态查询优化
CREATE INDEX IF NOT EXISTS idx_points_transactions_status_created
ON pointsTransactions (status, createdAt DESC);

-- 5. 时间范围查询优化
CREATE INDEX IF NOT EXISTS idx_points_transactions_created
ON pointsTransactions (createdAt DESC);

-- 6. 用户交易记录全覆盖索引（包含所有常用查询字段）
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_composite
ON pointsTransactions (toUserId, fromUserId, type, status, createdAt DESC);
    `;
    console.log(indexSQL);

  } catch (error) {
    console.error('索引分析失败：', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行分析
analyzeIndexes();