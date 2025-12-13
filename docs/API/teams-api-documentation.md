# 中道商城团队模块 API 文档

## 概述

团队模块提供完整的团队管理功能，包括团队结构查询、成员管理、邀请机制、等级调整、业绩统计和成员调动等。支持多层级团队架构，助力社交电商业务发展。

**基础信息**
- 基础URL: `http://localhost:3000/api/v1/teams`
- 认证方式: Bearer Token (JWT)
- 数据格式: JSON
- 支持的团队层级：最高6级（董事→5星→4星→3星→2星→1星→普通）

## 1. 团队结构

### 1.1 获取团队结构

**接口地址**: `GET /structure`

**描述**: 获取当前用户的团队层级结构

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "structure": [
      {
        "id": "user_001",
        "nickname": "张三",
        "level": "STAR_3",
        "avatarUrl": "https://example.com/avatar.jpg",
        "phone": "13800138000",
        "userNumber": "U20240101001",
        "joinedAt": "2024-01-01T10:00:00Z",
        "children": [
          {
            "id": "user_002",
            "nickname": "李四",
            "level": "STAR_2",
            "avatarUrl": "https://example.com/avatar2.jpg",
            "phone": "13800138001",
            "userNumber": "U20240101002",
            "joinedAt": "2024-01-15T10:00:00Z",
            "children": [
              {
                "id": "user_003",
                "nickname": "王五",
                "level": "STAR_1",
                "avatarUrl": "https://example.com/avatar3.jpg",
                "phone": "13800138002",
                "userNumber": "U20240101003",
                "joinedAt": "2024-02-01T10:00:00Z",
                "children": []
              }
            ]
          }
        ]
      }
    ],
    "userLevel": "STAR_3",
    "totalMembers": 15,
    "maxLevels": 6,
    "currentLevel": 2
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 1.2 获取团队业绩

**接口地址**: `GET /performance`

**描述**: 获取团队业绩数据

**权限要求**: 需要登录

**查询参数**:
- `period`: 统计周期（day/week/month/quarter/year，默认month）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "performance": {
      "totalSales": 158800,
      "totalOrders": 320,
      "totalMembers": 45,
      "activeMembers": 32,
      "newMembers": 8,
      "totalCommission": 15880,
      "period": "month",
      "growth": {
        "salesGrowth": 25.5,
        "ordersGrowth": 18.2,
        "membersGrowth": 15.8
      },
      "ranking": {
        "teamRank": 5,
        "totalTeams": 100,
        "percentile": 95
      }
    },
    "period": "month"
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 2. 成员管理

### 2.1 邀请成员

**接口地址**: `POST /invite`

**描述**: 邀请新成员加入团队

**权限要求**: 1星店长以上

