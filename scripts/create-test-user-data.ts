/**
 * 为测试账号创建完整的业务数据脚本
 * 目的：为测试用户(13800000001)创建足够的业务数据，以便消除认证相关的警告
 * 
 * 创建的数据包括：
 * 1. 订单数据（多个状态）
 * 2. 店铺数据（云店）
 * 3. 商品和规格数据
 * 4. 积分交易数据
 * 5. 库存数据
 */

import dotenv from 'dotenv'
import path from 'path'

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), '.env.local') })
dotenv.config({ path: path.join(process.cwd(), '.env.development') })

import { PrismaClient, ShopType, ShopStatus, ProductStatus, OrderStatus, TransactionType, TransactionStatus, WarehouseType } from '@prisma/client'
import { createId } from '@paralleldrive/cuid2'
import { faker } from '@faker-js/faker/locale/zh_CN'

const prisma = new PrismaClient()

const TEST_USER_PHONE = '13800000001'

async function findOrCreateTestUser() {
  console.log(`🔍 查找测试用户 ${TEST_USER_PHONE}...`)

  let user = await prisma.user.findUnique({
    where: { phone: TEST_USER_PHONE },
  })

  if (!user) {
    console.log(`⚠️  测试用户不存在，创建新用户...`)
    user = await prisma.user.create({
      data: {
        id: createId(),
        phone: TEST_USER_PHONE,
        nickname: '测试账号',
        level: 'STAR_3',
        status: 'ACTIVE',
        avatarUrl: faker.image.avatar(),
        openid: `test_openid_${Date.now()}`,
        referralCode: 'TEST001',
        pointsBalance: 10000,
        pointsFrozen: 0,
        totalSales: 0,
        totalBottles: 0,
        directSales: 0,
        teamSales: 0,
        directCount: 0,
        teamCount: 0,
        cloudShopLevel: 5,
        hasWutongShop: true,
        lastLoginAt: new Date(),
      },
    })
  }

  console.log(`✅ 找到或创建测试用户: ${user.id}`)
  return user
}

async function createProductCategory() {
  console.log('📂 创建商品分类...')

  let category = await prisma.productCategory.findFirst({
    where: { name: '测试商品分类' },
  })

  if (!category) {
    category = await prisma.productCategory.create({
      data: {
        id: createId(),
        name: '测试商品分类',
        level: 1,
        parentId: null,
        icon: 'test',
        description: '测试数据专用分类',
        isActive: true,
        sort: 0,
      },
    })
  }

  console.log(`✅ 创建了分类: ${category.name}`)
  return category
}

async function createTestUserShop(userId: string) {
  console.log('🏪 为测试用户创建店铺...')

  let shop = await prisma.shop.findFirst({
    where: {
      userId,
      shopName: '测试云店',
    },
  })

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        id: createId(),
        userId,
        shopType: 'CLOUD',
        shopLevel: 5,
        shopName: '测试云店',
        shopDescription: '这是测试账号的云店',
        contactName: '测试商户',
        contactPhone: '13800000099',
        address: faker.location.streetAddress(),
        totalSales: 50000,
        totalOrders: 100,
        totalRevenue: 50000,
        status: ShopStatus.ACTIVE,
      },
    })
  }

  console.log(`✅ 创建了店铺: ${shop.shopName}`)
  return shop
}

async function createTestUserProducts(userId: string, categoryId: string) {
  console.log('🛍️  为测试用户创建商品...')

  const existingProducts = await prisma.product.findMany({
    where: { categoryId, shopId: { not: null } },
    take: 1,
  })

  if (existingProducts.length > 0) {
    console.log(`✅ 已存在测试商品`)
    return existingProducts
  }

  const products: any[] = []
  const productCount = 5

  for (let i = 0; i < productCount; i++) {
    const code = `TEST-${Date.now()}-${i}-${createId()}`
    const sku = `SKU-TEST-${Date.now()}-${i}`

    const product = await prisma.product.create({
      data: {
        id: createId(),
        categoryId,
        name: `测试商品${i + 1}`,
        description: `这是测试商品${i + 1}的描述`,
        code,
        sku,
        basePrice: 100 + i * 50,
        totalStock: 100,
        minStock: 10,
        images: JSON.stringify([faker.image.url()]),
        videoUrl: null,
        status: ProductStatus.ACTIVE,
        isFeatured: false,
        sort: i,
      },
    })

    // 创建商品规格
    await prisma.productSpec.create({
      data: {
        id: createId(),
        productId: product.id,
        name: `规格1`,
        sku: `${sku}-1`,
        price: product.basePrice,
        stock: 100,
        minStock: 10,
        isActive: true,
        sort: 0,
      },
    })

    products.push(product)
  }

  console.log(`✅ 创建了 ${products.length} 个商品`)
  return products
}

