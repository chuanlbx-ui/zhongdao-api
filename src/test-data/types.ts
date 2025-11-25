import {
  User,
  UserLevel,
  UserStatus,
  Shop,
  ShopType,
  ShopStatus,
  Product,
  ProductStatus,
  ProductCategory,
  ProductTag,
  PointsTransaction,
  TransactionType,
  Order,
  OrderStatus,
  InventoryItem,
  PurchaseOrder,
  PaymentRecord,
  Notification,
  NotificationChannel,
} from '@prisma/client'

export interface TestUserData {
  user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'>
  teamHierarchy: Array<{
    level: number
    memberCount: number
    path: string
  }>
}

export interface TestShopData {
  shop: Omit<Shop, 'id' | 'createdAt' | 'updatedAt'>
  products?: Product[]
}

export interface TestProductData {
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
  category?: ProductCategory
  tags?: ProductTag[]
  variants?: Array<{
    name: string
    sku: string
    price: number
    stock: number
    specifications: Record<string, string>
  }>
}

export interface TestOrderData {
  order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>
  items: Array<{
    productId: string
    quantity: number
    price: number
  }>
}

export interface TestTransactionData {
  transaction: Omit<PointsTransaction, 'id' | 'createdAt' | 'updatedAt'>
}

export interface TestNotificationData {
  notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>
  channels: NotificationChannel[]
}

export interface TestInventoryData {
  item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
}

export interface TestDataSets {
  users: TestUserData[]
  shops: TestShopData[]
  products: TestProductData[]
  orders: TestOrderData[]
  transactions: TestTransactionData[]
  notifications: TestNotificationData[]
  inventory: TestInventoryData[]
}

// 测试数据生成配置
export interface TestDataConfig {
  userLevels: {
    normal: number      // 普通用户数量
    vip: number          // VIP用户数量
    star1: number        // 1星店长数量
    star2: number        // 2星店长数量
    star3: number        // 3星店长数量
    star4: number        // 4星店长数量
    star5: number        // 5星店长数量
    director: number    // 总监数量
  }
  shops: {
    cloud: number       // 云店数量
    wutong: number     // 梧桐店数量
  }
  products: {
    categories: number  // 分类数量
    products: number    // 商品数量
    variantsPerProduct: number // 每个商品的规格数量
  }
  orders: {
    pending: number     // 待处理订单
    paid: number        // 已支付订单
    delivered: number   // 已交付订单
    cancelled: number   // 已取消订单
  }
  inventory: {
    items: number       // 库存项目数量
    lowStockThreshold: number // 低库存阈值
  }
}