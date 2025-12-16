import { Router } from 'express';
import cartRoutes from './cart';

const router = Router();

// 所有购物车相关路由
router.use('/', cartRoutes);

export default router;