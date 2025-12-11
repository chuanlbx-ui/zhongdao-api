/**
 * 测试环境专用简化配置
 * 减少中间件开销，提高测试性能
 */

export const testConfig = {
  // 测试环境禁用某些安全检查
  disableCSRF: true,
  disableRateLimit: true,
  disableSecurityMonitoring: true,

  // 数据库连接优化
  database: {
    connectionLimit: 10,
    acquireTimeout: 5000,
    timeout: 5000
  },

  // JWT配置
  jwt: {
    secret: '92f7087863c9e280a160ba4c2b5f9acc50925b5e64d8b9834c2a5a72c50e57972558a1d2104ccd54b3107785f47ada0582b158ac2cf23da093cb8a5da05bfb4a',
    expiresIn: '24h'
  }
};