import { PrismaClient } from '@prisma/client'
import { TestDataGenerator } from '../src/test-data/generators'
import type { TestDataConfig } from '../src/test-data/types'
import { createId } from '@paralleldrive/cuid2'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// 测试数据配置
const TEST_CONFIG: TestDataConfig = {
  userLevels: {
    normal: 50,
    vip: 20,
    star1: 15,
    star2: 10,
    star3: 8,
    star4: 5,
    star5: 3,
    director: 2,
  },
  shops: {
    cloud: 30,
    wutong: 15,
  },
  products: {
    categories: 10,
    products: 100,
    variantsPerProduct: 3,
  },
  orders: {
    pending: 30,
    paid: 50,
    delivered: 80,
    cancelled: 20,
  },
  inventory: {
    items: 200,
    lowStockThreshold: 10,
  },
}

// 清理数据库
async function cleanDatabase() {
  console.log('🗑️  清理现有测试数据...')

  // 按依赖顺序删除数据
  const tablenames = [
    'NotificationChannel',
    'Notification',
    'PointsTransaction',
    'OrderItem',
    'PurchaseOrder',
    'Order',
    'InventoryItem',
    'ProductVariant',
    'ProductTag',
    'Product',
    'ProductCategory',
    'Shop',
    'User'
  ]

  for (const tablename of tablenames) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM ${tablename};`)
      console.log(`✓ 清理表: ${tablename}`)
    } catch (error) {
      console.log(`⚠️  跳过表: ${tablename} (可能不存在或无数据)`)
    }
  }
}

// 生成用户数据
async function seedUsers(generator: TestDataGenerator) {
  console.log('👥 生成用户数据...')
  const usersData = generator.generateUsers()

  const createdUsers = []
  for (const userData of usersData) {
    const user = await prisma.users.create({
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
        passwordHash: await bcrypt.hash('password123', 10),
        isAdmin: false,
        emailVerified: true,
        phoneVerified: true,
        kycVerified: Math.random() > 0.3,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })
    createdUsers.push(user)
  }

  console.log(`✓ 创建了 ${createdUsers.length} 个用户`)
  return createdUsers
}

// 生成商品分类
async function seedProductCategories() {
  console.log('📂 生成商品分类...')

  const categories = [
    // 一级分类
    { id: createId(), name: '护肤品', level: 1, parentId: null, icon: 'skincare', description: '面部护理、身体护理产品' },
    { id: createId(), name: '保健品', level: 1, parentId: null, icon: 'health', description: '营养保健、健康产品' },
    { id: createId(), name: '食品饮料', level: 1, parentId: null, icon: 'food', description: '休闲食品、饮品饮料' },
    { id: createId(), name: '家居用品', level: 1, parentId: null, icon: 'home', description: '家庭生活用品' },
    { id: createId(), name: '服装鞋包', level: 1, parentId: null, icon: 'fashion', description: '服装、鞋类、箱包' },
  ]

  // 添加二级分类
  const subCategories = [
    { name: '面部护理', parentName: '护肤品' },
    { name: '身体护理', parentName: '护肤品' },
    { name: '营养补充', parentName: '保健品' },
    { name: '保健器械', parentName: '保健品' },
    { name: '休闲零食', parentName: '食品饮料' },
    { name: '健康饮品', parentName: '食品饮料' },
    { name: '厨房用品', parentName: '家居用品' },
    { name: '清洁用品', parentName: '家居用品' },
    { name: '男装', parentName: '服装鞋包' },
    { name: '女装', parentName: '服装鞋包' },
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

  // 创建二级分类
  for (const subCategory of subCategories) {
    const parent = createdCategories.find(c => c.name === subCategory.parentName)
    if (parent) {
      const created = await prisma.productCategory.create({
        data: {
          id: createId(),
          name: subCategory.name,
          level: 2,
          parentId: parent.id,
          icon: `${parent.icon}_sub`,
          description: `${parent.description} - ${subCategory.name}`,
          isActive: true,
          sortOrder: createdCategories.length + subCategories.indexOf(subCategory),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
      createdCategories.push(created)
    }
  }

  console.log(`✓ 创建了 ${createdCategories.length} 个商品分类`)
  return createdCategories
}

// 生成店铺数据
async function seedShops(generator: TestDataGenerator, users: any[]) {
  console.log('🏪 生成店铺数据...')
  const shopsData = generator.generateShops()

  const createdShops = []
  for (const shopData of shopsData) {
    // 查找店铺所有者
    const owner = users.find(u => u.level >= shopData.shop.ownerId)
    if (!owner) continue

    const shop = await prisma.shop.create({
      data: {
        id: createId(),
        name: shopData.shop.name,
        type: shopData.shop.type,
        status: shopData.shop.status,
        ownerId: owner.id,
        description: shopData.shop.description,
        contactPhone: shopData.shop.contactPhone,
        contactAddress: shopData.shop.contactAddress,
        businessLicense: shopData.shop.businessLicense,
        establishedAt: shopData.shop.establishedAt,
        level: shopData.shop.level,
        totalSales: shopData.shop.totalSales,
        totalOrders: shopData.shop.totalOrders,
        averageRating: shopData.shop.averageRating,
        reviewCount: shopData.shop.reviewCount,
        isActive: shopData.shop.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })
    createdShops.push(shop)
  }

  console.log(`✓ 创建了 ${createdShops.length} 个店铺`)
  return createdShops
}

// 生成商品数据
async function seedProducts(generator: TestDataGenerator, categories: any[], users: any[]) {
  console.log('🛍️  生成商品数据...')
  const productsData = generator.generateProducts()

  const createdProducts = []
  for (const productData of productsData) {
    // 查找分类
    const category = categories[Math.floor(Math.random() * categories.length)]
    // 查找创建者
    const creator = users[Math.floor(Math.random() * users.length)]

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

    // 创建商品规格
    for (const variant of productData.variants) {
      await prisma.productVariant.create({
        data: {
          id: createId(),
          productId: product.id,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          costPrice: variant.price * 0.6,
          originalPrice: variant.price * 1.5,
          stock: variant.stock,
          lowStockThreshold: 10,
          images: productData.product.images.slice(0, 2),
          specifications: variant.specifications,
          isActive: true,
          sortOrder: productData.variants.indexOf(variant),
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }
  }

  console.log(`✓ 创建了 ${createdProducts.length} 个商品`)
  return createdProducts
}

// 生成订单数据
async function seedOrders(generator: TestDataGenerator, users: any[], products: any[]) {
  console.log('📦 生成订单数据...')
  const ordersData = generator.generateOrders()

  const createdOrders = []
  for (const orderData of ordersData) {
    // 查找买家和卖家
    const buyer = users[Math.floor(Math.random() * users.length)]
    const seller = users[Math.floor(Math.random() * users.length)]

    if (buyer.id === seller.id) continue

    const order = await prisma.order.create({
      data: {
        id: createId(),
        orderNumber: orderData.order.orderNumber,
        buyerId: buyer.id,
        sellerId: seller.id,
        totalAmount: orderData.order.totalAmount,
        status: orderData.order.status,
        paymentMethod: orderData.order.paymentMethod,
        paymentStatus: orderData.order.paymentStatus,
        shippingAddress: orderData.order.shippingAddress,
        shippingMethod: orderData.order.shippingMethod,
        estimatedDeliveryDate: orderData.order.estimatedDeliveryDate,
        actualDeliveryDate: orderData.order.actualDeliveryDate,
        notes: orderData.order.notes,
        createdAt: orderData.order.createdAt,
        updatedAt: orderData.order.updatedAt,
      }
    })
    createdOrders.push(order)

    // 创建订单项
    for (const item of orderData.items) {
      const product = products[Math.floor(Math.random() * products.length)]

      await prisma.orderItem.create({
        data: {
          id: createId(),
          orderId: order.id,
          productId: product.id,
          variantId: null, // 简化处理
          quantity: item.quantity,
          price: item.price,
          totalAmount: item.price * item.quantity,
          productName: product.name,
          productSku: product.sku,
          productImage: product.images[0] || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }
  }

  console.log(`✓ 创建了 ${createdOrders.length} 个订单`)
  return createdOrders
}

// 生成积分交易数据
async function seedTransactions(generator: TestDataGenerator, users: any[]) {
  console.log('💰 生成积分交易数据...')
  const transactionsData = generator.generateTransactions()

  const createdTransactions = []
  for (const transactionData of transactionsData) {
    // 查找用户
    const fromUser = transactionData.transaction.fromUserId === 'system'
      ? null
      : users[Math.floor(Math.random() * users.length)]
    const toUser = transactionData.transaction.toUserId === 'system'
      ? null
      : users[Math.floor(Math.random() * users.length)]

    if (fromUser?.id === toUser?.id && fromUser) continue

    const transaction = await prisma.pointsTransaction.create({
      data: {
        id: createId(),
        transactionId: transactionData.transaction.transactionId,
        fromUserId: fromUser?.id,
        toUserId: toUser?.id,
        type: transactionData.transaction.type,
        amount: transactionData.transaction.amount,
        balanceBefore: transactionData.transaction.balanceBefore,
        balanceAfter: transactionData.transaction.balanceAfter,
        status: transactionData.transaction.status,
        description: transactionData.transaction.description,
        orderId: transactionData.transaction.orderId,
        metadata: transactionData.transaction.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })
    createdTransactions.push(transaction)
  }

  console.log(`✓ 创建了 ${createdTransactions.length} 个积分交易`)
  return createdTransactions
}

// 生成通知数据
async function seedNotifications(generator: TestDataGenerator, users: any[]) {
  console.log('🔔 生成通知数据...')
  const notificationsData = generator.generateNotifications()

  const createdNotifications = []
  for (const notificationData of notificationsData) {
    const user = users[Math.floor(Math.random() * users.length)]

    const notification = await prisma.notification.create({
      data: {
        id: createId(),
        title: notificationData.notification.title,
        content: notificationData.notification.content,
        type: notificationData.notification.type,
        priority: notificationData.notification.priority,
        userId: user.id,
        isRead: notificationData.notification.isRead,
        scheduledAt: notificationData.notification.scheduledAt,
        expiresAt: notificationData.notification.expiresAt,
        metadata: notificationData.notification.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

    // 创建通知渠道
    for (const channel of notificationData.channels) {
      await prisma.notificationChannel.create({
        data: {
          id: createId(),
          notificationId: notification.id,
          channel: channel,
          status: 'PENDING',
          sentAt: null,
          error: null,
          retryCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })
    }

    createdNotifications.push(notification)
  }

  console.log(`✓ 创建了 ${createdNotifications.length} 个通知`)
  return createdNotifications
}

// 生成库存数据
async function seedInventory(generator: TestDataGenerator, users: any[], products: any[]) {
  console.log('📊 生成库存数据...')
  const inventoryData = generator.generateInventory()

  const createdInventory = []
  for (const itemData of inventoryData) {
    const user = users[Math.floor(Math.random() * users.length)]
    const product = products[Math.floor(Math.random() * products.length)]

    const inventory = await prisma.inventoryItem.create({
      data: {
        id: createId(),
        userId: user.id,
        productId: product.id,
        sku: itemData.item.sku,
        name: itemData.item.name,
        quantity: itemData.item.quantity,
        reservedQuantity: itemData.item.reservedQuantity,
        lowStockThreshold: itemData.item.lowStockThreshold,
        warehouseType: itemData.item.warehouseType,
        location: itemData.item.location,
        lastRestocked: itemData.item.lastRestocked,
        expiresAt: itemData.item.expiresAt,
        batchNumber: itemData.item.batchNumber,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })
    createdInventory.push(inventory)
  }

  console.log(`✓ 创建了 ${createdInventory.length} 个库存项`)
  return createdInventory
}

// 主函数
async function main() {
  console.log('🚀 开始生成测试数据...\n')

  try {
    // 清理现有数据
    await cleanDatabase()

    // 创建数据生成器
    const generator = new TestDataGenerator(TEST_CONFIG)

    // 按依赖顺序生成数据
    const users = await seedUsers(generator)
    const categories = await seedProductCategories()
    const shops = await seedShops(generator, users)
    const products = await seedProducts(generator, categories, users)
    const orders = await seedOrders(generator, users, products)
    const transactions = await seedTransactions(generator, users)
    const notifications = await seedNotifications(generator, users)
    const inventory = await seedInventory(generator, users, products)

    console.log('\n🎉 测试数据生成完成！')
    console.log('\n📊 生成统计:')
    console.log(`   👤 用户: ${users.length}`)
    console.log(`   🏪 店铺: ${shops.length}`)
    console.log(`   📂 分类: ${categories.length}`)
    console.log(`   🛍️  商品: ${products.length}`)
    console.log(`   📦 订单: ${orders.length}`)
    console.log(`   💰 交易: ${transactions.length}`)
    console.log(`   🔔 通知: ${notifications.length}`)
    console.log(`   📊 库存: ${inventory.length}`)

    console.log('\n🔑 测试账号信息:')
    const directorUser = users.find(u => u.level === 'DIRECTOR')
    const normalUser = users.find(u => u.level === 'NORMAL')
    console.log(`   总监账号: ${directorUser?.nickname} (${directorUser?.phone})`)
    console.log(`   普通用户: ${normalUser?.nickname} (${normalUser?.phone})`)
    console.log('   默认密码: password123')

  } catch (error) {
    console.error('❌ 测试数据生成失败:', error)
    throw error
  }
}

// 错误处理
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })