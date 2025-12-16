import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { createSuccessResponse } from '../../../shared/types/response';

const router = Router();

// 模拟订单数据存储
const orderStorage: Map<string, any[]> = new Map();

// 生成订单号
const generateOrderNo = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ZD${year}${month}${day}${random}`;
};

// 获取订单列表
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  const userOrders = orderStorage.get(userId) || [];

  res.json(createSuccessResponse({
    orders: userOrders,
    total: userOrders.length
  }, '获取订单列表成功'));
}));

// 获取订单详情
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  const userOrders = orderStorage.get(userId) || [];
  const order = userOrders.find((o: any) => o.id === id);

  if (!order) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      }
    });
  }

  res.json(createSuccessResponse(order, '获取订单详情成功'));
}));

// 创建订单
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  const {
    items,
    address,
    paymentMethod,
    pointsUsed = 0,
    remark = ''
  } = req.body;

  // 验证必填字段
  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: '商品信息不能为空'
      }
    });
  }

  if (!address) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: '收货地址不能为空'
      }
    });
  }

  if (!paymentMethod) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: '支付方式不能为空'
      }
    });
  }

  // 计算订单金额
  const totalPrice = items.reduce((sum: number, item: any) => {
    return sum + (item.price * item.quantity);
  }, 0);

  const shippingFee = totalPrice >= 99 ? 0 : 10;
  const discountAmount = pointsUsed; // 1积分=1元
  const finalPrice = totalPrice + shippingFee - discountAmount;

  // 创建订单
  const order = {
    id: generateOrderNo(),
    orderNo: generateOrderNo(),
    userId,
    items,
    address,
    paymentMethod,
    paymentStatus: 'PENDING',
    orderStatus: 'PENDING',
    totalPrice,
    shippingFee,
    discountAmount,
    finalPrice,
    pointsUsed,
    remark,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 保存订单
  const userOrders = orderStorage.get(userId) || [];
  userOrders.unshift(order); // 新订单放在最前面
  orderStorage.set(userId, userOrders);

  res.json(createSuccessResponse(order, '订单创建成功'));
}));

// 取消订单
router.post('/:id/cancel', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  const userOrders = orderStorage.get(userId) || [];
  const orderIndex = userOrders.findIndex((o: any) => o.id === id);

  if (orderIndex < 0) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      }
    });
  }

  // 检查订单状态
  const order = userOrders[orderIndex];
  if (order.orderStatus === 'CANCELLED') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ORDER_ALREADY_CANCELLED',
        message: '订单已取消'
      }
    });
  }

  if (order.orderStatus === 'COMPLETED') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ORDER_CANNOT_CANCEL',
        message: '已完成订单无法取消'
      }
    });
  }

  // 更新订单状态
  order.orderStatus = 'CANCELLED';
  userOrders[orderIndex] = order;
  orderStorage.set(userId, userOrders);

  res.json(createSuccessResponse(null, '订单取消成功'));
}));

// 确认收货
router.post('/:id/confirm', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.sub;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '用户未认证'
      }
    });
  }

  const userOrders = orderStorage.get(userId) || [];
  const orderIndex = userOrders.findIndex((o: any) => o.id === id);

  if (orderIndex < 0) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: '订单不存在'
      }
    });
  }

  const order = userOrders[orderIndex];
  if (order.orderStatus !== 'SHIPPED') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ORDER_CANNOT_CONFIRM',
        message: '当前订单状态无法确认收货'
      }
    });
  }

  // 更新订单状态
  order.orderStatus = 'COMPLETED';
  order.updatedAt = new Date().toISOString();
  userOrders[orderIndex] = order;
  orderStorage.set(userId, userOrders);

  res.json(createSuccessResponse(null, '确认收货成功'));
}));

export default router;