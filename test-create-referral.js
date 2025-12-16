const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'dev_user',
  password: 'dev_password_123',
  database: 'zhongdao_mall_dev'
});

async function createReferral() {
  return new Promise((resolve, reject) => {
    connection.query(
      `INSERT INTO users (id, openid, phone, nickname, referral_code, level, status, created_at, updated_at)
       VALUES ('test_referrer_001', 'openid_test_001', '13900139000', '测试推荐人', '6GLKU9', 'VIP', 'ACTIVE', NOW(), NOW())
       ON DUPLICATE KEY UPDATE referral_code = '6GLKU9', level = 'VIP', status = 'ACTIVE'`,
      (err, results) => {
        if (err) {
          reject(err);
        } else {
          console.log('创建/更新成功');
          resolve(results);
        }
      }
    );
  });
}

async function checkUser() {
  return new Promise((resolve, reject) => {
    connection.query(
      'SELECT id, nickname, referral_code, level, status FROM users WHERE referral_code = ?',
      ['6GLKU9'],
      (err, results) => {
        if (err) {
          reject(err);
        } else {
          console.log('查询结果:', results);
          resolve(results);
        }
      }
    );
  });
}

async function main() {
  try {
    await createReferral();
    await checkUser();
  } catch (error) {
    console.error('错误:', error);
  } finally {
    connection.end();
  }
}

main();