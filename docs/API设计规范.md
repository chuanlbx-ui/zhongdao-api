# 中道商城系统 - API设计规范

**文档目的**：定义RESTful API设计标准、接口规范和数据格式
**适用范围**：所有API接口设计、开发和维护工作
**最后更新**：2025年11月18日
**版本**：1.0

---

## 📋 API设计原则

### RESTful设计原则

1. **资源导向**：URL表示资源，HTTP方法表示操作
2. **无状态性**：每个请求包含处理所需的所有信息
3. **统一接口**：使用标准HTTP方法和状态码
4. **分层系统**：客户端无需知道是否直接连接到最终服务器
5. **按需代码**：服务器可以返回可执行代码

### 设计目标

- **一致性**：所有API遵循相同的设计模式
- **可预测性**：接口行为符合开发者的直觉
- **可扩展性**：支持未来的功能扩展
- **性能优化**：考虑响应时间和数据传输量
- **安全性**：保护数据安全和系统安全

---

## 🌐 URL设计规范

### 基础URL结构

```
https://api.zhongdao-mall.com/v1/{resource}[/{id}][/{subresource}]

# 示例
https://api.zhongdao-mall.com/v1/users
https://api.zhongdao-mall.com/v1/users/123
https://api.zhongdao-mall.com/v1/users/123/shops
https://api.zhongdao-mall.com/v1/shops/456/products
```

### URL命名规范

```typescript
// 资源名称：小写字母+下划线，复数形式
GET /v1/users           // 获取用户列表
GET /v1/shops           // 获取店铺列表
GET /v1/products        // 获取商品列表

// 嵌套资源：父资源/子资源
GET /v1/users/123/shops      // 获取用户的店铺
GET /v1/shops/456/orders     // 获取店铺的订单

// 查询参数：小写字母+下划线
GET /v1/users?status=active&level=star_1
GET /v1/products?category=wutong_series&sort=price_asc

// 版本控制：URL路径版本控制
/v1/users  // 版本1
/v2/users  // 版本2
```

### HTTP方法使用

| 方法 | 用途 | 幂等性 | 安全性 |
|-----|------|--------|--------|
| GET | 获取资源 | 是 | 安全 |
| POST | 创建资源 | 否 | 不安全 |
| PUT | 更新整个资源 | 是 | 不安全 |
| PATCH | 部分更新资源 | 否 | 不安全 |
| DELETE | 删除资源 | 是 | 不安全 |

### URL设计示例

```typescript
// 用户管理API
GET    /v1/users                    // 获取用户列表
GET    /v1/users/{id}               // 获取单个用户
POST   /v1/users                    // 创建用户
PUT    /v1/users/{id}               // 更新用户（整个）
PATCH  /v1/users/{id}               // 更新用户（部分）
DELETE /v1/users/{id}               // 删除用户

// 店铺管理API
GET    /v1/users/{id}/shops         // 获取用户的店铺
POST   /v1/users/{id}/shops         // 用户申请开店
PUT    /v1/shops/{id}               // 更新店铺信息
PATCH  /v1/shops/{id}/status        // 更新店铺状态

// 采购管理API
POST   /v1/purchases               // 创建采购订单
GET    /v1/purchases               // 获取采购列表
GET    /v1/purchases/{id}           // 获取采购详情
PUT    /v1/purchases/{id}/status    // 更新采购状态

// 通券管理API
GET    /v1/points/balance           // 获取余额
POST   /v1/points/transfer          // 通券转账
POST   /v1/points/recharge          // 通券充值
POST   /v1/points/withdraw          // 通券提现
GET    /v1/points/transactions     // 获取流水记录
```

---

## 📨 请求格式规范

### Content-Type

```typescript
// 请求体格式
Content-Type: application/json;charset=utf-8

// 文件上传
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

// 表单数据
Content-Type: application/x-www-form-urlencoded
```

### 请求头规范

```typescript
// 通用请求头
Accept: application/json
Content-Type: application/json
User-Agent: Zhongdao-Mall-App/1.0.0
X-Request-ID: uuid-v4
X-Timestamp: unix-timestamp
X-Signature: hmac-sha256-signature

// 认证相关
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}

// 分页相关
X-Page: 1
X-Per-Page: 20
X-Total-Count: 1000

// 设备信息
X-Device-Type: ios/android/web
X-Device-Version: 1.0.0
X-Platform: wechat-miniprogram
```

### 请求体示例

