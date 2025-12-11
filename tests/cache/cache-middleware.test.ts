/**
 * 缓存中间件测试
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { cacheManager } from '../../src/shared/cache/CacheManager';
import {
  cacheMiddleware,
  productCacheMiddleware,
  userCacheMiddleware,
  invalidateCacheMiddleware,
  invalidateTagsMiddleware
} from '../../src/shared/middleware/cache';

describe('缓存中间件测试', () => {
  let app: express.Application;

  beforeAll(async () => {
    await cacheManager.connect();
  });

  afterAll(async () => {
    await cacheManager.flush();
    await cacheManager.disconnect();
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  afterEach(async () => {
    await cacheManager.flush();
  });

  describe('基础缓存中间件', () => {
    it('应该缓存GET请求的响应', async () => {
      let callCount = 0;

      app.get('/test',
        cacheMiddleware({ ttl: 60 }),
        (req, res) => {
          callCount++;
          res.json({ data: `response-${callCount}`, timestamp: Date.now() });
        }
      );

      // 第一次请求
      const response1 = await request(app)
        .get('/test')
        .expect(200);

      expect(response1.body.data).toBe('response-1');
      expect(response1.headers['x-cache']).toBe('MISS');

      // 第二次请求应该从缓存获取
      const response2 = await request(app)
        .get('/test')
        .expect(200);

      expect(response2.body.data).toBe('response-1'); // 相同的数据
      expect(response2.body.timestamp).toBe(response1.body.timestamp); // 相同的时间戳
      expect(response2.headers['x-cache']).toBe('HIT');

      // callCount应该只增加了一次
      expect(callCount).toBe(1);
    });

    it('应该根据查询参数生成不同的缓存键', async () => {
      app.get('/test-query',
        cacheMiddleware({ ttl: 60, includeQuery: true }),
        (req, res) => {
          res.json({ query: req.query });
        }
      );

      const response1 = await request(app)
        .get('/test-query?page=1')
        .expect(200);

      const response2 = await request(app)
        .get('/test-query?page=2')
        .expect(200);

      expect(response1.body.query).toEqual({ page: '1' });
      expect(response2.body.query).toEqual({ page: '2' });
      expect(response1.headers['x-cache']).toBe('MISS');
      expect(response2.headers['x-cache']).toBe('MISS');

      // 再次请求相同参数
      const response3 = await request(app)
        .get('/test-query?page=1')
        .expect(200);

      expect(response3.headers['x-cache']).toBe('HIT');
    });

    it('应该根据请求头生成不同的缓存键', async () => {
      app.get('/test-header',
        cacheMiddleware({ ttl: 60, varyOn: ['authorization'] }),
        (req, res) => {
          res.json({ auth: req.headers.authorization });
        }
      );

      const response1 = await request(app)
        .get('/test-header')
        .set('Authorization', 'Bearer token1')
        .expect(200);

      const response2 = await request(app)
        .get('/test-header')
        .set('Authorization', 'Bearer token2')
        .expect(200);

      expect(response1.body.auth).toBe('Bearer token1');
      expect(response2.body.auth).toBe('Bearer token2');
      expect(response1.headers['x-cache']).toBe('MISS');
      expect(response2.headers['x-cache']).toBe('MISS');

      // 相同的token应该命中缓存
      const response3 = await request(app)
        .get('/test-header')
        .set('Authorization', 'Bearer token1')
        .expect(200);

      expect(response3.headers['x-cache']).toBe('HIT');
    });

    it('应该跳过POST请求', async () => {
      let callCount = 0;

      app.post('/test',
        cacheMiddleware({ ttl: 60 }),
        (req, res) => {
          callCount++;
          res.json({ data: `post-${callCount}` });
        }
      );

      const response1 = await request(app)
        .post('/test')
        .send({})
        .expect(200);

      const response2 = await request(app)
        .post('/test')
        .send({})
        .expect(200);

      expect(response1.body.data).toBe('post-1');
      expect(response2.body.data).toBe('post-2');
      expect(callCount).toBe(2); // 每次都调用
    });

    it('应该根据条件跳过缓存', async () => {
      let callCount = 0;

      app.get('/test-condition',
        cacheMiddleware({
          ttl: 60,
          condition: (req) => req.query.noCache !== 'true'
        }),
        (req, res) => {
          callCount++;
          res.json({ data: `response-${callCount}` });
        }
      );

      // 缓存
      const response1 = await request(app)
        .get('/test-condition')
        .expect(200);

      const response2 = await request(app)
        .get('/test-condition')
        .expect(200);

      // 不缓存
      const response3 = await request(app)
        .get('/test-condition?noCache=true')
        .expect(200);

      const response4 = await request(app)
        .get('/test-condition?noCache=true')
        .expect(200);

      expect(response1.body.data).toBe('response-1');
      expect(response2.body.data).toBe('response-1'); // 缓存命中
      expect(response3.body.data).toBe('response-2');
      expect(response4.body.data).toBe('response-3');
      expect(callCount).toBe(3);
    });

    it('应该处理缓存穿透保护', async () => {
      app.get('/test-protection',
        cacheMiddleware({
          ttl: 60,
          enableProtection: true,
          protectionTTL: 1,
          maxRequests: 2
        }),
        (req, res) => {
          res.status(404).json({ error: 'Not found' });
        }
      );

      // 前两次请求
      await request(app).get('/test-protection').expect(404);
      await request(app).get('/test-protection').expect(404);

      // 第三次请求应该触发保护
      const response = await request(app)
        .get('/test-protection')
        .expect(429);

      expect(response.body.error).toBe('Too Many Requests');
      expect(response.body.message).toBe('请求过于频繁，请稍后再试');
    });
  });

  describe('专用缓存中间件', () => {
    it('产品缓存中间件应该使用正确的标签', async () => {
      app.get('/products/:id',
        productCacheMiddleware({ ttl: 60 }),
        (req, res) => {
          res.json({ productId: req.params.id, data: 'product data' });
        }
      );

      const response = await request(app)
        .get('/products/123')
        .expect(200);

      expect(response.headers['x-cache']).toBe('MISS');
    });

    it('用户缓存中间件应该考虑授权头', async () => {
      app.get('/users/profile',
        userCacheMiddleware({ ttl: 60 }),
        (req, res) => {
          res.json({ user: req.headers.authorization });
        }
      );

      const response1 = await request(app)
        .get('/users/profile')
        .set('Authorization', 'Bearer token1')
        .expect(200);

      const response2 = await request(app)
        .get('/users/profile')
        .set('Authorization', 'Bearer token2')
        .expect(200);

      expect(response1.body.user).toBe('Bearer token1');
      expect(response2.body.user).toBe('Bearer token2');
      expect(response1.headers['x-cache']).toBe('MISS');
      expect(response2.headers['x-cache']).toBe('MISS');
    });
  });

  describe('缓存失效中间件', () => {
    it('应该在响应后清除指定模式的缓存', async () => {
      // 先设置一些缓存
      await cacheManager.set('test:pattern:1', 'value1');
      await cacheManager.set('test:pattern:2', 'value2');
      await cacheManager.set('other:key', 'value3');

      app.post('/invalidate',
        invalidateCacheMiddleware(['test:pattern:*']),
        (req, res) => {
          res.json({ success: true });
        }
      );

      await request(app)
        .post('/invalidate')
        .expect(200);

      // 检查缓存是否被清除
      const value1 = await cacheManager.get('test:pattern:1');
      const value2 = await cacheManager.get('test:pattern:2');
      const value3 = await cacheManager.get('other:key');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
      expect(value3).toBe('value3'); // 不应该被清除
    });

    it('应该在响应后清除指定标签的缓存', async () => {
      // 先设置带标签的缓存
      await cacheManager.set('tagged:key1', 'value1', { tags: ['test-tag'] });
      await cacheManager.set('tagged:key2', 'value2', { tags: ['test-tag'] });
      await cacheManager.set('tagged:key3', 'value3', { tags: ['other-tag'] });

      app.post('/invalidate-tags',
        invalidateTagsMiddleware(['test-tag']),
        (req, res) => {
          res.json({ success: true });
        }
      );

      await request(app)
        .post('/invalidate-tags')
        .expect(200);

      // 检查缓存是否被清除
      const value1 = await cacheManager.get('tagged:key1');
      const value2 = await cacheManager.get('tagged:key2');
      const value3 = await cacheManager.get('tagged:key3');

      expect(value1).toBeNull();
      expect(value2).toBeNull();
      expect(value3).toBe('value3'); // 不应该被清除
    });

    it('只有成功响应才应该清除缓存', async () => {
      // 先设置缓存
      await cacheManager.set('should:clear', 'value');

      app.post('/fail-invalidate',
        invalidateCacheMiddleware(['should:*']),
        (req, res) => {
          res.status(500).json({ error: 'Server error' });
        }
      );

      await request(app)
        .post('/fail-invalidate')
        .expect(500);

      // 缓存不应该被清除
      const value = await cacheManager.get('should:clear');
      expect(value).toBe('value');
    });
  });

  describe('缓存配置', () => {
    it('应该支持自定义TTL', async () => {
      app.get('/short-ttl',
        cacheMiddleware({ ttl: 1 }),
        (req, res) => {
          res.json({ timestamp: Date.now() });
        }
      );

      const response1 = await request(app)
        .get('/short-ttl')
        .expect(200);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 1100));

      const response2 = await request(app)
        .get('/short-ttl')
        .expect(200);

      expect(response1.body.timestamp).not.toBe(response2.body.timestamp);
      expect(response1.headers['x-cache']).toBe('MISS');
      expect(response2.headers['x-cache']).toBe('MISS');
    });

    it('应该支持自定义缓存键生成器', async () => {
      app.get('/custom-key',
        cacheMiddleware({
          ttl: 60,
          keyGenerator: (req) => `custom:${req.query.type}:${req.query.id}`
        }),
        (req, res) => {
          res.json({ ok: true });
        }
      );

      await request(app)
        .get('/custom-key?type=product&id=123')
        .expect(200);

      // 使用不同的参数应该不命中缓存
      const response = await request(app)
        .get('/custom-key?type=user&id=123')
        .expect(200);

      expect(response.headers['x-cache']).toBe('MISS');
    });

    it('应该支持命中回调', async () => {
      let hitCallbackCalled = false;
      let missCallbackCalled = false;
      let setCallbackCalled = false;

      app.get('/callbacks',
        cacheMiddleware({
          ttl: 60,
          onHit: (req, data) => { hitCallbackCalled = true; },
          onMiss: (req) => { missCallbackCalled = true; },
          onSet: (req, data) => { setCallbackCalled = true; }
        }),
        (req, res) => {
          res.json({ data: 'test' });
        }
      );

      // 第一次请求
      await request(app)
        .get('/callbacks')
        .expect(200);

      expect(missCallbackCalled).toBe(true);
      expect(setCallbackCalled).toBe(true);
      expect(hitCallbackCalled).toBe(false);

      // 第二次请求
      await request(app)
        .get('/callbacks')
        .expect(200);

      expect(hitCallbackCalled).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应该处理空响应', async () => {
      app.get('/empty',
        cacheMiddleware({ ttl: 60 }),
        (req, res) => {
          res.json(null);
        }
      );

      const response = await request(app)
        .get('/empty')
        .expect(200);

      expect(response.body).toBe(null);
      expect(response.headers['x-cache']).toBe('MISS');

      // 再次请求应该命中缓存
      const response2 = await request(app)
        .get('/empty')
        .expect(200);

      expect(response2.body).toBe(null);
      expect(response2.headers['x-cache']).toBe('HIT');
    });

    it('应该处理大响应', async () => {
      const largeData = {
        items: new Array(1000).fill(0).map((_, i) => ({ id: i, name: `Item ${i}` }))
      };

      app.get('/large',
        cacheMiddleware({ ttl: 60 }),
        (req, res) => {
          res.json(largeData);
        }
      );

      const response = await request(app)
        .get('/large')
        .expect(200);

      expect(response.body.items).toHaveLength(1000);
      expect(response.headers['x-cache']).toBe('MISS');

      // 再次请求应该命中缓存
      const response2 = await request(app)
        .get('/large')
        .expect(200);

      expect(response2.body.items).toHaveLength(1000);
      expect(response2.headers['x-cache']).toBe('HIT');
    });

    it('应该处理流式响应', async () => {
      app.get('/stream',
        cacheMiddleware({ ttl: 60 }),
        (req, res) => {
          res.setHeader('content-type', 'text/plain');
          res.write('part1');
          setTimeout(() => {
            res.write('part2');
            res.end();
          }, 100);
        }
      );

      const response = await request(app)
        .get('/stream')
        .expect(200);

      // 流式响应不应该被缓存
      expect(response.headers['x-cache']).toBeUndefined();
    });
  });
});