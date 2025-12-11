#!/usr/bin/env node

// H5应用快速对接脚本

const fs = require('fs');
const path = require('path');

// 配置
const config = {
    h5Path: 'D:/wwwroot/zhongdao-H5',
    apiBaseURL: 'http://localhost:3000/api/v1',
    outputDir: './h5-integration-files'
};

// 需要创建的文件
const files = {
    // API相关
    'src/api/index.js': generateApiIndexFile(),
    'src/api/auth.js': generateAuthApiFile(),
    'src/api/user.js': generateUserApiFile(),
    'src/api/product.js': generateProductApiFile(),
    'src/api/order.js': generateOrderApiFile(),
    'src/api/points.js': generatePointsApiFile(),

    // 工具类
    'src/utils/request.js': generateRequestUtil(),
    'src/utils/storage.js': generateStorageUtil(),
    'src/utils/auth.js': generateAuthUtil(),

    // 配置文件
    '.env.local': generateEnvFile(),
    'src/config/index.js': generateConfigFile(),

    // 状态管理
    'src/store/index.js': generateStoreFile(),
    'src/store/modules/user.js': generateUserStoreModule(),

    // 路由
    'src/router/index.js': generateRouterFile()
};

// 生成API索引文件
function generateApiIndexFile() {
    return `import axios from 'axios';
import { Toast, Dialog } from 'vant';
import router from '@/router';

// 创建axios实例
const api = axios.create({
    baseURL: process.env.VUE_APP_API_BASE_URL || '${config.apiBaseURL}',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 请求拦截器
api.interceptors.request.use(
    config => {
        // 显示加载中
        if (config.showLoading !== false) {
            Toast.loading({
                message: '加载中...',
                forbidClick: true,
                duration: 0
            });
        }

        // 添加Token
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = \`Bearer \${token}\`;
        }

        // 添加请求ID
        config.headers['X-Request-ID'] = generateRequestId();

        return config;
    },
    error => {
        Toast.clear();
        return Promise.reject(error);
    }
);

// 响应拦截器
api.interceptors.response.use(
    response => {
        Toast.clear();

        const { code, message, data } = response.data;

        if (code === 200) {
            return data;
        } else {
            Toast.fail(message || '请求失败');
            return Promise.reject(new Error(message));
        }
    },
    error => {
        Toast.clear();

        if (error.response) {
            const { status, data } = error.response;

            switch (status) {
                case 401:
                    Dialog.confirm({
                        title: '提示',
                        message: '登录已过期，请重新登录',
                        confirmButtonText: '重新登录'
                    }).then(() => {
                        // 清除登录信息
                        localStorage.clear();
                        router.push('/login');
                    });
                    break;
                case 403:
                    Toast.fail('权限不足');
                    break;
                case 404:
                    Toast.fail('请求的资源不存在');
                    break;
                case 500:
                    Toast.fail('服务器错误，请稍后重试');
                    break;
                default:
                    Toast.fail(data?.message || '请求失败');
            }
        } else if (error.code === 'ECONNABORTED') {
            Toast.fail('请求超时');
        } else {
            Toast.fail('网络错误');
        }

        return Promise.reject(error);
    }
);

// 生成请求ID
function generateRequestId() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// 导出请求方法
export const get = (url, params, config = {}) => {
    return api.get(url, { params, ...config });
};

export const post = (url, data, config = {}) => {
    return api.post(url, data, config);
};

export const put = (url, data, config = {}) => {
    return api.put(url, data, config);
};

export const del = (url, config = {}) => {
    return api.delete(url, config);
};

// 上传文件
export const upload = (url, file, config = {}) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post(url, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        },
        ...config
    });
};

export default api;
`;
}

// 生成认证API
function generateAuthApiFile() {
    return `import { get, post } from './index';

// 用户登录
export const login = (data) => {
    return post('/auth/login', data);
};

// 微信登录
export const wechatLogin = (code) => {
    return post('/auth/wechat-login', { code });
};

// 获取当前用户信息
export const getCurrentUser = () => {
    return get('/auth/me');
};

// 退出登录
export const logout = () => {
    return post('/auth/logout');
};

// 刷新Token
export const refreshToken = () => {
    return post('/auth/refresh');
};
`;
}

