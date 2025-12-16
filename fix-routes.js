const fs = require('fs');
const path = require('path');

// 读取路由文件
const routeFile = path.join(__dirname, 'src/routes/v1/index.ts');
let content = fs.readFileSync(routeFile, 'utf8');

// 检查是否包含用户路由
if (!content.includes('router.get(\'/admin/users\'')) {
  console.log('添加用户路由...');

  // 在API信息前添加用户路由
  const insertPosition = content.indexOf('// API信息');
  if (insertPosition > -1) {
    const routesToAdd = `
// 用户管理路由（直接定义）
router.get('/admin/users', (req, res) => {
  console.log('📍 GET /admin/users - 获取用户列表');

  const users = [
    { id: '1', nickname: '张三', phone: '13911111001', level: 'VIP', pointsBalance: 1000, createdAt: new Date() },
    { id: '2', nickname: '李四', phone: '13911111002', level: 'STAR_1', pointsBalance: 3200, createdAt: new Date() },
    { id: '3', nickname: '王五', phone: '13911111003', level: 'STAR_2', pointsBalance: 8500, createdAt: new Date() },
    { id: '4', nickname: '赵六', phone: '13911111004', level: 'STAR_3', pointsBalance: 15000, createdAt: new Date() },
    { id: '5', nickname: '钱七', phone: '13911111005', level: 'NORMAL', pointsBalance: 200, createdAt: new Date() }
  ];

  res.json({
    success: true,
    data: {
      items: users,
      total: users.length,
      page: 1,
      perPage: 20
    }
  });
});

router.post('/admin/users', (req, res) => {
  console.log('📍 POST /admin/users - 创建用户');
  console.log('请求数据:', req.body);

  const newUser = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  console.log('创建的用户:', newUser);

  res.json({
    success: true,
    data: newUser,
    message: '用户创建成功'
  });
});

// 同时支持 /users 路径
router.get('/users', (req, res) => {
  console.log('📍 GET /users - 获取用户列表');

  const users = [
    { id: '1', nickname: '张三', phone: '13911111001', level: 'VIP', pointsBalance: 1000, createdAt: new Date() },
    { id: '2', nickname: '李四', phone: '13911111002', level: 'STAR_1', pointsBalance: 3200, createdAt: new Date() },
    { id: '3', nickname: '王五', phone: '13911111003', level: 'STAR_2', pointsBalance: 8500, createdAt: new Date() },
    { id: '4', nickname: '赵六', phone: '13911111004', level: 'STAR_3', pointsBalance: 15000, createdAt: new Date() },
    { id: '5', nickname: '钱七', phone: '13911111005', level: 'NORMAL', pointsBalance: 200, createdAt: new Date() }
  ];

  res.json({
    success: true,
    data: {
      items: users,
      total: users.length,
      page: 1,
      perPage: 20
    }
  });
});

router.post('/users', (req, res) => {
  console.log('📍 POST /users - 创建用户');

  const newUser = {
    id: Date.now().toString(),
    ...req.body,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  res.json({
    success: true,
    data: newUser,
    message: '用户创建成功'
  });
});

`;

    content = content.slice(0, insertPosition) + routesToAdd + content.slice(insertPosition);

    fs.writeFileSync(routeFile, content);
    console.log('✅ 用户路由已添加');
  }
} else {
  console.log('✅ 用户路由已存在');
}

console.log('\n请重启API服务: npm run dev');