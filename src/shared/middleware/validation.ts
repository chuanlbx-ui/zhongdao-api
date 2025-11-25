import { Request, Response, NextFunction } from 'express';
import { body, validationResult, param, query } from 'express-validator';
import { createErrorResponse, ErrorCode } from '../types/response';

// 验证中间件工厂
export const validate = (validations: any[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const validationErrors = errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }));

      const response = createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        '请求参数验证失败',
        validationErrors
      );

      return res.status(400).json(response);
    }

    next();
  };
};

// 常用验证规则
export const commonValidations = {
  // ID验证
  id: param('id').isUUID(4).withMessage('无效的ID格式'),

  // 分页参数验证
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是大于0的整数'),
    query('perPage')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须是1-100之间的整数'),
    query('sort')
      .optional()
      .isString()
      .withMessage('排序字段必须是字符串'),
    query('order')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('排序方向必须是asc或desc')
  ],

  // 用户相关验证
  userRegistration: [
    body('openid')
      .notEmpty()
      .withMessage('openid不能为空')
      .isLength({ min: 1, max: 100 })
      .withMessage('openid长度必须在1-100字符之间'),
    body('nickname')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('昵称长度必须在2-50字符之间')
      .matches(/^[\u4e00-\u9fa5a-zA-Z0-9]+$/)
      .withMessage('昵称只能包含中文、英文和数字'),
    body('phone')
      .optional()
      .isMobilePhone('zh-CN')
      .withMessage('手机号格式不正确'),
    body('avatarUrl')
      .optional()
      .isURL()
      .withMessage('头像URL格式不正确')
  ],

  // 用户更新验证
  userUpdate: [
    body('nickname')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('昵称长度必须在2-50字符之间'),
    body('avatarUrl')
      .optional()
      .isURL()
      .withMessage('头像URL格式不正确')
  ],

  // 用户等级验证
  userLevel: body('level')
    .isIn(['normal', 'vip', 'star_1', 'star_2', 'star_3', 'star_4', 'star_5', 'director'])
    .withMessage('无效的用户等级'),

  // 商品相关验证
  productCreate: [
    body('categoryId')
      .notEmpty()
      .withMessage('商品分类ID不能为空')
      .isUUID(4)
      .withMessage('无效的分类ID格式'),
    body('name')
      .notEmpty()
      .withMessage('商品名称不能为空')
      .isLength({ min: 2, max: 200 })
      .withMessage('商品名称长度必须在2-200字符之间'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('商品描述长度不能超过1000字符'),
    body('sku')
      .notEmpty()
      .withMessage('SKU不能为空')
      .isLength({ min: 1, max: 100 })
      .withMessage('SKU长度必须在1-100字符之间'),
    body('basePrice')
      .notEmpty()
      .withMessage('基础价格不能为空')
      .isFloat({ min: 0 })
      .withMessage('基础价格必须大于等于0'),
    body('vipPrice')
      .notEmpty()
      .withMessage('VIP价格不能为空')
      .isFloat({ min: 0 })
      .withMessage('VIP价格必须大于等于0'),
    body('totalStock')
      .isInt({ min: 0 })
      .withMessage('总库存必须大于等于0'),
    body('minStock')
      .isInt({ min: 0 })
      .withMessage('最低库存必须大于等于0')
  ],

  // 采购订单验证
  purchaseOrderCreate: [
    body('buyerId')
      .notEmpty()
      .withMessage('买家ID不能为空')
      .isUUID(4)
      .withMessage('无效的买家ID格式'),
    body('sellerId')
      .notEmpty()
      .withMessage('卖家ID不能为空')
      .isUUID(4)
      .withMessage('无效的卖家ID格式'),
    body('productId')
      .notEmpty()
      .withMessage('商品ID不能为空')
      .isUUID(4)
      .withMessage('无效的商品ID格式'),
    body('quantity')
      .notEmpty()
      .withMessage('采购数量不能为空')
      .isInt({ min: 1 })
      .withMessage('采购数量必须大于0'),
    body('unitPrice')
      .notEmpty()
      .withMessage('单价不能为空')
      .isFloat({ min: 0 })
      .withMessage('单价必须大于等于0')
  ],

  // 通券转账验证
  pointsTransfer: [
    body('toUserId')
      .notEmpty()
      .withMessage('接收用户ID不能为空')
      .isUUID(4)
      .withMessage('无效的接收用户ID格式'),
    body('amount')
      .notEmpty()
      .withMessage('转账金额不能为空')
      .isFloat({ min: 0.01 })
      .withMessage('转账金额必须大于0.01'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('转账说明长度不能超过200字符')
  ],

  // 通券充值验证
  pointsRecharge: [
    body('amount')
      .notEmpty()
      .withMessage('充值金额不能为空')
      .isFloat({ min: 1 })
      .withMessage('充值金额必须大于等于1'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('充值说明长度不能超过200字符')
  ]
};

// 组合验证中间件
export const validateUserRegistration = [
  ...commonValidations.userRegistration,
  validate
];

export const validateUserUpdate = [
  ...commonValidations.userUpdate,
  validate
];

export const validateUserLevel = [
  commonValidations.userLevel,
  validate
];

export const validateProductCreate = [
  ...commonValidations.productCreate,
  validate
];

export const validatePurchaseOrderCreate = [
  ...commonValidations.purchaseOrderCreate,
  validate
];

export const validatePointsTransfer = [
  ...commonValidations.pointsTransfer,
  validate
];

export const validatePointsRecharge = [
  ...commonValidations.pointsRecharge,
  validate
];

export const validatePagination = [
  ...commonValidations.pagination,
  validate
];

// 物流相关验证规则
export const logisticsValidations = {
  // 物流公司创建验证
  createLogisticsCompany: [
    body('code')
      .notEmpty()
      .withMessage('物流公司代码不能为空')
      .isLength({ min: 2, max: 10 })
      .withMessage('物流公司代码长度必须在2-10字符之间')
      .matches(/^[A-Z0-9]+$/)
      .withMessage('物流公司代码只能包含大写字母和数字'),
    body('name')
      .notEmpty()
      .withMessage('物流公司名称不能为空')
      .isLength({ min: 2, max: 100 })
      .withMessage('物流公司名称长度必须在2-100字符之间'),
    body('displayName')
      .notEmpty()
      .withMessage('物流公司显示名称不能为空')
      .isLength({ min: 2, max: 100 })
      .withMessage('物流公司显示名称长度必须在2-100字符之间'),
    body('website')
      .optional()
      .isURL()
      .withMessage('网站URL格式不正确'),
    body('phone')
      .optional()
      .matches(/^1[3-9]\d{9}$/)
      .withMessage('客服电话格式不正确'),
    body('serviceScope')
      .optional()
      .isIn(['NATIONAL', 'INTERNATIONAL', 'LOCAL', 'SAME_CITY'])
      .withMessage('无效的服务范围'),
    body('deliveryTypes')
      .optional()
      .isArray()
      .withMessage('配送类型必须是数组'),
    body('normalDelivery')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('普通配送时效必须是1-168小时之间的整数'),
    body('expressDelivery')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('快速配送时效必须是1-168小时之间的整数'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须大于等于0')
  ],

  // 物流公司更新验证
  updateLogisticsCompany: [
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('物流公司名称长度必须在2-100字符之间'),
    body('displayName')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('物流公司显示名称长度必须在2-100字符之间'),
    body('website')
      .optional()
      .isURL()
      .withMessage('网站URL格式不正确'),
    body('phone')
      .optional()
      .matches(/^1[3-9]\d{9}$/)
      .withMessage('客服电话格式不正确'),
    body('serviceScope')
      .optional()
      .isIn(['NATIONAL', 'INTERNATIONAL', 'LOCAL', 'SAME_CITY'])
      .withMessage('无效的服务范围'),
    body('deliveryTypes')
      .optional()
      .isArray()
      .withMessage('配送类型必须是数组'),
    body('normalDelivery')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('普通配送时效必须是1-168小时之间的整数'),
    body('expressDelivery')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('快速配送时效必须是1-168小时之间的整数'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('状态必须是布尔值'),
    body('sort')
      .optional()
      .isInt({ min: 0 })
      .withMessage('排序值必须大于等于0')
  ],

  // 发货记录创建验证
  createShipment: [
    body('orderId')
      .notEmpty()
      .withMessage('订单ID不能为空')
      .isUUID(4)
      .withMessage('无效的订单ID格式'),
    body('companyId')
      .notEmpty()
      .withMessage('物流公司ID不能为空')
      .isUUID(4)
      .withMessage('无效的物流公司ID格式'),
    body('trackingNumber')
      .notEmpty()
      .withMessage('物流单号不能为空')
      .isLength({ min: 5, max: 50 })
      .withMessage('物流单号长度必须在5-50字符之间'),
    body('receiverName')
      .notEmpty()
      .withMessage('收件人姓名不能为空')
      .isLength({ min: 2, max: 50 })
      .withMessage('收件人姓名长度必须在2-50字符之间'),
    body('receiverPhone')
      .notEmpty()
      .withMessage('收件人电话不能为空')
      .isMobilePhone('zh-CN')
      .withMessage('收件人电话格式不正确'),
    body('receiverAddress')
      .notEmpty()
      .withMessage('收件人地址不能为空')
      .isLength({ min: 5, max: 200 })
      .withMessage('收件人地址长度必须在5-200字符之间'),
    body('packageCount')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('包裹数量必须是1-100之间的整数'),
    body('packageWeight')
      .optional()
      .isFloat({ min: 0.1, max: 1000 })
      .withMessage('包裹重量必须是0.1-1000kg之间的数值'),
    body('packageVolume')
      .optional()
      .isFloat({ min: 0.1, max: 10000 })
      .withMessage('包裹体积必须是0.1-10000立方分米之间的数值'),
    body('goodsValue')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('货物价值必须大于等于0'),
    body('deliveryType')
      .optional()
      .isIn(['STANDARD', 'EXPRESS', 'SAME_DAY', 'NEXT_DAY', 'PICKUP'])
      .withMessage('无效的配送类型'),
    body('deliveryFee')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('配送费用必须大于等于0'),
    body('CODAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('货到付款金额必须大于等于0'),
    body('estimatedDelivery')
      .optional()
      .isISO8601()
      .withMessage('预计送达时间格式不正确')
  ],

  // 发货记录更新验证
  updateShipment: [
    body('trackingNumber')
      .optional()
      .isLength({ min: 5, max: 50 })
      .withMessage('物流单号长度必须在5-50字符之间'),
    body('receiverName')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('收件人姓名长度必须在2-50字符之间'),
    body('receiverPhone')
      .optional()
      .isMobilePhone('zh-CN')
      .withMessage('收件人电话格式不正确'),
    body('receiverAddress')
      .optional()
      .isLength({ min: 5, max: 200 })
      .withMessage('收件人地址长度必须在5-200字符之间'),
    body('packageCount')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('包裹数量必须是1-100之间的整数'),
    body('packageWeight')
      .optional()
      .isFloat({ min: 0.1, max: 1000 })
      .withMessage('包裹重量必须是0.1-1000kg之间的数值'),
    body('packageVolume')
      .optional()
      .isFloat({ min: 0.1, max: 10000 })
      .withMessage('包裹体积必须是0.1-10000立方分米之间的数值'),
    body('goodsValue')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('货物价值必须大于等于0'),
    body('deliveryFee')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('配送费用必须大于等于0'),
    body('CODAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('货到付款金额必须大于等于0'),
    body('estimatedDelivery')
      .optional()
      .isISO8601()
      .withMessage('预计送达时间格式不正确'),
    body('status')
      .optional()
      .isIn(['PENDING', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'])
      .withMessage('无效的物流状态'),
    body('isException')
      .optional()
      .isBoolean()
      .withMessage('异常状态必须是布尔值'),
    body('exceptionReason')
      .optional()
      .isLength({ max: 200 })
      .withMessage('异常原因长度不能超过200字符')
  ],

  // 物流轨迹添加验证
  addTracking: [
    body('time')
      .notEmpty()
      .withMessage('轨迹时间不能为空')
      .isISO8601()
      .withMessage('轨迹时间格式不正确'),
    body('status')
      .notEmpty()
      .withMessage('状态描述不能为空')
      .isLength({ min: 1, max: 100 })
      .withMessage('状态描述长度必须在1-100字符之间'),
    body('location')
      .optional()
      .isLength({ max: 100 })
      .withMessage('所在位置长度不能超过100字符'),
    body('description')
      .optional()
      .isLength({ max: 200 })
      .withMessage('详细描述长度不能超过200字符'),
    body('operator')
      .optional()
      .isLength({ max: 50 })
      .withMessage('操作员姓名长度不能超过50字符'),
    body('operatorPhone')
      .optional()
      .isMobilePhone('zh-CN')
      .withMessage('操作员电话格式不正确'),
    body('source')
      .optional()
      .isIn(['MANUAL', 'API', 'WEBHOOK', 'IMPORT'])
      .withMessage('无效的数据来源')
  ],

  // 批量发货验证
  batchShip: [
    body('orderIds')
      .notEmpty()
      .withMessage('订单ID列表不能为空')
      .isArray({ min: 1, max: 100 })
      .withMessage('订单ID列表必须是1-100个元素的数组'),
    body('orderIds.*')
      .isUUID(4)
      .withMessage('订单ID格式不正确'),
    body('companyId')
      .notEmpty()
      .withMessage('物流公司ID不能为空')
      .isUUID(4)
      .withMessage('无效的物流公司ID格式'),
    body('deliveryType')
      .optional()
      .isIn(['STANDARD', 'EXPRESS', 'SAME_DAY', 'NEXT_DAY', 'PICKUP'])
      .withMessage('无效的配送类型')
  ],

  // 部分发货验证
  partialShip: [
    body('orderId')
      .notEmpty()
      .withMessage('订单ID不能为空')
      .isUUID(4)
      .withMessage('无效的订单ID格式'),
    body('orderItemIds')
      .notEmpty()
      .withMessage('订单项ID列表不能为空')
      .isArray({ min: 1 })
      .withMessage('订单项ID列表必须至少包含一个元素'),
    body('orderItemIds.*')
      .isUUID(4)
      .withMessage('订单项ID格式不正确'),
    body('companyId')
      .notEmpty()
      .withMessage('物流公司ID不能为空')
      .isUUID(4)
      .withMessage('无效的物流公司ID格式'),
    body('trackingNumber')
      .optional()
      .isLength({ min: 5, max: 50 })
      .withMessage('物流单号长度必须在5-50字符之间'),
    body('deliveryType')
      .optional()
      .isIn(['STANDARD', 'EXPRESS', 'SAME_DAY', 'NEXT_DAY', 'PICKUP'])
      .withMessage('无效的配送类型')
  ],

  // 运费估算验证
  estimateShipping: [
    body('companyId')
      .notEmpty()
      .withMessage('物流公司ID不能为空')
      .isUUID(4)
      .withMessage('无效的物流公司ID格式'),
    body('senderProvince')
      .notEmpty()
      .withMessage('发货省份不能为空')
      .isLength({ min: 2, max: 20 })
      .withMessage('发货省份长度必须在2-20字符之间'),
    body('senderCity')
      .notEmpty()
      .withMessage('发货城市不能为空')
      .isLength({ min: 2, max: 20 })
      .withMessage('发货城市长度必须在2-20字符之间'),
    body('receiverProvince')
      .notEmpty()
      .withMessage('收货省份不能为空')
      .isLength({ min: 2, max: 20 })
      .withMessage('收货省份长度必须在2-20字符之间'),
    body('receiverCity')
      .notEmpty()
      .withMessage('收货城市不能为空')
      .isLength({ min: 2, max: 20 })
      .withMessage('收货城市长度必须在2-20字符之间'),
    body('deliveryType')
      .optional()
      .isIn(['STANDARD', 'EXPRESS', 'SAME_DAY', 'NEXT_DAY', 'PICKUP'])
      .withMessage('无效的配送类型'),
    body('codAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('货到付款金额必须大于等于0')
  ]
};

// 导出物流验证中间件
export const validateCreateLogisticsCompany = [
  ...logisticsValidations.createLogisticsCompany,
  validate
];

export const validateUpdateLogisticsCompany = [
  ...logisticsValidations.updateLogisticsCompany,
  validate
];

export const validateCreateShipment = [
  ...logisticsValidations.createShipment,
  validate
];

export const validateUpdateShipment = [
  ...logisticsValidations.updateShipment,
  validate
];

export const validateAddTracking = [
  ...logisticsValidations.addTracking,
  validate
];

export const validateBatchShip = [
  ...logisticsValidations.batchShip,
  validate
];

export const validatePartialShip = [
  ...logisticsValidations.partialShip,
  validate
];

export const validateEstimateShipping = [
  ...logisticsValidations.estimateShipping,
  validate
];

// 通知相关验证规则
export const notificationValidations = {
  // 发送通知验证
  sendNotification: [
    body('recipientIds')
      .notEmpty()
      .withMessage('接收者ID列表不能为空')
      .isArray({ min: 1, max: 1000 })
      .withMessage('接收者ID列表必须是1-1000个元素的数组'),
    body('recipientIds.*')
      .isUUID(4)
      .withMessage('接收者ID格式不正确'),
    body('category')
      .optional()
      .isIn(['SYSTEM', 'ORDER', 'PAYMENT', 'LOGISTICS', 'USER_LEVEL', 'SHOP', 'INVENTORY', 'PROMOTION', 'ANNOUNCEMENT', 'SECURITY', 'FINANCIAL', 'TEAM', 'ACTIVITY'])
      .withMessage('无效的通知分类'),
    body('type')
      .optional()
      .isIn(['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER', 'PROMOTION', 'ANNOUNCEMENT', 'ALERT'])
      .withMessage('无效的通知类型'),
    body('title')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('通知标题长度必须在1-200字符之间'),
    body('content')
      .optional()
      .isLength({ min: 1, max: 2000 })
      .withMessage('通知内容长度必须在1-2000字符之间'),
    body('channels')
      .optional()
      .isArray()
      .withMessage('通知渠道必须是数组'),
    body('priority')
      .optional()
      .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .withMessage('无效的通知优先级'),
    body('scheduledAt')
      .optional()
      .isISO8601()
      .withMessage('定时发送时间格式不正确'),
    body('relatedType')
      .optional()
      .isLength({ max: 50 })
      .withMessage('关联业务类型长度不能超过50字符'),
    body('relatedId')
      .optional()
      .isUUID(4)
      .withMessage('关联业务ID格式不正确'),
    body('variables')
      .optional()
      .isObject()
      .withMessage('模板变量必须是对象')
  ],

  // 创建通知模板验证
  createNotificationTemplate: [
    body('code')
      .notEmpty()
      .withMessage('模板代码不能为空')
      .isLength({ min: 2, max: 50 })
      .withMessage('模板代码长度必须在2-50字符之间')
      .matches(/^[A-Z0-9_]+$/)
      .withMessage('模板代码只能包含大写字母、数字和下划线'),
    body('name')
      .notEmpty()
      .withMessage('模板名称不能为空')
      .isLength({ min: 2, max: 100 })
      .withMessage('模板名称长度必须在2-100字符之间'),
    body('category')
      .notEmpty()
      .withMessage('通知分类不能为空')
      .isIn(['SYSTEM', 'ORDER', 'PAYMENT', 'LOGISTICS', 'USER_LEVEL', 'SHOP', 'INVENTORY', 'PROMOTION', 'ANNOUNCEMENT', 'SECURITY', 'FINANCIAL', 'TEAM', 'ACTIVITY'])
      .withMessage('无效的通知分类'),
    body('title')
      .notEmpty()
      .withMessage('模板标题不能为空')
      .isLength({ min: 1, max: 200 })
      .withMessage('模板标题长度必须在1-200字符之间'),
    body('content')
      .notEmpty()
      .withMessage('模板内容不能为空')
      .isLength({ min: 1, max: 2000 })
      .withMessage('模板内容长度必须在1-2000字符之间'),
    body('variables')
      .optional()
      .isObject()
      .withMessage('模板变量必须是对象'),
    body('enabledChannels')
      .optional()
      .isArray()
      .withMessage('启用的通知渠道必须是数组'),
    body('defaultChannels')
      .optional()
      .isArray()
      .withMessage('默认通知渠道必须是数组'),
    body('priority')
      .optional()
      .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .withMessage('无效的通知优先级'),
    body('dailyLimit')
      .optional()
      .isInt({ min: 0 })
      .withMessage('每日发送限制必须大于等于0'),
    body('rateLimit')
      .optional()
      .isInt({ min: 0 })
      .withMessage('频率限制必须大于等于0秒')
  ],

  // 更新通知模板验证
  updateNotificationTemplate: [
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('模板名称长度必须在2-100字符之间'),
    body('title')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('模板标题长度必须在1-200字符之间'),
    body('content')
      .optional()
      .isLength({ min: 1, max: 2000 })
      .withMessage('模板内容长度必须在1-2000字符之间'),
    body('variables')
      .optional()
      .isObject()
      .withMessage('模板变量必须是对象'),
    body('enabledChannels')
      .optional()
      .isArray()
      .withMessage('启用的通知渠道必须是数组'),
    body('defaultChannels')
      .optional()
      .isArray()
      .withMessage('默认通知渠道必须是数组'),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('状态必须是布尔值'),
    body('priority')
      .optional()
      .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .withMessage('无效的通知优先级'),
    body('dailyLimit')
      .optional()
      .isInt({ min: 0 })
      .withMessage('每日发送限制必须大于等于0'),
    body('rateLimit')
      .optional()
      .isInt({ min: 0 })
      .withMessage('频率限制必须大于等于0秒')
  ],

  // 更新通知偏好设置验证
  updateNotificationPreferences: [
    body('isEnabled')
      .optional()
      .isBoolean()
      .withMessage('通知开关必须是布尔值'),
    body('quietHoursStart')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('免打扰开始时间格式不正确，应为HH:mm'),
    body('quietHoursEnd')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('免打扰结束时间格式不正确，应为HH:mm'),
    body('channelPreferences')
      .optional()
      .isObject()
      .withMessage('渠道偏好设置必须是对象'),
    body('categorySettings')
      .optional()
      .isObject()
      .withMessage('分类设置必须是对象')
  ],

  // 获取通知列表验证
  getNotifications: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是大于0的整数'),
    query('perPage')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须是1-100之间的整数'),
    query('category')
      .optional()
      .isIn(['SYSTEM', 'ORDER', 'PAYMENT', 'LOGISTICS', 'USER_LEVEL', 'SHOP', 'INVENTORY', 'PROMOTION', 'ANNOUNCEMENT', 'SECURITY', 'FINANCIAL', 'TEAM', 'ACTIVITY'])
      .withMessage('无效的通知分类'),
    query('type')
      .optional()
      .isIn(['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'REMINDER', 'PROMOTION', 'ANNOUNCEMENT', 'ALERT'])
      .withMessage('无效的通知类型'),
    query('status')
      .optional()
      .isIn(['PENDING', 'SENDING', 'SENT', 'PARTIAL_SUCCESS', 'FAILED', 'COMPLETED', 'CANCELLED', 'RETRYING'])
      .withMessage('无效的通知状态'),
    query('priority')
      .optional()
      .isIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .withMessage('无效的通知优先级'),
    query('isRead')
      .optional()
      .isBoolean()
      .withMessage('已读状态必须是布尔值'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('开始日期格式不正确'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('结束日期格式不正确')
  ]
};

// 导出通知验证中间件
export const validateSendNotification = [
  ...notificationValidations.sendNotification,
  validate
];

export const validateCreateNotificationTemplate = [
  ...notificationValidations.createNotificationTemplate,
  validate
];

export const validateUpdateNotificationTemplate = [
  ...notificationValidations.updateNotificationTemplate,
  validate
];

export const validateUpdateNotificationPreferences = [
  ...notificationValidations.updateNotificationPreferences,
  validate
];

export const validateGetNotifications = [
  ...notificationValidations.getNotifications,
  validate
];