import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../setup';
import { setupTestDatabase, cleanupTestDatabase, getAuthHeadersForUser } from '../../setup';

describe('监控系统核心功能测试', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('健康检查端点', () => {
    it('should return overall system health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });

    it('should return detailed database health check', async () => {
      const response = await request(app)
        .get('/health/database')
        .expect(200);

      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('status');
      expect(response.body.database).toHaveProperty('responseTime');
      expect(['connected', 'disconnected', 'error']).toContain(response.body.database.status);
    });

    it('should return cache health status', async () => {
      const response = await request(app)
        .get('/health/cache')
        .expect(200);

      expect(response.body).toHaveProperty('cache');
      expect(response.body.cache).toHaveProperty('status');
      expect(['connected', 'disconnected', 'disabled']).toContain(response.body.cache.status);
    });

    it('should return security health check', async () => {
      const response = await request(app)
        .get('/health/security')
        .expect(200);

      expect(response.body).toHaveProperty('security');
      expect(response.body.security).toHaveProperty('status');
      expect(response.body.security).toHaveProperty('features');
      expect(Array.isArray(response.body.security.features)).toBe(true);
    });
  });

  describe('监控指标端点', () => {
    it('should return system metrics with authentication', async () => {
      const response = await request(app)
        .get('/api/v1/admin/monitoring/metrics')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');

      const metrics = response.body.data;
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('business');
      expect(metrics).toHaveProperty('performance');

      // 验证系统指标
      expect(metrics.system).toHaveProperty('cpu');
      expect(metrics.system).toHaveProperty('memory');
      expect(metrics.system).toHaveProperty('disk');
      expect(metrics.system).toHaveProperty('network');
    });

    it('should reject metrics access without authentication', async () => {
      await request(app)
        .get('/api/v1/admin/monitoring/metrics')
        .expect(401);
    });

    it('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/monitoring/performance')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('responseTime');
      expect(response.body.data).toHaveProperty('throughput');
      expect(response.body.data).toHaveProperty('errorRate');
      expect(response.body.data).toHaveProperty('concurrentUsers');
    });

    it('should return business metrics', async () => {
      const response = await request(app)
        .get('/api/v1/admin/monitoring/business')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('orders');
      expect(response.body.data).toHaveProperty('revenue');
      expect(response.body.data).toHaveProperty('conversion');
    });
  });

  describe('告警系统测试', () => {
    it('should create and retrieve alerts', async () => {
      // 创建测试告警
      const createResponse = await request(app)
        .post('/api/v1/admin/monitoring/alerts')
        .set(getAuthHeadersForUser('admin'))
        .send({
          type: 'CPU_USAGE_HIGH',
          severity: 'warning',
          message: 'CPU使用率过高',
          value: 85,
          threshold: 80
        })
        .expect(201);

      expect(createResponse.body).toHaveProperty('success', true);
      expect(createResponse.body.data).toHaveProperty('id');

      // 获取告警列表
      const listResponse = await request(app)
        .get('/api/v1/admin/monitoring/alerts')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(listResponse.body).toHaveProperty('success', true);
      expect(Array.isArray(listResponse.body.data.alerts)).toBe(true);
    });

    it('should update alert status', async () => {
      // 先创建告警
      const createResponse = await request(app)
        .post('/api/v1/admin/monitoring/alerts')
        .set(getAuthHeadersForUser('admin'))
        .send({
          type: 'MEMORY_HIGH',
          severity: 'critical',
          message: '内存使用率过高',
          value: 95,
          threshold: 90
        })
        .expect(201);

      const alertId = createResponse.body.data.id;

      // 更新告警状态
      const updateResponse = await request(app)
        .patch(`/api/v1/admin/monitoring/alerts/${alertId}`)
        .set(getAuthHeadersForUser('admin'))
        .send({
          status: 'acknowledged',
          acknowledgedBy: 'admin'
        })
        .expect(200);

      expect(updateResponse.body).toHaveProperty('success', true);
      expect(updateResponse.body.data.status).toBe('acknowledged');
    });

    it('should filter alerts by severity and status', async () => {
      const response = await request(app)
        .get('/api/v1/admin/monitoring/alerts?severity=critical&status=active')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('filters');
      expect(response.body.data.filters.severity).toBe('critical');
      expect(response.body.data.filters.status).toBe('active');
    });
  });

  describe('监控配置管理', () => {
    it('should get current monitoring configuration', async () => {
      const response = await request(app)
        .get('/api/v1/admin/monitoring/config')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('healthChecks');
    });

    it('should update monitoring configuration', async () => {
      const response = await request(app)
        .put('/api/v1/admin/monitoring/config')
        .set(getAuthHeadersForUser('admin'))
        .send({
          metrics: {
            interval: 30,
            retention: '7d'
          },
          alerts: {
            enabled: true,
            thresholds: {
              cpu: 85,
              memory: 90,
              disk: 95
            }
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.metrics.interval).toBe(30);
    });

    it('should validate configuration values', async () => {
      await request(app)
        .put('/api/v1/admin/monitoring/config')
        .set(getAuthHeadersForUser('admin'))
        .send({
          metrics: {
            interval: -1 // 无效值
          })
        })
        .expect(400);
    });
  });

  describe('监控数据导出', () => {
    it('should export metrics data in CSV format', async () => {
      const response = await request(app)
        .get('/api/v1/admin/monitoring/export?format=csv&type=metrics')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should export alerts data in JSON format', async () => {
      const response = await request(app)
        .get('/api/v1/admin/monitoring/export?format=json&type=alerts')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('exportDate');
      expect(response.body).toHaveProperty('data');
    });

    it('should filter exported data by date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/v1/admin/monitoring/export?startDate=${startDate}&endDate=${endDate}`)
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('dateRange');
      expect(response.body.dateRange.start).toBe(startDate);
      expect(response.body.dateRange.end).toBe(endDate);
    });
  });

  describe('实时监控', () => {
    it('should establish WebSocket connection for real-time metrics', async () => {
      // 这里需要WebSocket测试库，暂时用HTTP模拟
      const response = await request(app)
        .get('/api/v1/admin/monitoring/realtime/status')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('connected');
      expect(response.body.data).toHaveProperty('subscribers');
    });

    it('should handle real-time metrics subscription', async () => {
      const response = await request(app)
        .post('/api/v1/admin/monitoring/realtime/subscribe')
        .set(getAuthHeadersForUser('admin'))
        .send({
          metrics: ['cpu', 'memory', 'response_time'],
          interval: 5
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('subscriptionId');
    });
  });

  describe('性能基准测试', () => {
    it('should measure response time for critical endpoints', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/health')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100); // 健康检查应在100ms内响应
    });

    it('should handle concurrent monitoring requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/v1/admin/monitoring/metrics')
          .set(getAuthHeadersForUser('admin'))
      );

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });

    it('should monitor API performance degradation', async () => {
      // 模拟高负载情况
      const heavyLoadPromises = Array(100).fill(null).map((_, index) =>
        request(app)
          .get(`/api/v1/products?page=${index + 1}&limit=10`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(heavyLoadPromises);
      const totalTime = Date.now() - startTime;

      // 验证所有请求都成功
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(90); // 至少90%成功率

      // 验证平均响应时间
      const avgResponseTime = totalTime / 100;
      expect(avgResponseTime).toBeLessThan(200); // 平均响应时间应小于200ms
    });
  });

  describe('监控中心集成测试', () => {
    it('should coordinate all monitoring components', async () => {
      // 获取监控中心状态
      const response = await request(app)
        .get('/api/v1/admin/monitoring/dashboard')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('metrics');
      expect(response.body.data).toHaveProperty('alerts');
      expect(response.body.data).toHaveProperty('health');
    });

    it('should handle monitoring system failures gracefully', async () => {
      // 模拟监控系统故障
      vi.mock('../../src/monitoring/core/metrics-collector', () => ({
        MetricsCollector: vi.fn().mockImplementation(() => ({
          collect: vi.fn().mockRejectedValue(new Error('Collection failed'))
        }))
      }));

      const response = await request(app)
        .get('/api/v1/admin/monitoring/metrics')
        .set(getAuthHeadersForUser('admin'))
        .expect(200);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});