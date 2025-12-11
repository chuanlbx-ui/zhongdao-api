import { Router, Request, Response } from 'express';
import { prisma } from '../../../shared/database/client';
import { createSuccessResponse, createErrorResponse, ErrorCode, createPaginatedResponse } from '../../../shared/types/response';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { authenticate } from '../../../shared/middleware/auth';
import { logger } from '../../../shared/utils/logger';

const router = Router();

/**
 * 获取用户列表（分页）
 */
router.get('/',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 10, 100);
      const skip = (page - 1) * perPage;

      const [users, total] = await Promise.all([
        prisma.users.findMany({
          skip,
          take: perPage,
          select: {
            id: true,
            openid: true,
            nickname: true,
            phone: true,
            avatarUrl: true,
            level: true,
            status: true,
            totalSales: true,
            directCount: true,
            teamCount: true,
            pointsBalance: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.users.count()
      ]);

      res.json(createPaginatedResponse(
        users,
        total,
        page,
        perPage,
        '获取用户列表成功'
      ));
    } catch (error) {
      logger.error('获取用户列表失败', { error });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取用户列表失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取用户详情
 */
router.get('/:id',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const user = await prisma.users.findUnique({
        where: { id: req.params.id },
        include: {
          shops: {
            select: {
              id: true,
              shopType: true,
              shopLevel: true,
              shopName: true,
              status: true,
              totalSales: true,
              totalOrders: true
            }
          },
          buyerOrders: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              orderNo: true,
              type: true,
              status: true,
              finalAmount: true,
              createdAt: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json(createErrorResponse(
          ErrorCode.USER_NOT_FOUND,
          '用户不存在'
        ));
      }

      res.json(createSuccessResponse(user, '获取用户详情成功'));
    } catch (error) {
      logger.error('获取用户详情失败', { error, userId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取用户详情失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 更新用户信息
 */
router.put('/:id',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const { nickname, phone, level, status } = req.body;
      
      const updateData: any = {};
      if (nickname !== undefined) updateData.nickname = nickname;
      if (phone !== undefined) updateData.phone = phone;
      if (level !== undefined) updateData.level = level;
      if (status !== undefined) updateData.status = status;

      const updated = await prisma.users.update({
        where: { id: req.params.id },
        data: updateData
      });

      res.json(createSuccessResponse(updated, '更新用户成功'));
    } catch (error) {
      logger.error('更新用户失败', { error, userId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '更新用户失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 删除用户
 */
router.delete('/:id',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      await prisma.users.delete({
        where: { id: req.params.id }
      });

      res.json(createSuccessResponse(null, '删除用户成功'));
    } catch (error) {
      logger.error('删除用户失败', { error, userId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '删除用户失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

/**
 * 获取用户统计信息
 */
router.get('/:id/statistics',
  authenticate,
  asyncHandler2(async (req: Request, res: Response) => {
    try {
      const user = await prisma.users.findUnique({
        where: { id: req.params.id },
        select: {
          totalSales: true,
          directSales: true,
          teamSales: true,
          totalBottles: true,
          directCount: true,
          teamCount: true,
          pointsBalance: true,
          pointsFrozen: true
        }
      });

      if (!user) {
        return res.status(404).json(createErrorResponse(
          ErrorCode.USER_NOT_FOUND,
          '用户不存在'
        ));
      }

      res.json(createSuccessResponse(user, '获取用户统计成功'));
    } catch (error) {
      logger.error('获取用户统计失败', { error, userId: req.params.id });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取用户统计失败',
        error instanceof Error ? error.message : '未知错误'
      ));
    }
  })
);

export default router;
