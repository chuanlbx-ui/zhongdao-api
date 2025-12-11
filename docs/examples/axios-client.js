/**
 * 中道商城 API 客户端配置
 * 基于 Axios 的统一 HTTP 客户端
 *
 * 功能特性：
 * - 自动添加认证 Token
 * - 统一错误处理
 * - Token 自动刷新机制
 * - 请求/响应拦截
 * - 支持并发请求
 * - 请求重试机制
 */

import axios from 'axios';
import { message, notification } from 'antd';

// API 基础配置
const API_CONFIG = {
  baseURL: process.env.REACT_APP_API_BASE_URL || 'https://api.zhongdao-mall.com/api/v1',
  timeout: 10000,
  retry: 3,
  retryDelay: 1000
};

// 创建 Axios 实例
const apiClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// 请求队列管理（用于处理并发刷新 Token）
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 添加认证 Token
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 添加请求 ID 用于追踪
    config.headers['X-Request-ID'] = generateRequestId();

    // 添加客户端信息
    config.headers['X-Client-Version'] = process.env.REACT_APP_VERSION || '1.0.0';
    config.headers['X-Client-Platform'] = 'web';

    // 开发环境下打印请求信息
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 API Request:', {
        url: config.url,
        method: config.method,
        params: config.params,
        data: config.data
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    // 开发环境下打印响应信息
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data
      });
    }

    // 统一处理 API 响应格式
    if (response.data && typeof response.data === 'object') {
      // 成功响应
      if (response.data.success) {
        return response;
      }
      // 业务错误
      else {
        const error = new Error(response.data.message || '请求失败');
        error.code = response.data.error?.code || 'BUSINESS_ERROR';
        error.response = response;
        return Promise.reject(handleBusinessError(error));
      }
    }

    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 开发环境下打印错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ API Error:', {
        url: originalRequest?.url,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data
      });
    }

    // Token 过期处理
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 如果正在刷新 Token，将请求加入队列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getStoredRefreshToken();

      if (refreshToken) {
        try {
          // 刷新 Token
          const response = await axios.post(`${API_CONFIG.baseURL}/auth/refresh`, {}, {
            headers: {
              Authorization: `Bearer ${refreshToken}`
            }
          });

          const { token, refreshToken: newRefreshToken } = response.data.data;

          // 保存新 Token
          setStoredToken(token);
          setStoredRefreshToken(newRefreshToken);

          // 处理队列中的请求
          processQueue(null, token);

          // 重试原请求
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);

        } catch (refreshError) {
          // 刷新失败，清除 Token 并跳转登录
          clearStoredTokens();
          processQueue(refreshError, null);

          // 显示提示
          notification.error({
            message: '登录已过期',
            description: '请重新登录',
            duration: 3
          });

          // 跳转到登录页
          window.location.href = '/login';

          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // 没有刷新 Token，直接跳转登录
        clearStoredTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // 网络错误重试
    if (!error.response && originalRequest && !originalRequest._retryCount) {
      originalRequest._retryCount = 0;
    }

    if (shouldRetry(error) && originalRequest._retryCount < API_CONFIG.retry) {
      originalRequest._retryCount += 1;

      // 指数退避重试
      const delay = API_CONFIG.retryDelay * Math.pow(2, originalRequest._retryCount - 1);

      await new Promise(resolve => setTimeout(resolve, delay));

      return apiClient(originalRequest);
    }

    // 处理其他错误
    return Promise.reject(handleApiError(error));
  }
);

// 工具函数

// 生成请求 ID
function generateRequestId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 获取存储的 Token
function getStoredToken() {
  return localStorage.getItem('zhongdao_token') || sessionStorage.getItem('zhongdao_token');
}

// 获取存储的刷新 Token
function getStoredRefreshToken() {
  return localStorage.getItem('zhongdao_refresh_token') || sessionStorage.getItem('zhongdao_refresh_token');
}

// 存储 Token
function setStoredToken(token) {
  const storage = localStorage.getItem('rememberMe') ? localStorage : sessionStorage;
  storage.setItem('zhongdao_token', token);
}

// 存储刷新 Token
function setStoredRefreshToken(refreshToken) {
  const storage = localStorage.getItem('rememberMe') ? localStorage : sessionStorage;
  storage.setItem('zhongdao_refresh_token', refreshToken);
}

