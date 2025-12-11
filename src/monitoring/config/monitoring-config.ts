/**
 * 监控系统配置
 * 支持多环境配置和动态调整
 */

import { config } from '../../config';

export interface MonitoringConfig {
  // 基础配置
  enabled: boolean;
  environment: 'development' | 'staging' | 'production';

  // 性能监控配置
  performance: {
    // 响应时间阈值（毫秒）
    thresholds: {
      fast: number;        // < 50ms
      normal: number;      // 50-200ms
      slow: number;        // 200-500ms
      verySlow: number;    // 500-1000ms
      critical: number;    // > 1000ms
    };

    // 采样配置
    sampling: {
      baseSampleRate: number;        // 基础采样率
      fastSampleRate: number;        // 快速请求采样率
      normalSampleRate: number;      // 正常请求采样率
      slowSampleRate: number;        // 慢请求采样率
      verySlowSampleRate: number;    // 很慢请求采样率
      criticalSampleRate: number;    // 严重请求采样率
      errorRateThreshold: number;    // 错误率阈值
      errorRateWindow: number;       // 错误率窗口
    };

    // 内存阈值（MB）
    memory: {
      warning: number;
      critical: number;
    };

    // 环形缓冲区配置
    ringBufferSize: number;

    // 批量写入配置
    batchWrite: {
      enabled: boolean;
      interval: number;   // 毫秒
      maxSize: number;
    };
  };

  // 业务指标配置
  business: {
    // 统计窗口（分钟）
    windows: {
      realtime: number;    // 5分钟
      hourly: number;      // 60分钟
      daily: number;       // 1440分钟
    };

    // 数据保留期（天）
    retention: {
      metrics: number;     // 指标数据
      alerts: number;      // 告警数据
      logs: number;        // 日志数据
    };

    // 聚合配置
    aggregation: {
      interval: number;    // 聚合间隔（秒）
      batchSize: number;   // 批量大小
    };
  };

  // 系统监控配置
  system: {
    // 系统指标收集间隔
    collectInterval: number;  // 毫秒

    // CPU阈值
    cpu: {
      warning: number;    // 百分比
      critical: number;
    };

    // 内存阈值
    memory: {
      warning: number;    // 百分比
      critical: number;
    };

    // 磁盘阈值
    disk: {
      warning: number;    // 百分比
      critical: number;
    };

    // 网络监控
    network: {
      enabled: boolean;
      bandwidthThreshold: number;  // Mbps
    };

    // 数据库连接池监控
    database: {
      connectionThreshold: number;   // 连接数阈值
      queryTimeThreshold: number;    // 查询时间阈值（毫秒）
    };
  };

  // 健康检查配置
  health: {
    // 检查间隔
    interval: number;    // 毫秒

    // 超时时间
    timeout: number;     // 毫秒

    // 失败阈值
    failureThreshold: number;  // 连续失败次数

    // 检查项目
    checks: {
      database: boolean;
      cache: boolean;
      payments: boolean;
      external: boolean;
    };
  };

  // 告警配置
  alerts: {
    // 告警渠道
    channels: {
      email: {
        enabled: boolean;
        recipients: string[];
      };
      sms: {
        enabled: boolean;
        recipients: string[];
      };
      webhook: {
        enabled: boolean;
        urls: string[];
      };
      console: boolean;
    };

    // 告警规则
    rules: {
      // 性能告警
      performance: {
        responseTime: boolean;
        errorRate: boolean;
        throughput: boolean;
      };

      // 系统告警
      system: {
        cpu: boolean;
        memory: boolean;
        disk: boolean;
        network: boolean;
      };

      // 业务告警
      business: {
        orders: boolean;
        payments: boolean;
        registrations: boolean;
        inventory: boolean;
      };

      // 安全告警
      security: {
        enabled: boolean;
        events: string[];
      };
    };

    // 告警抑制
    suppression: {
      enabled: boolean;
      window: number;      // 抑制窗口（分钟）
      maxPerHour: number;  // 每小时最大告警数
    };

    // 告警升级
    escalation: {
      enabled: boolean;
      levels: Array<{
        delay: number;     // 延迟时间（分钟）
        severity: string;  // 严重程度
        channels: string[]; // 通知渠道
      }>;
    };
  };

  // 监控面板配置
  panel: {
    // 访问控制
    access: {
      enabled: boolean;
      allowedIPs: string[];
      authRequired: boolean;
    };

    // 刷新间隔
    refreshInterval: number;  // 毫秒

    // 数据点限制
    dataPoints: {
      max: number;       // 最大数据点数
      default: number;   // 默认数据点数
    };

    // 缓存配置
    cache: {
      enabled: boolean;
      ttl: number;       // 秒
    };
  };

  // 日志配置
  logging: {
    level: string;       // 日志级别
    format: string;      // 日志格式
    file: {
      enabled: boolean;
      path: string;
      maxSize: string;   // 最大文件大小
      maxFiles: number;  // 最大文件数
    };
  };
}

// 默认配置
const defaultConfig: MonitoringConfig = {
  enabled: true,
  environment: (process.env.NODE_ENV as any) || 'development',

  performance: {
    thresholds: {
      fast: 50,
      normal: 200,
      slow: 500,
      verySlow: 1000,
      critical: 2000
    },
    sampling: {
      baseSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.2,
      fastSampleRate: 0.01,
      normalSampleRate: 0.1,
      slowSampleRate: 0.5,
      verySlowSampleRate: 1.0,
      criticalSampleRate: 1.0,
      errorRateThreshold: 0.05,
      errorRateWindow: 60000
    },
    memory: {
      warning: 512,
      critical: 1024
    },
    ringBufferSize: 10000,
    batchWrite: {
      enabled: true,
      interval: 5000,
      maxSize: 100
    }
  },

  business: {
    windows: {
      realtime: 5,
      hourly: 60,
      daily: 1440
    },
    retention: {
      metrics: 30,
      alerts: 90,
      logs: 7
    },
    aggregation: {
      interval: 60,
      batchSize: 1000
    }
  },

  system: {
    collectInterval: 30000,
    cpu: {
      warning: 70,
      critical: 85
    },
    memory: {
      warning: 75,
      critical: 90
    },
    disk: {
      warning: 80,
      critical: 90
    },
    network: {
      enabled: true,
      bandwidthThreshold: 100
    },
    database: {
      connectionThreshold: 80,
      queryTimeThreshold: 1000
    }
  },

  health: {
    interval: 30000,
    timeout: 5000,
    failureThreshold: 3,
    checks: {
      database: true,
      cache: true,
      payments: true,
      external: true
    }
  },

  alerts: {
    channels: {
      email: {
        enabled: false,
        recipients: []
      },
      sms: {
        enabled: false,
        recipients: []
      },
      webhook: {
        enabled: false,
        urls: []
      },
      console: true
    },
    rules: {
      performance: {
        responseTime: true,
        errorRate: true,
        throughput: true
      },
      system: {
        cpu: true,
        memory: true,
        disk: true,
        network: false
      },
      business: {
        orders: true,
        payments: true,
        registrations: false,
        inventory: true
      },
      security: {
        enabled: true,
        events: ['CRITICAL', 'HIGH']
      }
    },
    suppression: {
      enabled: true,
      window: 5,
      maxPerHour: 20
    },
    escalation: {
      enabled: false,
      levels: []
    }
  },

  panel: {
    access: {
      enabled: false,
      allowedIPs: [],
      authRequired: true
    },
    refreshInterval: 5000,
    dataPoints: {
      max: 1000,
      default: 100
    },
    cache: {
      enabled: true,
      ttl: 60
    }
  },

  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: 'json',
    file: {
      enabled: process.env.NODE_ENV === 'production',
      path: './logs/monitoring.log',
      maxSize: '100MB',
      maxFiles: 30
    }
  }
};

// 环境特定配置
const environmentConfigs: Record<string, Partial<MonitoringConfig>> = {
  development: {
    performance: {
      sampling: {
        baseSampleRate: 1.0,
        errorRateThreshold: 0.1
      }
    },
    alerts: {
      channels: {
        console: true
      }
    },
    panel: {
      access: {
        authRequired: false
      }
    }
  },

  staging: {
    performance: {
      sampling: {
        baseSampleRate: 0.1
      }
    },
    alerts: {
      channels: {
        console: true,
        email: {
          enabled: true,
          recipients: ['dev-team@zhongdao.com']
        }
      }
    }
  },

  production: {
    performance: {
      sampling: {
        baseSampleRate: 0.01,
        errorRateThreshold: 0.01
      }
    },
    alerts: {
      channels: {
        console: false,
        email: {
          enabled: true,
          recipients: ['ops-team@zhongdao.com']
        },
        sms: {
          enabled: true,
          recipients: ['+86-138xxxxxxxx']
        },
        webhook: {
          enabled: true,
          urls: ['https://hooks.slack.com/xxx']
        }
      },
      escalation: {
        enabled: true,
        levels: [
          {
            delay: 5,
            severity: 'HIGH',
            channels: ['email']
          },
          {
            delay: 15,
            severity: 'CRITICAL',
            channels: ['email', 'sms', 'webhook']
          }
        ]
      }
    },
    panel: {
      access: {
        enabled: true,
        allowedIPs: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
        authRequired: true
      },
      cache: {
        enabled: true,
        ttl: 300
      }
    },
    logging: {
      level: 'warn',
      file: {
        enabled: true,
        maxSize: '500MB',
        maxFiles: 90
      }
    }
  }
};

// 获取最终配置
export function getMonitoringConfig(): MonitoringConfig {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = environmentConfigs[env] || {};

  // 深度合并配置
  return deepMerge(defaultConfig, envConfig);
}

// 深度合并对象
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// 导出配置实例
export const monitoringConfig = getMonitoringConfig();