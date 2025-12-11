const testData = {name: 'final-test-tag', color: '#00FF00'};
const bodyStr = JSON.stringify(testData);
console.log('请求体内容:', bodyStr);

const DANGEROUS_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
  /(--|#|\/\*|\*\/)/,
  /(\b(SCRIPT|IFRAME|OBJECT|EMBED)\b)/i,
  /(javascript:|vbscript:|onload=|onerror=|onclick=)/i,
  /<\s*(script|iframe|object|embed|form|input|textarea)[^>]*>/i,
  /expression\s*\(/i,
  /@import/i,
  /\.\.[\/\\]/i,
  /(\.\.\/){2,}/i,
  /[;&|`$()]/i,
  /(cmd|powershell|bash|sh|system|exec)\s/i,
  /(\$\{|\$where|\$ne|\$gt|\$lt|\$in|\$nin)/i
];

console.log('\n检测危险模式:');
DANGEROUS_PATTERNS.forEach((pattern, index) => {
  if (pattern.test(bodyStr)) {
    console.log(`匹配危险模式 ${index}: ${pattern}`);
    console.log(`   匹配内容: ${bodyStr.match(pattern)}`);
  }
});

console.log('\n特殊字符检查:');
console.log('包含 $:', bodyStr.includes('$'));
console.log('包含 ():', bodyStr.includes('(') || bodyStr.includes(')'));