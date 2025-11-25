import { notificationChannelManager } from './index';
import { NotificationChannelType } from '@prisma/client';

/**
 * 测试通知渠道服务
 */
async function testNotificationChannels() {
  console.log('开始测试通知渠道服务...');

  // 测试用的通知载荷
  const testPayload = {
    id: 'test-notification-' + Date.now(),
    recipientId: 'cmi4lsy0h0000ed7djczh4xd4', // 测试用户ID
    recipientType: 'USER',
    title: '测试通知',
    content: '这是一个测试通知消息，用于验证通知渠道功能。',
    data: {
      orderCode: 'TEST123456',
      amount: 100.00,
      testField: '测试数据'
    },
    priority: 'normal',
    category: 'ORDER'
  };

  const channels: NotificationChannelType[] = [
    NotificationChannelType.IN_APP,
    NotificationChannelType.EMAIL,
    NotificationChannelType.SMS,
    NotificationChannelType.WECHAT_MINI
  ];

  console.log('测试渠道列表:', channels);
  console.log('测试载荷:', testPayload);

  // 逐个测试每个渠道
  for (const channel of channels) {
    console.log(`\n===== 测试渠道: ${channel} =====`);

    try {
      const result = await notificationChannelManager.sendNotification(channel, testPayload);

      console.log(`✓ 渠道 ${channel} 测试完成`);
      console.log('发送结果:', result);

      if (result.success) {
        console.log(`✅ ${channel} 通知发送成功`);
        if (result.messageId) {
          console.log(`消息ID: ${result.messageId}`);
        }
        if (result.metadata) {
          console.log('元数据:', JSON.stringify(result.metadata, null, 2));
        }
      } else {
        console.log(`❌ ${channel} 通知发送失败: ${result.error}`);
      }

    } catch (error) {
      console.log(`💥 ${channel} 测试异常:`, error);
    }
  }

  // 测试多渠道同时发送
  console.log('\n===== 测试多渠道同时发送 =====');
  try {
    const multiResults = await notificationChannelManager.sendToMultipleChannels(
      [NotificationChannelType.EMAIL, NotificationChannelType.SMS],
      testPayload
    );

    console.log('多渠道发送结果:');
    multiResults.forEach((result, index) => {
      console.log(`渠道 ${index + 1}:`, result);
    });

  } catch (error) {
    console.log('💥 多渠道发送异常:', error);
  }

  console.log('\n通知渠道测试完成！');
}

// 测试特定功能
async function testSpecificFeatures() {
  console.log('\n===== 测试特定功能 =====');

  // 测试邮件服务
  console.log('\n--- 测试邮件服务 ---');
  const emailService = notificationChannelManager.getChannelService(NotificationChannelType.EMAIL);
  if (emailService) {
    try {
      const statistics = await emailService.getSendStatistics();
      console.log('邮件服务统计:', statistics);
    } catch (error) {
      console.log('邮件统计获取失败:', error);
    }
  }

  // 测试短信服务
  console.log('\n--- 测试短信服务 ---');
  const smsService = notificationChannelManager.getChannelService(NotificationChannelType.SMS);
  if (smsService) {
    try {
      const verificationResult = await smsService.sendVerificationCode(
        '13800138000',
        '123456',
        'login'
      );
      console.log('验证码短信发送结果:', verificationResult);
    } catch (error) {
      console.log('验证码短信发送失败:', error);
    }
  }

  // 测试微信服务
  console.log('\n--- 测试微信服务 ---');
  const wechatService = notificationChannelManager.getChannelService(NotificationChannelType.WECHAT_MINI);
  if (wechatService) {
    try {
      const userInfo = await wechatService.getUserInfo('test_code');
      console.log('微信用户信息获取结果:', userInfo);
    } catch (error) {
      console.log('微信用户信息获取失败:', error);
    }
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testNotificationChannels()
    .then(() => testSpecificFeatures())
    .then(() => {
      console.log('\n🎉 所有测试完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试失败:', error);
      process.exit(1);
    });
}

export { testNotificationChannels, testSpecificFeatures };