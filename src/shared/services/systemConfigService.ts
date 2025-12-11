import { prisma } from '@/shared/database/client'
import { systemConfigs_type } from '@prisma/client'

export interface SystemConfigValue {
  key: string
  value: any
  type: systemConfigs_type
  category: string
  description?: string
  isSystem?: boolean
  isEditable?: boolean
}

/**
 * 系统配置服务
 * 管理所有系统配置，包括用户等级体系配置
 */
export class SystemConfigService {
  /**
   * 获取配置值（智能类型转换）
   */
  static async getConfig<T = any>(key: string): Promise<T | null> {
    const config = await prisma.systemConfigs.findUnique({
      where: { key }
    })
    
    if (!config) return null
    
    try {
      const parsed = JSON.parse(config.value)
      return parsed as T
    } catch {
      // 如果不是JSON格式，直接返回字符串值
      return config.value as any
    }
  }

  /**
   * 获取某分类下的所有配置
   */
  static async getConfigsByCategory<T = any>(category: string): Promise<Record<string, T>> {
    const configs = await prisma.systemConfigs.findMany({
      where: { category }
    })
    
    const result: Record<string, T> = {}
    configs.forEach(config => {
      try {
        result[config.key] = JSON.parse(config.value) as T
      } catch {
        result[config.key] = config.value as any
      }
    })
    
    return result
  }

  /**
   * 设置配置值
   */
  static async setConfig(
    key: string,
    value: any,
    type: systemConfigs_type = 'JSON',
    category: string = 'system',
    description?: string,
    modifiedBy?: string
  ): Promise<void> {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value)

    await prisma.systemConfigs.upsert({
      where: { key },
      create: {
        id: `cmi${Date.now()}`,
        key,
        value: valueStr,
        type,
        category,
        description,
        isSystem: false,
        isEditable: true,
        lastModifiedBy: modifiedBy,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      update: {
        value: valueStr,
        description,
        lastModifiedBy: modifiedBy,
        updatedAt: new Date()
      }
    })
  }

  /**
   * 删除配置
   */
  static async deleteConfig(key: string): Promise<void> {
    const config = await prisma.systemConfigs.findUnique({ where: { key } })
    if (config?.isSystem) {
      throw new Error('系统内置配置不能删除')
    }
    
    await prisma.systemConfigs.delete({
      where: { key }
    })
  }

  /**
   * 获取所有配置（带分页）
   */
  static async getAllConfigs(
    category?: string,
    skip = 0,
    take = 20
  ) {
    const where = category ? { category } : {}
    const [configs, total] = await Promise.all([
      prisma.systemConfigs.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.systemConfigs.count({ where })
    ])

    // 解析JSON值
    const parsedConfigs = configs.map(config => {
      try {
        return {
          ...config,
          value: JSON.parse(config.value)
        }
      } catch {
        return config
      }
    })

    return {
      data: parsedConfigs,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take
    }
  }

