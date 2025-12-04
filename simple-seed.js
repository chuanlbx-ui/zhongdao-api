const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createBasicData() {
  console.log('🚀 开始创建基础测试数据...\n');

  try {
    // 1. 创建管理员账户
    console.log('👑 创建管理员账户...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.admin.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        password: adminPassword,
        realName: '系统管理员',
        email: 'admin@zhongdao.com',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        permissions: JSON.stringify({
          user: ['read', 'write', 'delete'],
          shop: ['read', 'write', 'delete'],
          product: ['read', 'write', 'delete'],
          order: ['read', 'write', 'delete'],
          payment: ['read', 'write', 'delete'],
          system: ['read', 'write', 'delete']
        })
      }
    });
    console.log(`✓ 管理员账户创建成功: ${admin.username}`);

    // 2. 创建测试用户
    console.log('\n👤 创建测试用户...');
    const testUsers = [
      {
        openid: 'test_director_001',
        nickname: '测试总监',
        phone: '13800000001',
        referralCode: 'DIRECTOR001',
        level: 'DIRECTOR',
        pointsBalance: 10000,
        totalSales: 50000,
        totalBottles: 100
      },
      {
        openid: 'test_star5_001',
        nickname: '五星店长',
        phone: '13800000002',
        referralCode: 'STAR5001',
        level: 'STAR_5',
        pointsBalance: 5000,
        totalSales: 30000,
        totalBottles: 60
      },
      {
        openid: 'test_star3_001',
        nickname: '三星店长',
        phone: '13800000003',
        referralCode: 'STAR3001',
        level: 'STAR_3',
        pointsBalance: 2000,
        totalSales: 15000,
        totalBottles: 30
      },
      {
        openid: 'test_vip_001',
        nickname: 'VIP会员',
        phone: '13800000004',
        referralCode: 'VIP001',
        level: 'VIP',
        pointsBalance: 500,
        totalSales: 3000,
        totalBottles: 6
      },
      {
        openid: 'test_normal_001',
        nickname: '普通用户',
        phone: '13800000005',
        referralCode: 'NORMAL001',
        level: 'NORMAL',
        pointsBalance: 100,
        totalSales: 0,
        totalBottles: 0
      }
    ];

    const createdUsers = [];
    for (const userData of testUsers) {
      const user = await prisma.users.upsert({
        where: { phone: userData.phone },
        update: userData,
        create: {
          ...userData,
          status: 'ACTIVE',
          teamLevel: 1,
          directSales: userData.totalSales * 0.3,
          teamSales: userData.totalSales,
          directCount: Math.floor(Math.random() * 10),
          teamCount: Math.floor(Math.random() * 50),
          cloudShopLevel: userData.level.includes('STAR') ? parseInt(userData.level.split('_')[1]) : null,
          hasWutongShop: ['DIRECTOR', 'STAR_5'].includes(userData.level)
        }
      });
      createdUsers.push(user);
      console.log(`✓ 创建用户: ${user.nickname} (${user.level})`);
    }

    // 3. 设置推荐关系
    console.log('\n🔗 设置推荐关系...');
    await prisma.users.update({
      where: { phone: '13800000002' },
      data: { parentId: createdUsers.find(u => u.level === 'DIRECTOR').id }
    });
    await prisma.users.update({
      where: { phone: '13800000003' },
      data: { parentId: createdUsers.find(u => u.level === 'STAR_5').id }
    });
    await prisma.users.update({
      where: { phone: '13800000004' },
      data: { parentId: createdUsers.find(u => u.level === 'STAR_3').id }
    });
    await prisma.users.update({
      where: { phone: '13800000005' },
      data: { parentId: createdUsers.find(u => u.level === 'VIP').id }
    });
    console.log('✓ 推荐关系设置完成');

    // 4. 创建商品分类
    console.log('\n📂 创建商品分类...');
    const categories = [
      { name: '护肤品', level: 1, description: '面部护理、身体护理产品', icon: 'skincare' },
      { name: '保健品', level: 1, description: '营养保健、健康产品', icon: 'health' },
      { name: '食品饮料', level: 1, description: '休闲食品、饮品饮料', icon: 'food' },
      { name: '家居用品', level: 1, description: '家庭生活用品', icon: 'home' },
      { name: '服装鞋包', level: 1, description: '服装、鞋类、箱包', icon: 'fashion' }
    ];

    const createdCategories = [];
    for (const category of categories) {
      const created = await prisma.productCategory.create({
        data: {
          ...category,
          isActive: true,
          sort: createdCategories.length
        }
      });
      createdCategories.push(created);
      console.log(`✓ 创建分类: ${created.name}`);
    }

    // 5. 创建店铺
    console.log('\n🏪 创建店铺...');
    const director = createdUsers.find(u => u.level === 'DIRECTOR');
    const star5 = createdUsers.find(u => u.level === 'STAR_5');
    const star3 = createdUsers.find(u => u.level === 'STAR_3');

    const shops = [
      {
        userId: director.id,
        shopType: 'CLOUD',
        shopName: '总监云店',
        contactName: director.nickname,
        contactPhone: director.phone,
        totalSales: 50000,
        totalOrders: 100,
        totalRevenue: 30000,
        status: 'ACTIVE'
      },
      {
        userId: star5.id,
        shopType: 'CLOUD',
        shopName: '五星云店',
        contactName: star5.nickname,
        contactPhone: star5.phone,
        totalSales: 30000,
        totalOrders: 60,
        totalRevenue: 18000,
        status: 'ACTIVE'
      },
      {
        userId: star3.id,
        shopType: 'WUTONG',
        shopName: '三星五通店',
        contactName: star3.nickname,
        contactPhone: star3.phone,
        totalSales: 15000,
        totalOrders: 30,
        totalRevenue: 9000,
        status: 'ACTIVE'
      }
    ];

    const createdShops = [];
    for (const shopData of shops) {
      const shop = await prisma.shop.create({
        data: shopData
      });
      createdShops.push(shop);
      console.log(`✓ 创建店铺: ${shop.shopName} (${shop.shopType})`);
    }

    // 6. 创建系统配置
    console.log('\n⚙️ 创建系统配置...');
    const configs = [
      {
        key: 'user_levels',
        value: JSON.stringify({
          NORMAL: { name: '普通会员', benefits: ['基础购买权'] },
          VIP: { name: 'VIP会员', benefits: ['基础购买权', 'VIP专享价'] },
          STAR_1: { name: '一星店长', benefits: ['基础购买权', 'VIP专享价', '云店权限'] },
          STAR_2: { name: '二星店长', benefits: ['基础购买权', 'VIP专享价', '云店权限', '团队管理'] },
          STAR_3: { name: '三星店长', benefits: ['基础购买权', 'VIP专享价', '云店权限', '团队管理', '区域代理'] },
          STAR_4: { name: '四星店长', benefits: ['基础购买权', 'VIP专享价', '云店权限', '团队管理', '区域代理', '培训权限'] },
          STAR_5: { name: '五星店长', benefits: ['基础购买权', 'VIP专享价', '云店权限', '团队管理', '区域代理', '培训权限', '战略合作'] },
          DIRECTOR: { name: '董事', benefits: ['全部权益'] }
        }),
        type: 'JSON',
        category: 'levels',
        description: '用户等级配置',
        isSystem: true
      },
      {
        key: 'points_config',
        value: JSON.stringify({
          recharge: { rate: 1, min: 100, max: 50000 },
          transfer: { fee: 0.01, min: 10, max: 10000 },
          withdraw: { fee: 0.02, min: 100, max: 20000 }
        }),
        type: 'JSON',
        category: 'points',
        description: '积分系统配置',
        isSystem: true
      },
      {
        key: 'shop_requirements',
        value: JSON.stringify({
          CLOUD: { minLevel: 'VIP', minSales: 1000, minTeam: 5 },
          WUTONG: { minLevel: 'STAR_1', minSales: 5000, oneTimePurchase: 50000 }
        }),
        type: 'JSON',
        category: 'shop',
        description: '店铺开通条件',
        isSystem: true
      }
    ];

    for (const config of configs) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: config,
        create: config
      });
      console.log(`✓ 创建配置: ${config.key}`);
    }

    console.log('\n🎉 基础测试数据创建完成！');
    console.log('\n🔑 测试账号信息:');
    console.log('   管理员: admin / admin123');
    console.log('   测试用户:');
    createdUsers.forEach(user => {
      console.log(`     ${user.nickname} (${user.level}): ${user.phone}`);
    });
    console.log('   所有用户默认密码: 无密码（微信登录）');

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error);
    throw error;
  }
}

// 运行脚本
createBasicData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });