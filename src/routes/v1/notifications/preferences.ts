import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../../../shared/types/response';

const prisma = new PrismaClient();

/**
 * 获取用户通知偏好设置
 */
export const getNotificationPreferencesController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId }
    });

    // 如果用户没有设置偏好，创建默认设置
    if (!preferences) {
      preferences = await prisma.notificationPreference.create({
        data: {
          userId,
          isEnabled: true,
          channelPreferences: JSON.stringify({
            SYSTEM: ['IN_APP'],
            ORDER: ['IN_APP', 'SMS'],
            PAYMENT: ['IN_APP', 'SMS'],
            LOGISTICS: ['IN_APP', 'SMS'],
            USER_LEVEL: ['IN_APP'],
            SHOP: ['IN_APP'],
            INVENTORY: ['IN_APP', 'SMS'],
            PROMOTION: ['IN_APP'],
            ANNOUNCEMENT: ['IN_APP'],
            SECURITY: ['IN_APP', 'SMS'],
            FINANCIAL: ['IN_APP', 'SMS'],
            TEAM: ['IN_APP'],
            ACTIVITY: ['IN_APP']
          }),
          categorySettings: JSON.stringify({
            SYSTEM: { enabled: true, priority: 'NORMAL' },
            ORDER: { enabled: true, priority: 'HIGH' },
            PAYMENT: { enabled: true, priority: 'HIGH' },
            LOGISTICS: { enabled: true, priority: 'NORMAL' },
            USER_LEVEL: { enabled: true, priority: 'HIGH' },
            SHOP: { enabled: true, priority: 'NORMAL' },
            INVENTORY: { enabled: true, priority: 'HIGH' },
            PROMOTION: { enabled: true, priority: 'NORMAL' },
            ANNOUNCEMENT: { enabled: true, priority: 'NORMAL' },
            SECURITY: { enabled: true, priority: 'URGENT' },
            FINANCIAL: { enabled: true, priority: 'HIGH' },
            TEAM: { enabled: true, priority: 'NORMAL' },
            ACTIVITY: { enabled: true, priority: 'NORMAL' }
          })
        }
      });
    }

    // 转换数据格式
    const formattedPreferences = {
      userId: preferences.userId,
      isEnabled: preferences.isEnabled,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      channelPreferences: JSON.parse(preferences.channelPreferences),
      categorySettings: JSON.parse(preferences.categorySettings),
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt
    };

    const response: ApiResponse = {
      success: true,
      data: { preferences: formattedPreferences },
      message: '获取通知偏好设置成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取通知偏好设置失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取通知偏好设置失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 更新用户通知偏好设置
 */
export const updateNotificationPreferencesController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      isEnabled,
      quietHoursStart,
      quietHoursEnd,
      channelPreferences,
      categorySettings
    } = req.body;

    // 验证时间格式
    if (quietHoursStart && !isValidTimeFormat(quietHoursStart)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIME_FORMAT',
          message: '免打扰开始时间格式不正确，应为HH:mm'
        },
        timestamp: new Date().toISOString()
      });
    }

    if (quietHoursEnd && !isValidTimeFormat(quietHoursEnd)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TIME_FORMAT',
          message: '免打扰结束时间格式不正确，应为HH:mm'
        },
        timestamp: new Date().toISOString()
      });
    }

    // 构建更新数据
    const updateData: any = {};
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (quietHoursStart !== undefined) updateData.quietHoursStart = quietHoursStart;
    if (quietHoursEnd !== undefined) updateData.quietHoursEnd = quietHoursEnd;
    if (channelPreferences !== undefined) {
      updateData.channelPreferences = JSON.stringify(channelPreferences);
    }
    if (categorySettings !== undefined) {
      updateData.categorySettings = JSON.stringify(categorySettings);
    }

    // 更新偏好设置
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        isEnabled: isEnabled !== undefined ? isEnabled : true,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
        channelPreferences: JSON.stringify(
          channelPreferences || {
            SYSTEM: ['IN_APP'],
            ORDER: ['IN_APP', 'SMS'],
            PAYMENT: ['IN_APP', 'SMS'],
            LOGISTICS: ['IN_APP', 'SMS'],
            USER_LEVEL: ['IN_APP'],
            SHOP: ['IN_APP'],
            INVENTORY: ['IN_APP', 'SMS'],
            PROMOTION: ['IN_APP'],
            ANNOUNCEMENT: ['IN_APP'],
            SECURITY: ['IN_APP', 'SMS'],
            FINANCIAL: ['IN_APP', 'SMS'],
            TEAM: ['IN_APP'],
            ACTIVITY: ['IN_APP']
          }
        ),
        categorySettings: JSON.stringify(
          categorySettings || {
            SYSTEM: { enabled: true, priority: 'NORMAL' },
            ORDER: { enabled: true, priority: 'HIGH' },
            PAYMENT: { enabled: true, priority: 'HIGH' },
            LOGISTICS: { enabled: true, priority: 'NORMAL' },
            USER_LEVEL: { enabled: true, priority: 'HIGH' },
            SHOP: { enabled: true, priority: 'NORMAL' },
            INVENTORY: { enabled: true, priority: 'HIGH' },
            PROMOTION: { enabled: true, priority: 'NORMAL' },
            ANNOUNCEMENT: { enabled: true, priority: 'NORMAL' },
            SECURITY: { enabled: true, priority: 'URGENT' },
            FINANCIAL: { enabled: true, priority: 'HIGH' },
            TEAM: { enabled: true, priority: 'NORMAL' },
            ACTIVITY: { enabled: true, priority: 'NORMAL' }
          }
        )
      }
    });

    // 转换数据格式
    const formattedPreferences = {
      userId: preferences.userId,
      isEnabled: preferences.isEnabled,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      channelPreferences: JSON.parse(preferences.channelPreferences),
      categorySettings: JSON.parse(preferences.categorySettings),
      createdAt: preferences.createdAt,
      updatedAt: preferences.updatedAt
    };

    const response: ApiResponse = {
      success: true,
      data: { preferences: formattedPreferences },
      message: '通知偏好设置更新成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('更新通知偏好设置失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '更新通知偏好设置失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 验证时间格式
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}