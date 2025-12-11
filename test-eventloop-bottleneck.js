// 检测事件循环阻塞 - 找出导致15秒延迟的根本原因
require('dotenv').config({ path: '.env' });

console.log('🔍 检测事件循环阻塞问题');
console.log('=========================');

// 模拟主应用的完整中间件栈
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

const app = express();

// 🚨 关键：事件循环监控
let eventLoopBlocked = false;
let lastEventLoopTime = Date.now();

// 事件循环监控器
const eventLoopMonitor = setInterval(() => {
  const currentTime = Date.now();
  const timeDiff = currentTime - lastEventLoopTime;

  if (timeDiff > 5000) { // 如果事件循环停止超过5秒
    console.log(`🚨 检测到事件循环阻塞！延迟: ${timeDiff}ms`);
    eventLoopBlocked = true;
  }

  lastEventLoopTime = currentTime;
}, 100);

// 完全复制主应用的中间件栈
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:8080',
    'https://zd-h5.aierxin.com',
    'https://zd-admin.aierxin.com/',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-CSRF-Token']
}));

app.use(compression());

app.use(express.json({
  limit: process.env.MAX_PAYLOAD_SIZE || '10mb',
  strict: true
}));

app.use(express.urlencoded({
  extended: true,
  limit: process.env.MAX_PAYLOAD_SIZE || '10mb',
  parameterLimit: 100
}));

// 🚨 模拟可能的问题中间件

// 1. 模拟JWT认证（可能有问题）
app.use((req, res, next) => {
  // 记录时间
  const authStart = Date.now();

  // 跳过健康检查
  if (req.path.startsWith('/health')) {
    return next();
  }

  // 模拟JWT验证
  const authHeader = req.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // 这里可能是问题所在！
    const token = authHeader.substring(7);

    // 模拟可能的同步阻塞操作
    if (token.length > 50) {
      req.user = {
        id: 'test-user-id',
        level: 'NORMAL',
        role: 'USER'
      };
    }
  }

  const authTime = Date.now() - authStart;
  if (authTime > 1000) {
    console.log(`   ⚠️ JWT认证耗时: ${authTime}ms`);
  }

  next();
});

// 2. 模拟性能监控中间件
app.use((req, res, next) => {
  const perfStart = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - perfStart;
    if (duration > 5000) {
      console.log(`   ⚠️ 请求处理超时: ${req.method} ${req.path} - ${duration}ms`);
    }
  });

  next();
});

// 3. 模拟数据库查询延迟检测
app.use(async (req, res, next) => {
  // 在这里我们不会真正查询数据库，只是标记
  req.dbQueryStart = Date.now();
  next();
});

// 测试路由
app.get('/api/v1/products/categories', async (req, res) => {
  const requestStart = Date.now();
  console.log(`🚀 开始处理categories请求: ${new Date().toISOString()}`);

  try {
    // 模拟数据库查询（这里可能是真正的瓶颈）
    const dbStart = Date.now();

    // 模拟Prisma查询 - 这里会暴露真正的阻塞问题
    await new Promise(resolve => {
      // 模拟异步操作
      setTimeout(resolve, 10); // 10ms的正常延迟
    });

    const dbTime = Date.now() - dbStart;
    console.log(`   📊 模拟数据库查询耗时: ${dbTime}ms`);

    const totalTime = Date.now() - requestStart;
    console.log(`   ✅ 总请求处理时间: ${totalTime}ms`);

    // 检查是否有异常的延迟
    if (totalTime > 5000) {
      console.log(`   🚨 请求异常缓慢！总耗时: ${totalTime}ms`);
    }

    res.json({
      success: true,
      data: {
        categories: [
          { id: '1', name: '电子产品', level: 1 },
          { id: '2', name: '服装', level: 1 }
        ],
        pagination: {
          page: 1,
          perPage: 10,
          total: 2,
          totalPages: 1
        }
      },
      timing: {
        totalTime,
        dbTime
      }
    });

  } catch (error) {
    console.error('   ❌ 请求处理错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    eventLoopBlocked
  });
});

