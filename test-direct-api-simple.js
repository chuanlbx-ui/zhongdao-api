const axios = require('axios');

// 测试函数
async function testEndpoints() {
  console.log('测试API端点是否可达...\n');

  const baseURL = 'http://localhost:3000/api/v1';

  try {
    // 测试用户端点
    console.log('1. 测试 /users/me');
    try {
      const response = await axios.get(`${baseURL}/users/me`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('✓ /users/me 端点存在 (状态码:', response.status, ')');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✓ /users/me 端点存在 (返回401认证错误，说明端点正常)');
      } else if (error.response && error.response.status === 404) {
        console.log('✗ /users/me 端点不存在 (404)');
      } else {
        console.log('✗ /users/me 测试失败:', error.message);
      }
    }

    // 测试认证端点
    console.log('\n2. 测试 /auth/me');
    try {
      const response = await axios.get(`${baseURL}/auth/me`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      console.log('✓ /auth/me 端点存在 (状态码:', response.status, ')');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✓ /auth/me 端点存在 (返回401认证错误，说明端点正常)');
      } else if (error.response && error.response.status === 404) {
        console.log('✗ /auth/me 端点不存在 (404)');
      } else {
        console.log('✗ /auth/me 测试失败:', error.message);
      }
    }

    // 测试管理员配置端点
    console.log('\n3. 测试 /admin/config/configs');
    try {
      const response = await axios.get(`${baseURL}/admin/config/configs`);
      console.log('✓ /admin/config/configs 端点存在 (状态码:', response.status, ')');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✓ /admin/config/configs 端点存在 (返回401认证错误，说明端点正常)');
      } else if (error.response && error.response.status === 404) {
        console.log('✗ /admin/config/configs 端点不存在 (404)');
      } else {
        console.log('✗ /admin/config/configs 测试失败:', error.message);
      }
    }

    // 测试认证状态端点（无需认证）
    console.log('\n4. 测试 /auth/status');
    try {
      const response = await axios.get(`${baseURL}/auth/status`);
      console.log('✓ /auth/status 端点存在 (状态码:', response.status, ')');
      console.log('响应:', response.data);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✗ /auth/status 端点不存在 (404)');
      } else {
        console.log('✗ /auth/status 测试失败:', error.message);
      }
    }

  } catch (error) {
    console.error('无法连接到服务器。请确保开发服务器正在运行在 http://localhost:3000');
  }
}

// 执行测试
testEndpoints();