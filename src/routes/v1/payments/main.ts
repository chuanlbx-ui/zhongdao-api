import { Router, Request, Response } from 'express';
import { body, query, param } from 'express-validator';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import {
  PaymentMethod,
  PaymentStatus,
  TransactionType,
  CreatePaymentParams,
  CreatePointsPaymentParams,
  CreateRechargeParams,
  CreateTransferParams,
  BatchTransferParams,
  PaymentQueryParams
} from '../../../shared/types/payment';
import { paymentService } from '../../../shared/services/payment';

const router = Router();

// 获取支付模块信息
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: '支付管理模块 API',
      version: '1.0.0',
      exchangeRate: paymentService.getExchangeRate(),
      endpoints: {
        payments: {
          'POST /payments/points/pay': '通券支付',
          'POST /payments/points/transfer': '通券转账',
          'POST /payments/batch/transfer': '批量通券转账',
          'GET /payments/:id': '查询支付状态',
          'GET /payments/statistics': '获取支付统计'
        },
        recharge: {
          'POST /recharge/wechat/create': '创建微信充值',
          'POST /recharge/wechat/callback': '微信支付回调',
          'GET /recharge/history': '充值历史',
          'POST /recharge/mock/wechat': '模拟微信充值'
        },
        info: {
          'GET /info/balance/:userId': '查询用户余额',
          'GET /info/permissions/:userId': '查询支付权限',
          'GET /info/exchange-rate': '查询汇率信息'
        }
      },
      timestamp: new Date().toISOString()
    }
  });
});

// 通券支付
router.post('/points/pay',
  validate([
    body('orderId').notEmpty().withMessage('订单ID不能为空'),
    body('userId').notEmpty().withMessage('用户ID不能为空'),
    body('amount').isInt({ min: 1 }).withMessage('支付金额必须大于0'),
    body('transactionType').isIn(Object.values(TransactionType)).withMessage('交易类型无效'),
    body('description').optional().isString().withMessage('描述必须是字符串'),
    body('metadata.toUserId').optional().isString().withMessage('收款方ID必须是字符串'),
    body('metadata').optional().isObject().withMessage('元数据必须是对象')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const params: CreatePointsPaymentParams = {
        orderId: req.body.orderId,
        userId: req.body.userId,
        amount: req.body.amount,
        method: PaymentMethod.POINTS,
        transactionType: req.body.transactionType,
        description: req.body.description,
        metadata: req.body.metadata || {}
      };

      logger.info('处理通券支付请求', { params });

      const result = await paymentService.processPointsPayment(params);

      if (result.success) {
        res.json({
          success: true,
          data: result,
          message: '支付处理成功'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          message: '支付处理失败',
          data: result
        });
      }
    } catch (error) {
      logger.error('通券支付处理异常', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '支付处理异常'
      });
    }
  })
);

// 通券转账
router.post('/points/transfer',
  validate([
    body('fromUserId').notEmpty().withMessage('转出用户ID不能为空'),
    body('toUserId').notEmpty().withMessage('转入用户ID不能为空'),
    body('points').isInt({ min: 1 }).withMessage('转账通券数必须大于0'),
    body('type').isIn(Object.values(TransactionType)).withMessage('交易类型无效'),
    body('description').optional().isString().withMessage('描述必须是字符串'),
    body('relatedOrderId').optional().isString().withMessage('相关订单ID必须是字符串')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const transferParams: CreateTransferParams = {
        fromUserId: req.body.fromUserId,
        toUserId: req.body.toUserId,
        points: req.body.points,
        type: req.body.type,
        description: req.body.description,
        relatedOrderId: req.body.relatedOrderId,
        metadata: req.body.metadata || {}
      };

      // 转换为支付参数格式
      const paymentParams: CreatePointsPaymentParams = {
        orderId: transferParams.relatedOrderId || `transfer_${Date.now()}`,
        userId: transferParams.fromUserId,
        amount: transferParams.points,
        method: PaymentMethod.POINTS,
        transactionType: transferParams.type,
        description: transferParams.description,
        metadata: {
          toUserId: transferParams.toUserId,
          ...transferParams.metadata
        }
      };

      logger.info('处理通券转账请求', { transferParams });

      const result = await paymentService.processPointsPayment(paymentParams);

      if (result.success) {
        res.json({
          success: true,
          data: {
            ...result,
            transferDetails: {
              fromUserId: transferParams.fromUserId,
              toUserId: transferParams.toUserId,
              points: transferParams.points,
              type: transferParams.type
            }
          },
          message: '转账成功'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.message,
          message: '转账失败',
          data: result
        });
      }
    } catch (error) {
      logger.error('通券转账处理异常', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '转账处理异常'
      });
    }
  })
);

// 批量通券转账
router.post('/batch/transfer',
  validate([
    body('fromUserId').notEmpty().withMessage('转出用户ID不能为空'),
    body('totalPoints').isInt({ min: 1 }).withMessage('总转账通券数必须大于0'),
    body('transfers').isArray({ min: 1 }).withMessage('转账列表不能为空'),
    body('transfers.*.toUserId').notEmpty().withMessage('转入用户ID不能为空'),
    body('transfers.*.points').isInt({ min: 1 }).withMessage('转账通券数必须大于0'),
    body('transfers.*.type').isIn(Object.values(TransactionType)).withMessage('交易类型无效'),
    body('batchDescription').optional().isString().withMessage('批量描述必须是字符串')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const batchParams: BatchTransferParams = {
        fromUserId: req.body.fromUserId,
        transfers: req.body.transfers,
        totalPoints: req.body.totalPoints,
        batchDescription: req.body.batchDescription
      };

      logger.info('处理批量转账请求', { batchParams });

      const result = await paymentService.batchTransfer(batchParams);

      res.json({
        success: true,
        data: result,
        message: '批量转账处理完成'
      });
    } catch (error) {
      logger.error('批量转账处理异常', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '批量转账处理异常'
      });
    }
  })
);

// 查询支付状态
router.get('/:paymentId',
  validate([
    param('paymentId').notEmpty().withMessage('支付ID不能为空')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const paymentId = req.params.paymentId;

      logger.info('查询支付状态', { paymentId });

      const payment = await paymentService.getPaymentStatus(paymentId);

      if (payment) {
        res.json({
          success: true,
          data: payment,
          message: '查询成功'
        });
      } else {
        res.status(404).json({
          success: false,
          error: '支付记录不存在',
          message: '查询失败'
        });
      }
    } catch (error) {
      logger.error('查询支付状态异常', {
        params: req.params,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '查询异常'
      });
    }
  })
);

// 获取支付统计
router.get('/statistics',
  validate([
    query('userId').optional().isString().withMessage('用户ID必须是字符串'),
    query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
    query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      logger.info('获取支付统计', { userId, startDate, endDate });

      const statistics = await paymentService.getPaymentStatistics(userId, startDate, endDate);

      res.json({
        success: true,
        data: statistics,
        message: '获取统计成功'
      });
    } catch (error) {
      logger.error('获取支付统计异常', {
        query: req.query,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '获取统计异常'
      });
    }
  })
);

export default router;