// 启动服务器
const PORT = 3007;
const server = app.listen(PORT, () => {
  console.log(`🚀 事件循环监控服务器启动在端口 ${PORT}`);

  // 等待1秒后开始测试
  setTimeout(() => runEventLoopTest(), 1000);
});

async function runEventLoopTest() {
  console.log('\n🧪 开始事件循环阻塞测试...\n');

  const testUrl = `http://localhost:${PORT}/api/v1/products/categories?page=1&perPage=10`;
  const healthUrl = `http://localhost:${PORT}/health`;

  console.log('📊 测试1: 健康检查（应该很快）');
  const healthStart = Date.now();
  try {
    const healthResponse = await fetch(healthUrl);
    const healthTime = Date.now() - healthStart;
    console.log(`   ✅ 健康检查: ${healthTime}ms (状态: ${healthResponse.status})`);
  } catch (error) {
    console.log(`   ❌ 健康检查错误: ${error.message}`);
  }

  console.log('\n📊 测试2: Categories API（这里可能出现15秒延迟）');
  console.log('===========================================================');

  const apiStart = Date.now();
  let apiCompleted = false;
  let apiTime = 0;

  // 同时启动事件循环监控
  const monitorInterval = setInterval(() => {
    if (!apiCompleted) {
      const elapsed = Date.now() - apiStart;
      if (elapsed > 3000 && elapsed % 1000 === 0) {
        console.log(`   ⏳ 请求进行中...已等待 ${elapsed/1000} 秒`);
      }
    }
  }, 1000);

  try {
    console.log(`   🚀 发送请求到: ${testUrl}`);
    const apiResponse = await fetch(testUrl, {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjcmhvOWUyaHJwNTB4cWtoMnh1bTlyYnAiLCJwaG9uZSI6IjEzODAwMTM4MDAxIiwicm9sZSI6Ik5PUk1BTCIsImxldmVsIjoiTk9STUFMIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzY1MTEwMTAyLCJleHAiOjE3NjUxOTY1MDIsImF1ZCI6Inpob25nZGFvLW1hbGwtdXNlcnMiLCJpc3MiOiJ6aG9uZ2Rhby1tYWxsLXRlc3QifQ.1_VBPYczMsxqeYIAdM7bM5qMbvhHl12q6d2PyIlGwUY'
      }
    });

    apiTime = Date.now() - apiStart;
    apiCompleted = true;
    clearInterval(monitorInterval);

    console.log(`   ✅ API请求完成: ${apiTime}ms (状态: ${apiResponse.status})`);

    if (apiTime > 5000) {
      console.log(`   🚨 发现问题！API请求耗时 ${apiTime}ms，远超正常范围！`);
    }

    // 尝试解析响应
    try {
      const data = await apiResponse.json();
      if (data.timing) {
        console.log(`   📊 响应时间详情:`, data.timing);
      }
    } catch (parseError) {
      console.log(`   ⚠️ 响应解析失败:`, parseError.message);
    }

  } catch (error) {
    apiTime = Date.now() - apiStart;
    apiCompleted = true;
    clearInterval(monitorInterval);

    console.log(`   ❌ API请求失败: ${error.message} (耗时: ${apiTime}ms)`);

    if (apiTime > 15000) {
      console.log(`   🚨 确认15秒延迟问题！请求在 ${apiTime}ms 后超时失败`);
    }
  }

  // 最终诊断
  console.log('\n🎯 事件循环诊断结果');
  console.log('====================');
  console.log(`API请求总耗时: ${apiTime}ms`);
  console.log(`事件循环是否阻塞: ${eventLoopBlocked ? '是' : '否'}`);

  if (apiTime > 10000) {
    console.log('\n🔍 结论:');
    console.log('1. 如果API耗时接近15秒，说明存在严重的同步阻塞');
    console.log('2. 可能的原因:');
    console.log('   - 同步文件系统操作');
    console.log('   - 阻塞的网络请求');
    console.log('   - 大量同步计算');
    console.log('   - 死循环或递归调用');
    console.log('3. 建议检查:');
    console.log('   - 中间件中是否有同步操作');
    console.log('   - 数据库连接是否有问题');
    console.log('   - 是否有不合理的while循环');
  }

  // 清理
  clearInterval(eventLoopMonitor);
  server.close();
  process.exit(0);
}