#### 创建资源请求
```json
{
  "title": "用户注册",
  "description": "新用户注册接口请求示例",
  "method": "POST",
  "url": "/v1/users",
  "headers": {
    "Content-Type": "application/json",
    "X-Request-ID": "req-123456",
    "X-Timestamp": "1699999999"
  },
  "body": {
    "openid": "o1234567890abcdef",
    "nickname": "张三",
    "avatar_url": "https://example.com/avatar.jpg",
    "phone": "13800138000",
    "parent_id": 123456
  },
  "example": {
    "success_response": {
      "success": true,
      "data": {
        "id": 789012,
        "openid": "o1234567890abcdef",
        "nickname": "张三",
        "level": "normal",
        "status": "active",
        "created_at": "2023-11-18T10:30:00Z"
      }
    },
    "error_response": {
      "success": false,
      "error": {
        "code": "USER_ALREADY_EXISTS",
        "message": "用户已存在",
        "details": "该openid已被注册"
      }
    }
  }
}
```

#### 查询请求
```json
{
  "title": "获取用户列表",
  "description": "分页获取用户列表",
  "method": "GET",
  "url": "/v1/users?page=1&per_page=20&status=active",
  "headers": {
    "Accept": "application/json",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "query_params": {
    "page": 1,
    "per_page": 20,
    "status": "active",
    "level": "star_1"
  },
  "example": {
    "success_response": {
      "success": true,
      "data": {
        "users": [
          {
            "id": 789012,
            "openid": "o1234567890abcdef",
            "nickname": "张三",
            "level": "star_1",
            "status": "active",
            "total_sales": 15000.00,
            "team_count": 5,
            "created_at": "2023-11-18T10:30:00Z"
          }
        ],
        "pagination": {
          "page": 1,
          "per_page": 20,
          "total_count": 100,
          "total_pages": 5,
          "has_next": true,
          "has_prev": false
        }
      }
    }
  }
}
```

---

## 📤 响应格式规范

### 通用响应结构

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  message?: string;
  timestamp: string;
  request_id: string;
  meta?: ResponseMeta;
}

interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  field?: string;
  timestamp: string;
}

interface ResponseMeta {
  version: string;
  server: string;
  execution_time: number;
  cache?: CacheMeta;
}

interface CacheMeta {
  cached: boolean;
  ttl: number;
  key: string;
}
```

### 成功响应示例

```json
{
  "success": true,
  "data": {
    "id": 789012,
    "openid": "o1234567890abcdef",
    "nickname": "张三",
    "level": "star_1",
    "status": "active",
    "total_sales": 15000.00,
    "total_bottles": 25,
    "direct_sales": 8000.00,
    "team_sales": 7000.00,
    "parent_id": 123456,
    "team_path": "/123456/789012/",
    "team_level": 2,
    "direct_count": 3,
    "team_count": 8,
    "created_at": "2023-11-18T10:30:00Z",
    "updated_at": "2023-11-18T15:45:00Z"
  },
  "message": "获取用户信息成功",
  "timestamp": "2023-11-18T16:00:00Z",
  "request_id": "req-123456",
  "meta": {
    "version": "1.0.0",
    "server": "api-server-01",
    "execution_time": 45
  }
}
```

### 列表响应示例

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 789012,
        "openid": "o1234567890abcdef",
        "nickname": "张三",
        "level": "star_1",
        "status": "active",
        "total_sales": 15000.00,
        "team_count": 5
      },
      {
        "id": 789013,
        "openid": "o1234567890abcdef1",
        "nickname": "李四",
        "level": "normal",
        "status": "active",
        "total_sales": 5000.00,
        "team_count": 2
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total_count": 100,
      "total_pages": 5,
      "has_next": true,
      "has_prev": false
    }
  },
  "timestamp": "2023-11-18T16:00:00Z",
  "request_id": "req-123456"
}
```

### 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "用户不存在",
    "details": {
      "user_id": 999999,
      "search_criteria": {
        "id": 999999,
        "status": "active"
      }
    },
    "timestamp": "2023-11-18T16:00:00Z"
  },
  "timestamp": "2023-11-18T16:00:00Z",
  "request_id": "req-123456"
}
```

### 验证错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数验证失败",
    "details": [
      {
        "field": "phone",
        "message": "手机号格式不正确",
        "value": "1380013800"
      },
      {
        "field": "level",
        "message": "用户等级值无效",
        "value": "invalid_level"
      }
    ]
  },
  "timestamp": "2023-11-18T16:00:00Z",
  "request_id": "req-123456"
}
```

---

## 🔢 状态码规范

### HTTP状态码使用

