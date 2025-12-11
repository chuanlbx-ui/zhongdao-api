# 中道商城 API 常见问题解决

## 🔍 问题分类

### 认证与授权问题

#### 1. Token 相关问题

**Q: Token 过期怎么办？**
- **现象**: 返回 401 错误，错误码 `TOKEN_EXPIRED`
- **原因**: Token 有效期为 2 小时，过期后需要刷新
- **解决方案**:
  ```javascript
  // Axios 自动刷新 Token
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        // 尝试刷新 Token
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const response = await api.post('/auth/refresh');
            const { token } = response.data.data;
            localStorage.setItem('token', token);
            // 重试原请求
            error.config.headers.Authorization = `Bearer ${token}`;
            return api.request(error.config);
          } catch (refreshError) {
            // 刷新失败，跳转登录
            window.location.href = '/login';
          }
        }
      }
      return Promise.reject(error);
    }
  );
  ```

**Q: 刷新 Token 失败？**
- **现象**: 刷新 Token 返回错误
- **原因**: 刷新 Token 也过期（7天有效期）
- **解决方案**: 清除本地存储，重新登录
  ```javascript
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  window.location.href = '/login';
  ```

**Q: 多个标签页登录冲突？**
- **现象**: 在一个标签页登录后，其他标签页状态不一致
- **解决方案**: 使用 Storage 事件同步
  ```javascript
  // 监听 storage 变化
  window.addEventListener('storage', (e) => {
    if (e.key === 'token') {
      if (!e.newValue) {
        // Token 被清除，跳转登录
        window.location.href = '/login';
      } else {
        // Token 更新，重新设置请求头
        api.defaults.headers.Authorization = `Bearer ${e.newValue}`;
      }
    }
  });
  ```

#### 2. 权限问题

**Q: 403 权限不足错误？**
- **现象**: 返回 403 错误，错误码 `INSUFFICIENT_PERMISSIONS`
- **原因**: 用户等级不足或未获得相应权限
- **解决方案**:
  1. 检查用户等级是否满足要求
  2. 申请相应权限
  3. 升级用户等级
  ```javascript
  // 权限检查
  function hasPermission(user, permission) {
    return user.permissions?.includes(permission) || user.role === 'ADMIN';
  }

  // 使用示例
  if (!hasPermission(user, 'SHOP_MANAGE')) {
    message.warning('您没有店铺管理权限');
    return;
  }
  ```

### 业务逻辑问题

#### 1. 用户等级与升级

**Q: 用户等级不更新？**
- **现象**: 达到升级条件但等级未改变
- **原因**: 系统每天凌晨自动检测，或手动申请
- **解决方案**:
  ```javascript
  // 申请升级
  async function applyUpgrade() {
    try {
      const response = await api.post('/users/apply-upgrade', {
        targetLevel: 'STAR_4',
        reason: '已满足升级条件'
      });
      message.success('升级申请已提交');
    } catch (error) {
      message.error(error.response?.data?.message);
    }
  }
  ```

**Q: 团队关系错误？**
- **现象**: 推荐关系显示不正确
- **原因**: teamPath 更新延迟或错误
- **解决方案**: 联系管理员手动修正

#### 2. 通券（积分）问题

**Q: 通券余额不足？**
- **现象**: 返回错误 `INSUFFICIENT_BALANCE`
- **解决方案**:
  1. 充值通券（仅限五星店长和董事）
  2. 发展团队获取佣金
  3. 向上级申请支援
  ```javascript
  // 检查余额
  const balance = await pointsApi.getBalance();
  if (balance.data.balance < amount) {
    Modal.confirm({
      title: '余额不足',
      content: '您的通券余额不足，是否前往充值？',
      onOk: () => {
        window.location.href = '/points/recharge';
      }
    });
  }
  ```

**Q: 转账失败？**
- **现象**: 转账接口返回错误
- **常见原因**:
  - 收款方不存在
  - 超出每日转账限额
  - 未设置交易密码
- **解决方案**:
  ```javascript
  // 转账前验证
  async function validateTransfer(toUserId, amount) {
    // 1. 验证收款方
    try {
      await userApi.getUserInfo(toUserId);
    } catch {
      throw new Error('收款方不存在');
    }

    // 2. 验证金额
    if (amount < 1 || amount > 10000) {
      throw new Error('转账金额必须在1-10000之间');
    }

    // 3. 验证限额
    const todayTransactions = await pointsApi.getTransactions({
      startDate: dayjs().format('YYYY-MM-DD'),
      type: 'TRANSFER'
    });

    if (todayTransactions.data.length >= 50) {
      throw new Error('今日转账次数已达上限');
    }
  }
  ```

#### 3. 订单问题

**Q: 订单创建失败？**
- **常见原因**:
  - 商品库存不足
  - 用户等级限制（某些商品需要特定等级）
  - 通券余额不足
- **解决方案**:
  ```javascript
  // 创建订单前检查
  async function validateOrder(product, quantity) {
    // 1. 检查库存
    if (product.stock < quantity) {
      throw new Error('库存不足');
    }

    // 2. 检查用户等级
    if (product.requiredLevel && user.level < product.requiredLevel) {
      throw new Error('您的等级不足以购买此商品');
    }

    // 3. 检查余额（通券支付）
    if (paymentMethod === 'POINTS') {
      const balance = await pointsApi.getBalance();
      const totalPrice = product.userPrice * quantity;
      if (balance.data.balance < totalPrice) {
        throw new Error('通券余额不足');
      }
    }
  }
  ```

**Q: 订单状态不更新？**
- **现象**: 订单状态长时间不变化
- **原因**:
  - 支付未完成
  - 系统延迟
  - 支付回调失败
- **解决方案**:
  1. 检查支付状态
  2. 联系客服处理
  3. 手动确认支付

#### 4. 店铺问题

**Q: 无法开通店铺？**
- **常见原因**:
  - 用户等级不足（需要VIP及以上）
  - 未完成实名认证
  - 已有店铺
- **解决方案**:
  ```javascript
  // 检查开通条件
  async function checkShopConditions() {
    const userInfo = await userApi.getCurrentUser();

    if (userInfo.data.level === 'NORMAL') {
      Modal.warning({
        title: '无法开通店铺',
        content: '请先升级为VIP会员'
      });
      return false;
    }

    if (!userInfo.data.phoneVerified) {
      Modal.warning({
        title: '无法开通店铺',
        content: '请先完成手机号认证'
      });
      return false;
    }

    return true;
  }
  ```

### 技术问题

#### 1. 网络请求问题

**Q: 请求超时？**
- **现象**: 请求长时间无响应
- **解决方案**:
  ```javascript
  // 设置合理的超时时间
  const api = axios.create({
    timeout: 10000, // 10秒
    retry: 3,      // 重试3次
    retryDelay: 1000
  });

  // 请求重试
  api.interceptors.response.use(null, async (error) => {
    if (!error.response && error.config && !error.config._retry) {
      error.config._retry = true;
      const delay = error.config._retryCount * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return api.request(error.config);
    }
    return Promise.reject(error);
  });
  ```

**Q: CORS 跨域错误？**
- **现象**: 浏览器控制台显示 CORS 错误
- **解决方案**:
  1. 开发环境配置代理
  ```javascript
  // vite.config.js
  export default {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    }
  }
  ```
  2. 生产环境确保后端配置正确的 CORS 头

#### 2. 数据格式问题

**Q: 日期格式错误？**
- **现象**: 日期显示不正确或提交失败
- **解决方案**: 统一使用 dayjs 处理
  ```javascript
  import dayjs from 'dayjs';

  // 格式化日期
  const formatDate = (date) => {
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
  };

  // 提交日期
  const submitData = {
    startDate: dayjs(startDate).format('YYYY-MM-DD'),
    endDate: dayjs(endDate).format('YYYY-MM-DD')
  };
  ```

**Q: 金额计算精度问题？**
- **现象**: 金额计算出现小数点误差
- **解决方案**:
  ```javascript
  // 使用整数计算（以分为单位）
  function calculatePrice(price, quantity, discount) {
    const priceInCents = Math.round(price * 100);
    const discountInCents = Math.round(discount * 100);
    const totalInCents = priceInCents * quantity - discountInCents;
    return totalInCents / 100;
  }

  // 或使用 decimal.js 库
  import Decimal from 'decimal.js';
  const price = new Decimal('10.50');
  const quantity = new Decimal('2');
  const total = price.mul(quantity).toNumber();
  ```

### 性能问题

#### 1. 页面加载慢

