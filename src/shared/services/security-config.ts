import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * 安全配置管理服务
 */
export class SecurityConfigService {
  private configValidationResults: Map<string, ValidationResult> = new Map();

  /**
   * 验证安全配置
   */
  validateSecurityConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // 验证JWT配置
    this.validateJWTConfig(errors, warnings, recommendations);

    // 验证数据库配置
    this.validateDatabaseConfig(errors, warnings, recommendations);

    // 验证应用配置
    this.validateApplicationConfig(errors, warnings, recommendations);

    // 验证文件存储配置
    this.validateFileStorageConfig(errors, warnings, recommendations);

    // 验证支付配置
    this.validatePaymentConfig(errors, warnings, recommendations);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * 验证JWT配置
   */
  private validateJWTConfig(errors: string[], warnings: string[], recommendations: string[]): void {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      errors.push('JWT_SECRET环境变量未设置');
      return;
    }

    // 检查密钥强度
    if (jwtSecret.length < 32) {
      errors.push('JWT密钥长度必须至少32个字符');
    } else if (jwtSecret.length < 64) {
      warnings.push('建议使用更长的JWT密钥（至少64字符）');
    }

    // 检查密钥复杂度
    if (!this.isStrongSecret(jwtSecret)) {
      warnings.push('JWT密钥应包含大小写字母、数字和特殊字符');
      recommendations.push('使用密码学安全的随机生成器创建JWT密钥');
    }

    // 检查过期时间配置
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    if (!this.isValidTimeFormat(expiresIn)) {
      errors.push('JWT_EXPIRES_IN格式无效');
    } else if (this.parseTimeToSeconds(expiresIn) > 30 * 24 * 60 * 60) { // 超过30天
      warnings.push('JWT过期时间过长，建议不超过30天');
    }

