import { Router } from 'express';
import authRoutes from './auth-simple';
import userRoutes from './users';
import levelRoutes from './levels';
import smsRoutes from './sms';
import pointsRoutes from './points';
import productRoutes from './products';
import shopRoutes from './shops';
import inventoryRoutes from './inventory';
import teamRoutes from './teams';
import paymentsRoutes from './payments';
import ordersRoutes from './orders';
import commissionRoutes from './commission';
import configDemoRoutes from './config/demo';
import configSimpleRoutes from './config/demo-simple';
import adminConfigRoutes from './admin/config';
import adminRoutes from './admin';

const router = Router();

// 认证相关路由
router.use('/auth', authRoutes);

// 用户相关路由
router.use('/users', userRoutes);

// 等级体系相关路由
router.use('/levels', levelRoutes);

// 短信验证路由
router.use('/sms', smsRoutes);

// 通券相关路由
router.use('/points', pointsRoutes);

// 商品相关路由
router.use('/products', productRoutes);

// 与介相关路由
router.use('/shops', shopRoutes);

// 库存管理相关路由
router.use('/inventory', inventoryRoutes);

// 团队管理相关路由
router.use('/teams', teamRoutes);

// 支付管理相关路由
router.use('/payments', paymentsRoutes);

// 订单管理相关路由
router.use('/orders', ordersRoutes);

// 佣金管理相关路由
router.use('/commission', commissionRoutes);

// 参数配置演示路由
router.use('/config', configDemoRoutes);
router.use('/config', configSimpleRoutes);

// 管理员配置管理路由 - 直接测试
router.get('/admin-test', (req, res) => {
  res.json({
    success: true,
    message: 'Direct admin test route working!',
    timestamp: new Date().toISOString()
  });
});

// 管理员路由（包含认证、配置等）
router.use('/admin', adminRoutes);

// 管理员配置管理路由（旧版本，保留兼容）
router.use('/admin/config', adminConfigRoutes);

