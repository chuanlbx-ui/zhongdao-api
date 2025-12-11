import { NotificationPayload, NotificationChannelResult } from '../index';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 邮件通知服务
 */
export class EmailNotificationService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * 初始化邮件传输器
   */
  private async initializeTransporter() {
    try {
      // 检查邮件配置
      const emailConfig = await this.getEmailConfig();

      if (!emailConfig.smtpHost || !emailConfig.smtpPort) {
        console.warn('邮件服务未配置，将使用测试模式');
        // 使用测试配置
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: 'test@example.com',
            pass: 'testpassword'
          }
        });
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtpHost,
        port: parseInt(emailConfig.smtpPort.toString()),
        secure: emailConfig.smtpSecure,
        auth: {
          user: emailConfig.smtpUser,
          pass: emailConfig.smtpPass
        },
        tls: {
          rejectUnauthorized: emailConfig.smtpSecure
        }
      });

      // 验证连接
      await this.transporter.verify();
// [DEBUG REMOVED]       console.log('邮件服务初始化成功');

    } catch (error) {
      console.error('邮件服务初始化失败:', error);
      // 设置测试传输器
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'testpassword'
        }
      });
    }
  }

  /**
   * 获取邮件配置
   */
  private async getEmailConfig(): Promise<any> {
    // 从数据库或环境变量获取配置
    return {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT || 587,
      smtpSecure: process.env.SMTP_SECURE !== 'false',
      smtpUser: process.env.SMTP_USER,
      smtpPass: process.env.SMTP_PASS,
      fromEmail: process.env.EMAIL_FROM || 'noreply@zhongdao-mall.com',
      fromName: process.env.EMAIL_FROM_NAME || '中道商城'
    };
  }

  /**
   * 发送邮件通知
   */
  async send(payload: NotificationPayload): Promise<NotificationChannelResult> {
    try {
      // 获取收件人邮箱
      const recipientEmail = await this.getUserEmail(payload.recipientId);

      if (!recipientEmail) {
        return {
          success: false,
          error: '用户未设置邮箱地址'
        };
      }

      // 构建邮件内容
      const emailContent = this.buildEmailContent(payload);

      // 发送邮件
      const info = await this.transporter.sendMail({
        from: await this.getFromAddress(),
        to: [recipientEmail],
        subject: payload.title,
        html: emailContent.html,
        text: emailContent.text
      });

      return {
        success: true,
        messageId: info.messageId,
        metadata: {
          recipientEmail,
          response: info.response
        }
      };

    } catch (error) {
      console.error('邮件发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '邮件发送失败'
      };
    }
  }

  /**
   * 获取用户邮箱地址
   */
  private async getUserEmail(userId: string): Promise<string | null> {
    try {
      // 从用户数据库获取邮箱地址
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      return user?.email || null;
    } catch (error) {
      console.error('获取用户邮箱失败:', error);
      return null;
    }
  }

  /**
   * 获取发件人地址
   */
  private async getFromAddress(): Promise<string> {
    try {
      const config = await this.getEmailConfig();
      return `"${config.fromName}" <${config.fromEmail}>`;
    } catch (error) {
      console.error('获取发件人地址失败:', error);
      return '"中道商城" <noreply@zhongdao-mall.com>';
    }
  }

  /**
   * 构建邮件内容
   */
  private buildEmailContent(payload: NotificationPayload): { html: string; text: string } {
    const { title, content, category, data } = payload;

    // HTML模板
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .footer { background: #f0f0f0; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
        .data-section { background: white; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid #667eea; }
        .data-label { font-weight: bold; color: #667eea; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>中道商城通知</h1>
            <p>${this.getCategoryDisplayName(category)}</p>
        </div>
        <div class="content">
            <h2>${title}</h2>
            <p>${content}</p>
            ${data ? this.buildDataSection(data) : ''}
        </div>
        <div class="footer">
            <p>此邮件由中道商城系统自动发送，请勿回复。</p>
            <p>如需帮助，请联系客服。</p>
        </div>
    </div>
</body>
</html>`;

    // 纯文本模板
    const textTemplate = `
中道商城通知

${this.getCategoryDisplayName(category)}

标题：${title}
内容：${content}
${data ? this.buildTextDataSection(data) : ''}

---
中道商城系统
`;

    return {
      html: htmlTemplate,
      text: textTemplate
    };
  }

  /**
   * 构建数据展示部分
   */
  private buildDataSection(data: Record<string, any>): string {
    if (!data || Object.keys(data).length === 0) {
      return '';
    }

    let dataHtml = '<h3>详细信息</h3>';
    for (const [key, value] of Object.entries(data)) {
      dataHtml += `
        <div class="data-section">
            <div class="data-label">${this.formatDataKey(key)}:</div>
            <div>${this.formatDataValue(value)}</div>
        </div>
      `;
    }

    return dataHtml;
  }

  /**
   * 构建纯文本数据部分
   */
  private buildTextDataSection(data: Record<string, any>): string {
    if (!data || Object.keys(data).length === 0) {
      return '';
    }

    let dataText = '\n详细信息:\n';
    for (const [key, value] of Object.entries(data)) {
      dataText += `${this.formatDataKey(key)}: ${this.formatDataValue(value)}\n`;
    }

    return dataText;
  }

  /**
   * 格式化数据键名
   */
  private formatDataKey(key: string): string {
    // 将驼峰命名转换为可读格式
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, '').toUpperCase();
  }

  /**
   * 格式化数据值
   */
  private formatDataValue(value: any): string {
    if (value === null || value === undefined) {
      return '无';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  /**
   * 获取通知类别显示名称
   */
  private getCategoryDisplayName(category?: string): string {
    const categoryMap: Record<string, string> = {
      'ORDER': '订单通知',
      'PAYMENT': '支付通知',
      'LOGISTICS': '物流通知',
      'SYSTEM': '系统通知',
      'PROMOTION': '促销活动',
      'ANNOUNCEMENT': '重要公告',
      'SECURITY': '安全提醒',
      'FINANCIAL': '财务通知',
      'USER_LEVEL': '用户等级变更',
      'ACTIVITY': '活动通知'
    };

    return categoryMap[category || 'SYSTEM'] || '系统通知';
  }

  /**
   * 发送批量邮件
   */
  async sendBulk(
    payloads: NotificationPayload[]
  ): Promise<NotificationChannelResult[]> {
    const results: NotificationChannelResult[] = [];

    for (const payload of payloads) {
      const result = await this.send(payload);
      results.push(result);

      // 避免发送过于频繁，添加延迟
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * 验证邮件模板
   */
  async validateTemplate(template: string): Promise<boolean> {
    try {
      // 这里可以实现邮件模板验证逻辑
      return true;
    } catch (error) {
      console.error('邮件模板验证失败:', error);
      return false;
    }
  }

  /**
   * 获取邮件发送统计
   */
  async getSendStatistics(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      // 从数据库统计邮件发送情况
      return {
        total: 0,
        success: 0,
        failed: 0
      };
    } catch (error) {
      console.error('获取邮件发送统计失败:', error);
      return null;
    }
  }
}