| 状态码 | 类别 | 含义 | 使用场景 |
|--------|------|------|----------|
| 200 | 成功 | 请求成功 | 成功获取、更新、删除资源 |
| 201 | 成功 | 资源创建 | 成功创建新资源 |
| 204 | 成功 | 无内容 | 成功删除资源，无返回内容 |
| 400 | 客户端错误 | 请求错误 | 参数验证失败、格式错误 |
| 401 | 客户端错误 | 未授权 | Token无效、未登录 |
| 403 | 客户端错误 | 禁止访问 | 权限不足、业务规则限制 |
| 404 | 客户端错误 | 资源不存在 | 请求的资源不存在 |
| 409 | 客户端错误 | 冲突 | 资源冲突、状态冲突 |
| 422 | 客户端错误 | 不可处理的实体 | 业务逻辑验证失败 |
| 429 | 客户端错误 | 请求过多 | 请求频率超限 |
| 500 | 服务器错误 | 内部错误 | 服务器内部错误 |
| 502 | 服务器错误 | 网关错误 | 网关或上游服务错误 |
| 503 | 服务器错误 | 服务不可用 | 服务暂时不可用 |

### 业务错误码

```typescript
// 用户相关错误码 (USER_*)
USER_NOT_FOUND = "USER_NOT_FOUND"              // 用户不存在
USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS"      // 用户已存在
USER_LEVEL_INVALID = "USER_LEVEL_INVALID"        // 用户等级无效
USER_STATUS_INACTIVE = "USER_STATUS_INACTIVE"    // 用户状态不活跃

// 店铺相关错误码 (SHOP_*)
SHOP_NOT_FOUND = "SHOP_NOT_FOUND"              // 店铺不存在
SHOP_ALREADY_EXISTS = "SHOP_ALREADY_EXISTS"      // 店铺已存在
SHOP_APPLICATION_PENDING = "SHOP_APPLICATION_PENDING" // 店铺申请待审核
SHOP_LEVEL_INSUFFICIENT = "SHOP_LEVEL_INSUFFICIENT" // 店铺等级不足

// 采购相关错误码 (PURCHASE_*)
PURCHASE_INVALID_PERMISSION = "PURCHASE_INVALID_PERMISSION" // 采购权限无效
PURCHASE_INSUFFICIENT_POINTS = "PURCHASE_INSUFFICIENT_POINTS" // 通券余额不足
PURCHASE_INSUFFICIENT_INVENTORY = "PURCHASE_INSUFFICIENT_INVENTORY" // 库存不足
PURCHASE_CONFLICT = "PURCHASE_CONFLICT"           // 采购冲突

// 通券相关错误码 (POINTS_*)
POINTS_INSUFFICIENT_BALANCE = "POINTS_INSUFFICIENT_BALANCE" // 通券余额不足
POINTS_TRANSFER_LIMIT_EXCEEDED = "POINTS_TRANSFER_LIMIT_EXCEEDED" // 转账限额超出
POINTS_WITHDRAWAL_PENDING = "POINTS_WITHDRAWAL_PENDING"   // 提现申请待处理
POINTS_RECHARGE_DISABLED = "POINTS_RECHARGE_DISABLED"   // 充值功能未启用

// 业务规则错误码 (BUSINESS_*)
BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION" // 违反业务规则
BUSINESS_LOGIC_ERROR = "BUSINESS_LOGIC_ERROR"         // 业务逻辑错误
BUSINESS_STATE_INVALID = "BUSINESS_STATE_INVALID"       // 业务状态无效

// 系统错误码 (SYSTEM_*)
SYSTEM_INTERNAL_ERROR = "SYSTEM_INTERNAL_ERROR"     // 系统内部错误
SYSTEM_DATABASE_ERROR = "SYSTEM_DATABASE_ERROR"       // 数据库错误
SYSTEM_EXTERNAL_SERVICE_ERROR = "SYSTEM_EXTERNAL_SERVICE_ERROR" // 外部服务错误
SYSTEM_RATE_LIMIT_EXCEEDED = "SYSTEM_RATE_LIMIT_EXCEEDED" // 请求频率超限
```

---

## 🔐 认证授权规范

### JWT Token格式

```typescript
interface JWTPayload {
  sub: string;           // 用户ID
  iat: number;           // 签发时间
  exp: number;           // 过期时间
  jti: string;           // Token ID
  scope: string[];        // 权限范围
  role: string;          // 用户角色
  level: string;         // 用户等级
  device_id?: string;    // 设备ID
  platform?: string;     // 平台标识
}
```

### 认证流程

