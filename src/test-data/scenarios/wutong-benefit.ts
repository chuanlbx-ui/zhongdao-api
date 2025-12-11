/**
 * 五通店权益场景生成器
 * 生成买10赠1权益相关的测试数据
 */

import { faker } from '@faker-js/faker';
import { PrismaClient, ShopType, OrderStatus, ProductStatus } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import type { WutongBenefitScenario } from '../types';

const prisma = new PrismaClient();

export class WutongBenefitScenarioGenerator {
  /**
   * 生成五通店权益场景数据
   * 包括开通五通店、买10赠1订单、赠品发放等
   */
  async generateScenario(): Promise<WutongBenefitScenario[]> {
    console.log('🎁 开始生成五通店权益场景数据...');

    const scenarios: WutongBenefitScenario[] = [];

    // 1. 获取已有的五通店用户
    const wutongShops = await prisma.shops.findMany({
      where: { shopType: ShopType.WUTONG },
      include: {
        user: true
      }
    });

    if (wutongShops.length === 0) {
      console.log('⚠️  未找到五通店，跳过权益场景生成');
      return scenarios;
    }

    console.log(`  找到 ${wutongShops.length} 个五通店`);

    // 2. 为每个五通店生成权益场景
    for (const shop of wutongShops) {
      // 生成3-5个符合条件的订单
      const orderCount = faker.number.int({ min: 3, max: 5 });

      // 获取参与活动的商品
      const products = await this.getParticipatingProducts();

      if (products.length === 0) {
        console.log(`⚠️  用户 ${shop.user.nickname} 无可参与活动的商品`);
        continue;
      }

      const scenarioOrders = [];
      const scenarioGifts = [];
      let totalSavings = 0;

      for (let i = 0; i < orderCount; i++) {
        // 随机选择商品
        const product = faker.helpers.arrayElement(products);
        const quantity = faker.number.int({ min: 10, max: 50 });
        const unitPrice = products.basePrice;

        // 创建订单
        const order = await prisma.orderss.create({
          data: {
            id: createId(),
            orderNo: `WT${Date.now()}${faker.string.numeric(4)}`,
            buyerId: shop.userId,
            totalAmount: unitPrice * quantity,
            discountAmount: 0,
            finalAmount: unitPrice * quantity,
            status: OrderStatus.DELIVERED,
            paymentStatus: 'PAID',
            deliveryStatus: 'DELIVERED',
            deliveryAddress: {
              name: shop.user.nickname,
              phone: shop.user.phone || '',
              address: shop.address || faker.location.streetAddress(),
              city: faker.location.city(),
              province: faker.location.state(),
              postalCode: faker.location.zipCode()
            },
            metadata: {
              wutong_benefit: true,
              qualifies_for_gift: true,
              bottles_purchased: quantity
            },
            createdAt: faker.date.past({ days: faker.number.int({ min: 1, max: 30 }) }),
            updatedAt: new Date()
          }
        });

        scenarioOrders.push(order);

        // 创建订单项
        await prisma.ordersItems.create({
          data: {
            id: createId(),
            orderId: order.id,
            productId: products.id,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
            specifications: products.specsifications
          }
        });

        // 计算赠品（每10瓶送1瓶）
        const freeQuantity = Math.floor(quantity / 10);

        if (freeQuantity > 0) {
          const giftValue = freeQuantity * unitPrice;
          totalSavings += giftValue;

          // 创建赠品记录
          const gift = {
            productId: products.id,
            productName: products.name,
            quantity: freeQuantity,
            unitPrice,
            totalValue: giftValue
          };
          scenarioGifts.push(gift);

          // 保存赠品记录到数据库
          await prisma.giftRecords.create({
            data: {
              id: createId(),
              userId: shop.userId,
              orderId: order.id,
              productId: products.id,
              quantity: freeQuantity,
              value: giftValue,
              type: 'WUTONG_BUY_TEN_GET_ONE',
              status: 'COMPLETED',
              metadata: {
                shopType: ShopType.WUTONG,
                reason: '买10赠1权益',
                originalQuantity: quantity,
                freeRatio: '1:10'
              },
              createdAt: order.createdAt,
              updatedAt: new Date()
            }
          });
        }
      }

      // 保存场景数据
      scenarios.push({
        userId: shop.userId,
        shopId: shop.id,
        orders: scenarioOrders,
        gifts: scenarioGifts,
        totalSavings
      });

      console.log(`  ✨ 用户 ${shop.user.nickname}: ${orderCount} 个订单, 节省 ¥${totalSavings.toFixed(2)}`);
    }

    console.log(`\n✅ 五通店权益场景生成完成！`);
    console.log(`  📊 总计: ${wutongShops.length} 个五通店, ${scenarios.length} 个场景`);
    console.log(`  💰 总节省金额: ¥${scenarios.reduce((sum, s) => sum + s.totalSavings, 0).toFixed(2)}`);

    return scenarios;
  }

