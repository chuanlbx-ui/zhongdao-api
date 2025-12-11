// 请求工具类

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
