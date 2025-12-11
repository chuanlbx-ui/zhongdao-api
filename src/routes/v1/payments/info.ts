import { Router, Request, Response } from 'express';
import { param, query } from 'express-validator';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { logger } from '../../../shared/utils/logger';
import { paymentService } from '../../../shared/services/payment';

const router = Router();

// 查询用户余额
router.get('/balance/:userId',
  validate([
    param('userId').notEmpty().withMessage('用户ID不能为空')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;

      logger.info('查询用户余额', { userId });

      const balance = await paymentService.getUserBalance(userId);

      res.json({
        success: true,
        data: balance,
        message: '查询余额成功'
      });
    } catch (error) {
      logger.error('查询用户余额异常', {
        params: req.params,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '查询余额异常'
      });
    }
  })
);

// 查询支付权限
router.get('/permissions/:userId',
  validate([
    param('userId').notEmpty().withMessage('用户ID不能为空')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;

      logger.info('查询支付权限', { userId });

      const permissions = await paymentService.validatePaymentPermissions(userId);

      res.json({
        success: true,
        data: permissions,
        message: '查询权限成功'
      });
    } catch (error) {
      logger.error('查询支付权限异常', {
        params: req.params,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '查询权限异常'
      });
    }
  })
);

// 查询汇率信息
router.get('/exchange-rate',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('查询汇率信息');

      const exchangeRate = paymentService.getExchangeRate();

      res.json({
        success: true,
        data: exchangeRate,
        message: '查询汇率成功'
      });
    } catch (error) {
      logger.error('查询汇率信息异常', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '查询汇率异常'
      });
    }
  })
);

// 验证支付参数
router.post('/validate',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const paymentParams = {
        orderId: req.body.orderId,
        userId: req.body.userId,
        amount: req.body.amount,
        method: req.body.method,
        description: req.body.description,
        metadata: req.body.metadata || {}
      };

      logger.info('验证支付参数', { paymentParams });

      const validation = await paymentService.validatePayment(paymentParams);

      res.json({
        success: true,
        data: validation,
        message: validation.canProceed ? '验证通过' : '验证失败'
      });
    } catch (error) {
      logger.error('验证支付参数异常', {
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '参数验证异常'
      });
    }
  })
);

// 获取支付方式列表
router.get('/methods',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('获取支付方式列表');

      // 支持的支付方式
      const paymentMethods = [
        {
          method: 'POINTS',
          name: '通券支付',
          description: '使用平台通券进行支付',
          icon: 'points',
          enabled: true,
          fee: 0,
          minAmount: 1,
          maxAmount: null // 无限制
        },
        {
          method: 'WECHAT',
          name: '微信支付',
          description: '通过微信进行充值（仅限五星店长和董事）',
          icon: 'wechat',
          enabled: true,
          fee: 0,
          minAmount: 0.01,
          maxAmount: null // 无限制
        }
      ];

      res.json({
        success: true,
        data: paymentMethods,
        message: '获取支付方式成功'
      });
    } catch (error) {
      logger.error('获取支付方式异常', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '获取支付方式异常'
      });
    }
  })
);

// 获取交易类型列表
router.get('/transaction-types',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('获取交易类型列表');

      const transactionTypes = [
        {
          type: 'PAYMENT',
          name: '支付',
          description: '商品订单支付',
          icon: 'payment'
        },
        {
          type: 'RECHARGE',
          name: '充值',
          description: '微信充值通券',
          icon: 'recharge'
        },
        {
          type: 'TRANSFER',
          name: '转账',
          description: '用户间通券转账',
          icon: 'transfer'
        },
        {
          type: 'PURCHASE',
          name: '采购',
          description: '云仓商品采购',
          icon: 'purchase'
        },
        {
          type: 'REFUND',
          name: '退款',
          description: '订单退款',
          icon: 'refund'
        }
      ];

      res.json({
        success: true,
        data: transactionTypes,
        message: '获取交易类型成功'
      });
    } catch (error) {
      logger.error('获取交易类型异常', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '获取交易类型异常'
      });
    }
  })
);

// 获取支付状态列表
router.get('/payment-statuses',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('获取支付状态列表');

      const paymentStatuses = [
        {
          status: 'PENDING',
          name: '待支付',
          description: '等待支付',
          color: '#F59E0B'
        },
        {
          status: 'PROCESSING',
          name: '支付中',
          description: '正在处理支付',
          color: '#3B82F6'
        },
        {
          status: 'SUCCESS',
          name: '支付成功',
          description: '支付已完成',
          color: '#10B981'
        },
        {
          status: 'FAILED',
          name: '支付失败',
          description: '支付失败',
          color: '#EF4444'
        },
        {
          status: 'CANCELLED',
          name: '已取消',
          description: '用户取消支付',
          color: '#6B7280'
        },
        {
          status: 'REFUNDED',
          name: '已退款',
          description: '已退款处理',
          color: '#8B5CF6'
        }
      ];

      res.json({
        success: true,
        data: paymentStatuses,
        message: '获取支付状态成功'
      });
    } catch (error) {
      logger.error('获取支付状态异常', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
        message: '获取支付状态异常'
      });
    }
  })
);

export default router;