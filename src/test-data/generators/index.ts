/**
 * 测试数据生成器主文件
 * 负责生成完整的测试数据集
 */

import { faker } from '@faker-js/faker';
import { PrismaClient, UserLevel, ShopType, ProductStatus, OrderStatus, TransactionType } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcryptjs';
import type { TestDataConfig, GeneratedUser, GeneratedShop, GeneratedProduct, GeneratedOrder, GeneratedPointsTransaction } from '../types';
import { COMPREHENSIVE_CONFIG } from '../configs/comprehensive.config';

const prisma = new PrismaClient();

export class TestDataGenerator {
  private config: TestDataConfig;
  private users: GeneratedUser[] = [];
  private shops: GeneratedShop[] = [];
  private products: GeneratedProduct[] = [];
  private categories: any[] = [];

  constructor(config: TestDataConfig = COMPREHENSIVE_CONFIG) {
    this.config = config;
    // 设置种子
    faker.seed(12345);
  }

  /**
   * 生成所有测试数据
   */
  async generateAll() {
    console.log('🚀 开始生成测试数据...');
    console.log(`📊 配置信息：`, {
      用户总数: Object.values(this.config.userLevels).reduce((a, b) => a + b, 0),
      店铺总数: this.config.shops.cloud + this.config.shops.wutong,
      商品总数: this.config.productss.productss,
      订单总数: Object.values(this.config.orders).reduce((a, b) => a + b, 0)
    });

    // 1. 生成用户数据
    console.log('\n👥 生成用户数据...');
    this.users = this.generateUsers();
    await this.saveUsers();

    // 2. 生成商品分类
    console.log('\n📂 生成商品分类...');
    this.categories = await this.generateCategories();

    // 3. 生成商品数据
    console.log('\n🛍️  生成商品数据...');
    this.productss = this.generateProducts();
    await this.saveProducts();

    // 4. 生成店铺数据
    console.log('\n🏪 生成店铺数据...');
    this.shops = this.generateShops();
    await this.saveShops();

    // 5. 生成订单数据
    console.log('\n📦 生成订单数据...');
    await this.generateOrders();

    // 6. 生成积分交易记录
    console.log('\n💰 生成积分交易记录...');
    await this.generateTransactions();

    // 7. 生成库存数据
    console.log('\n📊 生成库存数据...');
    await this.generateInventory();

    // 8. 生成通知数据
    console.log('\n🔔 生成通知数据...');
    await this.generateNotifications();

    console.log('\n✅ 测试数据生成完成！');
    this.printStatistics();
  }

