# 中道商城系统

> 多层级供应链社交电商平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.0+-black)](https://www.prisma.io/)
[![Database](https://img.shields.io/badge/MySQL-8.0+-orange)](https://www.mysql.com/)

## 📋 项目概述

中道商城系统是一个创新的**多层级供应链社交电商平台**，通过云仓、积分、等级体系，将传统分销网络数字化，赋能店长创业，构建高效的C2B2B供应链生态。

### 🎯 项目定位

- **双店铺体系**：云店（销量累积升级）+ 五通店（特殊权益）
- **6级用户体系**：普通会员 → VIP → 一星至五星店长 → 董事
- **复杂采购规则**：层级限制 + 中间人业绩 + 平级奖励
- **双仓库存机制**：云仓（团队共享） + 本地仓（个人独有）
- **通券多源流转**：进货流转 + 用户转账 + 平台充值

### 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                               │
├─────────────────┬─────────────────┬─────────────────────────┤
│   微信小程序     │    管理后台     │       移动端H5          │
│   (原生框架)     │  (Vue3+TS)     │    (响应式设计)         │
└─────────────────┴─────────────────┴─────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    API服务层                                │
│              (认证、限流、路由、监控)                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   业务服务层                                │
├───────────┬───────────┬───────────┬───────────┬─────────────┤
│  用户服务  │  店铺服务  │  采购服务  │  库存服务  │  通券服务   │
│(等级团队)  │(双店铺)   │(复杂采购)  │(双仓管理)  │(多源流转)  │
├───────────┼───────────┼───────────┼───────────┼─────────────┤
│  订单服务  │  支付服务  │  物流服务  │  通知服务  │  统计服务   │
└───────────┴───────────┴───────────┴───────────┴─────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     数据层                                   │
├─────────────────┬─────────────────┬─────────────────────────┤
│     MySQL       │      Redis      │      文件存储           │
│   (主业务数据)   │    (缓存/会话)   │    (图片/文档)          │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## ✨ 核心功能

### 🏪 双店铺体系

#### 云店（1-5星级+董事）
基于销量累积的智能升级体系：

| 等级 | 进货折扣 | 月采购目标 | 团队要求 | 典型收益 |
|-----|---------|-----------|---------|----------|
| 一星 | 4折 | 2,400元 | 无 | 600元/月 |
| 二星 | 3.5折 | 12,000元 | 2个一星 | 3,000元/月 |
| 三星 | 3折 | 72,000元 | 2个二星 | 15,000元/月 |
| 四星 | 2.6折 | 360,000元 | 2个三星 | 72,000元/月 |
| 五星 | 2.4折 | 1,200,000元 | 2个四星 | 288,000元/月 |
| 董事 | 2.2折 | 6,000,000元 | 2个五星 | 1,320,000元/月 |

#### 五通店（一次性模式）
- **准入条件**：一次性拿货100瓶×270元/瓶 = 27,000元
- **特殊权益**：终身享受买10赠1机制（满5,999元送599元商品）
- **升级特权**：普通/VIP会员可直接升级为二星店长

### 👥 用户等级体系

#### 非店长用户路径
```
普通会员 → 首单 ≥599元 → VIP会员（复购5折优惠）
```

#### 店长用户路径
```
开店申请 → 一星店长 → 二星 → 三星 → 四星 → 五星 → 董事
```

### 💰 复杂采购体系

#### 采购规则
- **层级限制**：只能向更高级别且非平级的上级进货
- **平级处理**：如果上级与自己是平级，需再往上找更高等级
- **业绩计算**：采购链路中所有中间人都算业绩

#### 佣金分配
| 等级 | 直推奖励 | 团队佣金 | 发放方式 |
|-----|---------|---------|---------|
| 一星 | 10元/人 | - | 积分转账 |
| 二星 | 10元/人 | - | 积分转账 |
| 三星 | 8元/人 | 3% | 积分转账 |
| 四星 | 4元/人 | 5% | 现金提现 |
| 五星 | 4元/人 | 8% | 现金提现 |
| 董事 | 4元/人 | 10% | 现金提现 |

### 📦 双仓库存管理

#### 云仓（Cloud Warehouse）
- **功能定位**：团队的虚拟库存中心
- **所有权关系**：自己采购的商品 → 自己的云仓，直推下级可共用
- **核心特性**：团队共享、虚拟库存、实时同步、防止滥用

#### 本地仓（Local Warehouse）
- **功能定位**：店长的实体库存，用于零售和代理
- **所有权**：完全个人独有，不与团队共享
- **库存来源**：仅从自己的云仓提货

### 💎 通券流转体系

#### 通券来源
| 来源 | 规则 | 金额计算 | 用途 | 优先级 |
|-----|------|---------|------|-------|
| **下级采购** | 下级支付积分给上级 | 采购金额 = 积分 | 扩大库存 | P0 |
| **直推奖励** | 直推成员采购时 | 固定奖励金额 | 激励补充 | P0 |
| **平台充值** | 五星/董事权限 | 自定义 | 扩大本金 | P1 |
| **积分转账** | 所有店长互相转 | 自定义 | 灵活流转 | P1 |

#### 财务功能
- **充值功能**：五星和董事专属权益，支持微信/支付宝/银行卡
- **提现功能**：所有店长可申请，1%手续费，1-3个工作日审核
- **转账功能**：店长间通券灵活流转

## 🛠️ 技术栈

### 后端技术
- **运行环境**：Node.js 18+
- **Web框架**：Express.js + TypeScript
- **数据库**：MySQL 8.0 + Prisma ORM
- **缓存**：Redis 7+
- **认证**：JWT + Bcrypt加密
- **API文档**：Swagger/OpenAPI

### 前端技术
- **微信小程序**：原生小程序开发
- **管理后台**：Vue 3 + TypeScript + Vite
- **UI组件库**：Element Plus (管理后台)
- **状态管理**：Pinia (管理后台)

### 基础设施
- **容器化**：Docker + Docker Compose
- **反向代理**：Nginx
- **进程管理**：PM2
- **日志管理**：Winston

## 🤖 AI协同开发

本项目支持**多AI协同开发**，通过智能任务分配、冲突检测和知识共享，大幅提升开发效率。

### 🎯 协同开发特性

- **智能任务分配**：根据AI专业领域和负载自动分配任务
- **冲突检测解决**：实时检测代码冲突并自动协调解决
- **知识共享**：AI之间共享开发经验和最佳实践
- **质量保证**：自动化代码审查和质量控制
- **进度监控**：实时监控项目进度和AI工作状态

### 🚀 快速启动协同开发

```bash
# 启动AI协同开发系统
./scripts/start-collaboration.sh

# 查看协同状态
./scripts/start-collaboration.sh status

# 启动协同监控
./scripts/start-collaboration.sh monitor
```

### 📋 AI角色分工

| AI角色 | 专业领域 | 主要职责 |
|--------|----------|----------|
| **协调AI** | 项目管理 | 任务分配、进度跟踪、冲突解决 |
| **架构师AI** | 系统设计 | 技术架构、数据库设计、API设计 |
| **用户系统AI** | 用户管理 | 认证授权、等级体系、团队管理 |
| **店铺系统AI** | 店铺管理 | 店铺功能、库存管理、订单处理 |
| **测试AI** | 质量保证 | 单元测试、集成测试、性能测试 |
| **文档AI** | 技术文档 | API文档、开发指南、用户手册 |

### 🛠️ 协同工具使用

```bash
# 任务管理
npx ts-node scripts/ai-collaboration.ts create-task --title "任务标题" --description "任务描述"
npx ts-node scripts/ai-collaboration.ts assign-task <taskId>
npx ts-node scripts/ai-collaboration.ts update-task <taskId> <status>

# AI状态管理
npx ts-node scripts/ai-collaboration.ts ai-status
npx ts-node scripts/ai-collaboration.ts report

# 知识管理
npx ts-node scripts/ai-collaboration.ts add-knowledge --title "标题" --content "内容"
npx ts-node scripts/ai-collaboration.ts search-knowledge "关键词"

# 冲突管理
npx ts-node scripts/ai-collaboration.ts detect-conflicts
```

详细协同开发指南请参考：[AI协同开发指南](./docs/AI协同开发指南.md)

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis >= 7.0
- Docker >= 20.0 (可选)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/zhongdao-mall.git
cd zhongdao-mall
```

2. **快速启动开发环境**
```bash
# 一键启动完整开发环境
./scripts/quick-start.sh

# 或者使用Docker
docker-compose up -d
```

3. **初始化AI协同开发**
```bash
# 启动AI协同系统
./scripts/start-collaboration.sh
```

# 复制环境变量
cp .env.example .env

# 编辑环境变量（数据库连接等）
vim .env
```

3. **数据库初始化**
```bash
# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# (可选) 重置数据库
npx prisma migrate reset
```

4. **启动开发服务器**
```bash
# 启动后端服务
npm run dev

# 或者使用PM2
npm run start:dev
```

5. **前端环境配置**
```bash
# 微信小程序
cd frontend/miniprogram
npm install
npm run dev:weapp

# 管理后台
cd frontend/admin
npm install
npm run dev
```

### 使用Docker启动（推荐）

1. **配置环境变量**
```bash
cp .env.example .env
# 编辑环境变量
```

2. **启动所有服务**
```bash
docker-compose up -d
```

3. **查看服务状态**
```bash
docker-compose ps
docker-compose logs -f
```

### 验证安装

访问健康检查接口：
```bash
curl http://localhost:3000/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2025-11-18T...",
  "version": "1.0.0",
  "environment": "development"
}
```

## 📁 项目结构

```
zhongdao-mall/
├── backend/                    # 后端API服务
│   ├── src/
│   │   ├── modules/           # 业务模块
│   │   │   ├── user/         # 用户服务
│   │   │   ├── shop/         # 店铺服务
│   │   │   ├── purchase/     # 采购服务
│   │   │   ├── inventory/    # 库存服务
│   │   │   ├── points/       # 通券服务
│   │   │   ├── order/        # 订单服务
│   │   │   └── payment/      # 支付服务
│   │   ├── shared/           # 共享模块
│   │   │   ├── database/     # 数据库配置
│   │   │   ├── middleware/   # 中间件
│   │   │   ├── utils/        # 工具函数
│   │   │   └── types/        # 类型定义
│   │   ├── config/           # 配置文件
│   │   └── app.ts            # 应用入口
│   ├── prisma/               # 数据库模型
│   ├── tests/                # 测试文件
│   ├── docs/                 # API文档
│   └── package.json
├── frontend/                 # 前端应用
│   ├── miniprogram/          # 微信小程序
│   │   ├── pages/           # 页面
│   │   ├── components/      # 组件
│   │   ├── utils/           # 工具
│   │   └── app.js           # 入口
│   ├── admin/               # 管理后台
│   │   ├── src/
│   │   │   ├── views/       # 页面
│   │   │   ├── components/  # 组件
│   │   │   ├── api/         # API接口
│   │   │   ├── utils/       # 工具
│   │   │   └── main.ts      # 入口
│   │   ├── public/           # 静态资源
│   │   └── package.json
│   └── mobile-h5/           # 移动端H5
├── docs/                     # 项目文档
│   ├── 中道商城系统功能规划.md  # 功能规划
│   ├── api/                 # API文档
│   ├── deployment/          # 部署文档
│   └── development/         # 开发文档
├── docker-compose.yml        # Docker编排
├── .env.example             # 环境变量模板
├── docker-compose.prod.yml   # 生产环境配置
└── README.md               # 项目说明
```

## 📖 API文档

### 认证接口
```http
POST /api/auth/login          # 用户登录
POST /api/auth/register       # 用户注册
POST /api/auth/refresh        # 刷新Token
POST /api/auth/logout         # 用户登出
POST /api/auth/wechat-login   # 微信登录
```

### 用户管理
```http
GET  /api/users/profile       # 获取用户信息
PUT  /api/users/profile       # 更新用户信息
GET  /api/users/level         # 获取等级信息
POST /api/users/upgrade       # 申请等级升级
GET  /api/users/team          # 获取团队信息
```

### 店铺管理
```http
GET  /api/shops/info          # 获取店铺信息
POST /api/shops/apply         # 申请开店
PUT  /api/shops/info          # 更新店铺信息
GET  /api/shops/level         # 获取店铺等级
POST /api/shops/upgrade       # 申请店铺升级
```

### 商品管理
```http
GET  /api/products/list       # 获取商品列表
GET  /api/products/:id        # 获取商品详情
GET  /api/products/categories # 获取商品分类
GET  /api/products/search     # 搜索商品
```

### 采购管理
```http
POST /api/purchases/create    # 创建采购订单
GET  /api/purchases/list      # 获取采购列表
GET  /api/purchases/:id       # 获取采购详情
PUT  /api/purchases/:id       # 更新采购状态
POST /api/purchases/validate  # 验证采购权限
```

### 库存管理
```http
GET  /api/inventory/cloud     # 查询云仓库存
GET  /api/inventory/local     # 查询本地仓库存
POST /api/inventory/transfer  # 库存调拨
GET  /api/inventory/records   # 获取库存记录
```

### 通券管理
```http
GET  /api/points/balance      # 获取通券余额
POST /api/points/recharge     # 通券充值（五星/董事）
POST /api/points/withdraw     # 通券提现
POST /api/points/transfer     # 通券转账
GET  /api/points/transactions # 获取流水记录
```

### 订单管理
```http
POST /api/orders/create       # 创建订单
GET  /api/orders/list         # 获取订单列表
GET  /api/orders/:id          # 获取订单详情
PUT  /api/orders/:id          # 更新订单状态
POST /api/orders/cancel       # 取消订单
```

### 物流管理
```http
GET  /api/logistics/track     # 查询物流信息
POST /api/logistics/create     # 创建物流订单
PUT  /api/logistics/update     # 更新物流状态
```

完整API文档访问：`http://localhost:3000/api-docs`

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行特定测试文件
npm test -- user.test.js

# 运行E2E测试
npm run test:e2e
```

### 测试策略
- **单元测试**：Jest + Supertest
- **集成测试**：测试完整业务流程
- **E2E测试**：模拟真实用户操作
- **性能测试**：Artillery + 自定义脚本

### 测试覆盖率目标
- 单元测试覆盖率：> 80%
- 集成测试覆盖率：> 70%
- 关键业务流程：100%

## 📊 核心业务逻辑

### 用户等级升级算法
```typescript
function checkUpgrade(userId: string): UpgradeResult {
  // 1. 计算购买数量（以599元为基准）
  const totalSales = getUserTotalSales(userId);
  const bottleCount = Math.floor(totalSales / 599);

  // 2. 检查团队结构
  const teamStructure = getTeamStructure(userId);

  // 3. 验证升级条件
  const currentLevel = getUserLevel(userId);
  const nextLevelRequirements = getLevelRequirements(currentLevel + 1);

  const meetsSalesRequirement = bottleCount >= nextLevelRequirements.bottleCount;
  const meetsTeamRequirement = validateTeamStructure(teamStructure, nextLevelRequirements);

  return {
    canUpgrade: meetsSalesRequirement && meetsTeamRequirement,
    currentProgress: {
      bottleCount,
      teamStructure,
      requirements: nextLevelRequirements
    }
  };
}
```

### 采购权限验证
```typescript
function validatePurchasePermission(buyerId: string, sellerId: string): boolean {
  const buyerLevel = getUserLevel(buyerId);
  const sellerLevel = getUserLevel(sellerId);

  // 只能向更高级别且非平级的上级进货
  if (sellerLevel <= buyerLevel) {
    return false;
  }

  // 检查是否在团队内
  const isInTeam = checkTeamRelationship(buyerId, sellerId);
  return isInTeam;
}
```

### 通券流转处理
```typescript
async function processPointsTransfer(
  fromUserId: string,
  toUserId: string,
  amount: number,
  type: TransactionType
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. 检查余额
    const fromAccount = await getPointsAccount(tx, fromUserId);
    if (fromAccount.balance < amount) {
      throw new Error('余额不足');
    }

    // 2. 扣除转出方通券
    await deductPoints(tx, fromUserId, amount);

    // 3. 增加转入方通券
    await addPoints(tx, toUserId, amount);

    // 4. 记录流水
    await recordTransaction(tx, {
      fromUserId,
      toUserId,
      amount,
      type,
      balanceBefore: fromAccount.balance,
      balanceAfter: fromAccount.balance - amount
    });

    // 5. 触发业务逻辑
    if (type === 'PURCHASE') {
      await handlePurchaseLogic(tx, fromUserId, toUserId, amount);
    }
  });
}
```

## 📈 性能优化

### 数据库优化
```sql
-- 核心查询索引
CREATE INDEX idx_users_level_created ON users(level, created_at);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_points_transactions_user_date ON points_transactions(user_id, created_at);
CREATE INDEX idx_inventory_user_warehouse ON inventory(user_id, warehouse_type);
```

### 缓存策略
```typescript
// Redis缓存配置
const cacheConfig = {
  userSession: { ttl: 3600 },      // 用户会话：1小时
  productInfo: { ttl: 1800 },     // 商品信息：30分钟
  inventoryData: { ttl: 300 },    // 库存数据：5分钟
  userLevel: { ttl: 7200 },       // 用户等级：2小时
};
```

### API限流
```typescript
// 限流中间件
const rateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,      // 15分钟
  max: 100,                      // 限制每个IP 100次请求
  message: '请求过于频繁，请稍后再试',
  standardHeaders: true,
  legacyHeaders: false,
});
```

## 🔒 安全特性

### 数据安全
- **敏感数据加密**：手机号、身份证等敏感信息AES-256加密
- **传输安全**：HTTPS + TLS 1.3
- **输入验证**：严格的参数校验和SQL注入防护
- **权限控制**：基于角色的访问控制（RBAC）

### 业务安全
- **防刷机制**：接口限流 + 验证码
- **风控系统**：异常行为检测和预警
- **审计日志**：完整的操作记录追踪
- **数据备份**：自动备份 + 异地存储

## 🚀 部署

### 开发环境
```bash
# 使用Docker Compose
docker-compose -f docker-compose.yml up -d

