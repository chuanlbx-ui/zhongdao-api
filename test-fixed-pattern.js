const testData = {name: 'final-test-tag', color: '#00FF00'};
const bodyStr = JSON.stringify(testData);
console.log('请求体内容:', bodyStr);

// 修复后的危险模式
const DANGEROUS_PATTERNS_FIXED = [
  // SQL注入模式（更严格的上下文检查）
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  // 注释模式（排除颜色值等合法用途）
  /(?<!#(?:[0-9a-fA-F]{3}){1,2}\b)(--|#(?!\w))|\/\*.*?\*\/)/,
  /(\b(SCRIPT|IFRAME|OBJECT|EMBED)\b)/i,
  /(javascript:|vbscript:|onload=|onerror=|onclick=)/i,
  /<\s*(script|iframe|object|embed|form|input|textarea)[^>]*>/i,
  /expression\s*\(/i,
  /@import/i,
  /\.\.[\/\\]/i,
  /(\.\.\/){2,}/i,
  /[;&|`]/i,
  /(\$\(|\)\s*[;&|])/i,
  /(cmd|powershell|bash|sh|system|exec)\s/i,
  /\$\{[^}]*\b(where|ne|gt|lt|in|nin)\b/i
];

console.log('\n检测修复后的危险模式:');
let matchFound = false;
DANGEROUS_PATTERNS_FIXED.forEach((pattern, index) => {
  if (pattern.test(bodyStr)) {
    console.log(`❌ 匹配危险模式 ${index}: ${pattern}`);
    matchFound = true;
  }
});

if (!matchFound) {
  console.log('✅ 修复成功！没有匹配到危险模式');
}

// 测试真正的危险内容
console.log('\n测试真正的危险内容:');
const dangerousData = {"query": "SELECT * FROM users; DROP TABLE users;--"};
const dangerousStr = JSON.stringify(dangerousData);
console.log('危险请求体:', dangerousStr);

DANGEROUS_PATTERNS_FIXED.forEach((pattern, index) => {
  if (pattern.test(dangerousStr)) {
    console.log(`✅ 正确检测到危险模式 ${index}: ${pattern}`);
  }
});