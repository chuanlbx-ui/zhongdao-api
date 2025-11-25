# 推荐系统API文档

## 概述

中道商城推荐系统为每个用户自动生成6位数推荐码，支持用户注册时绑定推荐人关系，构建多级推荐体系。

## 核心功能

- **自动推荐码生成**: 每个用户注册时自动获得唯一的6位数推荐码
- **推荐关系绑定**: 新用户注册时可选择输入推荐码建立推荐关系
- **推荐码验证**: 验证推荐码的有效性和推荐人状态
- **推荐信息查询**: 查看个人推荐码和推荐统计数据

## API接口

### 1. 用户注册（含推荐码）

**接口地址**: `POST /api/v1/users/register`

**请求参数**:

```json
{
  "openid": "string",         // 微信openid（必填）
  "nickname": "string",       // 用户昵称（可选）
  "phone": "string",          // 手机号（可选）
  "avatarUrl": "string",      // 头像URL（可选）
  "referralCode": "string"    // 推荐人推荐码（可选，6位数字）
}
```

**请求示例**:

```bash
# 无推荐码注册
curl -X POST http://localhost:3001/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "openid": "wx_test_001",
    "nickname": "测试用户",
    "phone": "13800138000"
  }'

# 有推荐码注册
curl -X POST http://localhost:3001/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "openid": "wx_test_002",
    "nickname": "新用户",
    "phone": "13800138001",
    "referralCode": "123456"
  }'
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cmi4abc123def456",
      "openid": "wx_test_001",
      "nickname": "测试用户",
      "phone": "13800138000",
      "avatarUrl": null,
      "referralCode": "823417",        // 用户自己的推荐码
      "level": "normal",
      "status": "active",
      "createdAt": "2025-11-22T04:30:00.000Z"
    }
  },
  "message": "用户注册成功",
  "timestamp": "2025-11-22T04:30:00.000Z"
}
```

### 2. 验证推荐码

**接口地址**: `POST /api/v1/users/validate-referral`

**请求参数**:

```json
{
  "referralCode": "string"  // 推荐码（必填，6位数字）
}
```

**请求示例**:

```bash
curl -X POST http://localhost:3001/api/v1/users/validate-referral \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "123456"
  }'
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "valid": true,
    "referrer": {
      "id": "cmi4abc123def456",
      "nickname": "推荐人昵称",
      "avatarUrl": "https://example.com/avatar.jpg",
      "level": "vip",
      "status": "active"
    }
  },
  "message": "推荐码验证成功",
  "timestamp": "2025-11-22T04:30:00.000Z"
}
```

**错误响应示例**:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REFERRAL_CODE",
    "message": "推荐码不存在或已失效",
    "timestamp": "2025-11-22T04:30:00.000Z"
  }
}
```

### 3. 获取我的推荐信息

**接口地址**: `GET /api/v1/users/referral-info`

**请求头**:
```
Authorization: Bearer <access_token>
```

**请求示例**:

```bash
curl -X GET http://localhost:3001/api/v1/users/referral-info \
  -H "Authorization: Bearer your_access_token_here"
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "referralCode": "823417",
    "directCount": 5,              // 直推人数
    "teamCount": 23,               // 团队总人数
    "recentReferrals": [           // 最近推荐的用户（最多10条）
      {
        "id": "cmi4def789ghi012",
        "nickname": "用户A",
        "avatarUrl": null,
        "level": "normal",
        "createdAt": "2025-11-21T10:30:00.000Z"
      },
      {
        "id": "cmi4jkl345mno678",
        "nickname": "用户B",
        "avatarUrl": "https://example.com/avatar2.jpg",
        "level": "vip",
        "createdAt": "2025-11-20T15:45:00.000Z"
      }
    ]
  },
  "message": "获取推荐信息成功",
  "timestamp": "2025-11-22T04:30:00.000Z"
}
```

## 错误码说明

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `INVALID_REFERRAL_CODE` | 推荐码无效 | 检查推荐码格式和是否正确 |
| `USER_EXISTS` | 用户已存在 | 提示用户直接登录或使用其他openid |
| `USER_NOT_FOUND` | 用户不存在 | 检查token是否有效或用户状态 |

## 推荐码规则

- **格式**: 6位纯数字
- **首位**: 1-9（避免以0开头）
- **唯一性**: 系统自动检查确保唯一
- **重试机制**: 生成失败时最多重试50次

## 推荐关系建立

1. **用户注册**: 如果提供推荐码，系统会验证推荐码有效性
2. **关系绑定**: 验证通过后，建立父子推荐关系
3. **团队路径**: 自动计算用户在团队中的层级和路径
4. **统计更新**: 实时更新推荐人的直推人数和团队人数

## 注意事项

1. **推荐码不可修改**: 用户注册后推荐码固定不变
2. **推荐关系不可更改**: 一旦建立推荐关系，无法更改
3. **推荐人状态验证**: 只有状态为ACTIVE的用户推荐码才有效
4. **循环推荐检测**: 系统防止循环推荐的情况
5. **推荐码安全性**: 推荐码虽为数字，但具有足够随机性和唯一性

## 技术实现

### 核心文件

- `src/shared/utils/referralCode.ts`: 推荐码生成和验证工具
- `src/routes/v1/users/index.ts`: 用户相关API接口
- `prisma/schema.prisma`: 数据库模型定义

### 数据库字段

- `users.referral_code`: 用户推荐码（6位数字，唯一）
- `users.parent_id`: 推荐人ID
- `users.team_path`: 团队路径（如：/parent_id/self_id/）
- `users.team_level`: 团队层级
- `users.direct_count`: 直推人数
- `users.team_count`: 团队总人数

### 使用示例

```typescript
import { generateUniqueReferralCode, validateReferralCode } from '../shared/utils/referralCode';

// 生成推荐码
const referralCode = await generateUniqueReferralCode();
console.log(referralCode); // 输出: "823417"

// 验证推荐码
const validation = await validateReferralCode("123456");
if (validation.valid) {
  console.log("推荐人信息:", validation.referrer);
} else {
  console.log("推荐码无效:", validation.error);
}
```