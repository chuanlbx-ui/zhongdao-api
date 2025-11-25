# 中道商城系统 API 调用说明文档

## 📖 文档信息

- **版本**: v1.0.0
- **更新时间**: 2025-11-20
- **基础URL**: `http://localhost:3000/api/v1`
- **面向对象**: 前端开发人员

## 🔧 基础配置

### 环境信息
- **开发环境**: `http://localhost:3000`
- **API版本**: v1
- **数据格式**: JSON
- **字符编码**: UTF-8

### 认证方式
```typescript
// JWT Token 认证
Authorization: Bearer <token>

// 请求头示例
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}
```

### 响应格式
```typescript
// 成功响应
{
  "success": true,
  "data": any,
  "message": string,
  "timestamp": string
}

// 错误响应
{
  "success": false,
  "error": {
    "code": string,
    "message": string,
    "details": any
  },
  "timestamp": string
}
```

### 分页格式
```typescript
// 分页请求参数
{
  page: number,      // 页码，从1开始
  perPage: number,   // 每页数量，默认20
  search?: string,   // 搜索关键词
  sortBy?: string,   // 排序字段
  sortOrder?: 'asc' | 'desc'  // 排序方向
}

// 分页响应数据
{
  "items": any[],
  "pagination": {
    "page": number,
    "perPage": number,
    "total": number,
    "totalPages": number,
    "hasNext": boolean,
    "hasPrev": boolean
  }
}
```

---

## 🔐 认证模块 (Authentication)

> **注意**: 当前认证模块暂时被注释，待完善后启用

### 微信小程序登录
```http
POST /auth/wechat-login
```

**请求参数**:
```json
{
  "code": "string",        // 微信授权码
  "userInfo": {            // 用户信息（可选）
    "nickname": "string",
    "avatarUrl": "string"
  }
}
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "token": "string",
    "refreshToken": "string",
    "user": {
      "id": "string",
      "openid": "string",
      "nickname": "string",
      "avatarUrl": "string",
      "level": "NORMAL",
      "status": "ACTIVE"
    }
  }
}
```

### 刷新Token
```http
POST /auth/refresh
```

### 登出
```http
POST /auth/logout
```

---

## 👤 用户管理模块 (Users)

### 获取当前用户信息
```http
GET /users/me
```

**请求头**:
```
Authorization: Bearer <token>
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "openid": "string",
    "nickname": "string",
    "avatarUrl": "string",
    "phone": "string",
    "level": "NORMAL|VIP|STAR_1|STAR_2|STAR_3|STAR_4|STAR_5|DIRECTOR",
    "status": "ACTIVE|INACTIVE|SUSPENDED",
    "parentId": "string",
    "teamPath": "string",
    "teamLevel": 1,
    "totalSales": 0,
    "totalBottles": 0,
    "directSales": 0,
    "teamSales": 0,
    "directCount": 0,
    "teamCount": 0,
    "cloudShopLevel": 1,
    "hasWutongShop": false,
    "pointsBalance": 0,
    "pointsFrozen": 0,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLoginAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### 更新用户信息
```http
PUT /users/me
```

**请求参数**:
```json
{
  "nickname": "string",
  "avatarUrl": "string"
}
```

### 获取用户列表（管理员）
```http
GET /users?page=1&perPage=20&level=NORMAL&status=ACTIVE
```

**查询参数**:
- `page`: 页码
- `perPage`: 每页数量
- `level`: 用户等级筛选
- `status`: 用户状态筛选
- `search`: 搜索关键词（昵称、手机号）

---

## 📱 短信验证模块 (SMS)

### 发送短信验证码
```http
POST /sms/send-code
```

**请求参数**:
```json
{
  "phone": "13800138000",
  "type": "BIND|UNBIND|LOGIN|TRANSFER"
}
```

### 验证并绑定/解绑手机号
```http
POST /sms/verify-and-bind
```

**请求参数**:
```json
{
  "phone": "13800138000",
  "code": "123456",
  "type": "BIND|UNBIND"
}
```

### 检查手机号绑定状态
```http
GET /sms/check-phone/{phone}
```

---

## 💰 通券管理模块 (Points)

### 获取通券余额
```http
GET /points/balance
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "balance": 1000.50,
    "frozen": 50.00,
    "available": 950.50
  }
}
```

### 通券转账
```http
POST /points/transfer
```

**请求参数**:
```json
{
  "toPhone": "13800138001",
  "amount": 100.00,
  "code": "123456",        // 短信验证码
  "remarks": "备注信息"
}
```

### 通券充值（管理员）
```http
POST /points/recharge
```

**请求参数**:
```json
{
  "userId": "string",
  "amount": 1000.00,
  "type": "RECHARGE|REWARD|COMMISSION",
  "description": "充值说明"
}
```

### 获取通券流水记录
```http
GET /points/transactions?page=1&perPage=20&type=TRANSFER
```

**查询参数**:
- `type`: 交易类型 (TRANSFER|RECHARGE|WITHDRAW|REFUND|COMMISSION|REWARD|FREEZE|UNFREEZE)
- `startDate`: 开始日期
- `endDate`: 结束日期

### 获取通券统计信息
```http
GET /points/statistics
```

### 通券冻结/解冻（管理员）
```http
POST /points/freeze
```

**请求参数**:
```json
{
  "userId": "string",
  "amount": 100.00,
  "action": "FREEZE|UNFREEZE",
  "reason": "冻结原因"
}
```

---

## 🛍️ 商品管理模块 (Products)

### 获取商品分类树
```http
GET /products/categories/tree
```

**响应数据**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "白酒",
      "level": 1,
      "children": [
        {
          "id": "string",
          "name": "酱香型",
          "level": 2,
          "children": []
        }
      ]
    }
  ]
}
```