# 或本地启动
npm run dev
```

### 生产环境
```bash
# 构建生产镜像
docker build -t zhongdao-mall-api .

# 使用生产配置
docker-compose -f docker-compose.prod.yml up -d

# 健康检查
curl http://localhost:3000/health
```

### 环境变量配置
```bash
# .env 文件示例
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://user:password@localhost:3306/zhongdao_mall
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-key
WECHAT_APP_ID=your-wechat-app-id
WECHAT_APP_SECRET=your-wechat-app-secret
```

## 📊 监控告警

### 系统监控
- **服务监控**：进程状态、CPU、内存使用率
- **API监控**：请求量、响应时间、错误率
- **数据库监控**：连接数、查询性能、慢查询
- **业务监控**：订单量、用户活跃度、支付成功率

### 告警配置
- **即时告警**：系统宕机、数据库连接失败
- **延迟告警**：性能下降、资源使用率过高
- **预测告警**：容量不足、潜在风险

## 🤝 开发指南

### 开发流程
1. Fork项目到个人仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建Pull Request

### 代码规范
- **TypeScript**：严格类型检查，noImplicitAny
- **ESLint**：代码风格和潜在问题检查
- **Prettier**：代码格式化
- **Husky**：Git钩子自动化

### 提交规范
使用Conventional Commits规范：
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建过程或辅助工具的变动
```

