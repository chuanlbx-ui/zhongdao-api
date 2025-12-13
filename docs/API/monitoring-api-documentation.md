# 中道商城监控面板模块 API 文档

## 概述

监控面板模块提供可视化的监控数据展示功能，包括系统概览、性能指标、业务数据、告警信息和实时数据流等。支持Web界面和API数据接口，方便集成到各类监控系统中。

**基础信息**
- 基础URL: `http://localhost:3000/api/v1/monitoring`
- 认证方式: Bearer Token (JWT)
- 数据格式: JSON
- 监控页面: `/monitoring/page`

## 1. 监控面板页面

### 1.1 访问监控页面

**接口地址**: `GET /page`

**描述**: 获取监控面板HTML页面

**权限要求**: 需要管理员权限

**响应**: HTML页面

**使用示例**:
```html
<!-- 直接在浏览器访问 -->
<a href="http://localhost:3000/api/v1/monitoring/page" target="_blank">打开监控面板</a>

<!-- 或在iframe中嵌入 -->
<iframe
  src="http://localhost:3000/api/v1/monitoring/page"
  width="100%"
  height="800px"
  frameborder="0">
</iframe>
```

## 2. 监控数据API

### 2.1 获取仪表盘数据

**接口地址**: `GET /dashboard`

**描述**: 获取监控面板的综合数据

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "system": {
        "cpu": 65.5,
        "memory": 78.2,
        "disk": 45.8
      },
      "performance": {
        "requests": 856,
        "errors": 12,
        "avgResponseTime": 156
      },
      "business": {
        "activeUsers": 1580,
        "orders": 320,
        "revenue": 158800
      },
      "alerts": {
        "critical": 2,
        "high": 5,
        "medium": 15,
        "low": 28
      }
    },
    "charts": {
      "requests": {
        "labels": ["5分钟前", "4分钟前", "3分钟前", "2分钟前", "1分钟前"],
        "datasets": [{
          "label": "请求数",
          "data": [750, 820, 780, 910, 856],
          "borderColor": "#1890ff",
          "backgroundColor": "rgba(24, 144, 255, 0.1)"
        }]
      },
      "responseTime": {
        "labels": ["5分钟前", "4分钟前", "3分钟前", "2分钟前", "1分钟前"],
        "datasets": [{
          "label": "响应时间(ms)",
          "data": [145, 168, 152, 195, 156],
          "borderColor": "#52c41a",
          "backgroundColor": "rgba(82, 196, 26, 0.1)"
        }]
      },
      "errorRate": {
        "labels": ["5分钟前", "4分钟前", "3分钟前", "2分钟前", "1分钟前"],
        "datasets": [{
          "label": "错误率(%)",
          "data": [1.2, 1.5, 1.3, 1.8, 1.4],
          "borderColor": "#ff4d4f",
          "backgroundColor": "rgba(255, 77, 79, 0.1)"
        }]
      }
    },
    "realTime": {
      "onlineUsers": 1580,
      "currentQPS": 85.6,
      "activeConnections": 245
    },
    "topPages": [
      {
        "path": "/api/v1/products",
        "visits": 2580,
        "avgTime": 145
      },
      {
        "path": "/api/v1/orders",
        "visits": 1820,
        "avgTime": 280
      },
      {
        "path": "/api/v1/users",
        "visits": 950,
        "avgTime": 120
      }
    ],
    "recentAlerts": [
      {
        "id": "alert_001",
        "level": "critical",
        "message": "CPU使用率超过90%",
        "timestamp": "2024-01-01T11:58:00Z"
      },
      {
        "id": "alert_002",
        "level": "high",
        "message": "响应时间异常",
        "timestamp": "2024-01-01T11:55:00Z"
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2.2 获取实时数据流

**接口地址**: `GET /realtime`

**描述**: 获取实时监控数据流（WebSocket或Server-Sent Events）

**权限要求**: 需要登录

**WebSocket示例**:
```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/monitoring/realtime');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('实时数据:', data);
};

// 接收的数据格式
{
  "type": "metric_update",
  "timestamp": 1704067200,
  "data": {
    "cpu": 68.5,
    "memory": 79.2,
    "requests": 880,
    "qps": 88.5
  }
}
```

**Server-Sent Events示例**:
```javascript
const eventSource = new EventSource('http://localhost:3000/api/v1/monitoring/realtime');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('实时数据:', data);
};

// 接收的数据格式
data: {"type":"system","cpu":68.5,"memory":79.2,"timestamp":1704067200}
data: {"type":"performance","requests":880,"avgTime":158,"timestamp":1704067201}
data: {"type":"business","orders":5,"revenue":2580,"timestamp":1704067202}
```

## 3. 详细监控数据

### 3.1 系统监控

**接口地址**: `GET /system`

**描述**: 获取系统资源监控数据

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "cpu": {
      "usage": 65.5,
      "cores": 8,
      "loadAverage": [1.2, 1.5, 1.8],
      "processes": 156
    },
    "memory": {
      "total": 8192,
      "used": 6400,
      "free": 1792,
      "usagePercentage": 78.2,
      "heap": {
        "used": 512,
        "total": 1024,
        "limit": 2048
      }
    },
    "disk": {
      "total": 500000,
      "used": 229000,
      "free": 271000,
      "usagePercentage": 45.8,
      "partitions": [
        {
          "mount": "/",
          "total": 100000,
          "used": 45000,
          "free": 55000
        },
        {
          "mount": "/data",
          "total": 400000,
          "used": 184000,
          "free": 216000
        }
      ]
    },
    "network": {
      "interfaces": [
        {
          "name": "eth0",
          "rx": 1258000,
          "tx": 856000,
          "speed": 1000
        }
      ]
    },
    "uptime": 86400
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.2 应用性能监控

**接口地址**: `GET /performance`

**描述**: 获取应用性能监控数据

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "requests": {
      "total": 15880,
      "success": 15868,
      "failed": 12,
      "successRate": 99.92,
      "currentQPS": 85.6
    },
    "responseTime": {
      "avg": 156,
      "min": 45,
      "max": 2850,
      "p50": 120,
      "p75": 180,
      "p90": 250,
      "p95": 320,
      "p99": 580
    },
    "topRoutes": [
      {
        "method": "GET",
        "path": "/api/v1/products",
        "count": 5280,
        "avgTime": 145,
        "errorRate": 0.5
      },
      {
        "method": "POST",
        "path": "/api/v1/orders",
        "count": 1820,
        "avgTime": 280,
        "errorRate": 1.2
      }
    ],
    "errors": {
      "total": 12,
      "byType": {
        "VALIDATION_ERROR": 5,
        "DATABASE_ERROR": 3,
        "TIMEOUT_ERROR": 2,
        "AUTHENTICATION_ERROR": 2
      },
      "recent": [
        {
          "timestamp": "2024-01-01T11:58:00Z",
          "path": "/api/v1/orders",
          "method": "POST",
          "status": 500,
          "message": "Database connection timeout"
        }
      ]
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.3 业务监控

**接口地址**: `GET /business`

**描述**: 获取业务指标监控数据

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 158000,
      "active": 1580,
      "new": 85,
      "online": 1580,
      "retention": {
        "day": 65.5,
        "week": 45.2,
        "month": 28.5
      }
    },
    "orders": {
      "today": 320,
      "pending": 25,
      "processing": 85,
      "completed": 195,
      "cancelled": 15,
      "totalAmount": 158800,
      "avgAmount": 496.25
    },
    "products": {
      "total": 5800,
      "active": 5200,
      "outOfStock": 125,
      "lowStock": 280,
      "topSelling": [
        {
          "id": "prod_001",
          "name": "有机蔬菜礼盒",
          "sales": 158,
          "revenue": 158800
        }
      ]
    },
    "revenue": {
      "today": 158800,
      "yesterday": 142500,
      "thisWeek": 856000,
      "thisMonth": 3580000,
      "growth": {
        "daily": 11.4,
        "weekly": 8.5,
        "monthly": 15.8
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.4 告警信息

**接口地址**: `GET /alerts`

**描述**: 获取告警信息

**权限要求**: 需要登录

**查询参数**:
- `level`: 告警级别筛选
- `status`: 状态筛选（active/resolved）
- `limit`: 返回数量限制

**响应示例**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 50,
      "critical": 2,
      "high": 5,
      "medium": 15,
      "low": 28,
      "active": 18,
      "resolved": 32
    },
    "alerts": [
      {
        "id": "alert_001",
        "level": "critical",
        "status": "active",
        "title": "CPU使用率过高",
        "message": "服务器CPU使用率持续超过90%",
        "source": "server-01",
        "timestamp": "2024-01-01T11:58:00Z",
        "duration": 300,
        "actions": [
          {
            "type": "restart",
            "label": "重启服务"
          },
          {
            "type": "scale",
            "label": "扩容"
          }
        ]
      },
      {
        "id": "alert_002",
        "level": "high",
        "status": "active",
        "title": "响应时间异常",
        "message": "API平均响应时间超过500ms",
        "source": "api-gateway",
        "timestamp": "2024-01-01T11:55:00Z",
        "duration": 180,
        "metrics": {
          "current": 580,
          "threshold": 500
        }
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 4. 自定义监控面板

### 4.1 创建自定义面板

**接口地址**: `POST /dashboards`

**描述**: 创建自定义监控面板

**权限要求**: 管理员

**请求体**:
```json
{
  "name": "业务监控面板",
  "description": "关键业务指标监控",
  "layout": [
    {
      "type": "metric",
      "title": "今日订单数",
      "metric": "business.orders.today",
      "position": { "x": 0, "y": 0, "w": 4, "h": 2 }
    },
    {
      "type": "chart",
      "title": "订单趋势",
      "chart": "orders_trend",
      "position": { "x": 4, "y": 0, "w": 8, "h": 4 }
    }
  ],
  "refreshInterval": 30
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "dashboard_001",
    "name": "业务监控面板",
    "createdBy": "admin_001",
    "createdAt": "2024-01-01T12:00:00Z"
  },
  "message": "监控面板创建成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 4.2 获取面板列表

**接口地址**: `GET /dashboards`

**描述**: 获取监控面板列表

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "dashboard_001",
      "name": "系统概览",
      "description": "系统整体运行状态",
      "isDefault": true,
      "createdBy": "system",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "dashboard_002",
      "name": "业务监控面板",
      "description": "关键业务指标监控",
      "isDefault": false,
      "createdBy": "admin_001",
      "createdAt": "2024-01-01T12:00:00Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 5. 监控配置

### 5.1 更新监控配置

**接口地址**: `PUT /config`

**描述**: 更新监控配置

**权限要求**: 管理员

**请求体**:
```json
{
  "refreshInterval": 30,
  "dataRetention": {
    "metrics": "7d",
    "logs": "3d",
    "alerts": "30d"
  },
  "notifications": {
    "email": {
      "enabled": true,
      "recipients": ["admin@example.com"]
    },
    "webhook": {
      "enabled": true,
      "url": "https://hooks.example.com/monitoring"
    }
  },
  "thresholds": {
    "cpu": 80,
    "memory": 85,
    "disk": 90,
    "responseTime": 500,
    "errorRate": 1
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "message": "监控配置更新成功"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 6. 数据导出

### 6.1 导出监控数据

**接口地址**: `GET /export`

**描述**: 导出监控数据（支持CSV、JSON、PDF格式）

**权限要求**: 需要登录

**查询参数**:
- `type`: 数据类型（system/performance/business）
- `format`: 导出格式（csv/json/pdf）
- `startDate`: 开始日期
- `endDate`: 结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "downloadUrl": "http://localhost:3000/api/v1/monitoring/download/export_20240101.csv",
    "filename": "monitoring_export_20240101.csv",
    "size": 2580000
  },
  "message": "导出任务创建成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 7. 监控集成

### 7.1 Prometheus集成

**接口地址**: `GET /prometheus`

**描述**: 获取Prometheus格式的监控指标

**权限要求**: 无需认证

**响应示例**:
```
# HELP zhongdao_requests_total Total number of requests
# TYPE zhongdao_requests_total counter
zhongdao_requests_total{method="GET",path="/api/v1/products",status="200"} 5280

# HELP zhongdao_request_duration_seconds Request duration in seconds
# TYPE zhongdao_request_duration_seconds histogram
zhongdao_request_duration_seconds_bucket{le="0.1"} 1250
zhongdao_request_duration_seconds_bucket{le="0.5"} 4580
zhongdao_request_duration_seconds_bucket{le="1.0"} 5200
zhongdao_request_duration_seconds_bucket{le="+Inf"} 5280

# HELP zhongdao_cpu_usage CPU usage percentage
# TYPE zhongdao_cpu_usage gauge
zhongdao_cpu_usage{host="server-01"} 65.5

# HELP zhongdao_memory_usage Memory usage percentage
# TYPE zhongdao_memory_usage gauge
zhongdao_memory_usage{host="server-01"} 78.2
```

### 7.2 Grafana集成

**接口地址**: `GET /grafana`

**描述**: 获取Grafana仪表板配置

**权限要求**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "dashboard": {
      "id": null,
      "title": "中道商城监控",
      "tags": ["zhongdao", "mall"],
      "timezone": "browser",
      "panels": [
        {
          "id": 1,
          "title": "请求QPS",
          "type": "graph",
          "targets": [
            {
              "expr": "rate(zhongdao_requests_total[5m])",
              "legendFormat": "{{method}} {{path}}"
            }
          ]
        },
        {
          "id": 2,
          "title": "响应时间",
          "type": "graph",
          "targets": [
            {
              "expr": "histogram_quantile(0.95, zhongdao_request_duration_seconds_bucket)",
              "legendFormat": "P95"
            }
          ]
        }
      ]
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 8. SDK 示例

### JavaScript/TypeScript

```typescript
class MonitoringService {
  private baseURL = 'http://localhost:3000/api/v1/monitoring';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options?: RequestInit) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        ...options?.headers
      }
    });

    return response.json();
  }

  // 获取仪表盘数据
  async getDashboard() {
    return this.request('/dashboard');
  }

  // 获取系统监控数据
  async getSystemMetrics() {
    return this.request('/system');
  }

  // 获取性能监控数据
  async getPerformanceMetrics() {
    return this.request('/performance');
  }

  // 获取业务监控数据
  async getBusinessMetrics() {
    return this.request('/business');
  }

  // 获取告警信息
  async getAlerts(params?: {
    level?: string;
    status?: string;
    limit?: number;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/alerts${queryString ? '?' + queryString : ''}`);
  }

  // 创建实时数据连接
  connectRealTime(callback: (data: any) => void) {
    // 使用Server-Sent Events
    const eventSource = new EventSource(
      `${this.baseURL}/realtime?token=${this.token}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      eventSource.close();
    };

    return eventSource;
  }

  // 创建WebSocket连接（如果支持）
  connectWebSocket(callback: (data: any) => void) {
    const ws = new WebSocket(
      `ws://localhost:3000/api/v1/monitoring/realtime?token=${this.token}`
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return ws;
  }

  // 导出监控数据
  async exportData(params: {
    type: string;
    format: string;
    startDate: string;
    endDate: string;
  }) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/export?${queryString}`);
  }

  // 格式化字节数
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 格式化百分比
  formatPercentage(value: number, decimals = 1): string {
    return `${value.toFixed(decimals)}%`;
  }

  // 获取状态颜色
  getStatusColor(status: string, value?: number): string {
    if (status === 'healthy') return '#52c41a';
    if (status === 'warning') return '#faad14';
    if (status === 'error') return '#f5222d';

    if (value !== undefined) {
      if (value < 70) return '#52c41a';
      if (value < 90) return '#faad14';
      return '#f5222d';
    }

    return '#1890ff';
  }
}

// 使用示例
const monitoringService = new MonitoringService('your-jwt-token');

// 获取仪表盘数据
const dashboard = await monitoringService.getDashboard();
console.log('系统CPU使用率:', dashboard.data.summary.system.cpu + '%');
console.log('当前在线用户:', dashboard.data.summary.business.activeUsers);

// 获取性能指标
const performance = await monitoringService.getPerformanceMetrics();
console.log('平均响应时间:', performance.data.responseTime.avg + 'ms');
console.log('成功率:', performance.data.requests.successRate + '%');

// 连接实时数据
const eventSource = monitoringService.connectRealTime((data) => {
  switch (data.type) {
    case 'system':
      console.log('系统数据:', data);
      // 更新系统监控图表
      updateSystemChart(data);
      break;
    case 'performance':
      console.log('性能数据:', data);
      // 更新性能监控图表
      updatePerformanceChart(data);
      break;
    case 'business':
      console.log('业务数据:', data);
      // 更新业务监控图表
      updateBusinessChart(data);
      break;
  }
});

// 导出监控数据
const export = await monitoringService.exportData({
  type: 'performance',
  format: 'csv',
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

if (export.success) {
  console.log('导出链接:', export.data.downloadUrl);
  // 自动下载
  window.open(export.data.downloadUrl);
}
```

### React 组件示例

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Statistic, Progress, Alert, Table, Tag } from 'antd';
import { Line, Bar } from '@ant-design/plots';
import { MonitoringService } from '../services/monitoring';

const MonitoringDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [realTimeData, setRealTimeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const eventSourceRef = useRef<EventSource | null>(null);

  const monitoringService = new MonitoringService(localStorage.getItem('token') || '');

  useEffect(() => {
    loadDashboard();
    connectRealTime();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await monitoringService.getDashboard();
      setDashboard(data.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectRealTime = () => {
    eventSourceRef.current = monitoringService.connectRealTime((data) => {
      setRealTimeData(data);
    });
  };

  const getStatusColor = (value: number) => {
    if (value < 70) return '#52c41a';
    if (value < 90) return '#faad14';
    return '#f5222d';
  };

  const requestsConfig = {
    data: dashboard?.charts?.requests || { labels: [], datasets: [] },
    xField: 'labels',
    yField: 'datasets[0].data',
    smooth: true,
    point: {
      size: 3,
      shape: 'circle'
    },
    color: '#1890ff'
  };

  const responseTimeConfig = {
    data: dashboard?.charts?.responseTime || { labels: [], datasets: [] },
    xField: 'labels',
    yField: 'datasets[0].data',
    smooth: true,
    point: {
      size: 3,
      shape: 'circle'
    },
    color: '#52c41a'
  };

  const alertColumns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => (
        <Tag color={level === 'critical' ? 'red' : level === 'high' ? 'orange' : 'yellow'}>
          {level.toUpperCase()}
        </Tag>
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
      render: (timestamp: string) => new Date(timestamp).toLocaleString()
    }
  ];

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      {/* 系统概览 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="CPU使用率"
              value={realTimeData?.system?.cpu || dashboard?.summary?.system?.cpu || 0}
              suffix="%"
              valueStyle={{
                color: getStatusColor(realTimeData?.system?.cpu || dashboard?.summary?.system?.cpu || 0)
              }}
            />
            <Progress
              percent={realTimeData?.system?.cpu || dashboard?.summary?.system?.cpu || 0}
              strokeColor={getStatusColor(realTimeData?.system?.cpu || dashboard?.summary?.system?.cpu || 0)}
              showInfo={false}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="内存使用率"
              value={realTimeData?.system?.memory || dashboard?.summary?.system?.memory || 0}
              suffix="%"
              valueStyle={{
                color: getStatusColor(realTimeData?.system?.memory || dashboard?.summary?.system?.memory || 0)
              }}
            />
            <Progress
              percent={realTimeData?.system?.memory || dashboard?.summary?.system?.memory || 0}
              strokeColor={getStatusColor(realTimeData?.system?.memory || dashboard?.summary?.system?.memory || 0)}
              showInfo={false}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前QPS"
              value={realTimeData?.performance?.qps || dashboard?.summary?.performance?.requests || 0}
              suffix="req/s"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="在线用户"
              value={realTimeData?.business?.onlineUsers || dashboard?.summary?.business?.activeUsers || 0}
              suffix="人"
            />
          </Card>
        </Col>
      </Row>

      {/* 告警信息 */}
      {dashboard?.recentAlerts?.length > 0 && (
        <Alert
          message={`当前有 ${dashboard.recentAlerts.length} 个活跃告警`}
          description={
            <div>
              {dashboard.recentAlerts.map((alert: any) => (
                <div key={alert.id}>
                  <Tag color={alert.level === 'critical' ? 'red' : 'orange'}>
                    {alert.level.toUpperCase()}
                  </Tag>
                  {alert.message}
                </div>
              ))}
            </div>
          }
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 图表展示 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card title="请求量趋势">
            <Line {...requestsConfig} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="响应时间趋势">
            <Line {...responseTimeConfig} />
          </Card>
        </Col>
      </Row>

      {/* 热门页面 */}
      <Card title="热门API" style={{ marginBottom: 16 }}>
        <Table
          dataSource={dashboard?.topPages}
          rowKey="path"
          pagination={false}
          size="small"
          columns={[
            { title: 'API路径', dataIndex: 'path' },
            { title: '访问次数', dataIndex: 'visits' },
            { title: '平均响应时间', dataIndex: 'avgTime', render: (v) => `${v}ms` }
          ]}
        />
      </Card>

      {/* 实时更新标识 */}
      <div style={{ textAlign: 'center', marginTop: 16, color: '#999' }}>
        {realTimeData ? (
          <span>
            <span style={{ color: '#52c41a' }}>●</span> 实时更新中
          </span>
        ) : (
          <span>等待实时数据...</span>
        )}
      </div>
    </div>
  );
};

export default MonitoringDashboard;
```

## 9. 最佳实践

### 9.1 监控面板设计

1. **信息层次**
   - 顶层：关键指标概览
   - 中层：详细数据展示
   - 底层：原始数据查看

2. **视觉设计**
   - 使用合适的颜色编码
   - 突出异常数据
   - 保持简洁清晰

3. **交互设计**
   - 支持钻取分析
   - 时间范围选择
   - 数据筛选功能

### 9.2 性能优化

1. **数据加载**
   - 按需加载数据
   - 使用缓存机制
   - 分页显示大量数据

2. **实时更新**
   - 使用WebSocket或SSE
   - 控制更新频率
   - 批量更新减少渲染

3. **资源优化**
   - 图片懒加载
   - 图表数据采样
   - 避免内存泄漏

### 9.3 告警策略

1. **告警分级**
   - Critical: 立即处理
   - High: 1小时内处理
   - Medium: 24小时内处理
   - Low: 可延迟处理

2. **通知渠道**
   - 邮件通知
   - 短信通知
   - 微信/钉钉群
   - Webhook回调

3. **告警收敛**
   - 相似告警合并
   - 避免告警风暴
   - 自动恢复检测

## 10. 更新日志

- v1.0.0 (2024-01-01): 初始版本发布
  - 基础监控面板
  - 实时数据展示
  - 告警信息展示

- v1.1.0 (2024-01-15): 功能增强
  - 自定义面板支持
  - 数据导出功能
  - 移动端适配

- v1.2.0 (2024-02-01): 集成增强
  - Prometheus集成
  - Grafana仪表板
  - 第三方监控集成

- v1.3.0 (2024-03-01): 优化改进
  - 性能优化
  - UI/UX改进
  - 实时性能提升