    // 检查是否使用默认密钥
    if (this.isDefaultSecret(jwtSecret)) {
      errors.push('检测到使用默认或示例JWT密钥，存在严重安全风险');
    }
  }

  /**
   * 验证数据库配置
   */
  private validateDatabaseConfig(errors: string[], warnings: string[], recommendations: string[]): void {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      errors.push('DATABASE_URL环境变量未设置');
      return;
    }

    // 检查是否使用SSL
    if (!databaseUrl.includes('sslmode=require') && !databaseUrl.includes('sslmode=verify-full')) {
      warnings.push('数据库连接建议启用SSL加密');
      recommendations.push('在生产环境中使用 sslmode=verify-full');
    }

    // 检查数据库连接字符串安全性
    if (databaseUrl.includes('password=123') || databaseUrl.includes('password=admin')) {
      errors.push('检测到使用弱数据库密码');
    }

    // 检查是否暴露在代码中
    if (databaseUrl.length > 0 && process.env.NODE_ENV === 'production') {
      recommendations.push('确保数据库连接字符串通过安全的环境变量管理');
    }
  }

  /**
   * 验证应用配置
   */
  private validateApplicationConfig(errors: string[], warnings: string[], recommendations: string[]): void {
    const nodeEnv = process.env.NODE_ENV;

    if (!nodeEnv) {
      warnings.push('NODE_ENV环境变量未设置，默认为development');
    } else if (nodeEnv === 'development' && process.env.ENVIRONMENT !== 'development') {
      warnings.push('在生产环境中运行开发模式存在安全风险');
    }

    // 检查调试配置
    if (process.env.DEBUG === 'true' && nodeEnv === 'production') {
      errors.push('生产环境不应启用详细调试日志');
    }

    // 检查CORS配置
    const corsOrigin = process.env.CORS_ORIGIN;
    if (!corsOrigin) {
      warnings.push('CORS_ORIGIN未配置，可能存在跨域安全风险');
    } else if (corsOrigin === '*') {
      errors.push('CORS配置为 "*" 存在安全风险，建议指定具体域名');
    }
  }

  /**
   * 验证文件存储配置
   */
  private validateFileStorageConfig(errors: string[], warnings: string[], recommendations: string[]): void {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';

    // 检查上传目录配置
    if (uploadPath.startsWith('/tmp/') || uploadPath.includes('..')) {
      errors.push('上传路径配置不安全');
    }

    // 检查文件大小限制
    const maxFileSize = process.env.MAX_FILE_SIZE;
    if (maxFileSize && parseInt(maxFileSize) > 50 * 1024 * 1024) { // 50MB
      warnings.push('文件上传大小限制过大，建议不超过50MB');
    }

    // 检查文件类型配置
    const allowedTypes = process.env.ALLOWED_FILE_TYPES;
    if (!allowedTypes) {
      warnings.push('未配置允许的文件类型，存在安全风险');
      recommendations.push('明确指定允许上传的文件类型');
    }
  }

  /**
   * 验证支付配置
   */
  private validatePaymentConfig(errors: string[], warnings: string[], recommendations: string[]): void {
    // 验证微信支付配置
    this.validateWechatPayConfig(errors, warnings, recommendations);

    // 验证支付宝配置（如果启用）
    if (process.env.ALIPAY_ENABLED === 'true') {
      this.validateAlipayConfig(errors, warnings, recommendations);
    }
  }

  /**
   * 验证微信支付配置
   */
  private validateWechatPayConfig(errors: string[], warnings: string[], recommendations: string[]): void {
    const appId = process.env.WECHAT_APP_ID;
    const mchId = process.env.WECHAT_MCH_ID;
    const apiV3Key = process.env.WECHAT_API_V3_KEY;

    if (appId && this.isDefaultSecret(appId)) {
      errors.push('检测到使用默认微信AppID');
    }

    if (mchId && !/^\d{10}$/.test(mchId)) {
      errors.push('微信商户号格式不正确，应为10位数字');
    }

    if (apiV3Key) {
      if (apiV3Key.length !== 32) {
        errors.push('微信API v3密钥长度必须为32位');
      }

      if (this.isDefaultSecret(apiV3Key)) {
        errors.push('检测到使用默认微信API密钥');
      }
    }

    // 检查回调URL配置
    const notifyUrl = process.env.WECHAT_NOTIFY_URL;
    if (notifyUrl && !notifyUrl.startsWith('https://')) {
      warnings.push('微信支付回调URL建议使用HTTPS协议');
    }

    // 检查生产环境配置
    if (process.env.NODE_ENV === 'production') {
      const apiClientCert = process.env.WECHAT_API_CLIENT_CERT;
      const apiClientKey = process.env.WECHAT_API_CLIENT_KEY;

      if (!apiClientCert || !apiClientKey) {
        errors.push('生产环境必须配置微信API证书');
      }

      if (process.env.WECHAT_SANDBOX === 'true') {
        warnings.push('生产环境不应使用沙箱模式');
      }
    }
  }

  /**
   * 验证支付宝配置
   */
  private validateAlipayConfig(errors: string[], warnings: string[], recommendations: string[]): void {
    const appId = process.env.ALIPAY_APP_ID;
    const privateKey = process.env.ALIPAY_PRIVATE_KEY;
    const publicKey = process.env.ALIPAY_PUBLIC_KEY;

    if (appId && this.isDefaultSecret(appId)) {
      errors.push('检测到使用默认支付宝AppID');
    }

    if (privateKey && this.isDefaultSecret(privateKey)) {
      errors.push('检测到使用默认支付宝私钥');
    }

    if (publicKey && this.isDefaultSecret(publicKey)) {
      errors.push('检测到使用默认支付宝公钥');
    }
  }

  /**
   * 生成安全配置报告
   */
  generateSecurityReport(): {
    timestamp: Date;
    overallScore: number;
    validationResults: any;
    recommendations: string[];
    securityLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  } {
    const validationResults = this.validateSecurityConfiguration();

    // 计算安全评分
    let score = 100;
    score -= validationResults.errors.length * 15; // 每个错误扣15分
    score -= validationResults.warnings.length * 5; // 每个警告扣5分

    // 确定安全等级
    let securityLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    if (score >= 90) {
      securityLevel = 'EXCELLENT';
    } else if (score >= 70) {
      securityLevel = 'GOOD';
    } else if (score >= 50) {
      securityLevel = 'FAIR';
    } else {
      securityLevel = 'POOR';
    }

    // 生成额外建议
    const additionalRecommendations = this.generateAdditionalRecommendations(validationResults);

    return {
      timestamp: new Date(),
      overallScore: Math.max(0, score),
      validationResults,
      recommendations: [...validationResults.recommendations, ...additionalRecommendations],
      securityLevel
    };
  }

  /**
   * 生成额外的安全建议
   */
  private generateAdditionalRecommendations(results: any): string[] {
    const recommendations: string[] = [];

    // 基于当前配置生成建议
    if (results.errors.length === 0) {
      recommendations.push('当前安全配置良好，建议定期进行安全审计');
    }

    if (results.warnings.length > 5) {
      recommendations.push('存在较多安全警告，建议进行全面的安全加固');
    }

    // 基于环境生成建议
    if (process.env.NODE_ENV === 'production') {
      recommendations.push('生产环境建议定期更新依赖包');
      recommendations.push('考虑实施定期安全扫描和渗透测试');
      recommendations.push('建议启用安全监控和告警系统');
    }

    return recommendations;
  }

  /**
   * 检查密钥是否为默认或示例
   */
  private isDefaultSecret(secret: string): boolean {
    const defaultPatterns = [
      /default/i,
      /example/i,
      /sample/i,
      /test/i,
      /demo/i,
      /placeholder/i,
      /123456/,
      /password/i,
      /secret/i,
      /wx[a-f0-9]{16}/i, // 微信示例格式
      /^[a-f0-9]{32}$/ // 可能是示例密钥
    ];

    return defaultPatterns.some(pattern => pattern.test(secret));
  }

  /**
   * 检查密钥强度
   */
  private isStrongSecret(secret: string): boolean {
    const hasLowercase = /[a-z]/.test(secret);
    const hasUppercase = /[A-Z]/.test(secret);
    const hasNumbers = /\d/.test(secret);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(secret);

    return secret.length >= 32 &&
           (hasLowercase + hasUppercase + hasNumbers + hasSpecialChars) >= 3;
  }

  /**
   * 检查时间格式是否有效
   */
  private isValidTimeFormat(timeStr: string): boolean {
    const timePattern = /^\d+[smhd]$/;
    return timePattern.test(timeStr);
  }

  /**
   * 将时间字符串转换为秒数
   */
  private parseTimeToSeconds(timeStr: string): number {
    const unit = timeStr.slice(-1);
    const value = parseInt(timeStr.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 0;
    }
  }

  /**
   * 生成安全的随机密钥
   */
  generateSecureSecret(length: number = 64): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 获取配置建议
   */
  getConfigurationRecommendations(): {
    critical: string[];
    important: string[];
    optional: string[];
  } {
    const validation = this.validateSecurityConfiguration();

    return {
      critical: validation.errors,
      important: validation.warnings,
      optional: validation.recommendations
    };
  }
}

