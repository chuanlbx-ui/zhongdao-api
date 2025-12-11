import { PrismaClient } from '@prisma/client'
import { TestDataGenerator } from '../src/test-data/generators'
import { COMPREHENSIVE_CONFIG, MINIMAL_CONFIG, STANDARD_CONFIG } from '../src/test-data/configs/comprehensive.config'
import { wutongBenefitGenerator } from '../src/test-data/scenarios/wutong-benefit'
import { userLevelUpgradeGenerator } from '../src/test-data/scenarios/user-level-upgrade'
import { createId } from '@paralleldrive/cuid2'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * 获取命令行参数指定的配置
 */
function getTestConfig() {
  const args = process.argv.slice(2)
  const configType = args.find(arg => arg.startsWith('--config='))?.split('=')[1] || 'comprehensive'

  switch (configType) {
    case 'minimal':
      return MINIMAL_CONFIG
    case 'standard':
      return STANDARD_CONFIG
    case 'comprehensive':
    default:
      return COMPREHENSIVE_CONFIG
  }
}

/**
 * 获取是否生成特殊场景
 */
function getScenarioFlags() {
  const args = process.argv.slice(2)
  return {
    withWutongBenefit: args.includes('--with-wutong'),
    withLevelUpgrade: args.includes('--with-upgrade')
  }
}

const TEST_CONFIG = getTestConfig()
const SCENARIOS = getScenarioFlags()

// 清理数据库
async function cleanDatabase() {
  console.log('🗑️  清理现有测试数据...')

  // 按依赖顺序删除数据
  const tablenames = [
    'notificationChannels',
    'notifications',
    'pointsTransactions',
    'orderItems',
    'orders',
    'inventoryItems',
    'products',
    'productCategories',
    'shops',
    'users'
  ]

  for (const tablename of tablenames) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ${tablename};`)
      console.log(`  ✓ 清理表: ${tablename}`)
    } catch (error) {
      console.log(`  ⚠️ 跳过表: ${tablename} (可能不存在)`)
    }
  }

  // 重置自增ID
  try {
    await prisma.$executeRawUnsafe(`
      DELETE FROM sqlite_sequence WHERE name='sqlite_autoindex_Users_1';
    `)
  } catch (error) {
    // 忽略错误
  }

  console.log('✅ 数据库清理完成')
}

/**
 * 创建默认管理员用户
 */
async function createDefaultAdmin() {
  console.log('\n👑 创建默认管理员用户...')

  const adminPassword = await bcrypt.hash('admin123', 10)

  const admin = await prisma.users.create({
    data: {
      id: createId(),
      openid: 'admin_openid_001',
      nickname: '系统管理员',
      avatarUrl: 'https://ui-avatars.com/api/?name=Admin&background=random',
      phone: '13800138000',
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
      cloudShopLevel: 6,
      hasWutongShop: true,
      pointsBalance: 100000,
      pointsFrozen: 0,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      referralCode: 'ADMIN01'
    }
  })

  console.log(`  ✓ 管理员创建成功: ${admin.nickname}`)
  console.log(`  - 用户ID: ${admin.id}`)
  console.log(`  - OpenID: ${admin.openid}`)
  console.log(`  - 推荐码: ${admin.referralCode}`)

  return admin
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始生成测试数据...')
  console.log(`📊 配置类型: ${process.argv.find(arg => arg.startsWith('--config='))?.split('=')[1] || 'comprehensive'}`)
  console.log(`📋 数据规模:`, {
    用户总数: Object.values(TEST_CONFIG.userLevels).reduce((a, b) => a + b, 0),
    店铺总数: TEST_CONFIG.shops.cloud + TEST_CONFIG.shops.wutong,
    商品分类: TEST_CONFIG.products.categories,
    商品总数: TEST_CONFIG.products.products,
    订单总数: Object.values(TEST_CONFIG.orders).reduce((a, b) => a + b, 0)
  })

  try {
    // 1. 清理数据库
    await cleanDatabase()

    // 2. 创建默认管理员
    const admin = await createDefaultAdmin()

    // 3. 生成基础测试数据
    console.log('\n📦 生成基础测试数据...')
    const generator = new TestDataGenerator(TEST_CONFIG)
    await generator.generateAll()

    // 4. 生成特殊场景数据（如果指定）
    if (SCENARIOS.withWutongBenefit) {
      console.log('\n🎁 生成五通店权益场景...')
      await wutongBenefitGenerator.createWutongShopOpenings(5)
      await wutongBenefitGenerator.generateScenario()
    }

    if (SCENARIOS.withLevelUpgrade) {
      console.log('\n📈 生成用户升级场景...')
      await userLevelUpgradeGenerator.generateScenario()
      await userLevelUpgradeGenerator.generateTeamPerformance()
      await userLevelUpgradeGenerator.generateReferralRelations()
    }

    // 5. 生成测试报告
    await generateReport()

    console.log('\n🎉 测试数据生成完成！')
    console.log('\n📋 测试账号信息：')
    console.log('管理员账号：')
    console.log('  - 用户名: admin_openid_001')
    console.log('  - 密码: admin123')
    console.log('\n快速测试命令：')
    console.log('  npm run test:api')
    console.log('  npm run test:comprehensive')

  } catch (error) {
    console.error('❌ 生成测试数据失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * 生成测试报告
 */
async function generateReport() {
  console.log('\n📊 生成测试报告...')

  const stats = await prisma.$queryRaw`
    SELECT
      'users' as table_name, COUNT(*) as count FROM User
    UNION ALL
    SELECT
      'shops' as table_name, COUNT(*) as count FROM Shop
    UNION ALL
    SELECT
      'products' as table_name, COUNT(*) as count FROM Product
    UNION ALL
    SELECT
      'orders' as table_name, COUNT(*) as count FROM \`Order\`
    UNION ALL
    SELECT
      'transactions' as table_name, COUNT(*) as count FROM PointsTransaction
    UNION ALL
    SELECT
      'notifications' as table_name, COUNT(*) as count FROM Notification
    UNION ALL
    SELECT
      'inventory' as table_name, COUNT(*) as count FROM InventoryItem
    UNION ALL
    SELECT
      'categories' as table_name, COUNT(*) as count FROM ProductCategory
  ` as Array<{ table_name: string; count: bigint }>

  console.log('\n📈 数据统计：')
  stats.forEach(({ table_name, count }) => {
    const emoji = {
      users: '👤',
      shops: '🏪',
      products: '🛍️',
      orders: '📦',
      transactions: '💰',
      notifications: '🔔',
      inventory: '📊',
      categories: '📂'
    }[table_name] || '📋'

    console.log(`  ${emoji} ${table_name}: ${count}`)
  })

  // 用户层级统计
  const userStats = await prisma.users.groupBy({
    by: ['level'],
    _count: { level: true }
  })

  console.log('\n👥 用户层级分布：')
  userStats.forEach(group => {
    console.log(`  ${group.level}: ${group._count.level}人`)
  })

  // 店铺类型统计
  const shopStats = await prisma.shops.groupBy({
    by: ['shopType'],
    _count: { shopType: true }
  })

  console.log('\n🏪 店铺类型分布：')
  shopStats.forEach(group => {
    console.log(`  ${group.shopType}: ${group._count.shopType}个`)
  })

  console.log('\n✅ 测试报告生成完成')
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}