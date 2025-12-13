# 中道商城健康检查模块 API 文档

## 概述

健康检查模块提供全面的系统健康状态监控功能，包括基础健康检查、详细组件检查、数据库连接检查、缓存状态检查、支付系统检查和Kubernetes就绪状态检查等。

**基础信息**
- 基础URL: `http://localhost:3000/api/v1/health`
- 认证方式: 无需认证
- 数据格式: JSON
- 响应格式: 统一健康状态响应

## 1. 基础健康检查

### 1.1 存活状态检查

**接口地址**: `GET /` 或 `GET /live`

**描述**: 基础存活状态检查，用于负载均衡器和Kubernetes Liveness探针

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "uptime": 86400,
    "version": "1.0.0",
    "environment": "production"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**响应状态码**:
- `200`: 服务正常
- `503`: 服务异常

### 1.2 就绪状态检查

**接口地址**: `GET /ready`

**描述**: 就绪状态检查，用于Kubernetes Readiness探针

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "ready",
    "timestamp": "2024-01-01T12:00:00Z",
    "checks": {
      "database": "healthy",
      "cache": "healthy",
      "payments": "healthy"
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**响应状态码**:
- `200`: 服务就绪
- `503`: 服务未就绪

## 2. 详细健康检查

### 2.1 完整健康报告

**接口地址**: `GET /detailed`

**描述**: 获取所有组件的详细健康状态报告

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00Z",
    "uptime": 86400,
    "version": "1.0.0",
    "checks": [
      {
        "name": "database",
        "status": "healthy",
        "responseTime": 15,
        "lastCheck": "2024-01-01T12:00:00Z",
        "details": {
          "connectionPool": {
            "active": 5,
            "idle": 15,
            "total": 20
          },
          "latency": {
            "average": 12,
            "p95": 25,
            "p99": 40
          }
        },
        "consecutiveFailures": 0
      },
      {
        "name": "cache",
        "status": "healthy",
        "responseTime": 5,
        "lastCheck": "2024-01-01T12:00:00Z",
        "details": {
          "type": "Redis",
          "version": "6.2.7",
          "memory": {
            "used": "45.2MB",
            "max": "512MB",
            "percentage": 8.83
          },
          "connections": {
            "active": 3,
            "max": 100
          }
        },
        "consecutiveFailures": 0
      },
      {
        "name": "payments",
        "status": "healthy",
        "responseTime": 120,
        "lastCheck": "2024-01-01T12:00:00Z",
        "details": {
          "wechat": "healthy",
          "alipay": "healthy",
          "lastTransaction": "2024-01-01T11:58:30Z"
        },
        "consecutiveFailures": 0
      },
      {
        "name": "storage",
        "status": "degraded",
        "responseTime": 200,
        "lastCheck": "2024-01-01T12:00:00Z",
        "details": {
          "diskUsage": "85%",
          "availableSpace": "15.2GB",
          "totalSpace": "100GB"
        },
        "consecutiveFailures": 0
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 3. 组件健康检查

### 3.1 数据库健康检查

**接口地址**: `GET /database`

**描述**: 检查数据库连接和性能

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "name": "database",
    "status": "healthy",
    "responseTime": 15,
    "timestamp": "2024-01-01T12:00:00Z",
    "details": {
      "type": "MySQL",
      "version": "8.0.28",
      "host": "localhost:3306",
      "database": "zhongdao_mall",
      "connectionPool": {
        "active": 5,
        "idle": 15,
        "total": 20,
        "max": 50
      },
      "performance": {
        "queriesPerSecond": 125,
        "slowQueries": 2,
        "uptime": "15 days"
      },
      "replication": {
        "status": "enabled",
        "lag": "0s",
        "master": "db-master-01",
        "slaves": ["db-slave-01", "db-slave-02"]
      }
    },
    "consecutiveFailures": 0
  }
}
```

**响应状态码**:
- `200`: 数据库健康
- `503`: 数据库异常

### 3.2 缓存健康检查

**接口地址**: `GET /cache`

**描述**: 检查Redis缓存状态

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "name": "cache",
    "status": "healthy",
    "responseTime": 5,
    "timestamp": "2024-01-01T12:00:00Z",
    "details": {
      "type": "Redis",
      "version": "6.2.7",
      "mode": "standalone",
      "nodes": [
        {
          "host": "redis-01",
          "port": 6379,
          "role": "master",
          "status": "up"
        }
      ],
      "memory": {
        "used": "45.2MB",
        "peak": "52.8MB",
        "max": "512MB",
        "percentage": 8.83
      },
      "connections": {
        "active": 3,
        "max": 100,
        "blocked": 0
      },
      "stats": {
        "hits": 15280,
        "misses": 1200,
        "hitRate": 92.72,
        "operationsPerSecond": 85
      }
    },
    "consecutiveFailures": 0
  }
}
```

**响应状态码**:
- `200`: 缓存健康
- `503`: 缓存异常

### 3.3 支付系统健康检查

**接口地址**: `GET /payment`

**描述**: 检查支付系统各渠道状态

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "name": "payments",
    "status": "healthy",
    "responseTime": 120,
    "timestamp": "2024-01-01T12:00:00Z",
    "details": {
      "channels": {
        "wechat": {
          "status": "healthy",
          "lastCheck": "2024-01-01T12:00:00Z",
          "responseTime": 85,
          "lastTransaction": "2024-01-01T11:58:30Z"
        },
        "alipay": {
          "status": "healthy",
          "lastCheck": "2024-01-01T12:00:00Z",
          "responseTime": 95,
          "lastTransaction": "2024-01-01T11:57:15Z"
        }
      },
      "summary": {
        "totalChannels": 2,
        "healthyChannels": 2,
        "degradedChannels": 0,
        "unhealthyChannels": 0
      }
    },
    "consecutiveFailures": 0
  }
}
```

**响应状态码**:
- `200`: 支付系统健康
- `503`: 支付系统异常

## 4. 健康指标

### 4.1 Prometheus指标

**接口地址**: `GET /metrics`

**描述**: 获取Prometheus格式的健康检查指标

**权限要求**: 无需认证

**响应示例**:
```
# HELP health_check_status Health check status (1=healthy, 0=unhealthy)
# TYPE health_check_status gauge
health_check_status{name="database"} 1
health_check_status{name="cache"} 1
health_check_status{name="payments"} 1
health_check_status{name="storage"} 0