// 验证结果接口
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  lastChecked: Date;
}

// 导出单例实例
export const securityConfigService = new SecurityConfigService();

/**
 * 启动时安全配置检查
 */
export const performStartupSecurityCheck = (): void => {
  logger.info('开始安全配置检查...');

  const report = securityConfigService.generateSecurityReport();

  logger.info('安全配置检查完成', {
    overallScore: report.overallScore,
    securityLevel: report.securityLevel,
    errorsCount: report.validationResults.errors.length,
    warningsCount: report.validationResults.warnings.length
  });

  if (report.validationResults.errors.length > 0) {
    logger.error('发现严重安全配置错误', {
      errors: report.validationResults.errors
    });
  }

  if (report.validationResults.warnings.length > 0) {
    logger.warn('发现安全配置警告', {
      warnings: report.validationResults.warnings
    });
  }

  // 在开发环境中输出详细报告
  if (process.env.NODE_ENV === 'development') {
    console.log('\n=== 安全配置报告 ===');
    console.log(`安全评分: ${report.overallScore}/100`);
    console.log(`安全等级: ${report.securityLevel}`);
    console.log(`检查时间: ${report.timestamp.toISOString()}`);

    if (report.validationResults.errors.length > 0) {
      console.log('\n严重错误:');
      report.validationResults.errors.forEach(error => console.log(`  ❌ ${error}`));
    }

    if (report.validationResults.warnings.length > 0) {
      console.log('\n警告:');
      report.validationResults.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }

    if (report.recommendations.length > 0) {
      console.log('\n建议:');
      report.recommendations.forEach(rec => console.log(`  💡 ${rec}`));
    }
    console.log('===================\n');
  }

  // 如果安全评分过低，记录严重警告
  if (report.overallScore < 50) {
    logger.error('安全配置评分过低，系统存在严重安全风险', {
      score: report.overallScore,
      level: report.securityLevel
    });
  }
};