const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/v1';

// 测试用户数据
const testUsers = [
  {
    openid: 'wx_test_user_001',
    nickname: '测试用户1',
    phone: '13800000101',
    avatarUrl: 'https://example.com/avatar1.jpg',
    referralCode: null // 第一个用户不需要推荐码
  },
  {
    openid: 'wx_test_user_002',
    nickname: '测试用户2',
    phone: '13800000102',
    avatarUrl: 'https://example.com/avatar2.jpg',
    referralCode: null // 将在测试中设置
  },
  {
    openid: 'wx_test_user_003',
    nickname: '测试用户3',
    phone: '13800000103',
    avatarUrl: 'https://example.com/avatar3.jpg',
    referralCode: null // 将在测试中设置
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testUserRegistration(userData, referralCode = null) {
  try {
    const payload = { ...userData };
    if (referralCode) {
      payload.referralCode = referralCode;
    }

    console.log(`\n📝 注册用户: ${userData.nickname}`);
    if (referralCode) {
      console.log(`🔗 使用推荐码: ${referralCode}`);
    }

    const response = await axios.post(`${API_BASE}/users/register`, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ 注册成功:', {
      id: response.data.data.user.id,
      nickname: response.data.data.user.nickname,
      referralCode: response.data.data.user.referralCode,
      level: response.data.data.user.level,
      teamLevel: response.data.data.user.teamLevel
    });

    if (response.data.data.referrer) {
      console.log('👤 推荐人:', response.data.data.referrer);
    }

    return response.data.data;

  } catch (error) {
    console.error('❌ 注册失败:', error.response?.data || error.message);
    throw error;
  }
}

async function testReferralCodeValidation(referralCode) {
  try {
    console.log(`\n🔍 验证推荐码: ${referralCode}`);

    const response = await axios.post(`${API_BASE}/users/validate-referral`, {
      referralCode
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ 推荐码验证成功:', {
      valid: response.data.data.valid,
      referrer: response.data.data.referrer
    });

    return response.data.data;

  } catch (error) {
    console.error('❌ 推荐码验证失败:', error.response?.data || error.message);
    return { valid: false };
  }
}

async function main() {
  console.log('🚀 开始测试用户注册和推荐系统...\n');

  try {
    // 1. 注册第一个用户（无推荐码）
    console.log('=== 步骤1: 注册种子用户（无推荐码） ===');
    const user1 = await testUserRegistration(testUsers[0]);
    const seedReferralCode = user1.user.referralCode;
    console.log(`🌱 种子用户推荐码: ${seedReferralCode}`);

    await sleep(1000);

    // 2. 验证种子用户的推荐码
    console.log('\n=== 步骤2: 验证种子用户推荐码 ===');
    const validation1 = await testReferralCodeValidation(seedReferralCode);

    await sleep(1000);

    // 3. 使用种子用户推荐码注册第二个用户
    console.log('\n=== 步骤3: 使用种子推荐码注册用户2 ===');
    testUsers[1].referralCode = seedReferralCode;
    const user2 = await testUserRegistration(testUsers[1], seedReferralCode);
    const user2ReferralCode = user2.user.referralCode;
    console.log(`👥 用户2推荐码: ${user2ReferralCode}`);

    await sleep(1000);

    // 4. 验证用户2的推荐码
    console.log('\n=== 步骤4: 验证用户2推荐码 ===');
    const validation2 = await testReferralCodeValidation(user2ReferralCode);

    await sleep(1000);

    // 5. 使用用户2的推荐码注册第三个用户
    console.log('\n=== 步骤5: 使用用户2推荐码注册用户3 ===');
    testUsers[2].referralCode = user2ReferralCode;
    const user3 = await testUserRegistration(testUsers[2], user2ReferralCode);
    console.log(`🔗 用户3的推荐关系: parent=${user3.user.parentId}, teamLevel=${user3.user.teamLevel}`);

    await sleep(1000);

    // 6. 测试无效推荐码
    console.log('\n=== 步骤6: 测试无效推荐码 ===');
    await testReferralCodeValidation('999999');

    await sleep(1000);

    // 7. 测试注册时的推荐码验证
    console.log('\n=== 步骤7: 测试注册时的无效推荐码 ===');
    try {
      await testUserRegistration({
        openid: 'wx_test_invalid_001',
        nickname: '无效推荐码用户',
        phone: '13800000999'
      }, '999999');
    } catch (error) {
      console.log('✅ 正确拒绝了无效推荐码');
    }

    await sleep(1000);

    // 8. 测试重复openid注册
    console.log('\n=== 步骤8: 测试重复openid注册 ===');
    try {
      await testUserRegistration(testUsers[0], seedReferralCode);
    } catch (error) {
      console.log('✅ 正确拒绝了重复openid');
    }

    console.log('\n🎉 所有测试完成！');
    console.log('\n📊 测试结果总结:');
    console.log(`- 种子用户: ${user1.user.nickname} (推荐码: ${seedReferralCode})`);
    console.log(`- 二级用户: ${user2.user.nickname} (推荐码: ${user2ReferralCode})`);
    console.log(`- 三级用户: ${user3.user.nickname}`);
    console.log(`- 推荐链: ${user1.user.nickname} → ${user2.user.nickname} → ${user3.user.nickname}`);

  } catch (error) {
    console.error('\n❌ 测试过程中出现错误:', error.message);
  }
}

main();