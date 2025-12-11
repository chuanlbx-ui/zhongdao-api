/**
 * 用户管理API测试
 * 测试用户注册、登录、信息更新等功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../setup';
import { TestAuthHelper, createTestUser, verifyToken } from '../helpers/auth.helper';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = '/api/v1';

describe('用户管理API测试', () => {
  let normalUserToken: string;
  let vipUserToken: string;
  let starUserToken: string;
  let adminToken: string;

  beforeAll(async () => {
    console.log('开始用户管理API测试...');

    // 创建测试用户并获取token
    const normalUser = await createTestUser('normal');
    const vipUser = await createTestUser('vip');
    const starUser = await createTestUser('star1');
    const adminUser = await createTestUser('admin');

    normalUserToken = normalUser.tokens.accessToken;
    vipUserToken = vipUser.tokens.accessToken;
    starUserToken = starUser.tokens.accessToken;
    adminToken = adminUser.tokens.accessToken;

    // 创建额外的测试用户作为下级
    const vipSubUser1 = await createTestUser('normal');
    const vipSubUser2 = await createTestUser('normal');
    const starSubUser1 = await createTestUser('normal');
    const starSubUser2 = await createTestUser('normal');
    const starSubUser3 = await createTestUser('normal');

    // 更新这些用户的手机号以便区分
    await prisma.users.update({
      where: { id: vipSubUser1.id },
      data: { phone: '18800000005', teamPath: `${vipUser.phone}->18800000005` }
    });
    await prisma.users.update({
      where: { id: vipSubUser2.id },
      data: { phone: '18800000006', teamPath: `${vipUser.phone}->18800000006` }
    });
    await prisma.users.update({
      where: { id: starSubUser1.id },
      data: { phone: '18800000007', teamPath: `${starUser.phone}->18800000007` }
    });
    await prisma.users.update({
      where: { id: starSubUser2.id },
      data: { phone: '18800000008', teamPath: `${starUser.phone}->18800000008` }
    });
    await prisma.users.update({
      where: { id: starSubUser3.id },
      data: { phone: '18800000009', teamPath: `${starUser.phone}->18800000009` }
    });

    // 为VIP和星级用户创建下级用户关系
    // 为VIP用户创建2个普通用户下级
    await prisma.users.updateMany({
      where: { phone: { in: ['18800000005', '18800000006'] } },
      data: {
        parentId: vipUser.id,
        status: 'ACTIVE'
      }
    });

    // 为星级用户创建3个下级用户
    await prisma.users.updateMany({
      where: { phone: { in: ['18800000007', '18800000008', '18800000009'] } },
      data: {
        parentId: starUser.id,
        status: 'ACTIVE'
      }
    });

    // 验证数据库中的用户数据
    const dbNormalUser = await prisma.users.findUnique({
      where: { id: normalUser.id }
    });
    console.log('数据库中的普通用户:', dbNormalUser?.level, dbNormalUser?.id);

    const dbVipUser = await prisma.users.findUnique({
      where: { id: vipUser.id }
    });
    console.log('数据库中的VIP用户:', dbVipUser?.level, dbVipUser?.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /users/profile', () => {
    it('普通用户应该能够获取个人信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('openid');
      expect(response.body.data).toHaveProperty('nickname');
      expect(response.body.data.level).toBe('NORMAL');
    });

    it('VIP用户应该显示VIP等级标识', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${vipUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.level).toBe('VIP');
    });

    it('星店长应该显示店铺管理权限', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.level).toContain('STAR');
    });

    it('管理员应该显示管理员标识', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.level).toBe('DIRECTOR');
      expect(response.body.data.isAdmin).toBe(true);
    });

    it('未认证用户应该被拒绝访问', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/profile`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('缺少认证Token');
    });
  });

  describe('PUT /users/profile', () => {
    it('应该能够更新用户基本信息', async () => {
      const updateData = {
        nickname: '新昵称',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        phone: '13800138001'
      };

      const response = await request(app)
        .put(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nickname).toBe(updateData.nickname);
    });

    it('应该验证手机号格式', async () => {
      const updateData = {
        phone: 'invalid-phone'
      };

      const response = await request(app)
        .put(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('phone');
    });

    it('不允许更新关键字段', async () => {
      const updateData = {
        level: 'STAR_5',
        pointsBalance: 99999
      };

      const response = await request(app)
        .put(`${API_BASE}/users/profile`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /users/:id', () => {
    let testUserId: string;

    beforeEach(async () => {
      const response = await prisma.users.findFirst({
        where: { level: 'NORMAL' }
      });
      testUserId = response?.id || '';
    });

    it('管理员应该能够查看任意用户信息', async () => {
      if (!testUserId) {
        // 创建测试用户
        const user = await createTestUser('normal');
        testUserId = user.id;
      }

      const response = await request(app)
        .get(`${API_BASE}/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
    });

    it('用户应该能够查看自己的信息', async () => {
      // 从normalUserToken解析用户ID，确保一致性
      const decodedToken = jwt.verify(normalUserToken, TestAuthHelper.JWT_SECRET) as any;
      const currentUserId = decodedToken.sub;

      const response = await request(app)
        .get(`${API_BASE}/users/${currentUserId}`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(currentUserId);
    });

    it('普通用户不能查看其他用户信息', async () => {
      if (!testUserId) return;

      // 创建另一个普通用户
      const anotherUser = await createTestUser('normal');

      const response = await request(app)
        .get(`${API_BASE}/users/${testUserId}`)
        .set('Authorization', `Bearer ${anotherUser.tokens.accessToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('不存在的用户ID应返回404', async () => {
      const fakeId = 'nonexistent_user_id';

      const response = await request(app)
        .get(`${API_BASE}/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /users/team', () => {
    it('星店长应该能够查看自己的团队', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/team`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('directCount');
      expect(response.body.data).toHaveProperty('teamCount');
      expect(response.body.data).toHaveProperty('members');
    });

    it('管理员应该能够查看所有团队', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/team`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('普通用户不能查看团队信息', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/team`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('团队数据应包含层级关系', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/team`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      if (response.body.data.members && response.body.data.members.length > 0) {
        const member = response.body.data.members[0];
        expect(member).toHaveProperty('level');
        expect(member).toHaveProperty('teamPath');
      }
    });
  });

  describe('GET /users/statistics', () => {
    it('用户应该能够查看个人统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/statistics`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSales');
      expect(response.body.data).toHaveProperty('totalBottles');
      expect(response.body.data).toHaveProperty('teamSales');
    });

    it('星店长应该有团队业绩统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/statistics`)
        .set('Authorization', `Bearer ${starUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('monthlyPerformance');
      expect(Array.isArray(response.body.data.monthlyPerformance)).toBe(true);
    });

    it('管理员应该有全局统计', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/statistics`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalUsers');
      expect(response.body.data).toHaveProperty('levelDistribution');
    });

    it('普通用户不能查看全局统计', async () => {
      // 使用查询参数来请求全局统计
      const response = await request(app)
        .get(`${API_BASE}/users/statistics?global=true`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /users/upload-avatar', () => {
    it('应该能够上传头像', async () => {
      // 模拟文件上传
      const response = await request(app)
        .post(`${API_BASE}/users/upload-avatar`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .attach('avatar', 'test-avatar.jpg', 'test image data')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('url');
    });

    it('应该验证文件类型', async () => {
      const response = await request(app)
        .post(`${API_BASE}/users/upload-avatar`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .attach('avatar', 'test.txt', 'test file data')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('文件类型');
    });

    it('未认证用户不能上传头像', async () => {
      const response = await request(app)
        .post(`${API_BASE}/users/upload-avatar`)
        .attach('avatar', 'test-avatar.jpg', 'test image data')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /users/bind-phone', () => {
    it('应该能够绑定手机号', async () => {
      const phoneData = {
        phone: '13800138002',
        code: '123456'
      };

      const response = await request(app)
        .post(`${API_BASE}/users/bind-phone`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(phoneData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该验证验证码', async () => {
      const phoneData = {
        phone: '13800138003',
        code: '000000' // 错误的验证码
      };

      const response = await request(app)
        .post(`${API_BASE}/users/bind-phone`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(phoneData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('验证码');
    });

    it('重复绑定应该返回错误', async () => {
      // 先绑定一次
      const phoneData = {
        phone: '13800138004',
        code: '123456'
      };

      await request(app)
        .post(`${API_BASE}/users/bind-phone`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(phoneData)
        .expect(200);

      // 再次绑定
      const response = await request(app)
        .post(`${API_BASE}/users/bind-phone`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(phoneData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /users/referrals', () => {
    it('用户应该查看自己的推荐记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/referrals`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('referralCode');
      expect(response.body.data).toHaveProperty('referrals');
    });

    it('管理员应该查看所有推荐记录', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/referrals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /users/notifications', () => {
    it('用户应该能够获取通知列表', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/notifications`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .query({ page: 1, perPage: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it('应该支持按已读状态筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/notifications`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .query({ page: 1, perPage: 10, read: false })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('应该支持按通知类型筛选', async () => {
      const response = await request(app)
        .get(`${API_BASE}/users/notifications`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .query({ page: 1, perPage: 10, type: 'INFO' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /users/notifications/:id/read', () => {
    let notificationId: string;
    let testUserId: string;

    beforeEach(async () => {
      // 从token中解析用户ID，确保使用同一个用户
      const decodedToken = jwt.verify(normalUserToken, TestAuthHelper.JWT_SECRET) as any;
      testUserId = decodedToken.sub;

      // 创建测试通知
      const notification = await prisma.notifications.create({
        data: {
          id: `test_notify_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          recipientId: testUserId,
          type: 'INFO',
          category: 'SYSTEM',
          title: '测试通知',
          content: '这是一条测试通知',
          isRead: false,
          channels: { APP: true },
          sentChannels: 'APP',
          recipientType: 'USER',
          status: 'SENT',
          priority: 'NORMAL',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      notificationId = notification.id;
    });

    it('应该能够标记通知为已读', async () => {
      const response = await request(app)
        .put(`${API_BASE}/users/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .set('Content-Type', 'application/json')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('不存在的通知ID应返回404', async () => {
      const fakeId = 'nonexistent_notification_id';

      const response = await request(app)
        .put(`${API_BASE}/users/notifications/${fakeId}/read`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .set('Content-Type', 'application/json')
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /users/verify-kyc', () => {
    it('应该能够提交KYC申请', async () => {
      const kycData = {
        realName: '测试用户',
        idCard: '110101199001010001',
        frontImage: 'front-image-url',
        backImage: 'back-image-url',
        businessLicense: 'business-license-url'
      };

      const response = await request(app)
        .post(`${API_BASE}/users/verify-kyc`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(kycData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('PENDING');
    });

    it('应该验证必填字段', async () => {
      const kycData = {
        realName: '',
        idCard: '',
        frontImage: '',
        backImage: ''
      };

      const response = await request(app)
        .post(`${API_BASE}/users/verify-kyc`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(kycData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('必填');
    });

    it('已通过KYC的用户不能重复申请', async () => {
      // 先通过KYC
      const kycData = {
        realName: '测试用户',
        idCard: '110101199001010002',
        frontImage: 'front-image-url',
        backImage: 'back-image-url',
        businessLicense: 'business-license-url'
      };

      await request(app)
        .post(`${API_BASE}/users/verify-kyc`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(kycData)
        .expect(200);

      // 再次申请
      const response = await request(app)
        .post(`${API_BASE}/users/verify-kyc`)
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send(kycData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});