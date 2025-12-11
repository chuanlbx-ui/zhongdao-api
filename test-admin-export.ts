#!/usr/bin/env node

// 测试 admin 路由导出
import { Router } from 'express';

// 创建一个简单的路由
const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Admin test route working!',
    timestamp: new Date().toISOString()
  });
});

export default router;