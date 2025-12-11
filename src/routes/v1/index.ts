import { Router } from 'express';
import authRoutes from './auth-simple';
import inventoryRoutes from './inventory/index';
import teamsRoutes from './teams/index';
import performanceRoutes from './performance/index';
import healthRoutes from './health/index';
import monitoringRoutes from './monitoring/index';

const router = Router();

console.log('🔍 v1/index.ts: 路由文件已加载');

// 认证相关路由
router.use('/auth', authRoutes);

// 库存管理相关路由
router.use('/inventory', inventoryRoutes);

// 团队管理相关路由
router.use('/teams', teamsRoutes);

// 性能监控相关路由
router.use('/performance', performanceRoutes);

// 健康检查路由
router.use('/health', healthRoutes);

// 监控面板路由
router.use('/monitoring', monitoringRoutes);

// 简单的 admin 测试路由
router.get('/admin-test', (req, res) => {
  console.log('🔍 admin-test 路由被调用');
  res.json({
    success: true,
    message: 'Admin route working!',
    timestamp: new Date().toISOString()
  });
});

// API信息
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '中道商城系统 API v1.0.0',
      version: '1.0.0',
      endpoints: {
        auth: {
          'POST /auth/wechat-login': '微信小程序登录',
          'POST /auth/refresh': '刷新Token',
          'POST /auth/logout': '登出'
        },
        inventory: {
          'GET /inventory': '获取库存列表',
          'GET /inventory/logs': '获取库存流水记录',
          'POST /inventory/adjustments/manual-in': '手动入库',
          'POST /inventory/adjustments/manual-out': '手动出库'
        }
      },
      timestamp: new Date().toISOString()
    }
  });
});

export default router;