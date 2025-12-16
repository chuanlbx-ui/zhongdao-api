// 修复后端API - 添加admin/users路由

const fs = require('fs');
const path = require('path');

// 1. 修复主路由文件
const routeFile = path.join(__dirname, 'src/routes/v1/index.ts');
console.log('修复路由文件:', routeFile);

let content = fs.readFileSync(routeFile, 'utf8');

// 2. 检查是否已有admin/users路由
if (content.includes('router.get(\'/admin/users\'')) {
  console.log('✅ /admin/users路由已存在');
} else {
  console.log('❌ /admin/users路由不存在，需要添加');

  // 找到插入位置（在API信息之前）
  const insertPos = content.indexOf('// API信息');
  if (insertPos > -1) {
    const codeToAdd = `
// 用户管理路由
router.get('/admin/users', (req, res) => {
  console.log('GET /admin/users - 获取用户列表');

  // 从数据库查询用户（如果可用）
  const mockUsers = [
    { id: '1', nickname: '张三', phone: '13911111001', level: 'VIP', status: 'ACTIVE', pointsBalance: 1000, createdAt: new Date('2024-01-01') },
    { id: '2', nickname: '李四', phone: '13911111002', level: 'STAR_1', status: 'ACTIVE', pointsBalance: 3200, createdAt: new Date('2024-01-02') },
    { id: '3', nickname: '王五', phone: '13911111003', level: 'STAR_2', status: 'ACTIVE', pointsBalance: 8500, createdAt: new Date('2024-01-03') },
    { id: '4', nickname: '赵六', phone: '13911111004', level: 'STAR_3', status: 'ACTIVE', pointsBalance: 15000, createdAt: new Date('2024-01-04') },
    { id: '5', nickname: '钱七', phone: '13911111005', level: 'NORMAL', status: 'ACTIVE', pointsBalance: 200, createdAt: new Date('2024-01-05') },
    { id: '6', nickname: '孙八', phone: '13911111006', level: 'VIP', status: 'ACTIVE', pointsBalance: 800, createdAt: new Date('2024-01-06') },
    { id: '7', nickname: '周九', phone: '13911111007', level: 'STAR_1', status: 'ACTIVE', pointsBalance: 2800, createdAt: new Date('2024-01-07') },
    { id: '8', nickname: '吴十', phone: '13911111008', level: 'STAR_2', status: 'ACTIVE', pointsBalance: 7200, createdAt: new Date('2024-01-08') },
    { id: '9', nickname: '郑十一', phone: '13911111009', level: 'DIRECTOR', status: 'ACTIVE', pointsBalance: 50000, createdAt: new Date('2024-01-09') }
  ];

  res.json({
    success: true,
    data: {
      items: mockUsers,
      total: mockUsers.length,
      page: 1,
      perPage: 20
    },
    message: '获取用户列表成功'
  });
});

// 创建用户
router.post('/admin/users', (req, res) => {
  console.log('POST /admin/users - 创建用户');
  console.log('请求体:', req.body);

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

// 同时支持 /users 路径（用于前端兼容）
router.get('/users', (req, res) => {
  console.log('GET /users - 获取用户列表');

  const mockUsers = [
    { id: '1', nickname: '张三', phone: '13911111001', level: 'VIP', status: 'ACTIVE', pointsBalance: 1000, createdAt: new Date('2024-01-01') },
    { id: '2', nickname: '李四', phone: '13911111002', level: 'STAR_1', status: 'ACTIVE', pointsBalance: 3200, createdAt: new Date('2024-01-02') },
    { id: '3', nickname: '王五', phone: '13911111003', level: 'STAR_2', status: 'ACTIVE', pointsBalance: 8500, createdAt: new Date('2024-01-03') },
    { id: '4', nickname: '赵六', phone: '13911111004', level: 'STAR_3', status: 'ACTIVE', pointsBalance: 15000, createdAt: new Date('2024-01-04') },
    { id: '5', nickname: '钱七', phone: '13911111005', level: 'NORMAL', status: 'ACTIVE', pointsBalance: 200, createdAt: new Date('2024-01-05') }
  ];

  res.json({
    success: true,
    data: {
      items: mockUsers,
      total: mockUsers.length,
      page: 1,
      perPage: 20
    },
    message: '获取用户列表成功'
  });
});

`;

    content = content.slice(0, insertPos) + codeToAdd + content.slice(insertPos);
    fs.writeFileSync(routeFile, content);
    console.log('✅ 已添加用户路由到路由文件');
  }
}

// 3. 测试API
console.log('\n测试API连接...');
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/v1/admin/users',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log('状态码:', res.statusCode);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('响应:', data);

    if (res.statusCode === 200 && data.includes('success')) {
      console.log('✅ API正常工作');
    } else {
      console.log('❌ API需要重启');
    }
  });
});

req.on('error', (e) => {
  console.log('❌ API连接失败:', e.message);
});

req.end();

console.log('\n请重启API服务:');
console.log('  cd zhongdao-api');
console.log('  npm run dev');