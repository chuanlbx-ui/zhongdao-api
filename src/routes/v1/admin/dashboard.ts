import { Router, Request, Response } from 'express';
import { prisma } from '../../../shared/database/client';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { asyncHandler } from '../../../shared/middleware/error';
import { authenticate } from '../../../shared/middleware/auth';
import { logger } from '../../../shared/utils/logger';

const router = Router();

/**
 * 获取用户统计数据
 */
router.get('/users',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const [total, activeCount, todayNew, yesterdayNew] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({
          where: { createdAt: { gte: todayStart } }
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: yesterdayStart,
              lt: todayStart
            }
          }
        })
      ]);

      const growthRate = yesterdayNew > 0 
        ? ((todayNew - yesterdayNew) / yesterdayNew * 100).toFixed(1)
        : todayNew > 0 ? '100' : '0';

      res.json(createSuccessResponse({
        total,
        active: activeCount,
        todayNew,
        yesterdayNew,
        growth: (todayNew >= yesterdayNew ? '+' : '') + growthRate + '%'
      }));
    } catch (error) {
      logger.error('获取用户统计失败', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取用户统计失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取订单统计数据
 */
router.get('/orders',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));

      const [total, todayCount, totalAmount, todayAmount] = await Promise.all([
        prisma.order.count(),
        prisma.order.count({
          where: { createdAt: { gte: todayStart } }
        }),
        prisma.order.aggregate({
          _sum: { finalAmount: true },
          where: { status: 'PAID' }
        }),
        prisma.order.aggregate({
          _sum: { finalAmount: true },
          where: {
            status: 'PAID',
            createdAt: { gte: todayStart }
          }
        })
      ]);

      res.json(createSuccessResponse({
        total,
        todayCount,
        totalAmount: Number(totalAmount._sum.finalAmount || 0),
        todayAmount: Number(todayAmount._sum.finalAmount || 0)
      }));
    } catch (error) {
      logger.error('获取订单统计失败', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取订单统计失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取销售统计数据
 */
router.get('/sales',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await prisma.order.aggregate({
        _sum: { finalAmount: true },
        _count: true,
        where: { status: 'PAID' }
      });

      res.json(createSuccessResponse({
        totalSales: Number(result._sum.finalAmount || 0),
        orderCount: result._count
      }));
    } catch (error) {
      logger.error('获取销售统计失败', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取销售统计失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取仪表板概览数据（整合所有统计）
 */
router.get('/overview',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const [userCount, orderCount, shopCount, salesAmount] = await Promise.all([
        prisma.user.count(),
        prisma.order.count(),
        prisma.shop.count({ where: { status: 'ACTIVE' } }),
        prisma.order.aggregate({
          _sum: { finalAmount: true },
          where: { status: 'PAID' }
        })
      ]);

      res.json(createSuccessResponse({
        totalUsers: userCount,
        totalOrders: orderCount,
        activeShops: shopCount,
        totalSales: Number(salesAmount._sum.finalAmount || 0)
      }));
    } catch (error) {
      logger.error('获取仪表板概览失败', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取仪表板概览失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;
