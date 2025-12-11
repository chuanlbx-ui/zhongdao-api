/**
 * 系统配置定义
 * 定义所有系统配置项的元数据和验证规则
 */

import { z } from 'zod';
import { ConfigMetadata } from './config.manager';

// 应用配置
export const appConfigs: ConfigMetadata[] = [
  {
    key: 'app.name',
    description: '应用名称',
    defaultValue: '中道商城',
    category: 'app',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'string',
      required: true,
      min: 1,
      max: 50
    }
  },
  {
    key: 'app.version',
    description: '应用版本',
    defaultValue: '1.0.0',
    category: 'app',
    sensitive: false,
    readonly: true,
    requiresRestart: false,
    validation: {
      type: 'string',
      required: true,
      pattern: /^\d+\.\d+\.\d+$/
    }
  },
  {
    key: 'app.env',
    description: '运行环境',
    defaultValue: 'development',
    category: 'app',
    sensitive: false,
    readonly: true,
    requiresRestart: true,
    validation: {
      type: 'string',
      required: true,
      enum: ['development', 'test', 'production']
    }
  },
  {
    key: 'app.port',
    description: '服务端口',
    defaultValue: 3000,
    category: 'app',
    sensitive: false,
    readonly: false,
    requiresRestart: true,
    validation: {
      type: 'number',
      required: true,
      min: 1000,
      max: 65535
    }
  },
  {
    key: 'app.host',
    description: '服务主机',
    defaultValue: '0.0.0.0',
    category: 'app',
    sensitive: false,
    readonly: false,
    requiresRestart: true,
    validation: {
      type: 'string',
      required: true
    }
  }
];

// 数据库配置
export const databaseConfigs: ConfigMetadata[] = [
  {
    key: 'database.url',
    description: '数据库连接URL',
    defaultValue: '',
    category: 'database',
    sensitive: true,
    readonly: false,
    requiresRestart: true,
    validation: {
      type: 'string',
      required: true
    }
  },
  {
    key: 'database.poolSize',
    description: '数据库连接池大小',
    defaultValue: 10,
    category: 'database',
    sensitive: false,
    readonly: false,
    requiresRestart: true,
    validation: {
      type: 'number',
      required: true,
      min: 1,
      max: 100
    }
  },
  {
    key: 'database.timeout',
    description: '数据库查询超时时间（秒）',
    defaultValue: 30,
    category: 'database',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      required: true,
      min: 1,
      max: 300
    }
  }
];

// Redis配置
export const redisConfigs: ConfigMetadata[] = [
  {
    key: 'redis.enabled',
    description: '是否启用Redis',
    defaultValue: false,
    category: 'redis',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'boolean'
    }
  },
  {
    key: 'redis.url',
    description: 'Redis连接URL',
    defaultValue: 'redis://localhost:6379',
    category: 'redis',
    sensitive: false,
    readonly: false,
    requiresRestart: true,
    validation: {
      type: 'string'
    }
  },
  {
    key: 'redis.ttl',
    description: 'Redis缓存默认TTL（秒）',
    defaultValue: 3600,
    category: 'redis',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 1
    }
  }
];

// JWT配置
export const jwtConfigs: ConfigMetadata[] = [
  {
    key: 'jwt.secret',
    description: 'JWT签名密钥',
    defaultValue: '',
    category: 'jwt',
    sensitive: true,
    readonly: false,
    requiresRestart: true,
    validation: {
      type: 'string',
      required: true,
      min: 32
    }
  },
  {
    key: 'jwt.expiry',
    description: 'JWT过期时间（秒）',
    defaultValue: 86400,
    category: 'jwt',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      required: true,
      min: 300
    }
  },
  {
    key: 'jwt.refreshExpiry',
    description: '刷新令牌过期时间（秒）',
    defaultValue: 604800,
    category: 'jwt',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      required: true,
      min: 86400
    }
  }
];