  /**
   * 生成用户数据（包含完整的层级关系）
   */
  private generateUsers(): GeneratedUser[] {
    const users: GeneratedUser[] = [];
    const now = new Date();
    let currentParentId: string | null = null;
    const hierarchy: string[] = [];

    // 定义层级顺序（从高到低）
    const levels = [
      { level: 'DIRECTOR', count: this.config.userLevels.director, prefix: 'DR' },
      { level: 'STAR_5', count: this.config.userLevels.star5, prefix: 'S5' },
      { level: 'STAR_4', count: this.config.userLevels.star4, prefix: 'S4' },
      { level: 'STAR_3', count: this.config.userLevels.star3, prefix: 'S3' },
      { level: 'STAR_2', count: this.config.userLevels.star2, prefix: 'S2' },
      { level: 'STAR_1', count: this.config.userLevels.star1, prefix: 'S1' },
      { level: 'VIP', count: this.config.userLevels.vip, prefix: 'VIP' },
      { level: 'NORMAL', count: this.config.userLevels.normal, prefix: 'NU' }
    ];

    for (const { level, count, prefix } of levels) {
      for (let i = 0; i < count; i++) {
        const id = createId();
        const openid = `${prefix}_${faker.string.alphanumeric(20).toLowerCase()}`;

        const userData: GeneratedUser = {
          id,
          openid,
          nickname: faker.person.fullName(),
          avatarUrl: faker.image.avatar(),
          phone: faker.phone.number('1##########'),
          level,
          status: 'ACTIVE',
          parentId: currentParentId,
          teamPath: hierarchy.length > 0 ? hierarchy.join('/') + '/' + id : id,
          teamLevel: hierarchy.length + 1,
          totalSales: faker.number.float({ min: 0, max: 1000000, fractionDigits: 2 }),
          totalBottles: faker.number.int({ min: 0, max: 1000 }),
          directSales: faker.number.float({ min: 0, max: 100000, fractionDigits: 2 }),
          teamSales: faker.number.float({ min: 0, max: 500000, fractionDigits: 2 }),
          directCount: 0,
          teamCount: 0,
          cloudShopLevel: faker.helpers.arrayElement([1, 2, 3, 4, 5, 6]),
          hasWutongShop: faker.datatype.boolean(),
          pointsBalance: faker.number.float({ min: 0, max: 10000, fractionDigits: 2 }),
          pointsFrozen: 0,
          lastLoginAt: faker.date.recent({ days: 30 }),
          createdAt: now,
          updatedAt: now
        };

        users.push(userData);

        // 设置下一个层级的父级
        if (i === 0 && level !== 'NORMAL') {
          currentParentId = id;
          hierarchy.push(id);
        }
      }
    }

    // 计算团队人数
    for (let i = users.length - 1; i >= 0; i--) {
      const user = users[i];
      if (user.parentId) {
        const parent = users.find(u => u.id === user.parentId);
        if (parent) {
          parent.directCount++;
          parent.teamCount++;

          // 更新所有上级的团队人数
          let current = parent;
          while (current.parentId) {
            const grandParent = users.find(u => u.id === current.parentId);
            if (grandParent) {
              grandParent.teamCount++;
              current = grandParent;
            } else {
              break;
            }
          }
        }
      }
    }

    return users;
  }

  /**
   * 保存用户数据到数据库
   */
  private async saveUsers() {
    // 先保存所有用户，但不设置 parentId
    const batchSize = 50;
    const batches = Math.ceil(this.users.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = start + batchSize;
      const batch = this.users.slice(start, end);

      await Promise.all(batch.map(async (user) => {
        // 创建用户时不设置 parentId
        return prisma.users.create({
          data: {
            ...user,
            parentId: null,  // 暂时不设置父子关系
            teamPath: null,  // 暂时不设置团队路径
            hasWutongShop: user.hasWutongShop
          }
        });
      }));

      console.log(`  已保存 ${Math.min(end, this.users.length)}/${this.users.length} 个用户`);
    }

    // 然后更新用户的父子关系
    console.log('\n  更新用户层级关系...');
    for (const user of this.users) {
      if (user.parentId) {
        await prisma.users.update({
          where: { id: user.id },
          data: {
            parentId: user.parentId,
            teamPath: user.teamPath
          }
        });
      }
    }
    console.log('  ✓ 用户层级关系更新完成');
  }