```typescript
// 1. 用户登录获取Token
POST /v1/auth/login
{
  "openid": "o1234567890abcdef",
  "platform": "wechat-miniprogram"
}

// 响应
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "refresh_token_here",
    "token_type": "Bearer",
    "expires_in": 604800,
    "user_info": {
      "id": 123456,
      "openid": "o1234567890abcdef",
      "nickname": "张三",
      "level": "star_1"
    }
  }
}

// 2. 使用Token访问受保护资源
GET /v1/users/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// 3. Token刷新
POST /v1/auth/refresh
{
  "refresh_token": "refresh_token_here"
}
```

### 权限控制

```typescript
// 基于角色的权限控制
interface Permission {
  resource: string;     // 资源路径
  action: string;       // 操作类型
  conditions?: string[];  // 额外条件
}

// 权限定义
const PERMISSIONS = {
  // 用户权限
  'user:read': { resource: '/v1/users', action: 'read' },
  'user:create': { resource: '/v1/users', action: 'create' },
  'user:update:own': { resource: '/v1/users', action: 'update', conditions: ['owner'] },

  // 店铺权限
  'shop:create': { resource: '/v1/shops', action: 'create' },
  'shop:update:own': { resource: '/v1/shops', action: 'update', conditions: ['owner'] },

  // 采购权限
  'purchase:create': { resource: '/v1/purchases', action: 'create', conditions: ['valid_permission'] },
  'purchase:update:own': { resource: '/v1/purchases', action: 'update', conditions: ['buyer'] },

  // 通券权限
  'points:read:own': { resource: '/v1/points', action: 'read', conditions: ['owner'] },
  'points:transfer': { resource: '/v1/points/transfer', action: 'create' },
  'points:recharge': { resource: '/v1/points/recharge', action: 'create', conditions: ['high_level'] },
};
```

---

## 📊 分页规范

### 分页参数

```typescript
interface PaginationParams {
  page?: number;        // 页码，从1开始，默认1
  per_page?: number;    // 每页数量，默认20，最大100
  sort?: string;        // 排序字段
  order?: 'asc' | 'desc'; // 排序方向，默认desc
}
```

### 分页响应

```typescript
interface PaginationResponse {
  page: number;          // 当前页码
  per_page: number;       // 每页数量
  total_count: number;    // 总记录数
  total_pages: number;    // 总页数
  has_next: boolean;       // 是否有下一页
  has_prev: boolean;       // 是否有上一页
}
```

### 分页示例

```typescript
// 请求
GET /v1/users?page=2&per_page=10&sort=created_at&order=desc

// 响应
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 2,
      "per_page": 10,
      "total_count": 100,
      "total_pages": 10,
      "has_next": true,
      "has_prev": true
    }
  }
}
```

---

## 🔍 查询参数规范

### 查询参数命名

```typescript
// 过滤参数：直接使用字段名
status=active
level=star_1
category=wutong_series

// 排序参数：sort和order
sort=created_at
order=desc

// 分页参数：page和per_page
page=1
per_page=20

// 搜索参数：search或q
search=张三
q=手机

// 时间范围参数：start_date和end_date
start_date=2023-11-01
end_date=2023-11-30

// 布尔参数：字段名__operator
name__like=张
created_at__gte=2023-11-01
total_sales__gte=10000
```

### 高级查询

```typescript
// 多条件过滤
GET /v1/users?status=active&level=star_1,star_2&team_count__gte=5

// 时间范围查询
GET /v1/purchases?created_at__gte=2023-11-01&created_at__lte=2023-11-30

// 模糊搜索
GET /v1/users?search__nickname=张&search__phone=138

// 排除字段
GET /v1/users?fields=-id,-created_at

// 只包含字段
GET /v1/users?fields=id,nickname,level,status
```

---

## 📁 文件上传规范

### 文件上传请求

```typescript
// 单文件上传
POST /v1/upload
Content-Type: multipart/form-data

const formData = new FormData();
formData.append('file', file);
formData.append('type', 'avatar');
formData.append('category', 'user');
```

### 文件上传响应

```json
{
  "success": true,
  "data": {
    "file_id": "file_123456",
    "file_name": "avatar.jpg",
    "file_size": 123456,
    "file_type": "image/jpeg",
    "file_url": "https://cdn.zhongdao-mall.com/uploads/avatar.jpg",
    "upload_time": "2023-11-18T16:00:00Z"
  }
}
```

### 文件类型支持