### 获取商品分类列表
```http
GET /products/categories?level=1&isActive=true
```

### 创建商品分类（管理员）
```http
POST /products/categories
```

**请求参数**:
```json
{
  "name": "白酒",
  "parentId": "string",
  "icon": "🍷",
  "description": "分类描述"
}
```

### 获取商品标签列表
```http
GET /products/tags?page=1&perPage=20
```

### 创建商品标签（管理员）
```http
POST /products/tags
```

**请求参数**:
```json
{
  "name": "新品",
  "color": "#ff4757",
  "description": "新品上市标签"
}
```

### 获取商品列表
```http
GET /products/items?page=1&perPage=20&categoryId=xxx&status=ACTIVE
```

**查询参数**:
- `categoryId`: 分类ID
- `status`: 商品状态 (ACTIVE|INACTIVE|PRESALE|OUT_OF_STOCK)
- `isFeatured`: 是否推荐
- `minPrice`: 最低价格
- `maxPrice`: 最高价格
- `search`: 搜索关键词

### 获取商品详情
```http
GET /products/items/{id}
```

### 创建商品（管理员）
```http
POST /products/items
```

**请求参数**:
```json
{
  "categoryId": "string",
  "name": "茅台飞天",
  "description": "商品描述",
  "basePrice": 999.00,
  "images": ["url1", "url2"],
  "details": {},
  "specs": [
    {
      "name": "500ml/瓶",
      "sku": "MT-500-001",
      "price": 999.00,
      "stock": 100
    }
  ]
}
```

### 获取商品规格列表
```http
GET /products/specs?productId=xxx
```

---

## 🏪 店铺管理模块 (Shops)

### 获取用户店铺列表
```http
GET /shops
```

### 获取店铺详情
```http
GET /shops/{shopId}
```

### 获取店铺统计
```http
GET /shops/{shopId}/statistics
```

### 申请开店
```http
POST /shops/apply
```

**请求参数**:
```json
{
  "shopType": "CLOUD|WUTONG",
  "shopName": "我的店铺",
  "contactName": "张三",
  "contactPhone": "13800138000",
  "address": "店铺地址"
}
```

### 检查云店升级条件
```http
GET /shops/cloud/upgrade-check
```

### 执行云店升级
```http
POST /shops/cloud/upgrade
```

### 购买五通店
```http
POST /shops/wutong/purchase
```

