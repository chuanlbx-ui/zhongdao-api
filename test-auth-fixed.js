const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.development' });

// 确保环境变量已加载
console.log('JWT_SECRET:', process.env.JWT_SECRET ? `${process.env.JWT_SECRET.substring(0, 10)}...` : 'undefined');

// 创建一个简单的测试应用
const app = express();
app.use(express.json());

// 模拟认证中间件
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '缺少认证Token'
        }
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET未设置');
    }

    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    });

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      level: decoded.level,
      scope: decoded.scope || []
    };

    next();
  } catch (error) {
    console.error('JWT验证失败:', error);
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error.message || '认证失败'
      }
    });
  }
};

// 受保护的路由
app.get('/api/test/protected', authenticate, (req, res) => {
  res.json({
    success: true,
    data: {
      message: '认证成功',
      user: req.user
    }
  });
});

// 公开路由用于生成token
app.get('/api/test/token', (req, res) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    return res.status(500).json({
      success: false,
      error: { message: 'JWT_SECRET未设置' }
    });
  }

  const token = jwt.sign({
    sub: 'admin-test-id',
    role: 'ADMIN',
    level: 'DIRECTOR',
    scope: ['active', 'admin']
  }, JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
    issuer: 'zhongdao-mall',
    audience: 'zhongdao-users'
  });

  res.json({
    success: true,
    data: { token }
  });
});

// 测试主逻辑
async function runTests() {
  console.log('\n=== 测试1: 获取Token ===');
  try {
    const tokenResponse = await request(app)
      .get('/api/test/token')
      .expect(200);

    const token = tokenResponse.body.data.token;
    console.log('✓ Token获取成功');
    console.log('Token:', token.substring(0, 50) + '...');
    console.log('');

    console.log('=== 测试2: 使用正确的Token访问受保护路由 ===');
    const protectedResponse = await request(app)
      .get('/api/test/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    console.log('✓ 认证成功！');
    console.log('用户信息:', JSON.stringify(protectedResponse.body.data.user, null, 2));
    console.log('');

    console.log('=== 测试3: 使用无效Token ===');
    await request(app)
      .get('/api/test/protected')
      .set('Authorization', 'Bearer invalid-token-here')
      .expect(401);

    console.log('✓ 正确拒绝了无效Token');
    console.log('');

    console.log('=== 测试4: 无Token访问 ===');
    await request(app)
      .get('/api/test/protected')
      .expect(401);

    console.log('✓ 正确拒绝了无Token请求');
    console.log('');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.body);
    }
  }
}

// 运行测试
runTests();