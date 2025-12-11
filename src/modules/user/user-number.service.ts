import { prisma } from '@/shared/database/client';
import { logger } from '@/shared/utils/logger';

/**
 * 用户编号服务
 * 用于生成和管理7位数用户编号
 * 编号规则：1000000-9999999，按注册时间顺序生成
 */
export class UserNumberService {
  private readonly START_NUMBER = 1000000;
  private readonly END_NUMBER = 9999999;

  /**
   * 为新用户生成唯一编号
   * @returns 7位数用户编号
   */
  async generateUserNumber(): Promise<string> {
    try {
      // 查找当前最大编号
      const maxUser = await prisma.users.findFirst({
        where: {
          userNumber: {
            not: null
          }
        },
        orderBy: {
          userNumber: 'desc'
        },
        select: {
          userNumber: true
        }
      });

      let nextNumber: number;
      if (maxUser && maxUser.userNumber) {
        const currentMax = parseInt(maxUser.userNumber, 10);
        nextNumber = currentMax + 1;
      } else {
        nextNumber = this.START_NUMBER;
      }

      // 检查是否超出范围
      if (nextNumber > this.END_NUMBER) {
        throw new Error('用户编号已用尽');
      }

      return nextNumber.toString();
    } catch (error) {
      logger.error('生成用户编号失败', { error });
      throw error;
    }
  }

  /**
   * 批量为已有用户生成编号
   * 按注册时间顺序分配编号
   */
  async batchGenerateUserNumbers(): Promise<void> {
    try {
      logger.info('开始批量生成用户编号...');

      // 获取所有没有编号的用户，按注册时间排序
      const usersWithoutNumber = await prisma.users.findMany({
        where: {
          userNumber: null
        },
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          id: true,
          createdAt: true
        }
      });

      if (usersWithoutNumber.length === 0) {
        logger.info('所有用户已分配编号');
        return;
      }

      logger.info(`找到 ${usersWithoutNumber.length} 个用户需要分配编号`);

      // 查找当前最大编号
      const maxUser = await prisma.users.findFirst({
        where: {
          userNumber: {
            not: null
          }
        },
        orderBy: {
          userNumber: 'desc'
        },
        select: {
          userNumber: true
        }
      });

      let currentNumber: number;
      if (maxUser && maxUser.userNumber) {
        currentNumber = parseInt(maxUser.userNumber, 10) + 1;
      } else {
        currentNumber = this.START_NUMBER;
      }

      // 批量更新用户编号
      for (const user of usersWithoutNumber) {
        if (currentNumber > this.END_NUMBER) {
          throw new Error('用户编号已用尽');
        }

        await prisma.users.update({
          where: {
            id: user.id
          },
          data: {
            userNumber: currentNumber.toString()
          }
        });

        currentNumber++;
      }

      logger.info(`成功为 ${usersWithoutNumber.length} 个用户分配编号`);
    } catch (error) {
      logger.error('批量生成用户编号失败', { error });
      throw error;
    }
  }

  /**
   * 根据用户编号查找用户
   * @param userNumber 用户编号
   * @returns 用户信息
   */
  async findUserByNumber(userNumber: string) {
    return prisma.users.findUnique({
      where: {
        userNumber
      }
    });
  }
}

export default new UserNumberService();