// 生成用户API
function generateUserApiFile() {
    return `import { get, post, put, upload } from './index';

// 获取用户资料
export const getUserProfile = () => {
    return get('/users/profile');
};

// 更新用户资料
export const updateUserProfile = (data) => {
    return put('/users/profile', data);
};

// 上传头像
export const uploadAvatar = (file) => {
    return upload('/users/avatar', file);
};

// 获取用户等级信息
export const getUserLevel = () => {
    return get('/users/level');
};

// 获取团队信息
export const getUserTeam = () => {
    return get('/users/team');
};
`;
}

// 生成商品API
function generateProductApiFile() {
    return `import { get, post } from './index';

// 获取商品列表
export const getProducts = (params) => {
    return get('/products', params);
};

// 获取商品详情
export const getProductDetail = (id) => {
    return get(\`/products/\${id}\`);
};

// 获取商品分类
export const getCategories = () => {
    return get('/products/categories');
};

// 获取商品标签
export const getTags = () => {
    return get('/products/tags');
};

// 搜索商品
export const searchProducts = (params) => {
    return get('/products/search', params);
};
`;
}

// 生成订单API
function generateOrderApiFile() {
    return `import { get, post, put } from './index';

// 获取订单列表
export const getOrders = (params) => {
    return get('/orders', params);
};

// 创建订单
export const createOrder = (data) => {
    return post('/orders', data);
};

// 获取订单详情
export const getOrderDetail = (id) => {
    return get(\`/orders/\${id}\`);
};

// 取消订单
export const cancelOrder = (id) => {
    return put(\`/orders/\${id}/cancel\`);
};

// 确认收货
export const confirmOrder = (id) => {
    return put(\`/orders/\${id}/confirm\`);
};
`;
}

// 生成积分API
function generatePointsApiFile() {
    return `import { get, post } from './index';

// 获取积分余额
export const getPointsBalance = () => {
    return get('/points/balance');
};

// 获取积分统计
export const getPointsStatistics = () => {
    return get('/points/statistics');
};

// 获取积分交易记录
export const getPointsTransactions = (params) => {
    return get('/points/transactions', params);
};

// 积分转账
export const transferPoints = (data) => {
    return post('/points/transfer', data);
};

// 积分充值
export const rechargePoints = (data) => {
    return post('/points/recharge', data);
};
`;
}

// 生成请求工具
function generateRequestUtil() {
    return `// 请求工具类

// 检查网络状态
export const checkNetwork = () => {
    return navigator.onLine;
};

// 监听网络变化
export const onNetworkChange = (callback) => {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
};

// 防抖函数
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// 节流函数
export const throttle = (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};
`;
}

// 生成存储工具
function generateStorageUtil() {
    return `// 本地存储工具

const prefix = 'zhongdao_';

// 设置存储
export const setStorage = (key, value) => {
    try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
    } catch (e) {
        console.error('存储失败', e);
    }
};

// 获取存储
export const getStorage = (key, defaultValue = null) => {
    try {
        const item = localStorage.getItem(prefix + key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('读取失败', e);
        return defaultValue;
    }
};

// 删除存储
export const removeStorage = (key) => {
    try {
        localStorage.removeItem(prefix + key);
    } catch (e) {
        console.error('删除失败', e);
    }
};

// 清空存储
export const clearStorage = () => {
    try {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(prefix)) {
                localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.error('清空失败', e);
    }
};
`;
}

// 生成认证工具
function generateAuthUtil() {
    return `import { setStorage, getStorage, removeStorage } from './storage';

// Token相关
export const getToken = () => {
    return getStorage('token');
};

export const setToken = (token) => {
    setStorage('token', token);
};

export const removeToken = () => {
    removeStorage('token');
};

// 用户信息
export const getUserInfo = () => {
    return getStorage('userInfo');
};

export const setUserInfo = (userInfo) => {
    setStorage('userInfo', userInfo);
};

export const removeUserInfo = () => {
    removeStorage('userInfo');
};

// 检查登录状态
export const isLoggedIn = () => {
    return !!getToken();
};

// 退出登录
export const logout = () => {
    removeToken();
    removeUserInfo();
    // 可以添加其他清理逻辑
};
`;
}

