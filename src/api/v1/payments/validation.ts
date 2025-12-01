/**
 * 支付API请求验证模式
 */

import Joi from 'joi';
import { PaymentChannel, PaymentMethod, PaymentStatus, RefundStatus } from '@prisma/client';
import { RefundReasonType } from '../../../modules/payment/types';

// 创建支付订单验证模式
export const createPaymentSchema = Joi.object({
  orderId: Joi.string().optional(),
  userId: Joi.string().required().messages({
    'string.empty': '用户ID不能为空',
    'any.required': '用户ID是必填项'
  }),
  amount: Joi.number().positive().required().messages({
    'number.positive': '支付金额必须大于0',
    'any.required': '支付金额是必填项'
  }),
  channel: Joi.string().valid(...ObjectValues(PaymentChannel)).required().messages({
    'any.only': '无效的支付渠道',
    'any.required': '支付渠道是必填项'
  }),
  method: Joi.string().valid(...ObjectValues(PaymentMethod)).required().messages({
    'any.only': '无效的支付方式',
    'any.required': '支付方式是必填项'
  }),
  tradeType: Joi.string().optional(),
  subject: Joi.string().required().max(255).messages({
    'string.empty': '支付主题不能为空',
    'string.max': '支付主题不能超过255个字符',
    'any.required': '支付主题是必填项'
  }),
  description: Joi.string().optional().max(500).messages({
    'string.max': '支付描述不能超过500个字符'
  }),
  notifyUrl: Joi.string().uri().optional().messages({
    'string.uri': '回调通知URL格式不正确'
  }),
  returnUrl: Joi.string().uri().optional().messages({
    'string.uri': '返回页面URL格式不正确'
  }),
  expireTime: Joi.number().integer().min(1).max(1440).optional().messages({
    'number.integer': '过期时间必须是整数',
    'number.min': '过期时间不能小于1分钟',
    'number.max': '过期时间不能超过24小时'
  }),
  extra: Joi.object().optional()
});

// 创建退款申请验证模式
export const createRefundSchema = Joi.object({
  paymentId: Joi.string().required().messages({
    'string.empty': '支付ID不能为空',
    'any.required': '支付ID是必填项'
  }),
  refundAmount: Joi.number().positive().required().messages({
    'number.positive': '退款金额必须大于0',
    'any.required': '退款金额是必填项'
  }),
  refundReason: Joi.string().optional().max(255).messages({
    'string.max': '退款原因不能超过255个字符'
  }),
  reasonType: Joi.string().valid(...ObjectValues(RefundReasonType)).optional().messages({
    'any.only': '无效的退款原因类型'
  }),
  extra: Joi.object().optional()
}).custom((value, helpers) => {
  // 自定义验证：检查退款金额不能超过支付金额
  // 这里需要查询数据库，暂时跳过复杂验证
  return value;
});

// 查询支付记录验证模式
export const queryPaymentSchema = Joi.object({
  paymentId: Joi.string().optional(),
  paymentNo: Joi.string().optional(),
  orderId: Joi.string().optional(),
  channelOrderId: Joi.string().optional(),
  userId: Joi.string().optional(),
  channel: Joi.string().valid(...ObjectValues(PaymentChannel)).optional().messages({
    'any.only': '无效的支付渠道'
  }),
  method: Joi.string().valid(...ObjectValues(PaymentMethod)).optional().messages({
    'any.only': '无效的支付方式'
  }),
  status: Joi.string().valid(...ObjectValues(PaymentStatus)).optional().messages({
    'any.only': '无效的支付状态'
  }),
  startDate: Joi.date().optional().messages({
    'date.base': '开始时间格式不正确'
  }),
  endDate: Joi.date().optional().messages({
    'date.base': '结束时间格式不正确'
  }),
  page: Joi.number().integer().min(1).optional().messages({
    'number.integer': '页码必须是整数',
    'number.min': '页码不能小于1'
  }),
  perPage: Joi.number().integer().min(1).max(100).optional().messages({
    'number.integer': '每页数量必须是整数',
    'number.min': '每页数量不能小于1',
    'number.max': '每页数量不能超过100'
  }),
  sortBy: Joi.string().optional().valid(
    'createdAt', 'updatedAt', 'amount', 'status', 'channel', 'method'
  ).messages({
    'any.only': '无效的排序字段'
  }),
  sortOrder: Joi.string().valid('asc', 'desc').optional().messages({
    'any.only': '排序方向只能是asc或desc'
  })
}).custom((value, helpers) => {
  // 验证时间范围
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    return helpers.error('custom.startDateAfterEndDate');
  }
  return value;
}).messages({
  'custom.startDateAfterEndDate': '开始时间不能晚于结束时间'
});

// 对账请求验证模式
export const reconciliationSchema = Joi.object({
  reconcileDate: Joi.date().required().messages({
    'date.base': '对账日期格式不正确',
    'any.required': '对账日期是必填项'
  }),
  channel: Joi.string().valid(...ObjectValues(PaymentChannel)).required().messages({
    'any.only': '无效的支付渠道',
    'any.required': '支付渠道是必填项'
  }),
  type: Joi.string().valid('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM').optional().messages({
    'any.only': '无效的对账类型'
  }),
  autoFix: Joi.boolean().optional().default(false),
  emailReport: Joi.boolean().optional().default(false)
});

// 统计查询验证模式
export const statisticsSchema = Joi.object({
  startDate: Joi.date().required().messages({
    'date.base': '开始时间格式不正确',
    'any.required': '开始时间是必填项'
  }),
  endDate: Joi.date().required().messages({
    'date.base': '结束时间格式不正确',
    'any.required': '结束时间是必填项'
  }),
  userId: Joi.string().optional(),
  channel: Joi.string().valid(...ObjectValues(PaymentChannel)).optional().messages({
    'any.only': '无效的支付渠道'
  }),
  method: Joi.string().valid(...ObjectValues(PaymentMethod)).optional().messages({
    'any.only': '无效的支付方式'
  }),
  status: Joi.string().valid(...ObjectValues(PaymentStatus)).optional().messages({
    'any.only': '无效的支付状态'
  }),
  groupBy: Joi.string().valid('day', 'week', 'month', 'channel', 'method', 'status').optional().default('day').messages({
    'any.only': '无效的分组方式'
  })
}).custom((value, helpers) => {
  // 验证时间范围不能超过90天
  if (value.startDate && value.endDate) {
    const diffTime = Math.abs(value.endDate.getTime() - value.startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 90) {
      return helpers.error('custom.dateRangeTooLong');
    }
  }
  return value;
}).messages({
  'custom.dateRangeTooLong': '查询时间范围不能超过90天'
});

// 辅助函数：获取枚举的所有值
function ObjectValues(obj: any): string[] {
  return Object.values(obj);
}

// 导出所有验证模式
// 注：在上面的export const已经打算毫性地导出了所有模式