import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../setup';

describe('Admin系统简单测试', () => {
  let adminToken: string;

  beforeAll(async () => {
    // 使用预定义的admin用户token进行测试
    // 这里我们模拟一个admin token
    adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bHN4MGgwMDAwZWQ4dzEyYWM2am5zIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoibm9ybWFsIiwiaWF0IjoxNzYzNDcyMTc3LCJleHAiOjE3NjQwNzY5NzcsImp0aSI6ImxwMDM2czNkeXhtaTRsc3gweCJ9.kkNTyb8CyQFuFqEf4f7qyLjrGTSTa-jtYLx6uvPgjsc';
  });

  describe('基础健康检查', () => {
    it('应能访问健康检查接口', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });

    it('应能访问API文档', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);

      expect(response.text).toContain('swagger');
    });
  });

  describe('Admin接口基础测试', () => {
    const adminHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    it('应能获取用户统计信息', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/users')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('应能获取订单统计信息', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/orders')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('应能获取商品统计信息', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/products')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('应能获取系统配置', async () => {
      const response = await request(app)
        .get('/api/v1/admin/config')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('权限控制测试', () => {
    it('无token时应拒绝访问Admin接口', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/users')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('无效token时应拒绝访问Admin接口', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/users')
        .set({
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('普通用户token应无法访问Admin接口', async () => {
      // 使用普通用户的token
      const userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWk0bjMzN28wMDAxZWRiY2ZjdzNyeGRuIiwic2NvcGUiOlsiYWN0aXZlIiwidXNlciJdLCJyb2xlIjoiVVNFUiIsImxldmVsIjoiZGlyZWN0b3IiLCJpYXQiOjE3NjM0NzQzNDgsImV4cCI6MTc2NDA3OTE0OCwianRpIjoiMHd3amQ3cXZjZTVlbWk0bjNmcnoifQ.83SSYBxiNp-Xm7tshMXbRMaz0ERu9HS11SoVsoRBC_k';

      const response = await request(app)
        .get('/api/v1/admin/statistics/users')
        .set({
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toContain('PERMISSION');
    });
  });

  describe('Admin操作响应时间测试', () => {
    const adminHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    it('统计接口响应时间应在1秒内', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/v1/admin/statistics/dashboard')
        .set(adminHeaders)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('用户列表接口响应时间应在2秒内', async () => {
      const startTime = Date.now();

      await request(app)
        .get('/api/v1/admin/users')
        .query({ perPage: 20, page: 1 })
        .set(adminHeaders)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Admin数据格式验证', () => {
    const adminHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };

    it('用户统计数据应包含必要字段', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/users')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data.statistics).toHaveProperty('totalUsers');
      expect(response.body.data.statistics).toHaveProperty('activeUsers');
      expect(response.body.data.statistics).toHaveProperty('newUsers');
    });

    it('订单统计数据应包含必要字段', async () => {
      const response = await request(app)
        .get('/api/v1/admin/statistics/orders')
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data.statistics).toHaveProperty('totalOrders');
      expect(response.body.data.statistics).toHaveProperty('completedOrders');
      expect(response.body.data.statistics).toHaveProperty('totalRevenue');
    });

    it('用户列表应分页返回', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .query({ perPage: 10, page: 1 })
        .set(adminHeaders)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('users');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('perPage');
      expect(response.body.data.pagination).toHaveProperty('total');
      expect(response.body.data.pagination).toHaveProperty('totalPages');
    });
  });
});