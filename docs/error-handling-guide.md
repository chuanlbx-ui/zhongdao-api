# 错误处理机制使用指南

## 概述

本文档介绍了中道商城系统的错误处理机制，包括后端API、H5前端和管理后台的完整错误处理方案。系统提供了统一的错误处理工具类、自动重试机制、降级方案和用户友好的错误提示。

## 架构设计

### 1. 统一错误处理工具类

位置: `src/shared/utils/errorHandler.ts`

```typescript
import { ErrorHandler, withRetry, withFallback, withRetryAndFallback } from '../../../shared/utils/errorHandler'
```

主要功能:
- 自动重试机制（指数退避）
- 降级数据提供
- 用户友好的错误消息
- 批量请求错误处理

### 2. 前端API客户端增强

H5前端: `D:\wwwroot\zhongdao-H5\src\api\enhanced-client.ts`
管理后台: `D:\wwwroot\zhongdao-admin\src\api\enhanced-client.ts`

特性:
- 集成重试和降级机制
- CSRF token 自动管理
- 请求/响应拦截
- 统一错误格式化

### 3. React Hook 支持

H5前端: `D:\wwwroot\zhongdao-H5\src\hooks\useApiError.ts`

提供组件级别的错误处理状态管理。

## 使用方法

### 后端API使用

```typescript
import { errorHandler } from '../shared/utils/errorHandler'

// 基础API调用
try {
  const result = await userService.getUserById(userId)
  return successResponse(result)
} catch (error) {
  const errorConfig = errorHandler.getErrorConfig(error)
  return errorResponse(errorConfig.userMessage, errorConfig.statusCode)
}

// 带重试的API调用
const result = await withRetry(
  () => externalPaymentService.processPayment(paymentData),
  { maxRetries: 3, retryDelay: 1000 }
)

// 带降级的API调用
const result = await withFallback(
  () => analyticsService.getReportData(),
  () => getDefaultReportData(),
  { silent: false }
)
```

### H5前端使用

#### 1. 基础API调用

```typescript
import { userApi } from '../api/enhanced-api'
import { useApiError } from '../hooks/useApiError'

const MyComponent = () => {
  const { executeApi, loading, error } = useApiError()

  const loadUser = async () => {
    const result = await executeApi(() => userApi.getProfile())
    if (result) {
      setUserInfo(result.data)
    }
  }

  return (
    <Button onClick={loadUser} loading={loading}>
      加载用户信息
    </Button>
  )
}
```

#### 2. 带重试的API调用

```typescript
const { executeWithRetry } = useApiError({
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1500
})

const loadDataWithRetry = async () => {
  const result = await executeWithRetry(() => productApi.getList())
  // 处理结果
}
```

#### 3. 带降级的API调用

```typescript
const { executeWithFallback } = useApiError({
  enableFallback: true
})

const loadWithFallback = async () => {
  const result = await executeWithFallback(
    () => pointsApi.getBalance(),
    () => ({ balance: 0, frozen: 0 }) // 降级数据
  )
  // 总是会有数据返回
}
```

#### 4. 批量API调用

```typescript
const { executeBatch } = useApiError()

const loadMultipleData = async () => {
  const { results, errors } = await executeBatch([
    () => userApi.getProfile(),
    () => pointsApi.getBalance(),
    () => productApi.getList()
  ], { continueOnError: true })

  // 处理结果和错误
}
```

### 管理后台使用

#### 1. 基础管理员操作

```typescript
import { userApi, adminApiClient } from '../api/enhanced-api'

const UserManagement = () => {
  const loadUsers = async () => {
    try {
      const result = await userApi.getList({ page: 1, perPage: 20 })
      // 处理用户列表
    } catch (error) {
      // 错误已自动处理和显示
    }
  }
}
```

#### 2. 权限检查

```typescript
const { hasPermission, isAdmin } = adminApiClient

// 在组件中使用
if (!hasPermission('user:delete')) {
  message.error('权限不足')
  return
}
```

#### 3. 批量操作

```typescript
const batchUpdateUsers = async (userIds: string[], status: string) => {
  const result = await userApi.batchUpdateStatus(userIds, status)
  // 自动重试和错误处理
}
```

## 配置选项

### useApiError Hook 配置

```typescript
const { executeApi } = useApiError({
  enableRetry: true,           // 启用重试
  maxRetries: 3,              // 最大重试次数
  retryDelay: 1000,           // 重试延迟(ms)
  enableFallback: true,       // 启用降级
  customErrorHandler: (error) => {
    // 自定义错误处理逻辑
  },
  showErrorNotification: true, // 显示错误通知
  silent: false               // 静默模式
})
```

