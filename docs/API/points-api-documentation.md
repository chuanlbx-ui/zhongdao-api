# 中道商城积分模块 API 文档

## 概述

积分模块（通券系统）提供完整的积分管理功能，包括余额查询、转账、充值、流水记录、统计信息和冻结/解冻操作。

**基础信息**
- 基础URL: `http://localhost:3000/api/v1/points`
- 认证方式: Bearer Token (JWT)
- 数据格式: JSON
- 最小单位: 分（1元=100分）

## 1. 积分余额管理

### 1.1 获取用户积分余额

**接口地址**: `GET /balance`

**描述**: 获取当前用户的积分余额信息

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": "user_001",
    "availableBalance": 15880,
    "frozenBalance": 1200,
    "totalBalance": 17080,
    "lastUpdated": "2024-01-01T12:00:00Z"
  },
  "message": "获取通券余额成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**响应参数说明**:
| 参数 | 类型 | 说明 |
|------|------|------|
| availableBalance | number | 可用余额（分） |
| frozenBalance | number | 冻结余额（分） |
| totalBalance | number | 总余额（分） |
| lastUpdated | string | 最后更新时间 |

## 2. 积分转账

### 2.1 用户间转账

**接口地址**: `POST /transfer`

**描述**: 向其他用户转账积分

**权限要求**: 需要登录

**请求体**:
```json
{
  "toUserId": "user_002",
  "amount": 5000,
  "description": "朋友间转账"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| toUserId | string | 是 | 收款用户ID（25位） | "user_002" |
| amount | number | 是 | 转账金额（分） | 5000 |
| description | string | 否 | 转账说明（最多200字符） | "朋友间转账" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "transactionNo": "PFS202401010001",
    "fromUserId": "user_001",
    "toUserId": "user_002",
    "amount": 5000,
    "type": "TRANSFER",
    "description": "朋友间转账",
    "status": "SUCCESS",
    "createdAt": "2024-01-01T12:00:00Z",
    "balanceAfter": {
      "fromUser": 10880,
      "toUser": 15000
    }
  },
  "message": "转账成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2.2 管理员充值

**接口地址**: `POST /recharge`

**描述**: 管理员或董事向用户充值积分

**权限要求**: 管理员 或 董事

**请求体**:
```json
{
  "userId": "user_003",
  "amount": 10000,
  "description": "新用户奖励"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| userId | string | 是 | 充值用户ID（25位） | "user_003" |
| amount | number | 是 | 充值金额（分，最少100） | 10000 |
| description | string | 否 | 充值说明（最多200字符） | "新用户奖励" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "transactionNo": "PFR202401010001",
    "userId": "user_003",
    "amount": 10000,
    "type": "RECHARGE",
    "description": "新用户奖励",
    "status": "SUCCESS",
    "operatorId": "admin_001",
    "createdAt": "2024-01-01T12:00:00Z",
    "balanceAfter": 10000
  },
  "message": "充值成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2.3 批量充值

**接口地址**: `POST /batch-recharge`

**描述**: 批量向多个用户充值积分

**权限要求**: 管理员 或 董事

