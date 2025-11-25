import { Router, Request, Response } from 'express';
import { query, param, body } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { commissionService } from '../../../shared/services/commission';
import { UserLevelService } from '../../../modules/user/level.service';

const router = Router();
const levelService = new UserLevelService();

// 获取佣金模块信息
router.get('/info',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      res.json(createSuccessResponse({
        message: '佣金管理模块 - 完整版',
        version: '2.0.0',
        status: 'working',
        features: [
          '订单佣金自动计算',
          '多级推荐佣金分配',
          '团队管理奖金',
          '等级升级奖励',
          '业绩额外奖励',
          '佣金结算和支付',
          '用户等级自动晋升'
        ],
        commissionStructure: {
          personalSales: 15, // 个人销售15%
          directReferral: 10, // 直推10%
          indirectReferral: [5, 3, 2, 1], // 1-4级间接推荐
          teamBonus: {
            'VIP': 1,
            'STAR_1': 2,
            'STAR_2': 3,
            'STAR_3': 5,
            'STAR_4': 7,
            'STAR_5': 10,
            'DIRECTOR': 15
          },
          levelBonus: {
            'VIP': 100,
            'STAR_1': 300,
            'STAR_2': 600,
            'STAR_3': 1200,
            'STAR_4': 2000,
            'STAR_5': 3500,
            'DIRECTOR': 5000
          }
        },
        timestamp: new Date().toISOString()
      }, '佣金模块API可访问'));
    } catch (error) {
      logger.error('获取佣金模块信息失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取佣金模块信息失败'
      ));
    }
  })
);

// 获取用户佣金统计
router.get('/statistics',
  authenticate,
  [
    query('period')
      .optional()
      .isString()
      .withMessage('统计周期格式无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { period } = req.query;

      const stats = await commissionService.getCommissionStats(
        userId,
        period as string
      );

      res.json(createSuccessResponse(stats, '获取佣金统计成功'));
    } catch (error) {
      logger.error('获取佣金统计失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取佣金统计失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 获取佣金记录列表
router.get('/records',
  authenticate,
  [
    query('userId')
      .optional()
      .isUUID()
      .withMessage('用户ID无效'),
    query('period')
      .optional()
      .isString()
      .withMessage('统计周期格式无效'),
    query('status')
      .optional()
      .isIn(['PENDING', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED'])
      .withMessage('佣金状态无效'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须大于0'),
    query('perPage')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const {
        userId,
        period,
        status,
        startDate,
        endDate,
        page = 1,
        perPage = 20
      } = req.query;

      // 非管理员只能查看自己的记录
      const queryUserId = req.user?.role === 'ADMIN' ? userId as string : req.user!.id;

      const queryParams = {
        userId: queryUserId,
        period: period as string,
        status: status as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: parseInt(page as string),
        perPage: parseInt(perPage as string)
      };

      const result = await commissionService.getCommissionRecords(queryParams);

      res.json(createSuccessResponse(result, '获取佣金记录成功'));
    } catch (error) {
      logger.error('获取佣金记录失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id,
        query: req.query
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取佣金记录失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 获取团队业绩统计
router.get('/team-performance',
  authenticate,
  [
    query('period')
      .optional()
      .isString()
      .withMessage('统计周期格式无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { period } = req.query;

      // 获取用户团队信息
      const { TeamService } = await require('../../../modules/user/team.service');
      const teamService = new TeamService();
      const teamStats = await teamService.getTeamStats(userId);

      // 获取用户当前等级
      const currentLevel = await levelService.getUserLevel(userId);

      res.json(createSuccessResponse({
        period: period || 'current',
        userId,
        currentLevel,
        teamStats,
        timestamp: new Date().toISOString()
      }, '获取团队业绩统计成功'));
    } catch (error) {
      logger.error('获取团队业绩统计失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取团队业绩统计失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 检查升级条件
router.get('/upgrade-check',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const upgradeCheck = await levelService.checkUpgradeConditions(userId);

      res.json(createSuccessResponse(upgradeCheck, '获取升级条件检查成功'));
    } catch (error) {
      logger.error('检查升级条件失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '检查升级条件失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 手动升级用户（管理员）
router.post('/upgrade/:userId',
  authenticate,
  [
    param('userId').isUUID().withMessage('用户ID无效'),
    body('targetLevel')
      .isIn(['VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR'])
      .withMessage('目标等级无效'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('升级原因不能超过200字符')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // 检查管理员权限
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(createErrorResponse(
          'FORBIDDEN',
          '无权限执行此操作'
        ));
      }

      const { userId } = req.params;
      const { targetLevel, reason } = req.body;

      const currentLevel = await levelService.getUserLevel(userId);
      const result = await levelService.upgradeUser(userId, targetLevel as any);

      // 处理升级奖励
      const upgradeReward = await commissionService.processUpgradeReward(
        userId,
        targetLevel as any,
        currentLevel
      );

      logger.info('管理员手动升级用户', {
        adminId: req.user!.id,
        targetUserId: userId,
        fromLevel: currentLevel,
        toLevel: targetLevel,
        reason
      });

      res.json(createSuccessResponse({
        userId,
        fromLevel: currentLevel,
        toLevel: targetLevel,
        upgradeReward,
        reason,
        operatedBy: req.user!.id
      }, '用户升级成功'));
    } catch (error) {
      logger.error('管理员升级用户失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id,
        params: req.params,
        body: req.body
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '升级用户失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 结算佣金（管理员）
router.post('/settle',
  authenticate,
  [
    body('calculationIds')
      .isArray({ min: 1 })
      .withMessage('佣金计算ID列表不能为空'),
    body('calculationIds.*')
      .isUUID()
      .withMessage('佣金计算ID格式无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // 检查管理员权限
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(createErrorResponse(
          'FORBIDDEN',
          '无权限执行此操作'
        ));
      }

      const { calculationIds } = req.body;

      await commissionService.settleCommission(calculationIds);

      logger.info('管理员结算佣金', {
        adminId: req.user!.id,
        calculationIds,
        count: calculationIds.length
      });

      res.json(createSuccessResponse({
        settledCount: calculationIds.length,
        calculationIds
      }, '佣金结算成功'));
    } catch (error) {
      logger.error('管理员结算佣金失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id,
        body: req.body
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '结算佣金失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 支付佣金（管理员）
router.post('/pay',
  authenticate,
  [
    body('calculationIds')
      .isArray({ min: 1 })
      .withMessage('佣金计算ID列表不能为空'),
    body('calculationIds.*')
      .isUUID()
      .withMessage('佣金计算ID格式无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // 检查管理员权限
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(createErrorResponse(
          'FORBIDDEN',
          '无权限执行此操作'
        ));
      }

      const { calculationIds } = req.body;

      await commissionService.payCommission(calculationIds);

      logger.info('管理员支付佣金', {
        adminId: req.user!.id,
        calculationIds,
        count: calculationIds.length
      });

      res.json(createSuccessResponse({
        paidCount: calculationIds.length,
        calculationIds
      }, '佣金支付成功'));
    } catch (error) {
      logger.error('管理员支付佣金失败', {
        error: error instanceof Error ? error.message : '未知错误',
        adminId: req.user?.id,
        body: req.body
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '支付佣金失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

export default router;