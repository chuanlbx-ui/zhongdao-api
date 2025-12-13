# 中道商城库存模块 API 文档

## 概述

库存模块提供全面的库存管理功能，包括库存查询、调整、调拨、盘点、预留和库存变动记录等。支持多仓库管理，确保库存数据的准确性和实时性。

**基础信息**
- 基础URL: `http://localhost:3000/api/v1/inventory`
- 认证方式: Bearer Token (JWT)
- 数据格式: JSON
- 支持的仓库类型：平台仓(PLATFORM)、云仓(CLOUD)、本地仓(LOCAL)

## 1. 库存查询

### 1.1 获取库存列表

**接口地址**: `GET /`

**描述**: 获取库存列表（支持分页和筛选）

**权限要求**: 需要登录（管理员可查看全部，用户只能查看自己的）

**查询参数**:
- `page`: 页码（默认1）
- `perPage`: 每页数量（默认10）
- `warehouseType`: 仓库类型筛选
- `productId`: 商品ID筛选

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "inv_001",
        "userId": "user_001",
        "productsId": "prod_001",
        "warehouseType": "PLATFORM",
        "quantity": 500,
        "availableQuantity": 480,
        "reservedQuantity": 20,
        "cost": 9500,
        "createdAt": "2024-01-01T10:00:00Z",
        "updatedAt": "2024-01-01T12:00:00Z",
        "products": {
          "id": "prod_001",
          "name": "有机蔬菜礼盒",
          "code": "VEG-001",
          "sku": "VEG-ORG-001",
          "basePrice": 9900
        }
      }
    ],
    "total": 100,
    "page": 1,
    "perPage": 10
  },
  "message": "获取库存列表成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.2 获取库存详情

**接口地址**: `GET /:id`

**描述**: 获取指定库存记录的详细信息

**权限要求**: 需要登录（管理员或库存所有者）

**路径参数**:
- `id`: 库存记录ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "inv_001",
    "userId": "user_001",
    "productsId": "prod_001",
    "warehouseType": "PLATFORM",
    "quantity": 500,
    "availableQuantity": 480,
    "reservedQuantity": 20,
    "cost": 9500,
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z",
    "products": {
      "id": "prod_001",
      "name": "有机蔬菜礼盒",
      "description": "精选有机蔬菜组合装",
      "code": "VEG-001",
      "sku": "VEG-ORG-001",
      "basePrice": 9900,
      "status": "active"
    }
  },
  "message": "获取库存详情成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.3 获取低库存预警

**接口地址**: `GET /low-stock`

**描述**: 获取低库存预警列表

**权限要求**: 管理员 或 董事

**查询参数**:
- `page`: 页码（默认1）
- `perPage`: 每页数量（默认10）
- `threshold`: 预警阈值（默认10）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "inv_002",
      "userId": "user_002",
      "productsId": "prod_002",
      "warehouseType": "CLOUD",
      "quantity": 8,
      "availableQuantity": 5,
      "reservedQuantity": 3,
      "cost": 12000,
      "products": {
        "id": "prod_002",
        "name": "新鲜水果礼盒",
        "code": "FRU-001",
        "sku": "FRU-FRE-001"
      }
    }
  ],
  "message": "获取低库存预警列表成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.4 查询商品库存

**接口地址**: `GET /products/:productId/stock`

**描述**: 查询指定商品在各个仓库的库存情况

**权限要求**: 需要登录

**路径参数**:
- `productId`: 商品ID

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "inv_001",
      "warehouseType": "PLATFORM",
      "quantity": 500,
      "availableQuantity": 480,
      "reservedQuantity": 20,
      "users": {
        "id": "user_001",
        "nickname": "张三",
        "phone": "13800138000"
      }
    },
    {
      "id": "inv_003",
      "warehouseType": "LOCAL",
      "quantity": 100,
      "availableQuantity": 95,
      "reservedQuantity": 5,
      "users": {
        "id": "user_003",
        "nickname": "李四",
        "phone": "13800138002"
      }
    }
  ],
  "message": "获取商品库存成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 2. 库存调整

### 2.1 手动调整库存

**接口地址**: `POST /adjust`

**描述**: 手动增加或减少库存数量

**权限要求**: 管理员 或 董事

