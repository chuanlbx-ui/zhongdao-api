# 中道商城前后端集成指南

## 📖 目录

1. [项目概述](#项目概述)
2. [环境准备](#环境准备)
3. [认证系统](#认证系统)
4. [API客户端集成](#api客户端集成)
5. [状态管理](#状态管理)
6. [错误处理](#错误处理)
7. [支付集成](#支付集成)
8. [实时通信](#实时通信)
9. [性能优化](#性能优化)
10. [测试策略](#测试策略)
11. [部署指南](#部署指南)
12. [常见问题](#常见问题)

## 项目概述

### 技术栈
- **后端**: Node.js + TypeScript + Express + MySQL
- **前端**: React/Vue + TypeScript
- **数据库**: MySQL (Prisma ORM)
- **认证**: JWT + 微信小程序登录
- **支付**: 微信支付 + 支付宝

### 核心功能模块
- 用户系统（多级分销体系）
- 商城管理（商品、订单、支付）
- 团队管理（层级关系、佣金分配）
- 库存管理（多仓库系统）
- 积分系统（内部流通货币）

## 环境准备

### 1. 开发环境要求

```bash
# Node.js版本
node >= 16.0.0
npm >= 8.0.0

# 推荐使用yarn
npm install -g yarn
```

### 2. 项目初始化

```bash
# 克隆项目
git clone <repository-url>
cd zhongdao-mall

# 安装依赖
npm install

# 环境配置
cp .env.example .env.development
# 编辑 .env.development 配置数据库等信息

# 数据库初始化
npm run db:generate
npm run db:push
npm run db:seed

# 启动开发服务器
npm run dev
```

### 3. 前端项目配置

```bash
# 创建前端项目（以React为例）
npx create-react-app frontend --template typescript
cd frontend

# 安装必要依赖
npm install axios
npm install @reduxjs/toolkit react-redux
npm install @types/jest
```

## 认证系统

### JWT认证流程

#### 1. 获取JWT Token

```typescript
// API端点
POST /api/v1/auth/login
POST /api/v1/auth/wechat-login

// 请求示例
interface LoginRequest {
  username?: string;
  password?: string;
  wechatCode?: string; // 微信小程序登录凭证
}

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    refreshToken: string;
    user: {
      id: string;
      phone: string;
      level: 'NORMAL' | 'VIP' | 'STAR_1' | 'STAR_2' | 'STAR_3' | 'STAR_4' | 'STAR_5' | 'DIRECTOR';
      parentId?: string;
    };
  };
}
```

#### 2. Token管理

```typescript
// authStore.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  user: any | null;
  loading: boolean;
}

// 刷新Token
export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (refreshToken: string) => {
    const response = await axios.post('/api/v1/auth/refresh', {
      refreshToken
    });
    return response.data.data;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    isAuthenticated: false,
    token: localStorage.getItem('token'),
    refreshToken: localStorage.getItem('refreshToken'),
    user: null,
    loading: false
  } as AuthState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<LoginResponse['data']>) => {
      state.isAuthenticated = true;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;

      // 持久化
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.token = null;
      state.refreshToken = null;
      state.user = null;

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
  },
  extraReducers: (builder) => {
    builder.addCase(refreshToken.fulfilled, (state, action) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('refreshToken', action.payload.refreshToken);
    });
  }
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
```

### 微信小程序登录

```typescript
// 微信小程序登录
import Taro from '@tarojs/taro';

export const wechatLogin = async () => {
  try {
    // 1. 获取微信登录凭证
    const loginRes = await Taro.login();
    const code = loginRes.code;

    // 2. 获取用户信息（可选）
    const userInfoRes = await Taro.getUserProfile({
      desc: '用于完善用户资料'
    });

    // 3. 发送到后端
    const response = await axios.post('/api/v1/auth/wechat-login', {
      code,
      userInfo: userInfoRes.userInfo
    });

    // 4. 保存Token
    store.dispatch(loginSuccess(response.data.data));

    return response.data.data;
  } catch (error) {
    console.error('微信登录失败:', error);
    throw error;
  }
};
```

## API客户端集成

### Axios配置

```typescript
// apiClient.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import store from '../store';
import { logout, refreshToken } from '../store/authSlice';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        const token = store.getState().auth.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && originalRequest) {
          // Token过期，尝试刷新
          const refresh = store.getState().auth.refreshToken;

          if (refresh && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
              const result = await store.dispatch(refreshToken(refresh)).unwrap();
              originalRequest.headers.Authorization = `Bearer ${result.token}`;
              return this.client(originalRequest);
            } catch (refreshError) {
              store.dispatch(logout());
              window.location.href = '/login';
              return Promise.reject(refreshError);
            }
          } else {
            store.dispatch(logout());
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // GET请求
  get<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.get<T>(url, config);
  }

  // POST请求
  post<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.post<T>(url, data, config);
  }

  // PUT请求
  put<T>(url: string, data?: any, config?: AxiosRequestConfig) {
    return this.client.put<T>(url, data, config);
  }

  // DELETE请求
  delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.delete<T>(url, config);
  }

  // 文件上传
  upload<T>(url: string, file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', file);

    return this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      }
    });
  }
}

export default new ApiClient();
```

### API服务封装

```typescript
// services/userService.ts
import apiClient from '../apiClient';

export interface User {
  id: string;
  phone: string;
  level: string;
  avatar?: string;
  nickname?: string;
}

export const userService = {
  // 获取用户信息
  async getUserInfo(): Promise<User> {
    const response = await apiClient.get<{data: User}>('/auth/me');
    return response.data.data;
  },

  // 更新用户信息
  async updateUserInfo(data: Partial<User>): Promise<User> {
    const response = await apiClient.put<{data: User}>('/auth/me', data);
    return response.data.data;
  },

  // 获取团队信息
  async getTeamInfo() {
    const response = await apiClient.get('/teams/my-team');
    return response.data.data;
  },

  // 获取我的上级
  async getParentInfo() {
    const response = await apiClient.get('/users/parent');
    return response.data.data;
  },

  // 获取我的下级
  async getChildrenInfo() {
    const response = await apiClient.get('/users/children');
    return response.data.data;
  }
};
```

## 状态管理

### Redux Toolkit配置

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import userReducer from './userSlice';
import shopReducer from './shopSlice';
import cartReducer from './cartSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    shop: shopReducer,
    cart: cartReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    })
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 用户状态管理

```typescript
// store/userSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { userService } from '../services/userService';

interface UserState {
  info: any | null;
  team: any | null;
  children: any[];
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  info: null,
  team: null,
  children: [],
  loading: false,
  error: null
};

// 异步action
export const fetchUserInfo = createAsyncThunk(
  'user/fetchUserInfo',
  async () => {
    return await userService.getUserInfo();
  }
);

export const fetchTeamInfo = createAsyncThunk(
  'user/fetchTeamInfo',
  async () => {
    return await userService.getTeamInfo();
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserInfo.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserInfo.fulfilled, (state, action) => {
        state.loading = false;
        state.info = action.payload;
      })
      .addCase(fetchUserInfo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取用户信息失败';
      })
      .addCase(fetchTeamInfo.fulfilled, (state, action) => {
        state.team = action.payload;
      });
  }
});

export const { clearError } = userSlice.actions;
export default userSlice.reducer;
```

### 购物车状态管理

```typescript
// store/cartSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  specification?: string;
  image?: string;
}

interface CartState {
  items: CartItem[];
  totalAmount: number;
  totalPoints: number;
  loading: boolean;
}

const initialState: CartState = {
  items: [],
  totalAmount: 0,
  totalPoints: 0,
  loading: false
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<CartItem>) => {
      const existingItem = state.items.find(
        item => item.productId === action.payload.productId
      );

      if (existingItem) {
        existingItem.quantity += action.payload.quantity;
      } else {
        state.items.push(action.payload);
      }

      // 更新总价
      cartSlice.caseReducers.calculateTotal(state);
    },

    removeFromCart: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.productId !== action.payload);
      cartSlice.caseReducers.calculateTotal(state);
    },

    updateQuantity: (state, action: PayloadAction<{productId: string, quantity: number}>) => {
      const item = state.items.find(item => item.productId === action.payload.productId);
      if (item) {
        item.quantity = action.payload.quantity;
      }
      cartSlice.caseReducers.calculateTotal(state);
    },

    clearCart: (state) => {
      state.items = [];
      state.totalAmount = 0;
      state.totalPoints = 0;
    },

    calculateTotal: (state) => {
      state.totalAmount = state.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
      }, 0);

      // 积分计算（可根据业务规则调整）
      state.totalPoints = Math.floor(state.totalAmount * 0.1);
    }
  }
});

export const {
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart
} = cartSlice.actions;

export default cartSlice.reducer;
```

## 错误处理

### 错误处理中间件

```typescript
// utils/errorHandler.ts
import { AxiosError } from 'axios';
import { message } from 'antd'; // 或使用其他UI库的提示组件

interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export class ApiErrorHandler {
  static handle(error: any): void {
    if (error.response) {
      // 服务器响应错误
      const { status, data } = error.response;

      switch (status) {
        case 400:
          this.handleBadRequest(data);
          break;
        case 401:
          this.handleUnauthorized(data);
          break;
        case 403:
          this.handleForbidden(data);
          break;
        case 404:
          this.handleNotFound(data);
          break;
        case 500:
          this.handleServerError(data);
          break;
        default:
          this.handleUnknownError(data);
      }
    } else if (error.request) {
      // 网络错误
      message.error('网络连接失败，请检查网络设置');
    } else {
      // 其他错误
      message.error(error.message || '发生未知错误');
    }

    // 打印错误日志（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', error);
    }
  }

  private static handleBadRequest(data: any): void {
    const errors = data.errors;
    if (Array.isArray(errors)) {
      errors.forEach(err => {
        message.error(`${err.field}: ${err.message}`);
      });
    } else {
      message.error(data.message || '请求参数错误');
    }
  }

  private static handleUnauthorized(data: any): void {
    message.error('登录已过期，请重新登录');
    // 可以在这里触发退出登录
  }

  private static handleForbidden(data: any): void {
    message.error('权限不足，无法访问该资源');
  }

  private static handleNotFound(data: any): void {
    message.error('请求的资源不存在');
  }

  private static handleServerError(data: any): void {
    message.error('服务器错误，请稍后重试');
  }

  private static handleUnknownError(data: any): void {
    message.error(data.message || '发生未知错误');
  }
}

// 导出一个wrapper函数
export const withErrorHandling = async (fn: () => Promise<any>) => {
  try {
    return await fn();
  } catch (error) {
    ApiErrorHandler.handle(error);
    throw error; // 可以选择继续抛出错误
  }
};
```

### 使用示例

```typescript
// 在组件中使用错误处理
import React, { useState } from 'react';
import { withErrorHandling } from '../utils/errorHandler';
import { userService } from '../services/userService';

const UserProfile: React.FC = () => {
  const [user, setUser] = useState(null);

  const loadUserInfo = async () => {
    try {
      const userInfo = await withErrorHandling(() => userService.getUserInfo());
      setUser(userInfo);
    } catch (error) {
      // 错误已经在withErrorHandling中处理了
    }
  };

  return (
    <div>
      <button onClick={loadUserInfo}>加载用户信息</button>
      {user && <div>{user.nickname}</div>}
    </div>
  );
};
```

## 支付集成

### 微信支付集成

```typescript
// services/wechatPayService.ts
import apiClient from '../apiClient';

export interface WechatPayOrder {
  orderId: string;
  amount: number;
  description: string;
  openid?: string;
}

export interface WechatPayParams {
  appId: string;
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}

export const wechatPayService = {
  // 创建支付订单
  async createOrder(data: WechatPayOrder): Promise<WechatPayParams> {
    const response = await apiClient.post<{data: WechatPayParams}>('/payments/wechat/create-order', data);
    return response.data.data;
  },

  // 调起支付（小程序）
  async requestPayment(params: WechatPayParams): Promise<void> {
    // 微信小程序支付
    if (window.wx && window.wx.miniProgram) {
      window.wx.miniProgram.navigateTo({
        url: `/pages/payment/payment?params=${encodeURIComponent(JSON.stringify(params))}`
      });
    }
    // H5支付
    else {
      const response = await apiClient.post<{data: {h5Url: string}}>('/payments/wechat/h5-pay', params);
      window.location.href = response.data.data.h5Url;
    }
  },

  // 查询支付状态
  async queryOrderStatus(orderId: string) {
    const response = await apiClient.get(`/payments/wechat/query-order/${orderId}`);
    return response.data.data;
  },

  // 处理支付回调
  async handlePaymentCallback(data: any) {
    const response = await apiClient.post('/payments/wechat/callback', data);
    return response.data;
  }
};
```

### 支付宝集成

```typescript
// services/alipayService.ts
import apiClient from '../apiClient';

export interface AlipayOrder {
  orderId: string;
  amount: number;
  subject: string;
  body?: string;
  returnUrl?: string;
}

export const alipayService = {
  // 创建支付订单
  async createOrder(data: AlipayOrder): Promise<string> {
    const response = await apiClient.post<{data: {form: string}}>('/payments/alipay/create-order', data);
    return response.data.data.form;
  },

  // 跳转到支付页面
  async goToPay(data: AlipayOrder) {
    const form = await this.createOrder(data);
    // 创建隐藏表单并提交
    const div = document.createElement('div');
    div.innerHTML = form;
    document.body.appendChild(div);
    (div.querySelector('form') as HTMLFormElement).submit();
  },

  // 查询支付状态
  async queryOrderStatus(orderId: string) {
    const response = await apiClient.get(`/payments/alipay/query-order/${orderId}`);
    return response.data.data;
  }
};
```

### 支付组件示例

```typescript
// components/PaymentMethodSelector.tsx
import React, { useState } from 'react';
import { Radio, Button } from 'antd';
import { wechatPayService } from '../services/wechatPayService';
import { alipayService } from '../services/alipayService';

interface PaymentMethodSelectorProps {
  orderId: string;
  amount: number;
  onSuccess?: () => void;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  orderId,
  amount,
  onSuccess
}) => {
  const [method, setMethod] = useState<'wechat' | 'alipay'>('wechat');
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);

    try {
      if (method === 'wechat') {
        const params = await wechatPayService.createOrder({
          orderId,
          amount,
          description: '商品购买'
        });

        await wechatPayService.requestPayment(params);
      } else {
        await alipayService.goToPay({
          orderId,
          amount,
          subject: '商品购买'
        });
      }

      // 监听支付成功
      const checkPaymentStatus = setInterval(async () => {
        const status = await (method === 'wechat'
          ? wechatPayService.queryOrderStatus(orderId)
          : alipayService.queryOrderStatus(orderId)
        );

        if (status === 'SUCCESS') {
          clearInterval(checkPaymentStatus);
          onSuccess?.();
        }
      }, 3000);

    } catch (error) {
      console.error('支付失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-method-selector">
      <h3>选择支付方式</h3>
      <Radio.Group value={method} onChange={(e) => setMethod(e.target.value)}>
        <Radio value="wechat">微信支付</Radio>
        <Radio value="alipay">支付宝</Radio>
      </Radio.Group>

      <Button
        type="primary"
        size="large"
        block
        loading={loading}
        onClick={handlePayment}
        style={{ marginTop: 20 }}
      >
        立即支付 ¥{amount}
      </Button>
    </div>
  );
};

export default PaymentMethodSelector;
```

## 实时通信

### WebSocket集成

```typescript
// services/websocketService.ts
import store from '../store';

export type WebSocketMessage = {
  type: string;
  data: any;
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = store.getState().auth.token;

      this.ws = new WebSocket(`${this.url}?token=${token}`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.handleReconnect();
      };
    });
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'ORDER_UPDATE':
        // 处理订单更新
        store.dispatch({
          type: 'orders/updateOrder',
          payload: message.data
        });
        break;

      case 'POINTS_TRANSACTION':
        // 处理积分变动
        store.dispatch({
          type: 'points/updateBalance',
          payload: message.data
        });
        break;

      case 'TEAM_NOTIFICATION':
        // 处理团队通知
        store.dispatch({
          type: 'notifications/add',
          payload: message.data
        });
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Reconnecting attempt ${this.reconnectAttempts}`);
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  send(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export default new WebSocketService('ws://localhost:3000/ws');
```

### Server-Sent Events (SSE)

```typescript
// services/sseService.ts
export class SSEService {
  private eventSource: EventSource | null = null;

  connect(url: string, token: string) {
    this.eventSource = new EventSource(`${url}?token=${token}`);

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleEvent(data);
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
    };
  }

  private handleEvent(data: any) {
    // 处理实时事件
    switch (data.event) {
      case 'NEW_ORDER':
        // 新订单通知
        break;
      case 'INVENTORY_ALERT':
        // 库存预警
        break;
      case 'TEAM_PERFORMANCE_UPDATE':
        // 团队业绩更新
        break;
    }
  }

  disconnect() {
    this.eventSource?.close();
    this.eventSource = null;
  }
}

export default new SSEService();
```

## 性能优化

### 1. API缓存策略

```typescript
// utils/cache.ts
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ApiCache {
  private cache = new Map<string, CacheItem<any>>();

  set<T>(key: string, data: T, ttl: number = 300000): void { // 默认5分钟
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear(): void {
    this.cache.clear();
  }

  // 根据模式删除缓存
  invalidate(pattern: string | RegExp): void {
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export default new ApiCache();
```

### 2. API请求优化

```typescript
// utils/apiOptimization.ts
import apiClient from '../apiClient';
import cache from './cache';

export class OptimizedApi {
  // 带缓存的GET请求
  static async getCached<T>(url: string, ttl?: number): Promise<T> {
    const cacheKey = url;
    let data = cache.get<T>(cacheKey);

    if (!data) {
      const response = await apiClient.get<{data: T}>(url);
      data = response.data.data;
      cache.set(cacheKey, data, ttl);
    }

    return data;
  }

  // 请求防抖
  static debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number = 300
  ): (...args: Parameters<T>) => void {
    let timer: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 请求节流
  static throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number = 1000
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;

    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= limit) {
        lastCall = now;
        fn.apply(this, args);
      }
    };
  }

  // 并发请求控制
  static async concurrent<T>(
    requests: (() => Promise<T>)[],
    concurrency: number = 3
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const request of requests) {
      const promise = request().then(result => {
        results.push(result);
        executing.splice(executing.indexOf(promise), 1);
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }
}
```

### 3. 图片懒加载

```typescript
// hooks/useLazyLoad.ts
import { useEffect, useRef, useState } from 'react';

export const useLazyLoad = (src: string) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver;

    if (imgRef.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(imgRef.current);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [src]);

  return {
    imageSrc,
    imageLoaded,
    imgRef,
    setImageLoaded
  };
};

// 使用示例
const LazyImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const { imageSrc, imageLoaded, imgRef, setImageLoaded } = useLazyLoad(src);

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      style={{
        filter: imageLoaded ? 'none' : 'blur(10px)',
        transition: 'filter 0.3s'
      }}
      onLoad={() => setImageLoaded(true)}
    />
  );
};
```

## 测试策略

### 1. API测试

```typescript
// tests/api/user.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@vitest/runner';
import { setupTestApp, cleanupTestApp } from '../setup';
import { getTestUser, generateTestToken } from '../helpers/auth';

describe('User API', () => {
  let authToken: string;

  beforeAll(async () => {
    await setupTestApp();
    authToken = generateTestToken(getTestUser('normal'));
  });

  afterAll(async () => {
    await cleanupTestApp();
  });

  describe('GET /api/v1/auth/me', () => {
    it('应该返回当前用户信息', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('phone');
    });
  });

  describe('PUT /api/v1/auth/me', () => {
    it('应该更新用户信息', async () => {
      const updateData = {
        nickname: '测试用户更新',
        avatar: 'https://example.com/avatar.jpg'
      };

      const response = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.nickname).toBe(updateData.nickname);
      expect(response.body.data.avatar).toBe(updateData.avatar);
    });
  });
});
```

### 2. 组件测试

```typescript
// tests/components/UserProfile.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../store';
import UserProfile from '../../components/UserProfile';
import { userService } from '../../services/userService';

// Mock服务
vi.mock('../../services/userService');
const mockUserService = userService as any;

describe('UserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该显示用户信息', async () => {
    const mockUser = {
      id: '1',
      phone: '13800138000',
      nickname: '测试用户',
      level: 'VIP'
    };

    mockUserService.getUserInfo.mockResolvedValue(mockUser);

    render(
      <Provider store={store}>
        <UserProfile />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('测试用户')).toBeInTheDocument();
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });
  });

  it('应该处理更新用户信息', async () => {
    const mockUser = {
      id: '1',
      phone: '13800138000',
      nickname: '测试用户',
      level: 'VIP'
    };

    mockUserService.getUserInfo.mockResolvedValue(mockUser);
    mockUserService.updateUserInfo.mockResolvedValue({
      ...mockUser,
      nickname: '新昵称'
    });

    render(
      <Provider store={store}>
        <UserProfile />
      </Provider>
    );

    // 点击编辑按钮
    fireEvent.click(screen.getByRole('button', { name: '编辑' }));

    // 修改昵称
    const nicknameInput = screen.getByLabelText('昵称');
    fireEvent.change(nicknameInput, { target: { value: '新昵称' } });

    // 保存
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockUserService.updateUserInfo).toHaveBeenCalledWith({
        nickname: '新昵称'
      });
    });
  });
});
```

### 3. E2E测试

```typescript
// e2e/user-journey.e2e.ts
import { test, expect } from '@playwright/test';

