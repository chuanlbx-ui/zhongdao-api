/**
 * 统一错误处理工具类
 * 提供网络错误重试、降级方案和用户友好的错误提示
 */

export interface ErrorType {
  NETWORK: 'network';
  TIMEOUT: 'timeout';
  AUTH: 'auth';
  VALIDATION: 'validation';
  SERVER: 'server';
  BUSINESS: 'business';
  UNKNOWN: 'unknown';
}

export interface ErrorConfig {
  type: keyof ErrorType;
  message: string;
  userMessage: string;
  canRetry: boolean;
  maxRetries?: number;
  fallbackData?: any;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  shouldRetry?: (error: any) => boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    shouldRetry: (error) => {
      // 只对网络错误和服务器错误进行重试
      return error.code === 'NETWORK_ERROR' ||
             error.code === 'TIMEOUT' ||
             (error.status >= 500 && error.status < 600);
    }
  };

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 错误分类和用户友好消息映射
   */
  private getErrorConfig(error: any): ErrorConfig {
    if (!error) {
      return {
        type: 'UNKNOWN',
        message: '未知错误',
        userMessage: '系统出现未知错误，请稍后重试',
        canRetry: true
      };
    }

    // 网络错误
    if (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED') {
      return {
        type: 'NETWORK',
        message: error.message || '网络连接失败',
        userMessage: '网络连接失败，请检查网络后重试',
        canRetry: true,
        maxRetries: 3
      };
    }

    // 超时错误
    if (error.code === 'TIMEOUT' || error.code === 'ECONNABORTED') {
      return {
        type: 'TIMEOUT',
        message: error.message || '请求超时',
        userMessage: '请求超时，请稍后重试',
        canRetry: true,
        maxRetries: 2
      };
    }

    // 认证错误
    if (error.status === 401 || error.code === 'UNAUTHORIZED') {
      return {
        type: 'AUTH',
        message: '认证失败',
        userMessage: '登录已过期，请重新登录',
        canRetry: false,
        fallbackData: null
      };
    }

    // 权限错误
    if (error.status === 403 || error.code === 'FORBIDDEN') {
      return {
        type: 'AUTH',
        message: '权限不足',
        userMessage: '您没有权限执行此操作',
        canRetry: false,
        fallbackData: null
      };
    }

    // 验证错误
    if (error.status === 400 || error.code === 'VALIDATION_ERROR') {
      return {
        type: 'VALIDATION',
        message: error.message || '数据验证失败',
        userMessage: '提交的数据有误，请检查后重试',
        canRetry: false,
        fallbackData: null
      };
    }

    // 资源未找到
    if (error.status === 404 || error.code === 'NOT_FOUND') {
      return {
        type: 'BUSINESS',
        message: '请求的资源不存在',
        userMessage: '您访问的内容不存在',
        canRetry: false,
        fallbackData: null
      };
    }

    // 服务器错误
    if (error.status >= 500 && error.status < 600) {
      return {
        type: 'SERVER',
        message: '服务器内部错误',
        userMessage: '服务暂时不可用，请稍后重试',
        canRetry: true,
        maxRetries: 2
      };
    }

    // 业务逻辑错误
    if (error.code && error.code.startsWith('BUSINESS_')) {
      return {
        type: 'BUSINESS',
        message: error.message || '业务逻辑错误',
        userMessage: this.formatBusinessError(error),
        canRetry: false,
        fallbackData: null
      };
    }

    // 未知错误
    return {
      type: 'UNKNOWN',
      message: error.message || '未知错误',
      userMessage: '系统繁忙，请稍后重试',
      canRetry: true,
      maxRetries: 1
    };
  }

  /**
   * 格式化业务错误消息
   */
  private formatBusinessError(error: any): string {
    const errorMessages: Record<string, string> = {
      'USER_NOT_FOUND': '用户不存在',
      'INSUFFICIENT_POINTS': '通券余额不足',
      'INVALID_REFERRAL_CODE': '推荐码无效',
      'DUPLICATE_ORDER': '订单已存在',
      'PRODUCT_OUT_OF_STOCK': '商品库存不足',
      'PAYMENT_FAILED': '支付失败，请重试',
      'INVALID_OPERATION': '操作无效'
    };

    return errorMessages[error.code] || error.message || '操作失败，请重试';
  }

  /**
   * 带重试机制的API调用
   */
  public async withRetry<T>(
    apiCall: () => Promise<T>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: any;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;

        // 如果不应该重试或者已经达到最大重试次数，直接抛出错误
        if (attempt === config.maxRetries || !config.shouldRetry?.(error)) {
          throw error;
        }

        // 计算延迟时间（指数退避）
        const delay = config.retryDelay * Math.pow(config.backoffMultiplier, attempt);

        console.warn(`API调用失败，${delay}ms后进行第${attempt + 1}次重试`, {
          error: error.message,
          attempt: attempt + 1,
          maxRetries: config.maxRetries
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 带降级方案的API调用
   */
  public async withFallback<T>(
    apiCall: () => Promise<T>,
    fallbackData: T | (() => T),
    options?: {
      silent?: boolean;
      customMessage?: string;
    }
  ): Promise<T> {
    try {
      return await apiCall();
    } catch (error) {
      const errorConfig = this.getErrorConfig(error);

      if (!options?.silent) {
        console.warn('API调用失败，使用降级方案', {
          error: error.message,
          fallbackProvided: true
        });

        // 这里可以添加错误提示逻辑
        this.showErrorNotification(errorConfig, options?.customMessage);
      }

      // 返回降级数据
      if (typeof fallbackData === 'function') {
        return (fallbackData as () => T)();
      }
      return fallbackData;
    }
  }

  /**
   * 结合重试和降级的API调用
   */
  public async withRetryAndFallback<T>(
    apiCall: () => Promise<T>,
    fallbackData: T | (() => T),
    retryConfig?: Partial<RetryConfig>,
    options?: {
      silent?: boolean;
      customMessage?: string;
    }
  ): Promise<T> {
    try {
      return await this.withRetry(apiCall, retryConfig);
    } catch (error) {
      return await this.withFallback(
        () => Promise.reject(error),
        fallbackData,
        options
      );
    }
  }

  /**
   * 处理API响应错误
   */
  public handleApiError(error: any): ErrorConfig {
    const errorConfig = this.getErrorConfig(error);

    // 记录错误日志
    console.error('API错误:', {
      type: errorConfig.type,
      message: errorConfig.message,
      canRetry: errorConfig.canRetry,
      originalError: error
    });

    // 显示用户友好的错误提示
    this.showErrorNotification(errorConfig);

    return errorConfig;
  }

  /**
   * 显示错误通知
   */
  private showErrorNotification(errorConfig: ErrorConfig, customMessage?: string): void {
    // 这里可以集成实际的通知系统
    // 比如 toast、notification、alert 等

    const message = customMessage || errorConfig.userMessage;

    // 控制台输出（开发环境）
    if (process.env.NODE_ENV === 'development') {
// [DEBUG REMOVED]       console.log(`🚨 [${errorConfig.type.toUpperCase()}] ${message}`);
    }

    // 在实际项目中，这里应该调用UI组件显示错误
    // 例如：
    // notification.error({
    //   message: message,
    //   duration: errorConfig.canRetry ? 4 : 6
    // });
  }

  /**
   * 通用降级数据生成器
   */
  public static getFallbackData(type: string, params?: any): any {
    const fallbackDataMap: Record<string, any> = {
      // 用户相关
      'user/profile': {
        id: 'unknown',
        nickname: '游客用户',
        avatar: '/default-avatar.png',
        level: 'NORMAL'
      },

      // 商品相关
      'products/list': {
        items: [],
        pagination: {
          page: 1,
          perPage: 10,
          total: 0,
          totalPages: 0
        }
      },

      // 订单相关
      'orders/list': {
        items: [],
        pagination: {
          page: 1,
          perPage: 10,
          total: 0,
          totalPages: 0
        }
      },

      // 统计相关
      'statistics/dashboard': {
        totalUsers: 0,
        totalOrders: 0,
        totalSales: 0,
        activeShops: 0
      },

      // 通券相关
      'points/balance': {
        balance: 0,
        frozen: 0
      },

      // 通用空列表
      'empty/list': {
        items: [],
        total: 0,
        pagination: {
          page: 1,
          perPage: 10,
          totalPages: 0
        }
      }
    };

    return fallbackDataMap[type] || fallbackDataMap['empty/list'];
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 批量API调用错误处理
   */
  public async handleBatchErrors<T>(
    apiCalls: Array<() => Promise<T>>,
    options?: {
      continueOnError?: boolean;
      returnPartial?: boolean;
    }
  ): Promise<{ results: T[]; errors: any[] }> {
    const results: T[] = [];
    const errors: any[] = [];

    for (let i = 0; i < apiCalls.length; i++) {
      try {
        const result = await apiCalls[i]();
        results.push(result);
      } catch (error) {
        errors.push({
          index: i,
          error: this.handleApiError(error)
        });

        if (!options?.continueOnError) {
          break;
        }
      }
    }

    return { results, errors };
  }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance();

// 导出常用工具函数
export const withRetry = <T>(apiCall: () => Promise<T>, config?: Partial<RetryConfig>) =>
  errorHandler.withRetry(apiCall, config);

export const withFallback = <T>(apiCall: () => Promise<T>, fallbackData: T | (() => T), options?: {
  silent?: boolean;
  customMessage?: string;
}) => errorHandler.withFallback(apiCall, fallbackData, options);

export const withRetryAndFallback = <T>(
  apiCall: () => Promise<T>,
  fallbackData: T | (() => T),
  retryConfig?: Partial<RetryConfig>,
  options?: {
    silent?: boolean;
    customMessage?: string;
  }
) => errorHandler.withRetryAndFallback(apiCall, fallbackData, retryConfig, options);

export const handleApiError = (error: any) => errorHandler.handleApiError(error);

export default errorHandler;