**请求体**:
```json
{
  "phone": "13800138003",
  "level": "NORMAL",
  "inviteCode": "INVITE123",
  "message": "诚邀您加入我们的团队，共同发展！"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| phone | string | 是 | 被邀请人手机号 | "13800138003" |
| level | string | 否 | 邀请等级（默认NORMAL） | "NORMAL" |
| inviteCode | string | 否 | 邀请码 | "INVITE123" |
| message | string | 否 | 邀请留言 | "诚邀您加入..." |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "inviteId": "invite_20240101001",
    "phone": "13800138003",
    "level": "NORMAL",
    "status": "PENDING",
    "inviteCode": "INVITE123",
    "expiresAt": "2024-01-08T12:00:00Z",
    "shareUrl": "https://mall.example.com/invite?code=INVITE123"
  },
  "message": "邀请成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2.2 获取团队成员列表

**接口地址**: `GET /members`

**描述**: 获取团队成员列表（支持分页和筛选）

**权限要求**: 需要登录

**查询参数**:
- `page`: 页码（默认1）
- `perPage`: 每页数量（默认10）
- `level`: 等级筛选
- `status`: 状态筛选
- `keyword`: 关键词搜索（昵称、手机号）
- `startDate`: 加入开始日期
- `endDate`: 加入结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "user_002",
        "nickname": "李四",
        "avatarUrl": "https://example.com/avatar2.jpg",
        "phone": "13800138001",
        "userNumber": "U20240101002",
        "level": "STAR_2",
        "status": "ACTIVE",
        "parentUserId": "user_001",
        "joinedAt": "2024-01-15T10:00:00Z",
        "lastActiveAt": "2024-01-01T09:00:00Z",
        "totalSales": 52800,
        "totalOrders": 105,
        "directMembers": 5,
        "teamSize": 12
      }
    ],
    "total": 45,
    "page": 1,
    "perPage": 10,
    "summary": {
      "totalActive": 32,
      "totalInactive": 13,
      "newThisMonth": 8,
      "byLevel": {
        "NORMAL": 20,
        "STAR_1": 15,
        "STAR_2": 8,
        "STAR_3": 2
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2.3 调整成员等级

**接口地址**: `PUT /members/:userId/level`

**描述**: 调整团队成员等级（仅管理员）

**权限要求**: 管理员

**路径参数**:
- `userId`: 用户ID

**请求体**:
```json
{
  "level": "STAR_3",
  "reason": "业绩达标晋升"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| level | string | 是 | 新等级 | "STAR_3" |
| reason | string | 是 | 调整原因 | "业绩达标晋升" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": "user_002",
    "oldLevel": "STAR_2",
    "newLevel": "STAR_3",
    "adjustedBy": "admin_001",
    "adjustedAt": "2024-01-01T12:00:00Z",
    "reason": "业绩达标晋升"
  },
  "message": "等级调整成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 2.4 移动成员

**接口地址**: `POST /:userId/move`

**描述**: 将成员移动到新的上级下（仅管理员）

**权限要求**: 管理员

**路径参数**:
- `userId`: 用户ID

**请求体**:
```json
{
  "newParentId": "user_005",
  "reason": "团队重组调整"
}
```

**请求参数说明**:
| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| newParentId | string | 是 | 新上级用户ID | "user_005" |
| reason | string | 是 | 移动原因 | "团队重组调整" |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": "user_003",
    "oldParentId": "user_002",
    "newParentId": "user_005",
    "movedBy": "admin_001",
    "movedAt": "2024-01-01T12:00:00Z"
  },
  "message": "成员移动成功",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 3. 团队统计

### 3.1 获取团队统计数据

**接口地址**: `GET /statistics`

**描述**: 获取详细的团队统计数据

**权限要求**: 需要登录

**查询参数**:
- `period`: 统计周期（day/week/month/quarter/year，默认month）
- `startDate`: 自定义开始日期
- `endDate`: 自定义结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalMembers": 45,
    "activeMembers": 32,
    "newMembers": 8,
    "totalSales": 158800,
    "totalOrders": 320,
    "totalCommission": 15880,
    "averageOrderValue": 496.25,
    "period": "month",
    "performance": {
      "salesByLevel": {
        "NORMAL": 32000,
        "STAR_1": 45000,
        "STAR_2": 52800,
        "STAR_3": 29000
      },
      "topPerformers": [
        {
          "userId": "user_002",
          "nickname": "李四",
          "sales": 52800,
          "orders": 105,
          "rank": 1
        }
      ],
      "trends": [
        {
          "date": "2024-01-01",
          "sales": 5800,
          "orders": 12,
          "newMembers": 2
        }
      ]
    },
    "commission": {
      "directCommission": 8800,
      "indirectCommission": 7080,
      "totalCommission": 15880,
      "commissionRate": 10
    },
    "growth": {
      "memberGrowth": 21.6,
      "salesGrowth": 35.8,
      "orderGrowth": 28.5
    }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 3.2 获取邀请统计

**接口地址**: `GET /invite/statistics`

**描述**: 获取邀请相关统计数据

