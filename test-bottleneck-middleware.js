// 精准定位15秒延迟的元凶中间件
require('dotenv').config({ path: '.env' });

const express = require('express');
const cors = require('cors');

console.log('🔍 精准定位15秒延迟的元凶中间件');
console.log('===========================================');

// 测试用的简单Express应用
const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 从主应用复制的关键中间件导入
const { performanceMonitor } = require('./src/shared/middleware/performance.ts');
const { securityMonitoring } = require('./src/shared/services/security-monitoring.ts');
const { authenticate } = require('./src/shared/middleware/auth.ts');

// 测试路由 - 简单响应
app.get('/test-simple', (req, res) => {
  res.json({ message: '简单路由测试', timestamp: new Date().toISOString() });
});

// 测试配置 - 逐步添加中间件
const testConfigs = [
  {
    name: '无中间件（基础路由）',
    middleware: []
  },
  {
    name: '仅性能监控中间件',
    middleware: [performanceMonitor]
  },
  {
    name: '仅安全监控中间件',
    middleware: [securityMonitoring]
  },
  {
    name: '仅JWT认证中间件',
    middleware: [authenticate]
  },
  {
    name: '性能监控 + 安全监控',
    middleware: [performanceMonitor, securityMonitoring]
  },
  {
    name: '性能监控 + JWT认证',
    middleware: [performanceMonitor, authenticate]
  },
  {
    name: '安全监控 + JWT认证',
    middleware: [securityMonitoring, authenticate]
  },
  {
    name: '完整中间件栈（元凶组合）',
    middleware: [performanceMonitor, securityMonitoring, authenticate]
  }
];

// 创建测试服务器
async function createTestServer(config) {
  const testApp = express();

  // 基础中间件
  testApp.use(cors());
  testApp.use(express.json());

  // 添加测试配置的中间件
  config.middleware.forEach(middleware => {
    testApp.use(middleware);
  });

  // 测试路由
  testApp.get('/test', (req, res) => {
    res.json({
      message: '测试成功',
      config: config.name,
      timestamp: new Date().toISOString()
    });
  });

  return testApp;
}

// 运行单个测试
async function runSingleTest(config) {
  console.log(`\n🧪 测试: ${config.name}`);
  console.log('-'.repeat(50));

  const testApp = await createTestServer(config);
  const server = testApp.listen(3004);

  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 500));

  const startTime = Date.now();

  try {
    const response = await fetch('http://localhost:3004/test');
    const data = await response.json();
    const time = Date.now() - startTime;

    console.log(`✅ ${config.name}`);
    console.log(`   耗时: ${time}ms`);
    console.log(`   状态: ${response.status}`);
    console.log(`   响应: ${data.message}`);

    return { config: config.name, time, status: 'success', responseStatus: response.status };

  } catch (error) {
    const time = Date.now() - startTime;
    console.log(`❌ ${config.name} - 错误`);
    console.log(`   耗时: ${time}ms`);
    console.log(`   错误: ${error.message}`);

    return { config: config.name, time, status: 'error', error: error.message };
  } finally {
    server.close();
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始精准定位测试...');

  const results = [];

  for (const config of testConfigs) {
    const result = await runSingleTest(config);
    results.push(result);

    // 如果发现严重延迟，立即标记
    if (result.time > 5000) {
      console.log(`\n🚨 发现严重延迟！${config.name} 耗时 ${result.time}ms`);
    }

    // 短暂休息避免服务器冲突
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // 分析结果
  console.log('\n📊 测试结果分析');
  console.log('==================');
  console.table(results);

  // 找出最慢的配置
  const slowest = results.reduce((prev, current) =>
    (prev.time > current.time) ? prev : current
  );

  const fastest = results.reduce((prev, current) =>
    (prev.time < current.time) ? prev : current
  );

  console.log(`\n⚡ 最快配置: ${fastest.config} (${fastest.time}ms)`);
  console.log(`🐌 最慢配置: ${slowest.config} (${slowest.time}ms)`);

  // 分析中间件开销
  const baseline = results.find(r => r.config === '无中间件（基础路由）');
  if (baseline) {
    console.log('\n📈 中间件开销分析:');
    results.forEach(result => {
      if (result.config !== '无中间件（基础路由）') {
        const overhead = result.time - baseline.time;
        const percent = ((overhead / baseline.time) * 100).toFixed(1);
        console.log(`   ${result.config}: +${overhead}ms (+${percent}%)`);

        if (overhead > 10000) {
          console.log(`     🚨 这个中间件组合导致了严重延迟！`);
        }
      }
    });
  }

  // 找出元凶
  const problematic = results.filter(r => r.time > 5000);
  if (problematic.length > 0) {
    console.log('\n🎯 元凶中间件组合:');
    problematic.forEach(p => {
      console.log(`   - ${p.config}: ${p.time}ms`);
    });

    console.log('\n💡 建议:');
    console.log('1. 检查元凶中间件组合中的每个中间件');
    console.log('2. 查看是否有数据库连接、网络请求等阻塞操作');
    console.log('3. 检查是否有死循环或事件循环阻塞');
    console.log('4. 考虑禁用或优化导致延迟的中间件');
  } else {
    console.log('\n✅ 未发现严重延迟的中间件组合');
    console.log('15秒延迟可能由其他原因造成（如数据库查询、外部API调用等）');
  }
}

// 启动测试
runAllTests()
  .then(() => {
    console.log('\n🎯 精准定位测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });