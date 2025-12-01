/**
 * 应用配置模块
 * 所有环境变量在运行时(而非编译时)读取
 * 确保本地编译的dist可以在任何环境运行
 */

// 注意：不要在此出加载dotenv，会导致路径错误
// dotenv应由需要時在其他代碼之前（包括此配置模块）加载

export const config = {
  // 应用配置
  app: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production'
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    algorithm: 'HS256'
  },

  // 数据库配置
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20')
  },

  // 微信配置
  wechat: {
    appId: process.env.WECHAT_APP_ID,
    appSecret: process.env.WECHAT_APP_SECRET,
    mchId: process.env.WECHAT_MCH_ID,
    apiKey: process.env.WECHAT_KEY,
    apiV3Key: process.env.WECHAT_API_V3_KEY,
    notifyUrl: process.env.WECHAT_NOTIFY_URL,
    refundNotifyUrl: process.env.WECHAT_REFUND_NOTIFY_URL,
    sandbox: process.env.WECHAT_SANDBOX === 'true'
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    methods: (process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS').split(','),
    headers: (process.env.CORS_HEADERS || 'Content-Type,Authorization').split(',')
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.NODE_ENV === 'development'
  },

  // API基础URL
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000'
  }
};

/**
 * 验证必要的环境变量
 */
export function validateConfig(): void {
  const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
  
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    const missingList = missing.join(', ');
    const error = `缺少必要的环境变量: ${missingList}`;
    console.error('❌ 配置验证失败:', error);
    throw new Error(error);
  }
}

/**
 * 获取配置信息（用于日志，脱敏敏感信息）
 */
export function getConfigInfo(): object {
  return {
    app: config.app,
    jwt: {
      expiresIn: config.jwt.expiresIn,
      refreshExpiresIn: config.jwt.refreshExpiresIn,
      algorithm: config.jwt.algorithm,
      secret: config.jwt.secret ? '***[已设置]' : '❌[未设置]'
    },
    database: {
      host: config.database.host,
      port: config.database.port,
      name: config.database.name,
      connectionLimit: config.database.connectionLimit,
      url: config.database.url ? '***[已设置]' : '❌[未设置]'
    },
    wechat: {
      appId: config.wechat.appId ? '***[已设置]' : '⚠️ [未设置]',
      appSecret: config.wechat.appSecret ? '***[已设置]' : '⚠️ [未设置]',
      sandbox: config.wechat.sandbox
    },
    cors: {
      origin: config.cors.origin,
      credentials: config.cors.credentials,
      methods: config.cors.methods,
      headers: config.cors.headers
    }
  };
}
