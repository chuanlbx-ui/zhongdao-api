import { Router } from 'express';
import { authenticate as authMiddleware } from '../../../shared/middleware/auth';
import {
  validateCreateLogisticsCompany,
  validateUpdateLogisticsCompany,
  validateCreateShipment,
  validateUpdateShipment,
  validateAddTracking,
  validateBatchShip,
  validatePartialShip,
  validateEstimateShipping
} from '../../../shared/middleware/validation';
import {
  createShipmentController,
  getShipmentsController,
  getShipmentByIdController,
  updateShipmentController,
  deleteShipmentController,
  getTrackingController,
  addTrackingController,
  syncTrackingController
} from './shipment';

// 简单的异步处理包装器
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
import {
  getLogisticsCompaniesController,
  getLogisticsCompanyByIdController,
  createLogisticsCompanyController,
  updateLogisticsCompanyController,
  deleteLogisticsCompanyController
} from './companies';
import {
  batchShipController,
  partialShipController,
  estimateShippingController
} from './shipping';

const router = Router();

// 基础中间件
router.use(authMiddleware);

// ===========================================
// 物流公司管理路由
// ===========================================

router.get('/companies', asyncHandler(getLogisticsCompaniesController));
router.get('/companies/:id', asyncHandler(getLogisticsCompanyByIdController));
router.post('/companies',
  validateCreateLogisticsCompany,
  asyncHandler(createLogisticsCompanyController)
);
router.put('/companies/:id',
  validateUpdateLogisticsCompany,
  asyncHandler(updateLogisticsCompanyController)
);
router.delete('/companies/:id', asyncHandler(deleteLogisticsCompanyController));

// ===========================================
// 发货管理路由
// ===========================================

router.get('/shipments', asyncHandler(getShipmentsController));
router.get('/shipments/:id', asyncHandler(getShipmentByIdController));
router.post('/shipments',
  validateCreateShipment,
  asyncHandler(createShipmentController)
);
router.put('/shipments/:id',
  validateUpdateShipment,
  asyncHandler(updateShipmentController)
);
router.delete('/shipments/:id', asyncHandler(deleteShipmentController));

// 物流追踪相关
router.get('/shipments/:id/tracking', asyncHandler(getTrackingController));
router.post('/shipments/:id/tracking',
  validateAddTracking,
  asyncHandler(addTrackingController)
);
router.post('/shipments/:id/sync', asyncHandler(syncTrackingController));

// ===========================================
// 高级发货功能
// ===========================================

// 批量发货
router.post('/shipping/batch',
  validateBatchShip,
  asyncHandler(batchShipController)
);

// 部分发货/拆单发货
router.post('/shipping/partial',
  validatePartialShip,
  asyncHandler(partialShipController)
);

// 运费估算
router.post('/shipping/estimate',
  validateEstimateShipping,
  asyncHandler(estimateShippingController)
);

// ===========================================
// 统计和分析
// ===========================================

// TODO: 添加物流统计相关路由
// router.get('/statistics', ...);
// router.get('/reports', ...);

export { router as logisticsRouter };