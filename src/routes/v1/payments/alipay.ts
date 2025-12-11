import { Router, Request, Response } from 'express';
import { body, query, param } from 'express-validator';
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { paymentManager, PaymentMethod } from '../../../shared/payments';
import { PaymentProviderFactory, ProviderType } from '../../../shared/payments';
import { PaymentCallbackHandler } from '../../../shared/payments/callbacks/handler';

const router = Router();

// 获取支付宝支付配置信息
router.get('/config',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const provider = paymentManager.getProvider(ProviderType.ALIPAY);

      if (!provider) {
        return res.status(400).json({
          success: false,
          message: '支付宝支付未配置'
        });
      }

      const supportedMethods = provider.getSupportedMethods();

      res.json(createSuccessResponse({
        enabled: true,
        supportedMethods,
        sandbox: process.env.NODE_ENV === 'development'
      }, '获取支付宝支付配置成功'));
    } catch (error) {
      logger.error('获取支付宝支付配置失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });

      res.status(500).json({
        success: false,
        message: '获取支付宝支付配置失败'
      });
    }
  })
);

// 创建支付宝支付订单
router.post('/create',
  authenticate,
  [
    body('method').isIn(['ALIPAY_WEB', 'ALIPAY_WAP', 'ALIPAY_APP', 'ALIPAY_QR'])
      .withMessage('支付方式无效'),
    body('orderId').isUUID().withMessage('订单ID无效'),
    body('amount').isNumeric().withMessage('支付金额无效'),
    body('subject').isString().withMessage('支付标题无效'),
    body('clientIp').optional().isIP().withMessage('客户端IP无效'),
    body('quitUrl').optional().isURL().withMessage('退出链接无效'),
    body('timeoutExpress').optional().isString().withMessage('超时时间格式无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const {
        method,
        orderId,
        amount,
        subject,
        description,
        clientIp = req.ip,
        returnUrl,
        quitUrl,
        timeoutExpress
      } = req.body;

      const paymentRequest = {
        orderId,
        amount: parseFloat(amount),
        subject,
        description,
        clientIp,
        notifyUrl: `${process.env.API_BASE_URL}/api/v1/payments/alipay/notify`,
        returnUrl,
        userId: req.user?.id,
        extra: {
          paymentMethod: method,
          quitUrl,
          timeoutExpress
        }
      };

      const response = await paymentManager.createPayment(
        method as PaymentMethod,
        paymentRequest
      );

      if (response.success) {
        res.json(createSuccessResponse(response, '支付宝支付订单创建成功'));
      } else {
        res.status(400).json({
          success: false,
          message: response.message || '创建支付订单失败',
          error: response.errorCode
        });
      }
    } catch (error) {
      logger.error('创建支付宝支付订单失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: '创建支付订单失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

// 查询支付状态
router.get('/query/:orderId',
  authenticate,
  [param('orderId').isUUID().withMessage('订单ID无效')],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      const response = await paymentManager.queryPayment(orderId);

      res.json(createSuccessResponse(response, '查询支付状态成功'));
    } catch (error) {
      logger.error('查询支付状态失败', {
        error: error instanceof Error ? error.message : '未知错误',
        orderId: req.params.orderId
      });

      res.status(500).json({
        success: false,
        message: '查询支付状态失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

// 关闭支付订单
router.post('/close/:orderId',
  authenticate,
  [param('orderId').isUUID().withMessage('订单ID无效')],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      const success = await paymentManager.closePayment(orderId);

      res.json(createSuccessResponse({ success }, '关闭支付订单成功'));
    } catch (error) {
      logger.error('关闭支付订单失败', {
        error: error instanceof Error ? error.message : '未知错误',
        orderId: req.params.orderId
      });

      res.status(500).json({
        success: false,
        message: '关闭支付订单失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

// 申请退款
router.post('/refund',
  authenticate,
  [
    body('orderId').isUUID().withMessage('订单ID无效'),
    body('refundAmount').isNumeric().withMessage('退款金额无效'),
    body('reason').optional().isString().withMessage('退款原因无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const {
        orderId,
        refundAmount,
        totalAmount,
        reason
      } = req.body;

      const refundRequest = {
        orderId,
        refundAmount: parseFloat(refundAmount),
        totalAmount: parseFloat(totalAmount) || parseFloat(refundAmount),
        reason
      };

      const response = await paymentManager.createRefund(refundRequest);

      if (response.success) {
        res.json(createSuccessResponse(response, '退款申请成功'));
      } else {
        res.status(400).json({
          success: false,
          message: response.message || '退款申请失败',
          error: response.errorCode
        });
      }
    } catch (error) {
      logger.error('申请退款失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: '申请退款失败',
        error: error instanceof Error ? error.message : '服务器内部错误'
      });
    }
  })
);

// 支付宝支付回调通知
router.post('/notify',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const body = req.body;

      logger.info('收到支付宝支付回调通知', {
        body
      });

      const notifyData = await paymentManager.verifyNotify(body);

      if (notifyData.orderId) {
        // 根据交易状态处理不同的回调
        if (notifyData.tradeStatus === 'TRADE_SUCCESS' || notifyData.tradeStatus === 'TRADE_FINISHED') {
          await PaymentCallbackHandler.handlePaymentSuccess(notifyData);
          logger.info('支付宝支付成功回调处理完成', {
            orderId: notifyData.orderId,
            providerOrderId: notifyData.providerOrderId
          });
        } else if (notifyData.tradeStatus === 'TRADE_CLOSED') {
          await PaymentCallbackHandler.handlePaymentFailure(notifyData);
          logger.info('支付宝支付失败回调处理完成', {
            orderId: notifyData.orderId,
            tradeStatus: notifyData.tradeStatus
          });
        } else {
          logger.warn('未处理的支付宝交易状态', {
            orderId: notifyData.orderId,
            tradeStatus: notifyData.tradeStatus
          });
        }

        // 返回支付宝要求的响应格式
        res.send('success');
      } else {
        logger.warn('支付宝支付回调数据无效', { body });
        res.status(400).send('fail');
      }
    } catch (error) {
      logger.error('处理支付宝支付回调失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body
      });

      res.status(500).send('fail');
    }
  })
);

// 支付宝退款回调通知
router.post('/refund/notify',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const body = req.body;

      logger.info('收到支付宝退款回调通知', {
        body
      });

      // 处理退款回调逻辑
      const notifyData = await paymentManager.verifyNotify(body);

      if (notifyData.orderId) {
        await PaymentCallbackHandler.handleRefundSuccess(notifyData);
        logger.info('支付宝退款成功回调处理完成', {
          orderId: notifyData.orderId,
          providerOrderId: notifyData.providerOrderId
        });
      } else {
        logger.warn('支付宝退款回调数据无效', { body });
      }

      res.send('success');
    } catch (error) {
      logger.error('处理支付宝退款回调失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body
      });

      res.status(500).send('fail');
    }
  })
);

export default router;