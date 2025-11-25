import { Router } from 'express';

const router = Router();

// 获取库存调整历史
router.get('/history', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '获取库存调整历史成功',
      logs: [],
      pagination: {
        page: 1,
        perPage: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      },
      filters: {}
    },
    timestamp: new Date().toISOString()
  });
});

// 手动入库
router.post('/manual-in', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '手动入库接口正常工作',
      result: {
        success: true,
        logId: 'test-manual-in-log-id',
        beforeQuantity: 0,
        afterQuantity: 100,
        message: '手动入库成功（测试模式）'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// 手动出库
router.post('/manual-out', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '手动出库接口正常工作',
      result: {
        success: true,
        logId: 'test-manual-out-log-id',
        beforeQuantity: 100,
        afterQuantity: 80,
        message: '手动出库成功（测试模式）'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// 库存调拨
router.post('/transfer', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '库存调拨接口正常工作',
      result: {
        success: true,
        logId: 'test-transfer-log-id',
        beforeQuantity: 100,
        afterQuantity: 80,
        message: '库存调拨成功（测试模式）'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// 库存报损
router.post('/damage', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '库存报损接口正常工作',
      result: {
        success: true,
        logId: 'test-damage-log-id',
        beforeQuantity: 80,
        afterQuantity: 75,
        message: '库存报损成功（测试模式）'
      }
    },
    timestamp: new Date().toISOString()
  });
});

export default router;