# HELP health_check_response_time Health check response time in milliseconds
# TYPE health_check_response_time gauge
health_check_response_time{name="database"} 15
health_check_response_time{name="cache"} 5
health_check_response_time{name="payments"} 120
health_check_response_time{name="storage"} 200

# HELP health_check_consecutive_failures Health check consecutive failures
# TYPE health_check_consecutive_failures gauge
health_check_consecutive_failures{name="database"} 0
health_check_consecutive_failures{name="cache"} 0
health_check_consecutive_failures{name="payments"} 0
health_check_consecutive_failures{name="storage"} 0
```

## 5. 健康状态说明

### 5.1 状态定义

| 状态 | 说明 | 处理建议 |
|------|------|----------|
| healthy | 组件正常工作 | 无需处理 |
| degraded | 组件性能下降但可用 | 监控并准备干预 |
| unhealthy | 组件不可用 | 立即处理 |
| disabled | 组件已禁用 | 正常状态，无需处理 |

### 5.2 检查频率

- **存活检查**: 每10秒
- **就绪检查**: 每30秒
- **详细检查**: 每60秒
- **组件检查**: 每30秒

### 5.3 失败阈值

- **连续失败次数**: 3次
- **超时时间**: 5秒
- **恢复延迟**: 30秒

## 6. Kubernetes配置示例

### 6.1 Deployment配置

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zhongdao-mall
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zhongdao-mall
  template:
    metadata:
      labels:
        app: zhongdao-mall
    spec:
      containers:
      - name: app
        image: zhongdao-mall:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /api/v1/health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/v1/health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 6.2 Service配置

```yaml
apiVersion: v1
kind: Service
metadata:
  name: zhongdao-mall-service
spec:
  selector:
    app: zhongdao-mall
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  healthCheckNodePort: 30001
  type: LoadBalancer
```

### 6.3 HPA配置

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: zhongdao-mall-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: zhongdao-mall
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 7. 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| HEALTH_CHECK_FAILED | 503 | 健康检查失败 |
| DETAILED_HEALTH_CHECK_FAILED | 503 | 详细健康检查失败 |
| DATABASE_CHECK_NOT_FOUND | 503 | 未找到数据库健康检查 |
| DATABASE_HEALTH_CHECK_FAILED | 503 | 数据库健康检查失败 |
| CACHE_CHECK_NOT_FOUND | 503 | 未找到缓存健康检查 |
| CACHE_HEALTH_CHECK_FAILED | 503 | 缓存健康检查失败 |
| PAYMENT_CHECK_NOT_FOUND | 503 | 未找到支付系统健康检查 |
| PAYMENT_HEALTH_CHECK_FAILED | 503 | 支付系统健康检查失败 |
| READINESS_CHECK_FAILED | 503 | 就绪状态检查失败 |
| LIVENESS_CHECK_FAILED | 503 | 存活状态检查失败 |

## 8. SDK 示例

### JavaScript/TypeScript

```typescript
class HealthCheckService {
  private baseURL = 'http://localhost:3000/api/v1/health';

