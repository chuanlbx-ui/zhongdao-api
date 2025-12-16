import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const testUsers = [
  {
    id: 'cm0p3y7k000001qxrx7t8b1xr',
    openid: 'admin_openid_001',
    nickname: '系统管理员',
    phone: '13800138000',
    avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=random',
    level: 'DIRECTOR',
    status: 'ACTIVE',
    parentId: null,
    teamPath: null,
    teamLevel: 1,
    totalSales: 0,
    totalBottles: 0,
    directSales: 0,
    teamSales: 0,
    directCount: 0,
    teamCount: 0,
    pointsBalance: 100000,
    pointsFrozen: 0,
    referralCode: 'ADMIN01',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1xs',
    openid: 'user_001',
    nickname: '张三',
    phone: '13800138001',
    avatarUrl: 'https://ui-avatars.com/api/?name=张三&background=1890ff',
    level: 'VIP',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xr',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr',
    teamLevel: 2,
    totalSales: 5000,
    totalBottles: 50,
    directSales: 5000,
    teamSales: 5000,
    directCount: 5,
    teamCount: 10,
    pointsBalance: 1000,
    pointsFrozen: 0,
    referralCode: 'USER001',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1xt',
    openid: 'user_002',
    nickname: '李四',
    phone: '13800138002',
    avatarUrl: 'https://ui-avatars.com/api/?name=李四&background=52c41a',
    level: 'VIP',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xr',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr',
    teamLevel: 2,
    totalSales: 3000,
    totalBottles: 30,
    directSales: 3000,
    teamSales: 3000,
    directCount: 3,
    teamCount: 6,
    pointsBalance: 800,
    pointsFrozen: 0,
    referralCode: 'USER002',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1xu',
    openid: 'user_003',
    nickname: '王五',
    phone: '13800138003',
    avatarUrl: 'https://ui-avatars.com/api/?name=王五&background=faad14',
    level: 'STAR_1',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xr',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr',
    teamLevel: 2,
    totalSales: 15000,
    totalBottles: 150,
    directSales: 15000,
    teamSales: 15000,
    directCount: 15,
    teamCount: 30,
    pointsBalance: 3000,
    pointsFrozen: 0,
    referralCode: 'USER003',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1xv',
    openid: 'user_004',
    nickname: '赵六',
    phone: '13800138004',
    avatarUrl: 'https://ui-avatars.com/api/?name=赵六&background=faad14',
    level: 'STAR_1',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xr',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr',
    teamLevel: 2,
    totalSales: 12000,
    totalBottles: 120,
    directSales: 12000,
    teamSales: 12000,
    directCount: 12,
    teamCount: 25,
    pointsBalance: 2500,
    pointsFrozen: 0,
    referralCode: 'USER004',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1xw',
    openid: 'user_005',
    nickname: '钱七',
    phone: '13800138005',
    avatarUrl: 'https://ui-avatars.com/api/?name=钱七&background=13c2c2',
    level: 'STAR_2',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xr',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr',
    teamLevel: 2,
    totalSales: 50000,
    totalBottles: 500,
    directSales: 50000,
    teamSales: 50000,
    directCount: 25,
    teamCount: 60,
    pointsBalance: 8000,
    pointsFrozen: 0,
    referralCode: 'USER005',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1xx',
    openid: 'user_006',
    nickname: '孙八',
    phone: '13800138006',
    avatarUrl: 'https://ui-avatars.com/api/?name=孙八&background=13c2c2',
    level: 'STAR_2',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xr',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr',
    teamLevel: 2,
    totalSales: 45000,
    totalBottles: 450,
    directSales: 45000,
    teamSales: 45000,
    directCount: 20,
    teamCount: 50,
    pointsBalance: 7000,
    pointsFrozen: 0,
    referralCode: 'USER006',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1xy',
    openid: 'user_007',
    nickname: '周九',
    phone: '13800138007',
    avatarUrl: 'https://ui-avatars.com/api/?name=周九&background=52c41a',
    level: 'STAR_3',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xr',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr',
    teamLevel: 2,
    totalSales: 120000,
    totalBottles: 1200,
    directSales: 120000,
    teamSales: 120000,
    directCount: 40,
    teamCount: 100,
    pointsBalance: 15000,
    pointsFrozen: 0,
    referralCode: 'USER007',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1xz',
    openid: 'user_008',
    nickname: '吴十',
    phone: '13800138008',
    avatarUrl: 'https://ui-avatars.com/api/?name=吴十&background=8c8c8c',
    level: 'NORMAL',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xs',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr,cm0p3y7k000001qxrx7t8b1xs',
    teamLevel: 3,
    totalSales: 500,
    totalBottles: 5,
    directSales: 500,
    teamSales: 500,
    directCount: 1,
    teamCount: 2,
    pointsBalance: 100,
    pointsFrozen: 0,
    referralCode: 'USER008',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1y0',
    openid: 'user_009',
    nickname: '郑十一',
    phone: '13800138009',
    avatarUrl: 'https://ui-avatars.com/api/?name=郑十一&background=8c8c8c',
    level: 'NORMAL',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xs',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr,cm0p3y7k000001qxrx7t8b1xs',
    teamLevel: 3,
    totalSales: 300,
    totalBottles: 3,
    directSales: 300,
    teamSales: 300,
    directCount: 0,
    teamCount: 1,
    pointsBalance: 50,
    pointsFrozen: 0,
    referralCode: 'USER009',
  },
  {
    id: 'cm0p3y7k000001qxrx7t8b1y1',
    openid: 'user_010',
    nickname: '林十二',
    phone: '13800138010',
    avatarUrl: 'https://ui-avatars.com/api/?name=林十二&background=8c8c8c',
    level: 'NORMAL',
    status: 'ACTIVE',
    parentId: 'cm0p3y7k000001qxrx7t8b1xs',
    teamPath: 'cm0p3y7k000001qxrx7t8b1xr,cm0p3y7k000001qxrx7t8b1xs',
    teamLevel: 3,
    totalSales: 800,
    totalBottles: 8,
    directSales: 800,
    teamSales: 800,
    directCount: 2,
    teamCount: 4,
    pointsBalance: 150,
    pointsFrozen: 0,
    referralCode: 'USER010',
  },
]

async function createTestUsers() {
  console.log('🚀 开始创建测试用户...')

  try {
    // 清理现有测试用户
    console.log('🗑️ 清理现有测试用户...')
    await prisma.users.deleteMany({
      where: {
        openid: {
          in: testUsers.map(u => u.openid)
        }
      }
    })

    // 创建新用户
    console.log('👥 创建测试用户...')
    for (const userData of testUsers) {
      const user = await prisma.users.create({
        data: {
          ...userData,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
      console.log(`  ✓ 创建用户: ${user.nickname} (${user.level})`)
    }

    // 统计用户数量
    const totalUsers = await prisma.users.count()
    console.log(`\n✅ 创建完成！总用户数: ${totalUsers}`)

    // 统计各等级用户数
    const levelStats = await prisma.users.groupBy({
      by: ['level'],
      _count: { level: true }
    })

    console.log('\n📊 用户等级分布:')
    levelStats.forEach(stat => {
      console.log(`  ${stat.level}: ${stat._count.level} 人`)
    })

  } catch (error) {
    console.error('❌ 创建失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createTestUsers()
}

export { createTestUsers, testUsers }