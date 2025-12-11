import { PrismaClient, admins_role } from '@prisma/client';
import { logger } from '../../utils/logger';
import { createErrorResponse, ErrorCode } from '../../types/response';

const prisma = new PrismaClient();

// 权限定义
export const PERMISSIONS = {
  // 用户管理权限
  USER_VIEW: 'user:view',              // 查看用户列表
  USER_CREATE: 'user:create',          // 创建用户
  USER_EDIT: 'user:edit',              // 编辑用户
  USER_DELETE: 'user:delete',          // 删除用户
  USER_SUSPEND: 'user:suspend',        // 停用/启用用户
  USER_LEVEL_ADJUST: 'user:level_adjust', // 调整用户等级
  USER_VIEW_FINANCIAL: 'user:view_financial', // 查看用户财务信息

  // 订单管理权限
  ORDER_VIEW: 'order:view',            // 查看订单列表
  ORDER_DETAIL: 'order:detail',        // 查看订单详情
  ORDER_EDIT: 'order:edit',            // 编辑订单
  ORDER_CANCEL: 'order:cancel',        // 取消订单
  ORDER_REFUND: 'order:refund',        // 订单退款
  ORDER_SHIP: 'order:ship',            // 订单发货

  // 财务管理权限
  FINANCE_VIEW: 'finance:view',        // 查看财务报表
  FINANCE_WITHDRAW: 'finance:withdraw', // 提现审核
  FINANCE_COMMISSION: 'finance:commission', // 佣金管理
  FINANCE_RECHARGE: 'finance:recharge', // 充值管理
  FINANCE_ADJUST: 'finance:adjust',    // 资金调整

  // 商品管理权限
  PRODUCT_VIEW: 'product:view',        // 查看商品
  PRODUCT_CREATE: 'product:create',    // 创建商品
  PRODUCT_EDIT: 'product:edit',        // 编辑商品
  PRODUCT_DELETE: 'product:delete',    // 删除商品
  PRODUCT_STOCK: 'product:stock',      // 库存管理

  // 店铺管理权限
  SHOP_VIEW: 'shop:view',              // 查看店铺
  SHOP_APPROVE: 'shop:approve',        // 店铺审核
  SHOP_EDIT: 'shop:edit',              // 编辑店铺
  SHOP_SUSPEND: 'shop:suspend',        // 店铺停用/启用

  // 团队管理权限
  TEAM_VIEW: 'team:view',              // 查看团队
  TEAM_EDIT: 'team:edit',              // 编辑团队
  TEAM_STRUCTURE: 'team:structure',    // 查看团队结构
  TEAM_PERFORMANCE: 'team:performance', // 查看团队业绩

  // 系统配置权限
  SYSTEM_CONFIG: 'system:config',      // 系统配置
  SYSTEM_LOG: 'system:log',            // 系统日志
  SYSTEM_MONITOR: 'system:monitor',    // 系统监控
  SYSTEM_BACKUP: 'system:backup',      // 系统备份
  SYSTEM_MAINTENANCE: 'system:maintenance', // 系统维护

  // 营销管理权限
  PROMOTION_VIEW: 'promotion:view',    // 查看营销活动
  PROMOTION_CREATE: 'promotion:create', // 创建营销活动
  PROMOTION_EDIT: 'promotion:edit',    // 编辑营销活动
  PROMOTION_DELETE: 'promotion:delete', // 删除营销活动

  // 数据分析权限
  ANALYTICS_VIEW: 'analytics:view',    // 查看数据分析
  ANALYTICS_EXPORT: 'analytics:export', // 导出数据
  ANALYTICS_ADVANCED: 'analytics:advanced', // 高级分析

  // 通知管理权限
  NOTIFICATION_SEND: 'notification:send', // 发送通知
  NOTIFICATION_TEMPLATE: 'notification:template', // 通知模板

  // 审计权限
  AUDIT_VIEW: 'audit:view',            // 查看审计日志
  AUDIT_EXPORT: 'audit:export',        // 导出审计日志
} as const;

// 角色权限映射
const ROLE_PERMISSIONS: Record<admins_role, string[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS), // 超级管理员拥有所有权限

  ADMIN: [
    // 用户管理
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.USER_LEVEL_ADJUST,
    PERMISSIONS.USER_VIEW_FINANCIAL,

    // 订单管理
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_DETAIL,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_REFUND,
    PERMISSIONS.ORDER_SHIP,

    // 财务管理
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_WITHDRAW,
    PERMISSIONS.FINANCE_COMMISSION,
    PERMISSIONS.FINANCE_RECHARGE,

    // 商品管理
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_STOCK,

    // 店铺管理
    PERMISSIONS.SHOP_VIEW,
    PERMISSIONS.SHOP_APPROVE,
    PERMISSIONS.SHOP_EDIT,
    PERMISSIONS.SHOP_SUSPEND,

    // 团队管理
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_EDIT,
    PERMISSIONS.TEAM_STRUCTURE,
    PERMISSIONS.TEAM_PERFORMANCE,

    // 营销管理
    PERMISSIONS.PROMOTION_VIEW,
    PERMISSIONS.PROMOTION_CREATE,
    PERMISSIONS.PROMOTION_EDIT,
    PERMISSIONS.PROMOTION_DELETE,

    // 数据分析
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,

    // 通知管理
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_TEMPLATE,

    // 审计
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.AUDIT_EXPORT,
  ],

  OPERATOR: [
    // 基础查看权限
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_DETAIL,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_STOCK,
    PERMISSIONS.SHOP_VIEW,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_PERFORMANCE,
    PERMISSIONS.PROMOTION_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,

    // 基础操作权限
    PERMISSIONS.ORDER_SHIP,
    PERMISSIONS.NOTIFICATION_SEND,

    // 系统监控
    PERMISSIONS.SYSTEM_MONITOR,
  ],
};