### API客户端配置

```typescript
// 重试配置
const retryConfig = {
  maxRetries: 3,
  retryDelay: 1500,
  backoffMultiplier: 1.5
}

// 降级数据类型
const fallbackTypes = [
  'user/profile',
  'products/list',
  'orders/list',
  'points/balance',
  'admin/dashboard'
]
```

## 错误类型和处理

### 1. 网络错误
- **特征**: 连接超时、网络不可达
- **处理**: 自动重试、显示网络错误提示
- **降级**: 使用缓存数据

### 2. 认证错误
- **特征**: 401状态码、token过期
- **处理**: 清除认证信息、跳转登录页
- **降级**: 显示登录提示

### 3. 权限错误
- **特征**: 403状态码、权限不足
- **处理**: 显示权限错误提示
- **降级**: 隐藏相关功能

### 4. 验证错误
- **特征**: 422状态码、数据验证失败
- **处理**: 显示具体验证错误
- **降级**: 不适用，需要用户修正输入

### 5. 服务器错误
- **特征**: 500+状态码
- **处理**: 自动重试、显示服务不可用
- **降级**: 使用模拟数据

## 最佳实践

### 1. 错误消息设计
- 用户友好的错误描述
- 提供解决建议
- 区分错误严重程度

### 2. 重试策略
- 网络错误: 3次重试，指数退避
- 认证错误: 不重试，直接处理
- 服务器错误: 2次重试后降级

### 3. 降级数据设计
- 保持数据结构一致
- 提供有意义的默认值
- 明确标识降级状态

### 4. 用户体验
- 加载状态指示
- 错误状态反馈
- 操作结果确认

## 监控和日志

### 1. 错误监控
```typescript
// 错误统计
const errorStats = {
  networkErrors: 0,
  authErrors: 0,
  serverErrors: 0,
  customErrors: 0
}
```

### 2. 性能监控
```typescript
// 重试成功率
const retrySuccessRate = successCount / retryCount

// 降级使用率
const fallbackUsageRate = fallbackCount / totalRequestCount
```

### 3. 用户反馈
- 错误报告功能
- 用户体验调查
- 错误处理效果评估

## 测试策略

### 1. 单元测试
```typescript
describe('ErrorHandler', () => {
  it('should retry on network error', async () => {
    const mockApi = jest.fn().mockRejectedValue(new Error('Network error'))
    // 测试重试逻辑
  })

  it('should return fallback data on failure', async () => {
    // 测试降级逻辑
  })
})
```

### 2. 集成测试
- API调用完整流程测试
- 错误场景模拟测试
- 用户体验测试

### 3. 端到端测试
- 完整业务流程测试
- 错误恢复测试
- 降级功能测试

## 部署注意事项

### 1. 环境配置
```typescript
// 生产环境配置
const productionConfig = {
  maxRetries: 2,
  retryDelay: 2000,
  enableFallback: true,
  showErrorNotification: false
}

// 开发环境配置
const developmentConfig = {
  maxRetries: 1,
  retryDelay: 500,
  enableFallback: true,
  showErrorNotification: true
}
```

### 2. 性能优化
- 合理设置重试次数和延迟
- 优化降级数据生成
- 减少不必要的错误通知

### 3. 安全考虑
- 敏感信息不记录到日志
- 错误消息不泄露系统细节
- 防止错误信息被恶意利用

## 故障排除

### 1. 常见问题

**Q: API调用没有重试？**
A: 检查错误类型是否支持重试，确认enableRetry配置。

**Q: 降级数据没有生效？**
A: 检查fallbackType是否正确，确认降级数据生成器。

**Q: 错误提示没有显示？**
A: 检查showErrorNotification配置，确认自定义错误处理器。

### 2. 调试技巧
```typescript
// 启用详细日志
console.log('Error config:', errorHandler.getErrorConfig(error))

// 监控重试过程
let retryCount = 0
const retryWithLogging = withRetry(apiCall, {
  onRetry: (error, attempt) => {
    console.log(`Retry attempt ${attempt}:`, error.message)
    retryCount++
  }
})
```

## 总结

本错误处理机制提供了完整的从前端到后端的错误处理解决方案，确保用户在各种异常情况下都能获得良好的使用体验。通过合理配置和使用，可以显著提高应用的稳定性和用户满意度。

主要优势:
- 统一的错误处理架构
- 自动重试和降级机制
- 用户友好的错误提示
- 高度可配置和可扩展
- 完整的开发和调试支持

建议在开发过程中充分测试各种错误场景，确保错误处理机制的有效性和可靠性。