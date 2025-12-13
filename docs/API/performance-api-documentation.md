# 中道商城性能监控模块 API 文档

## 概述

性能监控模块提供全面的系统性能监控和分析功能，包括实时性能指标、慢请求追踪、告警管理、趋势分析和性能优化建议等。

**基础信息**
- 基础URL: `http://localhost:3000/api/v1/performance`
- 认证方式: Bearer Token (JWT)
- 数据格式: JSON
- 监控版本: v2（支持智能采样和异步日志）

## 1. 性能概览

### 1.1 获取性能概览

**接口地址**: `GET /overview`

**描述**: 获取系统性能概览信息

**权限要求**: 可选认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-01T12:00:00Z",
    "summary": {
      "totalRequests": 15880,
      "averageResponseTime": 156,
      "errorRate": 0.02,
      "activeAlerts": 2,
      "bufferUtilization": 0.65
    },
    "percentiles": {
      "p50": 120,
      "p75": 180,
      "p90": 250,
      "p95": 320,
      "p99": 580
    },
    "alerts": [
      {
        "id": "alert_001",
        "type": "RESPONSE_TIME",
        "severity": "WARNING",
        "message": "平均响应时间超过阈值",
        "timestamp": "2024-01-01T11:55:00Z"
      }
    ],
    "recommendations": [
      {
        "type": "SLOW_QUERY",
        "message": "发现慢查询，建议优化数据库索引",
        "impact": "HIGH"
      }
    ],
    "config": {
      "thresholds": {
        "excellent": 100,
        "good": 200,
        "acceptable": 500,
        "slow": 1000,
        "critical": 2000
      },
      "sampling": {
        "sampleRate": 0.1,
        "maxSamples": 1000
      },
      "memory": {
        "alertThreshold": 0.9
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.2 获取慢路由列表

**接口地址**: `GET /slow-routes`

**描述**: 获取响应时间较慢的路由列表

**权限要求**: 需要管理员权限

**查询参数**:
- `limit`: 返回数量限制（默认20）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "slowRoutes": [
      {
        "path": "/api/v1/products",
        "method": "GET",
        "count": 1250,
        "avgTime": 580,
        "maxTime": 2100,
        "p95": 950,
        "status": "CRITICAL",
        "lastOccurrence": "2024-01-01T11:58:00Z"
      },
      {
        "path": "/api/v1/orders",
        "method": "POST",
        "count": 820,
        "avgTime": 420,
        "maxTime": 1800,
        "p95": 750,
        "status": "WARNING",
        "lastOccurrence": "2024-01-01T11:55:00Z"
      }
    ],
    "total": 2,
    "thresholds": {
      "excellent": 100,
      "good": 200,
      "acceptable": 500,
      "slow": 1000,
      "critical": 2000
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 2. 实时监控

### 2.1 性能数据流

**接口地址**: `GET /stream`

**描述**: 获取实时性能数据流（Server-Sent Events）

**权限要求**: 需要管理员权限

**响应示例**:
```
data: {"type":"init","data":{"summary":{"totalRequests":15880,...}}}

data: {"type":"metric","data":{"timestamp":1704067200,"duration":156,"status":200,"method":"GET","route":"/api/v1/products","userId":"user_001"}}

data: {"type":"alert","data":{"id":"alert_002","type":"MEMORY","severity":"CRITICAL","message":"内存使用率超过90%","timestamp":1704067200}}

: heartbeat
```

**事件类型**:
- `init`: 初始数据
- `metric`: 性能指标
- `alert`: 告警信息
- `heartbeat`: 心跳（每30秒）

### 2.2 系统健康状态

**接口地址**: `GET /health`

**描述**: 获取系统健康状态

**权限要求**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "warning",
    "timestamp": "2024-01-01T12:00:00Z",
    "uptime": 86400,
    "memory": {
      "heapUsed": 256.78,
      "heapTotal": 512.00,
      "external": 45.23,
      "rss": 320.56
    },
    "cpu": {
      "user": 12500000,
      "system": 8500000
    },
    "performance": {
      "monitor": {
        "version": "v2",
        "active": true,
        "features": {
          "smartSampling": true,
          "asyncLogging": true,
          "ringBuffer": true,
          "aggregation": true
        }
      },
      "stats": {
        "bufferUtilization": 0.65,
        "totalRequests": 15880,
        "averageResponseTime": 156,
        "errorRate": 0.02,
        "activeAlerts": 2
      },
      "config": {
        "sampleRates": {
          "sampleRate": 0.1,
          "maxSamples": 1000
        },
        "thresholds": {
          "excellent": 100,
          "good": 200,
          "acceptable": 500,
          "slow": 1000,
          "critical": 2000
        }
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 3. 告警管理

### 3.1 获取告警列表

**接口地址**: `GET /alerts`

**描述**: 获取性能告警列表

**权限要求**: 需要登录

**查询参数**:
- `type`: 告警类型筛选
- `severity`: 严重程度筛选
- `resolved`: 是否已解决（true/false）

**告警类型**:
- `RESPONSE_TIME`: 响应时间异常
- `ERROR_RATE`: 错误率过高
- `MEMORY`: 内存使用异常
- `CPU`: CPU使用异常
- `CONNECTION`: 连接数异常

**严重程度**:
- `LOW`: 低
- `MEDIUM`: 中
- `HIGH`: 高
- `CRITICAL`: 严重

**响应示例**:
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert_001",
        "type": "RESPONSE_TIME",
        "severity": "WARNING",
        "message": "平均响应时间超过阈值",
        "threshold": 500,
        "actualValue": 580,
        "timestamp": 1704067200,
        "resolved": false,
        "resolvedAt": null,
        "resolvedBy": null,
        "details": {
          "route": "/api/v1/products",
          "method": "GET",
          "affectedRequests": 1250
        }
      },
      {
        "id": "alert_002",
        "type": "MEMORY",
        "severity": "CRITICAL",
        "message": "内存使用率超过90%",
        "threshold": 0.9,
        "actualValue": 0.92,
        "timestamp": 1704067300,
        "resolved": false,
        "resolvedAt": null,
        "resolvedBy": null,
        "details": {
          "heapUsed": 470.4,
          "heapTotal": 512
        }
      }
    ],
    "total": 2
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.2 解决告警

**接口地址**: `POST /alerts/:alertId/resolve`

**描述**: 标记告警为已解决

**权限要求**: 需要登录

**路径参数**:
- `alertId`: 告警ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "alertId": "alert_001",
    "resolved": true,
    "resolvedAt": "2024-01-01T12:05:00Z"
  },
  "message": "告警已标记为解决",
  "timestamp": "2024-01-01T12:05:00Z"
}
```

## 4. 慢查询分析

### 4.1 获取慢查询列表

**接口地址**: `GET /slow-queries`

**描述**: 获取数据库慢查询列表

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "queries": [
      {
        "query": "SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC",
        "duration": 2500,
        "timestamp": "2024-01-01T11:58:00Z",
        "count": 15,
        "affectedRows": 1000,
        "database": "zhongdao_mall",
        "type": "SELECT",
        "suggestions": [
          "添加 created_at 索引",
          "考虑分页查询"
        ]
      },
      {
        "query": "SELECT u.*, p.* FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.level = ?",
        "duration": 1800,
        "timestamp": "2024-01-01T11:55:00Z",
        "count": 8,
        "affectedRows": 500,
        "database": "zhongdao_mall",
        "type": "SELECT",
        "suggestions": [
          "优化 JOIN 条件",
          "添加 level 索引"
        ]
      }
    ],
    "total": 2,
    "threshold": 1000
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 5. 趋势分析

### 5.1 获取性能趋势

**接口地址**: `GET /trends`

**描述**: 获取性能趋势数据

**权限要求**: 无需认证

**查询参数**:
- `period`: 时间周期（5m/15m/1h/6h/24h，默认1h）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period": "1h",
    "interval": 60000,
    "trends": [
      {
        "timestamp": "2024-01-01T11:00:00Z",
        "requests": 85,
        "averageResponseTime": 145,
        "errorRate": 0.01
      },
      {
        "timestamp": "2024-01-01T11:05:00Z",
        "requests": 92,
        "averageResponseTime": 168,
        "errorRate": 0.02
      },
      {
        "timestamp": "2024-01-01T11:10:00Z",
        "requests": 88,
        "averageResponseTime": 156,
        "errorRate": 0.015
      }
    ],
    "summary": {
      "minRequests": 80,
      "maxRequests": 95,
      "avgRequests": 87.5,
      "minResponseTime": 120,
      "maxResponseTime": 200,
      "avgResponseTime": 156.3
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 6. 配置管理

### 6.1 重置性能统计

**接口地址**: `POST /reset`

**描述**: 重置性能统计数据（仅管理员）

**权限要求**: 管理员

**响应示例**:
```json
{
  "success": true,
  "data": {
    "message": "Performance metrics reset successfully",
    "resetAt": "2024-01-01T12:00:00Z"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 6.2 更新配置

**接口地址**: `PUT /config`

**描述**: 更新性能监控配置（仅管理员）

**权限要求**: 管理员

**请求体**:
```json
{
  "sampleRate": 0.2,
  "thresholds": {
    "excellent": 80,
    "good": 150,
    "acceptable": 400,
    "slow": 800,
    "critical": 1500
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "message": "Configuration updated successfully",
    "config": {
      "sampleRate": 0.2,
      "thresholds": {
        "excellent": 80,
        "good": 150,
        "acceptable": 400,
        "slow": 800,
        "critical": 1500
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 7. 性能阈值说明

| 指标 | 优秀 | 良好 | 可接受 | 慢 | 严重 |
|------|------|------|--------|------|------|
| 响应时间(ms) | ≤100 | 100-200 | 200-500 | 500-1000 | >1000 |
| 错误率(%) | 0 | 0-0.1 | 0.1-0.5 | 0.5-1 | >1 |
| CPU使用率(%) | <50 | 50-70 | 70-85 | 85-95 | >95 |
| 内存使用率 | <70 | 70-80 | 80-90 | 90-95 | >95 |

## 8. 监控特性

### 8.1 智能采样
- 默认采样率：10%
- 自动调整：根据系统负载动态调整
- 采样策略：优先采样慢请求和错误请求

### 8.2 异步日志
- 批量写入：减少IO开销
- 队列缓冲：避免阻塞主线程
- 失败重试：确保数据不丢失

### 8.3 环形缓冲区
- 固定大小：避免内存溢出
- 自动覆盖：旧数据自动被新数据替换
- 高效检索：O(1)时间复杂度

## 9. 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 告警不存在 |
| INTERNAL_ERROR | 500 | 内部服务器错误 |
| BAD_REQUEST | 400 | 请求参数错误 |
| ALERT_NOT_FOUND | 404 | 告警不存在 |

## 10. SDK 示例

### JavaScript/TypeScript

```typescript
class PerformanceService {
  private baseURL = 'http://localhost:3000/api/v1/performance';
  private token: string;

  constructor(token?: string) {
    this.token = token || '';
  }

  private async request(endpoint: string, options?: RequestInit) {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    return response.json();
  }

  // 获取性能概览
  async getOverview() {
    return this.request('/overview');
  }

  // 获取慢路由
  async getSlowRoutes(limit = 20) {
    return this.request(`/slow-routes?limit=${limit}`);
  }

  // 获取告警列表
  async getAlerts(params?: {
    type?: string;
    severity?: string;
    resolved?: boolean;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/alerts${queryString ? '?' + queryString : ''}`);
  }

  // 解决告警
  async resolveAlert(alertId: string) {
    return this.request(`/alerts/${alertId}/resolve`, {
      method: 'POST'
    });
  }

  // 获取慢查询
  async getSlowQueries() {
    return this.request('/slow-queries');
  }

  // 获取性能趋势
  async getTrends(period = '1h') {
    return this.request(`/trends?period=${period}`);
  }

  // 获取系统健康状态
  async getHealth() {
    return this.request('/health');
  }

  // 监听实时性能数据
  listenToRealTimeMetrics(callback: (data: any) => void) {
    const eventSource = new EventSource(`${this.baseURL}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      eventSource.close();
    };

    return eventSource;
  }

  // 格式化响应时间
  formatResponseTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else {
      return `${(ms / 1000).toFixed(2)}s`;
    }
  }

  // 获取性能等级
  getPerformanceLevel(ms: number): string {
    if (ms <= 100) return 'excellent';
    if (ms <= 200) return 'good';
    if (ms <= 500) return 'acceptable';
    if (ms <= 1000) return 'slow';
    return 'critical';
  }
}

// 使用示例
const performanceService = new PerformanceService('admin-token');

// 获取性能概览
const overview = await performanceService.getOverview();
console.log(`总请求数: ${overview.data.summary.totalRequests}`);
console.log(`平均响应时间: ${performanceService.formatResponseTime(overview.data.summary.averageResponseTime)}`);

// 获取慢路由
const slowRoutes = await performanceService.getSlowRoutes(10);
slowRoutes.data.slowRoutes.forEach(route => {
  console.log(`慢路由: ${route.method} ${route.path} - ${performanceService.formatResponseTime(route.avgTime)}`);
});

// 监听实时性能数据
const eventSource = performanceService.listenToRealTimeMetrics((data) => {
  switch (data.type) {
    case 'metric':
      console.log(`请求: ${data.data.method} ${data.data.route} - ${data.data.duration}ms`);
      break;
    case 'alert':
      console.warn(`告警: ${data.data.message} (${data.data.severity})`);
      break;
  }
});

// 获取性能趋势
const trends = await performanceService.getTrends('24h');
console.log('24小时性能趋势:', trends.data.trends);

// 解决告警
const alerts = await performanceService.getAlerts({ resolved: false });
if (alerts.data.alerts.length > 0) {
  const alert = alerts.data.alerts[0];
  const result = await performanceService.resolveAlert(alert.id);
  if (result.success) {
    console.log(`告警 ${alert.id} 已解决`);
  }
}
```

### React 组件示例

```tsx
import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Alert, Table, Tag } from 'antd';
import { Line } from '@ant-design/plots';
import { PerformanceService } from '../services/performance';

const PerformanceMonitor: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const performanceService = new PerformanceService(localStorage.getItem('token') || '');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [overviewRes, alertsRes, trendsRes] = await Promise.all([
        performanceService.getOverview(),
        performanceService.getAlerts({ resolved: false }),
        performanceService.getTrends('1h')
      ]);

      setOverview(overviewRes.data);
      setAlerts(alertsRes.data.alerts);
      setTrends(trendsRes.data.trends);
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    const result = await performanceService.resolveAlert(alertId);
    if (result.success) {
      setAlerts(alerts.filter(alert => alert.id !== alertId));
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: { [key: string]: string } = {
      'LOW': 'green',
      'MEDIUM': 'orange',
      'HIGH': 'red',
      'CRITICAL': 'red'
    };
    return colors[severity] || 'default';
  };

  const columns = [
    {
      title: '告警类型',
      dataIndex: 'type',
      key: 'type'
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)}>{severity}</Tag>
      )
    },
    {
      title: '告警信息',
      dataIndex: 'message',
      key: 'message'
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: number) => new Date(timestamp * 1000).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <a onClick={() => handleResolveAlert(record.id)}>解决</a>
      )
    }
  ];

  const trendConfig = {
    data: trends,
    xField: 'timestamp',
    yField: 'averageResponseTime',
    smooth: true,
    point: {
      size: 3,
      shape: 'circle'
    }
  };

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总请求数"
              value={overview?.summary?.totalRequests}
              prefix="📊"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={overview?.summary?.averageResponseTime}
              suffix="ms"
              prefix="⏱️"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="错误率"
              value={(overview?.summary?.errorRate * 100).toFixed(2)}
              suffix="%"
              prefix="❌"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃告警"
              value={overview?.summary?.activeAlerts}
              prefix="⚠️"
              valueStyle={{ color: overview?.summary?.activeAlerts > 0 ? '#cf1322' : '#3f8600' }}
            />
          </Card>
        </Col>
      </Row>

      {alerts.length > 0 && (
        <Alert
          message={`当前有 ${alerts.length} 个活跃告警`}
          description="请及时查看并处理性能告警"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16}>
        <Col span={12}>
          <Card title="响应时间趋势（最近1小时）">
            <Line {...trendConfig} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="活跃告警">
            <Table
              columns={columns}
              dataSource={alerts}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default PerformanceMonitor;
```

## 11. 最佳实践

### 11.1 性能优化建议

1. **响应时间优化**
   - 添加数据库索引
   - 使用缓存减少查询
   - 优化算法复杂度
   - 减少外部服务调用

2. **内存管理**
   - 及时释放资源
   - 避免内存泄漏
   - 合理使用缓存
   - 监控内存使用

3. **并发处理**
   - 使用连接池
   - 实施请求限流
   - 异步处理耗时操作
   - 队列削峰填谷

### 11.2 监控策略

1. **监控指标**
   - 响应时间（P95/P99）
   - 吞吐量（QPS）
   - 错误率
   - 资源使用率

2. **告警设置**
   - 合理设置阈值
   - 分级告警机制
   - 避免告警风暴
   - 自动化处理

3. **数据分析**
   - 定期性能报告
   - 趋势分析
   - 容量规划
   - 性能基准测试

### 11.3 故障处理

1. **快速定位**
   - 分布式追踪
   - 日志聚合
   - 性能分析工具
   - 错误追踪

2. **应急响应**
   - 降级策略
   - 熔断机制
   - 自动扩容
   - 流量切换

3. **事后复盘**
   - 根因分析
   - 改进措施
   - 预防方案
   - 知识沉淀

## 12. 更新日志

- v2.0.0 (2024-01-01): 性能监控V2版本
  - 智能采样机制
  - 异步日志处理
  - 环形缓冲区
  - 实时数据流

- v2.1.0 (2024-01-15): 功能增强
  - 慢查询分析
  - 自定义告警规则
  - 性能优化建议
  - 批量操作支持

- v2.2.0 (2024-02-01): 新增功能
  - 分布式追踪集成
  - 自动性能报告
  - 预测性分析
  - 移动端适配

- v2.3.0 (2024-03-01): 优化改进
  - UI/UX优化
  - 数据可视化增强
  - 导出功能
  - API性能优化