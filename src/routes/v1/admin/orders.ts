import { Router, Request, Response } from 'express';
import { prisma } from '../../../shared/database/client';
import { createSuccessResponse, createErrorResponse, ErrorCode, createPaginatedResponse } from '../../../shared/types/response';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { authenticate } from '../../../shared/middleware/auth';
import { logger } from '../../../shared/utils/logger';

const router = Router();

/**
 * 获取订单列表
 */
router.get('/',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 10, 100);
      const skip = (page - 1) * perPage;

      const [orders, total] = await Promise.all([
        prisma.orders.findMany({
          skip,
          take: perPage,
          include: {
            buyer: {
              select: {
                id: true,
                nickname: true,
                phone: true
              }
            },
            items: {
              select: {
                id: true,
                productName: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.orders.count()
      ]);

      res.json(createPaginatedResponse(
        orders,
        total,
        page,
        perPage,
        '获取订单列表成功'
      ));
    } catch (error) {
      logger.error('获取订单列表失败', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取订单列表失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取订单详情
 */
router.get('/:id',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const order = await prisma.orders.findUnique({
        where: { id: req.params.id },
        include: {
          buyer: {
            select: {
              id: true,
              nickname: true,
              phone: true,
              avatarUrl: true
            }
          },
          seller: {
            select: {
              id: true,
              nickname: true,
              phone: true
            }
          },
          items: {
            include: {
              products: {
                select: {
                  id: true,
                  name: true,
                  images: true
                }
              }
            }
          },
          logistics: true,
          payments: true
        }
      });

      if (!order) {
        return res.status(404).json(createErrorResponse(
          ErrorCode.NOT_FOUND,
          '订单不存在'
        ));
      }

      res.json(createSuccessResponse(order, '获取订单详情成功'));
    } catch (error) {
      logger.error('获取订单详情失败', { error, orderId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取订单详情失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 更新订单状态
 */
router.put('/:id/status',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { status } = req.body;

      const updated = await prisma.orders.update({
        where: { id: req.params.id },
        data: { 
          status,
          updatedAt: new Date()
        }
      });

      res.json(createSuccessResponse(updated, '更新订单状态成功'));
    } catch (error) {
      logger.error('更新订单状态失败', { error, orderId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '更新订单状态失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 确认订单
 */
router.post('/:id/confirm',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const updated = await prisma.orders.update({
        where: { id: req.params.id },
        data: { 
          status: 'CONFIRMED',
          updatedAt: new Date()
        }
      });

      res.json(createSuccessResponse(updated, '确认订单成功'));
    } catch (error) {
      logger.error('确认订单失败', { error, orderId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '确认订单失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 取消订单
 */
router.post('/:id/cancel',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const updated = await prisma.orders.update({
        where: { id: req.params.id },
        data: { 
          status: 'CANCELLED',
          cancelledAt: new Date(),
          updatedAt: new Date()
        }
      });

      res.json(createSuccessResponse(updated, '取消订单成功'));
    } catch (error) {
      logger.error('取消订单失败', { error, orderId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '取消订单失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;
