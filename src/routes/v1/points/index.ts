import { Router } from 'express';
import * as expressValidator from 'express-validator';
const { body, query } = expressValidator;
import { authenticate, requireMinLevel } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { prisma } from '../../../shared/database/client';
import { pointsService, PointsTransactionType } from '../../../shared/services/points';
import { logger } from '../../../shared/utils/logger';
import { configService } from '../../../modules/config';
import simpleTransactionsRouter from './transactions-simple';

const router = Router();

// 注册简化版交易记录API（紧急修复用）
router.use(simpleTransactionsRouter);

// 获取用户通券余额
router.get('/balance',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    try {
      const balance = await pointsService.getBalance(userId);

      res.json(createSuccessResponse(balance, '获取通券余额成功'));
    } catch (error) {
      logger.error('获取通券余额失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'GET_BALANCE_FAILED',
          message: error instanceof Error ? error.message : '获取通券余额失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 通券转账
router.post('/transfer',
  authenticate,
  [
    body('toUserId')
      .notEmpty()
      .withMessage('转入用户ID不能为空')
      .isLength({ min: 25, max: 25 })
      .withMessage('无效的用户ID格式'),
    body('amount')
      .notEmpty()
      .withMessage('转账金额不能为空')
      .isFloat({ min: 0.01 })
      .withMessage('转账金额必须大于等于0.01'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('转账说明不能超过200字符')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { toUserId, amount, description } = req.body;
    const fromUserId = req.user!.id;

    try {
      // 检查是否给自己转账
      if (fromUserId === toUserId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TRANSFER',
            message: '不能给自己转账',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 检查转账限额
      const transferLimit = await configService.getConfig<number>('points_max_transfer_amount', 10000);
      if (amount > transferLimit) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EXCEED_LIMIT',
            message: `单次转账限额为${transferLimit}通券`,
            timestamp: new Date().toISOString()
          }
        });
      }

      const result = await pointsService.transfer({
        fromUserId,
        toUserId,
        amount: parseFloat(amount),
        type: PointsTransactionType.TRANSFER,
        description: description || '用户转账'
      });

      logger.info('通券转账成功', {
        transactionNo: result.transactionNo,
        fromUserId,
        toUserId,
        amount,
        requestId: req.requestId
      });

      res.json(createSuccessResponse(result, '转账成功'));
    } catch (error) {
      logger.error('通券转账失败', {
        fromUserId,
        toUserId,
        amount,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'TRANSFER_FAILED',
          message: error instanceof Error ? error.message : '转账失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 通券充值（管理员权限）
router.post('/recharge',
  authenticate,
  (req, res, next) => {
    // 检查是否是管理员或者是董事等级
    if (req.user && (req.user.role === 'ADMIN' || req.user.level === 'DIRECTOR')) {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '需要管理员权限或董事等级',
          timestamp: new Date().toISOString()
        }
      });
    }
  },
  [
    body('userId')
      .notEmpty()
      .withMessage('用户ID不能为空')
      .isLength({ min: 25, max: 25 })
      .withMessage('无效的用户ID格式'),
    body('amount')
      .notEmpty()
      .withMessage('充值金额不能为空')
      .isFloat({ min: 1 })
      .withMessage('充值金额必须大于等于1'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('充值说明不能超过200字符')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { userId, amount, description } = req.body;

    try {
      // 检查充值限额
      const rechargeLimit = await configService.getConfig<number>('points_max_recharge_amount', 100000);
      if (amount > rechargeLimit) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EXCEED_LIMIT',
            message: `单次充值限额为${rechargeLimit}通券`,
            timestamp: new Date().toISOString()
          }
        });
      }

      const result = await pointsService.recharge(
        userId,
        parseFloat(amount),
        description || '管理员充值'
      );

      logger.info('通券充值成功', {
        operatorId: req.user!.id,
        userId,
        amount,
        transactionNo: result.transactionNo,
        requestId: req.requestId
      });

      res.json(createSuccessResponse(result, '充值成功'));
    } catch (error) {
      logger.error('通券充值失败', {
        operatorId: req.user!.id,
        userId,
        amount,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'RECHARGE_FAILED',
          message: error instanceof Error ? error.message : '充值失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 获取通券流水记录
router.get('/transactions',
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
      .withMessage('结束日期格式不正确')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;

    // 移除动态配置调用，使用固定值避免数据库查询
    const defaultPerPage = 20;
    const maxPerPage = 100;
    const perPage = Math.min(parseInt(req.query.perPage as string) || defaultPerPage, maxPerPage);
    const type = req.query.type as PointsTransactionType | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    console.log(`[API] 交易记录查询开始: userId=${userId}, page=${page}, perPage=${perPage}`);

    try {
      console.log(`[API] 调用getTransactions...`);
      const result = await pointsService.getTransactions(
        userId,
        page,
        perPage,
        type,
        startDate,
        endDate
      );

      console.log(`[API] getTransactions完成, 耗时: ${Date.now() - startTime}ms`);

      res.json(createSuccessResponse(result, '获取通券流水成功'));
    } catch (error) {
      console.error(`[API] 交易记录查询失败: 耗时${Date.now() - startTime}ms, 错误:`, error);
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

// 获取通券统计信息
router.get('/statistics',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    try {
      const statistics = await pointsService.getPointsStatistics(userId);

      res.json(createSuccessResponse(statistics, '获取通券统计成功'));
    } catch (error) {
      logger.error('获取通券统计失败', {
        userId,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATISTICS_FAILED',
          message: '获取通券统计失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 通券冻结/解冻（管理员权限）
router.post('/freeze',
  authenticate,
  (req, res, next) => {
    // 检查是否是管理员或者是董事等级
    if (req.user && (req.user.role === 'ADMIN' || req.user.level === 'DIRECTOR')) {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '需要管理员权限或董事等级',
          timestamp: new Date().toISOString()
        }
      });
    }
  },
  [
    body('userId')
      .notEmpty()
      .withMessage('用户ID不能为空')
      .isLength({ min: 25, max: 25 })
      .withMessage('无效的用户ID格式'),
    body('amount')
      .notEmpty()
      .withMessage('金额不能为空')
      .isFloat({ min: 0.01 })
      .withMessage('金额必须大于等于0.01'),
    body('type')
      .isIn(['FREEZE', 'UNFREEZE'])
      .withMessage('操作类型必须是FREEZE或UNFREEZE'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('说明不能超过200字符')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { userId, amount, type, description } = req.body;
    const operatorId = req.user!.id;

    try {
      await pointsService.freezePoints(
        userId,
        parseFloat(amount),
        type as 'FREEZE' | 'UNFREEZE',
        description
      );

      logger.info('通券冻结/解冻操作成功', {
        operatorId,
        userId,
        amount,
        type,
        description,
        requestId: req.requestId
      });

      res.json(createSuccessResponse(null, `${type === 'FREEZE' ? '冻结' : '解冻'}成功`));
    } catch (error) {
      logger.error('通券冻结/解冻操作失败', {
        operatorId,
        userId,
        amount,
        type,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'FREEZE_FAILED',
          message: error instanceof Error ? error.message : '操作失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// 批量充值（管理员权限）
router.post('/batch-recharge',
  authenticate,
  (req, res, next) => {
    // 检查是否是管理员或者是董事等级
    if (req.user && (req.user.role === 'ADMIN' || req.user.level === 'DIRECTOR')) {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '需要管理员权限或董事等级',
          timestamp: new Date().toISOString()
        }
      });
    }
  },
  [
    body('recharges')
      .isArray({ min: 1, max: 100 })
      .withMessage('充值列表必须是数组，最多100条'),
    body('recharges.*.userId')
      .notEmpty()
      .withMessage('用户ID不能为空')
      .isLength({ min: 25, max: 25 })
      .withMessage('无效的用户ID格式'),
    body('recharges.*.amount')
      .notEmpty()
      .withMessage('充值金额不能为空')
      .isFloat({ min: 1 })
      .withMessage('充值金额必须大于等于1')
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { recharges } = req.body;
    const operatorId = req.user!.id;

    try {
      const results = [];
      const errors = [];

      for (let i = 0; i < recharges.length; i++) {
        const { userId, amount, description } = recharges[i];

        try {
          const result = await pointsService.recharge(
            userId,
            parseFloat(amount),
            description || '批量充值'
          );
          results.push({
            index: i,
            userId,
            amount,
            success: true,
            transactionNo: result.transactionNo
          });
        } catch (error) {
          errors.push({
            index: i,
            userId,
            amount,
            error: error instanceof Error ? error.message : '充值失败'
          });
        }
      }

      logger.info('批量通券充值完成', {
        operatorId,
        totalCount: recharges.length,
        successCount: results.length,
        errorCount: errors.length,
        requestId: req.requestId
      });

      res.json(createSuccessResponse({
        summary: {
          total: recharges.length,
          success: results.length,
          failed: errors.length
        },
        results,
        errors
      }, '批量充值完成'));

    } catch (error) {
      logger.error('批量通券充值失败', {
        operatorId,
        error: error instanceof Error ? error.message : '未知错误',
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'BATCH_RECHARGE_FAILED',
          message: '批量充值失败',
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

export default router;