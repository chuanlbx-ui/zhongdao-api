# 中道商城支付系统

## 概述

中道商城支付系统是一个统一的支付渠道集成与回调处理系统，支持微信支付、支付宝支付和通券支付的完整支付流程。

## 功能特性

### 核心功能
- ✅ **多渠道支付集成**：支持微信支付、支付宝、通券支付
- ✅ **异步回调处理**：统一的回调处理和验证机制
- ✅ **退款处理**：完整的退款申请和处理流程
- ✅ **对账功能**：自动对账和差异分析
- ✅ **支付统计**：多维度支付数据统计
- ✅ **安全机制**：防重复支付、签名验证、支付锁
- ✅ **监控告警**：支付成功率监控、异常告警

### 支付方式
- **微信支付**：
  - 小程序支付 (JSAPI)
  - 扫码支付 (NATIVE)
  - APP支付 (APP)
  - H5支付 (MWEB)

- **支付宝支付**：
  - 网页支付 (FAST_INSTANT_TRADE_PAY)
  - 手机网站支付 (QUICK_WAP_PAY)
  - APP支付 (QUICK_MSECURITY_PAY)
  - 扫码支付 (FACE_TO_FACE_PAYMENT)

- **通券支付**：
  - 积分扣减支付
  - 积分转账
  - 积分充值

## 快速开始

### 1. 环境配置

复制环境变量模板并配置相关参数：

```bash
cp .env.example .env
```

关键配置项：

```env
# 微信支付配置
WECHAT_APP_ID="your_wechat_app_id"
WECHAT_MCH_ID="your_wechat_merchant_id"
WECHAT_API_V3_KEY="your_wechat_api_v3_key"
WECHAT_KEY="your_wechat_key"
WECHAT_NOTIFY_URL="https://your-domain.com/api/v1/payments/wechat/notify"

# 支付宝配置
ALIPAY_APP_ID="your_alipay_app_id"
ALIPAY_PRIVATE_KEY="your_alipay_private_key"
ALIPAY_PUBLIC_KEY="your_alipay_public_key"
ALIPAY_NOTIFY_URL="https://your-domain.com/api/v1/payments/alipay/notify"

# 数据库配置
DATABASE_URL="mysql://username:password@localhost:3306/zhongdao_mall"
```

### 2. 数据库迁移

```bash
# 生成Prisma客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev --name init_payment_system
```

### 3. 基础使用

#### 创建支付订单

```typescript
import { paymentService, PaymentChannel, PaymentTradeType } from '../modules/payment';

const createPayment = async () => {
  const request = {
    userId: 'user123',
    amount: 100.00,
    channel: PaymentChannel.WECHAT,
    method: PaymentMethod.WECHAT,
    tradeType: PaymentTradeType.WECHAT_JSAPI,
    subject: '商品订单支付',
    description: '订单编号：ORDER123',
    openid: 'user_wechat_openid'
  };

  const result = await paymentService.createPaymentOrder(request);

  if (result.success) {
    console.log('支付订单创建成功', {
      paymentId: result.paymentId,
      paymentNo: result.paymentNo,
      payInfo: result.payInfo // 前端用于调起支付的参数
    });
  }
};
```

#### 查询支付状态

```typescript
const queryPayment = async (paymentId: string) => {
  const result = await paymentService.queryPaymentStatus(paymentId);

  console.log('支付状态', {
    paymentId: result.payment.id,
    status: result.payment.status,
    amount: result.payment.amount,
    paidAt: result.payment.paidAt
  });
};
```

#### 创建退款

```typescript
const createRefund = async (paymentId: string) => {
  const request = {
    paymentId: paymentId,
    refundAmount: 50.00,
    refundReason: '用户申请退款',
    applyUserId: 'user123'
  };

  const result = await paymentService.createRefundOrder(request);

  if (result.success) {
    console.log('退款申请成功', {
      refundId: result.refundId,
      refundNo: result.refundNo
    });
  }
};
```

## API接口

### 支付接口

#### 创建支付订单
```
POST /api/v1/payments/create
Content-Type: application/json

{
  "userId": "user123",
  "amount": 100.00,
  "channel": "WECHAT",
  "method": "WECHAT",
  "subject": "商品订单支付",
  "description": "订单编号：ORDER123",
  "openid": "user_wechat_openid"
}
```

#### 查询支付状态
```
GET /api/v1/payments/:paymentId
Authorization: Bearer <token>
```

