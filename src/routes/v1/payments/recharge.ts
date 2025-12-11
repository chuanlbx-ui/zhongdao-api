import { Router, Request, Response } from 'express';
import { body, query } from 'express-validator';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import { CreateRechargeParams } from '../../../shared/types/payment';
import { paymentService } from '../../../shared/services/payment';

const router = Router();

// 创建微信充值
router.post('/wechat/create',
  validate([
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('amount').isFloat({ min: 0.01 }).withMessage('充值金额必须大于0'),
    body('description').optional().isString().withMessage('描述必须是字符串')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const params: CreateRechargeParams = {
        userId: req.body.userId,
        amount: Math.round(req.body.amount * 100) / 100, // 保留2位小数
        description: req.body.description,
        metadata: req.body.metadata || {}
      };

      logger.info('处理微信充值请求', { params });

      const result = await paymentService.processWechatRecharge(params);

      if (result.success) {
        res.json({
          success: true,
          data: {
            ...result,
            rechargeInfo: {
              amount: params.amount,
              pointsAwarded: params.amount, // 1元=1通券
              exchangeRate: 1
            }
          },
          message: '充值创建成功'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          message: '充值创建失败',
          data: result
        });
      }
    } catch (error) {
      logger.error('微信充值处理异常', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '充值处理异常'
      });
    }
  })
);

// 微信支付回调（模拟）
router.post('/wechat/callback',
  validate([
    body('transactionId').notEmpty().withMessage('交易ID不能为空'),
    body('orderId').notEmpty().withMessage('订单ID不能为空'),
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('amount').isFloat({ min: 0.01 }).withMessage('金额必须大于0'),
    body('status').isIn(['SUCCESS', 'FAILED']).withMessage('状态无效'),
    body('signature').optional().isString().withMessage('签名必须是字符串')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const callbackData = {
        transactionId: req.body.transactionId,
        orderId: req.body.orderId,
        userId: req.body.userId,
        amount: req.body.amount,
        status: req.body.status === 'SUCCESS' ? 'SUCCESS' as const : 'FAILED' as const,
        method: 'WECHAT' as const,
        timestamp: new Date(),
        signature: req.body.signature,
        metadata: req.body.metadata || {}
      };

      logger.info('处理微信支付回调', { callbackData });

      // 验证签名（实际项目中需要验证微信签名）
      // const isValidSignature = await verifyWechatSignature(callbackData);
      const isValidSignature = true; // 模拟验证通过

      if (!isValidSignature) {
        return res.status(400).json({
          success: false,
          error: '签名验证失败',
          message: '回调处理失败'
        });
      }

      // 根据回调状态处理充值
      if (callbackData.status === 'SUCCESS') {
        // 支付成功，更新充值状态
        // 这里应该调用充值完成逻辑

        res.json({
          success: true,
          message: '回调处理成功'
        });
      } else {
        // 支付失败，更新充值状态
        // 这里应该调用充值失败逻辑

        res.json({
          success: true,
          message: '回调处理成功'
        });
      }
    } catch (error) {
      logger.error('微信支付回调处理异常', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '回调处理异常'
      });
    }
  })
);

// 模拟微信充值（测试用）
router.post('/mock/wechat',
  validate([
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('amount').isFloat({ min: 0.01 }).withMessage('充值金额必须大于0'),
    body('shouldFail').optional().isBoolean().withMessage('是否失败必须是布尔值')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId;
      const amount = Math.round(req.body.amount * 100) / 100;
      const shouldFail = req.body.shouldFail || false;

      logger.info('处理模拟微信充值', { userId, amount, shouldFail });

      if (shouldFail) {
        // 模拟支付失败
        res.status(400).json({
          success: false,
          error: '模拟支付失败',
          message: '微信支付失败'
        });
        return;
      }

      // 模拟支付成功流程
      const params: CreateRechargeParams = {
        userId,
        amount,
        description: '模拟微信充值',
        metadata: {
          mockPayment: true,
          simulatedSuccess: true
        }
      };

      const result = await paymentService.processWechatRecharge(params);

      if (result.success) {
        res.json({
          success: true,
          data: {
            ...result,
            mockInfo: {
              isSimulated: true,
              simulatedWechatOrderNo: `MOCK_${Date.now()}`,
              testMode: true
            }
          },
          message: '模拟充值成功'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          message: '模拟充值失败'
        });
      }
    } catch (error) {
      logger.error('模拟微信充值异常', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '模拟充值异常'
      });
    }
  })
);

// 获取充值历史
router.get('/history',
  validate([
    query('userId').optional().isString().withMessage('用户ID必须是字符串'),
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
    query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const page = parseInt(req.query.perPage as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 20;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      logger.info('获取充值历史', { userId, page, perPage, startDate, endDate });

      // 这里应该从数据库查询充值历史
      // 暂时返回模拟数据
      const mockHistory = {
        records: [],
        pagination: {
          page,
          perPage,
          total: 0,
          totalPages: 0
        },
        summary: {
          totalRecharges: 0,
          totalAmount: 0,
          totalPointsAwarded: 0,
          successCount: 0,
          failedCount: 0
        }
      };

      res.json({
        success: true,
        data: mockHistory,
        message: '获取充值历史成功'
      });
    } catch (error) {
      logger.error('获取充值历史异常', {
        query: req.query,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '获取充值历史异常'
      });
    }
  })
);

export default router;