**权限要求**: 需要登录

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalInvites": 125,
    "acceptedInvites": 89,
    "pendingInvites": 25,
    "expiredInvites": 11,
    "acceptanceRate": 71.2,
    "todayInvites": 8,
    "todayAccepted": 5,
    "inviteChannels": [
      {
        "channel": "wechat",
        "count": 80,
        "percentage": 64
      },
      {
        "channel": "phone",
        "count": 35,
        "percentage": 28
      },
      {
        "channel": "qrcode",
        "count": 10,
        "percentage": 8
      }
    ],
    "recentInvites": [
      {
        "id": "invite_20240101001",
        "phone": "13800138003",
        "status": "ACCEPTED",
        "createdAt": "2024-01-01T10:00:00Z",
        "acceptedAt": "2024-01-01T11:30:00Z"
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 4. 团队等级说明

| 等级 | 代码 | 说明 | 权益 | 晋升条件 |
|------|------|------|------|----------|
| 普通会员 | NORMAL | 基础会员 | 自购返利 | 注册即成为普通会员 |
| 1星店长 | STAR_1 | 初级店长 | 直接佣金 + 团队管理 | 直推5人，团队业绩1万 |
| 2星店长 | STAR_2 | 中级店长 | 2级佣金 + 更高返利 | 直推10人，团队业绩5万 |
| 3星店长 | STAR_3 | 高级店长 | 3级佣金 + 管理奖励 | 直推20人，团队业绩20万 |
| 4星店长 | STAR_4 | 资深店长 | 4级佣金 + 培训奖励 | 直推30人，团队业绩50万 |
| 5星店长 | STAR_5 | 核心店长 | 5级佣金 + 股权激励 | 直推50人，团队业绩100万 |
| 董事 | DIRECTOR | 最高等级 | 全平台佣金 + 分红 | 特邀或业绩达标 |

## 5. 佣金规则

### 5.1 佣金比例

| 等级 | 直接佣金 | 2级佣金 | 3级佣金 | 4级佣金 | 5级佣金 |
|------|----------|---------|---------|---------|---------|
| STAR_1 | 10% | - | - | - | - |
| STAR_2 | 12% | 3% | - | - | - |
| STAR_3 | 15% | 5% | 2% | - | - |
| STAR_4 | 18% | 7% | 3% | 1% | - |
| STAR_5 | 20% | 8% | 4% | 2% | 1% |
| DIRECTOR | 22% | 10% | 5% | 3% | 2% |

### 5.2 佣金结算

- **结算周期**: 每月结算一次
- **结算时间**: 每月10日结算上月佣金
- **提现门槛**: 最低100元
- **提现手续费**: 2%

## 6. 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|------------|------|
| INSUFFICIENT_PERMISSION | 403 | 权限不足 |
| TEAM_STRUCTURE_ERROR | 500 | 获取团队结构失败 |
| TEAM_PERFORMANCE_ERROR | 500 | 获取团队业绩失败 |
| INVITE_ERROR | 500 | 邀请失败 |
| TEAM_MEMBERS_ERROR | 500 | 获取成员列表失败 |
| ADJUST_LEVEL_ERROR | 500 | 调整等级失败 |
| MOVE_MEMBER_ERROR | 500 | 移动成员失败 |
| TEAM_STATISTICS_ERROR | 500 | 获取统计失败 |
| INVALID_USER_LEVEL | 400 | 无效的用户等级 |
| MEMBER_NOT_FOUND | 404 | 成员不存在 |

## 7. SDK 示例

### JavaScript/TypeScript

```typescript
class TeamsService {
  private baseURL = 'http://localhost:3000/api/v1/teams';
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

  // 获取团队结构
  async getTeamStructure() {
    return this.request('/structure');
  }

  // 获取团队业绩
  async getTeamPerformance(period = 'month') {
    return this.request(`/performance?period=${period}`);
  }

  // 邀请成员
  async inviteMember(data: {
    phone: string;
    level?: string;
    inviteCode?: string;
    message?: string;
  }) {
    return this.request('/invite', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // 获取成员列表
  async getMembers(params?: {
    page?: number;
    perPage?: number;
    level?: string;
    status?: string;
    keyword?: string;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/members${queryString ? '?' + queryString : ''}`);
  }

  // 调整成员等级
  async adjustMemberLevel(userId: string, level: string, reason: string) {
    return this.request(`/members/${userId}/level`, {
      method: 'PUT',
      body: JSON.stringify({ level, reason })
    });
  }

  // 移动成员
  async moveMember(userId: string, newParentId: string, reason: string) {
    return this.request(`/${userId}/move`, {
      method: 'POST',
      body: JSON.stringify({ newParentId, reason })
    });
  }

  // 获取团队统计
  async getTeamStatistics(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryString = new URLSearchParams(params as any).toString();
    return this.request(`/statistics${queryString ? '?' + queryString : ''}`);
  }

  // 获取邀请统计
  async getInviteStatistics() {
    return this.request('/invite/statistics');
  }

  // 格式化等级显示
  formatLevel(level: string): string {
    const levelNames: { [key: string]: string } = {
      'NORMAL': '普通会员',
      'STAR_1': '1星店长',
      'STAR_2': '2星店长',
      'STAR_3': '3星店长',
      'STAR_4': '4星店长',
      'STAR_5': '5星店长',
      'DIRECTOR': '董事'
    };
    return levelNames[level] || level;
  }
}

