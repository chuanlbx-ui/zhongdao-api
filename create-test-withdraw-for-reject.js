const { PrismaClient } = require('@prisma/client');

async function createTestWithdrawForReject() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('🔧 创建用于拒绝测试的提现申请...\n');

    // 获取管理员用户
    const adminUser = await prisma.users.findFirst({
      where: { phone: '18800000001' }
    });

    if (!adminUser) {
      console.log('❌ 管理员用户不存在');
      return;
    }

    // 创建新的佣金记录
    const commission = await prisma.pointsTransactions.create({
      data: {
        id: `cmi${Date.now()}`,
        transactionNo: `TXN${Date.now()}`,
        toUserId: adminUser.id,
        amount: 500,
        balanceBefore: 900,
        balanceAfter: 1400,
        type: 'COMMISSION',
        description: '测试佣金记录 - 拒绝用',
        status: 'COMPLETED',
        metadata: JSON.stringify({
          orderId: 'test_order_456',
          commissionRate: 0.1,
          commissionLevel: 1,
          orderAmount: 5000
        })
      }
    });

    console.log('✅ 佣金记录创建成功:', commission.id);

    // 创建提现申请
    const withdrawId = `wd${Date.now()}`;
    const withdrawal = await prisma.pointsTransactions.create({
      data: {
        id: withdrawId,
        transactionNo: `WDN${Date.now()}`,
        toUserId: adminUser.id,
        amount: -50,
        balanceBefore: 1400,
        balanceAfter: 1350,
        type: 'WITHDRAW',
        description: '测试提现申请 - 拒绝用',
        status: 'PENDING',
        metadata: JSON.stringify({
          withdrawMethod: 'WECHAT',
          accountInfo: {
            wechatId: 'test_wechat_id'
          },
          commissionIds: [commission.id]
        })
      }
    });

    console.log('✅ 提现申请创建成功:', withdrawal.id);
    console.log('现在可以测试拒绝功能:');
    console.log(`curl -X POST http://localhost:3000/api/v1/commission/withdrawals/${withdrawal.id}/reject \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0YWRtaW4wMDEiLCJzY29wZSI6WyJhY3RpdmUiLCJ1c2VyIl0sInJvbGUiOiJBRE1JTiIsImxldmVsIjoiRElSRUNUT1IiLCJvcGVuaWQiOiJhZG1pbl9vcGVuaWRfMTIzNDUiLCJuaWNrbmFtZSI6Iua1i-ivleeuoeeQhuWRmCIsImlhdCI6MTc2NDk4NTQ5MywiZXhwIjoxNzY1MDcxODkzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.9KDE2B7N9eYfe_2eLnv-ZTACrgg-qothp1qe6-yFKgY" \\
  -d '{"reason": "资料不完整，请重新申请"}'`);

  } catch (error) {
    console.error('❌ 创建失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestWithdrawForReject();