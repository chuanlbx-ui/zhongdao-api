# 微信支付测试指南

## 📋 概述

本文档提供在中道商城系统中测试微信支付功能的完整指南，包括本地开发环境的配置、接口测试和回调验证。

## ✅ 已完成的配置

### 1. 支付宝支付已禁用
- ✅ 注释掉了支付宝相关配置代码
- ✅ 移除了支付宝路由
- ✅ 系统启动不再显示支付宝配置错误

### 2. 微信支付配置
- ✅ 启用微信支付沙箱模式
- ✅ 配置基础环境变量
- ✅ 添加支付回调测试接口

### 3. API 接口
- ✅ 微信支付配置查看接口
- ✅ 支付订单创建接口
- ✅ 支付状态查询接口
- ✅ 支付回调测试接口
- ✅ 测试数据生成接口

## 🧪 测试接口列表

### 基础配置接口

#### 1. 获取微信支付配置
```http
GET /api/v1/payments/wechat/config
Authorization: Bearer <token>
```

#### 2. 测试支付连接
```http
POST /api/v1/payments/wechat/test-connection
Authorization: Bearer <token>
```

### 支付业务接口

#### 3. 创建微信支付订单
```http
POST /api/v1/payments/wechat/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "method": "WECHAT_JSAPI",
  "orderId": "uuid-order-id",
  "amount": 0.01,
  "subject": "测试商品",
  "description": "测试描述",
  "openid": "user-openid"
}
```

#### 4. 查询支付状态
```http
GET /api/v1/payments/wechat/query/{orderId}
Authorization: Bearer <token>
```

#### 5. 关闭支付订单
```http
POST /api/v1/payments/wechat/close/{orderId}
Authorization: Bearer <token>
```

### 测试专用接口

#### 6. 生成测试回调数据
```http
GET /api/v1/payments/wechat/generate-callback-data/{orderId}
Authorization: Bearer <token>
```

#### 7. 模拟支付回调
```http
POST /api/v1/payments/wechat/test-callback
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "uuid-order-id",
  "status": "SUCCESS",
  "amount": 0.01,
  "transactionId": "wx_test_123456789"
}
```

## 🔧 当前配置状态

### 环境变量配置
```bash
# 微信小程序配置
WECHAT_APP_ID=wx1ea1b1b0bf6bb19c  # ⚠️ 需要替换为真实值
WECHAT_APP_SECRET=dd9a1e0b21c0dfb8614071f32bc61ded  # ⚠️ 需要替换为真实值

# 微信支付配置
WECHAT_MCH_ID=1623525309  # 商户号
WECHAT_KEY=7fK9qR2pY5vX3zW8nB6cD1mH4gJ7sL9kT  # API密钥
WECHAT_API_V3_KEY=zhongdao_mall_api_v3_key_32  # API v3密钥
WECHAT_API_SERIAL_NO=9A2A3A4B5C6D7E8E9A0B1C2D3E4F5A6B7C8D9E0F  # 证书序列号
WECHAT_SANDBOX=true  # 沙箱模式

# 支付回调URL（需要配置内网穿透）
WECHAT_NOTIFY_URL=https://your-domain.com/api/v1/payments/wechat/notify
```

## 🧪 本地测试步骤

### 1. 准备工作

#### 安装内网穿透工具（推荐）
```bash
# 使用 ngrok
npm install -g ngrok

# 启动内网穿透
ngrok http 3000

# 或者使用其他工具：
# - https://natapp.cn/
# - https://www.frp.fun/
# - http:// tunnel.natapp.cc/
```

#### 更新回调URL
将获得的公网域名更新到环境变量中：
```bash
# 例如：https://abc123.ngrok.io
WECHAT_NOTIFY_URL=https://abc123.ngrok.io/api/v1/payments/wechat/notify
```

### 2. 测试流程

#### 步骤1：检查配置状态
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/payments/wechat/config
```

#### 步骤2：生成测试订单ID
```bash
# 可以使用UUID生成器
uuidgen  # Linux/Mac
# 或者在线生成UUID
```

#### 步骤3：生成测试回调数据
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/payments/wechat/generate-callback-data/{orderId}
```