// 使用示例
const teamsService = new TeamsService('your-jwt-token');

// 获取团队结构
const structure = await teamsService.getTeamStructure();
console.log(`团队总人数: ${structure.data.totalMembers}`);

// 邀请新成员
const inviteResult = await teamsService.inviteMember({
  phone: '13800138003',
  level: 'NORMAL',
  message: '诚邀您加入我们的团队！'
});

if (inviteResult.success) {
  console.log(`邀请成功，邀请码: ${inviteResult.data.inviteCode}`);
  console.log(`分享链接: ${inviteResult.data.shareUrl}`);
}

// 获取本月团队业绩
const performance = await teamsService.getTeamPerformance('month');
console.log(`本月销售额: ¥${performance.data.performance.totalSales}`);
console.log(`本月订单数: ${performance.data.performance.totalOrders}`);

// 获取团队成员
const members = await teamsService.getMembers({
  page: 1,
  perPage: 20,
  level: 'STAR_1'
});

// 调整成员等级（管理员操作）
const adjustResult = await teamsService.adjustMemberLevel(
  'user_002',
  'STAR_3',
  '业绩达标，批准晋升'
);

if (adjustResult.success) {
  console.log(`等级调整成功: ${adjustResult.data.oldLevel} -> ${adjustResult.data.newLevel}`);
}
```

### 小程序示例

```javascript
// utils/teams.js
const app = getApp();

class TeamsManager {
  // 获取团队结构
  static async getTeamStructure() {
    const token = wx.getStorageSync('token');
    const response = await wx.request({
      url: `${app.globalData.apiBase}/api/v1/teams/structure`,
      header: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.data.success) {
      const data = response.data.data;
      return {
        structure: this.formatStructure(data.structure),
        totalMembers: data.totalMembers,
        userLevel: data.userLevel
      };
    }
    return null;
  }

  // 格式化团队结构
  static formatStructure(structure) {
    return structure.map(member => ({
      ...member,
      levelName: this.getLevelName(member.level),
      levelColor: this.getLevelColor(member.level),
      avatarUrl: member.avatarUrl || '/images/default-avatar.png'
    }));
  }

  // 获取等级名称
  static getLevelName(level) {
    const levelNames = {
      'NORMAL': '普通会员',
      'STAR_1': '1星店长',
      'STAR_2': '2星店长',
      'STAR_3': '3星店长',
      'STAR_4': '4星店长',
      'STAR_5': '5星店长',
      'DIRECTOR': '董事'
    };
    return levelNames[level] || level;
  }

  // 获取等级颜色
  static getLevelColor(level) {
    const levelColors = {
      'NORMAL': '#999999',
      'STAR_1': '#52c41a',
      'STAR_2': '#1890ff',
      'STAR_3': '#722ed1',
      'STAR_4': '#fa8c16',
      'STAR_5': '#eb2f96',
      'DIRECTOR': '#f5222d'
    };
    return levelColors[level] || '#999999';
  }

  // 邀请成员
  static async inviteMember(phone, message) {
    const token = wx.getStorageSync('token');
    const response = await wx.request({
      url: `${app.globalData.apiBase}/api/v1/teams/invite`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        phone,
        message: message || '诚邀您加入我们的团队，共同发展！'
      }
    });

    return response.data;
  }
}

