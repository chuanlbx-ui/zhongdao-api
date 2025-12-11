/**
 * 支付签名验证服务
 * 提供微信支付和支付宝的签名验证功能
 */

import crypto from 'crypto';
import { logger } from '../../utils/logger';

/**
 * 微信支付签名验证器
 */
export class WeChatPaySignatureVerifier {
  private apiV3Key: string;
  private platformPublicKey?: string;

  constructor(apiV3Key: string, platformPublicKey?: string) {
    this.apiV3Key = apiV3Key;
    this.platformPublicKey = platformPublicKey;
  }

  /**
   * 验证微信支付回调签名
   */
  async verifyNotifySignature(
    headers: Record<string, string>,
    body: string
  ): Promise<boolean> {
    try {
      const signature = headers['wechatpay-signature'] || headers['Wechatpay-Signature'];
      const timestamp = headers['wechatpay-timestamp'] || headers['Wechatpay-Timestamp'];
      const nonce = headers['wechatpay-nonce'] || headers['Wechatpay-Nonce'];
      const serial = headers['wechatpay-serial'] || headers['Wechatpay-Serial'];

      if (!signature || !timestamp || !nonce) {
        logger.error('微信支付回调缺少必要的签名信息', { headers });
        return false;
      }

      // 验证时间戳（防止重放攻击）
      const now = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp);
      if (Math.abs(now - requestTime) > 300) { // 5分钟有效期
        logger.error('微信支付回调时间戳过期', { timestamp, now });
        return false;
      }

      // 构建验证字符串
      const message = `${timestamp}\n${nonce}\n${body}\n`;

      // 验证签名
      if (this.platformPublicKey) {
        return this.verifyRSASignature(message, signature, this.platformPublicKey);
      } else {
        // 如果没有平台公钥，使用API密钥验证（旧版本API）
        return this.verifyHMACSignature(body, signature);
      }
    } catch (error) {
      logger.error('验证微信支付签名失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 验证RSA签名
   */
  private verifyRSASignature(message: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(message);
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      logger.error('RSA签名验证失败', { error: error.message });
      return false;
    }
  }

  /**
   * 验证HMAC签名（兼容旧版本）
   */
  private verifyHMACSignature(data: string, signature: string): boolean {
    try {
      // 解析XML数据（微信支付旧版本使用XML）
      const parsedData = this.parseXMLToJSON(data);
      if (!parsedData || !parsedData.sign) {
        return false;
      }

      // 构建待签名字符串
      const signStr = this.buildSignString(parsedData);
      const calculatedSign = crypto
        .createHmac('sha256', this.apiV3Key)
        .update(signStr, 'utf8')
        .digest('hex')
        .toUpperCase();

      return calculatedSign === signature;
    } catch (error) {
      logger.error('HMAC签名验证失败', { error: error.message });
      return false;
    }
  }

  /**
   * 解析XML为JSON（简单实现）
   */
  private parseXMLToJSON(xml: string): any {
    try {
      const xml2js = require('xml2js');
      let result: any = {};
      const parser = new xml2js.Parser({ explicitArray: false });
      parser.parseString(xml, (err: any, data: any) => {
        if (!err && data && data.xml) {
          result = data.xml;
        }
      });
      return result;
    } catch (error) {
      // 如果没有xml2js，返回null
      return null;
    }
  }

  /**
   * 构建签名字符串
   */
  private buildSignString(data: any): string {
    const keys = Object.keys(data)
      .filter(key => key !== 'sign' && data[key] !== undefined && data[key] !== '')
      .sort();

    const signPairs = keys.map(key => `${key}=${data[key]}`);
    return signPairs.join('&') + `&key=${this.apiV3Key}`;
  }
}

/**
 * 支付宝签名验证器
 */
export class AlipaySignatureVerifier {
  private alipayPublicKey: string;

  constructor(alipayPublicKey: string) {
    this.alipayPublicKey = this.formatPublicKey(alipayPublicKey);
  }