#### 步骤4：测试支付回调
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "your-order-id",
    "status": "SUCCESS",
    "amount": 0.01
  }' \
  http://localhost:3000/api/v1/payments/wechat/test-callback
```

## 🧪 回调验证机制

### 支付状态说明

| 状态 | 描述 | 测试方法 |
|------|------|----------|
| **SUCCESS** | 支付成功 | 调用测试接口设置status为"SUCCESS" |
| **FAILED** | 支付失败 | 调用测试接口设置status为"FAILED" |
| **CLOSED** | 订单关闭 | 调用测试接口设置status为"CLOSED" |

### 回调处理逻辑

1. **支付成功回调**：
   - 更新订单状态为已支付
   - 触发库存扣减
   - 生成用户通券流转记录
   - 发送支付成功通知

2. **支付失败回调**：
   - 更新订单状态为支付失败
   - 释放库存预留
   - 发送支付失败通知

## 📱 真实微信支付测试

### 微信小程序支付流程

1. **前端调用支付**：
```javascript
wx.requestPayment({
  timeStamp: '',
  nonceStr: '',
  package: '',
  signType: 'MD5',
  paySign: '',
  success: function(res) {
    // 支付成功后的处理
  },
  fail: function(res) {
    // 支付失败后的处理
  }
})
```

2. **后端处理回调**：
```typescript
// 微信支付回调处理
router.post('/wechat/notify', async (req, res) => {
  // 验证签名
  // 解析回调数据
  // 更新订单状态
  // 返回微信要求格式
  res.json({ code: 'SUCCESS', message: '成功' });
});
```

## 🚨 常见问题和解决方案

### 1. 配置错误

**问题**：微信支付配置缺少必要字段
```bash
微信支付配置缺少必要字段: [ 'appId', 'mchId', 'apiV3Key', 'key' ]
```

**解决**：
- 获取真实的小程序AppID和AppSecret
- 申请微信支付商户号
- 配置API密钥和证书

### 2. 回调URL无法访问

**问题**：微信无法访问本地回调URL

**解决**：
- 使用内网穿透工具（ngrok、natapp等）
- 确保回调URL可以通过公网访问
- 测试回调URL是否返回正确的响应格式

### 3. 签名验证失败

**问题**：支付回调签名验证失败

**解决**：
- 检查API密钥配置是否正确
- 确认回调数据格式符合微信规范
- 使用微信提供的签名验证工具

## 🔒 安全注意事项

### 1. 生产环境配置
- 使用真实的小程序AppID和AppSecret
- 配置生产环境的商户号和API密钥
- 启用HTTPS和证书验证

### 2. 回调安全
- 验证微信回调的签名
- 检查回调数据的完整性
- 防止重复回调处理

### 3. 日志记录
- 记录所有支付相关的操作日志
- 监控异常支付行为
- 定期检查支付数据一致性

## 📊 测试报告模板

### 测试用例

```markdown
## 微信支付测试报告

### 基础配置测试
- [ ] 配置信息获取正常
- [ ] 沙箱模式启用成功
- [ ] 支付连接测试通过

### 支付流程测试
- [ ] 创建支付订单成功
- [ ] 支付参数格式正确
- [ ] 支付状态查询正常
- [ ] 订单关闭功能正常

### 回调处理测试
- [ ] 支付成功回调处理正常
- [ ] 支付失败回调处理正常
- [ ] 订单关闭回调处理正常
- [ ] 回调数据验证通过

### 业务逻辑测试
- [ ] 订单状态更新正确
- [ ] 库存扣减逻辑正常
- [ ] 通券流转记录正确
- [ ] 用户通知发送成功
```

## 🎯 下一步计划

### 1. 完善配置
- 获取真实的微信支付配置
- 配置生产环境证书
- 设置正确的回调URL

### 2. 集成测试
- 与小程序前端集成测试
- 完整支付流程测试
- 异常情况处理测试

### 3. 生产部署
- 配置生产环境参数
- 性能和安全测试
- 监控和日志配置

---

*最后更新: 2025-11-24*