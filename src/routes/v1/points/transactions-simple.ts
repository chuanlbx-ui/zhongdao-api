import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { prisma } from '../../../shared/database/client';
import { ErrorCode } from '../../../shared/types/response';

const router = Router();

// 简化版交易记录API - 紧急修复用
router.get('/simple', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);
    const type = req.query.type as string;
    const skip = (page - 1) * perPage;

    logger.info(`[Simple Transactions] Query start: userId=${userId}, page=${page}`);

    // 使用最简单的查询，避免复杂操作
    const whereClause: any = {
      OR: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    };

    if (type) {
      whereClause.type = type;
    }

    // 使用超时的简单查询
    const transactions = await Promise.race([
      prisma.pointsTransactions.findMany({
        where: whereClause,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          transactionNo: true,
          amount: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
          completedAt: true,
          fromUserId: true,
          toUserId: true
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('查询超时')), 5000)
      )
    ]) as any[];

    // 简单计数查询
    const total = await Promise.race([
      prisma.pointsTransactions.count({ where: whereClause }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('计数查询超时')), 3000)
      )
    ]) as number;

    // 处理结果
    const processedTransactions = transactions.map(t => ({
      ...t,
      isIncoming: t.toUserId === userId,
      isOutgoing: t.fromUserId === userId
    }));

    logger.info(`[Simple Transactions] Query completed: count=${transactions.length}, total=${total}`);

    res.json(createSuccessResponse({
      transactions: processedTransactions,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNext: page * perPage < total,
        hasPrev: page > 1
      }
    }));

  } catch (error: any) {
    logger.error('[Simple Transactions] Error:', error);

    if (error.message === '查询超时' || error.message === '计数查询超时') {
      res.status(408).json(createErrorResponse(
        ErrorCode.OPERATION_TIMEOUT,
        '查询超时，请稍后重试'
      ));
    } else {
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取交易记录失败'
      ));
    }
  }
});

export default router;