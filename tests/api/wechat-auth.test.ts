import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../setup';
import { prisma } from '../../src/shared/database/client';
import { wechatAuthService } from '../../src/shared/services/wechat-auth';

// 模拟微信API响应
vi.mock('axios');
import axios from 'axios';
const mockedAxios = vi.mocked(axios);

describe('微信认证接口测试', () => {
  let testUser: any = null;
  const testCode = 'test_wechat_code_12345';
  const testOpenid = 'test_openid_123456789';
  const testSessionKey = 'test_session_key_abcdefg';
  const testUserInfo = {
    nickName: '测试用户',
    avatarUrl: 'https://example.com/avatar.jpg',
    gender: 1,
    city: '深圳',
    province: '广东',
    country: '中国',
    language: 'zh_CN'
  };

  beforeAll(async () => {
    // 设置环境变量
    process.env.WECHAT_APP_ID = 'test_app_id';
    process.env.WECHAT_APP_SECRET = 'test_app_secret';
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // 清理测试数据
    if (testUser) {
      await prisma.users.delete({
        where: { id: testUser.id }
      });
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/wechat/login', () => {
    it('应该成功登录新用户', async () => {
      // 模拟微信API响应
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          openid: testOpenid,
          session_key: testSessionKey
        }
      });

      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({
          code: testCode,
          userInfo: testUserInfo
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.user.openid).toBe(testOpenid);
      expect(response.body.data.user.isNewUser).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();

      // 保存测试用户用于清理
      testUser = response.body.data.user;
    });

    it('应该成功登录已存在的用户', async () => {
      // 先创建一个用户
      const existingUser = await prisma.users.create({
        data: {
          openid: 'existing_openid',
          userNumber: 'TEST001',
          nickname: '已存在用户',
          level: 'NORMAL',
          status: 'ACTIVE'
        }
      });

      // 模拟微信API返回已存在用户
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          openid: 'existing_openid',
          session_key: 'existing_session_key'
        }
      });

      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({
          code: 'existing_code',
          userInfo: { nickName: '更新后的昵称' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isNewUser).toBe(false);
      expect(response.body.data.user.openid).toBe('existing_openid');

      // 清理测试数据
      await prisma.users.delete({
        where: { id: existingUser.id }
      });
    });

    it('应该拒绝无效的code', async () => {
      // 模拟微信API返回错误
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          errcode: 40029,
          errmsg: 'invalid code'
        }
      });

      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({
          code: 'invalid_code'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WECHAT_CODE_INVALID');
    });

    it('应该拒绝空的code', async () => {
      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('应该处理网络错误', async () => {
      // 模拟网络错误
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({
          code: testCode
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('应该支持解密用户信息', async () => {
      // 模拟微信API响应
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          openid: testOpenid,
          session_key: testSessionKey
        }
      });

      // 模拟加密的用户信息
      const encryptedData = 'encrypted_user_data';
      const iv = 'initialization_vector';

      // 由于加密解密复杂，这里只测试接口是否接受参数
      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({
          code: testCode + '_2',
          encryptedData,
          iv
        })
        .expect(500); // 解密会失败，但接口应该接受参数

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // 先登录获取refresh token
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          openid: 'refresh_test_openid',
          session_key: 'refresh_test_session_key'
        }
      });

      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({
          code: 'refresh_test_code'
        })
        .expect(200);

      refreshToken = response.body.data.tokens.refreshToken;
    });

    it('应该成功刷新token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
    });

    it('应该拒绝无效的refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid_refresh_token'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('应该拒绝空的refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/auth/wechat/qr', () => {
    it('应该返回登录指引', async () => {
      const response = await request(app)
        .get('/api/v1/auth/wechat/qr')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.loginUrl).toBeDefined();
      expect(response.body.data.instructions).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/wechat/user-info', () => {
    let accessToken: string;

    beforeEach(async () => {
      // 先登录获取access token
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          openid: 'user_info_test_openid',
          session_key: 'user_info_test_session_key'
        }
      });

      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({
          code: 'user_info_test_code'
        })
        .expect(200);

      accessToken = response.body.data.tokens.accessToken;

      // 创建用户
      testUser = response.body.data.user;
    });

    it('应该返回用户信息', async () => {
      const response = await request(app)
        .get('/api/v1/auth/wechat/user-info')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.userNumber).toBeDefined();
      expect(response.body.data.openid).not.toBeDefined(); // 不应该返回openid
      expect(response.body.data.phone).toBeNull(); // 未绑定手机号
    });

    it('应该拒绝未认证的请求', async () => {
      const response = await request(app)
        .get('/api/v1/auth/wechat/user-info')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/wechat/bind-phone', () => {
    let accessToken: string;
    const testPhone = '13800138000';

    beforeEach(async () => {
      // 先登录获取access token
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          openid: 'bind_phone_test_openid',
          session_key: 'bind_phone_test_session_key'
        }
      });

      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .send({
          code: 'bind_phone_test_code'
        })
        .expect(200);

      accessToken = response.body.data.tokens.accessToken;
    });

    it('应该成功绑定手机号（模拟）', async () => {
      // 由于实际的解密需要有效的微信数据，这里只测试接口结构
      const response = await request(app)
        .post('/api/v1/auth/wechat/bind-phone')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          sessionKey: 'test_session_key',
          encryptedData: 'test_encrypted_data',
          iv: 'test_iv'
        })
        .expect(400); // 解密会失败，但接口应该接受参数

      expect(response.body.success).toBe(false);
    });

    it('应该拒绝未认证的请求', async () => {
      const response = await request(app)
        .post('/api/v1/auth/wechat/bind-phone')
        .send({
          sessionKey: 'test_session_key',
          encryptedData: 'test_encrypted_data',
          iv: 'test_iv'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/wechat/health', () => {
    it('应该返回服务健康状态', async () => {
      const response = await request(app)
        .get('/api/v1/auth/wechat/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBeDefined();
    });
  });

  describe('安全测试', () => {
    it('应该检测并阻止频繁的登录尝试', async () => {
      // 模拟微信API错误，触发失败计数
      mockedAxios.get.mockResolvedValue({
        data: {
          errcode: 40029,
          errmsg: 'invalid code'
        }
      });

      // 快速发送多个请求
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/v1/auth/wechat/login')
          .send({ code: 'test_code' })
      );

      const responses = await Promise.all(requests);

      // 前5个应该返回400，第6个应该返回429（限流）
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('应该拒绝可疑的User-Agent', async () => {
      const response = await request(app)
        .post('/api/v1/auth/wechat/login')
        .set('User-Agent', 'curl/7.68.0')
        .send({
          code: testCode
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });
});