**请求体**:
```json
{
  "recharges": [
    {
      "userId": "user_004",
      "amount": 5000,
      "description": "活动奖励"
    },
    {
      "userId": "user_005",
      "amount": 3000,
      "description": "活动奖励"
    }
  ]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 2,
      "success": 2,
      "failed": 0
    },
    "results": [
      {
        "index": 0,
        "userId": "user_004",
        "amount": 5000,
        "success": true,
        "transactionNo": "PFR202401010002"
      },
      {
        "index": 1,
        "userId": "user_005",
        "amount": 3000,
        "success": true,
        "transactionNo": "PFR202401010003"
      }
    ],
    "errors": []
  },
  "message": "批量充值完成",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 3. 积分流水

### 3.1 获取交易记录

**接口地址**: `GET /transactions`

**描述**: 获取用户的积分交易流水记录

**权限要求**: 需要登录

**查询参数**:
- `page`: 页码（默认1）
- `perPage`: 每页数量（默认20，最大100）
- `type`: 交易类型筛选
- `startDate`: 开始日期（ISO8601格式）
- `endDate`: 结束日期（ISO8601格式）

**交易类型**:
- `PURCHASE`: 购买消费
- `TRANSFER`: 转账
- `RECHARGE`: 充值
- `WITHDRAW`: 提现
- `REFUND`: 退款
- `COMMISSION`: 佣金
- `REWARD`: 奖励
- `FREEZE`: 冻结
- `UNFREEZE`: 解冻

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "txn_001",
        "transactionNo": "PFS202401010001",
        "userId": "user_001",
        "type": "TRANSFER",
        "amount": 5000,
        "balance": 10880,
        "description": "朋友间转账",
        "relatedUserId": "user_002",
        "status": "SUCCESS",
        "createdAt": "2024-01-01T12:00:00Z",
        "updatedAt": "2024-01-01T12:00:00Z"
      },
      {
        "id": "txn_002",
        "transactionNo": "PFR202401010001",
        "userId": "user_001",
        "type": "RECHARGE",
        "amount": 10000,
        "balance": 15880,
        "description": "活动奖励",
        "operatorId": "admin_001",
        "status": "SUCCESS",
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "perPage": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "message": "获取通券流水成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 4. 积分统计

### 4.1 获取积分统计

**接口地址**: `GET /statistics`

**描述**: 获取用户的积分统计信息

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": "user_001",
    "balance": {
      "available": 15880,
      "frozen": 1200,
      "total": 17080
    },
    "statistics": {
      "totalIncome": 50000,
      "totalExpense": 32920,
      "totalTransferIn": 15000,
      "totalTransferOut": 5000,
      "totalRecharge": 30000,
      "totalCommission": 8000,
      "totalReward": 7000,
      "monthly": {
        "income": 8000,
        "expense": 5200,
        "transferIn": 2000,
        "transferOut": 1000
      },
      "weekly": {
        "income": 2000,
        "expense": 1300,
        "transferIn": 500,
        "transferOut": 200
      }
    },
    "trends": [
      {
        "date": "2024-01-01",
        "balance": 15880,
        "income": 1000,
        "expense": 520
      },
      {
        "date": "2023-12-31",
        "balance": 14800,
        "income": 800,
        "expense": 400
      }
    ],
    "rank": {
      "level": "VIP",
      "percentile": 85,
      "totalUsers": 10000
    }
  },
  "message": "获取通券统计成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 5. 积分冻结/解冻

### 5.1 冻结/解冻积分

**接口地址**: `POST /freeze`

**描述**: 冻结或解冻用户积分（管理员操作）

**权限要求**: 管理员 或 董事

**请求体**:
```json
{
  "userId": "user_006",
  "amount": 2000,
  "type": "FREEZE",
  "description": "违规处罚冻结"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| userId | string | 是 | 用户ID（25位） | "user_006" |
| amount | number | 是 | 金额（分） | 2000 |
| type | string | 是 | 操作类型：FREEZE/UNFREEZE | "FREEZE" |
| description | string | 否 | 操作说明（最多200字符） | "违规处罚冻结" |

**响应示例**:
```json
{
  "success": true,
  "data": null,
  "message": "冻结成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 6. 积分配置

### 6.1 转账限额说明

- **单次转账限额**: 10000分（100元）
- **每日转账限额**: 50000分（500元）
- **每月转账限额**: 200000分（2000元）
- **最小转账金额**: 1分

### 6.2 充值限额说明

- **单次充值限额**: 100000分（1000元）
- **每日充值限额**: 500000分（5000元）
- **管理员无充值限额**

### 6.3 手续费说明

- **用户间转账**: 免费
- **充值**: 免费
- **提现**: 2%手续费（最低2元）

## 7. 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| GET_BALANCE_FAILED | 400 | 获取积分余额失败 |
| INVALID_TRANSFER | 400 | 无效的转账（如给自己转账） |
| EXCEED_LIMIT | 400 | 超出转账/充值限额 |
| INSUFFICIENT_BALANCE | 400 | 积分余额不足 |
| TRANSFER_FAILED | 400 | 转账失败 |
| RECHARGE_FAILED | 400 | 充值失败 |
| BATCH_RECHARGE_FAILED | 500 | 批量充值失败 |
| FREEZE_FAILED | 400 | 冻结/解冻失败 |
| INSUFFICIENT_PERMISSIONS | 403 | 权限不足 |
| USER_NOT_FOUND | 404 | 用户不存在 |

## 8. SDK 示例

### JavaScript/TypeScript

```typescript
class PointsService {
  private baseURL = 'http://localhost:3000/api/v1/points';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request(endpoint: string, options?: RequestInit) {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options?.headers
      }
    });

    return response.json();
  }

  // 获取积分余额
  async getBalance() {
    return this.request('/balance');
  }

  // 转账
  async transfer(toUserId: string, amount: number, description?: string) {
    return this.request('/transfer', {
      method: 'POST',
      body: JSON.stringify({ toUserId, amount, description })
    });
  }

  // 获取交易记录
  async getTransactions(params?: {
    page?: number;
    perPage?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/transactions${queryString ? '?' + queryString : ''}`);
  }

  // 获取统计信息
  async getStatistics() {
    return this.request('/statistics');
  }

  // 管理员充值
  async recharge(userId: string, amount: number, description?: string) {
    return this.request('/recharge', {
      method: 'POST',
      body: JSON.stringify({ userId, amount, description })
    });
  }

  // 批量充值
  async batchRecharge(recharges: Array<{
    userId: string;
    amount: number;
    description?: string;
  }>) {
    return this.request('/batch-recharge', {
      method: 'POST',
      body: JSON.stringify({ recharges })
    });
  }

  // 格式化金额（分转元）
  formatAmount(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  // 转换为分（元转分）
  toCents(yuan: number): number {
    return Math.round(yuan * 100);
  }
}

// 使用示例
const pointsService = new PointsService('your-jwt-token');

// 获取余额
const balance = await pointsService.getBalance();
console.log(`当前余额: ${pointsService.formatAmount(balance.data.availableBalance)}元`);

// 转账
const transferResult = await pointsService.transfer(
  'user_002',
  pointsService.toCents(50), // 50元
  '朋友聚餐'
);

if (transferResult.success) {
  console.log(`转账成功，交易号: ${transferResult.data.transactionNo}`);
}

// 获取本月交易记录
const transactions = await pointsService.getTransactions({
  page: 1,
  perPage: 20,
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  type: 'TRANSFER'
});

// 获取统计信息
const statistics = await pointsService.getStatistics();
console.log(`总收入: ${pointsService.formatAmount(statistics.data.statistics.totalIncome)}元`);
```

### 小程序示例

```javascript
// utils/points.js
const app = getApp();

class PointsManager {
  // 获取余额
  static async getBalance() {
    const token = wx.getStorageSync('token');
    const response = await wx.request({
      url: `${app.globalData.apiBase}/api/v1/points/balance`,
      header: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      const balance = response.data.data;
      return {
        available: (balance.availableBalance / 100).toFixed(2),
        frozen: (balance.frozenBalance / 100).toFixed(2),
        total: (balance.totalBalance / 100).toFixed(2)
      };
    }
    return null;
  }

  // 转账
  static async transfer(toUserId, amount, description) {
    const token = wx.getStorageSync('token');
    const response = await wx.request({
      url: `${app.globalData.apiBase}/api/v1/points/transfer`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        toUserId,
        amount: Math.round(amount * 100), // 元转分
        description
      }
    });

    return response.data;
  }

  // 获取交易记录
  static async getTransactions(page = 1, type = '') {
    const token = wx.getStorageSync('token');
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: '20'
    });

    if (type) {
      params.append('type', type);
    }

    const response = await wx.request({
      url: `${app.globalData.apiBase}/api/v1/points/transactions?${params}`,
      header: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      const items = response.data.data.items.map(item => ({
        ...item,
        amount: (item.amount / 100).toFixed(2),
        balance: (item.balance / 100).toFixed(2),
        typeName: this.getTransactionTypeName(item.type)
      }));

      return {
        items,
        pagination: response.data.data.pagination
      };
    }
    return null;
  }

  // 获取交易类型名称
  static getTransactionTypeName(type) {
    const typeNames = {
      'PURCHASE': '购买',
      'TRANSFER': '转账',
      'RECHARGE': '充值',
      'WITHDRAW': '提现',
      'REFUND': '退款',
      'COMMISSION': '佣金',
      'REWARD': '奖励',
      'FREEZE': '冻结',
      'UNFREEZE': '解冻'
    };
    return typeNames[type] || type;
  }
}

// pages/transfer/transfer.js
Page({
  data: {
    balance: '0.00',
    transferAmount: '',
    toUserId: '',
    description: ''
  },

  async onLoad() {
    const balance = await PointsManager.getBalance();
    if (balance) {
      this.setData({ balance: balance.available });
    }
  },

  onAmountInput(e) {
    this.setData({
      transferAmount: e.detail.value
    });
  },

  async onTransfer() {
    const { transferAmount, toUserId, description } = this.data;

    if (!transferAmount || !toUserId) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    const amount = parseFloat(transferAmount);
    if (amount <= 0) {
      wx.showToast({
        title: '转账金额必须大于0',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '转账中...' });

    const result = await PointsManager.transfer(
      toUserId,
      amount,
      description || '积分转账'
    );

    wx.hideLoading();

    if (result.success) {
      wx.showToast({
        title: '转账成功',
        icon: 'success'
      });

      // 清空表单
      this.setData({
        transferAmount: '',
        toUserId: '',
        description: ''
      });

      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showToast({
        title: result.error?.message || '转账失败',
        icon: 'none'
      });
    }
  }
});
```

## 9. 最佳实践

### 9.1 安全建议

1. **转账安全**
   - 实施转账确认机制
   - 大额转账需要二次验证
   - 转账限额控制

2. **操作日志**
   - 记录所有积分操作日志
   - 敏感操作需要审计
   - 异常交易监控

3. **防作弊**
   - 实施转账频率限制
   - 检测异常转账模式
   - 冻结可疑账户

### 9.2 业务规则

1. **积分计算**
   - 1元 = 100积分（分）
   - 所有金额计算使用整数
   - 避免浮点数精度问题

2. **交易状态**
   - PENDING: 待处理
   - SUCCESS: 成功
   - FAILED: 失败
   - CANCELLED: 已取消

3. **余额管理**
   - 可用余额 + 冻结余额 = 总余额
   - 优先使用可用余额
   - 冻结余额不可用于交易

### 9.3 性能优化

1. **数据库优化**
   - 交易记录表分区存储
   - 创建合适的索引
   - 定期归档历史数据

2. **缓存策略**
   - 用户余额缓存
   - 统计数据缓存
   - 实时余额更新

3. **并发控制**
   - 使用事务确保一致性
   - 乐观锁防止并发问题
   - 异步处理非关键操作

## 10. 更新日志

- v1.0.0 (2024-01-01): 初始版本发布
  - 基础余额查询
  - 用户间转账
  - 交易记录查询

- v1.1.0 (2024-01-15): 新增功能
  - 管理员充值
  - 批量充值
  - 积分统计

- v1.2.0 (2024-02-01): 功能增强
  - 积分冻结/解冻
  - 转账限额控制
  - 交易类型扩展

- v1.3.0 (2024-03-01): 优化改进
  - 性能优化
  - 错误处理完善
  - 安全性增强