// 生成环境变量文件
function generateEnvFile() {
    return `# API配置
VUE_APP_API_BASE_URL=${config.apiBaseURL}
VUE_APP_API_TIMEOUT=10000

# 微信配置
VUE_APP_WECHAT_APPID=your_wechat_appid

# 上传配置
VUE_APP_UPLOAD_URL=${config.apiBaseURL}/upload
VUE_APP_MAX_FILE_SIZE=10485760

# 环境标识
VUE_APP_ENV=development
`;
}

// 生成配置文件
function generateConfigFile() {
    return `// 应用配置

export default {
    // API配置
    api: {
        baseURL: process.env.VUE_APP_API_BASE_URL,
        timeout: process.env.VUE_APP_API_TIMEOUT
    },

    // 微信配置
    wechat: {
        appId: process.env.VUE_APP_WECHAT_APPID
    },

    // 支付配置
    payment: {
        wechat: true,
        alipay: true
    },

    // 分页配置
    pagination: {
        pageSize: 10,
        pageSizes: [10, 20, 50]
    },

    // 上传配置
    upload: {
        maxSize: process.env.VUE_APP_MAX_FILE_SIZE || 10485760,
        accept: 'image/*'
    }
};
`;
}

// 生成Store文件
function generateStoreFile() {
    return `import Vue from 'vue';
import Vuex from 'vuex';
import user from './modules/user';

Vue.use(Vuex);

export default new Vuex.Store({
    modules: {
        user
    },

    state: {
        loading: false,
        cart: []
    },

    mutations: {
        SET_LOADING(state, loading) {
            state.loading = loading;
        },

        ADD_TO_CART(state, item) {
            const existItem = state.cart.find(i => i.id === item.id);
            if (existItem) {
                existItem.quantity += item.quantity;
            } else {
                state.cart.push(item);
            }
        },

        REMOVE_FROM_CART(state, id) {
            state.cart = state.cart.filter(item => item.id !== id);
        },

        CLEAR_CART(state) {
            state.cart = [];
        }
    },

    getters: {
        cartCount: state => {
            return state.cart.reduce((count, item) => count + item.quantity, 0);
        },
        cartTotal: state => {
            return state.cart.reduce((total, item) => total + item.price * item.quantity, 0);
        }
    }
});
`;
}

// 生成用户Store模块
function generateUserStoreModule() {
    return `import { getUserInfo, setUserInfo, removeUserInfo } from '@/utils/auth';

const state = {
    userInfo: getUserInfo() || null,
    token: localStorage.getItem('token') || null
};

const mutations = {
    SET_USER_INFO(state, userInfo) {
        state.userInfo = userInfo;
        setUserInfo(userInfo);
    },

    SET_TOKEN(state, token) {
        state.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    },

    CLEAR_USER(state) {
        state.userInfo = null;
        state.token = null;
        removeUserInfo();
        localStorage.removeItem('token');
    }
};

const actions = {
    // 登录
    async login({ commit }, credentials) {
        // 这里调用登录API
        // const { token, user } = await login(credentials);
        // commit('SET_TOKEN', token);
        // commit('SET_USER_INFO', user);
    },

    // 退出登录
    logout({ commit }) {
        commit('CLEAR_USER');
    },

    // 更新用户信息
    updateUserInfo({ commit }, userInfo) {
        commit('SET_USER_INFO', userInfo);
    }
};

const getters = {
    isLoggedIn: state => !!state.token,
    userLevel: state => state.userInfo?.level || 'NORMAL',
    userRole: state => state.userInfo?.role || 'USER'
};

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
};
`;
}

// 生成路由文件
function generateRouterFile() {
    return `import Vue from 'vue';
import VueRouter from 'vue-router';
import { isLoggedIn } from '@/utils/auth';

Vue.use(VueRouter);

const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '首页' }
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login.vue'),
        meta: { title: '登录', guest: true }
    },
    {
        path: '/products',
        name: 'Products',
        component: () => import('@/views/Products.vue'),
        meta: { title: '商品列表' }
    },
    {
        path: '/product/:id',
        name: 'ProductDetail',
        component: () => import('@/views/ProductDetail.vue'),
        meta: { title: '商品详情' }
    },
    {
        path: '/orders',
        name: 'Orders',
        component: () => import('@/views/Orders.vue'),
        meta: { title: '我的订单', requiresAuth: true }
    },
    {
        path: '/profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
        meta: { title: '个人中心', requiresAuth: true }
    },
    {
        path: '/points',
        name: 'Points',
        component: () => import('@/views/Points.vue'),
        meta: { title: '我的积分', requiresAuth: true }
    }
];

const router = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    routes
});

// 路由守卫
router.beforeEach((to, from, next) => {
    // 设置页面标题
    if (to.meta.title) {
        document.title = to.meta.title + ' - 中道商城';
    }

    // 检查登录状态
    if (to.meta.requiresAuth && !isLoggedIn()) {
        next({
            path: '/login',
            query: { redirect: to.fullPath }
        });
    } else if (to.meta.guest && isLoggedIn()) {
        next('/');
    } else {
        next();
    }
});

export default router;
`;
}

