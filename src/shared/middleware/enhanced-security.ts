import { Request, Response, NextFunction } from 'express';
import { createErrorResponse, ErrorCode } from '../types/response';
import { logger } from '../utils/logger';
import crypto from 'crypto';

// 请求大小限制配置
const REQUEST_LIMITS = {
  maxPayloadSize: 10 * 1024 * 1024, // 10MB
  maxQueryParamLength: 1000,
  maxHeaderSize: 16 * 1024, // 16KB
  maxUrlLength: 2048
};

// 危险模式检测（优化版，减少误判）
const DANGEROUS_PATTERNS = [
  // SQL注入模式（需要完整关键字组合，更严格的匹配）
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b\s+.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
  /(\b(OR|AND)\s+\w+\s*=\s*\w+\s*(AND|OR)\s+\w+\s*=\s*\w+)/i, // 需要两个条件才判断为SQL注入

  // XSS模式（更严格的匹配）
  /<\s*script[^>]*>.*?<\s*\/\s*script\s*>/i,
  /<\s*iframe[^>]*>.*?<\s*\/\s*iframe\s*>/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /on(load|error|click|submit|focus|blur|mouseover|mouseout)\s*=/i,

  // CSS注入（排除颜色值）
  /expression\s*\(\s*.*\)/i,
  /@import\s+(?!url\s*\()/i,

  // 路径遍历模式（需要连续的../）
  /\.\.[\/\\]\.\.[\/\\]/i,
  /(\.\.\/){3,}/i,

  // 命令注入模式（需要完整命令）
  /(;\s*(cmd|powershell|bash|sh|system|exec)\s|\/\s*(cmd|powershell|bash|sh|system|exec)\s)/i,
  /[|&]\s*(rm|del|format|shutdown|reboot)\s/i,

  // NoSQL注入模式（更严格的匹配）
  /\$\{[^}]*\b(where|ne|gt|lt|in|nin)\b[^}]*\}/i
];

// 用于查询参数和请求体的注释模式检测
const COMMENT_PATTERNS = [
  /(--(?!.*#)|\/\*.*?\*\/)/
];

// 敏感信息模式
const SENSITIVE_PATTERNS = [
  // 密码相关
  /(password|pwd|pass)\s*[:=]/i,
  // API密钥
  /(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]/i,
  // 信用卡号
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
  // 社会安全号码
  /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/
];

// 增强的安全头配置
export const enhancedSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Content Security Policy
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // 根据实际需求调整
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "upgrade-insecure-requests"
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);

    // 其他安全头
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=(), ' +
      'magnetometer=(), gyroscope=(), accelerometer=(), autoplay=(), ' +
      'encrypted-media=(), fullscreen=(), picture-in-picture=()'
    );

    // 生产环境强制HTTPS
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    // 移除敏感的服务器信息
    res.removeHeader('Server');
    res.removeHeader('X-Powered-By');

    // 设置随机缓存控制头，防止缓存 poisoning
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }

    logger.debug('安全头设置完成', {
      url: req.url,
      method: req.method,
      ip: req.ip
    });

    next();
  } catch (error) {
    logger.error('设置安全头失败', {
      error: error instanceof Error ? error.message : '未知错误',
      url: req.url,
      method: req.method
    });
    next(); // 即使设置失败也继续处理请求
  }
};

/**
 * 增强的输入验证中间件
 */