  // 获取基础健康状态
  async getBasicHealth(): Promise<any> {
    const response = await fetch(`${this.baseURL}/`);
    return response.json();
  }

  // 获取存活状态
  async getLiveness(): Promise<any> {
    const response = await fetch(`${this.baseURL}/live`);
    return response.json();
  }

  // 获取就绪状态
  async getReadiness(): Promise<any> {
    const response = await fetch(`${this.baseURL}/ready`);
    return response.json();
  }

  // 获取详细健康报告
  async getDetailedHealth(): Promise<any> {
    const response = await fetch(`${this.baseURL}/detailed`);
    return response.json();
  }

  // 获取数据库健康状态
  async getDatabaseHealth(): Promise<any> {
    const response = await fetch(`${this.baseURL}/database`);
    return response.json();
  }

  // 获取缓存健康状态
  async getCacheHealth(): Promise<any> {
    const response = await fetch(`${this.baseURL}/cache`);
    return response.json();
  }

  // 获取支付系统健康状态
  async getPaymentHealth(): Promise<any> {
    const response = await fetch(`${this.baseURL}/payment`);
    return response.json();
  }

  // 获取Prometheus指标
  async getMetrics(): Promise<string> {
    const response = await fetch(`${this.baseURL}/metrics`);
    return response.text();
  }

