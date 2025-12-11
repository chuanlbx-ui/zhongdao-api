/**
 * 中道商城 API 错误处理工具
 * 提供统一的错误处理、错误码映射和用户友好的错误提示
 */

// 错误码映射表
const ERROR_CODE_MAP = {
  // 认证相关
  'TOKEN_EXPIRED': {
    message: '登录已过期，请重新登录',
    action: 'RE_LOGIN',
    level: 'warning'
  },
  'INVALID_TOKEN': {
    message: '登录信息无效，请重新登录',
    action: 'RE_LOGIN',
    level: 'warning'
  },
  'TOKEN_MISSING': {
    message: '请先登录',
    action: 'RE_LOGIN',
    level: 'info'
  },
  'WECHAT_AUTH_FAILED': {
    message: '微信授权失败，请重试',
    action: 'RETRY',
    level: 'error'
  },

  // 权限相关
  'INSUFFICIENT_PERMISSIONS': {
    message: '您的权限不足，无法执行此操作',
    action: 'CONTACT_ADMIN',
    level: 'warning'
  },
  'ACCOUNT_SUSPENDED': {
    message: '账户已被冻结，请联系管理员',
    action: 'CONTACT_ADMIN',
    level: 'error'
  },
  'LEVEL_NOT_ENOUGH': {
    message: '您的等级不足，请升级后再试',
    action: 'UPGRADE',
    level: 'info'
  },

  // 业务逻辑相关
  'INSUFFICIENT_BALANCE': {
    message: '通券余额不足',
    action: 'RECHARGE',
    level: 'warning'
  },
  'INSUFFICIENT_STOCK': {
    message: '商品库存不足',
    action: 'NONE',
    level: 'warning'
  },
  'ORDER_NOT_FOUND': {
    message: '订单不存在',
    action: 'NONE',
    level: 'error'
  },
  'ORDER_STATUS_INVALID': {
    message: '当前订单状态不允许此操作',
    action: 'NONE',
    level: 'warning'
  },
  'USER_NOT_FOUND': {
    message: '用户不存在',
    action: 'NONE',
    level: 'error'
  },
  'SHOP_NOT_EXIST': {
    message: '店铺不存在或未开通',
    action: 'OPEN_SHOP',
    level: 'info'
  },

  // 参数验证相关
  'INVALID_PARAMS': {
    message: '请求参数错误',
    action: 'CHECK_INPUT',
    level: 'warning'
  },
  'REQUIRED_FIELD_MISSING': {
    message: '缺少必填字段',
    action: 'CHECK_INPUT',
    level: 'warning'
  },
  'INVALID_FORMAT': {
    message: '数据格式不正确',
    action: 'CHECK_INPUT',
    level: 'warning'
  },

  // 业务限制相关
  'DAILY_LIMIT_EXCEEDED': {
    message: '今日操作次数已达上限',
    action: 'TRY_TOMORROW',
    level: 'warning'
  },
  'TRANSFER_LIMIT_EXCEEDED': {
    message: '转账金额超过单笔限额',
    action: 'ADJUST_AMOUNT',
    level: 'warning'
  },
  'WITHDRAW_NOT_ALLOWED': {
    message: '当前不允许提现',
    action: 'CHECK_RULES',
    level: 'warning'
  },

  // 系统相关
  'SYSTEM_MAINTENANCE': {
    message: '系统维护中，请稍后再试',
    action: 'WAIT',
    level: 'info'
  },
  'SERVICE_UNAVAILABLE': {
    message: '服务暂时不可用',
    action: 'RETRY',
    level: 'error'
  }
};

// HTTP 状态码映射
const HTTP_STATUS_MAP = {
  400: {
    message: '请求参数错误',
    level: 'warning'
  },
  401: {
    message: '未授权，请重新登录',
    level: 'warning',
    action: 'RE_LOGIN'
  },
  403: {
    message: '拒绝访问',
    level: 'error',
    action: 'CONTACT_ADMIN'
  },
  404: {
    message: '请求的资源不存在',
    level: 'error'
  },
  405: {
    message: '请求方法不允许',
    level: 'error'
  },
  408: {
    message: '请求超时',
    level: 'warning',
    action: 'RETRY'
  },
  409: {
    message: '资源冲突',
    level: 'warning'
  },
  422: {
    message: '数据验证失败',
    level: 'warning',
    action: 'CHECK_INPUT'
  },
  429: {
    message: '请求过于频繁，请稍后再试',
    level: 'warning',
    action: 'WAIT'
  },
  500: {
    message: '服务器内部错误',
    level: 'error',
    action: 'CONTACT_ADMIN'
  },
  502: {
    message: '网关错误',
    level: 'error',
    action: 'RETRY'
  },
  503: {
    message: '服务暂时不可用',
    level: 'error',
    action: 'RETRY'
  },
  504: {
    message: '网关超时',
    level: 'error',
    action: 'RETRY'
  }
};