**请求体**:
```json
{
  "inventoryId": "inv_001",
  "adjustmentType": "INCREASE",
  "quantity": 100,
  "reason": "新货入库",
  "costPrice": 9500
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| inventoryId | string | 是 | 库存记录ID | "inv_001" |
| adjustmentType | string | 是 | 调整类型：INCREASE/DECREASE | "INCREASE" |
| quantity | number | 是 | 调整数量（必须大于0） | 100 |
| reason | string | 是 | 调整原因 | "新货入库" |
| costPrice | number | 否 | 成本价（分） | 9500 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "inventoryId": "inv_001",
    "newQuantity": 600,
    "adjustmentType": "INCREASE",
    "quantity": 100
  },
  "message": "库存调整成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2.2 库存调拨

**接口地址**: `POST /transfer`

**描述**: 在不同仓库之间调拨库存

**权限要求**: 管理员 或 董事

**请求体**:
```json
{
  "fromInventoryId": "inv_001",
  "toInventoryId": "inv_003",
  "quantity": 50,
  "reason": "调拨至本地仓"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| fromInventoryId | string | 是 | 源库存记录ID | "inv_001" |
| toInventoryId | string | 是 | 目标库存记录ID | "inv_003" |
| quantity | number | 是 | 调拨数量（必须大于0） | 50 |
| reason | string | 是 | 调拨原因 | "调拨至本地仓" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "transferId": "cmi1234567890",
    "fromInventoryId": "inv_001",
    "toInventoryId": "inv_003",
    "quantity": 50
  },
  "message": "库存调拨成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2.3 库存盘点

**接口地址**: `POST /stocktake`

**描述**: 创建库存盘点任务，调整实际库存与系统库存的差异

**权限要求**: 管理员 或 董事

**请求体**:
```json
{
  "warehouseId": "wh_001",
  "items": [
    {
      "inventoryId": "inv_001",
      "systemQuantity": 500,
      "actualQuantity": 495,
      "reason": "盘点发现损耗"
    },
    {
      "inventoryId": "inv_002",
      "systemQuantity": 200,
      "actualQuantity": 210,
      "reason": "盘点发现盈余"
    }
  ],
  "remark": "2024年1月月度盘点"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| warehouseId | string | 是 | 仓库ID | "wh_001" |
| items | array | 是 | 盘点项目列表 | 见示例 |
| items[].inventoryId | string | 是 | 库存记录ID | "inv_001" |
| items[].systemQuantity | number | 是 | 系统数量 | 500 |
| items[].actualQuantity | number | 是 | 实际数量 | 495 |
| items[].reason | string | 否 | 差异原因 | "盘点发现损耗" |
| remark | string | 否 | 盘点备注 | "2024年1月月度盘点" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "stocktakeId": "cmi1234567890",
    "warehouseId": "wh_001",
    "itemsCount": 2,
    "remark": "2024年1月月度盘点"
  },
  "message": "库存盘点任务创建成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 3. 库存预留

### 3.1 预留库存

**接口地址**: `POST /reserve`

**描述**: 为订单预留库存，防止超卖

**权限要求**: 星级店长以上

**请求体**:
```json
{
  "inventoryId": "inv_001",
  "quantity": 10,
  "orderId": "order_001",
  "reason": "订单预留"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| inventoryId | string | 是 | 库存记录ID | "inv_001" |
| quantity | number | 是 | 预留数量（必须大于0） | 10 |
| orderId | string | 是 | 关联订单ID | "order_001" |
| reason | string | 否 | 预留原因 | "订单预留" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "inventoryId": "inv_001",
    "reservedQuantity": 10,
    "totalReservedQuantity": 30
  },
  "message": "库存预留成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.2 释放预留库存

**接口地址**: `POST /release`

**描述**: 释放预留的库存（取消订单或支付失败时）

**权限要求**: 星级店长以上

