# 中道商城管理员系统增强指南

## 概述

本文档描述了中道商城管理员系统的增强功能，包括细粒度权限控制、审计日志系统、安全特性等。

## 新增功能

### 1. 细粒度权限控制系统

#### 权限定义
系统定义了以下权限类别：

- **用户管理权限**
  - `user:view` - 查看用户列表
  - `user:create` - 创建用户
  - `user:edit` - 编辑用户
  - `user:delete` - 删除用户
  - `user:suspend` - 停用/启用用户
  - `user:level_adjust` - 调整用户等级
  - `user:view_financial` - 查看用户财务信息

- **订单管理权限**
  - `order:view` - 查看订单列表
  - `order:detail` - 查看订单详情
  - `order:edit` - 编辑订单
  - `order:cancel` - 取消订单
  - `order:refund` - 订单退款
  - `order:ship` - 订单发货

- **财务管理权限**
  - `finance:view` - 查看财务报表
  - `finance:withdraw` - 提现审核
  - `finance:commission` - 佣金管理
  - `finance:recharge` - 充值管理
  - `finance:adjust` - 资金调整

- **系统配置权限**
  - `system:config` - 系统配置
  - `system:log` - 系统日志
  - `system:monitor` - 系统监控
  - `system:backup` - 系统备份
  - `system:maintenance` - 系统维护

#### 角色权限映射
- **SUPER_ADMIN** - 拥有所有权限
- **ADMIN** - 拥有除系统维护外的所有权限
- **OPERATOR** - 拥有基础查看和操作权限

### 2. 审计日志系统

#### 日志类型
- `LOGIN` - 登录
- `LOGOUT` - 登出
- `CREATE` - 创建
- `UPDATE` - 更新
- `DELETE` - 删除
- `VIEW` - 查看
- `EXPORT` - 导出
- `APPROVE` - 审批
- `REJECT` - 拒绝
- `SUSPEND` - 停用
- `ACTIVATE` - 激活
- `RESET_PASSWORD` - 重置密码
- `CHANGE_ROLE` - 更改角色
- `SENSITIVE_OPERATION` - 敏感操作
- `SYSTEM_CONFIG` - 系统配置
- `DATA_IMPORT` - 数据导入
- `BULK_OPERATION` - 批量操作

#### 日志级别
- `INFO` - 普通信息
- `WARNING` - 警告
- `ERROR` - 错误
- `CRITICAL` - 严重

#### 功能特性
- 自动记录所有管理员操作
- 支持日志查询和导出
- 实时告警机制
- 异常模式检测
- 自动日志清理（保留90天，严重日志永久保留）

### 3. 增强的安全特性

#### IP白名单
- 支持精确IP、CIDR、通配符格式
- 可配置不同角色的IP限制
- 自动记录IP违规尝试

#### 会话管理
- 可配置会话超时时间（默认2小时）
- 自动更新最后活动时间
- 会话超时自动登出

#### 二次确认
- 敏感操作需要二次确认
- 确认令牌有效期5分钟
- IP绑定验证

#### 安全事件日志
- 登录失败
- IP阻止
- 会话超时
- 可疑操作
- 令牌无效

## API接口

### 用户管理API
```
GET    /api/v1/admin/users-manage              # 获取用户列表
GET    /api/v1/admin/users-manage/:userId      # 获取用户详情
PUT    /api/v1/admin/users-manage/:userId      # 更新用户信息
POST   /api/v1/admin/users-manage/:userId/toggle-status  # 切换用户状态
POST   /api/v1/admin/users-manage/:userId/reset-password  # 重置用户密码
GET    /api/v1/admin/users-manage/:userId/team  # 获取用户团队结构
GET    /api/v1/admin/users-manage/:userId/points-transactions  # 获取用户积分流水
GET    /api/v1/admin/users-manage/export        # 导出用户数据
```

### 财务管理API
```
GET    /api/v1/admin/finance-manage/withdrawals # 获取提现申请列表
POST   /api/v1/admin/finance-manage/withdrawals/:withdrawalId/approve  # 审核提现申请
GET    /api/v1/admin/finance-manage/commissions  # 获取佣金结算列表
POST   /api/v1/admin/finance-manage/commissions/pay  # 批量支付佣金
GET    /api/v1/admin/finance-manage/refunds      # 获取退款申请列表
GET    /api/v1/admin/finance-manage/statistics   # 获取财务统计报表
POST   /api/v1/admin/finance-manage/adjust       # 资金调整
```

