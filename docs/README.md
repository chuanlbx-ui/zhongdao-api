# 中道商城 API 文档中心

## 📚 文档导航

### 🚀 快速开始
- [5分钟快速接入指南](./quick-start.md) - 快速了解如何接入中道商城API
- [API文档在线地址](http://localhost:3000/api-docs) - 交互式API文档

### 📖 业务文档
#### 用户相关
- [用户认证流程](./API/用户认证流程.md) - 登录、注册、Token管理
- [多层级用户体系](./API/多层级用户体系.md) - 用户等级、升级、团队关系

#### 店铺相关
- [店铺管理指南](./API/店铺管理指南.md) - 云店、梧桐店管理运营

#### 业务系统
- [积分（通券）系统说明](./API/积分系统说明.md) - 通券获取、使用、转账规则
- [佣金计算规则](./API/佣金计算规则.md) - 多级佣金分配、提现规则

### 💻 开发指南
#### 前端集成
- [Axios 客户端配置](../examples/axios-client.js) - 统一的HTTP请求封装
- [错误处理方案](../examples/error-handling.js) - 全局错误处理和用户提示
- [认证流程示例](../examples/auth-flow.js) - 完整的登录认证实现
- [React 集成示例](../examples/react-integration.js) - React应用架构示例

#### API 参考
- [增强版Swagger配置](../src/config/swagger-enhanced.ts) - 详细的API配置
- [API示例注释](../src/examples/swagger-enhanced-examples.ts) - 接口使用示例

### 🔧 问题解决
- [常见问题解决](./troubleshooting.md) - FAQ和调试技巧

## 🎯 核心特性

### 多层级用户体系
```
董事 (DIRECTOR)
  ↑ 20%佣金
五星店长 (STAR_5)
  ↑ 18%佣金
四星店长 (STAR_4)
  ↑ 16%佣金
三星店长 (STAR_3)
  ↑ 12%佣金
二星店长 (STAR_2)
  ↑ 10%佣金
一星店长 (STAR_1)
  ↑ 8%佣金
VIP会员 (VIP)
  ↑ 5%佣金
普通会员 (NORMAL)
```

### 双店铺系统
- **云店**: 免费开通，业绩累积升级
- **梧桐店**: 一次性购买(19800元)，永久2.2折权益

### 通券经济
- 多源通券（采购返佣、团队奖励、平台充值）
- 用户间转账功能
- 实时交易记录

## 🌐 API 端点

### 基础地址
- 开发环境: `http://localhost:3000/api/v1`
- 测试环境: `https://test-api.zhongdao-mall.com/api/v1`
- 生产环境: `https://api.zhongdao-mall.com/api/v1`

### 认证头
```
Authorization: Bearer <JWT_TOKEN>
```

### 主要接口分类

| 分类 | 前缀 | 说明 |
|------|------|------|
| 认证 | `/auth` | 登录、注册、Token管理 |
| 用户 | `/users` | 用户信息、等级管理 |
| 团队 | `/teams` | 团队结构、业绩统计 |
| 商品 | `/products` | 商品列表、详情、分类 |
| 订单 | `/orders` | 订单创建、查询、状态更新 |
| 店铺 | `/shops` | 店铺管理、运营数据 |
| 通券 | `/points` | 余额、转账、交易记录 |
| 佣金 | `/commission` | 佣金统计、明细、提现 |
| 管理员 | `/admin/*` | 后台管理功能 |

## 📊 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 业务数据
  },
  "message": "操作成功",
  "timestamp": "2025-11-24T10:30:00.000Z"
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": {} // 可选的详细信息
  },
  "timestamp": "2025-11-24T10:30:00.000Z"
}
```

## 🔍 错误码速查

### 认证相关 (4xx)
| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| TOKEN_EXPIRED | Token已过期 | 刷新Token或重新登录 |
| INVALID_TOKEN | Token无效 | 重新登录 |
| TOKEN_MISSING | 缺少Token | 在请求头添加Authorization |
| INSUFFICIENT_PERMISSIONS | 权限不足 | 升级等级或申请权限 |

### 业务相关 (4xx)
| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| INSUFFICIENT_BALANCE | 通券余额不足 | 充值或获取佣金 |
| USER_NOT_FOUND | 用户不存在 | 检查用户ID |
| SHOP_NOT_EXIST | 店铺不存在 | 先开通店铺 |
| ORDER_NOT_FOUND | 订单不存在 | 检查订单号 |

### 服务器错误 (5xx)
| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| INTERNAL_ERROR | 服务器内部错误 | 联系技术支持 |
| DATABASE_ERROR | 数据库错误 | 稍后重试 |
| SERVICE_UNAVAILABLE | 服务不可用 | 检查系统状态 |

## 🛠️ 开发工具推荐

### API 测试
- **Postman**: [API集合导入](./postman-collection.json)
- **Insomnia**: 轻量级API测试工具
- **curl**: 命令行测试

### 前端开发
- **React**: 推荐框架
- **Ant Design**: UI组件库
- **Axios**: HTTP客户端
- **React Query**: 数据获取和缓存

### 调试工具
- **Chrome DevTools**: 浏览器调试
- **React DevTools**: React组件调试
- **Redux DevTools**: 状态调试（如使用）

## 📞 技术支持

### 获取帮助
- **技术文档**: https://docs.zhongdao-mall.com
- **GitHub Issues**: https://github.com/zhongdao-mall/issues
- **技术邮箱**: dev@zhongdao-mall.com
- **客服热线**: 400-123-4567

### 开发者社区
- **微信交流群**: 扫描二维码加入
- **QQ群**: 123456789
- **技术博客**: blog.zhongdao-mall.com

## 📝 更新日志

### v1.0.0 (2025-11-24)
- ✅ 完成API文档体系建设
- ✅ 添加业务逻辑说明
- ✅ 提供前端集成示例
- ✅ 优化Swagger文档配置

### 即将发布
- 🔄 添加GraphQL支持
- 📱 H5 SDK发布
- 🔌 WebHook文档
- 📊 数据分析API

---

💡 **提示**: 建议先阅读[快速开始指南](./quick-start.md)，快速了解API使用方法。如有疑问，请查看[常见问题解决](./troubleshooting.md)或联系技术支持。

## 🔗 相关链接

- [中道商城官网](https://www.zhongdao-mall.com)
- [小程序开发文档](./h5-integration-guide.md)
- [管理后台指南](./admin-system-guide.md)
- [支付接口文档](./payment-integration.md)

---

## 历史文档（项目技术文档）

本文档体系提供了完整的中道商城系统技术文档，包括API文档、架构设计、开发指南和最佳实践。

## 文档概览

### 📚 文档结构

```
docs/
├── api/                    # API接口文档
│   ├── README.md          # API开发指南
│   ├── authentication.md  # 认证相关API
│   ├── users.md           # 用户管理API
│   ├── products.md        # 商品管理API
│   ├── orders.md          # 订单管理API
│   ├── payments.md        # 支付相关API
│   ├── points.md          # 通券管理API
│   ├── shops.md           # 店铺管理API
│   ├── inventory.md       # 库存管理API
│   ├── teams.md           # 团队管理API
│   └── commission.md      # 佣金管理API
├── architecture/          # 架构文档
│   ├── overview.md        # 系统概述
│   ├── design-principles.md # 设计原则
│   ├── database-schema.md  # 数据库设计
│   └── security.md        # 安全设计
├── adr/                   # 架构决策记录
│   ├── README.md          # ADR说明
│   ├── 0001-use-prisma.md # 使用Prisma ORM
│   ├── 0002-jwt-auth.md   # JWT认证方案
│   └── ...                # 更多ADR
├── guides/                # 开发者指南
│   ├── getting-started.md # 快速开始
│   ├── authentication.md  # 认证指南
│   ├── error-handling.md  # 错误处理
│   └── best-practices.md  # 最佳实践
└── diagrams/              # 架构图和流程图
    ├── c4-model/          # C4架构图
    ├── business-flow/     # 业务流程图
    └── sequence-diagrams/ # 时序图