  /**
   * 验证支付宝回调签名
   */
  async verifyNotifySignature(params: Record<string, string>): Promise<boolean> {
    try {
      const sign = params.sign;
      const signType = params.sign_type || 'RSA2';

      if (!sign) {
        logger.error('支付宝回调缺少签名', { params });
        return false;
      }

      // 过滤空值和sign字段
      const filteredParams = this.filterParams(params);

      // 构建待签名字符串
      const signString = this.buildSignString(filteredParams);

      // 验证签名
      if (signType === 'RSA2') {
        return this.verifyRSA2Signature(signString, sign);
      } else if (signType === 'RSA') {
        return this.verifyRSASignature(signString, sign);
      }

      logger.error('不支持的签名类型', { signType });
      return false;
    } catch (error) {
      logger.error('验证支付宝签名失败', {
        error: error instanceof Error ? error.message : '未知错误'
      });
      return false;
    }
  }

  /**
   * 过滤参数
   */
  private filterParams(params: Record<string, string>): Record<string, string> {
    const filtered: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
      // 过滤空值和特殊字段
      if (value &&
          key !== 'sign' &&
          key !== 'sign_type' &&
          key !== 'code' &&
          key !== 'msg' &&
          key !== 'bussiness_id') {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * 构建签名字符串
   */
  private buildSignString(params: Record<string, string>): string {
    const keys = Object.keys(params).sort();
    const pairs = keys.map(key => `${key}=${params[key]}`);
    return pairs.join('&');
  }

  /**
   * 验证RSA2签名
   */
  private verifyRSA2Signature(signString: string, signature: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(signString, 'utf8');
      return verify.verify(this.alipayPublicKey, signature, 'base64');
    } catch (error) {
      logger.error('RSA2签名验证失败', { error: error.message });
      return false;
    }
  }

  /**
   * 验证RSA签名
   */
  private verifyRSASignature(signString: string, signature: string): boolean {
    try {
      const verify = crypto.createVerify('SHA1WithRSA');
      verify.update(signString, 'utf8');
      return verify.verify(this.alipayPublicKey, signature, 'base64');
    } catch (error) {
      logger.error('RSA签名验证失败', { error: error.message });
      return false;
    }
  }

  /**
   * 格式化公钥
   */
  private formatPublicKey(publicKey: string): string {
    // 移除换行符和空格
    let formattedKey = publicKey.replace(/[\r\n\s]/g, '');

    // 添加头尾标记
    if (!formattedKey.includes('-----BEGIN')) {
      if (formattedKey.startsWith('MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE')) {
        formattedKey = `-----BEGIN PUBLIC KEY-----\n${formattedKey.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
      } else {
        formattedKey = `-----BEGIN RSA PUBLIC KEY-----\n${formattedKey.match(/.{1,64}/g)?.join('\n')}\n-----END RSA PUBLIC KEY-----`;
      }
    }

    return formattedKey;
  }
}

/**
 * 签名验证工厂类
 */
export class SignatureVerifierFactory {
  private static wechatVerifier?: WeChatPaySignatureVerifier;
  private static alipayVerifier?: AlipaySignatureVerifier;

  /**
   * 获取微信支付签名验证器
   */
  static getWeChatVerifier(): WeChatPaySignatureVerifier {
    if (!this.wechatVerifier) {
      this.wechatVerifier = new WeChatPaySignatureVerifier(
        process.env.WECHAT_API_V3_KEY || '',
        process.env.WECHAT_PLATFORM_PUBLIC_KEY
      );
    }
    return this.wechatVerifier;
  }

  /**
   * 获取支付宝签名验证器
   */
  static getAlipayVerifier(): AlipaySignatureVerifier {
    if (!this.alipayVerifier) {
      if (!process.env.ALIPAY_PUBLIC_KEY) {
        throw new Error('支付宝公钥未配置');
      }
      this.alipayVerifier = new AlipaySignatureVerifier(process.env.ALIPAY_PUBLIC_KEY);
    }
    return this.alipayVerifier;
  }

  /**
   * 重置验证器（用于测试）
   */
  static reset(): void {
    this.wechatVerifier = undefined;
    this.alipayVerifier = undefined;
  }
}

/**
 * 便捷函数
 */
export async function verifyWeChatPaySignature(
  headers: Record<string, string>,
  body: string
): Promise<boolean> {
  const verifier = SignatureVerifierFactory.getWeChatVerifier();
  return verifier.verifyNotifySignature(headers, body);
}

export async function verifyAlipaySignature(
  params: Record<string, string>
): Promise<boolean> {
  const verifier = SignatureVerifierFactory.getAlipayVerifier();
  return verifier.verifyNotifySignature(params);
}