**请求体**:
```json
{
  "inventoryId": "inv_001",
  "quantity": 10,
  "orderId": "order_001"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| inventoryId | string | 是 | 库存记录ID | "inv_001" |
| quantity | number | 是 | 释放数量（必须大于0） | 10 |
| orderId | string | 是 | 关联订单ID | "order_001" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "inventoryId": "inv_001",
    "releasedQuantity": 10,
    "totalReservedQuantity": 20
  },
  "message": "库存释放成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 4. 库存变动记录

### 4.1 获取库存变动记录

**接口地址**: `GET /movements`

**描述**: 获取库存变动记录（入库、出库、调拨等）

**权限要求**: 需要登录（管理员可查看全部，用户只能查看自己的）

**查询参数**:
- `page`: 页码（默认1）
- `perPage`: 每页数量（默认10）
- `inventoryId`: 库存记录ID筛选
- `movementType`: 变动类型筛选
- `startDate`: 开始日期
- `endDate`: 结束日期

**变动类型**:
- `MANUAL_IN`: 手动入库
- `MANUAL_OUT`: 手动出库
- `SALE_OUT`: 销售出库
- `PURCHASE_IN`: 采购入库
- `TRANSFER_IN`: 调拨入库
- `TRANSFER_OUT`: 调拨出库
- `ADJUSTMENT`: 盘点调整
- `RETURN_IN`: 退货入库

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "log_001",
        "inventoryId": "inv_001",
        "operationType": "MANUAL_IN",
        "quantity": 100,
        "quantityBefore": 500,
        "quantityAfter": 600,
        "warehouseType": "PLATFORM",
        "adjustmentReason": "新货入库",
        "operatorId": "admin_001",
        "operatorType": "USER",
        "createdAt": "2024-01-01T12:00:00Z",
        "inventory": {
          "products": {
            "name": "有机蔬菜礼盒",
            "code": "VEG-001"
          }
        }
      }
    ],
    "total": 156,
    "page": 1,
    "perPage": 10
  },
  "message": "获取库存变动记录成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 5. 库存统计

### 5.1 获取库存汇总

**接口地址**: `GET /summary`

**描述**: 获取库存汇总统计信息

**权限要求**: 管理员 或 董事

**查询参数**:
- `warehouseType`: 仓库类型筛选
- `startDate`: 统计开始日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalItems": 1250,
    "totalValue": 15880000,
    "lowStockItems": 25,
    "outOfStockItems": 5,
    "warehouseType": "ALL",
    "breakdown": {
      "byWarehouse": [
        {
          "type": "PLATFORM",
          "items": 800,
          "value": 10240000
        },
        {
          "type": "CLOUD",
          "items": 300,
          "value": 3840000
        },
        {
          "type": "LOCAL",
          "items": 150,
          "value": 1800000
        }
      ],
      "byStatus": {
        "normal": 1220,
        "lowStock": 25,
        "outOfStock": 5
      }
    }
  },
  "message": "获取库存汇总信息成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 6. 仓库类型说明

| 仓库类型 | 代码 | 说明 |
|----------|------|------|
| 平台仓 | PLATFORM | 平方统一管理的中央仓库 |
| 云仓 | CLOUD | 第三方云仓服务商 |
| 本地仓 | LOCAL | 供应商或店长的本地仓库 |

## 7. 库存数量说明

| 字段 | 说明 | 计算方式 |
|------|------|----------|
| quantity | 总库存数量 | 入库 - 出库 + 调整 |
| availableQuantity | 可用数量 | quantity - reservedQuantity |
| reservedQuantity | 预留数量 | 订单预留但未出库的数量 |

## 8. 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| BUSINESS_RULE_VIOLATION | 400 | 违反业务规则 |
| INSUFFICIENT_STOCK | 400 | 库存不足 |
| INVALID_OPERATION | 400 | 无效的操作 |
| TRANSFER_FAILED | 500 | 调拨失败 |
| ADJUSTMENT_FAILED | 500 | 调整失败 |

## 9. SDK 示例

### JavaScript/TypeScript

```typescript
class InventoryService {
  private baseURL = 'http://localhost:3000/api/v1/inventory';
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

  // 获取库存列表
  async getInventoryList(params?: {
    page?: number;
    perPage?: number;
    warehouseType?: string;
    productId?: string;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/${queryString ? '?' + queryString : ''}`);
  }

  // 获取库存详情
  async getInventoryDetail(id: string) {
    return this.request(`/${id}`);
  }

  // 获取低库存预警
  async getLowStock(threshold = 10) {
    return this.request(`/low-stock?threshold=${threshold}`);
  }

  // 调整库存
  async adjustInventory(data: {
    inventoryId: string;
    adjustmentType: 'INCREASE' | 'DECREASE';
    quantity: number;
    reason: string;
    costPrice?: number;
  }) {
    return this.request('/adjust', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 库存调拨
  async transferInventory(data: {
    fromInventoryId: string;
    toInventoryId: string;
    quantity: number;
    reason: string;
  }) {
    return this.request('/transfer', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 预留库存
  async reserveInventory(data: {
    inventoryId: string;
    quantity: number;
    orderId: string;
    reason?: string;
  }) {
    return this.request('/reserve', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 释放预留库存
  async releaseInventory(data: {
    inventoryId: string;
    quantity: number;
    orderId: string;
  }) {
    return this.request('/release', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 获取库存变动记录
  async getMovements(params?: {
    page?: number;
    perPage?: number;
    inventoryId?: string;
    movementType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/movements${queryString ? '?' + queryString : ''}`);
  }