// pages/team/structure/structure.js
Page({
  data: {
    teamStructure: [],
    totalMembers: 0,
    userLevel: '',
    expandedNodes: []
  },

  async onLoad() {
    wx.showLoading({ title: '加载中...' });
    const result = await TeamsManager.getTeamStructure();
    wx.hideLoading();

    if (result) {
      this.setData({
        teamStructure: result.structure,
        totalMembers: result.totalMembers,
        userLevel: result.userLevel
      });
    }
  },

  // 展开/收起节点
  onToggleNode(e) {
    const { index } = e.currentTarget.dataset;
    const { expandedNodes } = this.data;
    const nodeIndex = expandedNodes.indexOf(index);

    if (nodeIndex > -1) {
      // 收起
      expandedNodes.splice(nodeIndex, 1);
    } else {
      // 展开
      expandedNodes.push(index);
    }

    this.setData({ expandedNodes });
  },

  // 邀请成员
  onInviteMember() {
    wx.showModal({
      title: '邀请成员',
      content: '请输入手机号',
      editable: true,
      placeholderText: '请输入手机号',
      success: async (res) => {
        if (res.confirm && res.content) {
          const phone = res.content;
          if (!/^1[3-9]\d{9}$/.test(phone)) {
            wx.showToast({
              title: '手机号格式错误',
              icon: 'none'
            });
            return;
          }

          wx.showLoading({ title: '邀请中...' });
          const result = await TeamsManager.inviteMember(phone);
          wx.hideLoading();

          if (result.success) {
            wx.showModal({
              title: '邀请成功',
              content: `邀请码: ${result.data.inviteCode}\n请分享给朋友`,
              showCancel: false
            });
          } else {
            wx.showToast({
              title: result.error?.message || '邀请失败',
              icon: 'none'
            });
          }
        }
      }
    });
  }
});
```

## 8. 最佳实践

### 8.1 团队管理建议

1. **层级管理**
   - 合理控制团队层级深度
   - 避免层级过于扁平或复杂
   - 定期优化团队结构

2. **成员激励**
   - 设置合理的晋升机制
   - 提供培训和支持
   - 建立荣誉体系

3. **业绩追踪**
   - 实时监控团队业绩
   - 设置业绩预警
   - 及时调整策略

### 8.2 邀请策略

1. **多渠道邀请**
   - 微信分享
   - 二维码邀请
   - 短信邀请
   - 线下推广

2. **邀请优化**
   - 个性化邀请语
   - 突出团队优势
   - 提供新成员福利

3. **跟进机制**
   - 及时跟进潜在成员
   - 解答疑问
   - 协助完成注册

### 8.3 数据分析

1. **关键指标**
   - 团队规模增长率
   - 成员活跃度
   - 人均业绩
   - 留存率

2. **报表分析**
   - 日报、周报、月报
   - 业绩趋势分析
   - 成员贡献度分析

## 9. 更新日志

- v1.0.0 (2024-01-01): 初始版本发布
  - 团队结构查询
  - 成员邀请功能
  - 基础团队统计

- v1.1.0 (2024-01-15): 功能增强
  - 团队业绩统计
  - 成员等级调整
  - 成员移动功能

- v1.2.0 (2024-02-01): 新增功能
  - 邀请统计
  - 多维度数据统计
  - 团队排行榜

- v1.3.0 (2024-03-01): 优化改进
  - 性能优化
  - UI交互优化
  - 数据导出功能