  /**
   * 生成商品分类
   */
  private async generateCategories() {
    const categoryNames = [
      { name: '护肤品', description: '面部护理、身体护理产品', icon: 'skincare' },
      { name: '保健品', description: '营养保健、健康产品', icon: 'health' },
      { name: '食品饮料', description: '休闲食品、饮品饮料', icon: 'food' },
      { name: '家居用品', description: '日常生活用品', icon: 'home' },
      { name: '美妆彩妆', description: '化妆品、彩妆产品', icon: 'makeup' },
      { name: '母婴用品', description: '婴幼儿用品', icon: 'baby' },
      { name: '运动户外', description: '运动器材、户外用品', icon: 'sports' },
      { name: '数码电器', description: '数码产品、家用电器', icon: 'electronics' },
      { name: '服装鞋包', description: '服装、鞋类、箱包', icon: 'fashion' },
      { name: '图书音像', description: '图书、音像制品', icon: 'books' },
      { name: '汽车用品', description: '汽车相关用品', icon: 'auto' },
      { name: '办公文具', description: '办公用品、文具', icon: 'office' },
      { name: '宠物用品', description: '宠物食品、用品', icon: 'pet' },
      { name: '鲜花礼品', description: '鲜花、礼品', icon: 'gift' },
      { name: '五金建材', description: '五金工具、建材', icon: 'hardware' },
      { name: '玩具乐器', description: '玩具、乐器', icon: 'toy' },
      { name: '珠宝首饰', description: '珠宝、首饰', icon: 'jewelry' },
      { name: '医疗器械', description: '家用医疗器械', icon: 'medical' },
      { name: '农资产品', description: '农业相关产品', icon: 'agriculture' },
      { name: '工业设备', description: '工业机械设备', icon: 'industry' },
      { name: '其他商品', description: '其他类别商品', icon: 'other' }
    ];

    const categories = [];
    for (let i = 0; i < Math.min(categoryNames.length, this.config.productss.categories); i++) {
      const category = categoryNames[i];
      const saved = await prisma.productsssCategories.create({
        data: {
          id: createId(),
          name: category.name,
          level: 1,
          parentId: null,
          icon: category.icon,
          description: category.description,
          isActive: true,
          sort: i,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      categories.push(saved);
    }

    return categories;
  }

  /**
   * 生成商品数据
   */
  private generateProducts(): GeneratedProduct[] {
    const products: GeneratedProduct[] = [];
    const now = new Date();

    for (let i = 0; i < this.config.productss.productss; i++) {
      const basePrice = faker.number.float({ min: 50, max: 2000, fractionDigits: 2 });
      const category = this.categories[faker.number.int({ min: 0, max: this.categories.length - 1 })];

      const product: GeneratedProduct = {
        id: createId(),
        name: faker.commerce.productsName(),
        code: `PRD${faker.string.alphanumeric(8).toUpperCase()}`,
        sku: `SKU${faker.string.alphanumeric(8).toUpperCase()}`,
        description: faker.commerce.productsDescription(),
        basePrice,
        originalPrice: basePrice * faker.number.float({ min: 1.2, max: 2.0, fractionDigits: 2 }),
        costPrice: basePrice * faker.number.float({ min: 0.3, max: 0.6, fractionDigits: 2 }),
        status: 'ACTIVE',
        categoryId: category?.id || createId(),
        images: Array.from({ length: faker.number.int({ min: 1, max: 5 }) },
          () => faker.image.url({ width: 800, height: 600 })
        ),
        specifications: {
          brand: faker.company.name(),
          origin: faker.helpers.arrayElement(['中国', '日本', '韩国', '美国', '德国']),
          warranty: faker.helpers.arrayElement(['1年', '2年', '3年']),
          certification: faker.helpers.arrayElement(['ISO9001', 'CE', 'FCC', 'ROHS'])
        },
        shopType: 'CLOUD',
        createdBy: this.users[faker.number.int({ min: 0, max: this.users.length - 1 })].id,
        updatedBy: this.users[faker.number.int({ min: 0, max: this.users.length - 1 })].id,
        tags: faker.helpers.arrayElements(['热销', '新品', '推荐', '限量', '特价'], { min: 1, max: 3 }),
        isActive: true,
        featured: faker.datatype.boolean({ probability: 0.1 }),
        createdAt: now,
        updatedAt: now
      };

      products.push(product);
    }

    return products;
  }

  /**
   * 保存商品数据到数据库
   */
  private async saveProducts() {
    await Promise.all(
      this.productss.map(product =>
        prisma.productssss.create({
          data: {
            id: products.id,
            name: products.name,
            code: products.code,
            sku: products.sku,
            description: products.description,
            basePrice: products.basePrice,
            status: products.status,
            categoryId: products.categoryId,
            images: JSON.stringify(products.images),
            details: products.specsifications,
            shopType: products.shopType,
            createdBy: products.createdBy,
            updatedBy: products.updatedBy,
            tags: products.tags,
            isFeatured: products.featured,
            sort: 0,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt
          }
        })
      )
    );

    console.log(`  已保存 ${this.productss.length} 个商品`);
  }

  /**
   * 生成店铺数据
   */
  private generateShops(): GeneratedShop[] {
    const shops: GeneratedShop[] = [];
    const now = new Date();

    // 生成云店
    for (let i = 0; i < this.config.shops.cloud; i++) {
      const shop: GeneratedShop = {
        id: createId(),
        userId: this.users[faker.number.int({ min: 0, max: this.users.length - 1 })].id,
        shopType: 'CLOUD',
        shopName: `${faker.company.name()}云店`,
        shopLevel: faker.number.int({ min: 1, max: 6 }),
        status: 'ACTIVE',
        contactName: faker.person.fullName(),
        contactPhone: faker.phone.number('1##########'),
        address: faker.location.streetAddress(),
        createdAt: now,
        updatedAt: now
      };
      shops.push(shop);
    }

    // 生成五通店
    for (let i = 0; i < this.config.shops.wutong; i++) {
      const shop: GeneratedShop = {
        id: createId(),
        userId: this.users[faker.number.int({ min: 0, max: this.users.length - 1 })].id,
        shopType: 'WUTONG',
        shopName: `${faker.company.name()}五通店`,
        shopLevel: 1,
        status: 'ACTIVE',
        contactName: faker.person.fullName(),
        contactPhone: faker.phone.number('1##########'),
        address: faker.location.streetAddress(),
        createdAt: now,
        updatedAt: now
      };
      shops.push(shop);
    }

    return shops;
  }

  /**
   * 保存店铺数据到数据库
   */
  private async saveShops() {
    await Promise.all(
      this.shops.map(shop =>
        prisma.shops.create({
          data: shop
        })
      )
    );

    console.log(`  已保存 ${this.shops.length} 个店铺`);
  }

  /**
   * 生成订单数据
   */
  private async generateOrders() {
    const orderStatuses = [
      { status: 'PENDING', count: this.config.orders.pending },
      { status: 'PAID', count: this.config.orders.paid },
      { status: 'DELIVERED', count: this.config.orders.delivered },
      { status: 'CANCELLED', count: this.config.orders.cancelled }
    ];

    for (const { status, count } of orderStatuses) {
      for (let i = 0; i < count; i++) {
        const buyer = this.users[faker.number.int({ min: 0, max: this.users.length - 1 })];
        const product = this.productss[faker.number.int({ min: 0, max: this.productss.length - 1 })];
        const quantity = faker.number.int({ min: 1, max: 10 });
        const unitPrice = products.basePrice;
        const totalAmount = unitPrice * quantity;
        const discountAmount = totalAmount * faker.number.float({ min: 0, max: 0.3, fractionDigits: 2 });

        await prisma.orderss.create({
          data: {
            id: createId(),
            orderNo: `ORD${Date.now()}${faker.string.numeric(6)}`,
            buyerId: buyer.id,
            totalAmount,
            discountAmount,
            finalAmount: totalAmount - discountAmount,
            status,
            paymentStatus: status === OrderStatus.PENDING ? 'PENDING' : 'PAID',
            deliveryStatus: status === OrderStatus.DELIVERED ? 'DELIVERED' :
                          status === OrderStatus.PAID ? 'SHIPPING' : 'PENDING',
            deliveryAddress: {
              name: buyer.nickname,
              phone: buyer.phone,
              address: faker.location.streetAddress(),
              city: faker.location.city(),
              province: faker.location.state(),
              postalCode: faker.location.zipCode()
            },
            createdAt: faker.date.recent({ days: 30 }),
            updatedAt: new Date()
          }
        });
      }
    }

    console.log(`  已生成 ${Object.values(this.config.orders).reduce((a, b) => a + b, 0)} 个订单`);
  }

  /**
   * 生成积分交易记录
   */
  private async generateTransactions() {
    const transactionTypes = [
      { type: 'RECHARGE', count: 100 },
      { type: 'TRANSFER', count: 50 },
      { type: 'PURCHASE', count: 300 },
      { type: 'COMMISSION', count: 80 },
      { type: 'WITHDRAW', count: 20 }
    ];

    for (const { type, count } of transactionTypes) {
      for (let i = 0; i < count; i++) {
        const user = this.users[faker.number.int({ min: 0, max: this.users.length - 1 })];
        const amount = type === 'RECHARGE' || type === 'COMMISSION'
          ? faker.number.float({ min: 100, max: 10000, fractionDigits: 2 })
          : -faker.number.float({ min: 10, max: 5000, fractionDigits: 2 });

        await prisma.pointsTransactions.create({
          data: {
            id: createId(),
            userId: user.id,
            type,
            amount,
            balance: user.pointsBalance + amount,
            relatedUserId: type === 'TRANSFER'
              ? this.users[faker.number.int({ min: 0, max: this.users.length - 1 })].id
              : null,
            description: faker.lorem.sentence(),
            status: 'COMPLETED',
            metadata: {},
            createdAt: faker.date.recent({ days: 30 }),
            updatedAt: new Date()
          }
        });
      }
    }

    console.log(`  已生成 ${transactionTypes.reduce((a, b) => a + b.count, 0)} 条积分交易记录`);
  }

  /**
   * 生成库存数据
   */
  private async generateInventory() {
    for (const product of this.productss) {
      await prisma.inventoryItems.create({
        data: {
          id: createId(),
          productId: products.id,
          warehouseId: faker.helpers.arrayElement(['WH01', 'WH02', 'WH03']),
          availableQuantity: faker.number.int({ min: 0, max: 1000 }),
          totalQuantity: faker.number.int({ min: 100, max: 1000 }),
          reservedQuantity: faker.number.int({ min: 0, max: 100 }),
          lowStockThreshold: this.config.inventory.lowStockThreshold,
          unitCost: products.costPrice,
          batchNumber: `BATCH${faker.string.alphanumeric(8).toUpperCase()}`,
          expiryDate: faker.date.future({ years: 2 }),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }

    console.log(`  已生成 ${this.productss.length} 个库存记录`);
  }

  /**
   * 生成通知数据
   */
  private async generateNotifications() {
    const notificationTypes = ['INFO', 'WARNING', 'SUCCESS', 'ERROR'];

    for (let i = 0; i < 200; i++) {
      await prisma.notificationss.create({
        data: {
          id: createId(),
          userId: this.users[faker.number.int({ min: 0, max: this.users.length - 1 })].id,
          type: faker.helpers.arrayElement(notificationTypes),
          title: faker.lorem.words(5),
          content: faker.lorem.sentences(2),
          isRead: faker.datatype.boolean({ probability: 0.6 }),
          channel: 'APP',
          createdAt: faker.date.recent({ days: 30 }),
          updatedAt: new Date()
        }
      });
    }

    console.log(`  已生成 200 条通知记录`);
  }

  /**
   * 打印统计信息
   */
  private printStatistics() {
    console.log('\n📈 生成数据统计：');
    console.log(`  👥 用户总数: ${this.users.length}`);
    console.log(`    - 普通用户: ${this.users.filter(u => u.level === UserLevel.NORMAL).length}`);
    console.log(`    - VIP用户: ${this.users.filter(u => u.level === UserLevel.VIP).length}`);
    console.log(`    - 1星店长: ${this.users.filter(u => u.level === UserLevel.STAR_1).length}`);
    console.log(`    - 2星店长: ${this.users.filter(u => u.level === UserLevel.STAR_2).length}`);
    console.log(`    - 3星店长: ${this.users.filter(u => u.level === UserLevel.STAR_3).length}`);
    console.log(`    - 4星店长: ${this.users.filter(u => u.level === UserLevel.STAR_4).length}`);
    console.log(`    - 5星店长: ${this.users.filter(u => u.level === UserLevel.STAR_5).length}`);
    console.log(`    - 董事: ${this.users.filter(u => u.level === UserLevel.DIRECTOR).length}`);
    console.log(`  🏪 店铺总数: ${this.shops.length}`);
    console.log(`    - 云店: ${this.shops.filter(s => s.shopType === ShopType.CLOUD).length}`);
    console.log(`    - 五通店: ${this.shops.filter(s => s.shopType === ShopType.WUTONG).length}`);
    console.log(`  🛍️  商品总数: ${this.productss.length}`);
    console.log(`  📦 订单总数: ${Object.values(this.config.orders).reduce((a, b) => a + b, 0)}`);
  }
}

// 导出默认实例
export const testDataGenerator = new TestDataGenerator();