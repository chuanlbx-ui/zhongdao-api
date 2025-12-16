import { Router } from 'express';
import authRoutes from './auth-simple';
import inventoryRoutes from './inventory/index';
import teamsRoutes from './teams/index';
import performanceRoutes from './performance/index';
import healthRoutes from './health/index';
import monitoringRoutes from './monitoring/index';
import productsRoutes from './products/index';
import cartRoutes from './cart/index';
import orderRoutes from './orders/index';
import wechatRoutes from './wechat';
import testUsersRoutes from './test-users';
import usersSimpleRoutes from './users-simple';
import adminUsersRoutes from './admin-users';
import adminRoutes from './admin';
import { getRecommendations, getHotProducts } from '../../controllers/products';
import { getBanners, getActiveBanners } from '../../controllers/banners';

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

// 商品相关路由
router.use('/products', productsRoutes);

// 购物车相关路由
router.use('/cart', cartRoutes);

// 订单相关路由
router.use('/orders', orderRoutes);

// 微信相关路由
router.use('/wechat', wechatRoutes);

// 测试用户路由
router.use('/test-users', testUsersRoutes);

// 管理员路由
router.use('/admin', adminRoutes);

// 简单用户路由（用于管理后台）
router.use('/admin/users', adminUsersRoutes);
router.use('/users', adminUsersRoutes);  // 同时挂载到 /users 路径

// 推荐商品接口 - 直接挂载
router.get('/recommendations', getRecommendations);

// 热门商品接口 - 直接挂载
router.get('/hot', getHotProducts);

// Banner相关接口
router.get('/banners', getBanners);
router.get('/banners/active', getActiveBanners);

// 简单的 admin 测试路由
router.get('/admin-test', (req, res) => {
  console.log('🔍 admin-test 路由被调用');
  res.json({
    success: true,
    message: 'Admin route working!',
    timestamp: new Date().toISOString()
  });
});

// 用户列表测试路由
router.get('/admin/users', (req, res) => {
  console.log('🔍 /admin/users 路由被调用');

  const mockUsers = [
    { id: '1', nickname: '张三', phone: '13911111001', level: 'VIP', pointsBalance: 1000, createdAt: new Date() },
    { id: '2', nickname: '李四', phone: '13911111002', level: 'STAR_1', pointsBalance: 3200, createdAt: new Date() },
    { id: '3', nickname: '王五', phone: '13911111003', level: 'STAR_2', pointsBalance: 8500, createdAt: new Date() },
    { id: '4', nickname: '赵六', phone: '13911111004', level: 'STAR_3', pointsBalance: 15000, createdAt: new Date() },
    { id: '5', nickname: '钱七', phone: '13911111005', level: 'NORMAL', pointsBalance: 200, createdAt: new Date() }
  ];

  res.json({
    success: true,
    data: {
      items: mockUsers,
      total: 5,
      page: 1,
      perPage: 20
    }
  });
});

// 创建用户测试路由 - 已删除，现在使用admin/users中的真实路由

// 同时挂载到 /users 路径
router.get('/users', (req, res) => {
  console.log('🔍 /users 路由被调用');

  const mockUsers = [
    { id: '1', nickname: '张三', phone: '13911111001', level: 'VIP', pointsBalance: 1000, createdAt: new Date() },
    { id: '2', nickname: '李四', phone: '13911111002', level: 'STAR_1', pointsBalance: 3200, createdAt: new Date() },
    { id: '3', nickname: '王五', phone: '13911111003', level: 'STAR_2', pointsBalance: 8500, createdAt: new Date() },
    { id: '4', nickname: '赵六', phone: '13911111004', level: 'STAR_3', pointsBalance: 15000, createdAt: new Date() },
    { id: '5', nickname: '钱七', phone: '13911111005', level: 'NORMAL', pointsBalance: 200, createdAt: new Date() }
  ];

  res.json({
    success: true,
    data: {
      items: mockUsers,
      total: 5,
      page: 1,
      perPage: 20
    }
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
        },
        products: {
          'GET /products/recommendations': '获取推荐商品',
          'GET /products/hot': '获取热门商品',
          'GET /products': '商品模块API'
        }
      },
      timestamp: new Date().toISOString()
    }
  });
});

export default router;