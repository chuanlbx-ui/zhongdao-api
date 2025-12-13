# 中道商城认证模块 API 文档

## 概述

认证模块提供完整的用户认证和授权功能，包括用户名密码登录、微信小程序登录、JWT令牌管理和用户权限控制。

**基础信息**
- 基础URL: `http://localhost:3000/api/v1/auth`
- 认证方式: Bearer Token (JWT)
- 数据格式: JSON
- Token有效期: 7天

## 1. 用户登录

### 1.1 用户名密码登录

**接口地址**: `POST /login`

**描述**: 使用用户名（手机号或用户编号）和密码进行登录

**权限要求**: 无需认证

**请求体**:
```json
{
  "username": "13800138000",
  "password": "123456"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| username | string | 是 | 用户名（支持手机号或用户编号） | "13800138000" |
| password | string | 是 | 密码（最少6位） | "123456" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzAwMSIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwicm9sZSI6IlVTRVIiLCJsZXZlbCI6Ik5PUk1BTCIsImlhdCI6MTcwNDA2NzIwMCwiZXhwIjoxNzA0Njc1NjAwfQ.signature",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzAwMSIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiLCJyZWZyZXNoIl0sInJvbGUiOiJVU0VSIiwibGV2ZWwiOiJOT1JNQUwiLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwNDY3NTYwMH0.signature",
    "user": {
      "id": "user_001",
      "phone": "13800138000",
      "userNumber": "U20240101001",
      "nickname": "张三",
      "avatarUrl": null,
      "level": "NORMAL",
      "status": "ACTIVE"
    }
  },
  "message": "登录成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.2 微信小程序登录

**接口地址**: `POST /wechat-login`

**描述**: 使用微信小程序授权码进行登录，自动创建或更新用户信息

**权限要求**: 无需认证

**请求体**:
```json
{
  "code": "071XPGGa1l5yRp2KlSGa1mYvD83XPGGk",
  "nickname": "张三",
  "avatarUrl": "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTKicT8dLcSswnYfJYrdUCgBibibUoZ3TrIu5wsNuuibvuKG5t6sLzT2gSgSfJpGyAics9QV9e3aKh8Cicw/132"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| code | string | 是 | 微信小程序授权码 | "071XPGGa1l5yRp2KlSGa1mYvD83XPGGk" |
| nickname | string | 否 | 用户昵称（2-50字符） | "张三" |
| avatarUrl | string | 否 | 用户头像URL | "https://..." |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_001",
      "openid": "mock_openid_071XPGGa1l5yRp2KlSGa1mYvD83XPGGk",
      "nickname": "张三",
      "avatarUrl": null,
      "level": "NORMAL",
      "status": "ACTIVE"
    }
  },
  "message": "登录成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 2. Token管理

### 2.1 刷新访问令牌

**接口地址**: `POST /refresh`

**描述**: 使用刷新令牌获取新的访问令牌

**权限要求**: 需要有效的刷新令牌