export const enhancedInputValidation = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // 1. 检查请求URL长度
    if (req.url.length > REQUEST_LIMITS.maxUrlLength) {
      logger.warn('URL过长', {
        url: req.url,
        length: req.url.length,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(414).json(createErrorResponse(
        ErrorCode.BAD_REQUEST,
        '请求URL过长'
      ));
    }

    // 2. 检查查询参数
    if (req.query && typeof req.query === 'object') {
      const queryValidation = validateQueryObject(req.query);
      if (!queryValidation.isValid) {
        logger.warn('查询参数验证失败', {
          query: req.query,
          errors: queryValidation.errors,
          ip: req.ip
        });

        return res.status(400).json(createErrorResponse(
          ErrorCode.BAD_REQUEST,
          '查询参数包含危险内容',
          { errors: queryValidation.errors }
        ));
      }
    }

    // 3. 检查请求体
    if (req.body && typeof req.body === 'object') {
      const bodyValidation = validateBodyObject(req.body);
      if (!bodyValidation.isValid) {
        logger.warn('请求体验证失败', {
          errors: bodyValidation.errors,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(400).json(createErrorResponse(
          ErrorCode.BAD_REQUEST,
          '请求体包含危险内容',
          { errors: bodyValidation.errors }
        ));
      }

      // 检查敏感信息泄露
      const sensitiveCheck = checkSensitiveData(req.body);
      if (sensitiveCheck.containsSensitiveData) {
        logger.warn('检测到敏感信息', {
          sensitiveFields: sensitiveCheck.fields,
          ip: req.ip,
          url: req.url
        });

        // 在开发环境中返回警告，生产环境中记录日志但不阻止
        if (process.env.NODE_ENV === 'development') {
          return res.status(400).json(createErrorResponse(
            ErrorCode.BAD_REQUEST,
            '请求包含敏感信息',
            { sensitiveFields: sensitiveCheck.fields }
          ));
        }
      }
    }

    // 4. 检查请求路径参数
    if (req.params && typeof req.params === 'object') {
      const paramsValidation = validatePathParams(req.params);
      if (!paramsValidation.isValid) {
        logger.warn('路径参数验证失败', {
          params: req.params,
          errors: paramsValidation.errors,
          ip: req.ip
        });

        return res.status(400).json(createErrorResponse(
          ErrorCode.BAD_REQUEST,
          '路径参数包含危险内容',
          { errors: paramsValidation.errors }
        ));
      }
    }

    // 5. 检查HTTP头部
    const headersValidation = validateHeaders(req.headers);
    if (!headersValidation.isValid) {
      logger.warn('请求头验证失败', {
        errors: headersValidation.errors,
        ip: req.ip
      });

      return res.status(400).json(createErrorResponse(
        ErrorCode.BAD_REQUEST,
        '请求头包含危险内容'
      ));
    }

    logger.debug('输入验证通过', {
      method: req.method,
      url: req.url,
      ip: req.ip
    });

    next();
  } catch (error) {
    logger.error('输入验证异常', {
      error: error instanceof Error ? error.message : '未知错误',
      method: req.method,
      url: req.url,
      ip: req.ip
    });

    // 验证异常时拒绝请求，确保安全
    return res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      '安全验证失败'
    ));
  }
};

/**
 * 验证查询对象（优化版，减少误判）
 */
