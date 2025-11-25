import { Router } from 'express';

const router = Router();

// 简化的订单模块测试路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '订单管理模块 - 简化版本正常运行',
      version: '1.0.0-simple',
      status: 'working',
      timestamp: new Date().toISOString()
    },
    message: '订单模块API可访问'
  });
});

// 创建订单（简化版）
router.post('/', (req, res) => {
  const { userId, items, totalAmount } = req.body;

  if (!userId || !items || !totalAmount) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数：userId, items, totalAmount'
    });
  }

  const orderId = 'order_' + Date.now();

  res.json({
    success: true,
    data: {
      orderId,
      userId,
      items,
      totalAmount,
      status: 'pending',
      createdAt: new Date().toISOString()
    },
    message: '订单创建成功（模拟）'
  });
});

export default router;