// 简化中间件性能测试 - 逐个检查具体中间件
require('dotenv').config({ path: '.env' });

const express = require('express');
const cors = require('cors');

console.log('🔍 简化中间件性能测试');
console.log('=========================');

// 模拟性能监控中间件
const mockPerformanceMonitor = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[性能监控] ${req.method} ${req.path} - ${duration}ms`);
  });

  next();
};

// 模拟安全监控中间件
const mockSecurityMonitoring = (req, res, next) => {
  // 简单的IP检查
  const clientIP = req.ip || req.connection.remoteAddress;

  // 模拟可疑行为检查
  const suspiciousPatterns = ['<script', 'javascript:', 'data:'];
  const isSuspicious = suspiciousPatterns.some(pattern =>
    JSON.stringify(req.body).includes(pattern)
  );

  if (isSuspicious) {
    console.log(`[安全监控] 检测到可疑请求: ${clientIP}`);
  }

  next();
};

// 模拟JWT认证中间件
const mockJWTAuth = (req, res, next) => {
  // 跳过健康检查等路由
  if (req.path.startsWith('/health') || req.path.startsWith('/test-')) {
    return next();
  }

  // 从Authorization头提取token
  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '认证失败 - 缺少Bearer token' });
  }

  const token = authHeader.substring(7);

  try {
    // 模拟JWT验证（这里简化处理，直接设置用户）
    if (token.length > 50) { // 简单验证
      req.user = {
        id: 'crho9e2hrp50xqkh2xum9rbp',
        level: 'NORMAL',
        role: 'USER'
      };
      next();
    } else {
      res.status(401).json({ error: '认证失败 - 无效token' });
    }
  } catch (error) {
    res.status(401).json({ error: '认证失败 - ' + error.message });
  }
};

// 测试配置
const testConfigs = [
  {
    name: '无中间件（基础）',
    middlewares: []
  },
  {
    name: '仅性能监控',
    middlewares: [mockPerformanceMonitor]
  },
  {
    name: '仅安全监控',
    middlewares: [mockSecurityMonitoring]
  },
  {
    name: '仅JWT认证',
    middlewares: [mockJWTAuth]
  },
  {
    name: '性能监控 + 安全监控',
    middlewares: [mockPerformanceMonitor, mockSecurityMonitoring]
  },
  {
    name: '性能监控 + JWT认证',
    middlewares: [mockPerformanceMonitor, mockJWTAuth]
  },
  {
    name: '安全监控 + JWT认证',
    middlewares: [mockSecurityMonitoring, mockJWTAuth]
  },
  {
    name: '完整中间件栈',
    middlewares: [mockPerformanceMonitor, mockSecurityMonitoring, mockJWTAuth]
  }
];

// 创建测试服务器
function createTestServer(config) {
  const app = express();

  // 基础中间件
  app.use(cors());
  app.use(express.json());

  // 添加测试中间件
  config.middlewares.forEach(middleware => {
    app.use(middleware);
  });

  // 测试路由
  app.get('/test', (req, res) => {
    res.json({
      message: '测试成功',
      config: config.name,
      timestamp: new Date().toISOString()
    });
  });

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', config: config.name });
  });

  return app;
}

// 运行单个测试
async function runTest(config) {
  console.log(`\n🧪 测试: ${config.name}`);
  console.log('-'.repeat(40));

  const app = createTestServer(config);
  const server = app.listen(3005);

  // 等待服务器启动
  await new Promise(resolve => setTimeout(resolve, 300));

  const startTime = Date.now();

  try {
    // 测试健康检查（无需认证）
    const healthResponse = await fetch('http://localhost:3005/health');
    const healthTime = Date.now() - startTime;

    console.log(`   健康检查: ${healthTime}ms (状态: ${healthResponse.status})`);

    // 测试需要认证的路由
    const testStart = Date.now();
    const testResponse = await fetch('http://localhost:3005/test', {
      headers: {
        'Authorization': 'Bearer ' + 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjcmhvOWUyaHJwNTB4cWtoMnh1bTlyYnAiLCJwaG9uZSI6IjEzODAwMTM4MDAxIiwicm9sZSI6Ik5PUk1BTCIsImxldmVsIjoiTk9STUFMIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzY1MTEwMTAyLCJleHAiOjE3NjUxOTY1MDIsImF1ZCI6Inpob25nZGFvLW1hbGwtdXNlcnMiLCJpc3MiOiJ6aG9uZ2Rhby1tYWxsLXRlc3QifQ.1_VBPYczMsxqeYIAdM7bM5qMbvhHl12q6d2PyIlGwUY'
      }
    });
    const testTime = Date.now() - testStart;

    console.log(`   认证路由: ${testTime}ms (状态: ${testResponse.status})`);

    const totalTime = Date.now() - startTime;

    return {
      config: config.name,
      healthTime,
      testTime,
      totalTime,
      status: 'success'
    };

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.log(`   错误: ${error.message} (耗时: ${totalTime}ms)`);

    return {
      config: config.name,
      healthTime: 0,
      testTime: 0,
      totalTime,
      status: 'error',
      error: error.message
    };
  } finally {
    server.close();
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始简化中间件测试...');

  const results = [];

  for (const config of testConfigs) {
    const result = await runTest(config);
    results.push(result);

    // 如果发现严重延迟，立即标记
    if (result.totalTime > 5000) {
      console.log(`\n🚨 发现严重延迟！${config.name} 耗时 ${result.totalTime}ms`);
    }

    // 短暂休息避免服务器冲突
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // 分析结果
  console.log('\n📊 测试结果分析');
  console.log('==================');
  console.table(results);

  // 找出最慢的配置
  const slowest = results.reduce((prev, current) =>
    (prev.totalTime > current.totalTime) ? prev : current
  );

  const fastest = results.reduce((prev, current) =>
    (prev.totalTime < current.totalTime) ? prev : current
  );

  console.log(`\n⚡ 最快配置: ${fastest.config} (${fastest.totalTime}ms)`);
  console.log(`🐌 最慢配置: ${slowest.config} (${slowest.totalTime}ms)`);

  // 分析中间件开销
  const baseline = results.find(r => r.config === '无中间件（基础）');
  if (baseline) {
    console.log('\n📈 中间件开销分析:');
    results.forEach(result => {
      if (result.config !== '无中间件（基础）') {
        const overhead = result.totalTime - baseline.totalTime;
        const percent = ((overhead / baseline.totalTime) * 100).toFixed(1);
        console.log(`   ${result.config}: +${overhead}ms (+${percent}%)`);

        if (overhead > 10000) {
          console.log(`     🚨 这个中间件组合导致了严重延迟！`);
        }
      }
    });
  }

  // 找出元凶
  const problematic = results.filter(r => r.totalTime > 5000);
  if (problematic.length > 0) {
    console.log('\n🎯 元凶中间件组合:');
    problematic.forEach(p => {
      console.log(`   - ${p.config}: ${p.totalTime}ms`);
    });

    console.log('\n💡 结论:');
    console.log('15秒延迟是由中间件组合导致的，需要进一步优化中间件实现');
  } else {
    console.log('\n✅ 未发现严重延迟的中间件组合');
    console.log('15秒延迟可能由其他原因造成（如数据库查询、外部API调用等）');
  }
}

// 启动测试
runAllTests()
  .then(() => {
    console.log('\n🎯 简化中间件测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });