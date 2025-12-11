/**
 * 统一错误处理机制
 * 定义业务错误类型、错误码和错误处理中间件
 */

export enum ErrorCode {
  // 通用错误 (1000-1999)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  MAINTENANCE = 'MAINTENANCE',

  // 业务逻辑错误 (2000-2999)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  INVALID_ORDER_STATUS = 'INVALID_ORDER_STATUS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',

  // 用户相关错误 (3000-3999)
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  LEVEL_UPGRADE_FAILED = 'LEVEL_UPGRADE_FAILED',

  // 店铺相关错误 (4000-4999)
  SHOP_NOT_FOUND = 'SHOP_NOT_FOUND',
  SHOP_ALREADY_EXISTS = 'SHOP_ALREADY_EXISTS',
  SHOP_LEVEL_RESTRICTION = 'SHOP_LEVEL_RESTRICTION',

  // 商品相关错误 (5000-5999)
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
  PRODUCT_OUT_OF_STOCK = 'PRODUCT_OUT_OF_STOCK',

  // 订单相关错误 (6000-6999)
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  ORDER_EXPIRED = 'ORDER_EXPIRED',
  ORDER_CANNOT_BE_CANCELLED = 'ORDER_CANNOT_BE_CANCELLED',

  // 佣金相关错误 (7000-7999)
  COMMISSION_CALCULATION_FAILED = 'COMMISSION_CALCULATION_FAILED',
  WITHDRAWAL_AMOUNT_EXCEEDED = 'WITHDRAWAL_AMOUNT_EXCEEDED',
  WITHDRAWAL_NOT_ALLOWED = 'WITHDRAWAL_NOT_ALLOWED',

  // 外部服务错误 (8000-8999)
  WECHAT_SERVICE_ERROR = 'WECHAT_SERVICE_ERROR',
  PAYMENT_SERVICE_ERROR = 'PAYMENT_SERVICE_ERROR',
  SMS_SERVICE_ERROR = 'SMS_SERVICE_ERROR',
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR'
}

export interface ErrorDetails {
  field?: string;
  value?: any;
  reason?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly isOperational: boolean;
  public readonly requestId?: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: ErrorDetails,
    requestId?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
    this.isOperational = statusCode < 500;

    // 确保错误堆栈正确捕获
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      requestId: this.requestId,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    };
  }
}

// 便捷的错误创建函数
export class ErrorFactory {
  static internalError(message: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, details);
  }

  static validationError(message: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }

  static unauthorized(message: string = '未授权访问', details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401, details);
  }

  static forbidden(message: string = '禁止访问', details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403, details);
  }

  static notFound(resource: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.NOT_FOUND, `${resource}不存在`, 404, details);
  }

  static conflict(message: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.CONFLICT, message, 409, details);
  }

  static businessRuleViolation(message: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.BUSINESS_RULE_VIOLATION, message, 422, details);
  }

  static insufficientBalance(message: string = '余额不足', details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.INSUFFICIENT_BALANCE, message, 422, details);
  }

  static insufficientStock(message: string = '库存不足', details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.INSUFFICIENT_STOCK, message, 422, details);
  }

  static paymentFailed(message: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.PAYMENT_FAILED, message, 400, details);
  }

  static userNotFound(details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.USER_NOT_FOUND, '用户不存在', 404, details);
  }

  static userAlreadyExists(details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.USER_ALREADY_EXISTS, '用户已存在', 409, details);
  }

  static invalidCredentials(message: string = '用户名或密码错误', details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.INVALID_CREDENTIALS, message, 401, details);
  }

  static shopNotFound(details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.SHOP_NOT_FOUND, '店铺不存在', 404, details);
  }

  static productNotFound(details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.PRODUCT_NOT_FOUND, '商品不存在', 404, details);
  }

  static orderNotFound(details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.ORDER_NOT_FOUND, '订单不存在', 404, details);
  }

  static commissionCalculationFailed(message: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.COMMISSION_CALCULATION_FAILED, message, 500, details);
  }

  static withdrawalAmountExceeded(available: number, requested: number, details?: ErrorDetails): AppError {
    return new AppError(
      ErrorCode.WITHDRAWAL_AMOUNT_EXCEEDED,
      '提现金额超过可用金额',
      422,
      { available, requested, ...details }
    );
  }
}