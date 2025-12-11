import { logger } from '../utils/logger';
import { eventBus } from '../services/event-bus';
import { cacheService } from '../services/cache';

/**
 * Saga状态枚举
 */
export enum SagaStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  FAILED = 'FAILED',
  ABORTED = 'ABORTED'
}

/**
 * Saga步骤定义
 */
export interface SagaStep {
  id: string;
  name: string;
  description?: string;
  execute: SagaStepExecutor;
  compensate?: SagaStepExecutor;
  timeout?: number; // 超时时间（毫秒）
  retryPolicy?: RetryPolicy;
  metadata?: Record<string, any>;
}

/**
 * Saga步骤执行器
 */
export interface SagaStepExecutor {
  (context: SagaContext): Promise<SagaStepResult>;
}

/**
 * Saga步骤结果
 */
export interface SagaStepResult {
  success: boolean;
  data?: any;
  error?: string;
  compensable?: boolean; // 是否可补偿
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number; // 重试延迟（毫秒）
  backoffMultiplier?: number; // 退避倍数
  maxDelay?: number; // 最大延迟
}

/**
 * Saga上下文
 */
export interface SagaContext {
  sagaId: string;
  sagaType: string;
  data: Record<string, any>;
  executedSteps: string[];
  compensationData: Map<string, any>;
  metadata: Record<string, any>;
}

/**
 * Saga定义
 */
export interface SagaDefinition {
  id: string;
  name: string;
  description?: string;
  steps: SagaStep[];
  timeout?: number; // 总超时时间
  compensationMode?: 'async' | 'sync'; // 补偿模式
  metadata?: Record<string, any>;
}

/**
 * Saga执行结果
 */
export interface SagaExecutionResult {
  sagaId: string;
  status: SagaStatus;
  executedSteps: string[];
  stepResults: Map<string, SagaStepResult>;
  compensationResults?: Map<string, SagaStepResult>;
  error?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

/**
 * Saga引擎 - 实现分布式事务和补偿机制
 */
export class SagaEngine {
  private sagas: Map<string, SagaDefinition> = new Map();
  private executions: Map<string, SagaExecution> = new Map();
  private cachePrefix = 'saga:engine:';

  constructor() {
    // 监听系统关闭事件，清理正在执行的Saga
    process.on('SIGINT', () => {
      this.shutdown();
    });
    process.on('SIGTERM', () => {
      this.shutdown();
    });
  }

  /**
   * 注册Saga定义
   */
  registerSaga(definition: SagaDefinition): void {
    // 验证Saga定义
    this.validateSagaDefinition(definition);

    this.sagas.set(definition.id, definition);

    logger.info('Saga注册成功', {
      sagaId: definition.id,
      sagaName: definition.name,
      stepsCount: definition.steps.length
    });
  }