  /**
   * 初始化默认配置
   * 通常在系统启动时调用
   */
  static async initializeDefaultConfigs(): Promise<void> {
    // 检查默认配置是否已存在
    const existingLevelConfig = await prisma.systemConfigs.findUnique({
      where: { key: 'USER_LEVEL_SYSTEM' }
    })

    if (existingLevelConfig) {
// [DEBUG REMOVED]       console.log('✅ 系统默认配置已存在，跳过初始化')
      return
    }

    // 创建用户等级系统配置
    const levelSystemConfig = {
      NORMAL: {
        key: 'NORMAL',
        name: '普通会员',
        order: 1,
        discount: 1.0,
        monthlyReward: 0,
        monthlyBonus: 0,
        benefits: ['基础购物功能', '参与平台活动', '积累消费升级'],
        upgradeRequires: {}
      },
      VIP: {
        key: 'VIP',
        name: 'VIP会员',
        order: 2,
        discount: 0.8,
        monthlyReward: 100,
        monthlyBonus: 50,
        benefits: ['享受8折优惠', '优先客服支持', '每月赠送100通券'],
        upgradeRequires: { teamSales: 1000 }
      },
      STAR_1: {
        key: 'STAR_1',
        name: '一星店长',
        order: 3,
        discount: 0.75,
        monthlyReward: 200,
        monthlyBonus: 100,
        benefits: ['享受7.5折优惠', '专属客服支持', '每月赠送200通券', '店长营销权限'],
        upgradeRequires: { directCount: 3, teamSales: 5000 }
      },
      STAR_2: {
        key: 'STAR_2',
        name: '二星店长',
        order: 4,
        discount: 0.7,
        monthlyReward: 300,
        monthlyBonus: 150,
        benefits: ['享受7折优惠', '专属客服支持', '每月赠送300通券', '店长营销权限', '团队管理权限'],
        upgradeRequires: { directCount: 5, teamSales: 15000 }
      },
      STAR_3: {
        key: 'STAR_3',
        name: '三星店长',
        order: 5,
        discount: 0.65,
        monthlyReward: 500,
        monthlyBonus: 250,
        benefits: ['享受6.5折优惠', '专属客服支持', '每月赠送500通券', '店长营销权限', '团队管理权限', '佣金提升权限'],
        upgradeRequires: { directCount: 10, teamSales: 30000 }
      },
      STAR_4: {
        key: 'STAR_4',
        name: '四星店长',
        order: 6,
        discount: 0.6,
        monthlyReward: 800,
        monthlyBonus: 400,
        benefits: ['享受6折优惠', '专属客服支持', '每月赠送800通券', '店长营销权限', '团队管理权限', '佣金提升权限', '区域营销权限'],
        upgradeRequires: { directCount: 15, teamSales: 50000 }
      },
      STAR_5: {
        key: 'STAR_5',
        name: '五星店长',
        order: 7,
        discount: 0.55,
        monthlyReward: 1200,
        monthlyBonus: 600,
        benefits: ['享受5.5折优惠', '专属客服支持', '每月赠送1200通券', '店长营销权限', '团队管理权限', '佣金提升权限', '区域营销权限', '品牌合作权限'],
        upgradeRequires: { directCount: 20, teamSales: 80000 }
      },
      DIRECTOR: {
        key: 'DIRECTOR',
        name: '董事',
        order: 8,
        discount: 0.5,
        monthlyReward: 2000,
        monthlyBonus: 1000,
        benefits: ['享受5折优惠', '专属客服支持', '每月赠送2000通券', '店长营销权限', '团队管理权限', '佣金提升权限', '区域营销权限', '品牌合作权限', '公司治理权限'],
        upgradeRequires: { directCount: 30, teamSales: 150000 }
      }
    }

    await prisma.systemConfigs.create({
      data: {
        id: `USER_LEVEL_SYSTEM_${Date.now()}`,
        key: 'USER_LEVEL_SYSTEM',
        value: JSON.stringify(levelSystemConfig),
        type: 'JSON' as systemConfigs_type,
        category: 'levels',
        description: '用户等级体系配置 - 包含8个等级的完整配置',
        isSystem: true,
        isEditable: true,
        updatedAt: new Date()
      }
    })

// [DEBUG REMOVED]     console.log('✅ 用户等级系统配置初始化完成')
  }

  /**
   * 更新用户等级配置
   */
  static async updateLevelConfig(levelConfigs: any, modifiedBy?: string): Promise<void> {
    await this.setConfig(
      'USER_LEVEL_SYSTEM',
      levelConfigs,
      'JSON',
      'levels',
      '用户等级体系配置',
      modifiedBy
    )
  }

  /**
   * 获取用户等级配置
   */
  static async getLevelConfig() {
    return await this.getConfig('USER_LEVEL_SYSTEM')
  }
}

export default SystemConfigService
