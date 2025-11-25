import { Router, Request, Response } from 'express';
import { body, query, param } from 'express-validator';
import { authenticate, requireMinLevel } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { orderService } from '../../../shared/services/order';

const router = Router();

// 获取订单模块信息
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      message: '订单管理模块 API v2.0 - 基于成功模式',
      version: '2.0.0',
      status: 'working',
      timestamp: new Date().toISOString(),
      endpoints: {
        create: {
          'POST /orders/create': '创建订单',
          description: '创建零售订单、采购订单或换货申请'
        },
        list: {
          'GET /orders/list': '获取订单列表',
          description: '分页获取用户订单列表'
        },
        detail: {
          'GET /orders/:id': '获取订单详情',
          description: '获取指定订单的详细信息'
        },
        statistics: {
          'GET /orders/statistics': '获取订单统计',
          description: '获取用户订单统计数据'
        },
        operations: {
          'POST /orders/:id/confirm': '确认订单',
          'POST /orders/:id/cancel': '取消订单',
          'POST /orders/:id/ship': '发货',
          'POST /orders/:id/complete': '完成订单'
        }
      }
    },
    message: '订单模块API可访问'
  });
});

// 创建订单
router.post('/create',
  authenticate,
  [
    body('type').isIn(['RETAIL', 'PURCHASE', 'EXCHANGE']).withMessage('订单类型无效'),
    body('items').isArray({ min: 1 }).withMessage('订单项不能为空'),
    body('buyerId').isUUID().withMessage('买方ID无效'),
    body('totalAmount').isNumeric().withMessage('订单金额无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { type, items, buyerId, sellerId, totalAmount, paymentMethod, pointsAmount, shippingAddress, buyerNotes } = req.body;

      const createParams = {
        type,
        items: items.map((item: any) => ({
          productId: item.productId,
          skuId: item.skuId,
          quantity: item.quantity
        })),
        buyerId,
        sellerId,
        totalAmount,
        paymentMethod,
        pointsAmount,
        shippingAddress,
        buyerNotes
      };

      const result = await orderService.createOrder(createParams);

      if (result.success) {
        res.json(createSuccessResponse(result.order, '订单创建成功'));
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('创建订单失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        message: '创建订单失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

// 获取订单列表
router.get('/list',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    query('type').optional().isIn(['RETAIL', 'PURCHASE', 'EXCHANGE']).withMessage('订单类型无效'),
    query('status').optional().withMessage('订单状态无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const { page, perPage, type, status, paymentStatus, startDate, endDate, sortBy, sortOrder } = req.query;

      const params: any = {
        page: page ? parseInt(page as string) : 1,
        perPage: perPage ? parseInt(perPage as string) : 20
      };

      if (type) params.type = type;
      if (status) params.status = status;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      if (startDate) params.startDate = new Date(startDate as string);
      if (endDate) params.endDate = new Date(endDate as string);
      if (sortBy) params.sortBy = sortBy;
      if (sortOrder) params.sortOrder = sortOrder;

      const result = await orderService.getUserOrders(userId, params);

      res.json(createSuccessResponse(result, '获取订单列表成功'));
    } catch (error) {
      logger.error('获取订单列表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        query: req.query,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        message: '获取订单列表失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

// 获取订单详情
router.get('/:id',
  authenticate,
  [param('id').isUUID().withMessage('订单ID无效')],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const order = await orderService.getOrderById(id);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: '订单不存在'
        });
      }

      // 检查权限（买家或卖家才能查看）
      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({
          success: false,
          message: '无权查看此订单'
        });
      }

      res.json(createSuccessResponse(order, '获取订单详情成功'));
    } catch (error) {
      logger.error('获取订单详情失败', {
        error: error instanceof Error ? error.message : '未知错误',
        params: req.params,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        message: '获取订单详情失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

// 获取订单统计
router.get('/statistics',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const statistics = await orderService.getOrderStatistics(userId);

    res.json(createSuccessResponse(statistics, '获取订单统计成功'));
  } catch (error) {
    logger.error('获取订单统计失败', {
      error: error instanceof Error ? error.message : '未知错误',
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      message: '获取订单统计失败',
      error: error instanceof Error ? error.message : '服务器内部错误'
    });
    }
  })
);

// 确认订单
router.post('/:id/confirm',
  authenticate,
  [param('id').isUUID().withMessage('订单ID无效')],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 首先检查订单是否存在且用户有权限
    const order = await orderService.getOrderById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    if (order.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        message: '只有买家可以确认订单'
      });
    }

    const result = await orderService.confirmOrder(id, userId);

    if (result) {
      res.json(createSuccessResponse(result, '订单确认成功'));
    } else {
      res.status(400).json({
        success: false,
        message: '订单确认失败'
      });
    }
  } catch (error) {
      logger.error('确认订单失败', {
        error: error instanceof Error ? error.message : '未知错误',
        params: req.params,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        message: '确认订单失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

// 取消订单
router.post('/:id/cancel',
  authenticate,
  [param('id').isUUID().withMessage('订单ID无效')],
  [body('reason').optional().isString().withMessage('取消原因必须是字符串')],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user!.id;

    // 先检查订单是否存在且用户有权限
    const order = await orderService.getOrderById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '订单不存在'
      });
    }

    if (order.buyerId !== userId) {
      return res.status(403).json({
        success: false,
        message: '只有买家可以取消订单'
      });
    }

    const result = await orderService.cancelOrder(id, userId, reason);

    if (result) {
      res.json(createSuccessResponse(result, '订单取消成功'));
    } else {
      res.status(400).json({
        success: false,
        message: '订单取消失败'
      });
    }
  } catch (error) {
    logger.error('取消订单失败', {
      error: error instanceof Error ? error.message : '未知错误',
      params: req.params,
      body: req.body,
      requestId: req.requestId
    });

    res.status(500).json({
      success: false,
      message: '取消订单失败',
      error: error instanceof Error ? error.message : '服务器内部错误'
    });
    }
  })
);

// 创建换货申请
router.post('/exchange/create',
  authenticate,
  [
    body('originalOrderId').isUUID().withMessage('原订单ID无效'),
    body('outItems').isArray({ min: 1 }).withMessage('换出商品不能为空'),
    body('inItems').isArray({ min: 1 }).withMessage('换入商品不能为空'),
    body('targetUserId').optional().isUUID().withMessage('目标用户ID无效'),
    body('reason').optional().isString().withMessage('换货原因必须是字符串')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const createParams = {
        originalOrderId: req.body.originalOrderId,
        outItems: req.body.outItems,
        inItems: req.body.inItems,
        targetUserId: req.body.targetUserId || req.user!.id,
        reason: req.body.reason || '',
        description: req.body.description || ''
      };

      const result = await orderService.createExchangeRequest(createParams);

      if (result.success) {
        res.json(createSuccessResponse(result.exchange, '换货申请创建成功'));
      } else {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
      }
    } catch (error) {
      logger.error('创建换货申请失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body,
        requestId: req.requestId
      });

      res.status(500).json({
        success: false,
        message: '创建换货申请失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

export default router;