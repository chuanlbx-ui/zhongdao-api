import { Router } from 'express';

const router = Router();

// 健康检查API，不需要认证
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '积分模块运行正常',
    timestamp: new Date().toISOString()
  });
});

export default router;