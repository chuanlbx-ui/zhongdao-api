# 0002-采用JWT进行认证授权

## 状态
已批准

## 决策日期
2025-12-09

## 决策者
架构团队、安全负责人

## 背景
中道商城系统需要设计一个安全、高效、可扩展的认证授权机制。系统有以下特点：
- 多层级用户权限体系（普通用户到董事）
- 微信小程序为主要客户端
- 需要支持分布式部署
- 高并发访问要求
- 需要与第三方系统集成

## 决策
我们决定采用**JWT（JSON Web Token）**作为系统的认证授权机制，配合刷新令牌（Refresh Token）策略。

## 理由

### 技术优势
1. **无状态**: JWT包含所有必要信息，服务端无需存储会话状态
2. **跨域支持**: 适合微服务和分布式架构
3. **标准化**: 基于RFC 7519标准，有成熟的实现库
4. **扩展性**: 可以在payload中包含自定义声明

### 业务需求匹配
1. **多端统一**: 支持Web、移动端、小程序等多种客户端
2. **权限控制**: 支持基于角色的访问控制（RBAC）
3. **性能要求**: 减少数据库查询，提高响应速度
4. **微信集成**: 与微信小程序登录流程兼容

### 安全考虑
1. **加密签名**: 防止令牌被篡改
2. **短期有效期**: 访问令牌有效期短，降低泄露风险
3. **刷新机制**: 通过刷新令牌延长会话，提高安全性
4. **撤销机制**: 支持令牌黑名单，强制登出

## 后果

### 正面影响
1. **性能提升**: 无需查询数据库验证会话
2. **扩展性好**: 易于添加新的服务节点
3. **用户体验**: 支持自动续期，减少频繁登录
4. **开发效率**: 简化认证逻辑，统一验证方式

### 负面影响
1. **令牌大小**: JWT比简单session ID更大
2. **立即撤销困难**: 无状态特性使得立即撤销较复杂
3. **密钥管理**: 需要安全的密钥轮换机制

### 风险和缓解措施
1. **令牌泄露**: 使用HTTPS传输，设置短期有效期
2. **密钥泄露**: 实施密钥轮换策略，使用硬件安全模块
3. **重放攻击**: 添加jti声明和nonce机制
4. **时间同步**: 确保服务器时间同步

## 替代方案

### Session-Cookie
**未选择原因**:
- 有状态，不适合分布式架构
- 跨域支持复杂
- 移动端集成困难

### OAuth 2.0
**未选择原因**:
- 过于复杂，对于内部系统而言重量级
- 需要额外的授权服务器
- 微信小程序已有自己的OAuth实现

### 自定义Token
**未选择原因**:
- 重复造轮子
- 安全性难以保证
- 缺乏标准化支持

## 实施细节

### 1. Token结构
```typescript
// JWT Payload
interface JWTPayload {
  sub: string;        // 用户ID
  role: string;       // 用户角色
  level: string;      // 用户等级
  scope: string[];    // 权限范围
  iat: number;        // 签发时间
  exp: number;        // 过期时间
  jti: string;        // Token ID
}
```

### 2. Token策略
- **访问令牌**: 15分钟有效期
- **刷新令牌**: 7天有效期
- **自动续期**: 访问令牌过期前自动使用刷新令牌
- **安全存储**: 访问令牌内存存储，刷新令牌安全存储

### 3. 中间件实现
```typescript
// 认证中间件
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 4. 安全增强
- 使用RS256算法而非HS256
- 实施密钥轮换机制
- 添加请求限流防止暴力破解
- 记录认证失败日志

### 5. 特殊处理
- 微信登录集成
- 多设备登录管理
- 强制登出功能
- 设备指纹验证

## 相关文档
- [JWT规范(RFC 7519)](https://tools.ietf.org/html/rfc7519)
- [认证API文档](../api/authentication.md)
- [安全设计文档](../architecture/security.md)
- [微信集成指南](../guides/wechat-integration.md)