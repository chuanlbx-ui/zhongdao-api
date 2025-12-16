/**
 * 响应处理单元测试
 */

import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createEmptyResponse,
  createBatchResponse,
  ErrorCode,
  getHttpStatus,
  ApiResponse
} from '../../src/shared/types/response';

describe('响应工具函数', () => {
  const mockRequestId = 'test-request-123';

  describe('createSuccessResponse', () => {
    it('应该创建成功响应', () => {
      const data = { id: 1, name: 'test' };
      const response = createSuccessResponse(data, '操作成功', undefined, mockRequestId);

      expect(response).toEqual({
        success: true,
        data,
        message: '操作成功',
        timestamp: expect.any(String),
        requestId: mockRequestId
      });
    });

    it('应该使用默认值', () => {
      const response = createSuccessResponse({ test: true });

      expect(response).toEqual({
        success: true,
        data: { test: true },
        message: undefined,
        timestamp: expect.any(String),
        requestId: undefined
      });
    });
  });

  describe('createErrorResponse', () => {
    it('应该创建错误响应', () => {
      const response = createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        '参数验证失败',
        { field: 'email' },
        mockRequestId
      );

      expect(response).toEqual({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: '参数验证失败',
          details: { field: 'email' },
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String),
        requestId: mockRequestId
      });
    });

    it('应该使用默认错误消息', () => {
      const response = createErrorResponse(ErrorCode.NOT_FOUND);
      expect(response.error?.message).toBe('请求的资源不存在');
    });
  });

  describe('createPaginatedResponse', () => {
    const mockItems = [
      { id: 1, name: 'item1' },
      { id: 2, name: 'item2' },
      { id: 3, name: 'item3' }
    ];

    it('应该创建分页响应', () => {
      const response = createPaginatedResponse(
        mockItems,
        100,
        2,
        20,
        '获取成功',
        mockRequestId
      );

      expect(response).toEqual({
        success: true,
        data: {
          items: mockItems,
          pagination: {
            page: 2,
            perPage: 20,
            totalCount: 100,
            totalPages: 5,
            hasNext: true,
            hasPrev: true
          }
        },
        message: '获取成功',
        timestamp: expect.any(String),
        requestId: mockRequestId,
        meta: {
          pagination: {
            page: 2,
            perPage: 20,
            totalCount: 100,
            totalPages: 5,
            hasNext: true,
            hasPrev: true
          }
        }
      });
    });

    it('应该正确计算分页信息', () => {
      // 第一页
      const response1 = createPaginatedResponse(mockItems, 50, 1, 20);
      expect(response1.data?.pagination.hasNext).toBe(true);
      expect(response1.data?.pagination.hasPrev).toBe(false);

      // 最后一页
      const response2 = createPaginatedResponse(mockItems, 20, 2, 10);
      expect(response2.data?.pagination.hasNext).toBe(false);
      expect(response2.data?.pagination.hasPrev).toBe(true);

      // 只有一页
      const response3 = createPaginatedResponse(mockItems, 3, 1, 10);
      expect(response3.data?.pagination.hasNext).toBe(false);
      expect(response3.data?.pagination.hasPrev).toBe(false);
    });
  });

  describe('createEmptyResponse', () => {
    it('应该创建空响应', () => {
      const response = createEmptyResponse('操作成功', mockRequestId);

      expect(response).toEqual({
        success: true,
        data: null,
        message: '操作成功',
        timestamp: expect.any(String),
        requestId: mockRequestId
      });
    });
  });

  describe('createBatchResponse', () => {
    it('应该创建批量操作响应', () => {
      const results = [
        { success: true, data: { id: 1 }, index: 0 },
        { success: false, error: '失败原因', index: 1 },
        { success: true, data: { id: 2 }, index: 2 }
      ];

      const response = createBatchResponse(results, '批量操作完成', mockRequestId);

      expect(response).toEqual({
        success: true,
        data: {
          total: 3,
          successCount: 2,
          failureCount: 1,
          results
        },
        message: '批量操作完成',
        timestamp: expect.any(String),
        requestId: mockRequestId
      });
    });

    it('应该处理空结果', () => {
      const response = createBatchResponse([]);
      expect(response.data?.total).toBe(0);
      expect(response.data?.successCount).toBe(0);
      expect(response.data?.failureCount).toBe(0);
    });
  });
});

describe('错误码和状态码映射', () => {
  describe('getHttpStatus', () => {
    it('应该返回正确的HTTP状态码', () => {
      expect(getHttpStatus(ErrorCode.NOT_FOUND)).toBe(404);
      expect(getHttpStatus(ErrorCode.UNAUTHORIZED)).toBe(401);
      expect(getHttpStatus(ErrorCode.FORBIDDEN)).toBe(403);
      expect(getHttpStatus(ErrorCode.VALIDATION_ERROR)).toBe(400);
      expect(getHttpStatus(ErrorCode.CONFLICT)).toBe(409);
      expect(getHttpStatus(ErrorCode.RATE_LIMIT_EXCEEDED)).toBe(429);
      expect(getHttpStatus(ErrorCode.INTERNAL_ERROR)).toBe(500);
    });
  });
});

describe('响应格式验证', () => {
  it('成功响应应该包含必要字段', () => {
    const response: ApiResponse<string> = createSuccessResponse('test data');

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('data');
    expect(response).toHaveProperty('timestamp');
    expect(response.success).toBe(true);
  });

  it('错误响应应该包含必要字段', () => {
    const response = createErrorResponse(ErrorCode.BAD_REQUEST);

    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('error');
    expect(response).toHaveProperty('timestamp');
    expect(response.success).toBe(false);
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
  });
});

// 响应格式化工具测试
describe('响应格式化工具', () => {
  const formatUserResponse = (user: any) => {
    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatarUrl,
      level: user.level,
      createdAt: user.createdAt
    };
  };

  const formatProductResponse = (product: any) => {
    return {
      id: product.id,
      name: product.name,
      price: parseFloat(product.basePrice),
      images: product.images || [],
      status: product.status || 'ACTIVE'
    };
  };

  it('应该格式化用户数据', () => {
    const rawUser = {
      id: 'user-123',
      nickname: '测试用户',
      avatarUrl: 'http://example.com/avatar.jpg',
      level: 'VIP',
      createdAt: '2025-01-15T10:00:00.000Z',
      password: 'secret', // 不应该返回
      email: 'test@example.com' // 不应该返回
    };

    const formatted = formatUserResponse(rawUser);

    expect(formatted).toEqual({
      id: 'user-123',
      nickname: '测试用户',
      avatar: 'http://example.com/avatar.jpg',
      level: 'VIP',
      createdAt: '2025-01-15T10:00:00.000Z'
    });

    expect(formatted).not.toHaveProperty('password');
    expect(formatted).not.toHaveProperty('email');
  });

  it('应该格式化商品数据', () => {
    const rawProduct = {
      id: 'prod-123',
      name: '测试商品',
      basePrice: '99.99',
      images: ['image1.jpg', 'image2.jpg'],
      status: 'ACTIVE',
      description: '商品描述',
      stock: 100
    };

    const formatted = formatProductResponse(rawProduct);

    expect(formatted).toEqual({
      id: 'prod-123',
      name: '测试商品',
      price: 99.99,
      images: ['image1.jpg', 'image2.jpg'],
      status: 'ACTIVE'
    });

    expect(typeof formatted.price).toBe('number');
  });
});