  // 健康检查轮询
  async pollHealth(intervalMs: number = 30000, callback: (data: any) => void): Promise<void> {
    const checkHealth = async () => {
      try {
        const health = await this.getDetailedHealth();
        callback(health);
      } catch (error) {
        callback({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };

    // 立即执行一次
    await checkHealth();

    // 设置定时器
    return setInterval(checkHealth, intervalMs);
  }

  // 判断整体健康状态
  isHealthy(healthData: any): boolean {
    if (!healthData.success) {
      return false;
    }

    // 检查基础状态
    if (healthData.data.status === 'unhealthy') {
      return false;
    }

    // 检查各个组件
    if (healthData.data.checks) {
      const unhealthyChecks = healthData.data.checks.filter(
        (check: any) => check.status === 'unhealthy'
      );

      // 允许部分组件降级，但不能有不可用的组件
      if (unhealthyChecks.length > 0) {
        // 检查是否有核心组件不可用
        const criticalComponents = ['database', 'cache'];
        const criticalUnhealthy = unhealthyChecks.some((check: any) =>
          criticalComponents.includes(check.name)
        );

        if (criticalUnhealthy) {
          return false;
        }
      }
    }

    return true;
  }

  // 获取健康状态摘要
  getHealthSummary(healthData: any): {
    status: string;
    healthy: number;
    degraded: number;
    unhealthy: number;
    total: number;
  } {
    if (!healthData.success || !healthData.data.checks) {
      return {
        status: 'unknown',
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        total: 0
      };
    }

    const checks = healthData.data.checks;
    const summary = {
      status: healthData.data.status,
      healthy: checks.filter((c: any) => c.status === 'healthy').length,
      degraded: checks.filter((c: any) => c.status === 'degraded').length,
      unhealthy: checks.filter((c: any) => c.status === 'unhealthy').length,
      total: checks.length
    };

    return summary;
  }
}

// 使用示例
const healthService = new HealthCheckService();

// 基础健康检查
const basicHealth = await healthService.getBasicHealth();
console.log(`服务状态: ${basicHealth.data.status}`);

// 详细健康检查
const detailedHealth = await healthService.getDetailedHealth();
const summary = healthService.getHealthSummary(detailedHealth);
console.log(`健康检查摘要: ${summary.healthy}/${summary.total} 健康`);

// 轮询健康状态
const pollInterval = await healthService.pollHealth(30000, (data) => {
  if (!healthService.isHealthy(data)) {
    console.error('服务异常！', data);
    // 发送告警通知
    sendAlert(data);
  } else {
    console.log('服务正常');
  }
});

// 获取Prometheus指标
const metrics = await healthService.getMetrics();
console.log('Prometheus指标:', metrics);

// 清理轮询
// clearInterval(pollInterval);
```

### React 组件示例

```tsx
import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Progress, Tag, Badge, Alert } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { HealthCheckService } from '../services/health';

const HealthMonitor: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const healthService = new HealthCheckService();

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    try {
      const data = await healthService.getDetailedHealth();
      setHealth(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'degraded':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'unhealthy':
        return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 70) return '#52c41a';
    if (percentage < 90) return '#faad14';
    return '#f5222d';
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  const summary = health ? healthService.getHealthSummary(health) : null;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Alert
            message={`系统状态: ${health?.data?.status || '未知'}`}
            description={`最后更新: ${lastUpdate?.toLocaleString()}`}
            type={health?.data?.status === 'healthy' ? 'success' : 'warning'}
            showIcon
          />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行时间"
              value={Math.floor((health?.data?.uptime || 0) / 3600)}
              suffix="小时"
              prefix="⏰"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="健康组件"
              value={summary?.healthy || 0}
              suffix={`/ ${summary?.total || 0}`}
              prefix="💚"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="降级组件"
              value={summary?.degraded || 0}
              prefix="💛"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="异常组件"
              value={summary?.unhealthy || 0}
              prefix="❌"
              valueStyle={{ color: (summary?.unhealthy || 0) > 0 ? '#f5222d' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {health?.data?.checks?.map((check: any) => (
          <Col span={8} key={check.name} style={{ marginBottom: 16 }}>
            <Card
              title={
                <span>
                  {getStatusIcon(check.status)}
                  <span style={{ marginLeft: 8 }}>
                    {check.name.toUpperCase()}
                  </span>
                  <Badge
                    status={getStatusColor(check.status) as any}
                    style={{ marginLeft: 8 }}
                  />
                </span>
              }
              extra={
                <Tag color={getStatusColor(check.status)}>
                  {check.responseTime}ms
                </Tag>
              }
            >
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8 }}>
                  状态: <strong>{check.status}</strong>
                </div>
                <div style={{ marginBottom: 8 }}>
                  连续失败: <strong>{check.consecutiveFailures}</strong>
                </div>
                <div>
                  最后检查: <strong>{new Date(check.lastCheck).toLocaleString()}</strong>
                </div>
              </div>

              {check.details && (
                <div>
                  <h4>详细信息:</h4>
                  {check.name === 'database' && (
                    <div>
                      <div>连接池: {check.details.connectionPool?.active}/{check.details.connectionPool?.total}</div>
                      <div>QPS: {check.details.performance?.queriesPerSecond}</div>
                    </div>
                  )}
                  {check.name === 'cache' && (
                    <div>
                      <div>内存使用: {check.details.memory?.used}/{check.details.memory?.max}</div>
                      <Progress
                        percent={parseFloat(check.details.memory?.percentage)}
                        strokeColor={getProgressColor(parseFloat(check.details.memory?.percentage))}
                        size="small"
                      />
                      <div>命中率: {check.details.stats?.hitRate}%</div>
                    </div>
                  )}
                  {check.name === 'payments' && (
                    <div>
                      <div>健康通道: {check.details.summary?.healthyChannels}/{check.details.summary?.totalChannels}</div>
                      <div>
                        {Object.entries(check.details.channels || {}).map(([channel, status]: [string, any]) => (
                          <Tag key={channel} color={status.status === 'healthy' ? 'green' : 'red'}>
                            {channel}: {status.status}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {check.name === 'storage' && (
                    <div>
                      <div>磁盘使用: {check.details.diskUsage}</div>
                      <Progress
                        percent={parseFloat(check.details.diskUsage)}
                        strokeColor={getProgressColor(parseFloat(check.details.diskUsage))}
                        size="small"
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default HealthMonitor;
```

## 9. 最佳实践

### 9.1 健康检查设计

1. **快速响应**
   - 健康检查应在5秒内完成
   - 避免复杂查询
   - 使用缓存结果

2. **合理分级**
   - 区分存活和就绪状态
   - 核心组件优先检查
   - 非关键组件降级不影响整体

3. **阈值设置**
   - 根据实际情况设置
   - 避免过于敏感
   - 预留缓冲时间

### 9.2 监控集成

1. **Prometheus集成**
   - 导出标准指标
   - 使用合适的标签
   - 配置告警规则

2. **告警配置**
   - 分级告警机制
   - 告警收敛策略
   - 自动化处理

3. **可视化**
   - Grafana仪表板
   - 健康状态大屏
   - 移动端适配

### 9.3 运维建议

1. **定期演练**
   - 故障注入测试
   - 恢复流程验证
   - 团队响应培训

2. **文档维护**
   - 更新健康检查配置
   - 记录故障处理流程
   - 分享最佳实践

3. **持续优化**
   - 监控指标调优
   - 检查逻辑优化
   - 性能瓶颈识别

## 10. 更新日志

- v1.0.0 (2024-01-01): 初始版本发布
  - 基础健康检查
  - 存活/就绪探针
  - 组件状态检查

- v1.1.0 (2024-01-15): 功能增强
  - 详细健康报告
  - Prometheus指标
  - 性能数据收集

- v1.2.0 (2024-02-01): 新增功能
  - Kubernetes集成
  - 自动恢复机制
  - 健康趋势分析

- v1.3.0 (2024-03-01): 优化改进
  - 检查逻辑优化
  - 并发检查支持
  - 配置热更新