test.describe('用户购物流程', () => {
  test('用户应该能够完成完整的购物流程', async ({ page }) => {
    // 1. 访问首页
    await page.goto('/');

    // 2. 登录
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="phone-input"]', '13800138000');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="submit-button"]');

    // 验证登录成功
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();

    // 3. 浏览商品
    await page.click('[data-testid="products-link"]');
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // 4. 添加商品到购物车
    await page.click('[data-testid="product-card"]:first-child');
    await page.click('[data-testid="add-to-cart-button"]');

    // 验证添加成功
    await expect(page.locator('[data-testid="cart-badge"]')).toHaveText('1');

    // 5. 查看购物车
    await page.click('[data-testid="cart-button"]');
    await expect(page.locator('[data-testid="cart-item"]')).toHaveCount(1);

    // 6. 结算
    await page.click('[data-testid="checkout-button"]');
    await page.fill('[data-testid="address-input"]', '测试地址');
    await page.click('[data-testid="submit-order-button"]');

    // 7. 选择支付方式
    await page.click('[data-testid="wechat-pay"]');
    await page.click('[data-testid="confirm-pay-button"]');

    // 验证订单创建成功
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible();
  });
});
```

## 部署指南

### 1. 环境配置

```bash
# .env.production
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://user:password@localhost:3306/zhongdao_mall_prod