### 系统配置API
```
GET    /api/v1/admin/system-config-enhanced      # 获取系统配置列表
GET    /api/v1/admin/system-config-enhanced/:key # 获取系统配置详情
PUT    /api/v1/admin/system-config-enhanced/:key # 更新系统配置
PUT    /api/v1/admin/system-config-enhanced/batch # 批量更新系统配置
POST   /api/v1/admin/system-config-enhanced      # 创建系统配置
GET    /api/v1/admin/system-config-enhanced/:key/history  # 获取配置变更历史
GET    /api/v1/admin/system-config-enhanced/export      # 导出系统配置
POST   /api/v1/admin/system-config-enhanced/:key/reset  # 重置系统配置
```

## 使用示例

### 1. 权限检查中间件使用

```typescript
import { requirePermission, requireAnyPermission } from '@/shared/services/admin/permission.service';

// 单个权限检查
router.get('/users',
  authenticate,
  requirePermission('user:view'),
  async (req, res) => {
    // 处理逻辑
  }
);

// 多个权限检查（满足任一即可）
router.get('/dashboard',
  authenticate,
  requireAnyPermission(['dashboard:view', 'analytics:view']),
  async (req, res) => {
    // 处理逻辑
  }
);
```

### 2. 审计日志使用

```typescript
import { AuditService, AuditLogType, AuditLogLevel } from '@/shared/services/admin/audit.service';

// 手动记录审计日志
await AuditService.log({
  adminId: req.user.id,
  adminName: req.user.nickname,
  type: AuditLogType.UPDATE,
  level: AuditLogLevel.WARNING,
  module: 'user',
  action: 'update_user',
  targetId: userId,
  targetType: 'user',
  description: `更新用户信息：${nickname}`,
  details: { changes },
  ipAddress: req.ip,
  userAgent: req.get('User-Agent'),
});

// 使用审计中间件
router.post('/users/:id',
  authenticate,
  auditMiddleware(AuditLogType.UPDATE, 'user', 'update_user'),
  async (req, res) => {
    // 处理逻辑
  }
);
```

### 3. 安全特性使用

```typescript
import {
  requireIPWhitelist,
  checkSessionTimeout,
  requireConfirmation,
  checkSensitiveOperation
} from '@/shared/services/admin/security.service';

// IP白名单检查
router.use('/admin/*',
  authenticate,
  requireIPWhitelist
);

// 会话超时检查
router.use('/admin/*',
  authenticate,
  checkSessionTimeout
);

// 敏感操作二次确认
router.delete('/users/:id',
  authenticate,
  checkSensitiveOperation('delete_user'),
  requireConfirmation('delete_user'),
  async (req, res) => {
    // 处理逻辑
  }
);
```

## 配置说明

### 系统配置项

#### IP白名单配置
```json
{
  "key": "admin.ip_whitelist",
  "value": "[\"192.168.1.0/24\", \"10.0.0.1\", \"172.16.*.*\"]",
  "description": "管理员IP白名单",
  "type": "JSON"
}
```

#### 会话超时配置
```json
{
  "key": "admin.session_timeout",
  "value": "120",
  "description": "管理员会话超时时间（分钟）",
  "type": "NUMBER"
}
```

#### 二次确认配置
```json
{
  "key": "admin.require_2fa",
  "value": "true",
  "description": "是否启用敏感操作二次确认",
  "type": "BOOLEAN"
}
```

## 最佳实践

### 1. 权限管理
- 遵循最小权限原则
- 定期审查权限分配
- 使用角色继承简化管理

### 2. 安全操作
- 启用IP白名单限制
- 定期更换密码
- 监控异常登录

### 3. 审计日志
- 定期查看审计日志
- 关注CRITICAL级别事件
- 导出重要日志备份

### 4. 系统配置
- 重要配置变更前备份
- 使用配置变更历史追踪
- 测试环境验证后再应用

## 故障排查

### 1. 权限不足错误
- 检查用户角色和权限配置
- 确认权限字符串正确
- 查看审计日志了解详情

### 2. IP白名单问题
- 检查请求IP格式
- 验证白名单配置语法
- 查看安全日志

### 3. 会话超时
- 检查session_timeout配置
- 确认系统时间正确
- 查看最近活动时间

### 4. 二次确认失败
- 检查确认令牌是否过期
- 验证IP地址匹配
- 确认操作类型正确

## 更新日志

### v2.0.0 (2024-12-10)
- 实现细粒度权限控制系统
- 添加完整的审计日志功能
- 增强安全特性（IP白名单、会话管理、二次确认）
- 创建用户管理、财务管理、系统配置增强API
- 添加安全事件日志记录

## 联系支持

如有问题，请联系开发团队或查看项目文档。