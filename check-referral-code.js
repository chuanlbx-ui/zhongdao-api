const mysql = require('mysql2/promise');

async function checkReferralCode() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'dev_user',
    password: 'dev_password_123',
    database: 'zhongdao_mall_dev'
  });

  try {
    console.log('正在查询推荐码 6GLKU9...');

    const [rows] = await connection.execute(
      'SELECT id, nickname, referral_code, level, status, phone FROM users WHERE referral_code = ?',
      ['6GLKU9']
    );

    if (rows.length > 0) {
      const user = rows[0];
      console.log('找到用户:');
      console.log('ID:', user.id);
      console.log('昵称:', user.nickname);
      console.log('推荐码:', user.referral_code);
      console.log('级别:', user.level);
      console.log('状态:', user.status);
      console.log('手机号:', user.phone);
    } else {
      console.log('未找到推荐码为 6GLKU9 的用户');
    }

    // 查询所有有推荐码的用户
    console.log('\n正在查询所有有推荐码的用户...');
    const [allUsers] = await connection.execute(
      'SELECT id, nickname, referral_code, level, status FROM users WHERE referral_code IS NOT NULL LIMIT 20'
    );

    console.log(`找到 ${allUsers.length} 个有推荐码的用户:`);
    allUsers.forEach(u => {
      console.log(`- ${u.nickname} (${u.referral_code}) - ${u.level} - ${u.status}`);
    });

  } catch (error) {
    console.error('错误:', error);
  } finally {
    await connection.end();
  }
}

checkReferralCode();