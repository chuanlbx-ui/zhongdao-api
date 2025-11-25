/**
 * 五通店API控制器
 * 提供五通店特殊业务逻辑的HTTP接口
 */

import { Request, Response } from 'express';
import { wutongService, shopService } from './wutong.service';
import { logger } from '../../shared/utils/logger';

/**
 * 五通店控制器类
 */
export class WutongController {
  /**
   * 验证用户五通店资格
   */
  async validateQualification(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        });
      }

      const qualification = await wutongService.validateWutongQualification(userId);

      res.json({
        success: true,
        data: qualification,
        message: qualification.canUseBenefits ? '您享有五通店权益' : '您还未开通五通店'
      });
    } catch (error) {
      logger.error('验证五通店资格失败', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        message: '验证资格失败，请稍后重试'
      });
    }
  }

  /**
   * 计算买10赠1权益
   */
  async calculateBenefit(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        });
      }

      const { cartItems } = req.body;

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: '购物车商品不能为空'
        });
      }

      // 验证购物车数据格式
      const validCartItems = cartItems.filter(item =>
        item.productId &&
        item.productName &&
        typeof item.quantity === 'number' &&
        typeof item.unitPrice === 'number' &&
        item.quantity > 0 &&
        item.unitPrice > 0
      );

      if (validCartItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: '购物车数据格式不正确'
        });
      }

      const result = await wutongService.calculateWutongBenefit(userId, validCartItems);

      res.json({
        success: true,
        data: result,
        message: result.qualifies ? '恭喜您获得赠品！' : result.message
      });
    } catch (error) {
      logger.error('计算五通店权益失败', {
        userId: req.user?.id,
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        message: '计算权益失败，请稍后重试'
      });
    }
  }

  /**
   * 开通五通店
   */
  async openWutongShop(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        });
      }

      const { contactName, contactPhone, address } = req.body;

      // 基本参数验证
      if (!contactName || !contactPhone) {
        return res.status(400).json({
          success: false,
          message: '联系人姓名和电话不能为空'
        });
      }

      // 手机号格式验证
      if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
        return res.status(400).json({
          success: false,
          message: '请输入有效的手机号码'
        });
      }

      const result = await wutongService.openWutongShopWithUpgrade(userId, {
        contactName,
        contactPhone,
        address
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            shopId: result.shopId,
            previousLevel: result.previousLevel,
            newLevel: result.newLevel,
            benefits: result.benefits
          },
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      logger.error('开通五通店失败', {
        userId: req.user?.id,
        body: req.body,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        message: '开通五通店失败，请稍后重试'
      });
    }
  }

  /**
   * 获取五通店统计数据
   */
  async getStatistics(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: '用户未登录'
        });
      }

      const statistics = await wutongService.getWutongStatistics(userId);

      res.json({
        success: true,
        data: statistics,
        message: '获取统计数据成功'
      });
    } catch (error) {
      logger.error('获取五通店统计失败', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        message: '获取统计数据失败，请稍后重试'
      });
    }
  }

  /**
   * 获取五通店权益说明
   */
  async getBenefitsInfo(req: Request, res: Response) {
    try {
      const benefits = wutongService.getWutongBenefits();

      res.json({
        success: true,
        data: {
          benefits,
          entryFee: 27000,
          giftThreshold: 5999,
          giftValue: 599,
          giftRatio: '买10赠1'
        },
        message: '获取权益信息成功'
      });
    } catch (error) {
      logger.error('获取五通店权益信息失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        message: '获取权益信息失败，请稍后重试'
      });
    }
  }

  /**
   * 模拟支付确认（仅用于开发测试）
   */
  async simulatePaymentConfirmation(req: Request, res: Response) {
    try {
      const { shopId } = req.params;

      if (!shopId) {
        return res.status(400).json({
          success: false,
          message: '店铺ID不能为空'
        });
      }

      const result = await shopService.confirmWutongShopPayment(shopId);

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message
        });
      }
    } catch (error) {
      logger.error('模拟支付确认失败', {
        shopId: req.params.shopId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        message: '支付确认失败，请稍后重试'
      });
    }
  }
}

// 导出控制器实例
export const wutongController = new WutongController();