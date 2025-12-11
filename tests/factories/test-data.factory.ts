/**
 * 测试数据工厂
 * 提供完整的测试数据生成功能，支持各种业务场景
 */

import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { TestAuthHelper, TestUser } from '../helpers/auth.helper';

export class TestDataFactory {
  private prisma: PrismaClient;
  private static instance: TestDataFactory;
  private testUsers: Map<string, TestUser> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * 获取单例实例
   */
  static getInstance(prisma?: PrismaClient): TestDataFactory {
    if (!TestDataFactory.instance) {
      if (!prisma) {
        throw new Error('Prisma client is required for first initialization');
      }
      TestDataFactory.instance = new TestDataFactory(prisma);
    }
    return TestDataFactory.instance;
  }

  /**
   * 生成唯一ID
   */
  static generateUniqueId(prefix: string = 'test'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * 生成随机手机号
   */
  static generatePhoneNumber(): string {
    const prefixes = ['130', '131', '132', '133', '134', '135', '136', '137', '138', '139',
                      '150', '151', '152', '153', '155', '156', '157', '158', '159',
                      '180', '181', '182', '183', '184', '185', '186', '187', '188', '189'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return prefix + suffix;
  }

  /**
   * 生成随机金额
   */
  static generateAmount(min: number = 10, max: number = 10000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min + Math.random();
  }

  /**
   * 生成随机数字
   */
  static generateNumber(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 创建测试用户层级结构
   */
  async createUserHierarchy(): Promise<{
    director: TestUser;
    star5: TestUser;
    star4: TestUser;
    star3: TestUser;
    star2: TestUser;
    star1: TestUser;
    vip: TestUser;
    normal: TestUser;
  }> {
    const timestamp = Date.now();

    // 创建总监
    const director = await TestAuthHelper.createTestUser({
      phone: '18800000001',
      nickname: `测试总监_${timestamp}`,
      level: 'DIRECTOR',
      role: 'ADMIN',
      wechatOpenId: `test_director_${timestamp}`
    });

    // 创建5星级店长（隶属于总监）
    const star5 = await TestAuthHelper.createTestUser({
      phone: '18800000002',
      nickname: `测试5星店长_${timestamp}`,
      level: 'STAR_5',
      role: 'USER',
      wechatOpenId: `test_star5_${timestamp}`
    });

    // 创建4星级店长（隶属于5星）
    const star4 = await TestAuthHelper.createTestUser({
      phone: '18800000003',
      nickname: `测试4星店长_${timestamp}`,
      level: 'STAR_4',
      role: 'USER',
      wechatOpenId: `test_star4_${timestamp}`
    });

    // 创建3星级店长
    const star3 = await TestAuthHelper.createTestUser({
      phone: '18800000004',
      nickname: `测试3星店长_${timestamp}`,
      level: 'STAR_3',
      role: 'USER',
      wechatOpenId: `test_star3_${timestamp}`
    });

    // 创建2星级店长
    const star2 = await TestAuthHelper.createTestUser({
      phone: '18800000005',
      nickname: `测试2星店长_${timestamp}`,
      level: 'STAR_2',
      role: 'USER',
      wechatOpenId: `test_star2_${timestamp}`
    });

    // 创建1星级店长
    const star1 = await TestAuthHelper.createTestUser({
      phone: '18800000006',
      nickname: `测试1星店长_${timestamp}`,
      level: 'STAR_1',
      role: 'USER',
      wechatOpenId: `test_star1_${timestamp}`
    });

    // 创建VIP用户
    const vip = await TestAuthHelper.createTestUser({
      phone: '18800000007',
      nickname: `测试VIP用户_${timestamp}`,
      level: 'VIP',
      role: 'USER',
      wechatOpenId: `test_vip_${timestamp}`
    });

    // 创建普通用户
    const normal = await TestAuthHelper.createTestUser({
      phone: '18800000008',
      nickname: `测试普通用户_${timestamp}`,
      level: 'NORMAL',
      role: 'USER',
      wechatOpenId: `test_normal_${timestamp}`
    });

    // 更新用户层级关系
    await this.updateUserRelationships(director.id, star5.id, star4.id, star3.id, star2.id, star1.id, vip.id, normal.id);

    // 缓存测试用户
    this.testUsers.set('director', director);
    this.testUsers.set('star5', star5);
    this.testUsers.set('star4', star4);
    this.testUsers.set('star3', star3);
    this.testUsers.set('star2', star2);
    this.testUsers.set('star1', star1);
    this.testUsers.set('vip', vip);
    this.testUsers.set('normal', normal);

    return { director, star5, star4, star3, star2, star1, vip, normal };
  }

  /**
   * 更新用户层级关系
   */
  private async updateUserRelationships(
    directorId: string,
    star5Id: string,
    star4Id: string,
    star3Id: string,
    star2Id: string,
    star1Id: string,
    vipId: string,
    normalId: string
  ): Promise<void> {
    // 更新5星店长的父级为总监
    await this.prisma.users.update({
      where: { id: star5Id },
      data: { parentId: directorId, teamPath: `${directorId},${star5Id}` }
    });

    // 更新4星店长的父级为5星
    await this.prisma.users.update({
      where: { id: star4Id },
      data: { parentId: star5Id, teamPath: `${directorId},${star5Id},${star4Id}` }
    });

    // 更新3星店长的父级为4星
    await this.prisma.users.update({
      where: { id: star3Id },
      data: { parentId: star4Id, teamPath: `${directorId},${star5Id},${star4Id},${star3Id}` }
    });

    // 更新2星店长的父级为3星
    await this.prisma.users.update({
      where: { id: star2Id },
      data: { parentId: star3Id, teamPath: `${directorId},${star5Id},${star4Id},${star3Id},${star2Id}` }
    });

    // 更新1星店长的父级为2星
    await this.prisma.users.update({
      where: { id: star1Id },
      data: { parentId: star2Id, teamPath: `${directorId},${star5Id},${star4Id},${star3Id},${star2Id},${star1Id}` }
    });

    // 更新VIP用户的父级为1星
    await this.prisma.users.update({
      where: { id: vipId },
      data: { parentId: star1Id, teamPath: `${directorId},${star5Id},${star4Id},${star3Id},${star2Id},${star1Id},${vipId}` }
    });

    // 更新普通用户的父级为1星
    await this.prisma.users.update({
      where: { id: normalId },
      data: { parentId: star1Id, teamPath: `${directorId},${star5Id},${star4Id},${star3Id},${star2Id},${star1Id},${normalId}` }
    });
  }

  /**
   * 创建商品分类
   */
  async createProductCategories(): Promise<any[]> {
    const categories = [];
    const categoryData = [
      { name: '保健品', level: 1, description: '营养保健品' },
      { name: '护肤品', level: 1, description: '美容护肤产品' },
      { name: '家居用品', level: 1, description: '日常生活用品' },
      { name: '营养补充', level: 2, description: '维生素和矿物质补充剂', parent: '保健品' },
      { name: '面部护理', level: 2, description: '面部清洁和护理', parent: '护肤品' },
      { name: '清洁用品', level: 2, description: '家居清洁产品', parent: '家居用品' }
    ];

    for (const data of categoryData) {
      let parentId = null;
      if (data.parent) {
        const parentCategory = categories.find(c => c.name === data.parent);
        if (parentCategory) {
          parentId = parentCategory.id;
        }
      }

      const category = await this.prisma.productCategories.create({
        data: {
          id: TestDataFactory.generateUniqueId('cat'),
          name: data.name,
          description: data.description,
          level: data.level,
          parentId,
          icon: `${data.name}.png`,
          sort: categories.length + 1,
          isActive: true
        }
      });

      categories.push(category);
    }

    return categories;
  }

  /**
   * 创建测试商品
   */
  async createTestProducts(categories: any[], count: number = 10): Promise<any[]> {
    const products = [];

    for (let i = 0; i < count; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const product = await this.prisma.products.create({
        data: {
          id: TestDataFactory.generateUniqueId('prod'),
          name: `测试商品_${i + 1}`,
          description: `这是第${i + 1}个测试商品的详细描述`,
          code: `TEST-PROD-${(i + 1).toString().padStart(3, '0')}`,
          sku: `SKU-${(i + 1).toString().padStart(6, '0')}`,
          categoryId: category.id,
          basePrice: TestDataFactory.generateAmount(50, 500),
          vipPrice: TestDataFactory.generateAmount(40, 400),
          star1Price: TestDataFactory.generateAmount(45, 450),
          star2Price: TestDataFactory.generateAmount(43, 425),
          star3Price: TestDataFactory.generateAmount(41, 410),
          star4Price: TestDataFactory.generateAmount(39, 395),
          star5Price: TestDataFactory.generateAmount(37, 375),
          directorPrice: TestDataFactory.generateAmount(35, 350),
          totalStock: TestDataFactory.generateNumber(100, 1000),
          minStock: TestDataFactory.generateNumber(10, 50),
          images: JSON.stringify([`https://example.com/product${i + 1}.jpg`]),
          status: 'ACTIVE',
          sort: i + 1,
          tags: JSON.stringify(['热销', '推荐', '新品'])
        }
      });
      products.push(product);
    }

    return products;
  }

  /**
   * 创建店铺
   */
  async createShops(users: TestUser[]): Promise<any[]> {
    const shops = [];
    const shopTypes = ['CLOUD', 'WUTONG'];

    for (let i = 0; i < users.length && i < 5; i++) {
      const user = users[i];
      const shopType = shopTypes[Math.floor(Math.random() * shopTypes.length)];

      const shop = await this.prisma.shops.create({
        data: {
          id: TestDataFactory.generateUniqueId('shop'),
          name: `${user.nickname}的店铺`,
          type: shopType,
          ownerId: user.id,
          level: shopType === 'CLOUD' ? TestDataFactory.generateNumber(1, 5) : 1,
          status: 'ACTIVE',
          totalSales: TestDataFactory.generateAmount(1000, 10000),
          commissionRate: TestDataFactory.generateAmount(0.05, 0.15),
          description: '这是一个测试店铺',
          address: '测试地址123号',
          contactPhone: user.phone,
          businessLicense: 'TEST_LICENSE_' + Date.now(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      shops.push(shop);
    }

    return shops;
  }

  /**
   * 创建测试订单
   */
  async createTestOrders(users: TestUser[], products: any[], count: number = 20): Promise<any[]> {
    const orders = [];
    const statuses = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

    for (let i = 0; i < count; i++) {
      const user = users[Math.floor(Math.random() * users.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const quantity = TestDataFactory.generateNumber(1, 5);

      const order = await this.prisma.orders.create({
        data: {
          id: TestDataFactory.generateUniqueId('order'),
          orderNo: `TEST-${Date.now()}-${i.toString().padStart(3, '0')}`,
          buyerId: user.id,
          sellerId: users.find(u => u.level === 'STAR_3' || u.level === 'STAR_4' || u.level === 'STAR_5')?.id || user.id,
          totalAmount: product.basePrice * quantity,
          discountAmount: TestDataFactory.generateAmount(0, 50),
          finalAmount: product.basePrice * quantity - TestDataFactory.generateAmount(0, 50),
          status,
          paymentMethod: Math.random() > 0.5 ? 'WECHAT' : 'ALIPAY',
          paymentStatus: status === 'PENDING' ? 'UNPAID' : 'PAID',
          shippingAddress: JSON.stringify({
            province: '测试省',
            city: '测试市',
            district: '测试区',
            detail: '测试街道123号',
            receiver: user.nickname,
            phone: user.phone
          }),
          buyerNotes: `这是第${i + 1}个测试订单的备注`,
          createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // 随机7天内
          updatedAt: new Date()
        }
      });

      // 创建订单项
      await this.prisma.orderItems.create({
        data: {
          id: TestDataFactory.generateUniqueId('item'),
          orderId: order.id,
          productId: product.id,
          productName: product.name,
          productCode: product.code,
          quantity,
          unitPrice: product.basePrice,
          totalPrice: product.basePrice * quantity,
          createdAt: new Date()
        }
      });

      orders.push(order);
    }

    return orders;
  }

  /**
   * 创建积分交易记录
   */
  async createPointsTransactions(users: TestUser[], count: number = 50): Promise<any[]> {
    const transactions = [];
    const types = ['PURCHASE', 'TRANSFER', 'RECHARGE', 'WITHDRAW', 'COMMISSION', 'GIFT'];

    for (let i = 0; i < count; i++) {
      const fromUser = users[Math.floor(Math.random() * users.length)];
      const toUser = users[Math.floor(Math.random() * users.length)];
      const type = types[Math.floor(Math.random() * types.length)];

      const transaction = await this.prisma.pointsTransactions.create({
        data: {
          id: TestDataFactory.generateUniqueId('trans'),
          userId: type === 'TRANSFER' ? fromUser.id : toUser.id,
          type,
          amount: TestDataFactory.generateAmount(10, 1000),
          balance: TestDataFactory.generateAmount(1000, 10000),
          description: `测试${type}交易${i + 1}`,
          relatedOrderId: TestDataFactory.generateUniqueId('related'),
          fromUserId: type === 'TRANSFER' || type === 'GIFT' ? fromUser.id : null,
          toUserId: toUser.id,
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // 随机30天内
          updatedAt: new Date()
        }
      });

      transactions.push(transaction);
    }

    return transactions;
  }

  /**
   * 创建佣金记录
   */
  async createCommissionRecords(users: TestUser[], orders: any[]): Promise<any[]> {
    const commissions = [];

    for (let i = 0; i < Math.min(orders.length, 20); i++) {
      const order = orders[i];
      const user = users.find(u => u.id === order.buyerId);
      if (!user) continue;

      // 计算佣金比例
      let commissionRate = 0.05;
      if (user.level === 'VIP') commissionRate = 0.08;
      if (user.level?.startsWith('STAR_')) {
        const starLevel = parseInt(user.level.split('_')[1]);
        commissionRate = 0.1 + (starLevel * 0.02);
      }

      const commissionAmount = order.finalAmount * commissionRate;

      const commission = await this.prisma.commissions.create({
        data: {
          id: TestDataFactory.generateUniqueId('comm'),
          userId: user.id,
          orderId: order.id,
          orderNo: order.orderNo,
          amount: commissionAmount,
          rate: commissionRate,
          level: user.level,
          status: 'PENDING',
          type: 'DIRECT',
          description: `订单${order.orderNo}的直接佣金`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      commissions.push(commission);
    }

    return commissions;
  }

  /**
   * 创建完整的测试数据集
   */
  async createCompleteTestDataSet(): Promise<{
    users: TestUser[];
    categories: any[];
    products: any[];
    shops: any[];
    orders: any[];
    transactions: any[];
    commissions: any[];
  }> {
    console.log('🌱 开始创建完整测试数据集...');

    // 1. 创建用户层级结构
    const { director, star5, star4, star3, star2, star1, vip, normal } = await this.createUserHierarchy();
    const users = [director, star5, star4, star3, star2, star1, vip, normal];

    // 2. 创建商品分类
    const categories = await this.createProductCategories();

    // 3. 创建测试商品
    const products = await this.createTestProducts(categories, 15);

    // 4. 创建店铺
    const shops = await this.createShops([director, star5, star4, star3]);

    // 5. 创建测试订单
    const orders = await this.createTestOrders(users, products, 25);

    // 6. 创建积分交易记录
    const transactions = await this.createPointsTransactions(users, 60);

    // 7. 创建佣金记录
    const commissions = await this.createCommissionRecords(users, orders);

    console.log('✅ 完整测试数据集创建完成');
    console.log(`- 用户: ${users.length}个`);
    console.log(`- 分类: ${categories.length}个`);
    console.log(`- 商品: ${products.length}个`);
    console.log(`- 店铺: ${shops.length}个`);
    console.log(`- 订单: ${orders.length}个`);
    console.log(`- 交易: ${transactions.length}个`);
    console.log(`- 佣金: ${commissions.length}个`);

    return {
      users,
      categories,
      products,
      shops,
      orders,
      transactions,
      commissions
    };
  }

  /**
   * 清理所有测试数据
   */
  async cleanupAllTestData(): Promise<void> {
    const timestamp = Date.now();

    try {
      // 按依赖关系顺序清理
      await this.prisma.commissions.deleteMany({
        where: { id: { startsWith: 'comm_' } }
      });

      await this.prisma.pointsTransactions.deleteMany({
        where: { id: { startsWith: 'trans_' } }
      });

      await this.prisma.orderItems.deleteMany({
        where: { orderId: { startsWith: 'order_' } }
      });

      await this.prisma.orders.deleteMany({
        where: { orderNo: { startsWith: 'TEST-' } }
      });

      await this.prisma.shops.deleteMany({
        where: { id: { startsWith: 'shop_' } }
      });

      await this.prisma.products.deleteMany({
        where: { id: { startsWith: 'prod_' } }
      });

      await this.prisma.productCategories.deleteMany({
        where: { id: { startsWith: 'cat_' } }
      });

      await this.prisma.users.deleteMany({
        where: {
          OR: [
            { phone: { startsWith: '18800000' } },
            { nickname: { contains: '测试' } },
            { openid: { startsWith: 'test_' } }
          ]
        }
      });

      console.log(`✅ 测试数据清理完成，耗时: ${Date.now() - timestamp}ms`);
    } catch (error) {
      console.error('❌ 清理测试数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取缓存的测试用户
   */
  getTestUser(type: string): TestUser | undefined {
    return this.testUsers.get(type);
  }

  /**
   * 获取所有测试用户
   */
  getAllTestUsers(): Map<string, TestUser> {
    return new Map(this.testUsers);
  }
}

export default TestDataFactory;