**请求体**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzAwMSIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiLCJyZWZyZXNoIl0sInJvbGUiOiJVU0VSIiwibGV2ZWwiOiJOT1JNQUwiLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwNDY3NTYwMH0.signature"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| refreshToken | string | 是 | 刷新令牌 | "eyJ..." |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzAwMSIsInNjb3BlIjpbImFjdGl2ZSIsInVzZXIiXSwicm9sZSI6IlVTRVIiLCJsZXZlbCI6Ik5PUk1BTCJ9.newsignature"
  },
  "message": "Token刷新成功",
  "timestamp": "2024-01-01T12:30:00Z"
}
```

### 2.2 用户登出

**接口地址**: `POST /logout`

**描述**: 用户登出系统，将令牌加入黑名单

**权限要求**: 需要登录

**请求体**: 无

**响应示例**:
```json
{
  "success": true,
  "data": null,
  "message": "登出成功",
  "timestamp": "2024-01-01T13:00:00Z"
}
```

## 3. 微信相关接口

### 3.1 获取微信用户信息

**接口地址**: `GET /wechat/userinfo`

**描述**: 通过access_token获取微信用户信息

**权限要求**: 需要有效的微信access_token

**查询参数**:
- `access_token`: 微信access_token
- `openid`: 用户openid

**响应示例**:
```json
{
  "success": true,
  "data": {
    "openid": "ox1234567890abcdef",
    "nickname": "张三",
    "sex": 1,
    "province": "广东",
    "city": "深圳",
    "country": "中国",
    "headimgurl": "https://thirdwx.qlogo.cn/...",
    "privilege": [],
    "unionid": "ux1234567890abcdef"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.2 获取微信Access Token

**接口地址**: `GET /wechat/access-token`

**描述**: 使用code获取微信access_token

**权限要求**: 无需认证

**查询参数**:
- `code`: 微信授权码

**响应示例**:
```json
{
  "success": true,
  "data": {
    "access_token": "28_ACCESS_TOKEN",
    "expires_in": 7200,
    "refresh_token": "28_REFRESH_TOKEN",
    "openid": "ox1234567890abcdef",
    "scope": "snsapi_base",
    "unionid": "ux1234567890abcdef"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 4. JWT Token 结构说明

### 4.1 Token Payload

```json
{
  "sub": "user_001",           // 用户ID
  "scope": ["active", "user"], // 权限范围
  "role": "USER",              // 角色：USER/ADMIN
  "level": "NORMAL",           // 用户等级：NORMAL/VIP/STAR_1~STAR_5/DIRECTOR
  "iat": 1704067200,           // 签发时间
  "exp": 1704675600            // 过期时间
}
```

### 4.2 权限等级说明

| 等级 | 说明 | 权限范围 |
|------|------|----------|
| NORMAL | 普通会员 | 基础购买、查看 |
| VIP | VIP会员 | 享受VIP价格、专属服务 |
| STAR_1 | 1星店长 | 团队管理、一级佣金 |
| STAR_2 | 2星店长 | 团队管理、二级佣金 |
| STAR_3 | 3星店长 | 团队管理、三级佣金 |
| STAR_4 | 4星店长 | 团队管理、四级佣金 |
| STAR_5 | 5星店长 | 团队管理、五级佣金 |
| DIRECTOR | 董事 | 全部权限、系统管理 |
| ADMIN | 管理员 | 系统管理权限 |

## 5. 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| USER_NOT_FOUND | 404 | 用户不存在 |
| INVALID_CREDENTIALS | 401 | 用户名或密码错误 |
| USER_INACTIVE | 401 | 用户账户已被禁用 |
| INVALID_REFRESH_TOKEN | 401 | 刷新Token无效或已过期 |
| WECHAT_LOGIN_FAILED | 500 | 微信登录失败 |
| TOKEN_GENERATION_FAILED | 500 | Token生成失败 |

## 6. SDK 示例

### JavaScript/TypeScript

```typescript
class AuthService {
  private baseURL = 'http://localhost:3000/api/v1/auth';
  private token: string | null = null;
  private refreshToken: string | null = null;

  // 用户名密码登录
  async login(username: string, password: string) {
    const response = await fetch(`${this.baseURL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();
    if (result.success) {
      this.token = result.data.token;
      this.refreshToken = result.data.refreshToken;
      localStorage.setItem('token', this.token);
      localStorage.setItem('refreshToken', this.refreshToken);
    }
    return result;
  }

  // 微信登录
  async wechatLogin(code: string, nickname?: string, avatarUrl?: string) {
    const response = await fetch(`${this.baseURL}/wechat-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, nickname, avatarUrl })
    });

    const result = await response.json();
    if (result.success) {
      this.token = result.data.token;
      this.refreshToken = result.data.refreshToken;
      localStorage.setItem('token', this.token);
      localStorage.setItem('refreshToken', this.refreshToken);
    }
    return result;
  }

  // 刷新Token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseURL}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    const result = await response.json();
    if (result.success) {
      this.token = result.data.token;
      localStorage.setItem('token', this.token);
    }
    return result;
  }

  // 登出
  async logout() {
    if (this.token) {
      await fetch(`${this.baseURL}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
    }

    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  // 获取当前用户信息
  getCurrentUser() {
    if (!this.token) {
      return null;
    }

    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  }

  // 检查Token是否过期
  isTokenExpired() {
    const user = this.getCurrentUser();
    if (!user) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return user.exp < currentTime;
  }
}

// 使用示例
const authService = new AuthService();

// 用户名密码登录
const loginResult = await authService.login('13800138000', '123456');
if (loginResult.success) {
  console.log('登录成功', loginResult.data.user);
}

// 微信登录
const wechatResult = await authService.wechatLogin(
  '071XPGGa1l5yRp2KlSGa1mYvD83XPGGk',
  '张三',
  'https://example.com/avatar.jpg'
);

// 自动刷新Token
if (authService.isTokenExpired()) {
  await authService.refreshAccessToken();
}
```

### 小程序示例

```javascript
// pages/login/login.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    hasUserInfo: false
  },

  // 微信授权登录
  onWechatLogin() {
    wx.login({
      success: async (res) => {
        if (res.code) {
          // 获取用户信息
          wx.getUserProfile({
            desc: '用于完善用户资料',
            success: async (userRes) => {
              // 调用后端登录接口
              const response = await wx.request({
                url: 'http://localhost:3000/api/v1/auth/wechat-login',
                method: 'POST',
                data: {
                  code: res.code,
                  nickname: userRes.userInfo.nickName,
                  avatarUrl: userRes.userInfo.avatarUrl
                }
              });

              if (response.data.success) {
                // 保存token
                wx.setStorageSync('token', response.data.data.token);
                wx.setStorageSync('refreshToken', response.data.data.refreshToken);

                // 跳转到首页
                wx.switchTab({
                  url: '/pages/index/index'
                });
              }
            }
          });
        }
      }
    });
  },

  // 手机号登录
  async onPhoneLogin(e) {
    const { code } = e.detail;

    // 获取手机号
    const phoneRes = await wx.request({
      url: 'http://localhost:3000/api/v1/auth/wechat/get-phone-number',
      method: 'POST',
      data: { code }
    });

    if (phoneRes.data.success) {
      const phoneNumber = phoneRes.data.data.phoneNumber;

      // 使用手机号登录
      const response = await wx.request({
        url: 'http://localhost:3000/api/v1/auth/login',
        method: 'POST',
        data: {
          username: phoneNumber,
          password: '123456' // 或使用短信验证码
        }
      });

      if (response.data.success) {
        wx.setStorageSync('token', response.data.data.token);
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    }
  }
});
```

## 7. 最佳实践

### 7.1 安全建议

1. **密码安全**
   - 密码使用SHA-256哈希存储
   - 前端传输时使用HTTPS
   - 建议使用复杂密码策略

2. **Token管理**
   - Token设置合理的过期时间（7天）
   - 刷新Token也应有过期时间
   - 登出时将Token加入黑名单

3. **防刷措施**
   - 实施登录频率限制
   - 验证码机制
   - 异地登录提醒

### 7.2 业务规则

1. **用户状态管理**
   - ACTIVE: 正常用户
   - INACTIVE: 已禁用用户
   - PENDING: 待审核用户

2. **权限控制**
   - 基于用户等级的功能访问控制
   - API接口权限验证
   - 敏感操作需要二次验证

3. **登录策略**
   - 支持多端同时登录
   - 自动Token刷新机制
   - 登录日志记录

### 7.3 性能优化

1. **缓存策略**
   - 用户信息缓存
   - Token白名单缓存
   - 权限配置缓存

2. **数据库优化**
   - 用户表索引优化
   - 登录日志分表存储
   - 定期清理过期Token

## 8. 更新日志

- v1.0.0 (2024-01-01): 初始版本发布
  - 用户名密码登录
  - 微信小程序登录
  - JWT Token管理

- v1.1.0 (2024-01-15): 新增功能
  - 刷新Token机制
  - 用户等级权限体系
  - 登录日志记录

- v1.2.0 (2024-02-01): 安全增强
  - Token黑名单机制
  - 登录频率限制
  - 异地登录检测

- v1.3.0 (2024-03-01): 功能优化
  - 自动Token刷新
  - 多端登录管理
  - 社交账号绑定