const validateQueryObject = (query: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') {
      // 检查参数长度
      if (value.length > REQUEST_LIMITS.maxQueryParamLength) {
        errors.push(`参数 ${key} 长度超过限制`);
        continue;
      }

      // 对查询参数使用更宽松的检查
      // 跳过常见的、无害的特殊字符组合
      if (value.includes('#') && (
        key.toLowerCase().includes('color') ||
        key.toLowerCase().includes('colour') ||
        value.match(/^#[0-9a-fA-F]{3,6}$/)
      )) {
        // 颜色值，跳过安全检查
        continue;
      }

      // 只检查真正危险的模式
      for (const pattern of DANGEROUS_PATTERNS) {
        // 跳过过于宽泛的模式
        if (pattern === /[;&|`]/i) continue;

        if (pattern.test(value)) {
          // 额外检查：确保不是误判
          if (value.includes('>') && !value.includes('<')) {
            // 单独的 > 符号通常是安全的（例如：price>100）
            continue;
          }
          errors.push(`参数 ${key} 包含潜在危险内容`);
          break;
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * 验证请求体对象（优化性能版本）
 */
const validateBodyObject = (body: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 🚀 性能优化1: 快速大小检查，避免JSON.stringify
  const bodySize = estimateObjectSize(body);
  if (bodySize > REQUEST_LIMITS.maxPayloadSize) {
    errors.push('请求体过大');
    return { isValid: false, errors };
  }

  // 🚀 性能优化2: 只对小请求体进行深度验证
  if (bodySize > 100 * 1024) { // 100KB以上跳过复杂验证
    // 对大请求体只进行基础检查
    return { isValid: true, errors };
  }

  // 🚀 性能优化3: 延迟JSON.stringify，只在必要时执行
  let bodyStr: string | null = null;

  // 智能检查危险模式（优化版）
  const allPatterns = [...DANGEROUS_PATTERNS, ...COMMENT_PATTERNS];

  // 延迟计算JSON字符串
  if (bodyStr === null) {
    bodyStr = JSON.stringify(body);
  }

  // 预处理：识别并临时移除颜色值以避免误判
  const colorRegex = /"([^"]*color[^"]*)"\s*:\s*"([^"]*#[^"]*")/g;
  const colorMatches = [];
  let match;
  while ((match = colorRegex.exec(bodyStr)) !== null) {
    colorMatches.push({
      full: match[0],
      field: match[1],
      value: match[2]
    });
  }

  // 临时替换颜色值
  let processedBodyStr = bodyStr;
  colorMatches.forEach((color, index) => {
    processedBodyStr = processedBodyStr.replace(color.full, `"${color.field}":"COLOR_VALUE_${index}"`);
  });

  for (const pattern of allPatterns) {
    // 跳过注释模式检查，避免对颜色值误判
    if (COMMENT_PATTERNS.includes(pattern)) {
      continue;
    }

    if (pattern.test(processedBodyStr)) {
      errors.push('请求体包含危险模式');
      break;
    }
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * 快速估算对象大小（避免JSON.stringify的性能开销）
 */
const estimateObjectSize = (obj: any): number => {
  if (obj === null || obj === undefined) return 0;

  if (typeof obj === 'string') return obj.length * 2; // UTF-16
  if (typeof obj === 'number') return 8; // 64位数字
  if (typeof obj === 'boolean') return 4;
  if (typeof obj === 'object') {
    let size = 2; // 对象开销
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        size += key.length * 2 + estimateObjectSize(obj[key]) + 2; // key + value + 分隔符
      }
    }
    return size;
  }

  return 0;
};

/**
 * 验证路径参数
 */
const validatePathParams = (params: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      // 检查路径遍历攻击
      if (/\.\.[\/\\]/.test(value)) {
        errors.push(`参数 ${key} 包含路径遍历字符`);
      }

      // 检查特殊字符
      if (/[<>:"\\|?*]/.test(value)) {
        errors.push(`参数 ${key} 包含非法字符`);
      }
    }
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * 验证请求头
 */
const validateHeaders = (headers: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 检查头部总大小
  const headersStr = JSON.stringify(headers);
  if (headersStr.length > REQUEST_LIMITS.maxHeaderSize) {
    errors.push('请求头过大');
  }

  // 检查危险的头部注入
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.length > 8192) {
      errors.push(`头部 ${key} 过长`);
    }
  }

  return { isValid: errors.length === 0, errors };
};

/**
 * 检查敏感数据
 */
const checkSensitiveData = (data: any): { containsSensitiveData: boolean; fields: string[] } => {
  const sensitiveFields: string[] = [];
  const dataStr = JSON.stringify(data).toLowerCase();

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(dataStr)) {
      sensitiveFields.push('potential_sensitive_data');
    }
  }

  return {
    containsSensitiveData: sensitiveFields.length > 0,
    fields: sensitiveFields
  };
};

/**
 * 资源所有权验证中间件工厂
 */
export const checkResourceOwnership = (resourceType: string, resourceIdField: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        return res.status(401).json(createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          '需要登录'
        ));
      }

      const resourceId = req.params[resourceIdField];
      const userId = req.user.id;

      if (!resourceId) {
        return res.status(400).json(createErrorResponse(
          ErrorCode.BAD_REQUEST,
          '缺少资源ID'
        ));
      }

      // 这里应该根据不同的资源类型实现所有权检查
      // 示例实现，实际需要根据业务逻辑调整
      let hasOwnership = false;

      switch (resourceType) {
        case 'user':
          hasOwnership = resourceId === userId;
          break;
        case 'order':
          // 检查订单是否属于当前用户
          hasOwnership = await checkOrderOwnership(resourceId, userId);
          break;
        case 'shop':
          // 检查店铺是否属于当前用户
          hasOwnership = await checkShopOwnership(resourceId, userId);
          break;
        default:
          hasOwnership = false;
      }

      if (!hasOwnership) {
        logger.warn('资源所有权验证失败', {
          resourceType,
          resourceId,
          userId,
          ip: req.ip
        });

        return res.status(403).json(createErrorResponse(
          ErrorCode.FORBIDDEN,
          '无权操作此资源'
        ));
      }

      logger.debug('资源所有权验证通过', {
        resourceType,
        resourceId,
        userId
      });

      next();
    } catch (error) {
      logger.error('资源所有权验证异常', {
        error: error instanceof Error ? error.message : '未知错误',
        resourceType,
        resourceId: req.params[resourceIdField],
        userId: req.user?.id
      });

      return res.status(500).json(createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        '权限验证失败'
      ));
    }
  };
};

// 示例函数，实际应该从数据库查询
const checkOrderOwnership = async (orderId: string, userId: string): Promise<boolean> => {
  try {
    // const order = await prisma.orders.findFirst({
    //   where: { id: orderId, userId }
    // });
    // return !!order;
    return true; // 临时返回true，实际需要实现
  } catch {
    return false;
  }
};

const checkShopOwnership = async (shopId: string, userId: string): Promise<boolean> => {
  try {
    // const shop = await prisma.shops.findFirst({
    //   where: { id: shopId, ownerId: userId }
    // });
    // return !!shop;
    return true; // 临时返回true，实际需要实现
  } catch {
    return false;
  }
};

// 导出验证函数供测试使用
export const validateBodyObjectExported = validateBodyObject;
export const validateQueryObjectExported = validateQueryObject;