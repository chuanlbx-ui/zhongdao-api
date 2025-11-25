import { Router } from 'express';
import { authenticate as authMiddleware } from '../../../shared/middleware/auth';
import {
  validateCreateNotificationTemplate,
  validateUpdateNotificationTemplate,
  validateSendNotification,
  validateUpdateNotificationPreferences,
  validateGetNotifications
} from '../../../shared/middleware/validation';
import {
  getNotificationsController,
  getNotificationByIdController,
  sendNotificationController,
  markAsReadController,
  markAllAsReadController,
  deleteNotificationController
} from './notifications';
import {
  getNotificationTemplatesController,
  getNotificationTemplateByIdController,
  createNotificationTemplateController,
  updateNotificationTemplateController,
  deleteNotificationTemplateController
} from './templates';
import {
  getNotificationPreferencesController,
  updateNotificationPreferencesController
} from './preferences';
import {
  getNotificationStatisticsController,
  getChannelStatisticsController
} from './statistics';

// 简单的异步处理包装器
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const router = Router();

// 基础中间件
router.use(authMiddleware);

// ===========================================
// 通知消息管理路由
// ===========================================

// 获取用户通知列表
router.get('/', validateGetNotifications, asyncHandler(getNotificationsController));

// 获取通知详情
router.get('/:id', asyncHandler(getNotificationByIdController));

// 发送通知（管理员功能）
router.post('/send',
  validateSendNotification,
  asyncHandler(sendNotificationController)
);

// 标记通知为已读
router.put('/:id/read', asyncHandler(markAsReadController));

// 标记所有通知为已读
router.put('/read-all', asyncHandler(markAllAsReadController));

// 删除通知
router.delete('/:id', asyncHandler(deleteNotificationController));

// ===========================================
// 通知模板管理路由
// ===========================================

// 获取通知模板列表
router.get('/templates/list', asyncHandler(getNotificationTemplatesController));

// 获取通知模板详情
router.get('/templates/:templateId', asyncHandler(getNotificationTemplateByIdController));

// 创建通知模板（管理员功能）
router.post('/templates',
  validateCreateNotificationTemplate,
  asyncHandler(createNotificationTemplateController)
);

// 更新通知模板（管理员功能）
router.put('/templates/:templateId',
  validateUpdateNotificationTemplate,
  asyncHandler(updateNotificationTemplateController)
);

// 删除通知模板（管理员功能）
router.delete('/templates/:templateId', asyncHandler(deleteNotificationTemplateController));

// ===========================================
// 用户通知偏好设置路由
// ===========================================

// 获取用户通知偏好设置
router.get('/preferences/my', asyncHandler(getNotificationPreferencesController));

// 更新用户通知偏好设置
router.put('/preferences/my',
  validateUpdateNotificationPreferences,
  asyncHandler(updateNotificationPreferencesController)
);

// ===========================================
// 通知统计路由
// ===========================================

// 获取通知统计数据（管理员功能）
router.get('/statistics/overview', asyncHandler(getNotificationStatisticsController));

// 获取渠道统计数据（管理员功能）
router.get('/statistics/channels', asyncHandler(getChannelStatisticsController));

// ===========================================
// 高级通知功能
// ===========================================

// TODO: 添加批量发送通知路由
// TODO: 添加定时发送通知路由
// TODO: 添加通知重试路由
// TODO: 添加通知预览路由

export { router as notificationsRouter };