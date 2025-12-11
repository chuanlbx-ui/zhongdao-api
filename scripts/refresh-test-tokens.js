/**
 * 自动刷新测试中的JWT token
 * 解决测试中token过期问题
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// JWT配置
const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';
const JWT_EXPIRES_IN = '24h';
const ISSUER = 'zhongdao-mall-test';
const AUDIENCE = 'zhongdao-mall-users';

// 测试用户配置
const TEST_USERS = {
  normal: {
    sub: 'crho9e2hrp50xqkh2xum9rbp',
    phone: '13800138001',
    role: 'USER',
    level: 'NORMAL',
    scope: ['active', 'user'],
    type: 'access'
  },
  admin: {
    sub: 'ja4x4705a4emvkga2e73une',
    phone: '13800138888',
    role: 'ADMIN',
    level: 'DIRECTOR',
    scope: ['active', 'user'],
    type: 'access'
  }
};

/**
 * 生成JWT token
 */
function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithm: 'HS256'
  });
}

/**
 * 验证token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE
    });
  } catch (error) {
    return null;
  }
}

/**
 * 检查token是否即将过期（6小时内）
 */
function isTokenExpiringSoon(token) {
  const decoded = verifyToken(token);
  if (!decoded) return true; // 无效token，认为已过期

  const now = Math.floor(Date.now() / 1000);
  const sixHoursLater = now + (6 * 60 * 60);

  return decoded.exp < sixHoursLater;
}

/**
 * 更新测试文件中的token
 */
function updateTokensInFile(filePath, tokens) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = false;

    // 更新普通用户token
    const normalTokenRegex = /normalUserToken\s*=\s*['"]([^'"]+)['"];?/;
    const normalMatch = content.match(normalTokenRegex);
    if (normalMatch) {
      const oldToken = normalMatch[1];
      if (isTokenExpiringSoon(oldToken)) {
        console.log(`📱 更新普通用户token在 ${filePath}`);
        content = content.replace(
          normalTokenRegex,
          `normalUserToken = '${tokens.normal}';`
        );
        updated = true;
      }
    }

    // 更新管理员token
    const adminTokenRegex = /adminToken\s*=\s*['"]([^'"]+)['"];?/;
    const adminMatch = content.match(adminTokenRegex);
    if (adminMatch) {
      const oldToken = adminMatch[1];
      if (isTokenExpiringSoon(oldToken)) {
        console.log(`👑 更新管理员token在 ${filePath}`);
        content = content.replace(
          adminTokenRegex,
          `adminToken = '${tokens.admin}';`
        );
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 已更新: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️  跳过: ${filePath} (token仍有效)`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 更新失败 ${filePath}:`, error.message);
    return false;
  }
}

/**
 * 扫描并更新所有测试文件
 */
function scanAndUpdateTokens(testDir = 'tests/api') {
  console.log('🔍 扫描测试文件中的过期token...\n');

  // 生成新的token
  const newTokens = {
    normal: generateToken(TEST_USERS.normal),
    admin: generateToken(TEST_USERS.admin)
  };

  console.log('✨ 新token生成完成:');
  console.log(`   - 普通用户token: ${newTokens.normal.substring(0, 50)}...`);
  console.log(`   - 管理员token: ${newTokens.admin.substring(0, 50)}...`);
  console.log('\n');

  let updatedCount = 0;

  // 扫描目录
  function scanDirectory(dir) {
    try {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          scanDirectory(filePath);
        } else if (file.endsWith('.test.ts') || file.endsWith('.test.js')) {
          if (updateTokensInFile(filePath, newTokens)) {
            updatedCount++;
          }
        }
      }
    } catch (error) {
      console.error(`❌ 扫描目录失败 ${dir}:`, error.message);
    }
  }

  scanDirectory(testDir);

  console.log('\n' + '='.repeat(50));
  console.log(`📊 更新总结:`);
  console.log(`   - 扫描目录: ${testDir}`);
  console.log(`   - 更新文件: ${updatedCount} 个`);

  if (updatedCount > 0) {
    console.log('\n✅ Token刷新完成！现在可以运行测试了。');
    console.log('💡 建议运行命令: npm test');
  } else {
    console.log('\n✅ 所有token都是最新的，无需更新。');
  }

  return updatedCount;
}

/**
 * 显示token信息
 */
function showTokenInfo(token, label) {
  const decoded = verifyToken(token);
  if (decoded) {
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    const hoursUntilExpiry = Math.floor(timeUntilExpiry / 3600);
    const minutesUntilExpiry = Math.floor((timeUntilExpiry % 3600) / 60);

    console.log(`${label}:`);
    console.log(`   - 用户ID: ${decoded.sub}`);
    console.log(`   - 手机号: ${decoded.phone}`);
    console.log(`   - 角色: ${decoded.role}`);
    console.log(`   - 等级: ${decoded.level}`);
    console.log(`   - 剩余时间: ${hoursUntilExpiry}小时${minutesUntilExpiry}分钟`);
    console.log(`   - 过期时间: ${new Date(decoded.exp * 1000).toLocaleString()}`);
  } else {
    console.log(`${label}: ❌ 无效或已过期`);
  }
}

// 主程序
function main() {
  const command = process.argv[2] || 'scan';

  switch (command) {
    case 'scan':
      scanAndUpdateTokens();
      break;

    case 'check':
      console.log('🔍 检查当前token状态...\n');

      // 检查products.test.ts中的token
      try {
        const content = fs.readFileSync('tests/api/products.test.ts', 'utf8');

        const normalTokenMatch = content.match(/normalUserToken\s*=\s*['"]([^'"]+)['"];?/);
        const adminTokenMatch = content.match(/adminToken\s*=\s*['"]([^'"]+)['"];?/);

        if (normalTokenMatch) {
          showTokenInfo(normalTokenMatch[1], '📱 普通用户Token');
        }

        if (adminTokenMatch) {
          showTokenInfo(adminTokenMatch[1], '👑 管理员Token');
        }
      } catch (error) {
        console.error('❌ 读取测试文件失败:', error.message);
      }
      break;

    case 'generate':
      console.log('🔄 生成新的token...\n');

      const newTokens = {
        normal: generateToken(TEST_USERS.normal),
        admin: generateToken(TEST_USERS.admin)
      };

      console.log('新生成的Token:');
      console.log(`\n普通用户Token:\n${newTokens.normal}`);
      console.log(`\n管理员Token:\n${newTokens.admin}`);
      console.log('\n');
      console.log('请手动复制到测试文件中。');
      break;

    default:
      console.log('使用方法:');
      console.log('  node scripts/refresh-test-tokens.js scan    # 扫描并更新过期token');
      console.log('  node scripts/refresh-test-tokens.js check   # 检查当前token状态');
      console.log('  node scripts/refresh-test-tokens.js generate # 生成新token');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  scanAndUpdateTokens,
  generateToken,
  verifyToken,
  isTokenExpiringSoon
};