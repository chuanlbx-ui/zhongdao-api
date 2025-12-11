// 本地存储工具

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
