/**
 * 快速验证积分API的脚本
 */

import request from 'supertest';
import { app } from './tests/setup';

async function quickTest() {
  console.log('开始快速验证积分API...');

  // 测试1: 无认证访问
  try {
    console.log('\n1. 测试无认证访问 /api/v1/points/balance...');
    const response1 = await request(app)
      .get('/api/v1/points/balance')
      .expect(401);
    console.log('✅ 无认证访问正确返回401');
  } catch (error) {
    console.log('❌ 无认证访问测试失败:', error.message);
  }

  // 测试2: 错误token访问
  try {
    console.log('\n2. 测试错误token访问...');
    const response2 = await request(app)
      .get('/api/v1/points/balance')
      .set('Authorization', 'Bearer invalid_token')
      .expect(401);
    console.log('✅ 错误token正确返回401');
  } catch (error) {
    console.log('❌ 错误token测试失败:', error.message);
  }

  // 测试3: 测试健康检查
  try {
    console.log('\n3. 测试健康检查...');
    const response3 = await request(app)
      .get('/health')
      .expect(200);
    console.log('✅ 健康检查正常');
  } catch (error) {
    console.log('❌ 健康检查失败:', error.message);
  }

  // 测试4: 检查积分路由是否存在
  try {
    console.log('\n4. 测试积分交易记录路由...');
    const response4 = await request(app)
      .get('/api/v1/points/transactions')
      .set('Authorization', 'Bearer test_token');
    // 不检查状态码，只检查是否返回响应而不是超时
    console.log('✅ 积分交易记录路由有响应（状态码:', response4.status, '）');
  } catch (error) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.log('❌ 积分交易记录路由超时或连接重置 - 这是我们需要修复的问题！');
    } else {
      console.log('❌ 积分交易记录路由测试失败:', error.message);
    }
  }

  // 测试5: 检查积分统计路由
  try {
    console.log('\n5. 测试积分统计路由...');
    const response5 = await request(app)
      .get('/api/v1/points/statistics')
      .set('Authorization', 'Bearer test_token');
    console.log('✅ 积分统计路由有响应（状态码:', response5.status, '）');
  } catch (error) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.log('❌ 积分统计路由超时或连接重置 - 这是我们需要修复的问题！');
    } else {
      console.log('❌ 积分统计路由测试失败:', error.message);
    }
  }

  console.log('\n快速验证完成！');
  process.exit(0);
}

// 设置超时
quickTest().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});