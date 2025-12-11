import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../../../shared/types/response';
import {
  NotificationStatus,
  NotificationPriority,
  NotificationCategory,
  NotificationType,
  NotificationChannelType
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 获取用户通知列表
 */
export const getNotificationsController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      page = 1,
      perPage = 20,
      category,
      type,
      status,
      isRead,
      priority,
      startDate,
      endDate
    } = req.query;

    // 构建查询条件
    const where: any = {
      recipientId: userId,
      recipientType: 'USER'
    };

    if (category) where.category = category as NotificationCategory;
    if (type) where.type = type as NotificationType;
    if (status) where.status = status as NotificationStatus;
    if (priority) where.priority = priority as NotificationPriority;

    if (isRead !== undefined) {
      where.isRead = isRead === 'true';
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // 查询通知列表
    const [notifications, total] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (Number(page) - 1) * Number(perPage),
        take: Number(perPage),
        include: {
          template: {
            select: {
              id: true,
              name: true,
              category: true
            }
          }
        }
      }),
      prisma.notifications.count({ where })
    ]);

    // 转换数据格式
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      category: notification.category,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      priority: notification.priority,
      status: notification.status,
      isRead: notification.isRead,
      readAt: notification.readAt,
      channels: JSON.parse(notification.channels || '[]'),
      sentChannels: JSON.parse(notification.sentChannels || '[]'),
      failedChannels: notification.failedChannels ? JSON.parse(notification.failedChannels) : [],
      relatedType: notification.relatedType,
      relatedId: notification.relatedId,
      scheduledAt: notification.scheduledAt,
      sentAt: notification.sentAt,
      completedAt: notification.completedAt,
      createdAt: notification.createdAt,
      template: notification.template
    }));

    const response: ApiResponse = {
      success: true,
      data: {
        notifications: formattedNotifications,
        pagination: {
          page: Number(page),
          perPage: Number(perPage),
          total,
          totalPages: Math.ceil(total / Number(perPage))
        }
      },
      message: '获取通知列表成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取通知列表失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 获取通知详情
 */
export const getNotificationByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const notification = await prisma.notifications.findFirst({
      where: {
        id,
        recipientId: userId,
        recipientType: 'USER'
      },
      include: {
        template: true
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: '通知不存在'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 转换数据格式
    const formattedNotification = {
      id: notification.id,
      category: notification.category,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      priority: notification.priority,
      status: notification.status,
      isRead: notification.isRead,
      readAt: notification.readAt,
      channels: JSON.parse(notification.channels || '[]'),
      sentChannels: JSON.parse(notification.sentChannels || '[]'),
      failedChannels: notification.failedChannels ? JSON.parse(notification.failedChannels) : [],
      sendResult: notification.sendResult ? JSON.parse(notification.sendResult) : {},
      errorReason: notification.errorReason,
      retryCount: notification.retryCount,
      maxRetries: notification.maxRetries,
      relatedType: notification.relatedType,
      relatedId: notification.relatedId,
      businessData: notification.businessData ? JSON.parse(notification.businessData) : {},
      scheduledAt: notification.scheduledAt,
      sentAt: notification.sentAt,
      completedAt: notification.completedAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      template: notification.template
    };

    const response: ApiResponse = {
      success: true,
      data: { notification: formattedNotification },
      message: '获取通知详情成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取通知详情失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取通知详情失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 发送通知（管理员功能）
 */
export const sendNotificationController = async (req: Request, res: Response) => {
  try {
    const {
      recipientIds,
      recipientType = 'USER',
      templateId,
      category,
      type,
      title,
      content,
      channels = ['IN_APP'],
      priority = 'NORMAL',
      scheduledAt,
      relatedType,
      relatedId,
      businessData,
      variables = {}
    } = req.body;

    // 验证必要参数
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RECIPIENTS',
          message: '接收者ID列表不能为空'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 如果使用模板，获取模板信息
    let templateContent = { title, content };
    if (templateId) {
      const template = await prisma.notificationsTemplate.findUnique({
        where: { id: templateId, isActive: true }
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: '通知模板不存在或已禁用'
          },
          timestamp: new Date().toISOString()
        });
      }

      templateContent = {
        title: template.title,
        content: template.content
      };

      // 合并模板默认渠道
      const defaultChannels = JSON.parse(template.defaultChannels || '[]');
      channels = [...new Set([...defaultChannels, ...channels])];
    }

    // 处理模板变量替换
    const processedTitle = replaceVariables(templateContent.title, variables);
    const processedContent = replaceVariables(templateContent.content, variables);

    // 批量创建通知
    const notifications = await Promise.all(
      recipientIds.map(async (recipientId: string) => {
        return await prisma.notifications.create({
          data: {
            recipientId,
            recipientType,
            templateId,
            category: category || 'SYSTEM',
            type: type || 'INFO',
            title: processedTitle,
            content: processedContent,
            variables: JSON.stringify(variables),
            channels: JSON.stringify(channels),
            sentChannels: '[]',
            status: scheduledAt ? 'PENDING' : 'SENDING',
            priority: priority as NotificationPriority,
            relatedType,
            relatedId,
            businessData: JSON.stringify(businessData || {}),
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null
          }
        });
      })
    );

    // 如果不是定时发送，立即处理发送逻辑
    if (!scheduledAt) {
      // TODO: 这里应该调用通知发送服务来实际发送通知
      // 暂时标记为已发送
      await Promise.all(
        notifications.map(async (notification) => {
          await prisma.notifications.update({
            where: { id: notification.id },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              sentChannels: JSON.stringify(['IN_APP']), // 暂时只标记为站内消息发送
              completedAt: new Date()
            }
          });
        })
      );
    }

    const response: ApiResponse = {
      success: true,
      data: {
        sentCount: notifications.length,
        notificationIds: notifications.map(n => n.id)
      },
      message: scheduledAt ? '通知创建成功，将按计划发送' : '通知发送成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('发送通知失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '发送通知失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 标记通知为已读
 */
export const markAsReadController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const notification = await prisma.notifications.findFirst({
      where: {
        id,
        recipientId: userId,
        recipientType: 'USER'
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: '通知不存在'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (notification.isRead) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_READ',
          message: '通知已经标记为已读'
        },
        timestamp: new Date().toISOString()
      });
    }

    await prisma.notifications.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    const response: ApiResponse = {
      success: true,
      data: null,
      message: '通知已标记为已读',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('标记通知为已读失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '标记通知为已读失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 标记所有通知为已读
 */
export const markAllAsReadController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { category, type } = req.body;

    const where: any = {
      recipientId: userId,
      recipientType: 'USER',
      isRead: false
    };

    if (category) where.category = category;
    if (type) where.type = type;

    const result = await prisma.notifications.updateMany({
      where,
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    const response: ApiResponse = {
      success: true,
      data: {
        markedCount: result.count
      },
      message: `已标记 ${result.count} 条通知为已读`,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('标记所有通知为已读失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '标记所有通知为已读失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 删除通知
 */
export const deleteNotificationController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const notification = await prisma.notifications.findFirst({
      where: {
        id,
        recipientId: userId,
        recipientType: 'USER'
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: '通知不存在'
        },
        timestamp: new Date().toISOString()
      });
    }

    await prisma.notifications.delete({
      where: { id }
    });

    const response: ApiResponse = {
      success: true,
      data: null,
      message: '通知删除成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('删除通知失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '删除通知失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 替换模板变量
 */
function replaceVariables(template: string, variables: Record<string, any>): string {
  if (!template || !variables) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}