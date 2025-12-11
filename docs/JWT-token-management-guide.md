# JWT Token 管理指南

## 概述

本指南说明如何管理测试环境中的JWT token，解决token过期问题。

## 问题背景

测试文件中使用的JWT token有过期时间（默认24小时），当token过期后，测试会因认证失败而报错。为解决这个问题，我们提供了自动化工具来管理和更新测试token。

## 解决方案

### 1. 自动刷新脚本

我们创建了专门的脚本来管理测试token：

```bash
# 扫描所有测试文件，自动更新即将过期的token（6小时内）
npm run test:token:refresh

# 检查当前token状态和剩余有效时间
npm run test:token:check
```

### 2. 脚本功能

- **自动检测**: 扫描所有测试文件（`.test.ts` 和 `.test.js`）
- **智能判断**: 只更新即将过期（6小时内）或无效的token
- **批量更新**: 一次性更新所有相关文件
- **安全验证**: 验证JWT格式和签名正确性

### 3. 手动操作

如果需要手动生成新token：

```bash
# 生成新的token
node scripts/refresh-test-tokens.js generate
```

## 技术实现

### JWT 配置

```javascript
const JWT_SECRET = '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a';
const JWT_EXPIRES_IN = '24h';
const ISSUER = 'zhongdao-mall-test';
const AUDIENCE = 'zhongdao-mall-users';
```

### 测试用户配置

| 用户类型 | 用户ID | 手机号 | 角色 | 等级 |
|---------|--------|--------|------|------|
| 普通用户 | crho9e2hrp50xqkh2xum9rbp | 13800138001 | USER | NORMAL |
| 管理员 | ja4x4705a4emvkga2e73une | 13800138888 | ADMIN | DIRECTOR |

### Token 载荷格式

```javascript
{
  sub: "用户ID",
  phone: "手机号",
  role: "USER|ADMIN",
  level: "NORMAL|VIP|STAR_1-5|DIRECTOR",
  scope: ["active", "user"],
  type: "access"
}
```

## 使用建议

### 1. 持续集成流程

在运行测试前，建议先刷新token：

```bash
npm run test:token:refresh && npm test
```

### 2. 定期检查

在长期开发过程中，定期检查token状态：

```bash
npm run test:token:check
```

### 3. 问题排查

如果测试仍然报认证错误：

1. 检查环境变量`JWT_SECRET`是否正确
2. 确认测试文件中的token格式是否正确
3. 验证服务器时间是否与token签发时间一致

## 最佳实践

### 1. 不要手动编辑token

始终使用脚本更新token，避免手动编辑导致的格式错误。

### 2. 保持一致性

确保所有测试环境使用相同的JWT配置。

### 3. 安全考虑

测试token仅用于开发环境，不要在生产环境中使用。

### 4. 文档更新

当修改JWT配置时，及时更新本文档。

## 故障排除

### 常见错误

1. **Token过期**
   - 错误信息：`jwt expired`
   - 解决：运行 `npm run test:token:refresh`

2. **Token签名错误**
   - 错误信息：`invalid signature`
   - 解决：检查`JWT_SECRET`环境变量

3. **Token格式错误**
   - 错误信息：`jwt malformed`
   - 解决：重新生成token，确保格式正确

### 调试技巧

1. 使用在线JWT解码工具查看token内容
2. 检查服务器和客户端的时间同步
3. 验证token的iss、aud等声明是否匹配

## 相关文件

- `scripts/refresh-test-tokens.js` - Token管理脚本
- `tests/helpers/auth.helper.ts` - 认证辅助工具
- `tests/api/products.test.ts` - 示例测试文件（已更新token）

## 更新日志

- 2025-12-07: 创建token管理系统，解决测试token过期问题
- 添加自动刷新和状态检查功能