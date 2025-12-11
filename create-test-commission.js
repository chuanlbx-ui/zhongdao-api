const { PrismaClient } = require('@prisma/client');

async function createTestCommission() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('🔧 创建测试佣金记录...\n');

    // 1. 创建或获取管理员用户
    let adminUser = await prisma.users.findFirst({
      where: { phone: '18800000001' }
    });

    if (!adminUser) {
      console.log('创建管理员用户...');
      adminUser = await prisma.users.create({
        data: {
          id: 'cmi4admin001',
          phone: '18800000001',
          openid: 'admin_openid_12345',
          nickname: '测试管理员',
          level: 'DIRECTOR',
          role: 'ADMIN',
          status: 'ACTIVE',
          teamPath: '/cmi4admin001/',
          userNumber: 'ADMIN001',
          passwordHash: '$2a$10$example.password.hash',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    console.log('管理员用户:', adminUser.id);

    // 2. 创建测试佣金记录
    const commission = await prisma.pointsTransactions.create({
      data: {
        id: `cmi${Date.now()}`,
        transactionNo: `TXN${Date.now()}`,
        toUserId: adminUser.id,
        amount: 1000,
        balanceBefore: 0,
        balanceAfter: 1000,
        type: 'COMMISSION',
        description: '测试佣金记录',
        status: 'COMPLETED',
        metadata: JSON.stringify({
          orderId: 'test_order_123',
          commissionRate: 0.1,
          commissionLevel: 1,
          orderAmount: 10000
        })
      }
    });

    console.log('✅ 佣金记录创建成功:', commission.id);
    console.log('金额:', commission.amount);
    console.log('状态:', commission.status);

    // 3. 创建提现申请
    const withdrawId = `wd${Date.now()}`;
    const withdrawal = await prisma.pointsTransactions.create({
      data: {
        id: withdrawId,
        transactionNo: `WDN${Date.now()}`,
        toUserId: adminUser.id,
        amount: -100,
        balanceBefore: 1000,
        balanceAfter: 900,
        type: 'WITHDRAW',
        description: '测试提现申请',
        status: 'PENDING',
        metadata: JSON.stringify({
          withdrawMethod: 'BANK',
          accountInfo: {
            bankName: '测试银行',
            accountNumber: '1234567890123456789',
            accountName: '测试用户'
          },
          commissionIds: [commission.id]
        })
      }
    });

    console.log('✅ 提现申请创建成功:', withdrawal.id);
    console.log('提现金额:', Math.abs(withdrawal.amount));
    console.log('状态:', withdrawal.status);

    console.log('\n🎯 测试数据创建完成！');
    console.log('提现申请ID:', withdrawal.id);
    console.log('现在可以使用以下命令测试批准:');
    console.log(`curl -X POST http://localhost:3000/api/v1/commission/withdrawals/${withdrawal.id}/approve \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0YWRtaW4wMDEiLCJzY29wZSI6WyJhY3RpdmUiLCJ1c2VyIl0sInJvbGUiOiJBRE1JTiIsImxldmVsIjoiRElSRUNUT1IiLCJvcGVuaWQiOiJhZG1pbl9vcGVuaWRfMTIzNDUiLCJuaWNrbmFtZSI6Iua1i-ivleeuoeeQhuWRmCIsImlhdCI6MTc2NDk4NTQ5MywiZXhwIjoxNzY1MDcxODkzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.9KDE2B7N9eYfe_2eLnv-ZTACrgg-qothp1qe6-yFKgY" \\
  -d '{"remark": "测试批准", "transactionId": "TXN123456789"}'`);

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error.message);
    console.error('详细错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestCommission();