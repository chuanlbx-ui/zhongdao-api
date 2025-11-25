import { Router } from 'express';

const router = Router();

// 获取订单模块信息
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '订单管理模块 API',
      version: '1.0.0',
      endpoints: {
        retail: {
          'POST /orders/retail': '创建零售订单',
          'GET /orders/retail': '获取零售订单列表'
        },
        purchase: {
          'POST /orders/purchase': '创建采购订单',
          'GET /orders/purchase': '获取采购订单列表'
        },
        exchange: {
          'POST /orders/exchange': '创建换货申请',
          'GET /orders/exchange': '获取换货申请列表'
        },
        statistics: {
          'GET /orders/statistics': '获取订单统计'
        }
      },
      timestamp: new Date().toISOString()
    }
  });
});

// 获取订单统计
router.get('/statistics', (req, res) => {
  const statistics = {
    totalOrders: 0,
    totalAmount: 0,
    paidOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0,
    retailOrders: 0,
    purchaseOrders: 0,
    exchangeOrders: 0,
    pendingOrders: 0,
    processingOrders: 0,
    shippedOrders: 0
  };

  res.json({
    success: true,
    data: statistics,
    message: '获取订单统计成功'
  });
});

export default router;