/**
 * 团队管理API测试
 * 测试团队结构、推荐关系、业绩统计等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { TestAuthHelper } from '../helpers/auth.helper';
import { PrismaClient, UserLevel } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = '/api/v1';

describe('团队管理API测试', () => {
  // TestAuthHelper 是静态类，不需要实例化
  let normalUserToken: string;
  let starUserToken: string;
  let directorToken: string;
  let testTeamData: any;

  beforeAll(async () => {
    console.log('开始团队管理API测试...');

    // 创建测试用户并获取token
    const normalUser = await TestAuthHelper.createTestUserByType('normal');
    const star3User = await TestAuthHelper.createTestUserByType('star3');
    const directorUser = await TestAuthHelper.createTestUserByType('director');

    normalUserToken = normalUser.tokens.accessToken;
    starUserToken = star3User.tokens.accessToken;
    directorToken = directorUser.tokens.accessToken;

    // 创建测试团队数据
    const director = directorUser;
    const star3 = star3User;

    // 创建层级关系
    const star5User = await TestAuthHelper.createTestUser({
      phone: '18800000008',
      nickname: '5星店长测试',
      level: 'STAR_5',
      role: 'USER'
    });

    const star4User = await TestAuthHelper.createTestUser({
      phone: '18800000009',
      nickname: '4星店长测试',
      level: 'STAR_4',
      role: 'USER'
    });

    const star2User = await TestAuthHelper.createTestUser({
      phone: '18800000010',
      nickname: '2星店长测试',
      level: 'STAR_2',
      role: 'USER'
    });

    const star1User = await TestAuthHelper.createTestUser({
      phone: '18800000011',
      nickname: '1星店长测试',
      level: 'STAR_1',
      role: 'USER'
    });

    const vipUser = await TestAuthHelper.createTestUser({
      phone: '18800000012',
      nickname: 'VIP测试用户',
      level: 'VIP',
      role: 'USER'
    });

    testTeamData = {
      director: director.id,
      star5: star5User.id,
      star4: star4User.id,
      star3: star3.id,
      star2: star2User.id,
      star1: star1User.id,
      vip: vipUser.id,
      normal: normalUser.id
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /teams/structure', () => {
    it('星店长应该能够查看自己的团队结构', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/structure`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('structure');
      expect(response.body.data.structure).toHaveProperty('members');
    });

    it('管理员应该能够查看所有团队结构', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/structure`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('structure');
    });

    it('普通用户应该能够查看上级关系', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/structure`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /teams/performance', () => {
    it('星店长应该能够查看团队业绩', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/performance`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('performance');
    });

    it('管理员应该能够查看全局业绩', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/performance`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该支持时间范围查询', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/performance`)
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /teams/invite', () => {
    it('星店长应该能够邀请新成员', async () => {
      const response = await request(app)
        .post(`${API_BASE}/teams/invite`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send({
          phone: '13800138000',
          level: 'NORMAL'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('inviteCode');
    });

    it('普通用户不能邀请成员', async () => {
      const response = await request(app)
        .post(`${API_BASE}/teams/invite`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({
          phone: '13800138001',
          level: 'NORMAL'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('应该验证邀请参数', async () => {
      const response = await request(app)
        .post(`${API_BASE}/teams/invite`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send({
          phone: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /teams/members', () => {
    it('应该能够获取团队成员列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/members`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('members');
      expect(Array.isArray(response.body.data.members)).toBe(true);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/members`)
        .query({
          page: 1,
          perPage: 10
        })
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('应该支持按等级筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/members`)
        .query({
          level: 'VIP'
        })
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /teams/members/:userId/level', () => {
    it('管理员应该能够调整成员等级', async () => {
      const response = await request(app)
        .put(`${API_BASE}/teams/members/${testTeamData.normal}/level`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          level: 'VIP'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('星店长不能调整上级等级', async () => {
      const response = await request(app)
        .put(`${API_BASE}/teams/members/${testTeamData.star3}/level`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .send({
          level: 'STAR_4'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /teams/statistics', () => {
    it('应该能够获取团队统计数据', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/statistics`)
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalMembers');
      expect(response.body.data).toHaveProperty('levelDistribution');
      expect(response.body.data).toHaveProperty('performanceMetrics');
    });

    it('应该支持时间段统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/teams/statistics`)
        .query({
          period: 'month',
          year: 2024,
          month: 1
        })
        .set('Authorization', `Bearer ${directorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /teams/:teamId/move', () => {
    it('管理员应该能够移动团队成员', async () => {
      const response = await request(app)
        .post(`${API_BASE}/teams/${testTeamData.star2}/move`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          newParentId: testTeamData.star4
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('不能创建循环引用', async () => {
      const response = await request(app)
        .post(`${API_BASE}/teams/${testTeamData.star4}/move`)
        .set('Authorization', `Bearer ${directorToken}`)
        .send({
          newParentId: testTeamData.star2
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('循环');
    });
  });
});