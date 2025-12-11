import { get, post } from './index';

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
