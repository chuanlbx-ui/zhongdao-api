/**
 * 快速启动路由 - 最简化版本
 * 只保留核心路由，让服务器先启动
 */

import { Router } from 'express';

const router = Router();

// 基本测试路由
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'API服务正常运行',
        timestamp: new Date().toISOString()
    });
});

export default router;