const request = require('supertest');

async function debugShopCreation() {
  try {
    console.log('调试店铺创建问题...\n');

    // 直接导入开发服务器
    const { default: app } = await import('./src/index.ts');

    // VIP用户token
    const vipToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc';

    // 解码token查看用户信息
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(vipToken);
    console.log('1. Token中的用户信息:', {
      id: decoded.sub,
      role: decoded.role,
      level: decoded.level
    });

    console.log('\n2. 测试VIP用户创建店铺:');
    const shopData = {
      shopName: '测试云店',
      shopType: 'CLOUD',
      contactName: '测试联系人',
      contactPhone: '13800138001',
      address: '测试地址',
      description: '店铺描述'
    };

    const response = await request(app)
      .post('/api/v1/shops/apply')
      .set('Authorization', `Bearer ${vipToken}`)
      .send(shopData);

    console.log('状态码:', response.status);
    console.log('响应:', response.body);

    if (response.status === 400 && response.body.error) {
      console.log('错误详情:');
      console.log('- 消息:', response.body.error.message);
      console.log('- 详情:', response.body.error.details);
    }

    console.log('\n3. 分析问题:');
    if (response.status === 400) {
      console.log('可能的原因:');
      console.log('- 用户级别不是VIP（token中level是"normal"，应该是"VIP"）');
      console.log('- 用户已存在店铺');
      console.log('- 其他业务逻辑验证失败');
    }

  } catch (error) {
    console.error('调试失败:', error);
  }
}

setTimeout(debugShopCreation, 1000);