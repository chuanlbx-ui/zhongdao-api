const request = require('supertest');

async function testShopsAPI() {
  try {
    console.log('测试shops API...');

    // 直接导入开发服务器
    const { default: app } = await import('./src/index.ts');

    // 测试数据
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc';

    console.log('\n1. 测试GET /shops:');
    try {
      const response = await request(app)
        .get('/api/v1/shops?page=1&perPage=10')
        .set('Authorization', `Bearer ${token}`);

      console.log('状态码:', response.status);
      console.log('响应:', response.body);

      if (response.status === 500) {
        console.log('500错误 - 服务器内部错误');
      }
    } catch (error) {
      console.error('GET请求失败:', error.message);
    }

    console.log('\n2. 测试POST /shops/apply:');
    try {
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
        .set('Authorization', `Bearer ${token}`)
        .send(shopData);

      console.log('状态码:', response.status);
      console.log('响应:', response.body);

      if (response.status === 400) {
        console.log('400错误 - 请求参数错误');
        if (response.body.error && response.body.error.details) {
          console.log('错误详情:', response.body.error.details);
        }
      }
    } catch (error) {
      console.error('POST请求失败:', error.message);
    }

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 等待一下再开始
setTimeout(testShopsAPI, 1000);