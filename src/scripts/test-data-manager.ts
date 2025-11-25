#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { TestDataGenerator } from '../test-data/generators'
import type { TestDataConfig } from '../test-data/types'
import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'

const prisma = new PrismaClient()

interface ManagerOptions {
  clean?: boolean
  config?: string
  verbose?: boolean
  dryRun?: boolean
}

// 默认配置
const DEFAULT_CONFIGS = {
  minimal: {
    userLevels: { normal: 5, vip: 3, star1: 2, star2: 1, star3: 1, star4: 0, star5: 0, director: 1 },
    shops: { cloud: 3, wutong: 1 },
    products: { categories: 3, products: 10, variantsPerProduct: 2 },
    orders: { pending: 5, paid: 8, delivered: 10, cancelled: 2 },
    inventory: { items: 20, lowStockThreshold: 5 },
  },
  standard: {
    userLevels: { normal: 20, vip: 10, star1: 8, star2: 5, star3: 3, star4: 2, star5: 1, director: 1 },
    shops: { cloud: 10, wutong: 5 },
    products: { categories: 5, products: 50, variantsPerProduct: 3 },
    orders: { pending: 15, paid: 25, delivered: 40, cancelled: 10 },
    inventory: { items: 80, lowStockThreshold: 10 },
  },
  comprehensive: {
    userLevels: { normal: 100, vip: 50, star1: 30, star2: 20, star3: 15, star4: 10, star5: 5, director: 3 },
    shops: { cloud: 50, wutong: 25 },
    products: { categories: 15, products: 200, variantsPerProduct: 4 },
    orders: { pending: 60, paid: 100, delivered: 160, cancelled: 40 },
    inventory: { items: 400, lowStockThreshold: 15 },
  }
}

class TestDataManager {
  private verbose: boolean = false
  private dryRun: boolean = false

  constructor(private options: ManagerOptions = {}) {
    this.verbose = options.verbose || false
    this.dryRun = options.dryRun || false
  }

  log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    if (!this.verbose && type === 'info') return

    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red
    }

    console.log(colors[type](`ℹ ${message}`))
  }

  // 获取当前数据统计
  async getDataStats() {
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

    return stats.reduce((acc, { table_name, count }) => {
      acc[table_name] = Number(count)
      return acc
    }, {} as Record<string, number>)
  }

  // 清理数据库
  async cleanDatabase() {
    if (this.dryRun) {
      this.log('[DRY RUN] 将要清理所有测试数据', 'warning')
      return
    }

    this.log('开始清理测试数据...', 'info')

    const tablenames = [
      'NotificationChannel', 'Notification',
      'PointsTransaction', 'OrderItem', 'PurchaseOrder', 'Order',
      'InventoryItem', 'ProductVariant', 'ProductTag', 'Product',
      'ProductCategory', 'Shop', 'User'
    ]

    for (const tablename of tablenames) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM ${tablename};`)
        this.log(`清理表: ${tablename}`, 'success')
      } catch (error) {
        this.log(`跳过表: ${tablename} (可能不存在)`, 'warning')
      }
    }

    this.log('数据库清理完成', 'success')
  }

  // 生成测试数据
  async generateTestData(configName: keyof typeof DEFAULT_CONFIGS = 'standard') {
    const config = DEFAULT_CONFIGS[configName]
    this.log(`使用配置: ${configName}`, 'info')
    this.log(`预计生成数据量:`, 'info')
    this.log(`  - 用户: ${Object.values(config.userLevels).reduce((a, b) => a + b, 0)}`, 'info')
    this.log(`  - 店铺: ${config.shops.cloud + config.shops.wutong}`, 'info')
    this.log(`  - 商品: ${config.products.products}`, 'info')
    this.log(`  - 订单: ${config.orders.pending + config.orders.paid + config.orders.delivered + config.orders.cancelled}`, 'info')

    if (this.dryRun) {
      this.log('[DRY RUN] 测试数据生成完成（模拟）', 'success')
      return
    }

    // 运行种子脚本
    await this.runSeedScript(config)

    this.log('测试数据生成完成', 'success')
  }

  // 验证数据完整性
  async validateData() {
    this.log('开始数据完整性验证...', 'info')

    const stats = await this.getDataStats()

    const validations = [
      { name: '用户', count: stats.users || 0, min: 1 },
      { name: '商品分类', count: stats.categories || 0, min: 1 },
      { name: '商品', count: stats.products || 0, min: 1 },
    ]

    let issues = 0

    for (const validation of validations) {
      if (validation.count < validation.min) {
        this.log(`${validation.name}数量不足: ${validation.count} < ${validation.min}`, 'error')
        issues++
      } else {
        this.log(`${validation.name}验证通过: ${validation.count}`, 'success')
      }
    }

    // 检查用户层级关系
    const userHierarchy = await prisma.user.groupBy({
      by: ['level'],
      _count: { level: true }
    })

    this.log('用户层级分布:', 'info')
    userHierarchy.forEach(group => {
      this.log(`  ${group.level}: ${group._count.level}人`, 'info')
    })

    // 检查店铺类型分布
    const shopTypes = await prisma.shop.groupBy({
      by: ['type'],
      _count: { type: true }
    })

    this.log('店铺类型分布:', 'info')
    shopTypes.forEach(group => {
      this.log(`  ${group.type}: ${group._count.type}个`, 'info')
    })

    if (issues === 0) {
      this.log('数据完整性验证通过', 'success')
    } else {
      this.log(`发现 ${issues} 个数据完整性问题`, 'error')
    }

    return issues === 0
  }

  // 生成测试报告
  async generateReport() {
    const stats = await this.getDataStats()

    this.log('=== 测试数据报告 ===', 'info')
    this.log(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 'info')
    this.log('', 'info')

    this.log('📊 数据统计:', 'info')
    Object.entries(stats).forEach(([table, count]) => {
      const emoji = {
        users: '👤',
        shops: '🏪',
        products: '🛍️',
        orders: '📦',
        transactions: '💰',
        notifications: '🔔',
        inventory: '📊',
        categories: '📂'
      }[table] || '📋'

      this.log(`  ${emoji} ${table}: ${count}`, 'info')
    })

    // 获取一些示例数据
    const sampleUsers = await prisma.user.findMany({
      select: { nickname: true, level: true, phone: true },
      take: 5,
      orderBy: { createdAt: 'desc' }
    })

    this.log('', 'info')
    this.log('👥 示例用户:', 'info')
    sampleUsers.forEach(user => {
      this.log(`  ${user.nickname} (${user.level}) - ${user.phone}`, 'info')
    })
  }

  // 创建特定场景的测试数据
  async createScenario(scenario: string) {
    this.log(`创建场景测试数据: ${scenario}`, 'info')

    switch (scenario) {
      case 'new-user':
        await this.createNewUserScenario()
        break
      case 'shop-owner':
        await this.createShopOwnerScenario()
        break
      case 'vip-customer':
        await this.createVipCustomerScenario()
        break
      case 'full-hierarchy':
        await this.createFullHierarchyScenario()
        break
      default:
        this.log(`未知场景: ${scenario}`, 'error')
    }
  }

  private async createNewUserScenario() {
    const generator = new TestDataGenerator()
    const userData = generator.generateUsers().slice(0, 5)

    for (const data of userData) {
      if (this.dryRun) {
        this.log(`[DRY RUN] 创建用户: ${data.user.nickname}`, 'warning')
        continue
      }

      await prisma.user.create({
        data: {
          ...data.user,
          id: data.user.id,
          passwordHash: await import('bcryptjs').then(bcrypt => bcrypt.hash('password123', 10)),
          isAdmin: false,
          emailVerified: true,
          phoneVerified: true,
          kycVerified: false,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    this.log('新用户场景数据创建完成', 'success')
  }

  private async createShopOwnerScenario() {
    // 创建达到开店级别的用户
    const generator = new TestDataGenerator()
    const userData = generator.generateUsers().filter(u =>
      u.user.level === 'STAR_1' || u.user.level === 'STAR_3'
    )

    for (const data of userData) {
      if (this.dryRun) {
        this.log(`[DRY RUN] 创建店主用户: ${data.user.nickname}`, 'warning')
        continue
      }

      await prisma.user.create({
        data: {
          ...data.user,
          id: data.user.id,
          passwordHash: await import('bcryptjs').then(bcrypt => bcrypt.hash('password123', 10)),
          isAdmin: false,
          emailVerified: true,
          phoneVerified: true,
          kycVerified: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    this.log('店主场景数据创建完成', 'success')
  }

  private async createVipCustomerScenario() {
    const generator = new TestDataGenerator()
    const userData = generator.generateUsers().filter(u => u.user.level === 'VIP')

    for (const data of userData) {
      if (this.dryRun) {
        this.log(`[DRY RUN] 创建VIP用户: ${data.user.nickname}`, 'warning')
        continue
      }

      await prisma.user.create({
        data: {
          ...data.user,
          id: data.user.id,
          passwordHash: await import('bcryptjs').then(bcrypt => bcrypt.hash('password123', 10)),
          isAdmin: false,
          emailVerified: true,
          phoneVerified: true,
          kycVerified: true,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    this.log('VIP客户场景数据创建完成', 'success')
  }

  private async runSeedScript(config: TestDataConfig) {
    const { TestDataGenerator } = await import('../test-data/generators')
    const { createId } = await import('@paralleldrive/cuid2')
    const bcrypt = await import('bcryptjs')

    // 创建数据生成器
    const generator = new TestDataGenerator(config)

    // 生成用户数据
    this.log('👥 生成用户数据...', 'info')
    const usersData = generator.generateUsers()

    const createdUsers = []
    for (const userData of usersData) {
      const user = await prisma.user.create({
        data: {
          id: userData.user.id,
          openid: userData.user.openid,
          nickname: userData.user.nickname,
          avatarUrl: userData.user.avatarUrl,
          phone: userData.user.phone,
          referralCode: userData.user.referralCode,
          level: userData.user.level,
          status: userData.user.status,
          parentId: userData.user.parentId,
          teamPath: userData.user.teamPath,
          teamLevel: userData.user.teamLevel,
          totalSales: userData.user.totalSales,
          totalBottles: userData.user.totalBottles,
          directSales: userData.user.directSales,
          teamSales: userData.user.teamSales,
          directCount: userData.user.directCount,
          teamCount: userData.user.teamCount,
          cloudShopLevel: userData.user.cloudShopLevel,
          hasWutongShop: userData.user.hasWutongShop,
          pointsBalance: userData.user.pointsBalance,
          pointsFrozen: userData.user.pointsFrozen,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
      createdUsers.push(user)
    }

    this.log(`✓ 创建了 ${createdUsers.length} 个用户`, 'success')

    // 生成商品分类
    this.log('📂 生成商品分类...', 'info')
    const categories = [
      { id: createId(), name: '护肤品', level: 1, parentId: null, icon: 'skincare', description: '面部护理、身体护理产品' },
      { id: createId(), name: '保健品', level: 1, parentId: null, icon: 'health', description: '营养保健、健康产品' },
      { id: createId(), name: '食品饮料', level: 1, parentId: null, icon: 'food', description: '休闲食品、饮品饮料' },
    ]

    const createdCategories = []
    for (const category of categories) {
      const created = await prisma.productCategory.create({
        data: {
          ...category,
          isActive: true,
          sortOrder: categories.indexOf(category),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
      createdCategories.push(created)
    }

    this.log(`✓ 创建了 ${createdCategories.length} 个商品分类`, 'success')

    // 生成商品数据
    this.log('🛍️  生成商品数据...', 'info')
    const productsData = generator.generateProducts().slice(0, config.products.products)

    const createdProducts = []
    for (const productData of productsData) {
      const category = createdCategories[Math.floor(Math.random() * createdCategories.length)]
      const creator = createdUsers[Math.floor(Math.random() * createdUsers.length)]

      const product = await prisma.product.create({
        data: {
          id: createId(),
          name: productData.product.name,
          sku: productData.product.sku,
          description: productData.product.description,
          basePrice: productData.product.basePrice,
          originalPrice: productData.product.originalPrice,
          costPrice: productData.product.costPrice,
          status: productData.product.status,
          categoryId: category.id,
          images: productData.product.images,
          specifications: productData.product.specifications,
          shopType: productData.product.shopType,
          createdBy: creator.id,
          updatedBy: creator.id,
          tags: productData.product.tags,
          isActive: true,
          featured: Math.random() > 0.8,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
      createdProducts.push(product)
    }

    this.log(`✓ 创建了 ${createdProducts.length} 个商品`, 'success')
  }

  private async createFullHierarchyScenario() {
    const generator = new TestDataGenerator()
    const userData = generator.generateUsers()

    for (const data of userData) {
      if (this.dryRun) {
        this.log(`[DRY RUN] 创建层级用户: ${data.user.nickname} (${data.user.level})`, 'warning')
        continue
      }

      await prisma.user.create({
        data: {
          ...data.user,
          id: data.user.id,
          passwordHash: await import('bcryptjs').then(bcrypt => bcrypt.hash('password123', 10)),
          isAdmin: false,
          emailVerified: true,
          phoneVerified: true,
          kycVerified: data.user.level !== 'NORMAL',
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    this.log('完整层级场景数据创建完成', 'success')
  }
}

// CLI 程序
const program = new Command()

program
  .name('test-data-manager')
  .description('中道商城测试数据管理工具')
  .version('1.0.0')

program
  .command('stats')
  .description('查看当前数据统计')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    const manager = new TestDataManager({ verbose: options.verbose })
    await manager.getDataStats()
    await manager.generateReport()
  })

program
  .command('clean')
  .description('清理所有测试数据')
  .option('-d, --dry-run', '模拟运行，不实际删除数据')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    const manager = new TestDataManager({ dryRun: options.dryRun, verbose: options.verbose })

    if (!options.dryRun) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: '确定要清理所有测试数据吗？此操作不可撤销！',
        default: false
      }])

      if (!confirm) {
        console.log(chalk.yellow('操作已取消'))
        return
      }
    }

    await manager.cleanDatabase()
  })

program
  .command('generate')
  .description('生成测试数据')
  .option('-c, --config <config>', '配置类型 (minimal|standard|comprehensive)', 'standard')
  .option('-d, --dry-run', '模拟运行，不实际生成数据')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    const manager = new TestDataManager({ dryRun: options.dryRun, verbose: options.verbose })
    await manager.generateTestData(options.config as keyof typeof DEFAULT_CONFIGS)
  })

program
  .command('validate')
  .description('验证数据完整性')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    const manager = new TestDataManager({ verbose: options.verbose })
    const isValid = await manager.validateData()
    process.exit(isValid ? 0 : 1)
  })

program
  .command('scenario')
  .description('创建特定场景的测试数据')
  .argument('<scenario>', '场景类型 (new-user|shop-owner|vip-customer|full-hierarchy)')
  .option('-d, --dry-run', '模拟运行')
  .option('-v, --verbose', '详细输出')
  .action(async (scenario, options) => {
    const manager = new TestDataManager({ dryRun: options.dryRun, verbose: options.verbose })
    await manager.createScenario(scenario)
  })

program
  .command('report')
  .description('生成测试数据报告')
  .option('-v, --verbose', '详细输出')
  .action(async (options) => {
    const manager = new TestDataManager({ verbose: options.verbose })
    await manager.generateReport()
  })

// 如果直接运行此脚本
if (require.main === module) {
  program.parse()
}

export { TestDataManager }