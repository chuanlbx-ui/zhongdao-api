# H5应用对接文件使用说明

## 文件说明

### 1. API文件
- `src/api/index.js` - Axios实例和拦截器配置
- `src/api/auth.js` - 认证相关API
- `src/api/user.js` - 用户相关API
- `src/api/product.js` - 商品相关API
- `src/api/order.js` - 订单相关API
- `src/api/points.js` - 积分相关API

### 2. 工具文件
- `src/utils/request.js` - 请求工具函数
- `src/utils/storage.js` - 本地存储工具
- `src/utils/auth.js` - 认证工具函数

### 3. 配置文件
- `.env.local` - 环境变量配置
- `src/config/index.js` - 应用配置

### 4. 状态管理
- `src/store/index.js` - Vuex Store
- `src/store/modules/user.js` - 用户状态模块

### 5. 路由
- `src/router/index.js` - Vue Router配置

## 使用步骤

1. 复制文件到H5项目
   ```bash
   cp -r h5-integration-files/* D:/wwwroot/zhongdao-H5/src/
   cp h5-integration-files/.env.local D:/wwwroot/zhongdao-H5/
   ```

2. 安装依赖（如果还没有）
   ```bash
   npm install vant axios vuex vue-router
   ```

3. 在main.js中引入
   ```javascript
   import Vant from 'vant';
   import 'vant/lib/index.css';
   import store from './store';
   import router from './router';

   Vue.use(Vant);
   ```

4. 配置环境变量
   编辑 `.env.local` 文件，配置微信AppID等信息

5. 测试API连接
   确保后端服务运行在 http://localhost:3000

## 注意事项

1. 确保后端CORS配置允许前端域名
2. 微信支付需要配置正式的域名和AppID
3. 生产环境请使用HTTPS协议
4. 建议根据实际需求调整API响应处理逻辑

## 快速测试

创建一个测试页面验证API连接：

```vue
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
```
