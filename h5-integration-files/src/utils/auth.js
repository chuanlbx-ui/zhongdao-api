import { setStorage, getStorage, removeStorage } from './storage';

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
