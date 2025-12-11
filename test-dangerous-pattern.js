const DANGEROUS_PATTERNS = [
  // SQL注入模式
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /(--|#|\/\*|\*\/)/,
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
  /[;&|`$()]/i,
  /(cmd|powershell|bash|sh|system|exec)\s/i,

  // NoSQL注入模式
  /(\$\{|\$where|\$ne|\$gt|\$lt|\$in|\$nin)/i
];

const testData = [
  '调试标签_1764990667549',
  '测试标签',
  'NormalTag123',
  'tag_without_numbers',
  'tag with spaces',
  '$where',
  '{$ne: "test"}'
];

console.log('🔍 检测危险模式匹配\n');

testData.forEach(data => {
  console.log(`测试数据: "${data}"`);

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(data)) {
      console.log(`  ❌ 匹配危险模式: ${pattern}`);
      break;
    }
  }

  console.log('  ✅ 安全\n');
});