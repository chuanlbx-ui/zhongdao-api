# 手机验证码API配置指南

## 📱 短信服务商选择

### 推荐的短信服务商

1. **阿里云短信服务** (推荐)
2. **腾讯云短信服务**
3. **SendCloud**
4. **华为云短信服务**

## 🔧 阿里云短信服务配置

### 1. 注册阿里云账号
1. 访问 [阿里云官网](https://www.aliyun.com/)
2. 注册并实名认证账号
3. 开通短信服务

### 2. 创建签名和模板
```bash
# 登录阿里云控制台
# 1. 进入短信服务控制台
# 2. 创建签名
# 3. 创建模板
```

#### 创建签名
- **签名名称**: 中道商城
- **签名来源**: 企事业单位
- **适用场景**: 验证码、通知、推广
- **签名文件**: 上传企业营业执照或授权书

#### 创建模板

**登录验证码模板:**
```json
{
  "templateCode": "SMS_123456789",
  "templateName": "中道商城登录验证码",
  "templateContent": "您的验证码${code}，该验证码5分钟内有效，请勿泄露于他人。",
  "templateType": "验证码",
  "varCount": 1
}
```

**注册验证码模板:**
```json
{
  "templateCode": "SMS_987654321",
  "templateName": "中道商城注册验证码",
  "templateContent": "欢迎使用中道商城，您的验证码${code}，该验证码5分钟内有效，请尽快完成注册。",
  "templateType": "验证码",
  "varCount": 1
}
```

### 3. 获取访问密钥
1. 进入阿里云访问控制台
2. 创建RAM用户
3. 分配短信服务权限
4. 获取AccessKey ID和AccessKey Secret

### 4. 配置后端API接口

#### 安装阿里云SMS SDK
```bash
cd /d/wwwroot/zhongdao-mall
npm install @alicloud/dysmsapi20170525
npm install @alicloud/openapi-client
```

#### 创建短信服务
```typescript
// src/shared/services/sms.ts
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import OpenApi, * as $OpenApi from '@alicloud/openapi-client'

class AliyunSmsService {
  private client: Dysmsapi20170525

  constructor() {
    const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID
    const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET

    const openApiConfig = new $OpenApi.Config({
      accessKeyId: accessKeyId!,
      accessKeySecret: accessKeySecret!
    })

    this.client = new Dysmsapi20170525(openApiConfig)
  }

  async sendSmsCode(phone: string, templateCode: string, signName: string, code: string) {
    try {
      const sendSmsRequest = new $Dysmsapi20170525.SendSmsRequest({
        phoneNumbers: phone,
        signName: signName,
        templateCode: templateCode,
        templateParam: JSON.stringify({
          code: code
        })
      })

      const response = await this.client.sendSms(sendSmsRequest)

      if (response.statusCode === 200) {
        return {
          success: true,
          message: '发送成功',
          requestId: response.body.requestId,
          bizId: response.body.bizId
        }
      } else {
        return {
          success: false,
          message: response.body?.message || '发送失败'
        }
      }
    } catch (error: any) {
      console.error('发送短信失败:', error)
      return {
        success: false,
        message: error.message || '网络错误'
      }
    }
  }
}

export const aliyunSmsService = new AliyunSmsService()
```

#### 更新短信路由处理器
```typescript
// src/routes/v1/sms/index.ts
import { Router, Request, Response } from 'express'
import { aliyunSmsService } from '../../../shared/services/sms'

const router = Router()

// 发送验证码
router.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { phone, type } = req.body

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.json({
        success: false,
        message: '请输入正确的手机号'
      })
    }

    // 生成6位随机验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    let templateCode: string
    let signName = '中道商城'

    switch (type) {
      case 'login':
        templateCode = process.env.ALIYUN_TEMPLATE_CODE_LOGIN!
        break
      case 'register':
        templateCode = process.env.ALIYUN_TEMPLATE_CODE_REGISTER!
        break
      default:
        return res.json({
          success: false,
          message: '不支持的验证码类型'
        })
    }

    // 调用阿里云短信服务
    const result = await aliyunSmsService.sendSmsCode(
      phone,
      templateCode,
      signName,
      code
    )

    if (result.success) {
      // 将验证码存储到Redis中，设置5分钟过期
      const redis = require('../../shared/redis/redis').redisClient
      await redis.setex(`sms:${phone}`, 300, code)

      return res.json({
        success: true,
        message: '验证码已发送',
        data: {
          requestId: result.requestId,
          expireTime: 300
        }
      })
    } else {
      return res.status(400).json(result)
    }

  } catch (error) {
    console.error('发送验证码错误:', error)
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    })
  }
})

// 验证验证码
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { phone, code, requestId } = req.body

    if (!phone || !code) {
      return res.json({
        success: false,
        message: '手机号和验证码不能为空'
      })
    }

    // 从Redis获取存储的验证码
    const redis = require('../../shared/redis/redis').redisClient
    const storedCode = await redis.get(`sms:${phone}`)

    if (!storedCode) {
      return res.json({
        success: false,
        message: '验证码已过期或不存在'
      })
    }

    if (code !== storedCode) {
      return res.json({
        success: false,
        message: '验证码错误'
      })
    }

    // 验证成功，删除Redis中的验证码
    await redis.del(`sms:${phone}`)

    // 查找或创建用户
    const userService = require('../../modules/user/user.service')
    const user = await userService.findOrCreateUser(phone)

    // 生成JWT token
    const { generateToken } = require('../../shared/utils/jwt')
    const token = generateToken(user)

    return res.json({
      success: true,
      message: '验证成功',
      data: {
        token,
        userInfo: {
          id: user.id,
          phone: user.phone,
          isNewUser: user.level === 'normal' && user.orderCount === 0
        }
      }
    })

  } catch (error) {
    console.error('验证验证码错误:', error)
    return res.status(500).json({
      success: false,
      message: '服务器错误'
    })
  }
})

export default router
```

## 🔧 腾讯云短信服务配置

### 1. 注册腾讯云账号
1. 访问 [腾讯云官网](https://cloud.tencent.com/)
2. 注册并实名认证账号
3. 开通短信服务

### 2. 创建短信应用
```bash
# 登录腾讯云控制台
# 1. 进入短信服务控制台
# 2. 创建短信应用
# 3. 配置签名和模板
```

### 3. 获取访问密钥
1. 进入访问管理控制台
2. 创建访问密钥
3. 获取SecretId和SecretKey

### 4. 配置腾讯云SMS SDK

#### 安装SDK
```bash
npm install tencentcloud-sdk-nodejs
```

#### 创建腾讯云短信服务
```typescript
import * as SMS from 'tencentcloud-sdk-nodejs'

class TencentSmsService {
  private client: SMS.Client

  constructor() {
    this.client = new SMS.Client({
      credential: {
        secretId: process.env.TENCENT_SECRET_ID!,
        secretKey: process.env.TENCENT_SECRET_KEY!,
      },
      region: process.env.TENCENT_REGION || 'ap-guangzhou'
    })
  }

  async sendSmsCode(phone: string, templateId: string, signName: string, code: string) {
    try {
      const params = {
        PhoneNumberSet: [phone],
        TemplateId: templateId,
        SignName: signName,
        TemplateParamSet: [code],
        SmsSdkAppId: process.env.TENCENT_APP_ID!,
        SessionContext: ''
      }

      const result = await this.client.SendSms(params)

      if (result.RequestId) {
        return {
          success: true,
          message: '发送成功',
          requestId: result.RequestId
        }
      } else {
        return {
          success: false,
          message: result.Message || '发送失败'
        }
      }
    } catch (error: any) {
      console.error('发送短信失败:', error)
      return {
        success: false,
        message: error.message || '网络错误'
      }
    }
  }
}

export const tencentSmsService = new TencentSmsService()
```

## 🚀 测试配置

### 1. 环境变量配置
```bash
# .env.development
VITE_SMS_PROVIDER=aliyun
VITE_ALIYUN_ACCESS_KEY_ID=your_test_access_key
VITE_ALIYUN_ACCESS_KEY_SECRET=your_test_secret
VITE_ALIYUN_SIGN_NAME=中道商城测试
VITE_ALIYUN_TEMPLATE_CODE_LOGIN=SMS_123456789
VITE_ENABLE_MOCK_SMS=true
```

### 2. 测试发送验证码
```javascript
// 在浏览器控制台测试
// 发送验证码
fetch('/api/v1/sms/send-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone: '13800138000',
    type: 'login'
  })
}).then(res => res.json()).then(data => console.log(data))
```

## 📋 安全注意事项

1. **访问密钥安全**:
   - 不要将AccessKey硬编码到前端代码
   - 使用环境变量或配置文件
   - 定期轮换密钥

2. **发送频率限制**:
   - 同一手机号1分钟内只能发送1次
   - 同一手机号1天内最多发送5次
   - 使用Redis记录发送历史

3. **验证码安全**:
   - 验证码长度固定为6位数字
   - 设置5分钟过期时间
   - 验证成功后立即删除

4. **日志记录**:
   - 记录所有发送和验证操作
   - 监控异常和错误
   - 定期清理过期数据

## 🔍 故障排查

### 常见问题

1. **发送失败: 签名未通过审核**
   - 检查签名是否已审核通过
   - 确认模板内容符合规范
   - 验证手机号格式正确

2. **接收不到验证码**
   - 检查手机是否开启短信拦截
   - 确认手机信号正常
   - 检查运营商短信通道状态

3. **API调用失败**
   - 检查AccessKey是否正确
   - 确认账户余额充足
   - 验证网络连接正常

4. **频率限制**
   - 检查本地存储的发送记录
   - 清理过期的限制数据
   - 联系客服申请提升限额

现在你的H5应用已经集成了完整的手机验证码API接口！🎉