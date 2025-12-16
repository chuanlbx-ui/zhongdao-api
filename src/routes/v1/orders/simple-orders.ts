import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler } from '../../../shared/middleware/error';
import { createSuccessResponse } from '../../../shared/types/response';

const router = Router();

// 模拟订单数据存储
const orderStorage: Map<string, any[]> = new Map();

// 模拟用户积分数据
const userPointsStorage: Map<string, number> = new Map();
// 注释掉硬编码的积分数据，改为从数据库获取
// userPointsStorage.set('sdjslkdjflksdfjlsdf', 500); // 设置测试用户积分为500

// 生成订单号
const generateOrderNo = () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ZD${year}${month}${day}${random}`;
};

// 获取用户积分
router.get('/points', authenticate, asyncHandler(async (req, res) => {
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

  const points = userPointsStorage.get(userId) || 0;

  res.json(createSuccessResponse({
    balance: points,
    userId
  }, '获取用户积分成功'));
}));

// 创建订单
router.post('/create', authenticate, asyncHandler(async (req, res) => {
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
  let discountAmount = 0;

  // 处理积分抵扣
  if (pointsUsed > 0) {
    const userPoints = userPointsStorage.get(userId) || 0;

    // 验证积分是否足够
    if (pointsUsed > userPoints) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_POINTS',
          message: `积分不足，当前可用积分：${userPoints}`
        }
      });
    }

    // 积分最多抵扣订单金额的50%
    const maxPointsDiscount = Math.floor(totalPrice * 0.5);
    const actualPointsUsed = Math.min(pointsUsed, maxPointsDiscount, userPoints);
    discountAmount = actualPointsUsed;

    // 扣除用户积分
    userPointsStorage.set(userId, userPoints - actualPointsUsed);
  }

  const finalPrice = totalPrice + shippingFee - discountAmount;

  // 检查纯积分支付是否足够
  if (paymentMethod === 'points') {
    const userPoints = userPointsStorage.get(userId) || 0;
    if (finalPrice > userPoints) {
      // 恢复之前扣除的积分
      if (pointsUsed > 0) {
        userPointsStorage.set(userId, (userPointsStorage.get(userId) || 0) + discountAmount);
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_POINTS',
          message: `积分不足支付订单，需要${finalPrice}积分，当前可用积分：${userPoints}`
        }
      });
    }

    // 扣除积分
    const totalPointsNeeded = finalPrice - discountAmount;
    userPointsStorage.set(userId, userPoints - totalPointsNeeded);
    discountAmount = finalPrice; // 积分支付时全部抵扣
  }

  // 创建订单
  const order = {
    id: generateOrderNo(),
    orderNo: generateOrderNo(),
    userId,
    items,
    address,
    paymentMethod,
    paymentStatus: finalPrice > 0 ? 'UNPAID' : 'PAID',
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

// 获取订单列表
router.get('/list', authenticate, asyncHandler(async (req, res) => {
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

export default router;