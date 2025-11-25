import { Router } from 'express';
import authRoutes from './auth';
import configRoutes from './config';
import seedRoutes from './seed';
import dashboardRoutes from './dashboard';
import usersRoutes from './users';
import productsRoutes from './products';
import ordersRoutes from './orders';

const router = Router();

// 管理员认证路由（无需认证）
router.use('/auth', authRoutes);

// 仪表板统计路由
router.use('/dashboard', dashboardRoutes);

// 用户管理路由
router.use('/users', usersRoutes);

// 商品管理路由
router.use('/products', productsRoutes);

// 订单管理路由
router.use('/orders', ordersRoutes);

// 管理员配置路由（需要管理员权限）
router.use('/config', configRoutes);

// 种子数据路由（开发环境）
router.use('/seed', seedRoutes);

// 测试路由
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Admin API is working!',
    timestamp: new Date().toISOString()
  });
});

export default router;