  /**
   * 获取参与五通店权益活动的商品
   */
  private async getParticipatingProducts() {
    // 优先获取护肤品、保健品等高价商品
    const categories = await prisma.productsssCategories.findMany({
      where: {
        name: {
          in: ['护肤品', '保健品', '食品饮料', '美妆彩妆', '母婴用品']
        }
      }
    });

    const categoryIds = categories.map(c => c.id);

    return await prisma.productssss.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        basePrice: {
          gte: 300  // 只选择单价300元以上的商品
        },
        ...(categoryIds.length > 0 && {
          categoryId: {
            in: categoryIds
          }
        })
      },
      orderBy: {
        basePrice: 'desc'
      },
      take: 20
    });
  }

  /**
   * 创建五通店开通记录
   */
  async createWutongShopOpenings(count: number = 10) {
    console.log(`\n🏪 生成 ${count} 个五通店开通记录...`);

    // 获取符合条件的二星以上店长
    const eligibleUsers = await prisma.users.findMany({
      where: {
        level: {
          in: ['STAR_2', 'STAR_3', 'STAR_4', 'STAR_5']
        },
        hasWutongShop: false
      },
      take: count
    });

    for (const user of eligibleUsers) {
      // 创建五通店
      const shop = await prisma.shops.create({
        data: {
          id: createId(),
          userId: user.id,
          shopType: ShopType.WUTONG,
          shopName: `${user.nickname}的五通店`,
          shopLevel: 1,
          status: 'ACTIVE',
          contactName: user.nickname,
          contactPhone: user.phone || '',
          address: faker.location.streetAddress(),
          createdAt: faker.date.past({ days: 30 }),
          updatedAt: new Date()
        }
      });

      // 更新用户五通店状态
      await prisma.users.update({
        where: { id: user.id },
        data: { hasWutongShop: true }
      });

      // 直接升级为二星店长（如果不是二星以上）
      if (user.level !== 'STAR_2' && user.level !== 'DIRECTOR') {
        const oldLevel = user.level;
        await prisma.users.update({
          where: { id: user.id },
          data: { level: 'STAR_2' }
        });

        // 记录升级记录
        await prisma.levelUpgradeRecords.create({
          data: {
            id: createId(),
            userId: user.id,
            previousLevel: oldLevel,
            newLevel: 'STAR_2',
            upgradeType: 'WUTONG_PRIVILEGE',
            approvedById: 'system',
            metadata: {
              reason: '五通店开通特权',
              shopId: shop.id
            },
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      console.log(`  ✅ ${user.nickname} 开通五通店`);
    }

    console.log(`\n✅ 已创建 ${eligibleUsers.length} 个五通店开通记录`);
  }

  /**
   * 生成赠品发放统计数据
   */
  async generateGiftStatistics() {
    console.log('\n📊 生成赠品发放统计...');

    const stats = await prisma.giftRecords.groupBy({
      by: ['type'],
      where: {
        type: 'WUTONG_BUY_TEN_GET_ONE'
      },
      _count: {
        id: true
      },
      _sum: {
        quantity: true,
        value: true
      }
    });

    console.log('\n赠品发放统计：');
    stats.forEach(stat => {
      console.log(`  ${stat.type}:`);
      console.log(`    - 发放次数: ${stat._count.id}`);
      console.log(`    - 赠品总数: ${stat._sum.quantity || 0}`);
      console.log(`    - 总价值: ¥${(stat._sum.value || 0).toFixed(2)}`);
    });

    return stats;
  }
}

// 导出默认实例
export const wutongBenefitGenerator = new WutongBenefitScenarioGenerator();