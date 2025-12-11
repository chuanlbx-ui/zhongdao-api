import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../../../shared/types/response';
import {
  NotificationCategory,
  NotificationChannelType,
  NotificationStatus
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 获取通知统计数据
 */
export const getNotificationStatisticsController = async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      category,
      period = 'daily' // daily, weekly, monthly
    } = req.query;

    // 构建日期范围
    const dateRange = buildDateRange(startDate as string, endDate as string);

    // 构建查询条件
    const where: any = {
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    };

    if (category) {
      where.category = category as NotificationCategory;
    }

    // 按周期分组统计
    let groupByClause: any;
    switch (period) {
      case 'weekly':
        groupByClause = {
          category: true,
          week: {
            _count: true
          }
        };
        break;
      case 'monthly':
        groupByClause = {
          category: true,
          month: {
            _count: true
          }
        };
        break;
      default: // daily
        groupByClause = {
          category: true,
          date: {
            _count: true
          }
        };
    }

    // 获取统计数据
    const statistics = await getNotificationStats(where, period as string);

    // 获取总体统计
    const overallStats = await getOverallStats(where);

    // 获取分类统计
    const categoryStats = await getCategoryStats(where);

    // 获取状态统计
    const statusStats = await getStatusStats(where);

    const response: ApiResponse = {
      success: true,
      data: {
        statistics,
        overall: overallStats,
        byCategory: categoryStats,
        byStatus: statusStats,
        period: period,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        }
      },
      message: '获取通知统计数据成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取通知统计数据失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取通知统计数据失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 获取渠道统计数据
 */
export const getChannelStatisticsController = async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      channelType
    } = req.query;

    // 构建日期范围
    const dateRange = buildDateRange(startDate as string, endDate as string);

    // 构建查询条件
    const where: any = {
      date: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    };

    if (channelType) {
      where.channelType = channelType as NotificationChannelType;
    }

    // 获取渠道统计数据
    const channelStats = await prisma.notificationsStatistics.findMany({
      where,
      orderBy: [
        { date: 'desc' },
        { category: 'asc' }
      ]
    });

    // 按渠道类型分组
    const groupedStats = channelStats.reduce((acc, stat) => {
      if (!acc[stat.channelType]) {
        acc[stat.channelType] = {
          channelType: stat.channelType,
          totalSent: 0,
          totalSuccess: 0,
          totalFailed: 0,
          successRate: 0,
          averageResponseTime: 0,
          dailyStats: []
        };
      }

      const channelData = acc[stat.channelType];
      channelData.totalSent += stat.totalSent;
      channelData.totalSuccess += stat.totalSuccess;
      channelData.totalFailed += stat.totalFailed;
      channelData.dailyStats.push({
        date: stat.date,
        totalSent: stat.totalSent,
        totalSuccess: stat.totalSuccess,
        totalFailed: stat.totalFailed,
        successRate: stat.successRate,
        averageResponseTime: stat.averageResponseTime
      });

      return acc;
    }, {} as any);

    // 计算总体成功率
    Object.values(groupedStats).forEach((channelData: any) => {
      if (channelData.totalSent > 0) {
        channelData.successRate = (channelData.totalSuccess / channelData.totalSent) * 100;
      }
    });

    const response: ApiResponse = {
      success: true,
      data: {
        channels: Object.values(groupedStats),
        period: 'daily',
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        }
      },
      message: '获取渠道统计数据成功',
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('获取渠道统计数据失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '获取渠道统计数据失败'
      },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 获取通知统计数据（按周期）
 */
async function getNotificationStats(where: any, period: string) {
  try {
    // 这里简化处理，实际应该使用更复杂的SQL来按周期分组
    const notifications = await prisma.notifications.findMany({
      where,
      select: {
        category: true,
        status: true,
        createdAt: true,
        channels: true,
        sentChannels: true
      }
    });

    // 按日期分组统计
    const stats = notifications.reduce((acc, notification) => {
      const dateKey = formatDateByPeriod(notification.createdAt, period);
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          totalSent: 0,
          totalSuccess: 0,
          totalFailed: 0,
          byCategory: {} as any,
          byStatus: {} as any
        };
      }

      const dayStats = acc[dateKey];
      dayStats.totalSent += 1;

      // 按状态统计
      if (!dayStats.byStatus[notification.status]) {
        dayStats.byStatus[notification.status] = 0;
      }
      dayStats.byStatus[notification.status] += 1;

      if (notification.status === 'SENT' || notification.status === 'COMPLETED' || notification.status === 'PARTIAL_SUCCESS') {
        dayStats.totalSuccess += 1;
      } else if (notification.status === 'FAILED') {
        dayStats.totalFailed += 1;
      }

      // 按分类统计
      if (!dayStats.byCategory[notification.category]) {
        dayStats.byCategory[notification.category] = 0;
      }
      dayStats.byCategory[notification.category] += 1;

      return acc;
    }, {} as any);

    // 计算成功率
    Object.values(stats).forEach((dayStats: any) => {
      dayStats.successRate = dayStats.totalSent > 0
        ? (dayStats.totalSuccess / dayStats.totalSent) * 100
        : 0;
    });

    return Object.values(stats).sort((a: any, b: any) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  } catch (error) {
    console.error('获取通知统计数据失败:', error);
    return [];
  }
}

/**
 * 获取总体统计
 */
async function getOverallStats(where: any) {
  try {
    const [total, success, failed, byStatus] = await Promise.all([
      prisma.notifications.count({ where }),
      prisma.notifications.count({
        where: {
          ...where,
          status: { in: ['SENT', 'COMPLETED', 'PARTIAL_SUCCESS'] }
        }
      }),
      prisma.notifications.count({
        where: {
          ...where,
          status: 'FAILED'
        }
      }),
      prisma.notifications.groupBy({
        by: ['status'],
        where,
        _count: true
      })
    ]);

    const successRate = total > 0 ? (success / total) * 100 : 0;

    return {
      total,
      success,
      failed,
      successRate: Math.round(successRate * 100) / 100,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as any)
    };
  } catch (error) {
    console.error('获取总体统计失败:', error);
    return {
      total: 0,
      success: 0,
      failed: 0,
      successRate: 0,
      byStatus: {}
    };
  }
}

/**
 * 获取分类统计
 */
async function getCategoryStats(where: any) {
  try {
    const categoryStats = await prisma.notifications.groupBy({
      by: ['category'],
      where,
      _count: true
    });

    return categoryStats.map(item => ({
      category: item.category,
      count: item._count
    }));
  } catch (error) {
    console.error('获取分类统计失败:', error);
    return [];
  }
}

/**
 * 获取状态统计
 */
async function getStatusStats(where: any) {
  try {
    const statusStats = await prisma.notifications.groupBy({
      by: ['status'],
      where,
      _count: true
    });

    return statusStats.map(item => ({
      status: item.status,
      count: item._count
    }));
  } catch (error) {
    console.error('获取状态统计失败:', error);
    return [];
  }
}

/**
 * 构建日期范围
 */
function buildDateRange(startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 默认30天

  // 设置时间为当天开始和结束
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * 按周期格式化日期
 */
function formatDateByPeriod(date: Date, period: string): string {
  switch (period) {
    case 'weekly':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().split('T')[0];
    case 'monthly':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    default: // daily
      return date.toISOString().split('T')[0];
  }
}