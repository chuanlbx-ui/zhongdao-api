import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function initDatabase() {
  console.log('🚀 初始化数据库数据...');

  try {
    // 创建系统配置
    console.log('创建系统配置...');
    const configs = [
      {
        id: '001',
        category: 'user',
        key: 'defaultLevel',
        value: 'NORMAL',
        description: '默认用户等级',
        isActive: true
      },
      {
        id: '002',
        category: 'commission',
        key: 'rate',
        value: '0.1',
        description: '默认佣金比例',
        isActive: true
      },
      {
        id: '003',
        category: 'points',
        key: 'exchangeRate',
        value: '100',
        description: '积分兑换比例',
        isActive: true
      }
    ];

    for (const config of configs) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: config,
        create: {
          ...config,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    // 创建测试用户
    console.log('创建测试用户...');
    const users = [
      {
        id: 'admin-001',
        mobile: '13800138000',
        wechatOpenId: 'admin_openid',
        nickname: '系统管理员',
        level: 'ADMIN',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        password: createHash('sha256').update('admin123456').digest('hex')
      },
      {
        id: 'test-001',
        mobile: '13800138001',
        wechatOpenId: 'test_openid_1',
        nickname: '测试用户1',
        level: 'NORMAL',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        password: createHash('sha256').update('test123456').digest('hex')
      },
      {
        id: 'test-002',
        mobile: '13800138002',
        wechatOpenId: 'test_openid_2',
        nickname: '测试用户2',
        level: 'VIP',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        password: createHash('sha256').update('test123456').digest('hex')
      },
      {
        id: 'test-003',
        mobile: '13800138003',
        wechatOpenId: 'test_openid_3',
        nickname: '测试用户3',
        level: 'STAR_1',
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        password: createHash('sha256').update('test123456').digest('hex')
      }
    ];

    for (const user of users) {
      await prisma.user.upsert({
        where: { mobile: user.mobile },
        update: user,
        create: {
          ...user,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    console.log('✅ 数据库初始化成功！');
    console.log('创建了 ' + users.length + ' 个用户');
    console.log('创建了 ' + configs.length + ' 个系统配置');

  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default initDatabase;