/**
 * 错误处理类
 */
class ErrorHandler {
  constructor() {
    this.errorListeners = new Map();
  }

  /**
   * 注册错误监听器
   * @param {string} errorCode - 错误码
   * @param {Function} handler - 处理函数
   */
  registerListener(errorCode, handler) {
    if (!this.errorListeners.has(errorCode)) {
      this.errorListeners.set(errorCode, []);
    }
    this.errorListeners.get(errorCode).push(handler);
  }

  /**
   * 移除错误监听器
   * @param {string} errorCode - 错误码
   * @param {Function} handler - 处理函数
   */
  removeListener(errorCode, handler) {
    if (this.errorListeners.has(errorCode)) {
      const handlers = this.errorListeners.get(errorCode);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @param {Object} options - 选项
   */
  handle(error, options = {}) {
    const {
      showMessage = true,
      logError = true,
      context = null
    } = options;

    // 构建错误信息
    const errorInfo = this.parseError(error);

    // 记录日志
    if (logError) {
      this.logError(errorInfo, context);
    }

    // 显示用户提示
    if (showMessage && errorInfo.userMessage) {
      this.showMessage(errorInfo);
    }

    // 执行注册的处理器
    this.executeListeners(errorInfo);

    // 执行默认动作
    this.executeDefaultAction(errorInfo);

    return errorInfo;
  }

  /**
   * 解析错误
   * @param {Error} error - 错误对象
   */
  parseError(error) {
    let errorCode = 'UNKNOWN_ERROR';
    let userMessage = '操作失败，请稍后重试';
    let level = 'error';
    let action = 'NONE';
    let details = null;

    // 从 API 响应中获取错误信息
    if (error.response) {
      const { status, data } = error.response;

      // 优先使用业务错误码
      if (data?.error?.code) {
        errorCode = data.error.code;
        const errorConfig = ERROR_CODE_MAP[errorCode];
        if (errorConfig) {
          userMessage = data.error.message || errorConfig.message;
          level = errorConfig.level;
          action = errorConfig.action;
        } else {
          userMessage = data.error.message || userMessage;
        }
        details = data.error.details || null;
      }
      // 使用 HTTP 状态码
      else {
        const statusConfig = HTTP_STATUS_MAP[status];
        if (statusConfig) {
          userMessage = data?.message || statusConfig.message;
          level = statusConfig.level;
          action = statusConfig.action || 'NONE';
        }
        errorCode = `HTTP_${status}`;
      }
    }
    // 网络错误
    else if (error.request) {
      errorCode = 'NETWORK_ERROR';
      userMessage = '网络连接异常，请检查网络';
      level = 'warning';
      action = 'RETRY';
    }
    // 其他错误
    else {
      userMessage = error.message || userMessage;
    }

    return {
      originalError: error,
      errorCode,
      userMessage,
      level,
      action,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 记录错误日志
   * @param {Object} errorInfo - 错误信息
   * @param {Object} context - 上下文
   */
  logError(errorInfo, context) {
    const logData = {
      errorCode: errorInfo.errorCode,
      message: errorInfo.userMessage,
      level: errorInfo.level,
      action: errorInfo.action,
      details: errorInfo.details,
      context: context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: errorInfo.timestamp
    };

    // 开发环境打印到控制台
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 API Error [${errorInfo.errorCode}]`);
      console.error('Error Info:', logData);
      console.error('Original Error:', errorInfo.originalError);
      console.groupEnd();
    }

    // 生产环境发送到错误监控服务
    if (process.env.NODE_ENV === 'production') {
      // 这里可以集成 Sentry 或其他错误监控服务
      // Sentry.captureException(errorInfo.originalError, {
      //   tags: { errorCode: errorInfo.errorCode },
      //   extra: logData
      // });
    }
  }

  /**
   * 显示错误消息
   * @param {Object} errorInfo - 错误信息
   */
  showMessage(errorInfo) {
    // 根据错误级别选择不同的展示方式
    switch (errorInfo.level) {
      case 'error':
        this.showErrorMessage(errorInfo);
        break;
      case 'warning':
        this.showWarningMessage(errorInfo);
        break;
      case 'info':
        this.showInfoMessage(errorInfo);
        break;
      default:
        this.showDefaultMessage(errorInfo);
    }
  }

  showErrorMessage(errorInfo) {
    // 使用 Ant Design 的 message 或 notification
    if (window.antd && window.antd.message) {
      window.antd.message.error(errorInfo.userMessage);
    } else if (window.antd && window.antd.notification) {
      window.antd.notification.error({
        message: '操作失败',
        description: errorInfo.userMessage,
        duration: 4.5
      });
    } else {
      alert(errorInfo.userMessage);
    }
  }

  showWarningMessage(errorInfo) {
    if (window.antd && window.antd.message) {
      window.antd.message.warning(errorInfo.userMessage);
    } else if (window.antd && window.antd.notification) {
      window.antd.notification.warning({
        message: '提示',
        description: errorInfo.userMessage,
        duration: 3
      });
    }
  }

  showInfoMessage(errorInfo) {
    if (window.antd && window.antd.message) {
      window.antd.message.info(errorInfo.userMessage);
    } else if (window.antd && window.antd.notification) {
      window.antd.notification.info({
        message: '提示',
        description: errorInfo.userMessage,
        duration: 3
      });
    }
  }

  showDefaultMessage(errorInfo) {
    console.warn(errorInfo.userMessage);
  }

  /**
   * 执行注册的监听器
   * @param {Object} errorInfo - 错误信息
   */
  executeListeners(errorInfo) {
    const handlers = this.errorListeners.get(errorInfo.errorCode) || [];
    const globalHandlers = this.errorListeners.get('*') || [];

    [...handlers, ...globalHandlers].forEach(handler => {
      try {
        handler(errorInfo);
      } catch (e) {
        console.error('Error handler execution failed:', e);
      }
    });
  }

  /**
   * 执行默认动作
   * @param {Object} errorInfo - 错误信息
   */
  executeDefaultAction(errorInfo) {
    switch (errorInfo.action) {
      case 'RE_LOGIN':
        this.handleReLogin();
        break;
      case 'UPGRADE':
        this.handleUpgrade();
        break;
      case 'RECHARGE':
        this.handleRecharge();
        break;
      case 'OPEN_SHOP':
        this.handleOpenShop();
        break;
      case 'CONTACT_ADMIN':
        this.handleContactAdmin();
        break;
      default:
        break;
    }
  }

  // 动作处理方法
  handleReLogin() {
    // 延迟跳转，让用户看到提示
    setTimeout(() => {
      // 清除登录信息
      localStorage.removeItem('zhongdao_token');
      sessionStorage.removeItem('zhongdao_token');

      // 跳转到登录页
      window.location.href = '/login';
    }, 1500);
  }

  handleUpgrade() {
    // 跳转到升级页面
    window.location.href = '/user/upgrade';
  }

  handleRecharge() {
    // 跳转到充值页面
    window.location.href = '/points/recharge';
  }

  handleOpenShop() {
    // 跳转到开通店铺页面
    window.location.href = '/shop/open';
  }

  handleContactAdmin() {
    // 显示联系方式
    if (window.antd && window.antd.Modal) {
      window.antd.Modal.info({
        title: '联系管理员',
        content: (
          <div>
            <p>如需帮助，请联系：</p>
            <p>客服电话：400-123-4567</p>
            <p>客服微信：zhongdao-service</p>
            <p>工作时间：周一至周日 9:00-21:00</p>
          </div>
        )
      });
    }
  }
}

// 创建全局错误处理器实例
export const errorHandler = new ErrorHandler();

/**
 * 高阶组件：为 API 调用添加错误处理
 * @param {Function} apiCall - API 调用函数
 * @param {Object} options - 错误处理选项
 */
export function withErrorHandling(apiCall, options = {}) {
  return async (...args) => {
    try {
      return await apiCall(...args);
    } catch (error) {
      const errorInfo = errorHandler.handle(error, options);

      // 可以选择抛出错误或返回错误信息
      if (options.throwOnError) {
        throw errorInfo;
      }

      return {
        success: false,
        error: errorInfo,
        data: null
      };
    }
  };
}

/**
 * React Hook：错误边界
 */
export function useErrorHandler() {
  const [error, setError] = useState(null);

  const handleError = useCallback((error) => {
    const errorInfo = errorHandler.handle(error);
    setError(errorInfo);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError
  };
}

/**
 * 错误边界组件
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    errorHandler.handle(error, {
      context: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-boundary">
          <h2>出错了</h2>
          <p>页面遇到了一些问题，请刷新重试</p>
          <button onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 注册全局错误处理器
export function setupGlobalErrorHandlers() {
  // 处理未捕获的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.handle(event.reason, {
      context: { unhandledRejection: true }
    });
  });

  // 处理未捕获的 JavaScript 错误
  window.onerror = (message, source, lineno, colno, error) => {
    errorHandler.handle(error, {
      context: { globalError: { message, source, lineno, colno } }
    });
  };
}

// 导出默认错误处理器
export default errorHandler;