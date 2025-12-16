import { Router, Request, Response } from 'express';
import { createSuccessResponse, createErrorResponse } from '../../shared/types/response';
import { asyncHandler2 } from '../../shared/middleware/error';
import { logger } from '../../shared/utils/logger';

const router = Router();

/**
 * 获取用户列表（简化版，不需要认证）
 */
router.get('/', asyncHandler2(async (req: Request, res: Response) => {
  try {
    // 动态导入Prisma
    const { prisma } = await import('../../shared/database/client');

    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);
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
          pointsBalance: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.users.count()
    ]);

    // 格式化日期
    const formattedUsers = users.map(user => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    }));

    const response = {
      success: true,
      data: {
        items: formattedUsers,
        total: total,
        page: page,
        perPage: perPage,
        totalPages: Math.ceil(total / perPage)
      },
      message: '获取用户列表成功'
    };

    res.json(response);
  } catch (error) {
    logger.error('获取用户列表失败', { error });
    res.status(500).json(createErrorResponse(
      'INTERNAL_ERROR',
      '获取用户列表失败',
      error instanceof Error ? error.message : '未知错误'
    ));
  }
}));

export default router;