import { Router, Request, Response } from 'express';

const router = Router();

// 最简单的测试路由，不依赖任何外部模块
router.get('/simple-test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: '通知模块简化测试成功！',
    timestamp: new Date().toISOString()
  });
});

export { router as simpleTestRouter };