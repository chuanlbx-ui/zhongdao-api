/**
 * 五通店API路由
 * 定义五通店相关的HTTP端点
 */

import { Router } from 'express';
import { wutongController } from './wutong.controller';
import { authenticate } from '@/shared/middleware/auth';

const router = Router();

/**
 * 五通店API路由前缀: /api/wutong
 */

// 验证用户五通店资格
router.get('/qualification', authenticate, wutongController.validateQualification);

// 计算买10赠1权益
router.post('/calculate-benefit', authenticate, wutongController.calculateBenefit);

// 开通五通店
router.post('/open-shop', authenticate, wutongController.openWutongShop);

// 获取五通店统计数据
router.get('/statistics', authenticate, wutongController.getStatistics);

// 获取五通店权益说明（无需登录）
router.get('/benefits', wutongController.getBenefitsInfo);

// 模拟支付确认（仅开发环境使用）
router.post('/simulate-payment/:shopId', authenticate, wutongController.simulatePaymentConfirmation);

export default router;