```

### 🚀 快速导航

#### 新开发者
1. [快速开始指南](./guides/getting-started.md) - 5分钟搭建开发环境
2. [API文档](./api/README.md) - 了解所有API接口
3. [认证指南](./guides/authentication.md) - 理解认证授权机制

#### 架构师
1. [架构决策记录](./adr/) - 了解重要技术决策
2. [C4架构图](./diagrams/c4-model/) - 可视化系统架构
3. [业务流程](./diagrams/business-flow/) - 核心业务流程详解

#### 运维工程师
1. [部署指南](./guides/deployment.md) - 系统部署说明
2. [监控指南](./guides/monitoring.md) - 性能监控和告警
3. [故障处理](./guides/troubleshooting.md) - 常见问题解决方案

## 在线文档

- **API文档**: [https://api.zhongdao-mall.com/api-docs](https://api.zhongdao-mall.com/api-docs)
- **文档门户**: [https://docs.zhongdao-mall.com](https://docs.zhongdao-mall.com)

## 开发工作流

### 1. 查看文档
```bash
# 本地开发环境
npm run dev

# 访问API文档
open http://localhost:3000/api-docs
```

### 2. 文档更新
```bash
# 同步所有文档
npm run docs:sync

# 启动文档监视（自动更新）
npm run docs:watch
```

### 3. 构建文档门户
```bash
# 构建文档门户
npm run docs:build

# 本地预览
npm run docs:serve
```

## 文档开发规范

### 1. API文档规范
- 使用OpenAPI 3.0注释
- 提供完整的请求/响应示例
- 说明业务规则和约束条件
- 标注权限要求

### 2. 架构图规范
- 使用Mermaid.js绘制图表
- 遵循C4模型标准
- 保持图表简洁清晰
- 提供必要的图例说明

### 3. 文档写作规范
- 使用Markdown格式
- 标题层级清晰
- 代码块标注语言
- 提供实际可运行的示例

## 贡献指南

### 提交文档更新
1. Fork项目仓库
2. 创建功能分支
3. 更新或创建文档
4. 提交Pull Request

### 文档审查
- 技术准确性
- 内容完整性
- 格式规范性
- 示例可运行性

### 反馈渠道
- [GitHub Issues](https://github.com/zhongdao/zhongdao-mall/issues)
- 邮件：dev@zhongdao-mall.com

## 版本管理

### API版本
- API版本通过URL路径管理
- 当前版本：v1
- 向后兼容原则

### 文档版本
- 文档与代码同步更新
- 重要变更记录在更新日志
- 保留历史版本文档

## 常见问题

### Q: 如何添加新的API文档？
A: 在路由文件中添加OpenAPI注释，然后运行 `npm run docs:sync`

### Q: 如何更新架构图？
A: 编辑 `docs/diagrams/` 目录下的文件，支持Mermaid语法

### Q: 文档构建失败怎么办？
A: 检查Markdown语法和Mermaid图表语法，确保没有语法错误

## 相关资源

- [项目仓库](https://github.com/zhongdao/zhongdao-mall)
- [Docusaurus文档](https://docusaurus.io/)
- [OpenAPI规范](https://swagger.io/specification/)
- [Mermaid文档](https://mermaid-js.github.io/)

---

> 💡 **提示**: 文档是项目的重要组成部分，保持文档的及时更新和准确性对团队协作至关重要。