### 分支策略
- `main`：生产环境分支
- `develop`：开发环境分支
- `feature/*`：功能开发分支
- `hotfix/*`：紧急修复分支

## 📝 开发计划

### Phase 1: MVP (第1-3个月)
- [x] 项目架构搭建
- [x] 用户等级体系
- [x] 基础商品管理
- [x] 简单订单流程
- [ ] 基础积分系统

### Phase 2: 核心功能 (第4-6个月)
- [ ] 完整采购体系
- [ ] 双仓库存管理
- [ ] 佣金分配系统
- [ ] 五通店特殊逻辑
- [ ] 微信小程序完善

### Phase 3: 扩展功能 (第7-12个月)
- [ ] 物流对接系统
- [ ] 数据统计分析
- [ ] 管理后台完善
- [ ] 营销工具集
- [ ] 性能优化

## 📞 联系我们

- **项目维护者**：开发团队
- **邮箱**：dev@zhongdao-mall.com
- **问题反馈**：[GitHub Issues](https://github.com/yourusername/zhongdao-mall/issues)
- **功能规划**：查看 [docs/中道商城系统功能规划.md](./docs/中道商城系统功能规划.md)

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

<div align="center">

**中道商城** - 构建高效的多层级供应链社交电商生态

基于详细的[功能规划文档](./docs/中道商城系统功能规划.md)开发

Made with ❤️ by [中道团队](https://zhongdao-mall.com)

</div>