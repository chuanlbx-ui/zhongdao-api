import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NotificationService } from '../../src/services/notificationChannels/index';
import { setupTestDatabase, cleanupTestDatabase } from '../../setup';

describe('通知系统测试', () => {
  let notificationService: NotificationService;

  beforeAll(async () => {
    await setupTestDatabase();
    notificationService = new NotificationService();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('多渠道通知发送', () => {
    it('should send notification via multiple channels', async () => {
      const notification = {
        userId: 'test-user-123',
        title: '订单状态更新',
        content: '您的订单已发货',
        channels: ['push', 'sms', 'email'],
        data: {
          orderId: 'order-123',
          trackingNumber: 'SF123456789'
        }
      };

      const results = await notificationService.send(notification);

      expect(results).toHaveProperty('success');
      expect(results).toHaveProperty('failures');
      expect(results.success.length + results.failures.length).toBe(3);
    });

    it('should handle notification channel fallback', async () => {
      // 模拟推送服务失败
      vi.mock('../../src/services/notificationChannels/providers/push', () => ({
        send: vi.fn().mockRejectedValue(new Error('Push service unavailable'))
      }));

      const notification = {
        userId: 'test-user-456',
        title: '支付成功',
        content: '您的支付已成功',
        channels: ['push', 'sms'],
        fallbackChannel: 'email'
      };

      const result = await notificationService.send(notification);

      // 应该通过fallback渠道发送成功
      expect(result.failures.length).toBe(1);
      expect(result.success.length).toBeGreaterThan(0);
    });

    it('should respect user notification preferences', async () => {
      // 设置用户通知偏好
      await notificationService.setUserPreferences('user-789', {
        marketing: { enabled: false },
        transactions: { enabled: true, channels: ['push', 'sms'] },
        system: { enabled: true, channels: ['push'] }
      });

      const marketingNotification = {
        userId: 'user-789',
        type: 'marketing',
        title: '促销活动',
        content: '限时特惠'
      };

      const result = await notificationService.send(marketingNotification);

      // 营销通知应该被跳过
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('disabled');
    });

    it('should batch send notifications efficiently', async () => {
      const notifications = Array(1000).fill(null).map((_, index) => ({
        userId: `user-${index}`,
        title: '系统维护通知',
        content: '系统将于今晚维护',
        type: 'system'
      }));

      const startTime = Date.now();
      const results = await notificationService.sendBatch(notifications);
      const duration = Date.now() - startTime;

      expect(results.processed).toBe(1000);
      expect(results.failed).toBeLessThan(100); // 失败率小于10%
      expect(duration).toBeLessThan(5000); // 5秒内完成
    });
  });

  describe('通知模板系统', () => {
    it('should render templates with variables', async () => {
      const template = {
        id: 'order-shipped',
        title: '订单{{orderNumber}}已发货',
        content: '您的订单{{orderNumber}}已通过{{carrier}}发货，单号：{{trackingNumber}}',
        variables: ['orderNumber', 'carrier', 'trackingNumber']
      };

      await notificationService.createTemplate(template);

      const rendered = await notificationService.renderTemplate('order-shipped', {
        orderNumber: 'ORD-2024-001',
        carrier: '顺丰快递',
        trackingNumber: 'SF123456789'
      });

      expect(rendered.title).toBe('订单ORD-2024-001已发货');
      expect(rendered.content).toContain('ORD-2024-001');
      expect(rendered.content).toContain('顺丰快递');
      expect(rendered.content).toContain('SF123456789');
    });

    it('should support conditional template blocks', async () => {
      const template = {
        id: 'payment-result',
        title: '支付{{#if success}}成功{{else}}失败{{/if}}',
        content: '订单{{orderNumber}}支付{{#if success}}成功，金额：{{amount}}{{else}}失败，原因：{{reason}}{{/if}}'
      };

      await notificationService.createTemplate(template);

      // 测试成功情况
      const successRender = await notificationService.renderTemplate('payment-result', {
        success: true,
        orderNumber: 'ORD-001',
        amount: 199.99
      });

      expect(successRender.title).toBe('支付成功');
      expect(successRender.content).toContain('成功，金额：199.99');

      // 测试失败情况
      const failRender = await notificationService.renderTemplate('payment-result', {
        success: false,
        orderNumber: 'ORD-002',
        reason: '余额不足'
      });

      expect(failRender.title).toBe('支付失败');
      expect(failRender.content).toContain('失败，原因：余额不足');
    });

    it('should handle template inheritance', async () => {
      const baseTemplate = {
        id: 'base-notification',
        title: '【中道商城】{{title}}',
        content: '{{content}}',
        footer: '如有疑问，请联系客服'
      };

      const childTemplate = {
        id: 'child-notification',
        extends: 'base-notification',
        variables: ['title', 'content']
      };

      await notificationService.createTemplate(baseTemplate);
      await notificationService.createTemplate(childTemplate);

      const rendered = await notificationService.renderTemplate('child-notification', {
        title: '新消息',
        content: '您有一条新的订单消息'
      });

      expect(rendered.title).toBe('【中道商城】新消息');
      expect(rendered.content).toBe('您有一条新的订单消息');
      expect(rendered.footer).toBe('如有疑问，请联系客服');
    });
  });

  describe('通知调度和限流', () => {
    it('should schedule delayed notifications', async () => {
      const scheduledNotification = {
        userId: 'user-scheduled',
        title: '预约提醒',
        content: '您有一个预约将在1小时后开始',
        scheduleAt: new Date(Date.now() + 3600000), // 1小时后
        channels: ['push']
      };

      const scheduleId = await notificationService.schedule(scheduledNotification);
      expect(scheduleId).toBeDefined();

      // 获取调度信息
      const scheduleInfo = await notificationService.getScheduleInfo(scheduleId);
      expect(scheduleInfo.status).toBe('scheduled');
      expect(new Date(scheduleInfo.scheduleAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('should cancel scheduled notifications', async () => {
      const notification = {
        userId: 'user-cancel',
        title: '待取消通知',
        scheduleAt: new Date(Date.now() + 3600000)
      };

      const scheduleId = await notificationService.schedule(notification);

      const cancelResult = await notificationService.cancelSchedule(scheduleId);
      expect(cancelResult).toBe(true);

      const scheduleInfo = await notificationService.getScheduleInfo(scheduleId);
      expect(scheduleInfo.status).toBe('cancelled');
    });

    it('should enforce notification rate limits', async () => {
      const userId = 'user-rate-limit';
      const notifications = Array(20).fill(null).map((_, index) => ({
        userId,
        title: `通知${index}`,
        content: '内容',
        channels: ['push']
      }));

      const results = await notificationService.sendBatch(notifications);

      // 部分通知应该被限流
      expect(results.rateLimited).toBeGreaterThan(0);
      expect(results.sent).toBeLessThan(20);
    });

    it('should implement exponential backoff for failed notifications', async () => {
      // 模拟总是失败的SMS服务
      vi.mock('../../src/services/notificationChannels/providers/sms', () => ({
        send: vi.fn().mockRejectedValue(new Error('Service unavailable'))
      }));

      const notification = {
        userId: 'user-retry',
        title: '重试测试',
        content: '测试内容',
        channels: ['sms'],
        retryConfig: {
          maxRetries: 3,
          backoffFactor: 2
        }
      };

      const result = await notificationService.send(notification);

      // 验证重试次数
      expect(result.retryAttempts).toBe(3);
      expect(result.status).toBe('failed');
    });
  });

  describe('通知统计和分析', () => {
    it('should track notification metrics', async () => {
      const metrics = await notificationService.getMetrics({
        startDate: new Date(Date.now() - 86400000), // 最近24小时
        endDate: new Date(),
        groupBy: 'channel'
      });

      expect(metrics).toHaveProperty('totalSent');
      expect(metrics).toHaveProperty('totalDelivered');
      expect(metrics).toHaveProperty('totalFailed');
      expect(metrics).toHaveProperty('deliveryRate');
      expect(metrics).toHaveProperty('channels');

      // 验证各渠道统计
      ['push', 'sms', 'email', 'wechat'].forEach(channel => {
        if (metrics.channels[channel]) {
          expect(metrics.channels[channel]).toHaveProperty('sent');
          expect(metrics.channels[channel]).toHaveProperty('delivered');
          expect(metrics.channels[channel]).toHaveProperty('failed');
        }
      });
    });

    it('should generate notification performance report', async () => {
      const report = await notificationService.generatePerformanceReport({
        startDate: new Date(Date.now() - 7 * 86400000), // 最近7天
        endDate: new Date(),
        includeDetails: true
      });

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('bestPerformingChannels');
      expect(report).toHaveProperty('recommendations');

      // 验证趋势数据
      expect(report.trends).toHaveProperty('daily');
      expect(report.trends.daily.length).toBe(7);

      // 验证性能指标
      expect(report.summary).toHaveProperty('avgDeliveryTime');
      expect(report.summary).toHaveProperty('peakHours');
      expect(report.summary).toHaveProperty('optimalChannels');
    });

    it('should analyze user engagement', async () => {
      const engagement = await notificationService.getUserEngagement('test-user', {
        days: 30
      });

      expect(engagement).toHaveProperty('totalNotifications');
      expect(engagement).toHaveProperty('openedCount');
      expect(engagement).toHaveProperty('clickedCount');
      expect(engagement).toHaveProperty('openRate');
      expect(engagement).toHaveProperty('clickRate');
      expect(engagement).toHaveProperty('preferredChannels');
      expect(engagement).toHaveProperty('activeHours');

      expect(engagement.openRate).toBeGreaterThanOrEqual(0);
      expect(engagement.openRate).toBeLessThanOrEqual(1);
    });
  });

  describe('实时通知推送', () => {
    it('should handle WebSocket real-time notifications', async () => {
      const notification = {
        userId: 'user-websocket',
        title: '实时通知',
        content: '这是一条实时通知',
        type: 'real_time'
      };

      // 模拟WebSocket连接
      const mockWebSocket = {
        send: vi.fn(),
        readyState: 1 // OPEN
      };

      notificationService.addWebSocketConnection('user-websocket', mockWebSocket);

      await notificationService.sendRealtime(notification);

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('实时通知')
      );
    });

    it('should manage WebSocket connection lifecycle', async () => {
      const userId = 'user-connection-test';
      const connections = Array(5).fill(null).map(() => ({
        send: vi.fn(),
        readyState: 1
      }));

      // 添加多个连接
      connections.forEach((conn, index) => {
        notificationService.addWebSocketConnection(`${userId}-${index}`, conn);
      });

      // 获取用户连接数
      const connectionCount = notificationService.getUserConnectionCount(userId);
      expect(connectionCount).toBe(5);

      // 广播消息
      await notificationService.broadcastToUser(userId, '广播测试消息');

      connections.forEach(conn => {
        expect(conn.send).toHaveBeenCalledWith(
          expect.stringContaining('广播测试消息')
        );
      });

      // 移除所有连接
      connections.forEach((conn, index) => {
        notificationService.removeWebSocketConnection(`${userId}-${index}`);
      });

      const finalCount = notificationService.getUserConnectionCount(userId);
      expect(finalCount).toBe(0);
    });

    it('should handle connection failures gracefully', async () => {
      const userId = 'user-failure-test';

      // 添加已关闭的连接
      const closedConnection = {
        send: vi.fn().mockImplementation(() => {
          throw new Error('Connection closed');
        }),
        readyState: 3 // CLOSED
      };

      notificationService.addWebSocketConnection(userId, closedConnection);

      // 发送消息不应该抛出错误
      await expect(
        notificationService.broadcastToUser(userId, '测试消息')
      ).resolves.not.toThrow();

      // 坏连接应该被自动移除
      const connectionCount = notificationService.getUserConnectionCount(userId);
      expect(connectionCount).toBe(0);
    });
  });

  describe('通知偏好管理', () => {
    it('should update user notification preferences', async () => {
      const preferences = {
        marketing: {
          enabled: true,
          channels: ['email'],
          frequency: 'weekly'
        },
        transactions: {
          enabled: true,
          channels: ['push', 'sms'],
          quietHours: {
            start: '22:00',
            end: '08:00'
          }
        },
        system: {
          enabled: true,
          channels: ['push']
        }
      };

      await notificationService.updateUserPreferences('user-prefs', preferences);

      const savedPrefs = await notificationService.getUserPreferences('user-prefs');
      expect(savedPrefs).toEqual(preferences);
    });

    it('should respect quiet hours', async () => {
      const now = new Date();
      const quietHour = now.getHours() === 23 ? 0 : now.getHours() + 1; // 设置为下一小时

      await notificationService.updateUserPreferences('user-quiet', {
        all: {
          enabled: true,
          quietHours: {
            start: `${quietHour}:00`,
            end: `${quietHour}:30`
          }
        }
      });

      const notification = {
        userId: 'user-quiet',
        title: '静默期测试',
        content: '应该在静默期',
        channels: ['push']
      };

      const result = await notificationService.send(notification);

      if (now.getHours() === quietHour ||
          (now.getHours() === (quietHour - 1) && now.getMinutes() >= 30)) {
        // 在静默期内，应该被推迟
        expect(result.deferred).toBe(true);
      }
    });

    it('should handle notification categories', async () => {
      const categories = await notificationService.getNotificationCategories();

      expect(Array.isArray(categories)).toBe(true);
      categories.forEach(category => {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('description');
        expect(category).toHaveProperty('defaultChannels');
      });
    });
  });
});