  /**
   * 执行Saga
   */
  async executeSaga(
    sagaId: string,
    initialData: Record<string, any> = {},
    options: {
      sagaInstanceId?: string;
      timeout?: number;
    } = {}
  ): Promise<SagaExecutionResult> {
    const sagaDefinition = this.sagas.get(sagaId);
    if (!sagaDefinition) {
      throw new Error(`Saga定义不存在: ${sagaId}`);
    }

    const sagaInstanceId = options.sagaInstanceId || this.generateSagaInstanceId(sagaId);
    const existingExecution = this.executions.get(sagaInstanceId);

    // 检查是否已有执行实例
    if (existingExecution) {
      if (existingExecution.isRunning()) {
        throw new Error(`Saga正在执行中: ${sagaInstanceId}`);
      }
      // 如果是失败的实例，可以重新执行
    }

    // 创建执行上下文
    const context: SagaContext = {
      sagaId: sagaInstanceId,
      sagaType: sagaId,
      data: { ...initialData },
      executedSteps: [],
      compensationData: new Map(),
      metadata: {
        sagaDefinitionId: sagaId,
        sagaName: sagaDefinition.name,
        startTime: new Date(),
        ...sagaDefinition.metadata
      }
    };

    // 创建执行实例
    const execution = new SagaExecution(sagaDefinition, context, {
      timeout: options.timeout || sagaDefinition.timeout,
      compensationMode: sagaDefinition.compensationMode || 'sync'
    });

    this.executions.set(sagaInstanceId, execution);

    try {
      logger.info('开始执行Saga', {
        sagaInstanceId,
        sagaId: sagaDefinition.id,
        sagaName: sagaDefinition.name,
        stepsCount: sagaDefinition.steps.length
      });

      // 发送Saga开始事件
      await eventBus.emit('saga.started', {
        sagaInstanceId,
        sagaId: sagaDefinition.id,
        context
      });

      // 执行Saga
      const result = await execution.execute();

      // 发送Saga完成事件
      await eventBus.emit('saga.completed', {
        sagaInstanceId,
        sagaId: sagaDefinition.id,
        result
      });

      // 缓存执行结果
      await this.cacheExecutionResult(sagaInstanceId, result);

      logger.info('Saga执行完成', {
        sagaInstanceId,
        status: result.status,
        duration: result.duration,
        stepsExecuted: result.executedSteps.length
      });

      return result;
    } catch (error) {
      logger.error('Saga执行异常', {
        sagaInstanceId,
        error: error instanceof Error ? error.message : '未知错误'
      });

      // 发送Saga失败事件
      await eventBus.emit('saga.failed', {
        sagaInstanceId,
        sagaId: sagaDefinition.id,
        error: error instanceof Error ? error.message : '未知错误'
      });

      throw error;
    } finally {
      // 清理执行实例（保留一段时间用于查询）
      setTimeout(() => {
        this.executions.delete(sagaInstanceId);
      }, 60 * 60 * 1000); // 1小时后清理
    }
  }

  /**
   * 补偿Saga
   */
  async compensateSaga(
    sagaInstanceId: string,
    options: {
      force?: boolean;
    } = {}
  ): Promise<SagaExecutionResult> {
    const execution = this.executions.get(sagaInstanceId);
    if (!execution) {
      // 尝试从缓存加载
      const cached = await this.getCachedExecutionResult(sagaInstanceId);
      if (cached) {
        // 重建执行实例进行补偿
        const sagaDefinition = this.sagas.get(cached.metadata.sagaDefinitionId);
        if (sagaDefinition) {
          const newExecution = new SagaExecution(sagaDefinition, cached as any, {
            compensationMode: 'sync'
          });
          return newExecution.compensate();
        }
      }
      throw new Error(`Saga执行实例不存在: ${sagaInstanceId}`);
    }

    if (!execution.canCompensate() && !options.force) {
      throw new Error(`Saga无法补偿: ${sagaInstanceId}`);
    }

    logger.info('开始补偿Saga', {
      sagaInstanceId,
      forced: options.force
    });

    const result = await execution.compensate();

    await eventBus.emit('saga.compensated', {
      sagaInstanceId,
      result
    });

    await this.cacheExecutionResult(sagaInstanceId, result);

    return result;
  }

  /**
   * 获取Saga执行状态
   */
  async getExecutionStatus(sagaInstanceId: string): Promise<SagaExecutionResult | null> {
    const execution = this.executions.get(sagaInstanceId);
    if (execution) {
      return execution.getStatus();
    }

    // 尝试从缓存获取
    return this.getCachedExecutionResult(sagaInstanceId);
  }

  /**
   * 获取所有注册的Saga
   */
  getRegisteredSagas(): SagaDefinition[] {
    return Array.from(this.sagas.values());
  }

  /**
   * 获取正在执行的Saga
   */
  getRunningExecutions(): SagaExecution[] {
    return Array.from(this.executions.values()).filter(execution => execution.isRunning());
  }