**Q: 列表数据加载慢？**
- **解决方案**:
  1. 实现分页加载
  2. 添加虚拟滚动
  3. 使用缓存
  ```javascript
  // React Query 缓存配置
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5分钟
        cacheTime: 10 * 60 * 1000  // 10分钟
      }
    }
  });

  // 虚拟滚动组件
  import { FixedSizeList as List } from 'react-window';
  ```

#### 2. 内存泄漏

**Q: 组件卸载后仍在请求？**
- **解决方案**:
  ```javascript
  // 使用 AbortController
  useEffect(() => {
    const controller = new AbortController();

    fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  // 或取消请求
  const CancelToken = axios.CancelToken;
  const source = CancelToken.source();

  useEffect(() => {
    api.get('/data', { cancelToken: source.token });

    return () => {
      source.cancel('Component unmounted');
    };
  }, []);
  ```

## 🛠️ 调试技巧

### 1. 开发调试

**启用详细日志**
```javascript
// 开发环境启用请求日志
if (process.env.NODE_ENV === 'development') {
  api.interceptors.request.use(req => {
    console.log('🚀 Request:', req);
    return req;
  });

  api.interceptors.response.use(res => {
    console.log('✅ Response:', res);
    return res;
  }, error => {
    console.error('❌ Error:', error);
    return Promise.reject(error);
  });
}
```

### 2. 错误监控

**集成错误监控**
```javascript
// 错误上报
function reportError(error, context) {
  // 发送到错误监控服务
  fetch('/api/v1/error/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: error.message,
      stack: error.stack,
      context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    })
  });
}

// 全局错误捕获
window.addEventListener('error', (e) => {
  reportError(e.error, { type: 'javascript' });
});

window.addEventListener('unhandledrejection', (e) => {
  reportError(e.reason, { type: 'promise' });
});
```

### 3. 性能分析

**使用 React DevTools Profiler**
```jsx
import { Profiler } from 'react';

function onRenderCallback(id, phase, actualDuration) {
  console.log('Component:', id);
  console.log('Phase:', phase);
  console.log('Duration:', actualDuration);
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <MyComponent />
    </Profiler>
  );
}
```

## 📞 获取帮助

### 自助诊断

使用系统诊断工具：
```javascript
// 系统健康检查
async function healthCheck() {
  const checks = [
    { name: 'API连通性', url: '/health' },
    { name: '认证状态', url: '/auth/me' },
    { name: '数据库连接', url: '/health/database' },
    { name: 'Redis缓存', url: '/health/redis' }
  ];

  const results = await Promise.allSettled(
    checks.map(async check => {
      try {
        const res = await api.get(check.url);
        return { name: check.name, status: 'ok', data: res.data };
      } catch (error) {
        return { name: check.name, status: 'error', error };
      }
    })
  );

  console.table(results.map(r => r.value || r.reason));
}
```

### 联系支持

如果问题仍未解决，请联系：

- **技术支持邮箱**: dev@zhongdao-mall.com
- **客服电话**: 400-123-4567
- **在线客服**: 工作日 9:00-21:00
- **问题反馈**: https://github.com/zhongdao-mall/issues

### 提交问题时请提供：

1. **错误信息**
   - 完整的错误堆栈
   - 错误码和消息
   - 请求和响应数据

2. **环境信息**
   - 操作系统和浏览器版本
   - API 端点（开发/测试/生产）
   - 请求时间

3. **复现步骤**
   - 详细的操作步骤
   - 相关的用户账号（脱敏）
   - 预期结果和实际结果

## 🔧 常用调试工具

### 1. 浏览器开发者工具

- **Network 标签**: 查看所有网络请求
- **Console 标签**: 查看 JavaScript 错误和日志
- **Application 标签**: 查看 LocalStorage 和 Cookie

### 2. API 测试工具

- **Postman**: 测试 API 接口
- **Swagger UI**: 在线测试接口
- **curl**: 命令行测试

### 3. 示例 curl 命令

```bash
# 测试登录
curl -X POST http://localhost:3000/api/v1/auth/wechat-login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code","userInfo":{"nickname":"测试用户"}}'

# 测试获取用户信息
curl -X GET http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# 测试获取商品列表
curl -X GET http://localhost:3000/api/v1/products?page=1&pageSize=10
```

---

💡 **提示**: 大多数问题都可以通过查看控制台错误信息和使用上述调试技巧快速定位和解决。如果遇到复杂问题，请提供详细信息以便快速获得帮助。