# JWT配置
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# 微信配置
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret
WECHAT_MCH_ID=your-merchant-id
WECHAT_API_KEY=your-api-key

# 支付宝配置
ALIPAY_APP_ID=your-alipay-app-id
ALIPAY_PRIVATE_KEY=your-private-key
ALIPAY_PUBLIC_KEY=your-public-key

# Redis配置（可选）
REDIS_URL=redis://localhost:6379

# 文件上传
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# CORS配置
CORS_ORIGIN=https://yourdomain.com
```

### 2. 构建流程

```json
{
  "scripts": {
    "build": "tsc && npm run build:client",
    "build:client": "cd frontend && npm run build",
    "start": "node dist/index.js",
    "pm2:start": "pm2 start ecosystem.config.js",
    "docker:build": "docker build -t zhongdao-mall .",
    "docker:run": "docker run -p 3000:3000 zhongdao-mall"
  }
}
```

### 3. Docker配置

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# 安装依赖
RUN npm ci --only=production
RUN cd frontend && npm ci --only=production

# 复制源码
COPY . .

# 构建后端
RUN npm run build

# 构建前端
RUN npm run build:client

# 生产镜像
FROM node:18-alpine

WORKDIR /app

# 复制产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://root:password@db:3306/zhongdao_mall
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=password
      - MYSQL_DATABASE=zhongdao_mall
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  mysql_data:
```