// 主函数
async function createH5Integration() {
    console.log('🚀 创建H5应用对接文件...\n');

    // 创建输出目录
    if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, { recursive: true });
    }

    // 创建所有文件
    for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(config.outputDir, filePath);
        const dir = path.dirname(fullPath);

        // 创建目录
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 写入文件
        fs.writeFileSync(fullPath, content);
        console.log(`✅ 已创建: ${filePath}`);
    }

    // 创建使用说明
    const readme = `# H5应用对接文件使用说明

## 文件说明

### 1. API文件
- \`src/api/index.js\` - Axios实例和拦截器配置
- \`src/api/auth.js\` - 认证相关API
- \`src/api/user.js\` - 用户相关API
- \`src/api/product.js\` - 商品相关API
- \`src/api/order.js\` - 订单相关API
- \`src/api/points.js\` - 积分相关API

### 2. 工具文件
- \`src/utils/request.js\` - 请求工具函数
- \`src/utils/storage.js\` - 本地存储工具
- \`src/utils/auth.js\` - 认证工具函数

### 3. 配置文件
- \`.env.local\` - 环境变量配置
- \`src/config/index.js\` - 应用配置

### 4. 状态管理
- \`src/store/index.js\` - Vuex Store
- \`src/store/modules/user.js\` - 用户状态模块

### 5. 路由
- \`src/router/index.js\` - Vue Router配置

## 使用步骤

1. 复制文件到H5项目
   \`\`\`bash
   cp -r h5-integration-files/* D:/wwwroot/zhongdao-H5/src/
   cp h5-integration-files/.env.local D:/wwwroot/zhongdao-H5/
   \`\`\`

2. 安装依赖（如果还没有）
   \`\`\`bash
   npm install vant axios vuex vue-router
   \`\`\`

3. 在main.js中引入
   \`\`\`javascript
   import Vant from 'vant';
   import 'vant/lib/index.css';
   import store from './store';
   import router from './router';

   Vue.use(Vant);
   \`\`\`

4. 配置环境变量
   编辑 \`.env.local\` 文件，配置微信AppID等信息

5. 测试API连接
   确保后端服务运行在 http://localhost:3000

## 注意事项

1. 确保后端CORS配置允许前端域名
2. 微信支付需要配置正式的域名和AppID
3. 生产环境请使用HTTPS协议
4. 建议根据实际需求调整API响应处理逻辑

## 快速测试

创建一个测试页面验证API连接：

\`\`\`vue
<template>
    <div>
        <van-button @click="testApi">测试API</van-button>
    </div>
</template>

<script>
import { getCurrentUser } from '@/api/auth';

export default {
    methods: {
        async testApi() {
            try {
                const user = await getCurrentUser();
                console.log('API测试成功:', user);
            } catch (error) {
                console.error('API测试失败:', error);
            }
        }
    }
};
</script>
\`\`\`
`;

    fs.writeFileSync(path.join(config.outputDir, 'README.md'), readme);

    console.log('\n✨ 所有文件已创建完成！');
    console.log('\n📁 文件位置:', config.outputDir);
    console.log('\n📖 请查看 README.md 了解如何使用这些文件');
    console.log('\n🚀 下一步：');
    console.log('  1. 复制文件到H5项目');
    console.log('  2. 配置环境变量');
    console.log('  3. 安装依赖');
    console.log('  4. 测试API连接');
}

// 运行
if (require.main === module) {
    createH5Integration().catch(console.error);
}

module.exports = { createH5Integration };