import { Router } from 'express';
import { bindWechat, unbindWechat, getWechatBinding } from './binding';

const router = Router();

// 绑定微信
router.post('/bind', bindWechat);

// 解绑微信
router.post('/unbind', unbindWechat);

// 获取微信绑定状态
router.get('/binding', getWechatBinding);

export default router;