### 4. Nginx配置

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log;

    # 基础配置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # 上游服务器
    upstream app {
        server app:3000;
    }

    # HTTP重定向到HTTPS
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS服务器
    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        # SSL证书
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # SSL配置
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # 安全头
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

        # 静态文件
        location /static/ {
            alias /app/public/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API请求
        location /api/ {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # WebSocket
        location /ws {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # 前端路由
        location / {
            proxy_pass http://app;
            try_files $uri $uri/ /index.html;
        }
    }
}
```

### 5. CI/CD配置

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Run E2E tests
        run: npm run test:e2e

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Build Docker image
        run: docker build -t zhongdao-mall:${{ github.sha }} .

      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push zhongdao-mall:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /app
            docker-compose down
            docker pull zhongdao-mall:${{ github.sha }}
            export TAG=${{ github.sha }}
            docker-compose up -d
            npm run db:migrate
```

## 常见问题

### 1. 认证问题

**Q: Token过期怎么办？**
A: 系统会自动尝试使用refreshToken刷新。如果refreshToken也过期，需要重新登录。

**Q: 微信小程序登录失败？**
A: 检查以下几点：
- 确认微信小程序AppID和AppSecret配置正确
- 确认服务器域名已配置到微信小程序后台
- 检查code是否有效（code有效期5分钟）

### 2. API请求问题

**Q: 请求被CORS拦截？**
A: 在开发环境中，配置代理或使用`proxy`配置。生产环境确保正确配置CORS。

**Q: 请求数据不更新？**
A: 检查缓存策略，可能需要清除缓存或更新缓存的key。

### 3. 支付问题

**Q: 微信支付回调失败？**
A: 检查以下几点：
- 确认回调URL是HTTPS且可公网访问
- 确认商户号和API密钥配置正确
- 查看支付日志确认具体的错误信息

### 4. 性能问题

**Q: 页面加载慢？**
A: 优化建议：
- 使用图片懒加载
- 开启Gzip压缩
- 使用CDN加速静态资源
- 实施API请求缓存

**Q: 内存泄漏？**
A: 检查以下几点：
- 及时清理定时器和事件监听器
- 避免在全局作用域存储大量数据
- 使用React.useEffect的清理函数

### 5. 调试技巧

```typescript
// 开启调试模式
if (process.env.NODE_ENV === 'development') {
  // 在控制台打印所有API请求
  apiClient.interceptors.request.use(config => {
    console.log('API Request:', config);
    return config;
  });

  // 打印所有API响应
  apiClient.interceptors.response.use(response => {
    console.log('API Response:', response);
    return response;
  });
}

// Redux状态调试
const store = configureStore({
  reducer: {
    // ...reducers
  },
  devTools: process.env.NODE_ENV !== 'production'
});
```

## 后续优化建议

1. **引入TypeScript的严格模式**，提高代码质量
2. **实施单元测试覆盖率**，确保关键业务逻辑的可靠性
3. **使用React.lazy()和Suspense**实现代码分割
4. **引入GraphQL**优化API查询
5. **实施微前端架构**，支持多团队独立开发
6. **建立监控和报警系统**，及时发现和解决问题

---

## 技术支持

如有问题，请联系：
- 文档维护：文档AI
- 用户系统问题：用户系统AI
- 性能优化：性能优化AI
- 测试相关问题：测试AI
- 架构设计问题：架构师AI

*最后更新时间：2025-12-10*