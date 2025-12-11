const request = require('supertest');

async function debugPutError() {
  try {
    console.log('调试PUT接口500错误...\n');

    // 导入开发服务器
    const { default: app } = await import('./src/index.ts');

    // VIP用户token
    const vipToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc';

    console.log('1. 测试VIP用户更新店铺:');

    // 先创建一个店铺用于测试
    const createResponse = await request(app)
      .post('/api/v1/shops/apply')
      .set('Authorization', `Bearer ${vipToken}`)
      .send({
        shopName: '测试店铺',
        shopType: 'CLOUD',
        contactName: '测试联系人',
        contactPhone: '13800138001',
        address: '测试地址'
      });

    console.log('创建店铺响应:', createResponse.status);

    if (createResponse.status === 201) {
      const shopId = createResponse.body.data.id;
      console.log('店铺ID:', shopId);

      // 测试更新店铺
      const updateData = {
        shopName: '更新后的店铺名称',
        contactPhone: '13900139000',
        address: '更新后的地址'
      };

      console.log('\n2. 发送PUT请求:');
      const response = await request(app)
        .put(`/api/v1/shops/${shopId}`)
        .set('Authorization', `Bearer ${vipToken}`)
        .send(updateData);

      console.log('PUT响应状态:', response.status);
      console.log('PUT响应体:', response.body);

      if (response.status === 500) {
        console.log('\n3. 分析500错误:');
        console.log('- 响应大小:', Buffer.byteLength(JSON.stringify(response.body)), '字节');
        console.log('- 错误类型:', response.body.error?.code || '未知');
        console.log('- 错误消息:', response.body.error?.message || '无');
      }
    }

  } catch (error) {
    console.error('调试失败:', error);
  }
}

setTimeout(debugPutError, 2000);