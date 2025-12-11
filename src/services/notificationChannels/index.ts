import {
  NotificationChannelType,
  NotificationStatus,
  Notification
} from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import {
  WeChatNotificationService,
  EmailNotificationService,
  SMSNotificationService
} from './providers';

const prisma = new PrismaClient();

export interface NotificationChannelResult {
  success: boolean;
  messageId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface NotificationPayload {
  id: string;
  recipientId: string;
  recipientType: string;
  title: string;
  content: string;
  data?: Record<string, any>;
  priority?: string;
  category?: string;
}

/**
 * 通知渠道管理器
 */
export class NotificationChannelManager {
  private channelServices: Map<NotificationChannelType, any> = new Map();

  constructor() {
    this.initializeChannelServices();
  }

  /**
   * 初始化渠道服务
   */
  private initializeChannelServices() {
    // 注册微信小程序服务
    this.channelServices.set(NotificationChannelType.WECHAT_MINI, new WeChatNotificationService());

    // 注册邮件服务
    this.channelServices.set(NotificationChannelType.EMAIL, new EmailNotificationService());

    // 注册短信服务
    this.channelServices.set(NotificationChannelType.SMS, new SMSNotificationService());

    // 注册站内消息服务（默认实现）
    this.channelServices.set(NotificationChannelType.IN_APP, {
      send: this.sendInAppNotification.bind(this)
    });
  }

  /**
   * 通过指定渠道发送通知
   */
  async sendNotification(
    channelType: NotificationChannelType,
    payload: NotificationPayload
  ): Promise<NotificationChannelResult> {
    const channelService = this.channelServices.get(channelType);

    if (!channelService) {
      return {
        success: false,
        error: `不支持的通知渠道: ${channelType}`
      };
    }

    try {
      // 检查用户偏好设置
      const canSend = await this.checkUserPreference(payload.recipientId, channelType);
      if (!canSend) {
        return {
          success: false,
          error: '用户未启用该通知渠道'
        };
      }

      // 发送通知
      const result = await channelService.send(payload);

      // 记录渠道发送结果
      await this.logChannelResult(payload.id, channelType, result);

      return result;
    } catch (error) {
      console.error(`通知发送失败 [${channelType}]:`, error);

      const errorResult: NotificationChannelResult = {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };

      // 记录失败结果
      await this.logChannelResult(payload.id, channelType, errorResult);

      return errorResult;
    }
  }

  /**
   * 多渠道发送通知
   */
  async sendToMultipleChannels(
    channelTypes: NotificationChannelType[],
    payload: NotificationPayload
  ): Promise<NotificationChannelResult[]> {
    const results: NotificationChannelResult[] = [];

    // 并行发送到多个渠道
    const promises = channelTypes.map(async (channelType) => {
      const result = await this.sendNotification(channelType, payload);
      results.push({ ...result, channelType });
      return result;
    });

    await Promise.all(promises);

    return results;
  }

  /**
   * 检查用户通知偏好设置
   */
  private async checkUserPreference(
    userId: string,
    channelType: NotificationChannelType
  ): Promise<boolean> {
    try {
      const preference = await prisma.notificationsPreference.findUnique({
        where: { userId }
      });

      if (!preference || !preference.isEnabled) {
        return false;
      }

      const channelPreferences = JSON.parse(preference.channelPreferences);
      const categorySettings = JSON.parse(preference.categorySettings);

      // 检查渠道偏好
      if (!channelPreferences[payload.category || 'SYSTEM']?.includes(channelType)) {
        return false;
      }

      // 检查分类设置
      const categorySetting = categorySettings[payload.category || 'SYSTEM'];
      if (categorySetting && !categorySetting.enabled) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('检查用户偏好失败:', error);
      return true; // 默认允许发送
    }
  }

  /**
   * 记录渠道发送结果
   */
  private async logChannelResult(
    notificationId: string,
    channelType: NotificationChannelType,
    result: NotificationChannelResult
  ): Promise<void> {
    try {
      await prisma.notificationsChannel.create({
        data: {
          notificationId,
          channelType,
          status: result.success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          messageId: result.messageId,
          error: result.error,
          sentAt: new Date(),
          metadata: result.metadata ? JSON.stringify(result.metadata) : null
        }
      });
    } catch (error) {
      console.error('记录渠道发送结果失败:', error);
    }
  }

  /**
   * 发送站内消息
   */
  private async sendInAppNotification(
    payload: NotificationPayload
  ): Promise<NotificationChannelResult> {
    try {
      // 更新通知记录
      await prisma.notifications.update({
        where: { id: payload.id },
        data: {
          status: NotificationStatus.SENT,
          sentChannels: [NotificationChannelType.IN_APP]
        }
      });

      return {
        success: true,
        messageId: payload.id
      };
    } catch (error) {
      console.error('站内消息发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '站内消息发送失败'
      };
    }
  }

  /**
   * 获取渠道服务
   */
  public getChannelService(channelType: NotificationChannelType) {
    return this.channelServices.get(channelType);
  }
}

// 导出单例实例
export const notificationChannelManager = new NotificationChannelManager();