// 权限检查服务
export class PermissionService {
  /**
   * 检查用户是否具有指定权限
   */
  static async hasPermission(
    adminId: string,
    permission: string
  ): Promise<boolean> {
    try {
      // 获取管理员信息
      const admin = await prisma.admins.findUnique({
        where: { id: adminId },
        select: {
          role: true,
          permissions: true,
          status: true,
        }
      });

      if (!admin) {
        logger.warn('管理员不存在', { adminId });
        return false;
      }

      if (admin.status !== 'ACTIVE') {
        logger.warn('管理员状态不活跃', { adminId, status: admin.status });
        return false;
      }

      // 如果管理员有自定义权限配置
      if (admin.permissions && Array.isArray(admin.permissions)) {
        const customPermissions = admin.permissions as string[];
        return customPermissions.includes(permission);
      }

      // 使用角色默认权限
      const rolePermissions = ROLE_PERMISSIONS[admin.role] || [];
      return rolePermissions.includes(permission);
    } catch (error) {
      logger.error('检查权限失败', {
        adminId,
        permission,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 检查用户是否具有任一权限
   */
  static async hasAnyPermission(
    adminId: string,
    permissions: string[]
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(adminId, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取用户的所有权限
   */
  static async getAdminPermissions(adminId: string): Promise<string[]> {
    try {
      const admin = await prisma.admins.findUnique({
        where: { id: adminId },
        select: {
          role: true,
          permissions: true,
          status: true,
        }
      });

      if (!admin || admin.status !== 'ACTIVE') {
        return [];
      }

      // 返回自定义权限或角色权限
      if (admin.permissions && Array.isArray(admin.permissions)) {
        return admin.permissions as string[];
      }

      return ROLE_PERMISSIONS[admin.role] || [];
    } catch (error) {
      logger.error('获取管理员权限失败', {
        adminId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      return [];
    }
  }

  /**
   * 检查并更新管理员权限
   */
  static async updateAdminPermissions(
    adminId: string,
    permissions: string[],
    operatorId: string
  ): Promise<void> {
    try {
      // 验证所有权限都是有效的
      const validPermissions = Object.values(PERMISSIONS);
      const invalidPermissions = permissions.filter(
        p => !validPermissions.includes(p as any)
      );

      if (invalidPermissions.length > 0) {
        throw new Error(`无效的权限: ${invalidPermissions.join(', ')}`);
      }

      // 更新权限
      await prisma.admins.update({
        where: { id: adminId },
        data: {
          permissions: permissions,
          updatedAt: new Date(),
        }
      });

      logger.info('管理员权限已更新', {
        adminId,
        permissions,
        operatorId
      });
    } catch (error) {
      logger.error('更新管理员权限失败', {
        adminId,
        permissions,
        operatorId,
        error: error instanceof Error ? error.message : '未知错误'
      });
      throw error;
    }
  }

  /**
   * 获取角色权限模板
   */
  static getRolePermissions(role: admins_role): string[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * 检查权限继承关系
   * 检查角色A是否可以操作角色B的用户
   */
  static canManageRole(managerRole: admins_role, targetRole: admins_role): boolean {
    const roleHierarchy = {
      SUPER_ADMIN: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'],
      ADMIN: ['ADMIN', 'OPERATOR'],
      OPERATOR: [],
    };

    return roleHierarchy[managerRole]?.includes(targetRole) || false;
  }
}

// 创建权限检查中间件工厂
export const requirePermission = (permission: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json(
          createErrorResponse(
            ErrorCode.UNAUTHORIZED,
            '需要管理员认证'
          )
        );
      }

      const hasPermission = await PermissionService.hasPermission(
        req.user.id,
        permission
      );

      if (!hasPermission) {
        return res.status(403).json(
          createErrorResponse(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            `需要权限: ${permission}`,
            {
              required: permission,
              adminId: req.user.id
            }
          )
        );
      }

      next();
    } catch (error) {
      logger.error('权限检查中间件错误', {
        error: error instanceof Error ? error.message : '未知错误',
        permission,
        userId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '权限检查失败'
        )
      );
    }
  };
};

// 创建多权限检查中间件工厂（满足任一权限即可）
export const requireAnyPermission = (permissions: string[]) => {
  return async (req: any, res: any, next: any) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json(
          createErrorResponse(
            ErrorCode.UNAUTHORIZED,
            '需要管理员认证'
          )
        );
      }

      const hasPermission = await PermissionService.hasAnyPermission(
        req.user.id,
        permissions
      );

      if (!hasPermission) {
        return res.status(403).json(
          createErrorResponse(
            ErrorCode.INSUFFICIENT_PERMISSIONS,
            `需要以下任一权限: ${permissions.join(', ')}`,
            {
              required: permissions,
              adminId: req.user.id
            }
          )
        );
      }

      next();
    } catch (error) {
      logger.error('权限检查中间件错误', {
        error: error instanceof Error ? error.message : '未知错误',
        permissions,
        userId: req.user?.id
      });

      res.status(500).json(
        createErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          '权限检查失败'
        )
      );
    }
  };
};