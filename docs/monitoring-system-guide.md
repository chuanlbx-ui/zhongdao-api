# 中道商城 - 监控系统使用指南

## 概述

中道商城的监控系统是一个全面的生产就绪监控解决方案，提供业务指标监控、系统性能监控、健康检查、告警系统和可视化面板。

## 系统架构

```
监控系统
├── 核心组件
│   ├── 监控中心 (MonitoringCenter) - 统一管理
│   ├── 指标收集器 (MetricsCollector) - 收集性能指标
│   ├── 健康检查器 (HealthChecker) - 健康状态检查
│   └── 告警管理器 (AlertManager) - 告警处理
├── 业务监控
│   └── 业务指标收集器 (BusinessMetricsCollector)
├── 系统监控
│   └── 系统指标收集器 (SystemMetricsCollector)
├── 监控面板
│   └── 监控面板 (MonitoringPanel) - 数据可视化
└── 中间件集成
    └── 监控集成中间件
```

## 功能特性

### 1. 性能监控
- **响应时间监控**: 实时跟踪API响应时间
- **请求量统计**: 每秒请求数、错误率统计
- **百分位数分析**: P50, P90, P95, P99响应时间
- **热门路由分析**: 识别最繁忙的API端点
- **智能采样**: 根据性能动态调整采样率

### 2. 业务指标
- **用户指标**: 注册数、活跃用户、用户级别分布
- **订单指标**: 订单量、收入、转化率、取消率
- **支付指标**: 成功率、支付方式分布、失败原因
- **库存指标**: 低库存预警、缺货统计、库存周转率
- **佣金指标**: 佣金总额、待支付、已支付统计

### 3. 系统监控
- **CPU使用率**: 实时CPU使用率和负载
- **内存使用**: 堆内存、系统内存使用情况
- **磁盘空间**: 磁盘使用率和可用空间
- **网络流量**: 入站/出站流量统计
- **数据库连接**: 连接池状态和慢查询监控

### 4. 健康检查
- **数据库健康**: 连接状态和响应时间
- **缓存健康**: 缓存服务可用性
- **支付系统**: 支付网关连接状态
- **外部服务**: 第三方服务可用性
- **Kubernetes支持**: Liveness和Readiness探针

### 5. 告警系统
- **多渠道通知**: 控制台、邮件、短信、Webhook
- **告警抑制**: 防止告警风暴
- **告警升级**: 自动升级未处理告警
- **告警确认**: 支持告警确认和解决操作
- **智能规则**: 基于阈值的灵活告警规则

### 6. 监控面板
- **实时仪表板**: 系统状态实时展示
- **历史趋势**: 指标历史数据可视化
- **交互式图表**: 支持多时间范围查询
- **数据导出**: 支持CSV、JSON、Excel格式
- **访问控制**: IP白名单和权限验证

## API端点

### 健康检查
- `GET /health` - 基础健康检查
- `GET /api/v1/health` - 健康检查列表
- `GET /api/v1/health/detailed` - 详细健康报告
- `GET /api/v1/health/database` - 数据库健康状态
- `GET /api/v1/health/cache` - 缓存健康状态
- `GET /api/v1/health/payment` - 支付系统健康状态
- `GET /api/v1/health/ready` - 就绪状态检查
- `GET /api/v1/health/live` - 存活状态检查
- `GET /api/v1/health/metrics` - Prometheus格式指标

### 监控面板API
- `GET /api/v1/monitoring/dashboard` - 仪表板数据
- `GET /api/v1/monitoring/overview` - 系统概览
- `GET /api/v1/monitoring/realtime` - 实时数据
- `GET /api/v1/monitoring/history/:metric` - 历史数据
- `GET /api/v1/monitoring/alerts` - 告警列表
- `GET /api/v1/monitoring/business` - 业务指标
- `GET /api/v1/monitoring/metrics` - 完整监控报告
- `GET /api/v1/monitoring/export` - 导出数据
- `GET /api/v1/monitoring/status` - 监控中心状态
- `POST /api/v1/monitoring/acknowledge/:alertId` - 确认告警
- `POST /api/v1/monitoring/resolve/:alertId` - 解决告警

## 配置说明

### 环境变量
```bash
# 监控系统配置
NODE_ENV=development|staging|production

# 邮件通知配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@zhongdao.com
SMTP_PASS=password
SMTP_FROM=monitoring@zhongdao.com

# 短信通知配置
SMS_ACCESS_KEY_ID=your_access_key
SMS_ACCESS_KEY_SECRET=your_secret

# Webhook配置
WEBHOOK_URL=https://hooks.slack.com/xxx
```

## 使用指南

### 1. 启动监控系统
监控系统会在应用启动时自动初始化：

```bash
npm start
# 监控系统会随应用一起启动
```

### 2. 查看监控面板
访问监控面板API获取监控数据：

```bash
# 获取仪表板数据
curl http://localhost:3000/api/v1/monitoring/dashboard

# 获取系统概览
curl http://localhost:3000/api/v1/monitoring/overview
```

### 3. 健康检查
```bash
# 基础健康检查
curl http://localhost:3000/health

# 详细健康报告
curl http://localhost:3000/api/v1/health/detailed
```

### 4. 测试监控系统
运行测试脚本验证监控系统：

```bash
node test-monitoring-system.js
```

## 监控报告示例

访问 `/api/v1/monitoring/metrics` 获取完整的监控报告：

```json
{
  "success": true,
  "data": {
    "timestamp": "2024-12-11T10:30:00.000Z",
    "status": {
      "startTime": "2024-12-11T09:00:00.000Z",
      "uptime": 5400000,
      "components": {
        "metrics": true,
        "health": true,
        "alerts": true,
        "business": true,
        "system": true
      },
      "stats": {
        "totalRequests": 15420,
        "totalErrors": 142,
        "averageResponseTime": 145,
        "activeAlerts": 2
      }
    },
    "performance": {
      "totalRequests": 15420,
      "requestsPerSecond": 42.83,
      "errorRate": 0.92,
      "averageResponseTime": 145,
      "percentiles": {
        "p50": 120,
        "p90": 280,
        "p95": 450,
        "p99": 1200
      }
    },
    "business": {
      "users": {
        "registrations": { "daily": 45, "weekly": 280, "monthly": 1200 },
        "activeUsers": { "daily": 2500, "weekly": 8500, "monthly": 25000 }
      },
      "orders": {
        "total": 1250,
        "revenue": { "daily": 85000, "weekly": 520000, "monthly": 2100000 }
      }
    },
    "system": {
      "cpu": { "usage": 45.2, "cores": 8 },
      "memory": { "usage": 62.8, "total": 8192, "used": 5148 },
      "disk": { "usage": 35.6, "total": 500, "used": 178 }
    }
  }
}
```

## 故障排查

### 1. 监控系统无法启动
检查应用启动日志，寻找监控相关错误信息。

### 2. 健康检查失败
```bash
# 查看具体哪个检查失败
curl http://localhost:3000/api/v1/health/detailed | jq '.data.checks[] | select(.status != "healthy")'
```

### 3. 告警未发送
- 检查邮件/短信配置是否正确
- 确认告警规则是否启用
- 查看告警是否被抑制

## 更新日志

### v1.0.0 (2024-12-11)
- ✅ 实现完整的监控系统架构
- ✅ 支持性能、业务、系统指标监控
- ✅ 提供健康检查和告警功能
- ✅ 实现监控面板API
- ✅ 集成到主应用
- ✅ 提供完整的测试脚本