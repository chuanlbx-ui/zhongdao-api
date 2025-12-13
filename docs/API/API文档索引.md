# 中道商城系统 API 文档索引

本文档提供中道商城系统所有 API 模块的完整文档索引和快速导航。

## 文档分类

### 1. 核心业务模块 API

| 模块 | 文档 | 描述 | 状态 |
|------|------|------|------|
| 📝 [认证模块](./auth-api-documentation.md) | 用户认证、登录注册、JWT管理 | 微信登录、密码登录、用户信息管理 | ✅ 已完成 |
| 🏪 [商品模块](./products-api-documentation.md) | 商品管理、分类、规格、定价 | CRUD操作、多规格、差异化定价 | ✅ 已完成 |
| 💰 [积分模块](./points-api-documentation.md) | 通券（积分）管理系统 | 转账、充值、交易流水、统计 | ✅ 已完成 |
| 📦 [库存模块](./inventory-api-documentation.md) | 多仓库库存管理 | 库存查询、调拨、预警、预留 | ✅ 已完成 |
| 👥 [团队模块](./teams-api-documentation.md) | 团队层级管理 | 成员邀请、等级调整、业绩统计 | ✅ 已完成 |

### 2. 技术支撑模块 API

| 模块 | 文档 | 描述 | 状态 |
|------|------|------|------|
| 📊 [性能监控](./performance-api-documentation.md) | 系统性能监控 | 慢路由分析、实时指标、告警管理 | ✅ 已完成 |
| ❤️ [健康检查](./health-api-documentation.md) | 系统健康检查 | Kubernetes探针、组件健康状态 | ✅ 已完成 |
| 📈 [监控面板](./monitoring-api-documentation.md) | 监控数据面板 | 实时数据流、仪表板、告警展示 | ✅ 已完成 |

## 文档格式说明

### 📄 Markdown 文档
- **内容**: 详细的 API 说明、请求/响应示例、错误码说明
- **用途**: 开发参考、接口理解、业务逻辑查阅
- **查看**: 直接点击对应的 `.md` 文件

### 📋 OpenAPI 规范
- **文件**: `products-api-openapi.json`（示例）
- **用途**: Swagger UI 集成、API 测试工具导入
- **访问**: `http://localhost:3000/api-docs`

### 📦 Postman 集合
| 文件名 | 描述 | 用途 |
|--------|------|------|
| `zhongdao-mall-complete-api.postman_collection.json` | 完整API集合 | 包含所有模块的接口 |
| `zhongdao-mall-products-api.postman_collection.json` | 商品模块集合 | 专门测试商品相关接口 |
| `postman-environment.json` | 环境变量 | 配置开发/测试环境 |

### 💻 TypeScript 类型定义
- **文件**: `products-api-types.ts`（示例）
- **用途**: 前端开发时的类型提示和校验
- **集成**: 复制到前端项目的 types 目录

## 快速开始

### 1. 查看所有 API
```bash
# 启动服务
npm run dev

# 访问 Swagger UI
open http://localhost:3000/api-docs
```

### 2. 导入 Postman
```bash
# 1. 安装 Postman CLI
npm install -g postman-cli

# 2. 导入集合
postman collection import zhongdao-mall-complete-api.postman_collection.json

# 3. 设置环境变量
postman environment import postman-environment.json
```

### 3. 前端集成
```typescript
// 1. 安装 API 类型定义
cp docs/API/products-api-types.ts ./src/types/

// 2. 使用类型示例
import { Product, ProductListResponse } from '@/types';
```

## API 基础信息

- **基础 URL**: `http://localhost:3000/api/v1`
- **认证方式**: Bearer Token (JWT)
- **数据格式**: JSON
- **字符编码**: UTF-8

## 通用响应格式

```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "code": "SUCCESS",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 错误码规范

| 错误码范围 | 说明 | 示例 |
|------------|------|------|
| 200-299 | 成功 | SUCCESS, CREATED |
| 400-499 | 客户端错误 | INVALID_PARAMS, UNAUTHORIZED |
| 500-599 | 服务端错误 | INTERNAL_ERROR, DB_ERROR |
| 1000-1999 | 业务错误 | INSUFFICIENT_POINTS, PRODUCT_NOT_FOUND |

## 开发指南

### 1. API 调用示例

```javascript
// 获取用户信息
const response = await fetch('/api/v1/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const result = await response.json();
if (result.success) {
  console.log('用户信息:', result.data);
}
```

### 2. 错误处理

```javascript
try {
  const response = await apiCall();
  if (!response.success) {
    // 处理业务错误
    handleBusinessError(response.code, response.message);
  }
} catch (error) {
  // 处理网络或系统错误
  handleSystemError(error);
}
```

### 3. 分页处理

```javascript
// 分页参数
const params = {
  page: 1,
  perPage: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

// 分页响应
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## 测试账号

| 角色 | 手机号 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | 18800000001 | 123456 | 拥有所有权限 |
| 普通用户 | 13800138000 | 123456 | 默认权限 |
| VIP用户 | 13800138001 | 123456 | VIP权限 |

## 版本历史

- **v1.0.0** (2024-01-01): 初始版本发布
- **v1.1.0** (2024-01-15): 新增团队管理模块
- **v1.2.0** (2024-02-01): 优化性能监控
- **v1.3.0** (2024-03-01): 完善文档系统

## 贡献指南

1. **新增 API**: 需要更新对应的文档文件
2. **修改 API**: 同步更新文档和示例
3. **Bug 反馈**: 在 Issues 中提交问题
4. **文档改进**: 提交 Pull Request

## 联系方式

- **技术支持**: dev@zhongdao-mall.com
- **问题反馈**: [GitHub Issues](https://github.com/zhongdao-mall/api/issues)
- **开发交流**: [企业微信群]

---

📝 **注意**: 本文档会随着 API 的更新而持续更新，请定期查看最新版本。

最后更新时间: 2024-12-13