```typescript
const SUPPORTED_FILE_TYPES = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
  video: ['mp4', 'mov', 'avi'],
  audio: ['mp3', 'wav']
};

const MAX_FILE_SIZE = {
  image: 5 * 1024 * 1024,    // 5MB
  document: 10 * 1024 * 1024, // 10MB
  video: 50 * 1024 * 1024,   // 50MB
  audio: 10 * 1024 * 1024    // 10MB
};
```

---

## 🔧 版本控制

### URL版本控制

```typescript
// 路径版本控制（推荐）
/v1/users  // 版本1
/v2/users  // 版本2

// 查询参数版本控制（不推荐）
/v1/users?version=1
```

### 版本兼容性

```typescript
// 向后兼容原则
// 新版本API必须保持对旧版本的兼容
// 废弃的功能需要给出迁移指导

// 版本弃用通知
{
  "success": true,
  "data": {...},
  "warnings": [
    {
      "code": "DEPRECATED_FIELD",
      "message": "字段 'old_field' 已弃用，请使用 'new_field'",
      "deprecation_date": "2024-01-01",
      "removal_date": "2024-06-01"
    }
  ]
}
```

---

## 🛡️ 安全规范

### 输入验证

```typescript
// 请求体验证中间件
interface ValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    enum?: string[];
    custom?: (value: any) => boolean | string;
  };
}

const userValidationSchema: ValidationSchema = {
  nickname: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[\u4e00-\u9fa5a-zA-Z0-9]+$/
  },
  phone: {
    type: 'string',
    pattern: /^1[3-9]\d{9}$/,
    custom: (value: string) => {
      // 验证手机号是否真实（可选）
      return true;
    }
  }
};
```

### SQL注入防护

```typescript
// 使用参数化查询
const getUserById = async (id: number) => {
  const query = 'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL';
  return db.query(query, [id]);
};

// 使用ORM的查询构建器
const users = await prisma.users.findMany({
  where: {
    id: userId,
    deletedAt: null
  }
});
```

### XSS防护

```typescript
// 输出转义
import escape from 'html-escaper';

const escapeHtml = (unsafe: string): string => {
  return escape(unsafe);
};

// 内容安全策略
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

---

## 📈 性能优化

### 响应优化

```typescript
// 字段选择
const users = await prisma.users.findMany({
  select: {
    id: true,
    nickname: true,
    level: true,
    status: true
    // 不选择敏感字段如 phone, id_card等
  }
});

// 数据压缩
app.use(compression());

// 缓存控制
app.use((req, res, next) => {
  if (req.path.includes('/v1/products')) {
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5分钟
  }
  next();
});
```

### 数据库优化

```typescript
// 索引优化
const users = await prisma.users.findMany({
  where: {
    status: 'active'
  },
  orderBy: {
    created_at: 'desc'
  },
  take: 20,
  skip: (page - 1) * 20
});

// 查询优化
const userStats = await prisma.users.aggregate({
  where: {
    level: 'star_1'
  },
  _count: {
    id: true
  },
  _sum: {
    totalSales: true
  }
});
```

---

## 📋 API文档生成

### OpenAPI规范

```yaml
openapi: 3.0.0
info:
  title: 中道商城API
  version: 1.0.0
  description: 中道商城系统API文档
  contact:
    name: API支持
    email: api@zhongdao-mall.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.zhongdao-mall.com/v1
    description: 生产环境
  - url: https://api-staging.zhongdao-mall.com/v1
    description: 测试环境

paths:
  /users:
    get:
      summary: 获取用户列表
      tags:
        - 用户管理
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 1
            default: 1
      responses:
        '200':
          description: 成功获取用户列表
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
```

---

## 📋 检查清单

### API设计检查

- [ ] URL设计遵循RESTful规范
- [ ] HTTP方法使用正确
- [ ] 状态码使用标准
- [ ] 请求/响应格式统一
- [ ] 错误处理完整
- [ ] 认证授权规范
- [ ] 分页格式一致
- [ ] 文件上传规范
- [ ] 版本控制策略
- [ ] 安全防护措施

### 文档检查

- [ ] API文档完整性
- [ ] 示例代码准确性
- [ ] 错误案例覆盖
- [ ] 版本变更记录
- [ ] 联系信息完整

### 实现检查

- [ ] 代码实现符合规范
- [ ] 错误处理逻辑完善
- [ ] 安全措施到位
- [ ] 性能优化实施
- [ ] 测试用例覆盖
- [ ] 日志记录完整

---

**重要提醒**：
1. 所有API变更必须经过架构师AI审查
2. 生产环境变更必须有完整测试
3. 保持API文档的及时更新
4. 定期进行API安全审计
5. 监控API性能和错误率