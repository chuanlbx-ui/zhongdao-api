/**
 * 支付相关API路由
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '@/shared/utils/logger';
import {
  paymentService,
  paymentCallbackHandler,
  PaymentCreateRequest,
  RefundCreateRequest,
  PaymentQueryRequest,
  ReconciliationRequest
} from '@/modules/payment';
import { PaymentChannel } from '@prisma/client';
import { authenticate } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';
import {
  createPaymentSchema,
  createRefundSchema,
  queryPaymentSchema,
  reconciliationSchema
} from './validation';

const router = Router();

// 错误处理中间件
const handlePaymentError = (error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('支付API错误', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    user: req.user?.id
  });

  if (error.name === 'PaymentError') {
    return res.status(400).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details
    });
  }

  // 数据库错误
  if (error.code && error.code.startsWith('P')) {
    return res.status(500).json({
      success: false,
      message: '数据库操作失败',
      code: 'DATABASE_ERROR'
    });
  }

  // 默认错误处理
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? error.message : '服务器内部错误',
    code: 'INTERNAL_ERROR'
  });
};

/**
 * @route POST /api/v1/payments/create
 * @desc 创建支付订单
 * @access Public
 */
router.post('/create',
  validateRequest(createPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createRequest: PaymentCreateRequest = {
        ...req.body,
        clientIp: req.ip,
        userAgent: req.headers['user-agent']
      };

      const result = await paymentService.createPaymentOrder(createRequest);

      res.json({
        success: true,
        data: result,
        message: result.message || (result.success ? '支付订单创建成功' : '支付订单创建失败')
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/payments/query
 * @desc 查询支付状态
 * @access Private
 */
router.get('/query',
  authenticate,
  validateRequest(queryPaymentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryRequest: PaymentQueryRequest = {
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        perPage: req.query.perPage ? parseInt(req.query.perPage as string) : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      // 普通用户只能查询自己的支付记录
      if (req.user.role !== 'admin') {
        queryRequest.userId = req.user.id;
      }

      const result = await paymentService.getPaymentList(queryRequest);

      res.json({
        success: true,
        data: result.data,
        message: '查询成功'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/payments/:paymentId
 * @desc 查询单个支付详情
 * @access Private
 */
router.get('/:paymentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentId } = req.params;

    const result = await paymentService.queryPaymentStatus(paymentId);

    // 检查权限（普通用户只能查询自己的支付记录）
    if (req.user.role !== 'admin' && result.payment.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权访问该支付记录',
        code: 'PERMISSION_DENIED'
      });
    }

    res.json({
      success: true,
      data: result.payment,
      message: '查询成功'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/payments/refund
 * @desc 创建退款申请
 * @access Private
 */
router.post('/refund',
  authenticate,
  validateRequest(createRefundSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refundRequest: RefundCreateRequest = {
        ...req.body,
        applyUserId: req.user.id
      };

      const result = await paymentService.createRefundOrder(refundRequest);

      res.json({
        success: result.success,
        data: result,
        message: result.message || (result.success ? '退款申请成功' : '退款申请失败')
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/payments/reconcile
 * @desc 执行对账
 * @access Private (Admin only)
 */
router.post('/reconcile',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限',
        code: 'PERMISSION_DENIED'
      });
    }
    next();
  },
  validateRequest(reconciliationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reconcileRequest: ReconciliationRequest = {
        ...req.body,
        reconcileDate: new Date(req.body.reconcileDate)
      };

      const result = await paymentService.reconcilePayments(
        reconcileRequest.reconcileDate,
        reconcileRequest.channel
      );

      res.json({
        success: true,
        data: result,
        message: '对账完成'
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/payments/statistics
 * @desc 获取支付统计
 * @access Private (Admin only)
 */
router.get('/statistics',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '需要管理员权限',
        code: 'PERMISSION_DENIED'
      });
    }
    next();
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate,
        endDate,
        channel,
        method,
        status,
        groupBy = 'day'
      } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: '开始时间和结束时间不能为空',
          code: 'INVALID_REQUEST'
        });
      }

      // 这里应该调用统计服务，暂时返回模拟数据
      const result = {
        summary: {
          totalCount: 0,
          totalAmount: 0,
          successCount: 0,
          successAmount: 0,
          failedCount: 0,
          failedAmount: 0,
          successRate: 0,
          averageAmount: 0
        },
        groupByData: [],
        trends: []
      };

      res.json({
        success: true,
        data: result,
        message: '统计查询成功'
      });

    } catch (error) {
      next(error);
    }
  }
);

// ===== 微信支付回调 =====
/**
 * @route POST /api/v1/payments/wechat/notify
 * @desc 微信支付回调通知
 * @access Public
 */
router.post('/wechat/notify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 这里需要确保rawBody可用，可能需要特定的中间件
      const result = await paymentCallbackHandler.handleWechatCallback({
        ...req,
        rawBody: (req as any).rawBody || req.body
      });
      return result;

    } catch (error) {
      logger.error('微信支付回调处理失败', {
        error: error.message,
        body: req.body
      });

      // 即使出错也要返回微信要求的格式
      const errorResponse = await paymentCallbackHandler.getWechatCallbackResponse(false);
      res.status(400);
      return errorResponse;
    }
  }
);

/**
 * @route POST /api/v1/payments/wechat/refund/notify
 * @desc 微信退款回调通知
 * @access Public
 */
router.post('/wechat/refund/notify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentCallbackHandler.handleRefundCallback(
        {
          ...req,
          rawBody: (req as any).rawBody || req.body
        },
        PaymentChannel.WECHAT
      );
      return result;

    } catch (error) {
      logger.error('微信退款回调处理失败', {
        error: error.message,
        body: req.body
      });

      const errorResponse = await paymentCallbackHandler.getWechatCallbackResponse(false);
      res.status(400);
      return errorResponse;
    }
  }
);

// ===== 支付宝回调 =====
/**
 * @route POST /api/v1/payments/alipay/notify
 * @desc 支付宝回调通知
 * @access Public
 */
router.post('/alipay/notify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentCallbackHandler.handleAlipayCallback({
        ...req,
        rawBody: (req as any).rawBody || req.body
      });
      return result;

    } catch (error) {
      logger.error('支付宝回调处理失败', {
        error: error.message,
        body: req.body
      });

      const errorResponse = await paymentCallbackHandler.getAlipayCallbackResponse(false);
      res.status(400);
      return errorResponse;
    }
  }
);

/**
 * @route POST /api/v1/payments/alipay/refund/notify
 * @desc 支付宝退款回调通知
 * @access Public
 */
router.post('/alipay/refund/notify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentCallbackHandler.handleRefundCallback(
        {
          ...req,
          rawBody: (req as any).rawBody || req.body
        },
        PaymentChannel.ALIPAY
      );
      return result;

    } catch (error) {
      logger.error('支付宝退款回调处理失败', {
        error: error.message,
        body: req.body
      });

      const errorResponse = await paymentCallbackHandler.getAlipayCallbackResponse(false);
      res.status(400);
      return errorResponse;
    }
  }
);

// 健康检查
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '支付服务运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 注册错误处理中间件
router.use(handlePaymentError);

export default router;