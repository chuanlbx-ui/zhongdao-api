const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'dev_user',
  password: 'dev_password_123',
  database: 'zhongdao_mall_dev'
};

async function initUsers() {
  let connection;

  try {
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 检查users表是否存在
    const [tables] = await connection.execute("SHOW TABLES LIKE 'users'");
    if (tables.length === 0) {
      console.log('❌ users表不存在');
      return;
    }
    console.log('✅ users表存在');

    // 清理旧测试数据
    await connection.execute(
      "DELETE FROM users WHERE openid LIKE 'test_%'"
    );
    console.log('✅ 清理旧测试数据');

    // 插入测试用户
    const testUsers = [
      [
        'test_001',
        'test_openid_001',
        '张三',
        '13800138001',
        'https://ui-avatars.com/api/?name=张三&background=1890ff',
        'NORMAL',
        'ACTIVE',
        null,
        null,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        100,
        0,
        new Date(),
        new Date(),
        'TEST001'
      ],
      [
        'test_002',
        'test_openid_002',
        '李四',
        '13800138002',
        'https://ui-avatars.com/api/?name=李四&background=52c41a',
        'VIP',
        'ACTIVE',
        'test_001',
        'test_001',
        2,
        5000,
        50,
        5000,
        5000,
        5,
        10,
        1500,
        0,
        new Date(),
        new Date(),
        'TEST002'
      ],
      [
        'test_003',
        'test_openid_003',
        '王五',
        '13800138003',
        'https://ui-avatars.com/api/?name=王五&background=faad14',
        'STAR_1',
        'ACTIVE',
        'test_001',
        'test_001',
        2,
        15000,
        150,
        15000,
        15000,
        15,
        30,
        3200,
        0,
        new Date(),
        new Date(),
        'TEST003'
      ],
      [
        'test_004',
        'test_openid_004',
        '赵六',
        '13800138004',
        'https://ui-avatars.com/api/?name=赵六&background=13c2c2',
        'STAR_2',
        'ACTIVE',
        'test_001',
        'test_001',
        2,
        50000,
        500,
        50000,
        50000,
        25,
        60,
        8500,
        0,
        new Date(),
        new Date(),
        'TEST004'
      ],
      [
        'test_005',
        'test_openid_005',
        '钱七',
        '13800138005',
        'https://ui-avatars.com/api/?name=钱七&background=722ed1',
        'STAR_3',
        'ACTIVE',
        'test_001',
        'test_001',
        2,
        120000,
        1200,
        120000,
        120000,
        40,
        100,
        15000,
        0,
        new Date(),
        new Date(),
        'TEST005'
      ],
      [
        'test_006',
        'test_openid_006',
        '孙八',
        '13800138006',
        'https://ui-avatars.com/api/?name=孙八&background=8c8c8c',
        'NORMAL',
        'ACTIVE',
        'test_002',
        'test_001,test_002',
        3,
        800,
        8,
        800,
        800,
        2,
        4,
        200,
        0,
        new Date(),
        new Date(),
        'TEST006'
      ]
    ];

    // 插入数据
    const sql = `
      INSERT INTO users (
        id, openid, nickname, phone, avatarUrl, level, status,
        parentId, teamPath, teamLevel, totalSales, totalBottles,
        directSales, teamSales, directCount, teamCount,
        pointsBalance, pointsFrozen, createdAt, updatedAt, referralCode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const user of testUsers) {
      await connection.execute(sql, user);
      console.log(`✅ 创建用户: ${user[2]} (${user[5]})`);
    }

    // 查询总用户数
    const [rows] = await connection.execute("SELECT COUNT(*) as count FROM users");
    console.log(`\n📊 数据库中总用户数: ${rows[0].count}`);

    // 按等级统计
    const [stats] = await connection.execute("SELECT level, COUNT(*) as count FROM users GROUP BY level");
    console.log('\n📊 用户等级分布:');
    stats.forEach(stat => {
      console.log(`  ${stat.level}: ${stat.count} 人`);
    });

    console.log('\n✅ 测试数据创建成功！');

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 运行初始化
console.log('🚀 开始初始化用户数据...\n');
initUsers();