async function createTestUserOrders(userId: string, products: any[]) {
  console.log('📦 为测试用户创建订单...')

  const statuses = [
    { status: 'PENDING' as const, count: 3 },
    { status: 'PAID' as const, count: 5 },
    { status: 'SHIPPED' as const, count: 7 },
    { status: 'DELIVERED' as const, count: 5 },
  ]

  const createdOrders: any[] = []
  let orderCount = 0

  for (const { status, count } of statuses) {
    for (let i = 0; i < count; i++) {
      const product = products[i % products.length]
      const itemPrice = product.basePrice + Math.random() * 100
      const quantity = Math.floor(Math.random() * 5) + 1
      const totalAmount = itemPrice * quantity

      const order = await prisma.order.create({
        data: {
          id: createId(),
          orderNo: `TEST-ORD-${Date.now()}-${orderCount++}`,
          totalAmount,
          discountAmount: 0,
          finalAmount: totalAmount,
          status: status as any,
          paymentStatus: status === 'PENDING' ? 'UNPAID' : 'PAID',
          buyerId: userId,
          type: 'RETAIL' as any,
        },
      })

      // 创建订单项
      await prisma.orderItem.create({
        data: {
          id: createId(),
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: itemPrice,
          totalPrice: itemPrice * quantity,
          finalPrice: itemPrice * quantity,
        },
      })

      createdOrders.push(order)
    }
  }

  console.log(`✅ 为测试用户创建了 ${createdOrders.length} 个订单`)
  return createdOrders
}

async function createTestUserTransactions(userId: string) {
  console.log('💰 为测试用户创建积分交易...')

  const transactions: any[] = []

  for (let i = 0; i < 10; i++) {
    const amount = Math.floor(Math.random() * 5000) + 100
    const transactionNo = `TXN-${createId()}`

    const transaction = await prisma.pointsTransaction.create({
      data: {
        id: createId(),
        transactionNo,
        fromUserId: i % 2 === 0 ? userId : null,
        toUserId: userId,
        amount,
        type: ['PURCHASE', 'TRANSFER', 'COMMISSION'][Math.floor(Math.random() * 3)] as any,
        description: faker.lorem.sentence(),
        metadata: JSON.stringify({ source: 'test' }),
        status: TransactionStatus.COMPLETED,
        balanceBefore: Math.random() * 10000,
        balanceAfter: Math.random() * 10000,
      },
    })
    transactions.push(transaction)
  }

  console.log(`✅ 为测试用户创建了 ${transactions.length} 个积分交易`)
  return transactions
}

async function createTestUserInventory(userId: string, products: any[]) {
  console.log('📊 为测试用户创建库存...')

  const inventory: any[] = []

  for (const product of products) {
    const item = await prisma.inventoryItem.create({
      data: {
        id: createId(),
        userId,
        productId: product.id,
        warehouseType: WarehouseType.LOCAL,
        quantity: Math.floor(Math.random() * 500) + 50,
        frozenQuantity: Math.floor(Math.random() * 20),
        minStock: 10,
      },
    })
    inventory.push(item)
  }

  console.log(`✅ 为测试用户创建了 ${inventory.length} 个库存项`)
  return inventory
}

async function main() {
  console.log('🚀 开始为测试账号创建完整业务数据...\n')

  try {
    // 1. 查找或创建测试用户
    const user = await findOrCreateTestUser()

    // 2. 创建商品分类
    const category = await createProductCategory()

    // 3. 创建店铺
    const shop = await createTestUserShop(user.id)

    // 4. 创建商品
    const products = await createTestUserProducts(user.id, category.id)

    // 5. 创建订单
    const orders = await createTestUserOrders(user.id, products)

    // 6. 创建积分交易
    const transactions = await createTestUserTransactions(user.id)

    // 7. 创建库存
    const inventory = await createTestUserInventory(user.id, products)

    console.log('\n🎉 测试账号业务数据创建完成！\n')
    console.log('📊 创建统计:')
    console.log(`   🏪 店铺: 1`)
    console.log(`   🛍️  商品: ${products.length}`)
    console.log(`   📦 订单: ${orders.length}`)
    console.log(`   💰 交易: ${transactions.length}`)
    console.log(`   📊 库存: ${inventory.length}`)
    console.log('\n✅ 现在重新运行前端测试，认证相关警告应该会大幅减少')
  } catch (error) {
    console.error('❌ 创建数据失败:', error)
    throw error
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