  // 获取库存汇总
  async getSummary(params?: {
    warehouseType?: string;
    startDate?: string;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/summary${queryString ? '?' + queryString : ''}`);
  }
}

// 使用示例
const inventoryService = new InventoryService('your-jwt-token');

// 获取低库存预警
const lowStock = await inventoryService.getLowStock(10);
console.log(`低库存商品数量: ${lowStock.data.length}`);

// 调整库存
const adjustResult = await inventoryService.adjustInventory({
  inventoryId: 'inv_001',
  adjustmentType: 'INCREASE',
  quantity: 100,
  reason: '新货入库',
  costPrice: 9500
});

if (adjustResult.success) {
  console.log(`库存调整成功，新数量: ${adjustResult.data.newQuantity}`);
}

// 预留库存
const reserveResult = await inventoryService.reserveInventory({
  inventoryId: 'inv_001',
  quantity: 10,
  orderId: 'order_001',
  reason: '客户下单预留'
});

// 获取库存汇总
const summary = await inventoryService.getSummary();
console.log(`库存总价值: ¥${(summary.data.totalValue / 100).toFixed(2)}`);
```

### 小程序示例

```javascript
// utils/inventory.js
const app = getApp();

class InventoryManager {
  // 获取库存列表
  static async getInventoryList(page = 1, warehouseType = '') {
    const token = wx.getStorageSync('token');
    const params = new URLSearchParams({
      page: page.toString(),
      perPage: '10'
    });

    if (warehouseType) {
      params.append('warehouseType', warehouseType);
    }

    const response = await wx.request({
      url: `${app.globalData.apiBase}/api/v1/inventory?${params}`,
      header: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      const items = response.data.data.items.map(item => ({
        ...item,
        formattedCost: (item.cost / 100).toFixed(2),
        warehouseTypeName: this.getWarehouseTypeName(item.warehouseType)
      }));

      return {
        items,
        pagination: response.data.data.pagination
      };
    }
    return null;
  }

  // 获取仓库类型名称
  static getWarehouseTypeName(type) {
    const typeNames = {
      'PLATFORM': '平台仓',
      'CLOUD': '云仓',
      'LOCAL': '本地仓'
    };
    return typeNames[type] || type;
  }

  // 调整库存
  static async adjustInventory(inventoryId, adjustmentType, quantity, reason) {
    const token = wx.getStorageSync('token');
    const response = await wx.request({
      url: `${app.globalData.apiBase}/api/v1/inventory/adjust`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        inventoryId,
        adjustmentType,
        quantity,
        reason
      }
    });

    return response.data;
  }
}

// pages/inventory/adjust/adjust.js
Page({
  data: {
    inventoryId: '',
    adjustmentType: 'INCREASE',
    quantity: '',
    reason: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ inventoryId: options.id });
    }
  },

  onTypeChange(e) {
    this.setData({
      adjustmentType: e.detail.value
    });
  },

  onQuantityInput(e) {
    this.setData({
      quantity: e.detail.value
    });
  },

  onReasonInput(e) {
    this.setData({
      reason: e.detail.value
    });
  },

  async onAdjust() {
    const { inventoryId, adjustmentType, quantity, reason } = this.data;

    if (!inventoryId || !quantity || !reason) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      wx.showToast({
        title: '数量必须大于0',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '调整中...' });

    const result = await InventoryManager.adjustInventory(
      inventoryId,
      adjustmentType,
      qty,
      reason
    );

    wx.hideLoading();

    if (result.success) {
      wx.showToast({
        title: '调整成功',
        icon: 'success'
      });

      // 延迟返回
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showToast({
        title: result.error?.message || '调整失败',
        icon: 'none'
      });
    }
  }
});
```

## 10. 最佳实践

### 10.1 库存管理建议

1. **实时更新**
   - 所有库存操作实时更新数据库
   - 使用事务确保数据一致性
   - 避免异步更新导致的数据不一致

2. **预留机制**
   - 下单时立即预留库存
   - 支付成功后扣减库存
   - 超时未支付自动释放预留

3. **安全库存**
   - 设置安全库存阈值
   - 低库存自动预警
   - 自动补货建议

### 10.2 性能优化

1. **数据库优化**
   - 库存表添加适当索引
   - 使用读写分离
   - 历史数据归档

2. **缓存策略**
   - Redis缓存热门商品库存
   - 库存变更时更新缓存
   - 定期同步缓存与数据库

3. **并发控制**
   - 使用乐观锁防止超卖
   - 库存操作加锁
   - 队列处理高并发请求

### 10.3 业务规则

1. **库存计算**
   - 总库存 = 可用库存 + 预留库存
   - 可用库存不能为负数
   - 预留库存不能超过总库存

2. **操作记录**
   - 所有库存操作记录日志
   - 支持操作追溯
   - 异常操作告警

3. **权限控制**
   - 普通用户只能查看自己的库存
   - 店长可以操作自己商品的库存
   - 管理员可以操作所有库存

## 11. 更新日志

- v1.0.0 (2024-01-01): 初始版本发布
  - 基础库存查询
  - 库存调整功能
  - 库存预留机制

- v1.1.0 (2024-01-15): 功能增强
  - 库存调拨功能
  - 低库存预警
  - 库存变动记录

- v1.2.0 (2024-02-01): 新增功能
  - 库存盘点功能
  - 库存统计报表
  - 多仓库支持

- v1.3.0 (2024-03-01): 优化改进
  - 性能优化
  - 并发控制增强
  - API响应优化