// 支付配置
export const paymentConfigs: ConfigMetadata[] = [
  {
    key: 'payment.wechat.enabled',
    description: '是否启用微信支付',
    defaultValue: false,
    category: 'payment',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'boolean'
    }
  },
  {
    key: 'payment.wechat.appId',
    description: '微信支付AppID',
    defaultValue: '',
    category: 'payment',
    sensitive: true,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'string'
    }
  },
  {
    key: 'payment.wechat.mchId',
    description: '微信支付商户号',
    defaultValue: '',
    category: 'payment',
    sensitive: true,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'string'
    }
  },
  {
    key: 'payment.alipay.enabled',
    description: '是否启用支付宝支付',
    defaultValue: false,
    category: 'payment',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'boolean'
    }
  },
  {
    key: 'payment.alipay.appId',
    description: '支付宝AppID',
    defaultValue: '',
    category: 'payment',
    sensitive: true,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'string'
    }
  }
];

// 业务配置
export const businessConfigs: ConfigMetadata[] = [
  {
    key: 'business.commission.enabled',
    description: '是否启用佣金系统',
    defaultValue: true,
    category: 'business',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'boolean'
    }
  },
  {
    key: 'business.commission.minWithdrawAmount',
    description: '最低提现金额',
    defaultValue: 100,
    category: 'business',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 1
    }
  },
  {
    key: 'business.commission.withdrawalFeeRate',
    description: '提现手续费率',
    defaultValue: 0.006,
    category: 'business',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 0,
      max: 0.1
    }
  },
  {
    key: 'business.order.autoConfirmDays',
    description: '订单自动确认收货天数',
    defaultValue: 7,
    category: 'business',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 1,
      max: 30
    }
  },
  {
    key: 'business.order.refundDays',
    description: '退款申请期限（天）',
    defaultValue: 7,
    category: 'business',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 1,
      max: 30
    }
  }
];

// 安全配置
export const securityConfigs: ConfigMetadata[] = [
  {
    key: 'security.rateLimit.enabled',
    description: '是否启用速率限制',
    defaultValue: true,
    category: 'security',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'boolean'
    }
  },
  {
    key: 'security.rateLimit.windowMs',
    description: '速率限制时间窗口（毫秒）',
    defaultValue: 900000,
    category: 'security',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 1000
    }
  },
  {
    key: 'security.rateLimit.maxRequests',
    description: '时间窗口内最大请求数',
    defaultValue: 100,
    category: 'security',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 1
    }
  },
  {
    key: 'security.cors.enabled',
    description: '是否启用CORS',
    defaultValue: true,
    category: 'security',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'boolean'
    }
  },
  {
    key: 'security.cors.allowedOrigins',
    description: '允许的跨域来源',
    defaultValue: [],
    category: 'security',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'array'
    }
  }
];

// 日志配置
export const logConfigs: ConfigMetadata[] = [
  {
    key: 'log.level',
    description: '日志级别',
    defaultValue: 'info',
    category: 'log',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'string',
      enum: ['error', 'warn', 'info', 'debug']
    }
  },
  {
    key: 'log.maxFiles',
    description: '日志文件最大数量',
    defaultValue: 10,
    category: 'log',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 1,
      max: 100
    }
  },
  {
    key: 'log.maxSize',
    description: '单个日志文件最大大小（MB）',
    defaultValue: 10,
    category: 'log',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'number',
      min: 1,
      max: 1000
    }
  }
];

// 通知配置
export const notificationConfigs: ConfigMetadata[] = [
  {
    key: 'notification.sms.enabled',
    description: '是否启用短信通知',
    defaultValue: false,
    category: 'notification',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'boolean'
    }
  },
  {
    key: 'notification.sms.provider',
    description: '短信服务商',
    defaultValue: 'aliyun',
    category: 'notification',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'string',
      enum: ['aliyun', 'tencent', 'huawei']
    }
  },
  {
    key: 'notification.email.enabled',
    description: '是否启用邮件通知',
    defaultValue: false,
    category: 'notification',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'boolean'
    }
  },
  {
    key: 'notification.email.smtp.host',
    description: 'SMTP服务器地址',
    defaultValue: '',
    category: 'notification',
    sensitive: false,
    readonly: false,
    requiresRestart: false,
    validation: {
      type: 'string'
    }
  }
];

// 所有配置
export const allConfigs: ConfigMetadata[] = [
  ...appConfigs,
  ...databaseConfigs,
  ...redisConfigs,
  ...jwtConfigs,
  ...paymentConfigs,
  ...businessConfigs,
  ...securityConfigs,
  ...logConfigs,
  ...notificationConfigs
];