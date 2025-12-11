import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

// 基础中间件
app.use(cors());
app.use(express.json());

// 简单测试路由
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// API v1 路由
app.get('/api/v1/test', (req, res) => {
  console.log('🔍 /api/v1/test 路由被调用');
  res.json({
    success: true,
    message: 'Test route working!',
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use((req, res) => {
  console.log('❌ 404:', req.method, req.url);
  res.status(404).json({
    success: false,
    message: '接口不存在',
    path: req.url
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 测试服务器启动成功！`);
  console.log(`📍 端口: ${PORT}`);
  console.log(`🔗 测试链接: http://localhost:${PORT}/api/v1/test\n`);
});