import { Router } from 'express';
import mainRoutes from './main';
import simpleRoutes from './simple';
import wechatRoutes from './wechat';
// import alipayRoutes from './alipay';  // 暂时禁用支付宝支付

const router = Router();

// 使用简化的支付路由（临时解决编译问题）
router.use('/', simpleRoutes);

// 微信支付相关接口
router.use('/wechat', wechatRoutes);

// 支付宝支付相关接口 (暂时禁用)
// router.use('/alipay', alipayRoutes);

export default router;