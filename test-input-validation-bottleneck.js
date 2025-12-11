// 测试输入验证中间件是否是15秒延迟的元凶
require('dotenv').config({ path: '.env' });

const express = require('express');
const cors = require('cors');

console.log('🔍 测试输入验证中间件性能瓶颈');
console.log('=====================================');

// 复制增强输入验证中间件的危险代码
const DANGEROUS_PATTERNS = [
  // SQL注入模式（需要完整关键字组合）
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  // 注释模式（但排除颜色值上下文）
  /(--(?!.*#)|\/\*.*?\*\/)/,
  /(\b(SCRIPT|IFRAME|OBJECT|EMBED)\b)/i,

  // XSS模式
  /(javascript:|vbscript:|onload=|onerror=|onclick=)/i,
  /<\s*(script|iframe|object|embed|form|input|textarea)[^>]*>/i,
  /expression\s*\(/i,
  /@import/i,

  // 路径遍历模式
  /\.\.[\/\\]/i,
  /(\.\.\/){2,}/i,

  // 命令注入模式
  /[;&|`]/i,
  /(cmd|powershell|bash|sh|system|exec)\s/i,

  // NoSQL注入模式
  /\$\{[^}]*\b(where|ne|gt|lt|in|nin)\b/i
];

// 🚨 元凶函数：验证请求体对象（从enhanced-security.ts复制）
const validateBodyObject = (body) => {
  const errors = [];
  const bodyStr = JSON.stringify(body); // 🚨 这里可能很慢！

  // 检查请求体大小
  const maxPayloadSize = 10 * 1024 * 1024; // 10MB
  if (Buffer.byteLength(bodyStr, 'utf8') > maxPayloadSize) {
    errors.push('请求体过大');
    return { isValid: false, errors };
  }

  // 🚨 这里是15个复杂正则表达式，每个请求都要匹配！
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(bodyStr)) {
      // 特殊处理：如果是颜色值中的#字符，跳过检查
      if (pattern.source.includes('#')) {
        const colorMatches = bodyStr.match(/"[^"]*color[^"]*"\s*:\s*"[^"]*#"/g);
        if (colorMatches && colorMatches.length > 0) {
          // 如果是颜色字段，暂时跳过这个模式
          continue;
        }
      }

      errors.push('请求体包含危险模式');
      break;
    }
  }

  return { isValid: errors.length === 0, errors };
};

// 模拟输入验证中间件
const mockEnhancedInputValidation = (req, res, next) => {
  try {
    // 3. 检查请求体
    if (req.body && typeof req.body === 'object') {
      const bodyValidation = validateBodyObject(req.body);
      if (!bodyValidation.isValid) {
        console.log(`   ⚠️ 输入验证失败: ${bodyValidation.errors.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: '请求体包含危险内容',
          errors: bodyValidation.errors
        });
      }
    }

    next();
  } catch (error) {
    console.error('   ❌ 输入验证异常:', error.message);
    return res.status(500).json({
      success: false,
      error: '安全验证失败'
    });
  }
};

// 创建测试服务器
const app = express();

// 基础中间件
app.use(cors());
app.use(express.json());

// 测试路由 - 无输入验证
app.get('/test-no-validation', (req, res) => {
  res.json({
    message: '无验证测试',
    timestamp: new Date().toISOString()
  });
});

// 测试路由 - 有输入验证
app.get('/test-with-validation', mockEnhancedInputValidation, (req, res) => {
  res.json({
    message: '有验证测试',
    timestamp: new Date().toISOString()
  });
});

// 测试不同大小的请求体
const testBodies = {
  small: { name: 'test', category: 'electronics' },
  medium: {
    name: 'test product',
    description: 'A'.repeat(1000),
    details: { features: 'B'.repeat(2000) },
    specs: { weight: '1kg', dimensions: 'C'.repeat(3000) }
  },
  large: {
    name: 'large product',
    description: 'D'.repeat(10000),
    details: {
      features: 'E'.repeat(20000),
      specifications: 'F'.repeat(30000),
      additionalInfo: 'G'.repeat(40000)
    },
    specs: {
      weight: 'H'.repeat(50000),
      dimensions: 'I'.repeat(60000),
      extra: 'J'.repeat(70000)
    }
  }
};

// 启动服务器
const PORT = 3006;
const server = app.listen(PORT, () => {
  console.log(`🚀 测试服务器启动在端口 ${PORT}`);

  // 开始测试
  setTimeout(() => runBottleneckTest(), 1000);
});

async function runBottleneckTest() {
  console.log('\n🧪 开始输入验证性能瓶颈测试...\n');

  for (const [sizeName, body] of Object.entries(testBodies)) {
    console.log(`📊 测试 ${sizeName} 请求体 (${JSON.stringify(body).length} 字符)`);
    console.log('-'.repeat(60));

    // 测试无验证的路由
    const noValidationStart = Date.now();
    try {
      const response1 = await fetch(`http://localhost:${PORT}/test-no-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const noValidationTime = Date.now() - noValidationStart;
      console.log(`✅ 无验证路由: ${noValidationTime}ms (状态: ${response1.status})`);
    } catch (error) {
      console.log(`❌ 无验证路由错误: ${error.message}`);
    }

    // 测试有验证的路由
    const withValidationStart = Date.now();
    try {
      const response2 = await fetch(`http://localhost:${PORT}/test-with-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const withValidationTime = Date.now() - withValidationStart;
      console.log(`✅ 有验证路由: ${withValidationTime}ms (状态: ${response2.status})`);

      // 计算验证开销
      const overhead = withValidationTime - noValidationTime;
      const overheadPercent = ((overhead / noValidationTime) * 100).toFixed(1);
      console.log(`📈 验证开销: +${overhead}ms (+${overheadPercent}%)`);

      // 如果发现严重延迟，立即标记
      if (overhead > 5000) {
        console.log(`🚨 发现严重延迟！${sizeName} 请求体的输入验证导致 ${overhead}ms 延迟！`);
        console.log('   💡 这就是15秒延迟的元凶！');
      }

    } catch (error) {
      const withValidationTime = Date.now() - withValidationStart;
      console.log(`❌ 有验证路由错误: ${error.message} (耗时: ${withValidationTime}ms)`);

      if (withValidationTime > 5000) {
        console.log(`🚨 确认元凶！${sizeName} 请求体在输入验证时耗时 ${withValidationTime}ms！`);
      }
    }

    console.log('');
  }

  console.log('🎯 输入验证瓶颈测试完成');
  console.log('💡 如果某个请求体显示严重延迟，说明enhancedInputValidation中间件是元凶');

  server.close();
  process.exit(0);
}