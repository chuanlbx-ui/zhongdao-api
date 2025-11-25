import { Router } from 'express';

const router = Router();

// 简单的测试路由
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '通知模块测试成功！',
    timestamp: new Date().toISOString()
  });
});

export { router as testNotificationsRouter };