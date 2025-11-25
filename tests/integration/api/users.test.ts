import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { ApiTestUtils } from './test-setup';

describe('用户管理API集成测试', () => {
  let testUserId: string;
  let createdUserIds: string[] = [];

  beforeAll(async () => {
    console.log('🚀 开始用户API集成测试');
  });

  afterAll(async () => {
    console.log('✅ 用户API集成测试完成');
  });

  beforeEach(() => {
    // 每个测试前的准备工作
  });

  afterEach(() => {
    // 每个测试后的清理工作
  });

  describe('用户信息获取', () => {
    it('应该成功获取当前用户信息', async () => {
      const response = await ApiTestUtils.get('/api/v1/users/me');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('nickname');
      expect(data).toHaveProperty('level');
      expect(data).toHaveProperty('isActive', true);
    });

    it('应该返回用户等级信息', async () => {
      const response = await ApiTestUtils.get('/api/v1/users/me');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(['NORMAL', 'VIP', 'STAR_1', 'STAR_2', 'STAR_3', 'STAR_4', 'STAR_5', 'DIRECTOR']).toContain(data.level);
    });
  });

  describe('用户列表查询', () => {
    it('应该成功获取用户列表', async () => {
      const response = await ApiTestUtils.get('/api/v1/users?&page=1&perPage=10');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.perPage).toBe(10);
    });

    it('应该支持按用户等级筛选', async () => {
      const response = await ApiTestUtils.get('/api/v1/users?level=NORMAL&page=1&perPage=5');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      if (data.items.length > 0) {
        data.items.forEach((user: any) => {
          expect(user.level).toBe('NORMAL');
        });
      }
    });

    it('应该支持搜索用户', async () => {
      const response = await ApiTestUtils.get('/api/v1/users?search=测试&page=1&perPage=5');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      // 搜索结果可能为空，但不应该报错
      expect(response.body.success).toBe(true);
    });
  });

  describe('用户信息更新', () => {
    it('应该成功更新用户昵称', async () => {
      const updateData = {
        nickname: `更新后的昵称_${Date.now()}`
      };

      const response = await ApiTestUtils.put('/api/v1/users/me', updateData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data.nickname).toBe(updateData.nickname);
    });

    it('应该成功更新用户头像', async () => {
      const updateData = {
        avatarUrl: 'https://example.com/updated-avatar.jpg'
      };

      const response = await ApiTestUtils.put('/api/v1/users/me', updateData);

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data.avatarUrl).toBe(updateData.avatarUrl);
    });

    it('应该拒绝无效的用户数据', async () => {
      const invalidData = {
        nickname: '',  // 空昵称应该被拒绝
        phone: 'invalid_phone'  // 无效手机号
      };

      const response = await ApiTestUtils.put('/api/v1/users/me', invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('用户统计信息', () => {
    it('应该获取用户统计数据', async () => {
      const response = await ApiTestUtils.get('/api/v1/users/statistics');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(typeof data).toBe('object');
      // 统计数据可能包含各种字段，验证基本结构
    });

    it('应该获取用户等级进度', async () => {
      const response = await ApiTestUtils.get('/api/v1/users/level/progress');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('currentLevel');
      expect(data).toHaveProperty('progress');
      expect(data).toHaveProperty('requirement');
    });
  });

  describe('用户团队信息', () => {
    it('应该获取团队成员列表', async () => {
      const response = await ApiTestUtils.get('/api/v1/users/team?page=1&perPage=10');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);

      // 如果有团队成员，验证团队数据结构
      if (data.items.length > 0) {
        data.items.forEach((member: any) => {
          expect(member).toHaveProperty('id');
          expect(member).toHaveProperty('nickname');
          expect(member).toHaveProperty('level');
        });
      }
    });
  });

  describe('用户等级体系', () => {
    it('应该获取等级系统配置', async () => {
      const response = await ApiTestUtils.get('/api/v1/levels/system');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data)).toBe(true);

      // 验证等级数据结构
      if (data.length > 0) {
        data.forEach((level: any) => {
          expect(level).toHaveProperty('level');
          expect(level).toHaveProperty('name');
          expect(level).toHaveProperty('requirements');
        });
      }
    });

    it('应该获取当前用户等级详情', async () => {
      const response = await ApiTestUtils.get('/api/v1/levels/me');

      ApiTestUtils.validateApiResponse(response);

      const { data } = response.body;
      expect(data).toHaveProperty('currentLevel');
      expect(data).toHaveProperty('levelInfo');
      expect(data).toHaveProperty('upgradeProgress');
    });

    it('应该获取用户升级历史', async () => {
      const response = await ApiTestUtils.get('/api/v1/levels/me/upgrade-history?page=1&perPage=10');

      ApiTestUtils.validateApiResponse(response);
      ApiTestUtils.validatePaginatedResponse(response);

      const { data } = response.body;
      expect(Array.isArray(data.items)).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该正确处理404错误', async () => {
      const response = await ApiTestUtils.get('/api/v1/users/nonexistent-endpoint');

      expect(response.status).toBe(404);
    });

    it('应该正确处理401未授权错误', async () => {
      // 使用无效Token
      const response = await ApiTestUtils.get('/api/v1/users/me', {
        'Authorization': 'Bearer invalid_token'
      });

      expect(response.status).toBe(401);
    });

    it('应该正确处理400参数错误', async () => {
      const invalidData = {
        invalidField: 'value'
      };

      const response = await ApiTestUtils.post('/api/v1/users/search', invalidData);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('性能测试', () => {
    it('用户列表查询响应时间应该在合理范围内', async () => {
      const startTime = Date.now();

      const response = await ApiTestUtils.get('/api/v1/users?page=1&perPage=20');

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      ApiTestUtils.validateApiResponse(response);
      expect(responseTime).toBeLessThan(2000); // 2秒内响应
    });

    it('并发请求应该正确处理', async () => {
      const promises = [];
      const concurrentRequests = 5;

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(ApiTestUtils.get('/api/v1/users/me'));
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        ApiTestUtils.validateApiResponse(response);
      });
    });
  });
});