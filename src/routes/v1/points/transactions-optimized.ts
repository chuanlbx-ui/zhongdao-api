import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { transactionOptimizedService } from '../../../shared/services/points/transaction-optimized.service';
import { performanceMonitor } from '../../../shared/middleware/performance-monitor-new';
import { logger } from '../../../shared/utils/logger';

const router = Router();

// 应用性能监控中间件
router.use(performanceMonitor.middleware());

// 获取用户通券流水记录（优化版）
router.get('/',
  authenticate,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是大于0的整数'),
    query('perPage')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须是1-100之间的整数'),
    query('type')
      .optional()
      .isIn(['PURCHASE', 'TRANSFER', 'RECHARGE', 'WITHDRAW', 'REFUND', 'COMMISSION', 'REWARD', 'FREEZE', 'UNFREEZE'])
      .withMessage('无效的交易类型'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式不正确'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式不正确'),
    query('cursor')
      .optional()
      .isString()
      .withMessage('游标必须是字符串'),
    query('strategy')
      .optional()
      .isIn(['cache', 'cursor', 'batch', 'auto'])
      .withMessage('无效的查询策略')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = Math.min(parseInt(req.query.perPage as string) || 20, 100);
    const type = req.query.type as any;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const cursor = req.query.cursor as string;
    const strategy = req.query.strategy as any || 'auto';
    const useCache = req.query.cache !== 'false';

    logger.info('请求交易记录（优化版）', {
      userId,
      page,
      perPage,
      type,
      cursor,
      strategy,
      useCache
    });

    try {
      const result = await transactionOptimizedService.getTransactionsOptimized(userId, {
        page,
        limit: perPage,
        cursor,
        type,
        startDate,
        endDate,
        useCache,
        strategy
      });

      res.json(createSuccessResponse(result, '获取通券流水成功'));
    } catch (error) {
      logger.error('获取通券流水失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_TRANSACTIONS_FAILED',
          message: '获取通券流水失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 获取用户交易统计（优化版）
router.get('/statistics',
  authenticate,
  [
    query('period')
      .optional()
      .isIn(['week', 'month', 'year'])
      .withMessage('统计周期必须是week、month或year'),
    query('useCache')
      .optional()
      .isBoolean()
      .withMessage('useCache必须是布尔值')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const period = (req.query.period as any) || 'month';
    const useCache = req.query.useCache !== 'false';

    try {
      const statistics = await transactionOptimizedService.getTransactionStatsOptimized(
        userId,
        period,
        useCache
      );

      res.json(createSuccessResponse(statistics, '获取交易统计成功'));
    } catch (error) {
      logger.error('获取交易统计失败', {
        userId,
        period,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATISTICS_FAILED',
          message: '获取交易统计失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 清除用户缓存（管理员或用户自己）
router.delete('/cache',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const targetUserId = req.query.userId as string;

    // 检查权限：只有管理员或用户自己可以清除缓存
    if (targetUserId && targetUserId !== userId && req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '没有权限清除其他用户的缓存',
          timestamp: new Date().toISOString()
        }
      });
    }

    const clearUserId = targetUserId || userId;

    try {
      await transactionOptimizedService.clearUserCache(clearUserId);

      logger.info('清除用户交易缓存', {
        operatorId: userId,
        targetUserId: clearUserId
      });

      res.json(createSuccessResponse(null, '缓存清除成功'));
    } catch (error) {
      logger.error('清除用户交易缓存失败', {
        operatorId: userId,
        targetUserId: clearUserId,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'CLEAR_CACHE_FAILED',
          message: '清除缓存失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 预加载用户交易数据
router.post('/preload',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const { userIds } = req.body;

    // 只有管理员可以批量预加载
    if (userIds && req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '没有权限批量预加载',
          timestamp: new Date().toISOString()
        }
      });
    }

    try {
      if (userIds && Array.isArray(userIds)) {
        // 批量预加载
        await transactionOptimizedService.batchPreloadUserTransactions(userIds);
        logger.info('批量预加载交易数据', {
          operatorId: userId,
          userCount: userIds.length
        });
      } else {
        // 预加载自己
        await transactionOptimizedService.preloadUserTransactions(userId);
        logger.info('预加载交易数据', { userId });
      }

      res.json(createSuccessResponse(null, '预加载成功'));
    } catch (error) {
      logger.error('预加载交易数据失败', {
        operatorId: userId,
        userIds,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'PRELOAD_FAILED',
          message: '预加载失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

export default router;