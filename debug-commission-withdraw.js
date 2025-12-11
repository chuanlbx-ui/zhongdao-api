const request = require('supertest');
const { app } = require('./tests/setup');

async function debugCommissionWithdraw() {
  try {
    console.log('🔍 调试提现批准功能...\n');

    // 使用管理员Token
    const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bjMzN28wMDAxZWRiY2ZjdzNyeGRuIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoiZGlyZWN0b3IiLCJpYXQiOjE3NjM0NzQzNDgsImV4cCI6MTc2NDA3OTE0OCwianRpIjoiMHd3amQ3cXZjZTVlbWk0bjNmcnoifQ.83SSYBxiNp-Xm7tshMXbRMaz0ERu9HS11SoVsoRBC_k';

    // 1. 先创建一个测试提现申请
    console.log('1. 创建测试提现申请...');
    const withdrawResponse = await request(app)
      .post('/api/v1/commission/withdraw')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({
        commissionIds: ['test_commission_123'],
        withdrawAmount: 100,
        withdrawMethod: 'BANK',
        accountInfo: {
          bankName: '测试银行',
          accountNumber: '1234567890123456789',
          accountName: '测试用户'
        }
      });

    console.log('提现申请响应状态:', withdrawResponse.status);
    console.log('提现申请响应:', JSON.stringify(withdrawResponse.body, null, 2));

    if (withdrawResponse.status === 200 && withdrawResponse.body.data?.withdrawId) {
      const withdrawId = withdrawResponse.body.data.withdrawId;
      console.log(`\n2. 测试批准提现申请 (ID: ${withdrawId})...`);

      // 2. 测试批准
      try {
        const approveResponse = await request(app)
          .post(`/api/v1/commission/withdrawals/${withdrawId}/approve`)
          .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
          .send({
            remark: '测试批准',
            transactionId: 'TXN123456789'
          });

        console.log('批准响应状态:', approveResponse.status);
        console.log('批准响应:', JSON.stringify(approveResponse.body, null, 2));

        if (approveResponse.status === 500) {
          console.log('\n❌ 500错误 - 检查服务器日志获取详细错误信息');
        }
      } catch (error) {
        console.error('批准请求异常:', error.message);
      }

      // 3. 测试另一个提现申请的拒绝
      console.log('\n3. 创建另一个提现申请用于拒绝测试...');
      const rejectWithdrawResponse = await request(app)
        .post('/api/v1/commission/withdraw')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          commissionIds: ['test_commission_456'],
          withdrawAmount: 50,
          withdrawMethod: 'WECHAT',
          accountInfo: {
            wechatId: 'test_wechat_id'
          }
        });

      if (rejectWithdrawResponse.status === 200 && rejectWithdrawResponse.body.data?.withdrawId) {
        const rejectWithdrawId = rejectWithdrawResponse.body.data.withdrawId;
        console.log(`\n4. 测试拒绝提现申请 (ID: ${rejectWithdrawId})...`);

        try {
          const rejectResponse = await request(app)
            .post(`/api/v1/commission/withdrawals/${rejectWithdrawId}/reject`)
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({
              reason: '测试拒绝原因'
            });

          console.log('拒绝响应状态:', rejectResponse.status);
          console.log('拒绝响应:', JSON.stringify(rejectResponse.body, null, 2));

          if (rejectResponse.status === 500) {
            console.log('\n❌ 500错误 - 检查服务器日志获取详细错误信息');
          }
        } catch (error) {
          console.error('拒绝请求异常:', error.message);
        }
      }
    } else {
      console.log('❌ 提现申请创建失败');
    }

  } catch (error) {
    console.error('调试过程出错:', error);
  }
}

debugCommissionWithdraw();