  /**
   * 清理完成的Saga执行实例
   */
  cleanupCompletedExecutions(): number {
    let cleaned = 0;
    for (const [id, execution] of this.executions.entries()) {
      if (!execution.isRunning()) {
        this.executions.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  // ========== 私有方法 ==========

  /**
   * 验证Saga定义
   */
  private validateSagaDefinition(definition: SagaDefinition): void {
    if (!definition.id || !definition.name) {
      throw new Error('Saga必须包含ID和名称');
    }

    if (!definition.steps || definition.steps.length === 0) {
      throw new Error('Saga必须包含至少一个步骤');
    }

    // 验证步骤
    const stepIds = new Set<string>();
    definition.steps.forEach((step, index) => {
      if (!step.id || !step.name || !step.execute) {
        throw new Error(`步骤 ${index} 定义不完整`);
      }

      if (stepIds.has(step.id)) {
        throw new Error(`步骤ID重复: ${step.id}`);
      }

      stepIds.add(step.id);
    });
  }

  /**
   * 生成Saga实例ID
   */
  private generateSagaInstanceId(sagaId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${sagaId}_${timestamp}_${random}`;
  }

  /**
   * 缓存执行结果
   */
  private async cacheExecutionResult(
    sagaInstanceId: string,
    result: SagaExecutionResult
  ): Promise<void> {
    const cacheKey = `${this.cachePrefix}result:${sagaInstanceId}`;
    await cacheService.set(cacheKey, result, 24 * 60 * 60); // 缓存24小时
  }

  /**
   * 获取缓存的执行结果
   */
  private async getCachedExecutionResult(
    sagaInstanceId: string
  ): Promise<SagaExecutionResult | null> {
    const cacheKey = `${this.cachePrefix}result:${sagaInstanceId}`;
    return cacheService.get<SagaExecutionResult>(cacheKey);
  }

  /**
   * 关闭Saga引擎
   */
  private async shutdown(): Promise<void> {
    logger.info('Saga引擎正在关闭...');

    // 补偿所有正在执行的Saga
    const runningExecutions = this.getRunningExecutions();
    for (const execution of runningExecutions) {
      try {
        logger.info('补偿正在执行的Saga', {
          sagaInstanceId: execution.getContext().sagaId
        });
        await execution.compensate();
      } catch (error) {
        logger.error('补偿Saga失败', {
          sagaInstanceId: execution.getContext().sagaId,
          error: error instanceof Error ? error.message : '未知错误'
        });
      }
    }

    // 清理资源
    this.executions.clear();
    logger.info('Saga引擎已关闭');
  }
}

/**
 * Saga执行实例
 */
class SagaExecution {
  private status: SagaStatus = SagaStatus.PENDING;
  private startTime: Date;
  private endTime?: Date;
  private stepResults: Map<string, SagaStepResult> = new Map();
  private compensationResults: Map<string, SagaStepResult> = new Map();
  private currentStepIndex = -1;
  private timeoutId?: NodeJS.Timeout;

  constructor(
    private definition: SagaDefinition,
    private context: SagaContext,
    private options: {
      timeout?: number;
      compensationMode: 'async' | 'sync';
    }
  ) {
    this.startTime = new Date();
    this.setupTimeout();
  }

  /**
   * 执行Saga
   */
  async execute(): Promise<SagaExecutionResult> {
    if (this.status !== SagaStatus.PENDING) {
      throw new Error(`Saga状态错误: ${this.status}`);
    }

    this.status = SagaStatus.RUNNING;

    try {
      for (let i = 0; i < this.definition.steps.length; i++) {
        this.currentStepIndex = i;
        const step = this.definition.steps[i];

        logger.debug('执行Saga步骤', {
          sagaId: this.context.sagaId,
          stepId: step.id,
          stepName: step.name
        });

        const stepResult = await this.executeStep(step);

        if (!stepResult.success) {
          // 步骤失败，开始补偿
          this.status = SagaStatus.FAILED;
          await this.compensate();
          break;
        }

        // 保存补偿数据
        if (stepResult.data && stepResult.compensable !== false) {
          this.context.compensationData.set(step.id, stepResult.data);
        }
      }

      // 如果所有步骤都成功
      if (this.status === SagaStatus.RUNNING) {
        this.status = SagaStatus.COMPLETED;
      }
    } catch (error) {
      this.status = SagaStatus.FAILED;
      await this.compensate();
      throw error;
    } finally {
      this.finish();
    }

    return this.getStatus();
  }

  /**
   * 补偿Saga
   */
  async compensate(): Promise<SagaExecutionResult> {
    if (this.status !== SagaStatus.FAILED && this.status !== SagaStatus.COMPLETED) {
      throw new Error(`Saga状态不允许补偿: ${this.status}`);
    }

    this.status = SagaStatus.COMPENSATING;

    try {
      // 逆序补偿已执行的步骤
      for (let i = this.currentStepIndex; i >= 0; i--) {
        const step = this.definition.steps[i];
        const stepResult = this.stepResults.get(step.id);

        // 只补偿已成功执行的步骤
        if (stepResult && stepResult.success && step.compensate) {
          logger.debug('补偿Saga步骤', {
            sagaId: this.context.sagaId,
            stepId: step.id,
            stepName: step.name
          });

          const compensationResult = await this.executeStep({
            ...step,
            execute: step.compensate,
            id: `${step.id}_compensate`
          });

          this.compensationResults.set(step.id, compensationResult);

          if (!compensationResult.success) {
            logger.error('Saga步骤补偿失败', {
              sagaId: this.context.sagaId,
              stepId: step.id,
              error: compensationResult.error
            });
            // 继续补偿其他步骤
          }
        }
      }

      this.status = SagaStatus.COMPENSATED;
    } catch (error) {
      this.status = SagaStatus.FAILED; // 补偿也失败了
      logger.error('Saga补偿失败', {
        sagaId: this.context.sagaId,
        error: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      this.finish();
    }

    return this.getStatus();
  }

  /**
   * 获取执行状态
   */
  getStatus(): SagaExecutionResult {
    const now = new Date();
    const duration = now.getTime() - this.startTime.getTime();

    return {
      sagaId: this.context.sagaId,
      status: this.status,
      executedSteps: this.context.executedSteps,
      stepResults: new Map(this.stepResults),
      compensationResults: this.compensationResults.size > 0 ? new Map(this.compensationResults) : undefined,
      error: this.status === SagaStatus.FAILED ? '执行失败' : undefined,
      startTime: this.startTime,
      endTime: this.endTime,
      duration
    };
  }

  /**
   * 获取上下文
   */
  getContext(): SagaContext {
    return { ...this.context };
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.status === SagaStatus.RUNNING || this.status === SagaStatus.COMPENSATING;
  }

  /**
   * 是否可以补偿
   */
  canCompensate(): boolean {
    return this.status === SagaStatus.COMPLETED || this.status === SagaStatus.FAILED;
  }

  // ========== 私有方法 ==========

  /**
   * 执行步骤
   */
  private async executeStep(step: SagaStep): Promise<SagaStepResult> {
    const startTime = Date.now();

    try {
      // 设置步骤超时
      const stepTimeoutId = setTimeout(() => {
        throw new Error(`步骤执行超时: ${step.name}`);
      }, step.timeout || 30000); // 默认30秒超时

      // 执行步骤
      const result = await this.executeWithRetry(step);

      clearTimeout(stepTimeoutId);

      // 记录结果
      this.stepResults.set(step.id, result);
      this.context.executedSteps.push(step.id);

      logger.debug('Saga步骤执行成功', {
        sagaId: this.context.sagaId,
        stepId: step.id,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('Saga步骤执行失败', {
        sagaId: this.context.sagaId,
        stepId: step.id,
        error: errorMessage,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry(step: SagaStep): Promise<SagaStepResult> {
    const retryPolicy = step.retryPolicy || { maxRetries: 0, retryDelay: 1000 };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.calculateRetryDelay(attempt, retryPolicy);
        logger.debug('重试Saga步骤', {
          sagaId: this.context.sagaId,
          stepId: step.id,
          attempt,
          delay
        });
        await this.sleep(delay);
      }

      try {
        return await step.execute(this.context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('未知错误');
        logger.warn('Saga步骤执行失败，准备重试', {
          sagaId: this.context.sagaId,
          stepId: step.id,
          attempt,
          error: lastError.message
        });
      }
    }

    throw lastError;
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(attempt: number, policy: RetryPolicy): number {
    let delay = policy.retryDelay * Math.pow(policy.backoffMultiplier || 1, attempt - 1);
    if (policy.maxDelay) {
      delay = Math.min(delay, policy.maxDelay);
    }
    return delay;
  }

  /**
   * 设置超时
   */
  private setupTimeout(): void {
    if (this.options.timeout) {
      this.timeoutId = setTimeout(() => {
        logger.error('Saga执行超时', {
          sagaId: this.context.sagaId,
          timeout: this.options.timeout
        });
        this.status = SagaStatus.FAILED;
      }, this.options.timeout);
    }
  }

  /**
   * 完成执行
   */
  private finish(): void {
    this.endTime = new Date();
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例实例
export const sagaEngine = new SagaEngine();

// 导出常用Saga定义
export const CommonSagas = {
  /**
   * 订单处理Saga
   */
  ORDER_PROCESSING: {
    id: 'order_processing',
    name: '订单处理流程',
    description: '处理订单创建、支付、发货、完成等流程',
    steps: [
      {
        id: 'validate_order',
        name: '验证订单',
        execute: async (context) => {
          // 验证订单合法性
          return { success: true, compensable: false };
        }
      },
      {
        id: 'reserve_inventory',
        name: '预留库存',
        execute: async (context) => {
          // 预留商品库存
          return { success: true, compensable: true, data: { reservedItems: context.data.items } };
        },
        compensate: async (context) => {
          // 释放预留的库存
          return { success: true };
        }
      },
      {
        id: 'process_payment',
        name: '处理支付',
        execute: async (context) => {
          // 处理支付
          return { success: true, compensable: true, data: { paymentId: 'pay_123' } };
        },
        compensate: async (context) => {
          // 退款
          return { success: true };
        }
      },
      {
        id: 'update_order_status',
        name: '更新订单状态',
        execute: async (context) => {
          // 更新订单状态
          return { success: true, compensable: false };
        }
      },
      {
        id: 'calculate_commission',
        name: '计算佣金',
        execute: async (context) => {
          // 计算并分配佣金
          return { success: true, compensable: true };
        },
        compensate: async (context) => {
          // 回滚佣金
          return { success: true };
        }
      }
    ]
  } as SagaDefinition,

  /**
   * 用户升级Saga
   */
  USER_UPGRADE: {
    id: 'user_upgrade',
    name: '用户升级流程',
    description: '处理用户等级升级',
    steps: [
      {
        id: 'validate_upgrade',
        name: '验证升级条件',
        execute: async (context) => {
          // 验证升级条件
          return { success: true, compensable: false };
        }
      },
      {
        id: 'update_level',
        name: '更新用户等级',
        execute: async (context) => {
          // 更新用户等级
          return { success: true, compensable: true, data: { previousLevel: 'VIP' } };
        },
        compensate: async (context) => {
          // 恢复原等级
          return { success: true };
        }
      },
      {
        id: 'process_benefits',
        name: '处理升级权益',
        execute: async (context) => {
          // 处理升级奖励和权益
          return { success: true, compensable: true };
        },
        compensate: async (context) => {
          // 回滚权益
          return { success: true };
        }
      }
    ]
  } as SagaDefinition
};