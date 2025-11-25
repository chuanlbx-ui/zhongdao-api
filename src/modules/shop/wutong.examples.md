# 五通店API使用示例

## 概述
五通店是中道商城的特色商业模式，提供买10赠1机制和终身权益。

## 核心功能
- **准入条件**: 一次性拿货100瓶×270元/瓶 = 27,000元
- **特殊权益**: 终身享受买10赠1机制
- **升级特权**: 普通/VIP会员可直接升级为二星店长
- **赠品规则**: 满5,999元送599元商品，每满10瓶送1瓶

## API端点

### 1. 验证五通店资格
```http
GET /api/wutong/qualification
Authorization: Bearer <token>
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "hasWutongShop": true,
    "shopId": "shop_123",
    "shopStatus": "ACTIVE",
    "activatedAt": "2024-01-01T00:00:00.000Z",
    "canUseBenefits": true
  },
  "message": "您享有五通店权益"
}
```

### 2. 计算买10赠1权益
```http
POST /api/wutong/calculate-benefit
Authorization: Bearer <token>
Content-Type: application/json

{
  "cartItems": [
    {
      "productId": "prod_123",
      "productName": "产品A",
      "quantity": 15,
      "unitPrice": 599,
      "totalPrice": 8985
    }
  ]
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "qualifies": true,
    "orderAmount": 8985,
    "freeQuantity": 1,
    "freeProducts": [
      {
        "productId": "prod_123",
        "productName": "产品A",
        "quantity": 1,
        "unitPrice": 599,
        "totalValue": 599
      }
    ],
    "savingsAmount": 599,
    "message": "恭喜！您获得了1件赠品，价值599元"
  }
}
```

### 3. 开通五通店
```http
POST /api/wutong/open-shop
Authorization: Bearer <token>
Content-Type: application/json

{
  "contactName": "张三",
  "contactPhone": "13800138000",
  "address": "北京市朝阳区xxx街道"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "shopId": "shop_456",
    "previousLevel": "NORMAL",
    "newLevel": "STAR_2",
    "benefits": [
      "终身享受买10赠1机制",
      "满5,999元送599元商品",
      "可直接升级为二星店长",
      "享受二星店长所有权益：3.5折进货价、团队管理等",
      "优先销售权和库存保障",
      "专属客服和技术支持"
    ]
  },
  "message": "恭喜开通五通店！您已升级为二星店长，享受买10赠1终身权益"
}
```

### 4. 获取五通店统计
```http
GET /api/wutong/statistics
Authorization: Bearer <token>
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "shopId": "shop_456",
    "activatedAt": "2024-01-01T00:00:00.000Z",
    "totalOrders": 25,
    "totalGiftsGiven": 8,
    "totalGiftValue": 4792,
    "lastGiftAt": "2024-01-20T15:30:00.000Z",
    "monthlyStats": {
      "orders": 5,
      "giftsGiven": 2,
      "giftValue": 1198
    }
  }
}
```

### 5. 获取权益说明
```http
GET /api/wutong/benefits
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "benefits": [
      "终身享受买10赠1机制",
      "满5,999元送599元商品",
      "可直接升级为二星店长",
      "享受二星店长所有权益：3.5折进货价、团队管理等",
      "优先销售权和库存保障",
      "专属客服和技术支持"
    ],
    "entryFee": 27000,
    "giftThreshold": 5999,
    "giftValue": 599,
    "giftRatio": "买10赠1"
  }
}
```

## 业务规则说明

### 买10赠1计算规则
1. **门槛检查**: 订单金额需满5,999元
2. **赠品计算**: 每满10瓶送1瓶同款商品
3. **库存检查**: 优先选择同款商品，库存不足时选择等值商品
4. **价值限制**: 赠品总价值不超过599元

### 升级特权规则
1. **普通会员**: 开通五通店 → 直接成为二星店长
2. **VIP会员**: 开通五通店 → 直接成为二星店长
3. **已升级用户**: 如果已是二星店长或更高等级，保持原等级

### 权益使用限制
1. **终身有效**: 五通店权益终身有效，无使用次数限制
2. **商品范围**: 仅限参与活动的商品可享受赠品
3. **叠加优惠**: 五通店权益与其他优惠不冲突

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 401 | 用户未登录 |
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

## 集成示例

### JavaScript/TypeScript集成
```typescript
import axios from 'axios';

// 计算五通店权益
async function calculateWutongBenefit(cartItems) {
  try {
    const response = await axios.post('/api/wutong/calculate-benefit', {
      cartItems
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('计算权益失败:', error);
  }
}

// 开通五通店
async function openWutongShop(contactInfo) {
  try {
    const response = await axios.post('/api/wutong/open-shop', contactInfo, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('开通五通店失败:', error);
  }
}
```

### React组件示例
```tsx
import React, { useState, useEffect } from 'react';

function WutongBenefitCalculator({ cartItems, onBenefitCalculated }) {
  const [loading, setLoading] = useState(false);
  const [benefit, setBenefit] = useState(null);

  useEffect(() => {
    if (cartItems.length > 0) {
      calculateBenefit();
    }
  }, [cartItems]);

  const calculateBenefit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/wutong/calculate-benefit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ cartItems })
      });

      const data = await response.json();
      if (data.success) {
        setBenefit(data.data);
        onBenefitCalculated(data.data);
      }
    } catch (error) {
      console.error('计算权益失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>计算中...</div>;

  return benefit && (
    <div className="wutong-benefit">
      <h3>五通店权益</h3>
      {benefit.qualifies ? (
        <div>
          <p>🎉 恭喜获得赠品！</p>
          <p>赠品数量: {benefit.freeQuantity}件</p>
          <p>节省金额: ¥{benefit.savingsAmount}</p>
        </div>
      ) : (
        <p>{benefit.message}</p>
      )}
    </div>
  );
}
```