// 临时直接定义团队路由以确保可用性
router.get('/teams/test', (req, res) => {
  res.json({
    success: true,
    data: {
      message: '团队管理模块 - 直接路由测试',
      status: 'working',
      timestamp: new Date().toISOString()
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
        users: {
          'POST /users/register': '用户注册',
          'GET /users/me': '获取当前用户信息',
          'PUT /users/me': '更新用户信息',
          'GET /users': '获取用户列表（管理员）',
          'GET /users/level/progress': '获取当前用户的等级进度',
          'GET /users/referral-info': '获取推荐信息'
        },
        levels: {
          'GET /levels/system': '获取所有等级体系配置',
          'GET /levels/me': '获取当前用户的等级信息',
          'GET /levels/me/upgrade-history': '获取用户等级升级历史',
          'GET /levels/:userId': '获取指定用户的等级信息（管理员）',
          'POST /levels/:userId/upgrade': '手动升级用户等级（管理员）',
          'POST /levels/system/check-upgrades': '系统批量检查并升级用户',
          'GET /levels/benefits/:level': '获取等级权益详情'
        },
        sms: {
          'POST /sms/send-code': '发送短信验证码',
          'POST /sms/verify-and-bind': '验证并绑定/解绑手机号',
          'GET /sms/check-phone/:phone': '检查手机号绑定状态'
        },
        points: {
          'GET /points/balance': '获取通券余额',
          'POST /points/transfer': '通券转账',
          'POST /points/recharge': '通券充值（管理员）',
          'GET /points/transactions': '获取通券流水记录',
          'GET /points/statistics': '获取通券统计信息',
          'POST /points/freeze': '通券冻结/解冻（管理员）',
          'POST /points/batch-recharge': '批量充值（管理员）'
        },
        products: {
          'GET /products': '获取商品模块信息',
          'GET /products/categories/tree': '获取商品分类树',
          'GET /products/categories': '获取商品分类列表',
          'POST /products/categories': '创建商品分类',
          'PUT /products/categories/:id': '更新商品分类',
          'DELETE /products/categories/:id': '删除商品分类',
          'GET /products/tags': '获取商品标签列表',
          'GET /products/tags/all': '获取所有商品标签（不分页）',
          'POST /products/tags': '创建商品标签',
          'PUT /products/tags/:id': '更新商品标签',
          'DELETE /products/tags/:id': '删除商品标签',
          'POST /products/tags/batch': '批量创建商品标签',
          'GET /products/items': '获取商品列表',
          'GET /products/items/:id': '获取商品详情',
          'POST /products/items': '创建商品',
          'PUT /products/items/:id': '更新商品',
          'DELETE /products/items/:id': '删除商品',
          'PUT /products/items/:id/status': '更新商品状态',
          'POST /products/items/batch-status': '批量更新商品状态',
          'GET /products/specs': '获取商品规格列表',
          'GET /products/specs/:id': '获取规格详情',
          'POST /products/specs': '创建商品规格',
          'PUT /products/specs/:id': '更新商品规格',
          'PUT /products/specs/:id/status': '更新规格状态',
          'DELETE /products/specs/:id': '删除商品规格'
        },
        shops: {
          'GET /shops': '获取用户店铺列表',
          'GET /shops/:shopId': '获取店铺详情',
          'GET /shops/:shopId/statistics': '获取店铺统计',
          'POST /shops/apply': '申请开店',
          'GET /shops/cloud/upgrade-check': '检查云店升级条件',
          'POST /shops/cloud/upgrade': '执行云店升级',
          'POST /shops/wutong/purchase': '购买五通店',
          'POST /shops/wutong/:shopId/confirm-payment': '确认五通店支付'
        },
        inventory: {
          'GET /inventory/logs': '获取库存流水记录列表',
          'GET /inventory/logs/:id': '获取库存流水记录详情',
          'GET /inventory/logs/statistics/summary': '获取库存统计信息',
          'GET /inventory/alerts': '获取库存预警列表',
          'GET /inventory/alerts/:id': '获取库存预警详情',
          'PUT /inventory/alerts/:id/read': '标记预警为已读',
          'PUT /inventory/alerts/:id/resolve': '解决库存预警',
          'POST /inventory/alerts/check': '检查库存预警（系统自动）',
          'POST /inventory/adjustments/manual-in': '手动入库',
          'POST /inventory/adjustments/manual-out': '手动出库',
          'POST /inventory/adjustments/transfer': '库存调拨',
          'POST /inventory/adjustments/damage': '库存报损',
          'GET /inventory/adjustments/history': '获取库存调整历史'
        },
        teams: {
          'GET /teams': '获取团队管理模块信息',
          'POST /teams/referral': '建立推荐关系',
          'GET /teams/referral/:userId': '获取用户推荐关系',
          'GET /teams/members': '获取团队成员列表',
          'GET /teams/members/:memberId': '获取成员详情',
          'GET /teams/structure/:teamId': '获取团队结构',
          'GET /teams/network/:userId': '获取网络树结构',
          'GET /teams/performance': '获取业绩指标',
          'GET /teams/statistics/:teamId': '获取团队统计',
          'GET /teams/ranking/:teamId': '获取团队排名',
          'POST /teams/commission/calculate': '计算佣金',
          'GET /teams/commission/:userId': '获取佣金记录',
          'POST /teams/promote': '成员晋升',
          'GET /teams/permissions/:userId': '获取用户权限',
          'PUT /teams/member/:memberId/status': '更新成员状态'
        },
        payments: {
          'GET /payments': '获取支付模块信息',
          'POST /payments/points/pay': '通券支付',
          'POST /payments/points/transfer': '通券转账',
          'POST /payments/batch/transfer': '批量转账',
          'GET /payments/statistics': '支付统计',
          'GET /payments/recharge/history': '充值历史',
          'POST /payments/recharge/mock/wechat': '模拟微信充值',
          'GET /payments/info/balance/:userId': '用户余额',
          'GET /payments/info/permissions/:userId': '支付权限',
          'GET /payments/info/exchange-rate': '汇率信息',
          'GET /payments/info/methods': '支付方式'
        },
        orders: {
          'GET /orders': '获取订单模块信息',
          'POST /orders': '创建订单',
          'GET /orders/:orderId': '获取订单详情',
          'PUT /orders/:orderId/confirm': '确认订单',
          'PUT /orders/:orderId/cancel': '取消订单',
          'GET /orders/statistics': '获取订单统计',
          'GET /orders/statistics/overview': '获取订单统计概览',
          'POST /orders/exchange': '创建换货申请'
        },
        commission: {
          'GET /commission': '获取佣金模块信息',
          'GET /commission/statistics': '获取用户佣金统计',
          'GET /commission/records': '获取佣金记录列表',
          'GET /commission/team-performance': '获取团队业绩统计',
          'GET /commission/upgrade-check': '检查升级条件',
          'POST /commission/upgrade/:userId': '手动升级用户（管理员）',
          'POST /commission/settle': '结算佣金（管理员）',
          'POST /commission/pay': '支付佣金（管理员）'
        },
        'admin/level-configs': {
          'GET /admin/level-configs/system': '获取等级系统配置',
          'GET /admin/level-configs/admin/raw': '获取等级配置原始数据（管理员）',
          'PUT /admin/level-configs/admin/system': '更新等级配置（管理员）',
          'GET /admin/level-configs/admin/all': '获取所有系统配置',
          'POST /admin/level-configs/admin/reset': '重置等级配置为默认值'
        },
        'admin/config': {
          'GET /admin/config/configs': '获取所有配置（分页）',
          'GET /admin/config/configs/:key': '获取单个配置详情',
          'POST /admin/config/configs': '创建新配置',
          'PUT /admin/config/configs/:key': '更新配置',
          'DELETE /admin/config/configs/:key': '删除配置',
          'GET /admin/config/categories': '获取配置分类列表',
          'POST /admin/config/configs/batch': '批量更新配置',
          'GET /admin/config/configs/:key/history': '获取配置修改历史',
          'GET /admin/config/configs/export': '导出配置',
          'POST /admin/config/configs/import': '导入配置'
        }
      },
      timestamp: new Date().toISOString()
    }
  });
});

export default router;