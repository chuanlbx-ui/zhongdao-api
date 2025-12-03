#!/usr/bin/env tsx

/**
 * 前后端数据模拟生成器
 * 生成符合后端API规范的测试数据
 */

import { faker } from '@faker-js/faker';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// 设置中文
faker.locale = 'zh_CN';

const prisma = new PrismaClient();

// 数据配置
const MOCK_CONFIG = {
  users: 100,
  products: 500,
  orders: 1000,
  categories: 20,
  shops: 50,
  pointsTransactions: 5000,
  inventoryItems: 1000
};

// 用户等级配置
const USER_LEVELS = ['NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'];

/**
 * 生成用户数据
 */
function generateUsers(count: number) {
  const users = [];
  const phoneNumbers = new Set();

  for (let i = 0; i < count; i++) {
    let phone;
    do {
      phone = `1${faker.datatype.number({ min: 30, max: 99 })}${faker.datatype.number({ min: 100000000, max: 999999999 })}`;
    } while (phoneNumbers.has(phone));

    phoneNumbers.add(phone);

    const user = {
      id: `user_${faker.datatype.uuid()}`,
      phone,
      nickname: faker.name.lastName() + faker.name.lastName(),
      avatar: faker.image.avatar(),
      level: faker.helpers.arrayElement(USER_LEVELS),
      status: faker.helpers.arrayElement(['active', 'inactive', 'frozen']),
      parentId: i > 0 ? `user_${faker.datatype.number({ min: 1, max: i - 1 })}` : null,
      teamPath: i > 0 ? `/${faker.datatype.number({ min: 1, max: Math.floor(i / 5) })}/${i}` : `/${i}`,
      inviteCode: faker.random.alphaNumeric(8),
      totalOrders: faker.datatype.number({ min: 0, max: 100 }),
      totalAmount: faker.datatype.number({ min: 0, max: 100000 }),
      monthAmount: faker.datatype.number({ min: 0, max: 10000 }),
      directMembers: faker.datatype.number({ min: 0, max: 20 }),
      teamMembers: faker.datatype.number({ min: 0, max: 100 }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };

    users.push(user);
  }

  return users;
}

/**
 * 生成商品分类
 */
function generateCategories(count: number) {
  const categories = [];
  const categoryNames = [
    '保健品', '护肤品', '日用品', '食品饮料', '服装鞋包',
    '家居用品', '母婴用品', '运动户外', '数码电器', '图书音像',
    '美妆个护', '汽车用品', '办公文具', '生鲜水果', '粮油调味',
    '礼品鲜花', '宠物用品', '玩具乐器', '医药保健', '钟表珠宝'
  ];

  for (let i = 0; i < count && i < categoryNames.length; i++) {
    const category = {
      id: `cat_${String(i + 1).padStart(3, '0')}`,
      name: categoryNames[i],
      icon: faker.image.imageUrl(100, 100, categoryNames[i]),
      level: 1,
      parentId: null,
      sortOrder: i + 1,
      status: 'active',
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };

    categories.push(category);

    // 生成二级分类
    for (let j = 0; j < 5; j++) {
      const subCategory = {
        id: `cat_${String(i + 1).padStart(3, '0')}_${String(j + 1).padStart(2, '0')}`,
        name: `${categoryNames[i]}-${faker.commerce.productMaterial()}`,
        icon: faker.image.imageUrl(100, 100, categoryNames[i]),
        level: 2,
        parentId: category.id,
        sortOrder: j + 1,
        status: 'active',
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent()
      };

      categories.push(subCategory);
    }
  }

  return categories;
}

/**
 * 生成商品数据
 */
function generateProducts(count: number, categories: any[]) {
  const products = [];

  for (let i = 0; i < count; i++) {
    const category = faker.helpers.arrayElement(categories.filter(c => c.level === 2));
    const hasSpecs = faker.datatype.boolean();

    const product = {
      id: `prod_${faker.datatype.uuid()}`,
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      images: Array.from({ length: faker.datatype.number({ min: 1, max: 5 }) }, () =>
        faker.image.imageUrl(400, 400, 'product')
      ),
      video: faker.datatype.boolean() ? faker.internet.url() : null,
      categoryId: category.id,
      price: parseFloat(faker.commerce.price(10, 5000)),
      originalPrice: parseFloat(faker.commerce.price(500, 10000)),
      stock: faker.datatype.number({ min: 0, max: 10000 }),
      sales: faker.datatype.number({ min: 0, max: 5000 }),
      status: faker.helpers.arrayElement(['active', 'inactive', 'out_of_stock']),
      tags: faker.helpers.arrayElements(['新品', '热销', '限量', '特价', '推荐'], { min: 0, max: 3 }),
      specifications: hasSpecs ? {
        color: faker.helpers.arrayElement(['红色', '蓝色', '白色', '黑色', '绿色']),
        size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL', 'XXL']),
        material: faker.commerce.productMaterial()
      } : null,
      createdBy: `user_${faker.datatype.number({ min: 1, max: 50 })}`,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };

    products.push(product);
  }

  return products;
}

/**
 * 生成店铺数据
 */
function generateShops(count: number, users: any[]) {
  const shops = [];
  const shopNames = [
    '健康生活馆', '美容美体店', '时尚服饰店', '数码科技城', '食品专营店',
    '母婴用品店', '家居生活馆', '运动户外店', '图书文具店', '汽车服务店'
  ];

  for (let i = 0; i < count; i++) {
    const user = faker.helpers.arrayElement(users.filter(u => u.level !== 'NORMAL'));
    const shop = {
      id: `shop_${faker.datatype.uuid()}`,
      name: shopNames[i % shopNames.length] + (i >= shopNames.length ? ` ${Math.floor(i / shopNames.length) + 1}` : ''),
      description: faker.lorem.sentences(2),
      logo: faker.image.imageUrl(200, 200, 'logo'),
      banner: faker.image.imageUrl(800, 300, 'banner'),
      ownerId: user.id,
      type: faker.helpers.arrayElement(['CLOUD', 'WUTONG']),
      level: user.level.includes('STAR') ? parseInt(user.level.split('_')[1]) : 0,
      status: 'active',
      totalProducts: faker.datatype.number({ min: 10, max: 500 }),
      totalOrders: faker.datatype.number({ min: 100, max: 10000 }),
      totalRevenue: faker.datatype.number({ min: 10000, max: 1000000 }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };

    shops.push(shop);
  }

  return shops;
}

/**
 * 生成订单数据
 */
function generateOrders(count: number, users: any[]) {
  const orders = [];
  const orderStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];

  for (let i = 0; i < count; i++) {
    const user = faker.helpers.arrayElement(users);
    const itemCount = faker.datatype.number({ min: 1, max: 5 });
    const items = Array.from({ length: itemCount }, () => ({
      productId: `prod_${faker.datatype.uuid()}`,
      quantity: faker.datatype.number({ min: 1, max: 5 }),
      price: parseFloat(faker.commerce.price(10, 1000))
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = {
      id: `order_${faker.datatype.uuid()}`,
      userId: user.id,
      orderNo: `ZD${faker.datatype.number({ min: 100000000, max: 999999999 })}`,
      items,
      totalAmount,
      shippingFee: faker.datatype.number({ min: 0, max: 20 }),
      discountAmount: faker.datatype.number({ min: 0, max: totalAmount * 0.1 }),
      status: faker.helpers.arrayElement(orderStatuses),
      paymentMethod: faker.helpers.arrayElement(['wechat', 'alipay', 'points', 'mixed']),
      shippingAddress: {
        name: faker.name.fullName(),
        phone: faker.phone.number('1##########'),
        province: faker.address.state(),
        city: faker.address.city(),
        district: faker.address.county(),
        detail: faker.address.streetAddress()
      },
      remark: faker.lorem.sentence(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };

    orders.push(order);
  }

  return orders;
}

/**
 * 生成积分流水数据
 */
function generatePointsTransactions(count: number, users: any[]) {
  const transactions = [];
  const transactionTypes = ['PURCHASE', 'TRANSFER', 'RECHARGE', 'WITHDRAW', 'COMMISSION', 'GIFT', 'REFUND'];

  for (let i = 0; i < count; i++) {
    const fromUser = faker.helpers.arrayElement(users);
    const toUser = faker.datatype.boolean() ? faker.helpers.arrayElement(users) : null;
    const type = faker.helpers.arrayElement(transactionTypes);

    const transaction = {
      id: `txn_${faker.datatype.uuid()}`,
      userId: toUser?.id || fromUser.id,
      type,
      amount: parseFloat(faker.finance.amount(1, 10000)),
      balance: parseFloat(faker.finance.amount(0, 50000)),
      fromUserId: type === 'TRANSFER' || type === 'GIFT' ? fromUser.id : null,
      toUserId: toUser?.id || null,
      relatedOrderId: type === 'PURCHASE' || type === 'REFUND' ? `order_${faker.datatype.uuid()}` : null,
      description: faker.lorem.sentence(),
      status: 'success',
      createdAt: faker.date.past()
    };

    transactions.push(transaction);
  }

  return transactions;
}

/**
 * 生成库存数据
 */
function generateInventoryItems(count: number, products: any[], shops: any[]) {
  const inventoryItems = [];
  const warehouses = ['PLATFORM', 'CLOUD', 'LOCAL'];

  for (let i = 0; i < count; i++) {
    const product = faker.helpers.arrayElement(products);
    const warehouse = faker.helpers.arrayElement(warehouses);
    const shop = warehouse === 'CLOUD' ? faker.helpers.arrayElement(shops) : null;

    const inventoryItem = {
      id: `inv_${faker.datatype.uuid()}`,
      productId: product.id,
      warehouseType: warehouse,
      shopId: shop?.id,
      quantity: faker.datatype.number({ min: 0, max: 10000 }),
      reservedQuantity: faker.datatype.number({ min: 0, max: 100 }),
      availableQuantity: 0, // 将在后面计算
      warningThreshold: 10,
      lastCheckAt: faker.date.recent(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent()
    };

    inventoryItem.availableQuantity = inventoryItem.quantity - inventoryItem.reservedQuantity;

    inventoryItems.push(inventoryItem);
  }

  return inventoryItems;
}

/**
 * 保存数据到文件
 */
function saveMockData(data: any, filename: string) {
  const outputDir = path.join(__dirname, '../mock-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ 生成 mock 数据: ${filename}`);
}

/**
 * 生成前端测试数据
 */
function generateFrontendTestData() {
  const testData = {
    auth: {
      validLoginResponse: {
        success: true,
        data: {
          user: {
            id: 'test-user-001',
            phone: '13800138000',
            nickname: '测试用户',
            level: 'VIP',
            avatar: 'https://example.com/avatar.jpg'
          },
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
          refreshToken: 'refresh.token.here',
          expiresIn: 7200
        }
      },
      invalidCredentials: {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '手机号或验证码错误'
        }
      }
    },
    products: {
      productList: {
        success: true,
        data: {
          products: Array.from({ length: 10 }, (_, i) => ({
            id: `test-prod-${i + 1}`,
            name: `测试商品 ${i + 1}`,
            price: (i + 1) * 100,
            originalPrice: (i + 1) * 150,
            image: `https://example.com/product${i + 1}.jpg`,
            sales: faker.datatype.number({ min: 0, max: 1000 })
          })),
          pagination: {
            page: 1,
            perPage: 10,
            total: 100,
            totalPages: 10
          }
        }
      }
    },
    orders: {
      orderList: {
        success: true,
        data: {
          orders: Array.from({ length: 5 }, (_, i) => ({
            id: `test-order-${i + 1}`,
            orderNo: `ZD202412000${i + 1}`,
            status: faker.helpers.arrayElement(['pending', 'paid', 'shipped', 'delivered']),
            totalAmount: (i + 1) * 299,
            createdAt: faker.date.recent().toISOString()
          }))
        }
      }
    }
  };

  saveMockData(testData, 'frontend-test-data.json');
}

/**
 * 主函数
 */
async function generateMockData() {
  try {
    console.log('🔄 开始生成 mock 数据...');

    // 生成基础数据
    console.log('📝 生成用户数据...');
    const users = generateUsers(MOCK_CONFIG.users);
    saveMockData(users, 'users.json');

    console.log('📝 生成商品分类...');
    const categories = generateCategories(MOCK_CONFIG.categories);
    saveMockData(categories, 'categories.json');

    console.log('📝 生成商品数据...');
    const products = generateProducts(MOCK_CONFIG.products, categories);
    saveMockData(products, 'products.json');

    console.log('📝 生成店铺数据...');
    const shops = generateShops(MOCK_CONFIG.shops, users);
    saveMockData(shops, 'shops.json');

    console.log('📝 生成订单数据...');
    const orders = generateOrders(MOCK_CONFIG.orders, users);
    saveMockData(orders, 'orders.json');

    console.log('📝 生成积分流水...');
    const pointsTransactions = generatePointsTransactions(MOCK_CONFIG.pointsTransactions, users);
    saveMockData(pointsTransactions, 'points-transactions.json');

    console.log('📝 生成库存数据...');
    const inventoryItems = generateInventoryItems(MOCK_CONFIG.inventoryItems, products, shops);
    saveMockData(inventoryItems, 'inventory.json');

    // 生成前端测试数据
    console.log('📝 生成前端测试数据...');
    generateFrontendTestData();

    // 生成汇总索引
    const index = {
      generated: new Date().toISOString(),
      config: MOCK_CONFIG,
      files: {
        users: 'users.json',
        categories: 'categories.json',
        products: 'products.json',
        shops: 'shops.json',
        orders: 'orders.json',
        pointsTransactions: 'points-transactions.json',
        inventory: 'inventory.json',
        frontendTestData: 'frontend-test-data.json'
      }
    };

    saveMockData(index, 'index.json');

    console.log('✅ Mock 数据生成完成！');
    console.log('📁 数据保存在: ./mock-data/');

  } catch (error) {
    console.error('❌ 生成 mock 数据失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  generateMockData();
}

export { generateMockData };