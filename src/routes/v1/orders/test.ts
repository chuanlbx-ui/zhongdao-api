import { Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth';

const router = Router();

// 应用认证中间件
router.use(authenticate);

// 简单的测试接口
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '订单模块测试接口正常工作',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

export default router;