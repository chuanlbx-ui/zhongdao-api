const request = require('supertest');
const { app } = require('./tests/setup');

async function testCommissionAPI() {
  try {
    console.log('🧪 测试佣金API...\n');

    // 使用管理员Token（从之前的测试日志中获取）
    const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bjMzN28wMDAxZWRiY2ZjdzNyeGRuIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoiZGlyZWN0b3IiLCJpYXQiOjE3NjM0NzQzNDgsImV4cCI6MTc2NDA3OTE0OCwianRpIjoiMHd3amQ3cXZjZTVlbWk0bjNmcnoifQ.83SSYBxiNp-Xm7tshMXbRMaz0ERu9HS11SoVsoRBC_k';

    // 1. 首先创建一个提现申请
    console.log('1. 创建提现申请...');
    const withdrawResponse = await request(app)
      .post('/api/v1/commission/withdraw')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({
        commissionIds: ['test_commission_id'],
        withdrawAmount: 100,
        withdrawMethod: 'BANK',
        accountInfo: {
          bankName: '测试银行',
          accountNumber: '123456789'
        }
      });

    console.log('提现申请响应:', withdrawResponse.status, withdrawResponse.body);

    if (withdrawResponse.status === 200 && withdrawResponse.body.data?.withdrawId) {
      const withdrawId = withdrawResponse.body.data.withdrawId;

      // 2. 测试批准提现
      console.log('\n2. 测试批准提现...');
      try {
        const approveResponse = await request(app)
          .post(`/api/v1/commission/withdrawals/${withdrawId}/approve`)
          .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
          .send({
            remark: '测试批准',
            transactionId: 'TXN123456789'
          });

        console.log('批准响应:', approveResponse.status, approveResponse.body);
      } catch (error) {
        console.error('批准错误:', error.message);
      }

      // 3. 测试拒绝提现（创建新的提现申请）
      console.log('\n3. 创建新的提现申请用于拒绝测试...');
      const rejectWithdrawResponse = await request(app)
        .post('/api/v1/commission/withdraw')
        .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
        .send({
          commissionIds: ['test_commission_id_2'],
          withdrawAmount: 50,
          withdrawMethod: 'WECHAT',
          accountInfo: {
            wechatId: 'test_wechat_id'
          }
        });

      console.log('新提现申请响应:', rejectWithdrawResponse.status, rejectWithdrawResponse.body);

      if (rejectWithdrawResponse.status === 200 && rejectWithdrawResponse.body.data?.withdrawId) {
        const rejectWithdrawId = rejectWithdrawResponse.body.data.withdrawId;

        console.log('\n4. 测试拒绝提现...');
        try {
          const rejectResponse = await request(app)
            .post(`/api/v1/commission/withdrawals/${rejectWithdrawId}/reject`)
            .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
            .send({
              reason: '测试拒绝原因'
            });

          console.log('拒绝响应:', rejectResponse.status, rejectResponse.body);
        } catch (error) {
          console.error('拒绝错误:', error.message);
        }
      }
    }

  } catch (error) {
    console.error('测试过程出错:', error);
  }
}

testCommissionAPI();