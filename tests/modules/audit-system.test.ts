import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../setup';
import { setupTestDatabase, cleanupTestDatabase, getAuthHeadersForUser } from '../../setup';

describe('审计系统测试', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
    adminToken = getAuthHeadersForUser('admin').Authorization;
    userToken = getAuthHeadersForUser('normal').Authorization;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('审计日志记录', () => {
    it('should log user login events', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          phone: '13800138000',
          password: 'Test123456'
        })
        .expect(200);

      // 验证审计日志
      const auditLogs = await request(app)
        .get('/api/v1/admin/audit/logs')
        .set('Authorization', adminToken)
        .query({
          userId: response.body.data.id,
          action: 'LOGIN'
        })
        .expect(200);

      expect(auditLogs.body.data.logs.length).toBeGreaterThan(0);
      expect(auditLogs.body.data.logs[0]).toMatchObject({
        action: 'LOGIN',
        resource: 'auth',
        status: 'SUCCESS'
      });
    });

    it('should log data modification events', async () => {
      // 修改用户信息
      await request(app)
        .patch('/api/v1/users/profile')
        .set('Authorization', userToken)
        .send({
          nickname: 'New Nickname',
          avatar: 'new-avatar.jpg'
        })
        .expect(200);

      // 查询审计日志
      const auditLogs = await request(app)
        .get('/api/v1/admin/audit/logs')
        .set('Authorization', adminToken)
        .query({
          action: 'UPDATE',
          resource: 'user_profile'
        })
        .expect(200);

      expect(auditLogs.body.data.logs.length).toBeGreaterThan(0);

      const log = auditLogs.body.data.logs[0];
      expect(log.changes).toBeDefined();
      expect(log.changes.before.nickname).not.toBe('New Nickname');
      expect(log.changes.after.nickname).toBe('New Nickname');
    });

    it('should log sensitive operations', async () => {
      // 执行敏感操作：批量删除
      await request(app)
        .delete('/api/v1/admin/products/batch')
        .set('Authorization', adminToken)
        .send({
          productIds: ['prod-1', 'prod-2', 'prod-3'],
          reason: '违规商品'
        })
        .expect(200);

      // 验证敏感操作审计
      const sensitiveLogs = await request(app)
        .get('/api/v1/admin/audit/logs')
        .set('Authorization', adminToken)
        .query({
          sensitive: true,
          action: 'BATCH_DELETE'
        })
        .expect(200);

      expect(sensitiveLogs.body.data.logs.length).toBeGreaterThan(0);
      expect(sensitiveLogs.body.data.logs[0]).toHaveProperty('approvalRequired');
      expect(sensitiveLogs.body.data.logs[0]).toHaveProperty('reason');
    });

    it('should capture request context in audit logs', async () => {
      const testUserAgent = 'Mozilla/5.0 Test Browser';
      const testIP = '192.168.1.100';

      await request(app)
        .post('/api/v1/orders')
        .set('Authorization', userToken)
        .set('User-Agent', testUserAgent)
        .set('X-Forwarded-For', testIP)
        .send({
          items: [{
            productId: 'test-product',
            quantity: 1,
            price: 100
          }]
        });

      const auditLog = await request(app)
        .get('/api/v1/admin/audit/logs/latest')
        .set('Authorization', adminToken)
        .expect(200);

      expect(auditLog.body.data.userAgent).toContain('Test Browser');
      expect(auditLog.body.data.ipAddress).toBe(testIP);
      expect(auditLog.body.data).toHaveProperty('sessionId');
    });
  });

  describe('审计查询和过滤', () => {
    it('should support advanced audit log filtering', async () => {
      const filters = {
        startDate: new Date(Date.now() - 86400000).toISOString(),
        endDate: new Date().toISOString(),
        actions: ['CREATE', 'UPDATE', 'DELETE'],
        resources: ['user', 'order', 'payment'],
        status: ['SUCCESS', 'FAILED'],
        userId: 'test-user-123',
        includeSensitive: true
      };

      const response = await request(app)
        .get('/api/v1/admin/audit/search')
        .set('Authorization', adminToken)
        .query(filters)
        .expect(200);

      expect(response.body.data).toHaveProperty('logs');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('filters');
      expect(Array.isArray(response.body.data.logs)).toBe(true);

      // 验证分页
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('pageSize');
      expect(response.body.data).toHaveProperty('totalPages');
    });

    it('should search audit logs by content', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit/search')
        .set('Authorization', adminToken)
        .query({
          q: 'password change',
          fields: ['changes.before.password', 'changes.after.password', 'details.reason'],
          limit: 20
        })
        .expect(200);

      // 验证搜索结果包含高亮
      if (response.body.data.logs.length > 0) {
        response.body.data.logs.forEach((log: any) => {
          if (log.highlight) {
            expect(Object.keys(log.highlight).length).toBeGreaterThan(0);
          }
        });
      }
    });

    it('should export audit logs', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit/export')
        .set('Authorization', adminToken)
        .query({
          format: 'csv',
          startDate: new Date(Date.now() - 86400000).toISOString(),
          endDate: new Date().toISOString(),
          includeSensitive: false
        })
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.headers['content-disposition']).toContain('audit-logs');
    });
  });

  describe('审计报告生成', () => {
    it('should generate compliance report', async () => {
      const report = await request(app)
        .post('/api/v1/admin/audit/reports/compliance')
        .set('Authorization', adminToken)
        .send({
          period: '30d',
          include: ['data_access', 'modifications', 'sensitive_operations'],
          format: 'json'
        })
        .expect(200);

      expect(report.body.data).toHaveProperty('summary');
      expect(report.body.data).toHaveProperty('data_access_logs');
      expect(report.body.data).toHaveProperty('modification_logs');
      expect(report.body.data).toHaveProperty('sensitive_operations');
      expect(report.body.data).toHaveProperty('compliance_score');

      // 验证合规性指标
      const compliance = report.body.data.compliance;
      expect(compliance).toHaveProperty('data_access_authorized');
      expect(compliance).toHaveProperty('modifications_tracked');
      expect(compliance).toHaveProperty('sensitive_ops_approved');
      expect(compliance).toHaveProperty('retention_policy_compliant');
    });

    it('should generate security audit report', async () => {
      const response = await request(app)
        .post('/api/v1/admin/audit/reports/security')
        .set('Authorization', adminToken)
        .send({
          period: '7d',
          focus: ['failed_logins', 'privilege_escalation', 'data_exfiltration_risk']
        })
        .expect(200);

      const report = response.body.data;

      expect(report).toHaveProperty('security_events');
      expect(report).toHaveProperty('risk_assessment');
      expect(report).toHaveProperty('recommendations');

      // 验证安全事件分析
      const securityEvents = report.security_events;
      expect(securityEvents).toHaveProperty('suspicious_activities');
      expect(securityEvents).toHaveProperty('failed_attempts');
      expect(securityEvents).toHaveProperty('unusual_access_patterns');

      // 验证风险评估
      const risk = report.risk_assessment;
      expect(risk).toHaveProperty('overall_risk_level');
      expect(risk).toHaveProperty('high_risk_users');
      expect(risk).toHaveProperty('critical_assets');
    });

    it('should generate user activity report', async () => {
      const userId = 'target-user-123';
      const response = await request(app)
        .get(`/api/v1/admin/audit/reports/user/${userId}`)
        .set('Authorization', adminToken)
        .query({
          period: '30d',
          include: ['actions', 'resources', 'timeline']
        })
        .expect(200);

      const report = response.body.data;

      expect(report).toHaveProperty('user_summary');
      expect(report).toHaveProperty('activity_timeline');
      expect(report).toHaveProperty('resource_access');
      expect(report).toHaveProperty('action_distribution');

      // 验证活动时间线
      expect(Array.isArray(report.activity_timeline)).toBe(true);
      report.activity_timeline.forEach((event: any) => {
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('action');
        expect(event).toHaveProperty('resource');
      });
    });
  });

  describe('审计数据保留和归档', () => {
    it('should enforce audit data retention policies', async () => {
      // 获取保留策略
      const policies = await request(app)
        .get('/api/v1/admin/audit/retention-policies')
        .set('Authorization', adminToken)
        .expect(200);

      expect(policies.body.data).toHaveProperty('default_retention_days');
      expect(policies.body.data).toHaveProperty('sensitive_data_retention_days');
      expect(policies.body.data).toHaveProperty('archive_after_days');

      // 测试自动归档
      const archiveJob = await request(app)
        .post('/api/v1/admin/audit/archive')
        .set('Authorization', adminToken)
        .send({
          olderThan: 90, // 90天前
          dryRun: false
        })
        .expect(200);

      expect(archiveJob.body.data).toHaveProperty('archived_count');
      expect(archiveJob.body.data).toHaveProperty('job_id');
    });

    it('should retrieve archived audit logs', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit/archived')
        .set('Authorization', adminToken)
        .query({
          date: '2023-01-01',
          page: 1,
          limit: 10
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('logs');
      expect(response.body.data).toHaveProperty('source'); // archive table
    });
  });

  describe('实时审计监控', () => {
    it('should detect suspicious patterns in real-time', async () => {
      // 模拟可疑活动：短时间内多次失败登录
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            phone: '13800138000',
            password: 'wrong-password'
          })
          .expect(401);
      }

      // 检查是否触发告警
      const alerts = await request(app)
        .get('/api/v1/admin/audit/alerts')
        .set('Authorization', adminToken)
        .expect(200);

      const suspiciousLoginAlert = alerts.body.data.alerts.find(
        (alert: any) => alert.type === 'MULTIPLE_FAILED_LOGINS'
      );

      expect(suspiciousLoginAlert).toBeDefined();
      expect(suspiciousLoginAlert.severity).toBe('HIGH');
      expect(suspiciousLoginAlert).toHaveProperty('details');
    });

    it('should monitor privilege escalation attempts', async () => {
      // 模拟权限提升
      await request(app)
        .patch('/api/v1/admin/users/elevate')
        .set('Authorization', userToken) // 普通用户尝试提升权限
        .send({
          targetUserId: 'another-user',
          newRole: 'ADMIN'
        })
        .expect(403);

      // 验证审计记录
      const auditLog = await request(app)
        .get('/api/v1/admin/audit/logs/latest')
        .set('Authorization', adminToken)
        .query({
          action: 'PRIVILEGE_ESCALATION_ATTEMPT'
        })
        .expect(200);

      expect(auditLog.body.data.status).toBe('FAILED');
      expect(auditLog.body.data).toHaveProperty('security_flag');
    });

    it('should track data export activities', async () => {
      const exportRequest = {
        type: 'USER_DATA',
        format: 'csv',
        filters: { level: 'VIP' }
      };

      await request(app)
        .post('/api/v1/admin/users/export')
        .set('Authorization', adminToken)
        .send(exportRequest)
        .expect(200);

      // 验证数据导出审计
      const auditLog = await request(app)
        .get('/api/v1/admin/audit/logs/latest')
        .set('Authorization', adminToken)
        .query({
          action: 'DATA_EXPORT'
        })
        .expect(200);

      expect(auditLog.body.data.exportType).toBe('USER_DATA');
      expect(auditLog.body.data).toHaveProperty('recordCount');
      expect(auditLog.body.data).toHaveProperty('destination');
    });
  });

  describe('审计完整性验证', () => {
    it('should detect tampered audit logs', async () => {
      // 获取审计日志哈希
      const hashResponse = await request(app)
        .get('/api/v1/admin/audit/integrity/check')
        .set('Authorization', adminToken)
        .expect(200);

      expect(hashResponse.body.data).toHaveProperty('current_hash');
      expect(hashResponse.body.data).toHaveProperty('previous_hash');
      expect(hashResponse.body.data).toHaveProperty('integrity_check_passed');

      // 模拟篡改检测
      const tamperCheck = await request(app)
        .post('/api/v1/admin/audit/integrity/verify')
        .set('Authorization', adminToken)
        .send({
          logIds: ['audit-1', 'audit-2', 'audit-3']
        })
        .expect(200);

      expect(tamperCheck.body.data).toHaveProperty('verified');
      expect(tamperCheck.body.data).toHaveProperty('tampered_logs');
    });

    it('should maintain audit trail chain of custody', async () => {
      const chainOfCustody = await request(app)
        .get('/api/v1/admin/audit/chain-of-custody')
        .set('Authorization', adminToken)
        .query({
          logId: 'recent-audit-log'
        })
        .expect(200);

      expect(chainOfCustody.body.data).toHaveProperty('created_at');
      expect(chainOfCustody.body.data).toHaveProperty('created_by');
      expect(chainOfCustody.body.data).toHaveProperty('access_history');
      expect(chainOfCustody.body.data).toHaveProperty('modifications');
    });
  });

  describe('审计系统性能', () => {
    it('should handle high-volume audit logging', async () => {
      const startTime = Date.now();

      // 快速执行多个操作
      const operations = Array(100).fill(null).map((_, index) =>
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', userToken)
          .send({
            items: [{
              productId: `product-${index % 10}`,
              quantity: 1,
              price: 100
            }]
          })
      );

      await Promise.all(operations);
      const duration = Date.now() - startTime;

      // 验证性能
      expect(duration).toBeLessThan(5000); // 5秒内完成

      // 验证所有操作都被记录
      const auditCount = await request(app)
        .get('/api/v1/admin/audit/stats')
        .set('Authorization', adminToken)
        .query({
          action: 'CREATE',
          resource: 'order',
          timeRange: '1h'
        })
        .expect(200);

      expect(auditCount.body.data.count).toBe(100);
    });

    it('should efficiently query large audit datasets', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit/search')
        .set('Authorization', adminToken)
        .query({
          startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
          endDate: new Date().toISOString(),
          limit: 1000,
          aggregateBy: 'day'
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('aggregated_results');
      expect(response.body.data).toHaveProperty('query_time_ms');
      expect(response.body.data.query_time_ms).toBeLessThan(1000); // 1秒内返回
    });
  });
});