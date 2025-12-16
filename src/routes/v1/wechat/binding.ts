import { Request, Response } from 'express';
import { prisma } from '../../../shared/database/client';
import { createSuccessResponse, createErrorResponse, ErrorCode } from '../../../shared/types/response';

// 绑定微信
export const bindWechat = async (req: Request, res: Response) => {
  try {
    // 从认证中间件获取用户ID
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(createErrorResponse(
        ErrorCode.UNAUTHORIZED,
        '用户未登录',
        undefined,
        undefined,
        req.requestId
      ));
    }

    const { code, nickname, avatarUrl } = req.body;

    // 在实际应用中，这里应该使用微信的code换取openid和unionid
    // 目前作为模拟，我们直接创建mock数据
    const openId = `mock_openid_${Date.now()}`;
    const unionId = `mock_unionid_${Math.random().toString(36).slice(2)}`;

    // 检查该微信是否已被其他用户绑定
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [
          { openid: openId },
          {
            // 模拟检查unionId，实际应该在schema中有unionId字段
            // 这里使用一个特定的字段来存储
          }
        ]
      }
    });

    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json(createErrorResponse(
        ErrorCode.BAD_REQUEST,
        '该微信账号已被其他用户绑定',
        undefined,
        undefined,
        req.requestId
      ));
    }

    // 更新用户微信绑定信息
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        openid: openId,
        // 注意：实际应用中应该存储unionId，但schema中没有此字段
        // 可以考虑将unionId存储在JSON字段中
        nickname: nickname || undefined,
        avatarUrl: avatarUrl || undefined
      },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatarUrl: true,
        email: true,
        openid: true,
        level: true,
        status: true
      }
    });

    res.json(createSuccessResponse({
      user: updatedUser,
      wechatInfo: {
        openId,
        unionId,
        nickname,
        avatarUrl
      }
    }, '微信绑定成功', undefined, req.requestId));

  } catch (error: any) {
    console.error('绑定微信失败:', error);
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      '绑定失败',
      undefined,
      undefined,
      req.requestId
    ));
  }
};

// 解绑微信
export const unbindWechat = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(createErrorResponse(
        ErrorCode.UNAUTHORIZED,
        '用户未登录',
        undefined,
        undefined,
        req.requestId
      ));
    }

    // 清除用户的微信绑定信息
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        openid: null
      },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatarUrl: true,
        email: true,
        level: true,
        status: true
      }
    });

    res.json(createSuccessResponse({
      user: updatedUser
    }, '微信解绑成功', undefined, req.requestId));

  } catch (error: any) {
    console.error('解绑微信失败:', error);
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      '解绑失败',
      undefined,
      undefined,
      req.requestId
    ));
  }
};

// 获取微信绑定状态
export const getWechatBinding = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(createErrorResponse(
        ErrorCode.UNAUTHORIZED,
        '用户未登录',
        undefined,
        undefined,
        req.requestId
      ));
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        nickname: true,
        avatarUrl: true,
        openid: true,
        level: true,
        status: true
      }
    });

    if (!user) {
      return res.status(404).json(createErrorResponse(
        ErrorCode.NOT_FOUND,
        '用户不存在',
        undefined,
        undefined,
        req.requestId
      ));
    }

    res.json(createSuccessResponse({
      isBound: !!user.openid,
      wechatInfo: user.openid ? {
        openId: user.openid,
        // 在实际应用中，这里应该返回unionId等信息
        nickname: user.nickname,
        avatarUrl: user.avatarUrl
      } : null
    }, '获取绑定状态成功', undefined, req.requestId));

  } catch (error: any) {
    console.error('获取微信绑定状态失败:', error);
    res.status(500).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      '获取绑定状态失败',
      undefined,
      undefined,
      req.requestId
    ));
  }
};