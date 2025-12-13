# 中道商城 API 文档总索引

## 概述

本文档索引包含了中道商城系统所有核心模块的API文档。每个模块都有详细的接口说明、请求响应示例、错误码定义、SDK使用示例和最佳实践建议。

## 基础信息

- **基础URL**: `http://localhost:3000/api/v1`
- **认证方式**: Bearer Token (JWT)
- **数据格式**: JSON
- **API版本**: v1

## 模块文档列表

### 1. 商品模块
- **文档**: [products-api-documentation.md](./products-api-documentation.md)
- **功能**: 商品管理、分类管理、标签管理、搜索推荐、价格计算
- **特点**: 支持多规格、差异化定价、库存管理

### 2. 认证模块
- **文档**: [auth-api-documentation.md](./auth-api-documentation.md)
- **功能**: 用户登录、Token管理、微信登录、权限控制
- **特点**: JWT认证、多登录方式、等级权限体系

### 3. 积分模块
- **文档**: [points-api-documentation.md](./points-api-documentation.md)
- **功能**: 积分余额、转账充值、流水记录、统计分析
- **特点**: 交易安全、限额控制、冻结解冻

### 4. 库存模块
- **文档**: [inventory-api-documentation.md](./inventory-api-documentation.md)
- **功能**: 库存查询、调整调拨、预留释放、盘点管理
- **特点**: 多仓库支持、实时更新、预留机制

### 5. 团队模块
- **文档**: [teams-api-documentation.md](./teams-api-documentation.md)
- **功能**: 团队结构、成员管理、邀请机制、业绩统计
- **特点**: 多级团队、佣金体系、自动化管理

### 6. 性能监控模块
- **文档**: [performance-api-documentation.md](./performance-api-documentation.md)
- **功能**: 性能监控、慢查询分析、告警管理、趋势分析
- **特点**: 智能采样、实时监控、自动优化建议

### 7. 健康检查模块
- **文档**: [health-api-documentation.md](./health-api-documentation.md)
- **功能**: 健康检查、组件监控、指标收集、Kubernetes集成
- **特点**: 分级检查、自动恢复、Prometheus集成

### 8. 监控面板模块
- **文档**: [monitoring-api-documentation.md](./monitoring-api-documentation.md)
- **功能**: 监控面板、数据可视化、实时展示、告警展示
- **特点**: Web界面、实时更新、自定义面板

## 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone https://github.com/your-repo/zhongdao-mall.git
cd zhongdao-mall

# 安装依赖
npm install

# 启动开发环境
npm run dev
```

### 2. 获取访问令牌

```bash
# 使用curl登录
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "13800138000", "password": "123456"}'
```

### 3. 测试API

```bash
# 设置TOKEN
TOKEN="your-jwt-token-here"

# 获取商品列表
curl -X GET http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer $TOKEN"

# 获取用户积分余额
curl -X GET http://localhost:3000/api/v1/points/balance \
  -H "Authorization: Bearer $TOKEN"
```

## SDK使用

### JavaScript/TypeScript

```typescript
import { ApiService } from './services/api';

// 初始化API服务
const api = new ApiService('http://localhost:3000/api/v1');

// 登录
const loginResult = await api.auth.login({
  username: '13800138000',
  password: '123456'
});

// 设置Token
api.setToken(loginResult.data.token);

// 使用各个模块
const products = await api.products.list();
const balance = await api.points.getBalance();
const teamStructure = await api.teams.getStructure();
```

### 小程序

```javascript
// utils/api.js
const API_BASE = 'http://localhost:3000/api/v1';

// 封装请求方法
function request(url, options = {}) {
  const token = wx.getStorageSync('token');
  return wx.request({
    url: `${API_BASE}${url}`,
    header: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.header
    },
    ...options
  });
}

// 使用示例
async function getProducts() {
  const res = await request('/products');
  return res.data;
}
```

## 权限体系

### 用户等级

| 等级 | 权限范围 | 说明 |
|------|----------|------|
| NORMAL | 基础功能 | 普通会员 |
| VIP | 会员权益 | VIP会员 |
| STAR_1 | 团队管理 | 1星店长 |
| STAR_2 | 团队管理 | 2星店长 |
| STAR_3 | 团队管理 | 3星店长 |
| STAR_4 | 团队管理 | 4星店长 |
| STAR_5 | 团队管理 | 5星店长 |
| DIRECTOR | 全部权限 | 董事 |
| ADMIN | 系统管理 | 管理员 |

### 权限说明

- **读取权限**: 大部分API需要登录即可访问
- **写入权限**: 需要相应的用户等级
- **管理权限**: 仅管理员或董事可访问

## 错误处理

### 统一错误格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### 常见错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| VALIDATION_ERROR | 参数验证失败 | 检查请求参数 |
| UNAUTHORIZED | 未授权 | 检查Token是否有效 |
| FORBIDDEN | 权限不足 | 检查用户权限 |
| NOT_FOUND | 资源不存在 | 检查资源ID |
| RATE_LIMIT | 请求频率超限 | 降低请求频率 |
| INTERNAL_ERROR | 服务器错误 | 联系技术支持 |

## 最佳实践

### 1. 安全建议

- 始终使用HTTPS
- 定期更新Token
- 敏感数据加密传输
- 实施请求频率限制

### 2. 性能优化

- 使用分页避免大量数据
- 合理使用缓存
- 批量操作减少请求
- 异步处理耗时操作

### 3. 错误处理

- 实现重试机制
- 优雅降级策略
- 详细的错误日志
- 用户友好的错误提示

## 开发工具

### Postman集合

已提供完整的Postman集合文件：
- [zhongdao-mall-api.postman_collection.json](./zhongdao-mall-api.postman_collection.json)

### 环境配置

```json
{
  "name": "Local Development",
  "values": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api/v1"
    },
    {
      "key": "token",
      "value": ""
    }
  ]
}
```

### 在线文档

Swagger UI访问地址：
- 开发环境: http://localhost:3000/api-docs
- 生产环境: https://api.zhongdao-mall.com/api-docs

## 技术支持

- **文档问题**: 提交Issue到GitHub仓库
- **技术支持**: 技术支持邮箱 support@zhongdao-mall.com
- **开发者社区**: 开发者QQ群 123456789

## 更新日志

### v1.0.0 (2024-01-01)
- 初始版本发布
- 完整的API文档
- SDK示例代码
- 最佳实践指南

### v1.1.0 (2024-01-15)
- 新增批量操作API
- 优化错误处理
- 补充更多示例

### v1.2.0 (2024-02-01)
- 增加性能优化建议
- 完善权限说明
- 更新SDK示例

### v1.3.0 (2024-03-01)
- 添加实时API示例
- 补充监控相关文档
- 优化文档结构