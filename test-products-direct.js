const request = require('supertest');

// 使用预创建的有效用户token
const TEST_TOKENS = {
  normal: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjcmhvOWUyaHJwNTB4cWtoMnh1bTlyYnAiLCJwaG9uZSI6IjEzODAwMTM4MDAxIiwicm9sZSI6IlVTRVIiLCJsZXZlbCI6Ik5PUk1BTCIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk5MjE4MywiZXhwIjoxNzY1MDc4NTgzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.DLcDdc5zvzEPcNbCh9_S9E_pkU7ALXbAZVd2WqlUdcg',
  admin: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkFETUlOIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk5MjE4MywiZXhwIjoxNzY1MDc4NTgzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.hzab1ctKHXzFkhLIx1IT-Mq4xFUqf2Gw5iN7d7QU5go'
};

async function testProductsAPI() {
  console.log('🎯 直接测试产品API（绕过用户创建）');

  const API_BASE = '/api/v1';

  // 测试1: 分类树
  console.log('\n1️⃣ 测试分类树API...');
  try {
    const start = Date.now();
    const response = await request('http://localhost:3000')
      .get(`${API_BASE}/products/categories/tree`)
      .set('Authorization', `Bearer ${TEST_TOKENS.normal}`);
    const duration = Date.now() - start;
    console.log(`✅ 分类树 - 状态码: ${response.status}, 耗时: ${duration}ms`);
  } catch (error) {
    console.log(`❌ 分类树错误: ${error.message}`);
  }

  // 测试2: 分类列表
  console.log('\n2️⃣ 测试分类列表API...');
  try {
    const start = Date.now();
    const response = await request('http://localhost:3000')
      .get(`${API_BASE}/products/categories`)
      .set('Authorization', `Bearer ${TEST_TOKENS.normal}`)
      .query({ page: 1, perPage: 10 });
    const duration = Date.now() - start;
    console.log(`✅ 分类列表 - 状态码: ${response.status}, 耗时: ${duration}ms`);
    if (response.status === 200) {
      console.log('   数据:', response.body.success ? '成功' : '失败');
    }
  } catch (error) {
    console.log(`❌ 分类列表错误: ${error.message}`);
  }

  // 测试3: 标签列表
  console.log('\n3️⃣ 测试标签列表API...');
  try {
    const start = Date.now();
    const response = await request('http://localhost:3000')
      .get(`${API_BASE}/products/tags?page=1&perPage=10`)
      .set('Authorization', `Bearer ${TEST_TOKENS.normal}`);
    const duration = Date.now() - start;
    console.log(`✅ 标签列表 - 状态码: ${response.status}, 耗时: ${duration}ms`);
  } catch (error) {
    console.log(`❌ 标签列表错误: ${error.message}`);
  }

  // 测试4: 创建标签
  console.log('\n4️⃣ 测试创建标签API...');
  try {
    const start = Date.now();
    const response = await request('http://localhost:3000')
      .post(`${API_BASE}/products/tags`)
      .set('Authorization', `Bearer ${TEST_TOKENS.admin}`)
      .set('Content-Type', 'application/json')
      .send({
        name: `test-tag-${Date.now()}`,
        color: '#00FF00',
        description: '直接测试标签'
      });
    const duration = Date.now() - start;
    console.log(`✅ 创建标签 - 状态码: ${response.status}, 耗时: ${duration}ms`);
    if (response.status === 200) {
      console.log('   标签创建成功！');
    } else {
      console.log('   错误:', response.body);
    }
  } catch (error) {
    console.log(`❌ 创建标签错误: ${error.message}`);
  }

  // 测试5: 商品列表
  console.log('\n5️⃣ 测试商品列表API...');
  try {
    const start = Date.now();
    const response = await request('http://localhost:3000')
      .get(`${API_BASE}/products/items?page=1&perPage=10`)
      .set('Authorization', `Bearer ${TEST_TOKENS.normal}`);
    const duration = Date.now() - start;
    console.log(`✅ 商品列表 - 状态码: ${response.status}, 耗时: ${duration}ms`);
  } catch (error) {
    console.log(`❌ 商品列表错误: ${error.message}`);
  }

  // 测试6: 商品规格
  console.log('\n6️⃣ 测试商品规格API...');
  try {
    const start = Date.now();
    const response = await request('http://localhost:3000')
      .get(`${API_BASE}/products/specs?page=1&perPage=10`)
      .set('Authorization', `Bearer ${TEST_TOKENS.normal}`);
    const duration = Date.now() - start;
    console.log(`✅ 商品规格 - 状态码: ${response.status}, 耗时: ${duration}ms`);
  } catch (error) {
    console.log(`❌ 商品规格错误: ${error.message}`);
  }

  console.log('\n🎉 API直接测试完成！');
  console.log('如果所有API都快速响应，说明问题在于测试框架的用户创建过程');
}

testProductsAPI();