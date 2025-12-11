# 中道商城 H5移动端集成指南

## 📱 目录

1. [项目概述](#项目概述)
2. [环境搭建](#环境搭建)
3. [微信小程序集成](#微信小程序集成)
4. [移动端适配](#移动端适配)
5. [移动支付集成](#移动支付集成)
6. [移动端性能优化](#移动端性能优化)
7. [PWA支持](#pwa支持)
8. [移动端调试](#移动端调试)
9. [发布流程](#发布流程)
10. [常见问题](#常见问题)

## 项目概述

中道商城H5移动端是为微信小程序和移动浏览器设计的轻量级前端应用，提供完整的电商功能，包括商品浏览、购买、支付、团队管理等功能。

### 技术栈
- **框架**: Taro 3.x (支持多端开发)
- **UI库**: Taro UI / Vant Weapp
- **状态管理**: Redux Toolkit
- **请求库**: Taro.request / Axios
- **构建工具**: Webpack 5

### 前端应用位置
- **H5应用**: `D:/wwwroot/zhongdao-H5/`
- **管理系统**: `D:/wwwroot/zhongdao-admin/`

## 环境搭建

### 1. 环境准备

确保后端服务运行：
```bash
cd /d D:\wwwroot\zhongdao-mall
npm run dev
```

后端服务地址：`http://localhost:3000`

### 2. H5应用配置

在H5应用的 `.env` 文件中配置：

```env
# API配置
VUE_APP_API_BASE_URL=http://localhost:3000/api/v1
VUE_APP_API_TIMEOUT=10000

# 微信小程序配置
VUE_APP_WECHAT_APPID=your_wechat_appid
VUE_APP_WECHAT_REDIRECT=http://localhost:8080/auth/wechat/callback

# 上传配置
VUE_APP_UPLOAD_URL=http://localhost:3000/api/v1/upload
VUE_APP_MAX_FILE_SIZE=10485760  # 10MB

# 支付配置
VUE_APP_PAYMENT_WECHAT=true
VUE_APP_PAYMENT_ALIPAY=true
```

### 3. API请求封装

创建 `src/api/index.js`：

```javascript
import axios from 'axios';
import { Toast } from 'vant';

// 创建axios实例
const api = axios.create({
    baseURL: process.env.VUE_APP_API_BASE_URL,
    timeout: process.env.VUE_APP_API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 请求拦截器
api.interceptors.request.use(
    config => {
        // 添加Token
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // 添加请求ID
        config.headers['X-Request-ID'] = generateRequestId();

        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// 响应拦截器
api.interceptors.response.use(
    response => {
        const { code, message, data } = response.data;

        if (code === 200) {
            return data;
        } else {
            Toast.fail(message || '请求失败');
            return Promise.reject(new Error(message));
        }
    },
    error => {
        if (error.response) {
            const { status, data } = error.response;

            switch (status) {
                case 401:
                    Toast.fail('请先登录');
                    // 跳转到登录页
                    window.location.href = '/login';
                    break;
                case 403:
                    Toast.fail('权限不足');
                    break;
                case 404:
                    Toast.fail('请求的资源不存在');
                    break;
                case 500:
                    Toast.fail('服务器错误');
                    break;
                default:
                    Toast.fail(data.message || '请求失败');
            }
        } else {
            Toast.fail('网络错误');
        }

        return Promise.reject(error);
    }
);

// 生成请求ID
function generateRequestId() {
    return Math.random().toString(36).substring(2, 15);
}

export default api;
```

---

## 📝 API接口对接

### 1. 认证模块

创建 `src/api/auth.js`：

```javascript
import api from './index';

// 用户登录
export const login = (data) => {
    return api.post('/auth/login', data);
};

// 微信登录
export const wechatLogin = (code) => {
    return api.post('/auth/wechat-login', { code });
};

// 获取当前用户信息
export const getCurrentUser = () => {
    return api.get('/auth/me');
};

// 退出登录
export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    return Promise.resolve();
};

// 刷新Token
export const refreshToken = () => {
    return api.post('/auth/refresh');
};
```

### 2. 用户模块

创建 `src/api/user.js`：

```javascript
import api from './index';

// 获取用户资料
export const getUserProfile = () => {
    return api.get('/users/profile');
};

// 更新用户资料
export const updateUserProfile = (data) => {
    return api.put('/users/profile', data);
};

// 上传头像
export const uploadAvatar = (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
};
```

### 3. 商品模块

创建 `src/api/product.js`：

```javascript
import api from './index';

// 获取商品列表
export const getProducts = (params) => {
    return api.get('/products', { params });
};

// 获取商品详情
export const getProductDetail = (id) => {
    return api.get(`/products/${id}`);
};

// 获取商品分类
export const getCategories = () => {
    return api.get('/products/categories');
};

// 搜索商品
export const searchProducts = (keyword) => {
    return api.get('/products/search', { params: { keyword } });
};
```

### 4. 订单模块

创建 `src/api/order.js`：

```javascript
import api from './index';

// 获取订单列表
export const getOrders = (params) => {
    return api.get('/orders', { params });
};

// 创建订单
export const createOrder = (data) => {
    return api.post('/orders', data);
};

// 获取订单详情
export const getOrderDetail = (id) => {
    return api.get(`/orders/${id}`);
};

// 取消订单
export const cancelOrder = (id) => {
    return api.put(`/orders/${id}/cancel`);
};
```

### 5. 积分模块

创建 `src/api/points.js`：

```javascript
import api from './index';

// 获取积分余额
export const getPointsBalance = () => {
    return api.get('/points/balance');
};

// 获取积分交易记录
export const getPointsTransactions = (params) => {
    return api.get('/points/transactions', { params });
};

// 积分转账
export const transferPoints = (data) => {
    return api.post('/points/transfer', data);
};

// 积分充值
export const rechargePoints = (amount) => {
    return api.post('/points/recharge', { amount });
};
```

---

## 🔧 页面组件示例

### 1. 登录页面

创建 `src/views/Login.vue`：

```vue
<template>
    <div class="login-page">
        <van-form @submit="handleLogin">
            <van-field
                v-model="form.phone"
                type="tel"
                label="手机号"
                placeholder="请输入手机号"
                :rules="[{ required: true, message: '请输入手机号' }]"
            />
            <van-field
                v-model="form.password"
                type="password"
                label="密码"
                placeholder="请输入密码"
                :rules="[{ required: true, message: '请输入密码' }]"
            />
            <div class="login-btn">
                <van-button block type="primary" native-type="submit">
                    登录
                </van-button>
            </div>
        </van-form>

        <div class="wechat-login">
            <van-button block @click="handleWechatLogin">
                微信登录
            </van-button>
        </div>
    </div>
</template>

<script>
import { login, wechatLogin } from '@/api/auth';

export default {
    data() {
        return {
            form: {
                phone: '',
                password: ''
            }
        };
    },
    methods: {
        async handleLogin() {
            try {
                const { token, user } = await login(this.form);

                // 保存Token和用户信息
                localStorage.setItem('token', token);
                localStorage.setItem('userInfo', JSON.stringify(user));

                // 跳转到首页
                this.$router.push('/');

                this.$toast.success('登录成功');
            } catch (error) {
                this.$toast.fail(error.message);
            }
        },

        async handleWechatLogin() {
            // 调用微信登录
            try {
                const code = await this.getWechatCode();
                const { token, user } = await wechatLogin(code);

                localStorage.setItem('token', token);
                localStorage.setItem('userInfo', JSON.stringify(user));

                this.$router.push('/');
                this.$toast.success('登录成功');
            } catch (error) {
                this.$toast.fail('微信登录失败');
            }
        },

        getWechatCode() {
            // 实现微信授权获取code
            return new Promise((resolve) => {
                // 微信授权逻辑
                resolve('wechat_code_here');
            });
        }
    }
};
</script>
```

### 2. 商品列表页面

创建 `src/views/Products.vue`：

```vue
<template>
    <div class="products-page">
        <van-search
            v-model="keyword"
            placeholder="搜索商品"
            @search="handleSearch"
        />

        <van-tabs v-model="activeTab" @change="handleTabChange">
            <van-tab title="全部" name="all" />
            <van-tab
                v-for="cat in categories"
                :key="cat.id"
                :title="cat.name"
                :name="cat.id"
            />
        </van-tabs>

        <van-list
            v-model="loading"
            :finished="finished"
            finished-text="没有更多了"
            @load="onLoad"
        >
            <van-card
                v-for="item in products"
                :key="item.id"
                :price="item.price"
                :title="item.name"
                :desc="item.description"
                :thumb="item.images[0]"
                @click="goToDetail(item.id)"
            >
                <template #tags>
                    <van-tag type="danger" v-if="item.isHot">热卖</van-tag>
                    <van-tag type="primary" v-if="item.isNew">新品</van-tag>
                </template>
            </van-card>
        </van-list>
    </div>
</template>

<script>
import { getProducts, getCategories, searchProducts } from '@/api/product';

export default {
    data() {
        return {
            keyword: '',
            activeTab: 'all',
            loading: false,
            finished: false,
            page: 1,
            pageSize: 10,
            products: [],
            categories: []
        };
    },
    async created() {
        await this.loadCategories();
        this.onLoad();
    },
    methods: {
        async loadCategories() {
            try {
                this.categories = await getCategories();
            } catch (error) {
                console.error('加载分类失败', error);
            }
        },

        async onLoad() {
            try {
                const params = {
                    page: this.page,
                    limit: this.pageSize,
                    categoryId: this.activeTab === 'all' ? undefined : this.activeTab
                };

                const { list, total } = await getProducts(params);

                this.products.push(...list);
                this.page++;

                if (this.products.length >= total) {
                    this.finished = true;
                }
            } catch (error) {
                this.$toast.fail('加载商品失败');
            } finally {
                this.loading = false;
            }
        },

        async handleSearch() {
            if (!this.keyword) return;

            try {
                this.products = await searchProducts(this.keyword);
                this.finished = true;
            } catch (error) {
                this.$toast.fail('搜索失败');
            }
        },

        handleTabChange() {
            this.reset();
            this.onLoad();
        },

        reset() {
            this.products = [];
            this.page = 1;
            this.finished = false;
            this.loading = false;
        },

        goToDetail(id) {
            this.$router.push(`/products/${id}`);
        }
    }
};
</script>
```

---

## 🎨 样式配置

### 1. 全局样式

创建 `src/styles/global.css`：

```css
/* 全局变量 */
:root {
    --primary-color: #1989fa;
    --success-color: #07c160;
    --danger-color: #ee0a24;
    --warning-color: #ff976a;
    --text-color: #323233;
    --text-color-light: #969799;
    --background-color: #f7f8fa;
    --white: #ffffff;
}

/* 布局 */
.page {
    min-height: 100vh;
    background-color: var(--background-color);
}

.container {
    padding: 16px;
}

/* 卡片样式 */
.card {
    background: var(--white);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

/* 按钮样式 */
.btn-primary {
    background-color: var(--primary-color);
    color: var(--white);
    border: none;
    padding: 12px 24px;
    border-radius: 4px;
    font-size: 16px;
}

.btn-primary:active {
    opacity: 0.8;
}

/* 表单样式 */
.form-item {
    margin-bottom: 16px;
}

.form-label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-color);
    font-size: 14px;
}
```

### 2. 主题配置

在 `main.js` 中配置Vant主题：

```javascript
import { ConfigProvider } from 'vant';
import 'vant/lib/index.css';

// 自定义主题变量
ConfigProvider({
    themeVars: {
        '--primary-color': '#1989fa',
        '--success-color': '#07c160',
        '--danger-color': '#ee0a24'
    }
});
```

---

## 📱 微信小程序集成

### 1. 微信SDK引入

```html
<!-- 微信JS-SDK -->
<script src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"></script>
```

### 2. 微信配置

创建 `src/utils/wechat.js`：

```javascript
// 微信授权配置
export function initWechatConfig() {
    return api.get('/wechat/config').then(config => {
        wx.config({
            debug: process.env.NODE_ENV === 'development',
            appId: config.appId,
            timestamp: config.timestamp,
            nonceStr: config.nonceStr,
            signature: config.signature,
            jsApiList: [
                'updateAppMessageShareData',
                'updateTimelineShareData',
                'onMenuShareAppMessage',
                'onMenuShareTimeline'
            ]
        });
    });
}

// 微信分享
export function shareWechat(title, desc, link, imgUrl) {
    wx.ready(() => {
        wx.updateAppMessageShareData({
            title,
            desc,
            link,
            imgUrl,
            success: () => {
                console.log('分享成功');
            }
        });

        wx.updateTimelineShareData({
            title,
            link,
            imgUrl,
            success: () => {
                console.log('分享成功');
            }
        });
    });
}
```

---

## 💳 支付集成

### 1. 微信支付

创建 `src/utils/payment.js`：

```javascript
// 微信支付
export function wechatPay(orderInfo) {
    return new Promise((resolve, reject) => {
        wx.chooseWXPay({
            timestamp: orderInfo.timestamp,
            nonceStr: orderInfo.nonceStr,
            package: orderInfo.package,
            signType: orderInfo.signType,
            paySign: orderInfo.paySign,
            success: (res) => {
                resolve(res);
            },
            fail: (err) => {
                reject(err);
            }
        });
    });
}

// 支付宝支付（H5）
export function alipayPay(orderInfo) {
    // 跳转到支付宝支付页面
    window.location.href = orderInfo.payUrl;
}
```

### 2. 支付流程

```javascript
// 创建订单并发起支付
async function handlePay(product) {
    try {
        // 1. 创建订单
        const order = await createOrder({
            productId: product.id,
            quantity: 1
        });

        // 2. 创建支付
        const payment = await createPayment({
            orderId: order.id,
            method: 'wechat'
        });

        // 3. 发起支付
        if (payment.method === 'wechat') {
            await wechatPay(payment);
        } else if (payment.method === 'alipay') {
            alipayPay(payment);
        }

        // 4. 支付成功
        this.$toast.success('支付成功');
        this.$router.push('/orders');

    } catch (error) {
        this.$toast.fail('支付失败');
    }
}
```

---

## 📊 状态管理

### 1. Vuex Store

创建 `src/store/index.js`：

```javascript
import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
    state: {
        user: null,
        token: localStorage.getItem('token'),
        cart: [],
        categories: []
    },

    mutations: {
        SET_USER(state, user) {
            state.user = user;
            localStorage.setItem('userInfo', JSON.stringify(user));
        },

        SET_TOKEN(state, token) {
            state.token = token;
            localStorage.setItem('token', token);
        },

        CLEAR_USER(state) {
            state.user = null;
            state.token = null;
            localStorage.removeItem('token');
            localStorage.removeItem('userInfo');
        },

        ADD_TO_CART(state, item) {
            const index = state.cart.findIndex(i => i.id === item.id);
            if (index > -1) {
                state.cart[index].quantity++;
            } else {
                state.cart.push({ ...item, quantity: 1 });
            }
        }
    },

    actions: {
        async login({ commit }, credentials) {
            const { token, user } = await login(credentials);
            commit('SET_TOKEN', token);
            commit('SET_USER', user);
        },

        logout({ commit }) {
            commit('CLEAR_USER');
            this.$router.push('/login');
        }
    },

    getters: {
        isLoggedIn: state => !!state.token,
        cartCount: state => state.cart.reduce((sum, item) => sum + item.quantity, 0)
    }
});
```

---

## 🚨 错误处理

### 1. 全局错误处理

在 `main.js` 中：

```javascript
Vue.config.errorHandler = (err, vm, info) => {
    console.error('Vue Error:', err);
    console.error('Component:', vm);
    console.error('Info:', info);

    // 发送错误日志到服务器
    if (process.env.NODE_ENV === 'production') {
        api.post('/logs/error', {
            error: err.message,
            stack: err.stack,
            info,
            url: window.location.href
        });
    }
};
```

### 2. 网络错误处理

```javascript
// 处理网络断开
window.addEventListener('offline', () => {
    this.$toast('网络连接已断开');
});

window.addEventListener('online', () => {
    this.$toast.success('网络已恢复');
});
```

---

## 📈 性能优化

### 1. 路由懒加载

```javascript
const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('@/views/Home.vue')
    },
    {
        path: '/products',
        name: 'Products',
        component: () => import('@/views/Products.vue')
    }
];
```

### 2. 图片懒加载

```vue
<template>
    <img v-lazy="imageUrl" alt="商品图片">
</template>
```

### 3. 接口缓存

```javascript
// 使用localStorage缓存接口数据
export function cacheApi(key, apiCall, expire = 3600000) {
    const cached = localStorage.getItem(key);
    const time = localStorage.getItem(`${key}_time`);

    if (cached && time && Date.now() - time < expire) {
        return Promise.resolve(JSON.parse(cached));
    }

    return apiCall().then(data => {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(`${key}_time`, Date.now());
        return data;
    });
}
```

---

## 📝 测试

### 1. 单元测试

```javascript
// tests/unit/auth.spec.js
import { login } from '@/api/auth';

describe('Auth API', () => {
    it('should login with correct credentials', async () => {
        const result = await login({
            phone: '13800138000',
            password: 'password123'
        });

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('user');
    });
});
```

### 2. E2E测试

```javascript
// tests/e2e/login.spec.js
describe('Login Flow', () => {
    it('should login successfully', () => {
        cy.visit('/login');
        cy.get('[data-testid="phone-input"]').type('13800138000');
        cy.get('[data-testid="password-input"]').type('password123');
        cy.get('[data-testid="login-btn"]').click();
        cy.url().should('include', '/');
    });
});
```

---

## 📞 技术支持

### 常见问题

1. **跨域问题**
   - 后端配置CORS
   - 开发环境使用proxy

2. **Token过期**
   - 实现Token刷新机制
   - 使用拦截器自动处理

3. **微信支付失败**
   - 检查支付参数
   - 确认域名已配置

4. **图片上传失败**
   - 检查文件大小
   - 确认上传接口

### 调试技巧

1. 使用Chrome DevTools
2. 查看Network面板
3. 使用vConsole调试
4. 开启debug模式

---

**最后更新**: 2025年12月17日
**文档版本**: v1.0