// 清除 Token
function clearStoredTokens() {
  localStorage.removeItem('zhongdao_token');
  localStorage.removeItem('zhongdao_refresh_token');
  sessionStorage.removeItem('zhongdao_token');
  sessionStorage.removeItem('zhongdao_refresh_token');
  localStorage.removeItem('rememberMe');
}

// 判断是否应该重试
function shouldRetry(error) {
  // 网络错误或超时
  if (!error.response) {
    return true;
  }

  // 5xx 服务器错误
  if (error.response.status >= 500 && error.response.status < 600) {
    return true;
  }

  // 429 请求过多
  if (error.response.status === 429) {
    return true;
  }

  return false;
}

// 处理业务错误
function handleBusinessError(error) {
  // 根据错误码显示不同的提示
  const errorCode = error.code;

  switch (errorCode) {
    case 'INSUFFICIENT_BALANCE':
      error.message = '通券余额不足';
      break;
    case 'INSUFFICIENT_PERMISSIONS':
      error.message = '权限不足，无法执行此操作';
      break;
    case 'USER_NOT_FOUND':
      error.message = '用户不存在';
      break;
    case 'INVALID_PARAMS':
      error.message = '请求参数错误';
      break;
    case 'RESOURCE_NOT_FOUND':
      error.message = '请求的资源不存在';
      break;
    case 'OPERATION_NOT_ALLOWED':
      error.message = '当前状态下不允许此操作';
      break;
    default:
      break;
  }

  // 显示错误提示
  message.error(error.message);

  return error;
}

// 处理 API 错误
function handleApiError(error) {
  let errorMessage = '请求失败，请稍后重试';

  if (error.response) {
    // 服务器返回的错误
    const status = error.response.status;

    switch (status) {
      case 400:
        errorMessage = '请求参数错误';
        break;
      case 401:
        errorMessage = '未授权，请重新登录';
        break;
      case 403:
        errorMessage = '拒绝访问';
        break;
      case 404:
        errorMessage = '请求的资源不存在';
        break;
      case 422:
        errorMessage = error.response.data?.message || '数据验证失败';
        break;
      case 429:
        errorMessage = '请求过于频繁，请稍后再试';
        break;
      case 500:
        errorMessage = '服务器内部错误';
        break;
      case 502:
        errorMessage = '网关错误';
        break;
      case 503:
        errorMessage = '服务暂时不可用';
        break;
      default:
        errorMessage = `请求失败 (${status})`;
    }
  } else if (error.request) {
    // 请求发出但没有收到响应
    errorMessage = '网络连接异常，请检查网络';
  } else {
    // 其他错误
    errorMessage = error.message || '未知错误';
  }

  // 显示错误提示
  if (error.code !== 'BUSINESS_ERROR') {
    message.error(errorMessage);
  }

  return error;
}

// API 方法封装

/**
 * 用户认证相关
 */
export const authAPI = {
  // 微信登录
  wechatLogin: (code, userInfo) => {
    return apiClient.post('/auth/wechat-login', { code, userInfo });
  },

  // 刷新 Token
  refreshToken: () => {
    return apiClient.post('/auth/refresh');
  },

  // 登出
  logout: () => {
    return apiClient.post('/auth/logout');
  },

  // 获取当前用户信息
  getCurrentUser: () => {
    return apiClient.get('/users/me');
  },

  // 绑定手机号
  bindPhone: (phone, smsCode) => {
    return apiClient.post('/auth/bind-phone', { phone, smsCode });
  }
};

/**
 * 用户相关
 */
