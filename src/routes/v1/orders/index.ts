import { Router, Request, Response } from 'express';
import { OrdersService } from '../../../modules/orders';
import * as expressValidator from 'express-validator';
const { body, query, param  } = expressValidator;
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { orderService } from '../../../shared/services/order';
import { OrderType, OrderStatus, PaymentMethod } from '../../../shared/types/order';

const ordersService = new OrdersService();
const router = Router();

// 创建订单
router.post('/',
  authenticate,
  [
    body('type')
      .isIn(['RETAIL', 'PURCHASE', 'TEAM', 'EXCHANGE'])
      .withMessage('订单类型无效'),
    body('buyerId')
      .isUUID()
      .withMessage('买方ID无效'),
    body('sellerId')
      .optional()
      .isUUID()
      .withMessage('卖方ID无效'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('订单项不能为空'),
    body('items.*.productsId')
      .isUUID()
      .withMessage('商品ID无效'),
    body('items.*.skuId')
      .isUUID()
      .withMessage('SKU ID无效'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('商品数量必须大于0'),
    body('paymentMethod')
      .optional()
      .isIn(['WECHAT', 'ALIPAY', 'POINTS', 'BALANCE', 'MIXED'])
      .withMessage('支付方式无效'),
    body('pointsAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('积分金额不能为负数'),
    body('shippingAddress')
      .optional()
      .isObject()
      .withMessage('收货地址格式无效'),
    body('buyerNotes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('买家备注不能超过500字符')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const {
        type,
        buyerId,
        sellerId,
        items,
        paymentMethod,
        pointsAmount,
        shippingAddress,
        buyerNotes,
        metadata
      } = req.body;

      // 确保用户只能为自己创建订单
      if (buyerId !== req.user?.id) {
        return res.status(403).json(createErrorResponse(
          ErrorCode.FORBIDDEN,
          '只能为自己创建订单'
        ));
      }

      const createParams = {
        type: type as OrderType,
        buyerId,
        sellerId,
        items,
        paymentMethod: paymentMethod as PaymentMethod,
        pointsAmount: pointsAmount ? parseFloat(pointsAmount) : undefined,
        shippingAddress,
        buyerNotes,
        metadata
      };

      const result = await orderService.createOrder(createParams);

      if (result.success) {
        res.status(201).json(createSuccessResponse(
          result.order,
          result.message
        ));
      } else {
        res.status(400).json(createErrorResponse(
          ErrorCode.BUSINESS_LOGIC_ERROR,
          result.message,
          result.error
        ));
      }
    } catch (error) {
      logger.error('创建订单失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body,
        userId: req.user?.id
      });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '创建订单失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 获取用户订单列表
router.get('/',
  authenticate,
  [
    query('type')
      .optional()
      .isIn(['RETAIL', 'PURCHASE', 'TEAM', 'EXCHANGE'])
      .withMessage('订单类型无效'),
    query('status')
      .optional()
      .isIn(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'])
      .withMessage('订单状态无效'),
    query('paymentStatus')
      .optional()
      .isIn(['UNPAID', 'PAID', 'REFUNDED'])
      .withMessage('支付状态无效'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须大于0'),
    query('perPage')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('sortBy')
      .optional()
      .isIn(['createdAt', 'updatedAt', 'totalAmount', 'status'])
      .withMessage('排序字段无效'),
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('排序方向无效'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式无效'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const queryParams = {
        type: req.query.type as OrderType,
        status: req.query.status as OrderStatus,
        paymentStatus: req.query.paymentStatus as any,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        perPage: req.query.perPage ? parseInt(req.query.perPage as string) : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      const result = await orderService.getUserOrders(req.user!.id, queryParams);

      res.json(createSuccessResponse(result, '获取订单列表成功'));
    } catch (error) {
      logger.error('获取订单列表失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id,
        query: req.query
      });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取订单列表失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 获取订单模块信息
router.get('/info',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      res.json(createSuccessResponse({
        message: '订单管理模块 - 真实数据库版本',
        version: '2.0.0',
        status: 'working',
        endpoints: {
          'POST /orders': '创建订单',
          'GET /orders': '获取用户订单列表',
          'GET /orders/:orderId': '获取订单详情',
          'PUT /orders/:orderId/confirm': '确认订单',
          'PUT /orders/:orderId/cancel': '取消订单',
          'GET /orders/statistics': '获取订单统计',
          'POST /orders/exchange': '创建换货申请',
          'GET /orders/exchange': '获取换货申请列表'
        },
        timestamp: new Date().toISOString()
      }, '订单模块API可访问'));
    } catch (error) {
      logger.error('获取订单模块信息失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取订单模块信息失败'
      ));
    }
  })
);

// 获取订单详情
router.get('/:orderId',
  authenticate,
  [
    param('orderId')
      .isUUID()
      .withMessage('订单ID无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      const order = await orderService.getOrderById(orderId);

      if (!order) {
        return res.status(404).json(createErrorResponse(
          ErrorCode.NOT_FOUND,
          '订单不存在'
        ));
      }

      // 检查权限：只有订单相关的买方或卖方可以查看
      if (order.buyerId !== req.user?.id && order.sellerId !== req.user?.id) {
        return res.status(403).json(createErrorResponse(
          ErrorCode.FORBIDDEN,
          '无权限查看此订单'
        ));
      }

      res.json(createSuccessResponse(order, '获取订单详情成功'));
    } catch (error) {
      logger.error('获取订单详情失败', {
        error: error instanceof Error ? error.message : '未知错误',
        orderId: req.params.orderId,
        userId: req.user?.id
      });
      res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '获取订单详情失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 确认订单
router.put('/:orderId/confirm',
  authenticate,
  [
    param('orderId')
      .isUUID()
      .withMessage('订单ID无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      const order = await orderService.confirmOrder(orderId, req.user!.id);

      res.json(createSuccessResponse(order, '订单确认成功'));
    } catch (error) {
      logger.error('确认订单失败', {
        error: error instanceof Error ? error.message : '未知错误',
        orderId: req.params.orderId,
        userId: req.user?.id
      });

      const message = error instanceof Error ? error.message : '确认订单失败';
      let statusCode = 500;

      if (message.includes('不存在')) {
        statusCode = 404;
      } else if (message.includes('权限') || message.includes('无权限')) {
        statusCode = 403;
      } else if (message.includes('状态不正确')) {
        statusCode = 400;
      }

      res.status(statusCode).json(createErrorResponse(
        'ORDER_CONFIRM_FAILED',
        '确认订单失败',
        message
      ));
    }
  })
);

// 取消订单
router.put('/:orderId/cancel',
  authenticate,
  [
    param('orderId')
      .isUUID()
      .withMessage('订单ID无效'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('取消原因不能超过200字符')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      const order = await orderService.cancelOrder(orderId, req.user!.id, reason);

      res.json(createSuccessResponse(order, '订单取消成功'));
    } catch (error) {
      logger.error('取消订单失败', {
        error: error instanceof Error ? error.message : '未知错误',
        orderId: req.params.orderId,
        userId: req.user?.id,
        reason: req.body.reason
      });

      const message = error instanceof Error ? error.message : '取消订单失败';
      let statusCode = 500;

      if (message.includes('不存在')) {
        statusCode = 404;
      } else if (message.includes('权限') || message.includes('无权限')) {
        statusCode = 403;
      } else if (message.includes('状态不正确')) {
        statusCode = 400;
      }

      res.status(statusCode).json(createErrorResponse(
        'ORDER_CANCEL_FAILED',
        '取消订单失败',
        message
      ));
    }
  })
);

// 获取订单统计
router.get('/statistics/overview',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const statistics = await orderService.getOrderStatistics(req.user!.id);

      res.json(createSuccessResponse(statistics, '获取订单统计成功'));
    } catch (error) {
      logger.error('获取订单统计失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取订单统计失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 创建换货申请
router.post('/exchange',
  authenticate,
  [
    body('originalOrderId')
      .isUUID()
      .withMessage('原订单ID无效'),
    body('targetUserId')
      .optional()
      .isUUID()
      .withMessage('目标用户ID无效'),
    body('outItems')
      .isArray({ min: 1 })
      .withMessage('换出商品不能为空'),
    body('outItems.*.productsId')
      .isUUID()
      .withMessage('换出商品ID无效'),
    body('outItems.*.skuId')
      .isUUID()
      .withMessage('换出SKU ID无效'),
    body('outItems.*.quantity')
      .isInt({ min: 1 })
      .withMessage('换出商品数量必须大于0'),
    body('inItems')
      .isArray({ min: 1 })
      .withMessage('换入商品不能为空'),
    body('inItems.*.productsId')
      .isUUID()
      .withMessage('换入商品ID无效'),
    body('inItems.*.skuId')
      .isUUID()
      .withMessage('换入SKU ID无效'),
    body('inItems.*.quantity')
      .isInt({ min: 1 })
      .withMessage('换入商品数量必须大于0'),
    body('reason')
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('换货原因长度必须在1-200字符之间'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('换货描述不能超过500字符')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const {
        originalOrderId,
        targetUserId,
        outItems,
        inItems,
        reason,
        description
      } = req.body;

      const createParams = {
        originalOrderId,
        targetUserId,
        outItems,
        inItems,
        reason,
        description
      };

      const result = await orderService.createExchangeRequest(createParams);

      if (result.success) {
        res.status(201).json(createSuccessResponse(
          result.exchange,
          result.message
        ));
      } else {
        res.status(400).json(createErrorResponse(
          'EXCHANGE_CREATION_FAILED',
          result.message,
          result.error
        ));
      }
    } catch (error) {
      logger.error('创建换货申请失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body,
        userId: req.user?.id
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '创建换货申请失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 兼容旧版本的统计接口
router.get('/statistics',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const statistics = await orderService.getOrderStatistics(req.user!.id);
      res.json(createSuccessResponse(statistics, '获取订单统计成功'));
    } catch (error) {
      logger.error('获取订单统计失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });
      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取订单统计失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

export default router;