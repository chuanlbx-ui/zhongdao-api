/**
 * 统一的角色检查工具
 * 防止硬编码和大小写不一致的问题
 */

export const ROLE_LEVELS = {
  NORMAL: 'NORMAL',
  VIP: 'VIP',
  STAR_1: 'STAR_1',
  STAR_2: 'STAR_2',
  STAR_3: 'STAR_3',
  STAR_4: 'STAR_4',
  STAR_5: 'STAR_5',
  DIRECTOR: 'DIRECTOR'
} as const;

export type UserRole = typeof ROLE_LEVELS[keyof typeof ROLE_LEVELS];

/**
 * 检查是否为管理员
 */
export const isDirector = (level: string): boolean => {
  return level === ROLE_LEVELS.DIRECTOR;
};

/**
 * 检查是否为VIP或以上级别
 */
export const isVipOrAbove = (level: string): boolean => {
  const levelOrder = [
    ROLE_LEVELS.NORMAL,
    ROLE_LEVELS.VIP,
    ROLE_LEVELS.STAR_1,
    ROLE_LEVELS.STAR_2,
    ROLE_LEVELS.STAR_3,
    ROLE_LEVELS.STAR_4,
    ROLE_LEVELS.STAR_5,
    ROLE_LEVELS.DIRECTOR
  ];

  const userLevelIndex = levelOrder.indexOf(level as UserRole);
  const vipIndex = levelOrder.indexOf(ROLE_LEVELS.VIP);

  return userLevelIndex >= vipIndex;
};

/**
 * 检查是否为星级店长或以上级别
 */
export const isStarOrAbove = (level: string): boolean => {
  const levelOrder = [
    ROLE_LEVELS.NORMAL,
    ROLE_LEVELS.VIP,
    ROLE_LEVELS.STAR_1,
    ROLE_LEVELS.STAR_2,
    ROLE_LEVELS.STAR_3,
    ROLE_LEVELS.STAR_4,
    ROLE_LEVELS.STAR_5,
    ROLE_LEVELS.DIRECTOR
  ];

  const userLevelIndex = levelOrder.indexOf(level as UserRole);
  const star1Index = levelOrder.indexOf(ROLE_LEVELS.STAR_1);

  return userLevelIndex >= star1Index;
};

/**
 * 检查用户是否具有最低要求的权限级别
 */
export const hasMinimumLevel = (userLevel: string, requiredLevel: string): boolean => {
  const levelOrder = [
    ROLE_LEVELS.NORMAL,
    ROLE_LEVELS.VIP,
    ROLE_LEVELS.STAR_1,
    ROLE_LEVELS.STAR_2,
    ROLE_LEVELS.STAR_3,
    ROLE_LEVELS.STAR_4,
    ROLE_LEVELS.STAR_5,
    ROLE_LEVELS.DIRECTOR
  ];

  const userLevelIndex = levelOrder.indexOf(userLevel as UserRole);
  const requiredLevelIndex = levelOrder.indexOf(requiredLevel as UserRole);

  return userLevelIndex >= requiredLevelIndex;
};

/**
 * 获取用户权限级别数值（用于比较）
 */
export const getLevelValue = (level: string): number => {
  const levelValues = {
    [ROLE_LEVELS.NORMAL]: 1,
    [ROLE_LEVELS.VIP]: 2,
    [ROLE_LEVELS.STAR_1]: 3,
    [ROLE_LEVELS.STAR_2]: 4,
    [ROLE_LEVELS.STAR_3]: 5,
    [ROLE_LEVELS.STAR_4]: 6,
    [ROLE_LEVELS.STAR_5]: 7,
    [ROLE_LEVELS.DIRECTOR]: 8
  };

  return levelValues[level as UserRole] || 0;
};