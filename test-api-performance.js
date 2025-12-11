const request = require('supertest');
const { app } = require('./tests/setup');

const API_BASE = '/api/v1';

// 测试token（提前生成好的）
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqYTR4NDcwNWE0ZW12a2dhMmU3M2U1bmUiLCJwaG9uZSI6IjEzODAwMTM4ODg4Iiwicm9sZSI6IkFETUlOIiwibGV2ZWwiOiJESVJFQ1RPUiIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2NDk5MjE4MywiZXhwIjoxNzY1MDc4NTgzLCJhdWQiOiJ6aG9uZ2Rhby1tYWxsLXVzZXJzIiwiaXNzIjoiemhvbmdkYW8tbWFsbC10ZXN0In0.hzab1ctKHXzFkhLIx1IT-Mq4xFUqf2Gw5iN7d7QU5go';

async function testAPIPerformance() {
  console.log('🚀 开始API性能测试...\n');

  const tests = [
    { name: '商品分类树', url: `${API_BASE}/products/categories/tree` },
    { name: '商品标签列表', url: `${API_BASE}/products/tags?page=1&perPage=10` },
    { name: '商品列表', url: `${API_BASE}/products/items?page=1&perPage=5` }
  ];

  for (const test of tests) {
    console.log(`📊 测试 ${test.name}...`);
    const start = Date.now();

    try {
      const response = await request(app)
        .get(test.url)
        .set('Authorization', `Bearer ${TEST_TOKEN}`);

      const duration = Date.now() - start;
      console.log(`   ✅ 状态: ${response.status}, 耗时: ${duration}ms`);

      if (response.body.success) {
        if (response.body.data.categories) {
          console.log(`   📦 分类数量: ${response.body.data.categories.length}`);
        }
        if (response.body.data.tags) {
          console.log(`   🏷️  标签数量: ${response.body.data.tags.length}`);
        }
        if (response.body.data.products) {
          console.log(`   🛍️  商品数量: ${response.body.data.products.length}`);
        }
      }
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`   ❌ 错误: ${error.message}, 耗时: ${duration}ms`);
    }

    console.log('');
  }

  process.exit(0);
}

testAPIPerformance();