const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

async function debugUserToken() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password'
      }
    }
  });

  try {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc';

    console.log('1. 解码JWT token:');
    const decoded = jwt.decode(token);
    console.log('Token内容:', decoded);

    console.log('\n2. 查询数据库用户信息:');
    const userId = decoded.sub;
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (user) {
      console.log('用户信息:', {
        id: user.id,
        phone: user.phone,
        level: user.level,
        status: user.status
      });
      console.log('注意：用户表没有role字段！');
    }

    console.log('\n3. 分析问题:');
    console.log('- JWT token中有role字段: USER');
    console.log('- 但数据库users表没有role字段');
    console.log('- shops路由中req.user!.role会导致undefined错误');

  } catch (error) {
    console.error('调试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUserToken();