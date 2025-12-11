// 调试认证问题
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/v1`;

// 真实用户令牌
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4bGV4YjM1dmFjMmpxNDB3bmdyMXNmY2EiLCJwaG9uZSI6IjEzODAwMTM4MDAwIiwicm9sZSI6IkRJUkVDVE9SIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI1NzgzOCwiZXhwIjoxNzY1MzQ0MjM4LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.d2GwpfY22E09Oilo40AVF-ETp6uewYbbvWLxZKhRYCg';
const NORMAL_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmJhZnZwMGdyZmMzOWloaHI4OWhiZ2IiLCJwaG9uZSI6IjEtNTM5LTM5NC00MDkyIHg4MTk0MCIsInJvbGUiOiJOT1JNQUwiLCJsZXZlbCI6Ik5PUk1BTCIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NTI1NzgzOCwiZXhwIjoxNzY1MzQ0MjM4LCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.w39BrN7-bzoy8m1l0gHxOV7mCKXLoYzr8UESJHuyNo0';

// 解码JWT token查看内容
const jwt = require('jsonwebtoken');

console.log('🔑 调试认证问题\n');

console.log('管理员Token内容:');
try {
  const adminDecoded = jwt.decode(ADMIN_TOKEN, { complete: true });
  console.log(JSON.stringify(adminDecoded, null, 2));
} catch (error) {
  console.log('解码失败:', error.message);
}

console.log('\n普通用户Token内容:');
try {
  const normalDecoded = jwt.decode(NORMAL_TOKEN, { complete: true });
  console.log(JSON.stringify(normalDecoded, null, 2));
} catch (error) {
  console.log('解码失败:', error.message);
}

// 测试API调用
async function testAuth() {
  console.log('\n📡 测试API调用:');

  // 测试管理员用户
  try {
    console.log('\n1. 测试管理员 /users/me:');
    const adminResponse = await axios.get(`${API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log('✅ 成功!');
    console.log('用户数据:', JSON.stringify(adminResponse.data, null, 2));
    console.log('用户等级:', adminResponse.data.data.level);

  } catch (error) {
    console.log('❌ 失败:', error.message);
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('错误数据:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // 测试普通用户
  try {
    console.log('\n2. 测试普通用户 /users/me:');
    const normalResponse = await axios.get(`${API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${NORMAL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log('✅ 成功!');
    console.log('用户数据:', JSON.stringify(normalResponse.data, null, 2));
    console.log('用户等级:', normalResponse.data.data.level);

  } catch (error) {
    console.log('❌ 失败:', error.message);
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('错误数据:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // 测试无认证
  try {
    console.log('\n3. 测试无认证访问 /users/me:');
    await axios.get(`${API_BASE}/users/me`, {
      timeout: 5000
    });

    console.log('❌ 应该需要认证!');
  } catch (error) {
    if (error.response?.status === 401) {
      console.log('✅ 正确要求认证');
    } else {
      console.log('❌ 意外错误:', error.message);
    }
  }
}

testAuth().catch(console.error);