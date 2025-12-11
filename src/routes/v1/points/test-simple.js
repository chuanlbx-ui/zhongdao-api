// 创建一个极简的测试路由
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// 移除所有中间件，直接测试
app.get('/test-simple', async (req, res) => {
  console.log('请求到达');

  try {
    // 直接查询数据库
    const transactions = await prisma.pointsTransactions.findMany({
      where: {
        OR: [
          { fromUserId: 'xlexb35vac2jq40wngr1sfca' },
          { toUserId: 'xlexb35vac2jq40wngr1sfca' }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: 1,
          perPage: 5,
          total: transactions.length,
          totalPages: 1
        }
      }
    });
  } catch (error) {
    console.error('错误:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3002, () => {
  console.log('测试服务器在3002端口');

  // 立即测试
  fetch(`http://localhost:3002/test-simple`)
    .then(res => res.json())
    .then(data => {
      console.log('成功:', data);
      process.exit(0);
    })
    .catch(err => {
      console.error('失败:', err);
      process.exit(1);
    });
});