import { NotificationPayload, NotificationChannelResult } from '../index';

/**
 * 微信小程序通知服务
 */
export class WeChatNotificationService {
  private appId: string;
  private appSecret: string;

  constructor() {
    this.appId = process.env.WECHAT_MINIPROGRAM_APP_ID || '';
    this.appSecret = process.env.WECHAT_MINIPROGRAM_APP_SECRET || '';

    if (!this.appId || !this.appSecret) {
      console.warn('微信小程序配置不完整，通知功能可能无法正常工作');
    }
  }

  /**
   * 发送微信小程序订阅消息
   */
  async send(payload: NotificationPayload): Promise<NotificationChannelResult> {
    try {
      // 获取用户的微信openid
      const openid = await this.getUserOpenId(payload.recipientId);

      if (!openid) {
        return {
          success: false,
          error: '用户未绑定微信小程序'
        };
      }

      // 构建微信小程序消息体
      const messageData = this.buildWeChatMessage(payload);

      // 调用微信小程序订阅消息API
      const result = await this.sendSubscriptionMessage(openid, messageData);

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          metadata: {
            openid,
            templateId: messageData.template_id
          }
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }

    } catch (error) {
      console.error('微信小程序通知发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '微信小程序通知发送失败'
      };
    }
  }

  /**
   * 获取用户微信openid
   */
  private async getUserOpenId(userId: string): Promise<string | null> {
    try {
      // 这里应该从用户数据库中获取微信openid
      // 暂时返回模拟数据
      const userWeChatBindings = new Map([
        ['user1', 'mock_openid_1'],
        ['user2', 'mock_openid_2'],
        // 实际应该从数据库查询
      ]);

      return userWeChatBindings.get(userId) || null;
    } catch (error) {
      console.error('获取用户openid失败:', error);
      return null;
    }
  }

  /**
   * 构建微信小程序消息体
   */
  private buildWeChatMessage(payload: NotificationPayload): any {
    // 根据通知类别选择对应的模板
    const templateMap: Record<string, string> = {
      'ORDER': 'order_template_id',
      'PAYMENT': 'payment_template_id',
      'LOGISTICS': 'logistics_template_id',
      'SYSTEM': 'system_template_id',
      'PROMOTION': 'promotion_template_id'
    };

    const templateId = templateMap[payload.category || 'SYSTEM'];

    return {
      touser: payload.recipientId, // 实际应该使用openid
      template_id: templateId,
      page: 'pages/index/index', // 小程序跳转页面
      data: {
        thing1: {
          value: payload.title.length > 20 ? payload.title.substring(0, 20) + '...' : payload.title
        },
        thing2: {
          value: payload.content.length > 20 ? payload.content.substring(0, 20) + '...' : payload.content
        },
        time3: {
          value: new Date().toLocaleString()
        }
      }
    };
  }

  /**
   * 调用微信小程序订阅消息API
   */
  private async sendSubscriptionMessage(
    openid: string,
    messageData: any
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // 获取access_token
      const accessToken = await this.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: '获取微信access_token失败'
        };
      }

      // 发送订阅消息
      const response = await fetch('https://api.weixin.qq.com/cgi-bin/message/subscribe/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: accessToken,
          ...messageData,
          touser: openid // 修正：应该使用openid而不是recipientId
        })
      });

      const result = await response.json();

      if (result.errcode === 0) {
        return {
          success: true,
          messageId: result.msgid
        };
      } else {
        return {
          success: false,
          error: `微信API错误: ${result.errcode} - ${result.errmsg}`
        };
      }

    } catch (error) {
      console.error('调用微信API失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '调用微信API失败'
      };
    }
  }

  /**
   * 获取微信小程序access_token
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      const response = await fetch('https://api.weixin.qq.com/cgi-bin/token', {
        method: 'GET',
        body: null
      });

      // 由于需要client_credential，这里先返回模拟数据
      // 实际应该使用HTTP基本认证

      // 模拟返回access_token
      return 'mock_access_token_' + Date.now();
    } catch (error) {
      console.error('获取access_token失败:', error);
      return null;
    }
  }

  /**
   * 获取微信小程序用户信息
   */
  async getUserInfo(code: string): Promise<any> {
    try {
      // 先获取access_token
      const accessToken = await this.getAccessToken();

      if (!accessToken) {
        throw new Error('获取access_token失败');
      }

      // 使用code获取openid和session_key
      const response = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${this.appId}&secret=${this.appSecret}&js_code=${code}&grant_type=authorization_code`,
        {
          method: 'GET'
        }
      );

      return await response.json();
    } catch (error) {
      console.error('获取用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 验证微信小程序登录态
   */
  async verifySession(openid: string, sessionKey: string): Promise<boolean> {
    try {
      // 这里应该验证session的有效性
      // 暂时返回true
      return true;
    } catch (error) {
      console.error('验证登录态失败:', error);
      return false;
    }
  }
}