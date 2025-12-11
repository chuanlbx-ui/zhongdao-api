const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const files = [
  'src/routes/v1/admin/config.ts',
  'src/routes/v1/orders/index.ts',
  'src/routes/v1/payments/main.ts',
  'src/routes/v1/products/categories.ts',
  'src/routes/v1/products/products.ts',
  'src/routes/v1/products/specs.ts',
  'src/routes/v1/products/tags.ts',
  'src/routes/v1/users/index.ts',
  'src/routes/v1/wutong/index.ts'
];

files.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);

  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');

    // 替换导入语句
    content = content.replace(
      /import\s*\{\s*([^}]+)\s*}\s*from\s*['"]express-validator['"];?/g,
      'import * as expressValidator from \'express-validator\';\nconst { $1 } = expressValidator;'
    );

    // 处理可能的默认导出
    content = content.replace(
      /import\s*expressValidator\s*from\s*['"]express-validator['"];?/g,
      'import * as expressValidator from \'express-validator\';'
    );

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  } else {
    console.log(`Not found: ${filePath}`);
  }
});

console.log('Express-validator import fix completed!');