// 应用配置

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