#### 查询支付列表
```
GET /api/v1/payments/query?userId=user123&page=1&perPage=20
Authorization: Bearer <token>
```

### 退款接口

#### 创建退款申请
```
POST /api/v1/payments/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentId": "pay_xxx",
  "refundAmount": 50.00,
  "refundReason": "用户申请退款"
}
```

### 回调接口

#### 微信支付回调
```
POST /api/v1/payments/wechat/notify
```

#### 支付宝回调
```
POST /api/v1/payments/alipay/notify
```

## 架构设计

### 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端应用      │    │   商户后台      │    │   移动APP      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Gateway   │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │  支付模块 API   │
                    │  (routes.ts)    │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ 支付服务        │    │ 微信适配器      │    │ 支付宝适配器    │
│ (payment.service)│    │ (wechat.provider)│    │ (alipay.provider)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   基础设施      │
                    │ Prisma Database │
                    │    Redis Cache  │
                    │  Notification   │
                    │    Logger       │
                    └─────────────────┘
```

### 数据库设计

支付系统包含以下核心数据表：

1. **payment_records** - 支付记录表
2. **payment_refunds** - 退款记录表
3. **payment_logs** - 支付操作日志表
4. **payment_locks** - 支付锁表（防重复）
5. **payment_reconciliations** - 对账记录表

### 关键流程

#### 支付流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant App as 应用
    participant Service as 支付服务
    participant Channel as 支付渠道
    participant DB as 数据库

    User->>App: 发起支付
    App->>Service: 创建支付订单
    Service->>DB: 保存支付记录
    Service->>Service: 获取支付锁
    Service->>Channel: 调用支付API
    Channel-->>Service: 返回支付参数
    Service->>DB: 更新渠道信息
    Service-->>App: 返回支付参数
    App-->>User: 调起支付

    Note over Channel: 用户完成支付

    Channel->>Service: 支付回调通知
    Service->>Service: 验证签名
    Service->>DB: 更新支付状态
    Service->>DB: 释放支付锁
    Service->>Service: 处理业务逻辑
    Service-->>Channel: 返回成功响应
```

#### 退款流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant App as 应用
    participant Service as 支付服务
    participant Channel as 支付渠道
    participant DB as 数据库

    User->>App: 申请退款
    App->>Service: 创建退款订单
    Service->>DB: 查询支付记录
    Service->>Service: 验证退款条件
    Service->>DB: 创建退款记录
    Service->>Channel: 调用退款API
    Channel-->>Service: 返回退款结果
    Service->>DB: 更新退款状态
    Service-->>App: 返回退款结果
    App-->>User: 显示退款状态
```

## 安全机制

### 1. 签名验证
- 微信支付：RSA签名验证
- 支付宝：RSA2签名验证
- 确保回调数据真实性

### 2. 防重复支付
- 基于订单+用户的支付锁
- 15分钟锁定时间
- 自动过期清理

### 3. 金额验证
- 订单金额二次验证
- 退款金额不能超过支付金额
- 防止金额篡改

### 4. 状态管理
- 严格的支付状态流转
- 防止状态回退
- 幂等性操作

## 监控告警

### 关键指标
- 支付成功率
- 平均响应时间
- 异常支付数量
- 回调处理延迟

### 告警规则
- 支付成功率 < 95%
- API响应时间 > 200ms
- 支付异常数量 > 10/小时
- 回调处理失败

## 常见问题

### Q: 如何配置微信支付？
A: 需要在微信公众平台获取AppID，在微信商户平台配置商户号、API密钥和下载API证书。

### Q: 如何处理支付回调超时？
A: 系统实现了自动重试机制，同时支持手动查询支付状态进行补偿。

### Q: 如何查看对账报表？
A: 通过对账接口可以生成每日对账报表，支持自动差异分析。

### Q: 如何处理通券支付？
A: 通券支付通过积分系统实现，自动扣减用户积分并记录流水。

## 开发指南

### 添加新的支付渠道

1. 继承 `PaymentProvider` 基类
2. 实现必需的抽象方法
3. 在工厂类中注册新渠道
4. 添加相应的配置项

### 自定义业务逻辑

可以通过继承 `PaymentService` 类并重写相应方法来实现自定义业务逻辑。

### 扩展回调处理

通过实现 `CallbackHandler` 接口来扩展回调处理逻辑。

## 版本历史

- **v1.0.0** - 初始版本
  - 支持微信支付和支付宝
  - 基础回调处理
  - 退款功能
  - 对账功能

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

本项目采用 MIT 许可证。