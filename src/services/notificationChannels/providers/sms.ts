import { NotificationPayload, NotificationChannelResult } from '../index';

/**
 * 短信通知服务
 */
export class SMSNotificationService {
  private provider: string;
  private accessKey: string;
  private secretKey: string;
  private signName: string;

  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'aliyun'; // 默认使用阿里云短信
    this.accessKey = process.env.SMS_ACCESS_KEY || '';
    this.secretKey = process.env.SMS_SECRET_KEY || '';
    this.signName = process.env.SMS_SIGN_NAME || '中道商城';

    if (!this.accessKey || !this.secretKey) {
      console.warn('短信服务配置不完整，通知功能可能无法正常工作');
    }
  }

  /**
   * 发送短信通知
   */
  async send(payload: NotificationPayload): Promise<NotificationChannelResult> {
    try {
      // 获取收件人手机号
      const recipientPhone = await this.getUserPhone(payload.recipientId);

      if (!recipientPhone) {
        return {
          success: false,
          error: '用户未绑定手机号'
        };
      }

      // 构建短信内容
      const smsContent = this.buildSMSContent(payload);

      // 根据提供商发送短信
      let result;
      switch (this.provider) {
        case 'aliyun':
          result = await this.sendAliyunSMS(recipientPhone, smsContent);
          break;
        case 'tencent':
          result = await this.sendTencentSMS(recipientPhone, smsContent);
          break;
        default:
          result = await this.sendMockSMS(recipientPhone, smsContent);
      }

      return result;

    } catch (error) {
      console.error('短信发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '短信发送失败'
      };
    }
  }

  /**
   * 获取用户手机号
   */
  private async getUserPhone(userId: string): Promise<string | null> {
    try {
      // 这里应该从用户数据库获取手机号
      // 暂时返回模拟数据
      const userPhones = new Map([
        ['user1', '13800138000'],
        ['user2', '13900139000'],
        ['cmi4lsy0h0000ed7djczh4xd4', '18600186000'],
        ['cmi4n337o0001edbdcfz3rydn', '18600186001'],
        ['cmi4n75gl0003edz6x4qpk2em', '18600186002'],
        // 实际应该从数据库查询
      ]);

      return userPhones.get(userId) || null;
    } catch (error) {
      console.error('获取用户手机号失败:', error);
      return null;
    }
  }

  /**
   * 构建短信内容
   */
  private buildSMSContent(payload: NotificationPayload): {
    templateCode: string;
    templateParam: Record<string, string>;
  } {
    const { title, content, category, data } = payload;

    // 根据通知类别选择短信模板
    const templateMap: Record<string, string> = {
      'ORDER': 'SMS_ORDER_NOTICE',
      'PAYMENT': 'SMS_PAYMENT_SUCCESS',
      'LOGISTICS': 'SMS_LOGISTICS_NOTICE',
      'SYSTEM': 'SMS_SYSTEM_NOTICE',
      'PROMOTION': 'SMS_PROMOTION',
      'ANNOUNCEMENT': 'SMS_ANNOUNCEMENT',
      'SECURITY': 'SMS_SECURITY_ALERT',
      'FINANCIAL': 'SMS_FINANCIAL_NOTICE',
      'USER_LEVEL': 'SMS_LEVEL_UPGRADE',
      'ACTIVITY': 'SMS_ACTIVITY_REMINDER'
    };

    const templateCode = templateMap[category || 'SYSTEM'] || 'SMS_SYSTEM_NOTICE';

    // 构建模板参数
    const templateParam: Record<string, string> = {
      title: title.length > 20 ? title.substring(0, 20) + '...' : title,
      content: content.length > 50 ? content.substring(0, 50) + '...' : content,
      time: new Date().toLocaleString()
    };

    // 添加特定数据参数
    if (data) {
      if (data.orderCode) {
        templateParam.order_code = data.orderCode;
      }
      if (data.amount) {
        templateParam.amount = `¥${data.amount}`;
      }
      if (data.logisticsCompany) {
        templateParam.logistics_company = data.logisticsCompany;
      }
      if (data.trackingNumber) {
        templateParam.tracking_number = data.trackingNumber;
      }
    }

    return {
      templateCode,
      templateParam
    };
  }

  /**
   * 发送阿里云短信
   */
  private async sendAliyunSMS(
    phone: string,
    content: { templateCode: string; templateParam: Record<string, string> }
  ): Promise<NotificationChannelResult> {
    try {
      // 检查配置
      if (!this.accessKey || !this.secretKey) {
        return await this.sendMockSMS(phone, content);
      }

      // 构建请求参数
      const params = {
        PhoneNumbers: phone,
        SignName: this.signName,
        TemplateCode: content.templateCode,
        TemplateParam: JSON.stringify(content.templateParam)
      };

      // 这里应该调用阿里云短信API
      // 由于需要SDK和签名，这里先返回模拟结果
      console.log('阿里云短信发送参数:', params);

      // 模拟API调用
      const mockResponse = {
        Code: 'OK',
        Message: 'OK',
        BizId: '1234567890' + Date.now()
      };

      if (mockResponse.Code === 'OK') {
        return {
          success: true,
          messageId: mockResponse.BizId,
          metadata: {
            provider: 'aliyun',
            phone,
            templateCode: content.templateCode
          }
        };
      } else {
        return {
          success: false,
          error: `阿里云短信发送失败: ${mockResponse.Message}`
        };
      }

    } catch (error) {
      console.error('阿里云短信发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '阿里云短信发送失败'
      };
    }
  }

  /**
   * 发送腾讯云短信
   */
  private async sendTencentSMS(
    phone: string,
    content: { templateCode: string; templateParam: Record<string, string> }
  ): Promise<NotificationChannelResult> {
    try {
      // 检查配置
      if (!this.accessKey || !this.secretKey) {
        return await this.sendMockSMS(phone, content);
      }

      // 构建请求参数
      const params = {
        PhoneNumberSet: [phone],
        TemplateID: content.templateCode.replace('SMS_', ''),
        SignName: this.signName,
        TemplateParamSet: Object.values(content.templateParam)
      };

      // 这里应该调用腾讯云短信API
      console.log('腾讯云短信发送参数:', params);

      // 模拟API调用
      const mockResponse = {
        Response: {
          RequestId: 'req-' + Date.now(),
          SendStatusSet: [{
            SerialNo: 'sms-' + Date.now(),
            PhoneNumber: phone,
            Fee: 1,
            SessionContext: '',
            Code: 'Ok',
            Message: 'send success'
          }]
        }
      };

      const sendResult = mockResponse.Response.SendStatusSet[0];
      if (sendResult.Code === 'Ok') {
        return {
          success: true,
          messageId: sendResult.SerialNo,
          metadata: {
            provider: 'tencent',
            phone,
            templateCode: content.templateCode,
            fee: sendResult.Fee
          }
        };
      } else {
        return {
          success: false,
          error: `腾讯云短信发送失败: ${sendResult.Message}`
        };
      }

    } catch (error) {
      console.error('腾讯云短信发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '腾讯云短信发送失败'
      };
    }
  }

  /**
   * 发送模拟短信（用于测试）
   */
  private async sendMockSMS(
    phone: string,
    content: { templateCode: string; templateParam: Record<string, string> }
  ): Promise<NotificationChannelResult> {
    try {
      // 模拟发送延迟
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('模拟短信发送:', {
        phone,
        signName: this.signName,
        template: content.templateCode,
        params: content.templateParam
      });

      return {
        success: true,
        messageId: 'mock_' + Date.now(),
        metadata: {
          provider: 'mock',
          phone,
          templateCode: content.templateCode,
          message: '模拟短信发送成功'
        }
      };

    } catch (error) {
      console.error('模拟短信发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '模拟短信发送失败'
      };
    }
  }

  /**
   * 发送验证码短信
   */
  async sendVerificationCode(phone: string, code: string, type: 'login' | 'register' | 'reset' = 'login'): Promise<NotificationChannelResult> {
    try {
      const templateMap: Record<string, string> = {
        'login': 'SMS_LOGIN_CODE',
        'register': 'SMS_REGISTER_CODE',
        'reset': 'SMS_RESET_CODE'
      };

      const content = {
        templateCode: templateMap[type],
        templateParam: {
          code,
          time: '5分钟' // 验证码有效期
        }
      };

      switch (this.provider) {
        case 'aliyun':
          return await this.sendAliyunSMS(phone, content);
        case 'tencent':
          return await this.sendTencentSMS(phone, content);
        default:
          return await this.sendMockSMS(phone, content);
      }

    } catch (error) {
      console.error('验证码短信发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '验证码短信发送失败'
      };
    }
  }

  /**
   * 发送营销短信
   */
  async sendMarketingSMS(
    phone: string,
    title: string,
    content: string,
    promotionalCode?: string
  ): Promise<NotificationChannelResult> {
    try {
      const templateContent = {
        templateCode: 'SMS_MARKETING',
        templateParam: {
          title,
          content,
          code: promotionalCode || '',
          time: new Date().toLocaleString()
        }
      };

      switch (this.provider) {
        case 'aliyun':
          return await this.sendAliyunSMS(phone, templateContent);
        case 'tencent':
          return await this.sendTencentSMS(phone, templateContent);
        default:
          return await this.sendMockSMS(phone, templateContent);
      }

    } catch (error) {
      console.error('营销短信发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '营销短信发送失败'
      };
    }
  }

  /**
   * 批量发送短信
   */
  async sendBulk(
    payloads: NotificationPayload[]
  ): Promise<NotificationChannelResult[]> {
    const results: NotificationChannelResult[] = [];

    for (const payload of payloads) {
      const result = await this.send(payload);
      results.push(result);

      // 避免发送过于频繁，添加延迟
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
  }

  /**
   * 验证短信模板
   */
  async validateTemplate(templateCode: string): Promise<boolean> {
    try {
      // 这里可以实现短信模板验证逻辑
      // 检查模板是否在服务商中存在且审核通过
      return true;
    } catch (error) {
      console.error('短信模板验证失败:', error);
      return false;
    }
  }

  /**
   * 获取短信发送统计
   */
  async getSendStatistics(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      // 从数据库统计短信发送情况
      return {
        total: 0,
        success: 0,
        failed: 0,
        cost: 0,
        provider: this.provider
      };
    } catch (error) {
      console.error('获取短信发送统计失败:', error);
      return null;
    }
  }

  /**
   * 检查手机号格式
   */
  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 格式化手机号
   */
  private formatPhoneNumber(phone: string): string {
    // 移除所有非数字字符
    const cleanPhone = phone.replace(/\D/g, '');

    // 验证格式
    if (!this.isValidPhoneNumber(cleanPhone)) {
      throw new Error('手机号格式不正确');
    }

    return cleanPhone;
  }
}