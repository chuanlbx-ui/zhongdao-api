import {
  UserLevel,
  UserStatus,
  ShopType,
  ShopStatus,
  ProductStatus,
  TransactionType,
  OrderStatus,
  NotificationChannel,
  NotificationType,
  NotificationPriority
} from '@prisma/client'
import type {
  TestUserData,
  TestShopData,
  TestProductData,
  TestOrderData,
  TestTransactionData,
  TestNotificationData,
  TestInventoryData,
  TestDataConfig,
} from '../types'
import { faker } from '@faker-js/faker/locale/zh_CN'
import { createId } from '@paralleldrive/cuid2'

// 测试数据生成配置
const DEFAULT_CONFIG: TestDataConfig = {
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

export class TestDataGenerator {
  private config: TestDataConfig
  private users: Map<string, TestUserData> = new Map()
  private shops: Map<string, TestShopData> = new Map()
  private products: Map<string, TestProductData> = new Map()

  constructor(config: Partial<TestDataConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // 生成用户数据
  generateUsers(): TestUserData[] {
    const users: TestUserData[] = []
    let userIdCounter = 1

    // 生成用户层级数据
    const levels = [
      { level: UserLevel.DIRECTOR, count: this.config.userLevels.director, prefix: 'DR' },
      { level: UserLevel.STAR_5, count: this.config.userLevels.star5, prefix: 'S5' },
      { level: UserLevel.STAR_4, count: this.config.userLevels.star4, prefix: 'S4' },
      { level: UserLevel.STAR_3, count: this.config.userLevels.star3, prefix: 'S3' },
      { level: UserLevel.STAR_2, count: this.config.userLevels.star2, prefix: 'S2' },
      { level: UserLevel.STAR_1, count: this.config.userLevels.star1, prefix: 'S1' },
      { level: UserLevel.VIP, count: this.config.userLevels.vip, prefix: 'VIP' },
      { level: UserLevel.NORMAL, count: this.config.userLevels.normal, prefix: 'U' },
    ]

    // 构建层级关系
    let currentParentId: string | null = null
    const hierarchy: string[] = []

    // 收集所有用户数据，但先不设置parentId
    const allUserData: Array<{ userData: TestUserData; id: string; willBeParent: boolean }> = []

    for (const { level, count, prefix } of levels) {
      for (let i = 0; i < count; i++) {
        const id = createId()
        const userId = `user_${userIdCounter++}`
        const willBeParent = i < Math.floor(count * 0.3)

        const userData: TestUserData = {
          user: {
            openid: `wx_openid_${userId}`,
            nickname: `${prefix}${faker.person.lastName()}${i + 1}`,
            avatarUrl: faker.image.avatar(),
            phone: faker.phone.number('1##########'),
            referralCode: this.generateReferralCode(),
            level,
            status: UserStatus.ACTIVE,
            parentId: null, // 先设置为null，稍后设置
            teamPath: '', // 稍后计算
            teamLevel: 1, // 稍后计算
            totalSales: faker.number.int({ min: 0, max: 100000 }),
            totalBottles: faker.number.int({ min: 0, max: 1000 }),
            directSales: faker.number.int({ min: 0, max: 50000 }),
            teamSales: faker.number.int({ min: 0, max: 80000 }),
            directCount: 0,
            teamCount: 0,
            cloudShopLevel: level >= UserLevel.STAR_1 ? faker.number.int({ min: 1, max: 5 }) : undefined,
            hasWutongShop: level >= UserLevel.STAR_3 ? faker.datatype.boolean() : false,
            pointsBalance: faker.number.int({ min: 100, max: 10000 }),
            pointsFrozen: faker.number.int({ min: 0, max: 1000 }),
          },
          teamHierarchy: this.generateTeamHierarchy(hierarchy.length + 1),
        }

        allUserData.push({ userData, id, willBeParent })
      }
    }

    // 建立层级关系并设置正确的parentId和teamPath

    for (const { userData, id, willBeParent } of allUserData) {
      userData.user.parentId = currentParentId
      userData.user.teamPath = hierarchy.length > 0 ? hierarchy.join('/') + '/' + id : id
      userData.user.teamLevel = hierarchy.length + 1

      users.push(userData)
      this.users.set(id, userData)

      // 层级关系：前几个作为其他用户的父级
      if (willBeParent) {
        currentParentId = id
        hierarchy.push(id)
      }
    }

    // 更新团队统计
    this.updateTeamStats(users)
    return users
  }

  // 生成店铺数据
  generateShops(): TestShopData[] {
    const shops: TestShopData[] = []
    let shopIdCounter = 1

    // 生成云店
    for (let i = 0; i < this.config.shops.cloud; i++) {
      const shopData: TestShopData = {
        shop: {
          name: `测试云店${i + 1}`,
          type: ShopType.CLOUD,
          status: ShopStatus.ACTIVE,
          ownerId: this.getRandomUserId(UserLevel.STAR_1),
          description: `这是测试云店${i + 1}的描述`,
          contactPhone: faker.phone.number('1##########'),
          contactAddress: faker.location.streetAddress(),
          businessLicense: faker.string.alphanumeric(18),
          establishedAt: faker.date.past({ years: 2 }),
          level: faker.number.int({ min: 1, max: 5 }),
          totalSales: faker.number.int({ min: 10000, max: 100000 }),
          totalOrders: faker.number.int({ min: 10, max: 100 }),
          averageRating: faker.number.float({ min: 3.5, max: 5, precision: 1 }),
          reviewCount: faker.number.int({ min: 0, max: 500 }),
          isActive: true,
        },
      }
      shops.push(shopData)
      this.shops.set(`shop_${shopIdCounter++}`, shopData)
    }

    // 生成梧桐店
    for (let i = 0; i < this.config.shops.wutong; i++) {
      const shopData: TestShopData = {
        shop: {
          name: `梧桐精品店${i + 1}`,
          type: ShopType.WUTONG,
          status: ShopStatus.ACTIVE,
          ownerId: this.getRandomUserId(UserLevel.STAR_3),
          description: `这是梧桐精品店${i + 1}的描述`,
          contactPhone: faker.phone.number('1##########'),
          contactAddress: faker.location.streetAddress(),
          businessLicense: faker.string.alphanumeric(18),
          establishedAt: faker.date.past({ years: 1 }),
          level: faker.number.int({ min: 1, max: 3 }),
          totalSales: faker.number.int({ min: 5000, max: 50000 }),
          totalOrders: faker.number.int({ min: 5, max: 50 }),
          averageRating: faker.number.float({ min: 3.0, max: 5.0, precision: 1 }),
          reviewCount: faker.number.int({ min: 0, max: 200 }),
          isActive: true,
        },
      }
      shops.push(shopData)
      this.shops.set(`shop_${shopIdCounter++}`, shopData)
    }

    return shops
  }

  // 生成商品分类
  private generateProductCategories(): Array<{ id: string; name: string; level: number; parentId?: string }> {
    const categories = []

    // 一级分类
    const level1Categories = ['护肤品', '保健品', '食品饮料', '家居用品', '服装鞋包']
    level1Categories.forEach((name, index) => {
      const id = `cat_${index + 1}`
      categories.push({ id, name, level: 1 })
    })

    // 二级分类
    level1Categories.forEach((parent, parentIndex) => {
      for (let i = 0; i < 2; i++) {
        const id = `cat_${parentIndex + 1}_${i + 1}`
        const name = `${parent}子类${i + 1}`
        categories.push({ id, name, level: 2, parentId: parent.id })
      }
    })

    return categories
  }

  // 生成商品数据
  generateProducts(): TestProductData[] {
    const products: TestProductData[] = []
    const categories = this.generateProductCategories()

    for (let i = 0; i < this.config.products.products; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)]

      const productData: TestProductData = {
        product: {
          name: faker.commerce.productName(),
          sku: `SKU${faker.string.alphanumeric(8).toUpperCase()}`,
          description: faker.commerce.productDescription(),
          basePrice: faker.number.int({ min: 50, max: 5000 }),
          originalPrice: faker.number.int({ min: 100, max: 8000 }),
          costPrice: faker.number.int({ min: 30, max: 3000 }),
          status: ProductStatus.ACTIVE,
          categoryId: category.id,
          images: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => faker.image.url(400, 400, 'product', true)),
          specifications: JSON.stringify({ brand: '测试品牌', model: '测试型号', weight: '100g' }),
          tags: [],
          shopType: faker.helpers.arrayElement([ShopType.CLOUD, ShopType.WUTONG]),
          createdBy: this.getRandomUserId(),
          updatedBy: this.getRandomUserId(),
        },
        category,
        variants: this.generateProductVariants(),
      }
      products.push(productData)
      this.products.set(`product_${i}`, productData)
    }

    return products
  }

  // 生成商品规格
  private generateProductVariants() {
    const variants = []
    const variantsCount = Math.floor(Math.random() * this.config.products.variantsPerProduct) + 1

    for (let i = 0; i < variantsCount; i++) {
      variants.push({
        name: `规格${i + 1}`,
        sku: `SKU_VAR${i + 1}`,
        price: faker.number.int({ min: 100, max: 1000 }),
        stock: faker.number.int({ min: 0, max: 100 }),
        specifications: JSON.stringify({
          颜色: faker.color.human(),
          尺寸: faker.helpers.arrayElement(['S', 'M', 'L', 'XL', 'XXL']),
          材质: faker.helpers.arrayElement(['纯棉', '涤纶', '混纺', '真丝']),
        }),
      })
    }

    return variants
  }

  // 生成订单数据
  generateOrders(): TestOrderData[] {
    const orders: TestOrderData[] = []

    const orderStatuses = [
      { status: OrderStatus.PENDING, count: this.config.orders.pending },
      { status: OrderStatus.PAID, count: this.config.orders.paid },
      { status: OrderStatus.DELIVERED, count: this.config.orders.delivered },
      { status: OrderStatus.CANCELLED, count: this.config.orders.cancelled },
    ]

    for (const { status, count } of orderStatuses) {
      for (let i = 0; i < count; i++) {
        const items = this.generateOrderItems()
        const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

        const orderData: TestOrderData = {
          order: {
            orderNumber: this.generateOrderNumber(),
            buyerId: this.getRandomUserId(),
            sellerId: this.getRandomUserId(),
            totalAmount,
            status,
            paymentMethod: faker.helpers.arrayElement(['WECHAT', 'POINTS', 'ALIPAY']),
            paymentStatus: status === OrderStatus.PAID ? 'PAID' : 'UNPAID',
            shippingAddress: faker.location.streetAddress(),
            shippingMethod: 'STANDARD',
            estimatedDeliveryDate: faker.date.soon({ days: 7 }),
            actualDeliveryDate: status === OrderStatus.DELIVERED ? faker.date.recent() : null,
            notes: faker.lorem.sentences(2),
            createdAt: faker.date.past({ days: 30 }),
            updatedAt: faker.date.recent(),
          },
          items,
        }
        orders.push(orderData)
      }
    }

    return orders
  }

  // 生成订单项
  private generateOrderItems() {
    const itemCount = faker.number.int({ min: 1, max: 5 })
    const items = []

    for (let i = 0; i < itemCount; i++) {
      items.push({
        productId: this.getRandomProductId(),
        quantity: faker.number.int({ min: 1, max: 10 }),
        price: faker.number.int({ min: 100, max: 1000 }),
      })
    }

    return items
  }

  // 生成通券交易数据
  generateTransactions(): TestTransactionData[] {
    const transactions: TestTransactionData[] = []

    const transactionTypes = [
      TransactionType.RECHARGE,
      TransactionType.TRANSFER,
      TransactionType.PURCHASE,
      TransactionType.COMMISSION,
      TransactionType.WITHDRAW,
    ]

    for (let i = 0; i < 100; i++) {
      const amount = faker.number.int({ min: -1000, max: 5000 })

      const transactionData: TestTransactionData = {
        transaction: {
          transactionId: `TXN_${createId()}`,
          fromUserId: amount >= 0 ? 'system' : this.getRandomUserId(),
          toUserId: amount > 0 ? this.getRandomUserId() : 'system',
          type: faker.helpers.arrayElement(transactionTypes),
          amount: Math.abs(amount),
          balanceBefore: faker.number.int({ min: 0, max: 10000 }),
          balanceAfter: faker.number.int({ min: 0, max: 10000 }),
          status: 'COMPLETED',
          description: faker.lorem.sentence(),
          orderId: faker.helpers.arrayElement([this.getRandomOrderId(), null]),
          metadata: {},
        },
      }
      transactions.push(transactionData)
    }

    return transactions
  }

  // 生成通知数据
  generateNotifications(): TestNotificationData[] {
    const notifications: TestNotificationData[] = []

    for (let i = 0; i < 200; i++) {
      const channels = faker.helpers.arrayElements([
        NotificationChannel.IN_APP,
        NotificationChannel.EMAIL,
        NotificationChannel.SMS,
        NotificationChannel.PUSH,
      ])

      const notificationData: TestNotificationData = {
        notification: {
          title: faker.lorem.words(5),
          content: faker.lorem.sentences(2),
          type: faker.helpers.arrayElement([
            NotificationType.INFO,
            NotificationType.SUCCESS,
            NotificationType.WARNING,
            NotificationType.ERROR,
            NotificationType.SYSTEM,
          ]),
          priority: faker.helpers.arrayElement([
            NotificationPriority.LOW,
            NotificationPriority.NORMAL,
            NotificationPriority.HIGH,
            NotificationPriority.URGENT,
          ]),
          userId: this.getRandomUserId(),
          isRead: faker.datatype.boolean(),
          channels,
          scheduledAt: faker.date.soon({ hours: 24 }),
          expiresAt: faker.date.future({ days: 7 }),
          metadata: {},
        },
        channels,
      }
      notifications.push(notificationData)
    }

    return notifications
  }

  // 生成库存数据
  generateInventory(): TestInventoryData[] {
    const items: TestInventoryData[] = []

    for (let i = 0; i < this.config.inventory.items; i++) {
      const quantity = faker.datatype.number({ min: 0, max: 100 })
      const isLowStock = quantity < this.config.inventory.lowStockThreshold

      const itemData: TestInventoryData = {
        item: {
          userId: this.getRandomUserId(),
          productId: this.getRandomProductId(),
          sku: faker.string.alphanumeric(10).toUpperCase(),
          name: faker.commerce.productName(),
          quantity,
          reservedQuantity: faker.datatype.number({ min: 0, max: 20 }),
          lowStockThreshold: this.config.inventory.lowStockThreshold,
          warehouseType: 'LOCAL',
          location: faker.location.streetAddress(),
          lastRestocked: faker.date.recent({ days: 30 }),
          expiresAt: faker.date.future({ years: 2 }),
          batchNumber: faker.string.alphanumeric(10),
        },
      }
      items.push(itemData)
    }

    return items
  }

  // 生成完整的测试数据集
  generateAll(): TestDataSets {
    return {
      users: this.generateUsers(),
      shops: this.generateShops(),
      products: this.generateProducts(),
      orders: this.generateOrders(),
      transactions: this.generateTransactions(),
      notifications: this.generateNotifications(),
      inventory: this.generateInventory(),
    }
  }

  // 工具方法
  private generateReferralCode(): string {
    return faker.string.alphanumeric(6).toUpperCase()
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000)
    return `ORD${timestamp}${random}`
  }

  private generateTeamHierarchy(level: number) {
    return Array.from({ length: level }, (_, i) => `team_${i + 1}`)
  }

  private updateTeamStats(users: TestUserData[]): void {
    users.forEach(user => {
      // 计算直推人数和团队人数
      const children = users.filter(u => u.user.parentId === user.user.id)
      user.user.directCount = children.length

      // 递归计算团队总人数
      const countTeamMembers = (userId: string): number => {
        const members = users.filter(u => u.user.teamPath.includes(userId))
        return members.length
      }

      user.user.teamCount = countTeamMembers(user.user.id)
    })
  }

  private getRandomUserId(minLevel: UserLevel = UserLevel.NORMAL): string {
    const availableUsers = Array.from(this.users.values()).filter(
      u => u.user.level >= minLevel
    )
    return availableUsers[Math.floor(Math.random() * availableUsers.length)]?.user.id || ''
  }

  private getRandomProductId(): string {
    const availableProducts = Array.from(this.products.values())
    return availableProducts[Math.floor(Math.random() * availableProducts.length)]?.product.id || ''
  }

  private getRandomOrderId(): string | null {
    return faker.helpers.arrayElement([faker.string.alphanumeric(10), null])
  }
}