---

## 📦 库存管理模块 (Inventory)

### 获取库存流水记录
```http
GET /inventory/logs?page=1&perPage=20&operationType=MANUAL_IN
```

**查询参数**:
- `operationType`: 操作类型 (MANUAL_IN|MANUAL_OUT|ORDER_OUT|PURCHASE_IN|ADJUSTMENT|TRANSFER_IN|TRANSFER_OUT|RETURN_IN|DAMAGE_OUT)
- `productId`: 商品ID
- `warehouseType`: 仓库类型 (PLATFORM|CLOUD|LOCAL)

### 获取库存预警列表
```http
GET /inventory/alerts?page=1&perPage=20&isResolved=false
```

### 手动入库
```http
POST /inventory/adjustments/manual-in
```

**请求参数**:
```json
{
  "productId": "string",
  "specId": "string",
  "quantity": 100,
  "warehouseType": "PLATFORM",
  "remarks": "入库备注"
}
```

### 手动出库
```http
POST /inventory/adjustments/manual-out
```

### 库存调拨
```http
POST /inventory/adjustments/transfer
```

**请求参数**:
```json
{
  "productId": "string",
  "fromWarehouse": "PLATFORM",
  "toWarehouse": "CLOUD",
  "quantity": 50,
  "remarks": "调拨备注"
}
```

---

## 👥 团队管理模块 (Teams)

### 获取团队管理模块信息
```http
GET /teams
```

### 建立推荐关系
```http
POST /teams/referral
```

**请求参数**:
```json
{
  "referrerCode": "string",  // 推荐人邀请码
  "refereeId": "string"      // 被推荐人ID
}
```

### 获取用户推荐关系
```http
GET /teams/referral/{userId}
```

### 获取团队成员列表
```http
GET /teams/members?page=1&perPage=20&level=1
```

### 获取团队结构
```http
GET /teams/structure/{teamId}
```

### 获取网络树结构
```http
GET /teams/network/{userId}?maxLevels=3
```

### 获取业绩指标
```http
GET /teams/performance?period=2025-01
```

### 计算佣金
```http
POST /teams/commission/calculate
```

**请求参数**:
```json
{
  "userId": "string",
  "period": "2025-01",
  "autoPay": false
}
```

---

## 💳 支付管理模块 (Payments)

### 通券支付
```http
POST /payments/points/pay
```

**请求参数**:
```json
{
  "orderId": "string",
  "amount": 100.00,
  "password": "支付密码"
}
```

### 通券转账
```http
POST /payments/points/transfer
```

### 批量转账
```http
POST /payments/batch/transfer
```

**请求参数**:
```json
{
  "transfers": [
    {
      "toUserId": "string",
      "amount": 100.00,
      "remarks": "转账备注"
    }
  ]
}
```

### 获取支付统计
```http
GET /payments/statistics?startDate=2025-01-01&endDate=2025-01-31
```

### 获取用户余额
```http
GET /payments/info/balance/{userId}
```

### 模拟微信充值
```http
POST /payments/recharge/mock/wechat
```

**请求参数**:
```json
{
  "amount": 100.00,
  "openid": "string"
}
```

---

## 📋 订单管理模块 (Orders)

### 创建订单
```http
POST /orders
```

**请求参数**:
```json
{
  "type": "RETAIL|PURCHASE|TEAM|EXCHANGE",
  "items": [
    {
      "productId": "string",
      "specId": "string",
      "quantity": 2
    }
  ],
  "shippingAddress": {},
  "paymentMethod": "WECHAT|ALIPAY|POINTS|MIXED"
}
```

### 获取用户订单列表
```http
GET /orders?page=1&perPage=20&status=PAID
```

**查询参数**:
- `status`: 订单状态 (PENDING|PAID|PROCESSING|SHIPPED|DELIVERED|CANCELLED|REFUNDED)
- `type`: 订单类型 (RETAIL|PURCHASE|TEAM|EXCHANGE)
- `startDate`: 开始日期
- `endDate`: 结束日期

### 获取订单详情
```http
GET /orders/{orderId}
```

### 确认订单
```http
PUT /orders/{orderId}/confirm
```

### 取消订单
```http
PUT /orders/{orderId}/cancel
```

### 获取订单统计
```http
GET /orders/statistics
```

### 创建换货申请
```http
POST /orders/exchange
```

---

## 💵 佣金管理模块 (Commission)

### 获取用户佣金统计
```http
GET /commission/statistics
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "totalCommission": 1000.00,
    "personalCommission": 500.00,
    "teamCommission": 300.00,
    "referralCommission": 200.00,
    "pendingAmount": 100.00,
    "paidAmount": 900.00
  }
}
```

### 获取佣金记录列表
```http
GET /commission/records?page=1&perPage=20&status=PENDING
```

### 获取团队业绩统计
```http
GET /commission/team-performance?period=2025-01
```

### 检查升级条件
```http
GET /commission/upgrade-check
```

### 结算佣金（管理员）
```http
POST /commission/settle
```

**请求参数**:
```json
{
  "userIds": ["string"],
  "period": "2025-01",
  "autoPay": false
}
```

---

## ⚙️ 系统配置模块 (Admin/Config)

### 获取所有配置（分页）
```http
GET /admin/config/configs?page=1&perPage=20&category=shop_levels
```

### 获取单个配置详情
```http
GET /admin/config/configs/{key}
```

### 创建新配置
```http
POST /admin/config/configs
```

**请求参数**:
```json
{
  "key": "string",
  "value": "string",
  "description": "配置说明",
  "category": "string",
  "type": "STRING|NUMBER|BOOLEAN|JSON|ARRAY"
}
```

### 更新配置
```http
PUT /admin/config/configs/{key}
```

### 删除配置
```http
DELETE /admin/config/configs/{key}
```

### 批量更新配置
```http
POST /admin/config/configs/batch
```

### 导出配置
```http
GET /admin/config/configs/export?category=shop_levels
```

### 导入配置
```http
POST /admin/config/configs/import
```

---

## 🔍 健康检查

### 系统健康状态
```http
GET /health
```

**响应数据**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-11-20T00:11:30.194Z",
    "version": "1.0.0",
    "environment": "development",
    "uptime": 30069.8819786
  }
}
```

---

## 📝 错误代码说明

| 错误代码 | HTTP状态码 | 说明 |
|---------|-----------|------|
| AUTH_REQUIRED | 401 | 需要认证 |
| AUTH_INVALID | 401 | 无效的认证信息 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| INSUFFICIENT_BALANCE | 400 | 余额不足 |
| DUPLICATE_PHONE | 400 | 手机号已存在 |
| INVALID_CODE | 400 | 验证码错误 |
| CODE_EXPIRED | 400 | 验证码已过期 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

---

## 🚀 快速开始示例

### 1. 用户登录流程
```javascript
// 1. 微信登录
const loginResponse = await fetch('/api/v1/auth/wechat-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'wx_code',
    userInfo: { nickname: '张三', avatarUrl: 'avatar_url' }
  })
});

const { data: { token, user } } = await loginResponse.json();

// 2. 保存token到本地存储
localStorage.setItem('token', token);
```

### 2. 设置请求拦截器
```javascript
// axios 请求拦截器
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器
axios.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      // 处理认证失败
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 3. 获取用户信息示例
```javascript
const getUserInfo = async () => {
  try {
    const response = await axios.get('/api/v1/users/me');
    console.log('用户信息:', response.data);
    return response.data;
  } catch (error) {
    console.error('获取用户信息失败:', error);
  }
};
```

### 4. 创建订单示例
```javascript
const createOrder = async (orderData) => {
  try {
    const response = await axios.post('/api/v1/orders', {
      type: 'RETAIL',
      items: orderData.items,
      shippingAddress: orderData.address,
      paymentMethod: 'POINTS'
    });
    return response.data;
  } catch (error) {
    console.error('创建订单失败:', error);
  }
};
```

---

## 📞 技术支持

如有疑问，请联系开发团队或查看项目文档。

**更新时间**: 2025-11-20
**文档维护**: 后端开发团队