import { get, post, put, upload } from './index';

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