export const userAPI = {
  // 获取用户信息
  getUserInfo: (userId) => {
    return apiClient.get(`/users/${userId}`);
  },

  // 更新用户信息
  updateUserInfo: (userData) => {
    return apiClient.put('/users/me', userData);
  },

  // 上传头像
  uploadAvatar: (formData) => {
    return apiClient.post('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // 获取用户等级信息
  getLevelInfo: () => {
    return apiClient.get('/users/level-info');
  },

  // 申请升级
  applyUpgrade: (targetLevel, reason) => {
    return apiClient.post('/users/apply-upgrade', { targetLevel, reason });
  }
};

/**
 * 团队相关
 */
export const teamAPI = {
  // 获取团队结构
  getTeamStructure: (params) => {
    return apiClient.get('/teams/structure', { params });
  },

  // 获取团队统计
  getTeamStats: (params) => {
    return apiClient.get('/teams/stats', { params });
  },

  // 获取直推列表
  getDirectReferrals: (params) => {
    return apiClient.get('/teams/direct-referrals', { params });
  }
};

/**
 * 商品相关
 */
export const productAPI = {
  // 获取商品列表
  getProducts: (params) => {
    return apiClient.get('/products', { params });
  },

  // 获取商品详情
  getProductDetail: (productId) => {
    return apiClient.get(`/products/${productId}`);
  },

  // 获取商品分类
  getCategories: () => {
    return apiClient.get('/products/categories');
  },

  // 搜索商品
  searchProducts: (keyword, params) => {
    return apiClient.get('/products', {
      params: { search: keyword, ...params }
    });
  }
};

/**
 * 订单相关
 */
export const orderAPI = {
  // 创建订单
  createOrder: (orderData) => {
    return apiClient.post('/orders', orderData);
  },

  // 获取订单列表
  getOrders: (params) => {
    return apiClient.get('/orders', { params });
  },

  // 获取订单详情
  getOrderDetail: (orderId) => {
    return apiClient.get(`/orders/${orderId}`);
  },

  // 取消订单
  cancelOrder: (orderId, reason) => {
    return apiClient.post(`/orders/${orderId}/cancel`, { reason });
  },

  // 确认收货
  confirmOrder: (orderId) => {
    return apiClient.post(`/orders/${orderId}/confirm`);
  }
};

/**
 * 通券相关
 */
export const pointsAPI = {
  // 获取通券余额
  getBalance: () => {
    return apiClient.get('/points/balance');
  },

  // 通券转账
  transfer: (toUserId, amount, note, password) => {
    return apiClient.post('/points/transfer', {
      toUserId,
      amount,
      note,
      password
    });
  },

  // 获取交易明细
  getTransactions: (params) => {
    return apiClient.get('/points/transactions', { params });
  },

  // 通券充值
  recharge: (amount, paymentMethod) => {
    return apiClient.post('/points/recharge', {
      amount,
      paymentMethod
    });
  }
};

/**
 * 店铺相关
 */
export const shopAPI = {
  // 获取我的店铺
  getMyShop: () => {
    return apiClient.get('/shops/my-shop');
  },

  // 开通云店
  openCloudShop: (shopData) => {
    return apiClient.post('/shops/open-cloud-shop', shopData);
  },

  // 申请梧桐店
  applyWutongShop: (applicationData) => {
    return apiClient.post('/shops/apply-wutong-shop', applicationData);
  },

  // 更新店铺信息
  updateShop: (shopData) => {
    return apiClient.put('/shops/update', shopData);
  },

  // 获取店铺统计数据
  getShopStatistics: (params) => {
    return apiClient.get('/shops/statistics', { params });
  }
};

/**
 * 佣金相关
 */
export const commissionAPI = {
  // 获取佣金统计
  getStatistics: (params) => {
    return apiClient.get('/commission/statistics', { params });
  },

  // 获取佣金明细
  getCommissionDetails: (params) => {
    return apiClient.get('/commission/details', { params });
  },

  // 申请提现
  withdraw: (amount, withdrawMethod, withdrawInfo) => {
    return apiClient.post('/commission/withdraw', {
      amount,
      withdrawMethod,
      withdrawInfo
    });
  },

  // 获取提现记录
  getWithdrawals: (params) => {
    return apiClient.get('/commission/withdrawals', { params });
  }
};

/**
 * 通用请求方法
 */
export const request = {
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
  put: (url, data, config) => apiClient.put(url, data, config),
  delete: (url, config) => apiClient.delete(url, config),
  patch: (url, data, config) => apiClient.patch(url, data, config)
};

// 导出默认实例
export default apiClient;

// 导出所有 API
export const api = {
  auth: authAPI,
  user: userAPI,
  team: teamAPI,
  product: productAPI,
  order: orderAPI,
  points: pointsAPI,
  shop: shopAPI,
  commission: commissionAPI,
  request
};