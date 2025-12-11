const { PrismaClient } = require('@prisma/client');

async function debugInventoryError() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    console.log('调试inventory模块500错误...\n');

    // 测试1: 检查inventoryStocks表结构
    console.log('1. 检查inventoryStocks表结构:');
    const sampleStock = await prisma.inventoryStocks.findFirst({
      select: {
        id: true,
        userId: true,
        productId: true,
        quantity: true,
        availableQuantity: true,
        reservedQuantity: true,
        warehouseType: true,
        cost: true
      }
    });
    console.log('✅ inventoryStocks表正常:', sampleStock ? '有数据' : '无数据');

    // 测试2: 检查inventoryLogs表结构
    console.log('\n2. 检查inventoryLogs表结构:');
    const schema = await prisma._dmmf.datamodel;
    const logsModel = schema.models.find(m => m.name === 'inventoryLogs');
    if (logsModel) {
      console.log('inventoryLogs字段:', logsModel.fields.map(f => f.name));
    }

    // 测试3: 尝试创建inventoryLog
    console.log('\n3. 测试创建inventoryLog:');
    try {
      const testLog = await prisma.inventoryLogs.create({
        data: {
          id: `test_${Date.now()}`,
          inventoryId: 'test_inventory',
          userId: 'test_user',
          type: 'MANUAL_IN',
          quantity: 10,
          beforeQuantity: 100,
          afterQuantity: 110,
          reason: '测试',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('✅ 创建成功:', testLog.id);
      // 清理测试数据
      await prisma.inventoryLogs.delete({ where: { id: testLog.id } });
    } catch (logError) {
      console.error('❌ 创建inventoryLog失败:', logError.message);
      console.error('错误详情:', logError.meta);
    }

    // 测试4: 检查用户角色
    console.log('\n4. 检查用户角色:');
    const testUser = await prisma.users.findFirst({
      where: { phone: '18800000001' },
      select: { id: true, role: true, level: true }
    });
    if (testUser) {
      console.log('用户角色:', testUser.role, '用户等级:', testUser.level);
    }

  } catch (e) {
    console.error('查询失败:', e);
  } finally {
    await prisma.$disconnect();
  }
}

debugInventoryError();