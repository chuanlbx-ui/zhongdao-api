# C4模型：容器图

## 容器架构图

```mermaid
C4Container
    title 中道商城系统容器架构

    Person(用户, "商城用户")
    Person(管理员, "系统管理员")

    Container_Boundary(商城系统, "中道商城系统") {
        Container(web_app, "微信小程序", "React/Vue", "用户购物界面")
        Container(admin_console, "管理后台", "Vue 3 + Element Plus", "系统管理界面")
        Container(api_gateway, "API网关", "Nginx", "路由、负载均衡、SSL终止")

        Container_Boundary(后端服务, "Backend Services") {
            Container(auth_service, "认证服务", "Node.js + Express", "JWT认证、权限管理")
            Container(user_service, "用户服务", "Node.js + Express", "用户管理、团队关系")
            Container(product_service, "商品服务", "Node.js + Express", "商品目录、定价管理")
            Container(order_service, "订单服务", "Node.js + Express", "订单处理、业务规则")
            Container(payment_service, "支付服务", "Node.js + Express", "支付集成、通券管理")
            Container(shop_service, "店铺服务", "Node.js + Express", "店铺管理、业绩计算")
            Container(inventory_service, "库存服务", "Node.js + Express", "库存管理、预警")
            Container(team_service, "团队服务", "Node.js + Express", "团队管理、佣金计算")
            Container(notification_service, "通知服务", "Node.js + Express", "消息推送、通知管理")
        }

        ContainerDb(mysql, "MySQL数据库", "MySQL 8.0", "业务数据存储")
        ContainerDb(redis, "Redis缓存", "Redis 7", "会话、缓存")
    }

    System_Ext(微信平台, "微信API")
    System_Ext(支付宝, "支付宝API")
    System_Ext(物流公司, "物流API")

    Rel(用户, web_app, "使用", "HTTPS/WSS")
    Rel(管理员, admin_console, "使用", "HTTPS")
    Rel(web_app, api_gateway, "调用API", "HTTPS")
    Rel(admin_console, api_gateway, "调用API", "HTTPS")

    Rel(api_gateway, auth_service, "认证/鉴权", "HTTP")
    Rel(api_gateway, user_service, "用户相关", "HTTP")
    Rel(api_gateway, product_service, "商品相关", "HTTP")
    Rel(api_gateway, order_service, "订单相关", "HTTP")
    Rel(api_gateway, payment_service, "支付相关", "HTTP")
    Rel(api_gateway, shop_service, "店铺相关", "HTTP")
    Rel(api_gateway, inventory_service, "库存相关", "HTTP")
    Rel(api_gateway, team_service, "团队相关", "HTTP")
    Rel(api_gateway, notification_service, "通知相关", "HTTP")

    Rel(auth_service, mysql, "读写", "JDBC")
    Rel(user_service, mysql, "读写", "JDBC")
    Rel(product_service, mysql, "读写", "JDBC")
    Rel(order_service, mysql, "读写", "JDBC")
    Rel(payment_service, mysql, "读写", "JDBC")
    Rel(shop_service, mysql, "读写", "JDBC")
    Rel(inventory_service, mysql, "读写", "JDBC")
    Rel(team_service, mysql, "读写", "JDBC")
    Rel(notification_service, mysql, "读写", "JDBC")

    Rel(auth_service, redis, "缓存会话", "TCP")
    Rel(user_service, redis, "缓存用户数据", "TCP")
    Rel(product_service, redis, "缓存商品数据", "TCP")

    Rel(payment_service, 微信平台, "微信支付", "HTTPS")
    Rel(payment_service, 支付宝, "支付宝支付", "HTTPS")
    Rel(order_service, 物流公司, "物流查询", "HTTPS")
```

## 容器详细说明

### 1. 微信小程序 (web_app)
- **技术栈**: React/Vue + TypeScript
- **职责**:
  - 商品展示和搜索
  - 购物车和下单
  - 支付和订单管理
  - 团队管理
  - 个人中心
- **部署**: 微信小程序平台

### 2. 管理后台 (admin_console)
- **技术栈**: Vue 3 + Element Plus + TypeScript
- **职责**:
  - 商品管理
  - 订单处理
  - 用户管理
  - 数据统计
  - 系统配置
- **部署**: 阿里云/腾讯云

### 3. API网关 (api_gateway)
- **技术栈**: Nginx + Lua
- **职责**:
  - 请求路由
  - 负载均衡
  - SSL终止
  - 限流熔断
  - 请求日志

### 4. 认证服务 (auth_service)
- **职责**:
  - JWT令牌管理
  - 用户认证
  - 权限验证
  - 会话管理
- **特性**:
  - 无状态设计
  - 刷新令牌机制
  - 多级权限控制

### 5. 用户服务 (user_service)
- **职责**:
  - 用户注册/登录
  - 用户信息管理
  - 团队关系维护
  - 等级管理
- **核心逻辑**:
  - 推荐关系链
  - 层级计算
  - 业绩统计

### 6. 商品服务 (product_service)
- **职责**:
  - 商品目录管理
  - 分类和标签
  - 定价策略
  - 规格管理
- **特性**:
  - 差异化定价
  - 库存关联
  - 状态管理

### 7. 订单服务 (order_service)
- **职责**:
  - 订单创建
  - 业务规则验证
  - 订单流转
  - 业绩计算
- **核心规则**:
  - 采购权限验证
  - 供应链路径
  - 佣金预计算

### 8. 支付服务 (payment_service)
- **职责**:
  - 支付接口集成
  - 通券管理
  - 退款处理
  - 资金记录
- **集成**:
  - 微信支付
  - 支付宝
  - 通券系统

### 9. 店铺服务 (shop_service)
- **职责**:
  - 店铺管理
  - 业绩统计
  - 升级计算
  - 权限管理
- **类型**:
  - 云店管理
  - 五通店管理

### 10. 库存服务 (inventory_service)
- **职责**:
  - 多仓库管理
  - 库存同步
  - 预警通知
  - 调拨管理
- **仓库类型**:
  - 平台仓
  - 云仓
  - 本地仓

### 11. 团队服务 (team_service)
- **职责**:
  - 团队结构管理
  - 佣金计算
  - 绩效统计
  - 排名系统
- **计算规则**:
  - 多级佣金
  - 平级奖励
  - 特殊奖励

### 12. 通知服务 (notification_service)
- **职责**:
  - 消息推送
  - 通知模板
  - 渠道管理
  - 发送记录
- **渠道**:
  - 微信模板消息
  - 短信
  - 邮件

## 技术选型说明

### 为什么选择Node.js
- 高并发处理能力
- TypeScript原生支持
- 丰富的生态系统
- 与前端技术栈统一

### 为什么选择MySQL
- 事务支持完善
- 复杂查询能力强
- 成熟稳定
- 团队熟悉度高

### 为什么选择Redis
- 高性能缓存
- 丰富的数据结构
- 持久化支持
- 集群扩展能力

## 部署架构

### 容器化部署
```yaml
# docker-compose.yml
services:
  - nginx (API网关)
  - app (后端服务)
  - mysql (数据库)
  - redis (缓存)
```

### 扩展性设计
- 服务无状态设计
- 数据库读写分离
- 缓存集群部署
- 负载均衡配置