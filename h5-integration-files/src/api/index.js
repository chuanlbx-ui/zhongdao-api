import axios from 'axios';
import { Toast, Dialog } from 'vant';
import router from '@/router';

// 创建axios实例
const api = axios.create({
    baseURL: process.env.VUE_APP_API_BASE_URL || 'http://localhost:3000/api/v1',
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
            config.headers.Authorization = `Bearer ${token}`;
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
