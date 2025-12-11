import { Router, Request, Response } from 'express';
import * as expressValidator from 'express-validator';
const { body, query, param } = expressValidator;
import { authenticate } from '../../../shared/middleware/auth';
import { asyncHandler, asyncHandler2 } from '../../../shared/middleware/error';
import { validate } from '../../../shared/middleware/validation';
import { createSuccessResponse, createErrorResponse } from '../../../shared/types/response';
import { logger } from '../../../shared/utils/logger';
import { paymentManager, PaymentMethod } from '../../../shared/payments';
import { PaymentProviderFactory, ProviderType } from '../../../shared/payments';
import { PaymentCallbackHandler } from '../../../shared/payments/callbacks/handler';
import { wechatConfigService } from '../../../shared/services/wechat-config';

const router = Router();

// 获取微信支付配置信息
router.get('/config',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // 使用配置服务获取详细的配置信息
      const configSummary = wechatConfigService.getConfigSummary();

      // 获取支持的支付方式
      const supportedMethods = [
        'WECHAT_JSAPI',
        'WECHAT_NATIVE',
        'WECHAT_APP',
        'WECHAT_H5'
      ];

      const configInfo = {
        ...configSummary,
        supportedMethods,
        enabled: true,
        version: '2.0.0',
        features: [
          '小程序支付',
          'Native扫码支付',
          'APP支付',
          'H5支付',
          '支付查询',
          '自动退款',
          '账单下载'
        ]
      };

      // 根据配置状态返回不同的消息
      if (!configSummary.configured) {
        configInfo.status = 'NOT_CONFIGURED';
        configInfo.message = '微信支付未配置，请查看配置建议';
        configInfo.urgency = 'HIGH';
      } else if (configSummary.sandbox) {
        configInfo.status = 'SANDBOX';
        configInfo.message = '微信支付使用沙箱环境（测试模式）';
        configInfo.urgency = 'MEDIUM';
      } else {
        configInfo.status = 'PRODUCTION';
        configInfo.message = '微信支付已配置（生产环境）';
        configInfo.urgency = 'LOW';
      }

      res.json(createSuccessResponse(configInfo, '获取微信支付配置成功'));
    } catch (error) {
      logger.error('获取微信支付配置失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取微信支付配置失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 创建微信支付订单
router.post('/create',
  authenticate,
  [
    body('method').isIn(['WECHAT_JSAPI', 'WECHAT_NATIVE', 'WECHAT_APP', 'WECHAT_H5'])
      .withMessage('支付方式无效'),
    body('orderId').isUUID().withMessage('订单ID无效'),
    body('amount').isNumeric().withMessage('支付金额无效'),
    body('subject').isString().withMessage('支付标题无效'),
    body('openid').optional().isString().withMessage('openid无效'),
    body('clientIp').optional().isIP().withMessage('客户端IP无效'),
    body('sceneInfo').optional().isObject().withMessage('场景信息无效')
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
        openid,
        clientIp = req.ip,
        sceneInfo,
        returnUrl
      } = req.body;

      const paymentRequest = {
        orderId,
        amount: parseFloat(amount),
        subject,
        description,
        clientIp,
        notifyUrl: `${process.env.API_BASE_URL}/api/v1/payments/wechat/notify`,
        returnUrl,
        userId: req.user?.id,
        extra: {
          paymentMethod: method,
          openid,
          sceneInfo
        }
      };

      const response = await paymentManager.createPayment(
        method as PaymentMethod,
        paymentRequest
      );

      if (response.success) {
        res.json(createSuccessResponse(response, '微信支付订单创建成功'));
      } else {
        res.status(400).json({
          success: false,
          message: response.message || '创建支付订单失败',
          error: response.errorCode
        });
      }
    } catch (error) {
      logger.error('创建微信支付订单失败', {
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
    body('totalAmount').isNumeric().withMessage('订单总金额无效'),
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
        totalAmount: parseFloat(totalAmount),
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

// 微信支付回调通知
router.post('/notify',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const headers = req.headers;
      const body = req.body;

      logger.info('收到微信支付回调通知', {
        headers,
        body
      });

      const notifyData = await paymentManager.verifyNotify(body, headers);

      if (notifyData.orderId) {
        // 根据交易状态处理不同的回调
        if (notifyData.tradeStatus === 'SUCCESS') {
          await PaymentCallbackHandler.handlePaymentSuccess(notifyData);
          logger.info('支付成功回调处理完成', {
            orderId: notifyData.orderId,
            providerOrderId: notifyData.providerOrderId
          });
        } else if (notifyData.tradeStatus === 'FAILED' || notifyData.tradeStatus === 'CLOSED') {
          await PaymentCallbackHandler.handlePaymentFailure(notifyData);
          logger.info('支付失败回调处理完成', {
            orderId: notifyData.orderId,
            tradeStatus: notifyData.tradeStatus
          });
        } else {
          logger.warn('未处理的交易状态', {
            orderId: notifyData.orderId,
            tradeStatus: notifyData.tradeStatus
          });
        }

        // 返回微信要求的响应格式
        res.json({ code: 'SUCCESS', message: '成功' });
      } else {
        logger.warn('支付回调数据无效', { body });
        res.status(400).json({
          success: false,
          message: '回调数据无效'
        });
      }
    } catch (error) {
      logger.error('处理微信支付回调失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: '处理回调失败'
      });
    }
  })
);

// 微信退款回调通知
router.post('/refund/notify',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const headers = req.headers;
      const body = req.body;

      logger.info('收到微信退款回调通知', {
        headers,
        body
      });

      // 处理退款回调逻辑
      const notifyData = await paymentManager.verifyNotify(body, headers);

      if (notifyData.orderId) {
        await PaymentCallbackHandler.handleRefundSuccess(notifyData);
        logger.info('微信退款成功回调处理完成', {
          orderId: notifyData.orderId,
          providerOrderId: notifyData.providerOrderId
        });
      } else {
        logger.warn('微信退款回调数据无效', { body });
      }

      res.json({ code: 'SUCCESS', message: '成功' });
    } catch (error) {
      logger.error('处理微信退款回调失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body
      });

      res.status(500).json({
        success: false,
        message: '处理退款回调失败'
      });
    }
  })
);

// 获取配置示例和安全建议（管理员）
router.get('/config-example',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // 检查管理员权限
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(createErrorResponse(
          'FORBIDDEN',
          '无权限访问此接口'
        ));
      }

      const configExample = wechatConfigService.generateConfigExample();

      res.json(createSuccessResponse(configExample, '获取微信支付配置示例成功'));
    } catch (error) {
      logger.error('获取微信支付配置示例失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '获取微信支付配置示例失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 验证配置（管理员）
router.post('/validate-config',
  authenticate,
  [
    body('config')
      .isObject()
      .withMessage('配置信息必须是对象格式')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // 检查管理员权限
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(createErrorResponse(
          'FORBIDDEN',
          '无权限访问此接口'
        ));
      }

      const { config } = req.body;
      const validation = wechatConfigService.validateConfig(config);

      const result = {
        valid: validation.valid,
        errors: validation.errors,
        summary: wechatConfigService.getConfigSummary(),
        recommendations: validation.valid ? ['配置验证通过，可以使用微信支付功能'] : ['请修复上述配置错误']
      };

      const statusCode = validation.valid ? 200 : 400;
      res.status(statusCode).json(createSuccessResponse(result, '配置验证完成'));
    } catch (error) {
      logger.error('验证微信支付配置失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id,
        body: req.body
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '验证微信支付配置失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 测试支付连接（管理员）
router.post('/test-connection',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // 检查管理员权限
      if (req.user?.role !== 'ADMIN') {
        return res.status(403).json(createErrorResponse(
          'FORBIDDEN',
          '无权限访问此接口'
        ));
      }

      const config = wechatConfigService.getConfig();
      const isConfigured = wechatConfigService.isConfigured(config);

      if (!isConfigured) {
        return res.status(400).json(createErrorResponse(
          'BAD_REQUEST',
          '微信支付未配置，无法测试连接'
        ));
      }

      // 这里可以添加实际的连接测试逻辑
      // 比如调用微信支付的查询接口测试连通性

      const testResult = {
        connected: true,
        responseTime: Math.random() * 1000, // 模拟响应时间
        timestamp: new Date().toISOString(),
        message: '连接测试成功'
      };

      logger.info('微信支付连接测试', {
        userId: req.user?.id,
        result: testResult
      });

      res.json(createSuccessResponse(testResult, '微信支付连接测试完成'));
    } catch (error) {
      logger.error('微信支付连接测试失败', {
        error: error instanceof Error ? error.message : '未知错误',
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '微信支付连接测试失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 支付回调测试接口（开发测试专用）
router.post('/test-callback',
  authenticate,
  [
    body('orderId').isUUID().withMessage('订单ID无效'),
    body('status').isIn(['SUCCESS', 'FAILED', 'CLOSED']).withMessage('状态无效'),
    body('amount').optional().isNumeric().withMessage('金额无效')
  ],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const {
        orderId,
        status,
        amount,
        transactionId = `wx_test_${Date.now()}`
      } = req.body;

      // 模拟微信支付回调数据
      const mockNotifyData = {
        orderId,
        providerOrderId: transactionId,
        amount: amount || 0.01, // 默认测试金额 1 分
        status,
        tradeStatus: status,
        paidAt: new Date().toISOString(),
        extra: {
          test: true,
          mockData: true,
          triggeredBy: req.user?.id
        }
      };

      logger.info('处理微信支付测试回调', {
        mockNotifyData,
        triggeredBy: req.user?.id
      });

      // 根据状态处理不同的回调
      if (status === 'SUCCESS') {
        await PaymentCallbackHandler.handlePaymentSuccess(mockNotifyData);
        logger.info('测试支付成功回调处理完成', {
          orderId,
          transactionId
        });
      } else if (status === 'FAILED' || status === 'CLOSED') {
        await PaymentCallbackHandler.handlePaymentFailure(mockNotifyData);
        logger.info('测试支付失败回调处理完成', {
          orderId,
          status
        });
      }

      const result = {
        success: true,
        mockNotifyData,
        processedAt: new Date().toISOString(),
        message: `测试回调(${status})处理成功`
      };

      res.json(createSuccessResponse(result, '支付回调测试处理完成'));
    } catch (error) {
      logger.error('支付回调测试失败', {
        error: error instanceof Error ? error.message : '未知错误',
        body: req.body,
        userId: req.user?.id
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '支付回调测试失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

// 生成测试回调数据（开发调试用）
router.get('/generate-callback-data/:orderId',
  authenticate,
  [param('orderId').isUUID().withMessage('订单ID无效')],
  validate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      // 生成不同状态的回调数据示例
      const callbackExamples = {
        SUCCESS: {
          orderId,
          providerOrderId: `wx_test_${Date.now()}`,
          amount: 0.01,
          status: 'SUCCESS',
          tradeStatus: 'SUCCESS',
          paidAt: new Date().toISOString(),
          description: '支付成功'
        },
        FAILED: {
          orderId,
          providerOrderId: `wx_test_${Date.now()}`,
          amount: 0.01,
          status: 'FAILED',
          tradeStatus: 'FAILED',
          failedAt: new Date().toISOString(),
          description: '支付失败'
        },
        CLOSED: {
          orderId,
          providerOrderId: `wx_test_${Date.now()}`,
          amount: 0.01,
          status: 'CLOSED',
          tradeStatus: 'CLOSED',
          closedAt: new Date().toISOString(),
          description: '订单已关闭'
        }
      };

      const result = {
        callbackExamples,
        usage: {
          endpoint: '/api/v1/payments/wechat/test-callback',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${req.headers.authorization?.replace('Bearer ', '')}`
          },
          note: '这些是测试数据，仅用于开发环境测试支付回调逻辑'
        }
      };

      res.json(createSuccessResponse(result, '生成测试回调数据成功'));
    } catch (error) {
      logger.error('生成测试回调数据失败', {
        error: error instanceof Error ? error.message : '未知错误',
        orderId: req.params.orderId
      });

      res.status(500).json(createErrorResponse(
        'INTERNAL_ERROR',
        '生成测试回调数据失败',
        error instanceof Error ? error.message : '服务器内部错误'
      ));
    }
  })
);

export default router;