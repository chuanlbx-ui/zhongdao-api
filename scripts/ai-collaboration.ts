#!/usr/bin/env node
/**
 * AI协同开发工具
 * 用于管理多个AI协作者的任务分配、进度跟踪和冲突解决
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

// 配置文件路径
const CONFIG_DIR = path.join(__dirname, '..', '.ai-collaboration');
const TASKS_FILE = path.join(CONFIG_DIR, 'tasks.json');
const AI_STATUS_FILE = path.join(CONFIG_DIR, 'ai-status.json');
const KNOWLEDGE_FILE = path.join(CONFIG_DIR, 'knowledge.json');

// 确保配置目录存在
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// 任务接口
interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  assigned_to?: string;
  created_at: Date;
  updated_at: Date;
  due_date?: Date;
  estimated_hours: number;
  actual_hours?: number;
  dependencies: string[];
  tags: string[];
  ai_specialist?: string;
  subtasks: SubTask[];
}

interface SubTask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_to?: string;
  estimated_hours: number;
}

// AI状态接口
interface AIStatus {
  id: string;
  name: string;
  role: string;
  specialization: string[];
  status: 'available' | 'busy' | 'offline';
  current_tasks: string[];
  last_activity: Date;
  capabilities: string[];
  working_hours?: {
    start: string;
    end: string;
    timezone: string;
  };
  performance: {
    tasks_completed: number;
    average_completion_time: number;
    quality_score: number;
  };
}

// 知识条目接口
interface KnowledgeItem {
  id: string;
  title: string;
  type: 'solution' | 'pattern' | 'best_practice' | 'lesson_learned';
  content: string;
  tags: string[];
  ai_id: string;
  created_at: Date;
  relevance_score?: number;
  usage_count: number;
}

// 协同管理器
class CollaborationManager {
  private tasks: Map<string, Task> = new Map();
  private aiStatuses: Map<string, AIStatus> = new Map();
  private knowledge: Map<string, KnowledgeItem> = new Map();

  constructor() {
    this.loadData();
  }

  // 加载数据
  private loadData(): void {
    try {
      // 加载任务
      if (fs.existsSync(TASKS_FILE)) {
        const tasksData = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        tasksData.forEach((task: Task) => {
          task.created_at = new Date(task.created_at);
          task.updated_at = new Date(task.updated_at);
          if (task.due_date) {
            task.due_date = new Date(task.due_date);
          }
          this.tasks.set(task.id, task);
        });
      }

      // 加载AI状态
      if (fs.existsSync(AI_STATUS_FILE)) {
        const aiData = JSON.parse(fs.readFileSync(AI_STATUS_FILE, 'utf8'));
        aiData.forEach((ai: AIStatus) => {
          ai.last_activity = new Date(ai.last_activity);
          this.aiStatuses.set(ai.id, ai);
        });
      }

      // 加载知识库
      if (fs.existsSync(KNOWLEDGE_FILE)) {
        const knowledgeData = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
        knowledgeData.forEach((item: KnowledgeItem) => {
          item.created_at = new Date(item.created_at);
          this.knowledge.set(item.id, item);
        });
      }
    } catch (error) {
      console.error('❌ 加载数据失败:', error);
    }
  }

  // 保存数据
  private saveData(): void {
    try {
      // 保存任务
      fs.writeFileSync(TASKS_FILE, JSON.stringify(Array.from(this.tasks.values()), null, 2));

      // 保存AI状态
      fs.writeFileSync(AI_STATUS_FILE, JSON.stringify(Array.from(this.aiStatuses.values()), null, 2));

      // 保存知识库
      fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(Array.from(this.knowledge.values()), null, 2));
    } catch (error) {
      console.error('❌ 保存数据失败:', error);
    }
  }

  // 初始化AI配置
  initializeAI(): void {
    const defaultAIs: AIStatus[] = [
      {
        id: 'coordinator-ai-1',
        name: '项目协调AI',
        role: 'coordinator',
        specialization: ['task_management', 'conflict_resolution', 'quality_control'],
        status: 'available',
        current_tasks: [],
        last_activity: new Date(),
        capabilities: ['planning', 'coordination', 'review', 'management'],
        performance: {
          tasks_completed: 0,
          average_completion_time: 0,
          quality_score: 0
        }
      },
      {
        id: 'architect-ai-1',
        name: '架构师AI',
        role: 'architect',
        specialization: ['system_design', 'database_design', 'api_design'],
        status: 'available',
        current_tasks: [],
        last_activity: new Date(),
        capabilities: ['architecture', 'design', 'review', 'optimization'],
        performance: {
          tasks_completed: 0,
          average_completion_time: 0,
          quality_score: 0
        }
      },
      {
        id: 'developer-ai-1',
        name: '用户系统开发AI',
        role: 'developer',
        specialization: ['user_management', 'authentication', 'authorization'],
        status: 'available',
        current_tasks: [],
        last_activity: new Date(),
        capabilities: ['backend', 'typescript', 'nodejs', 'prisma', 'testing'],
        performance: {
          tasks_completed: 0,
          average_completion_time: 0,
          quality_score: 0
        }
      },
      {
        id: 'developer-ai-2',
        name: '店铺系统开发AI',
        role: 'developer',
        specialization: ['shop_management', 'inventory', 'order_processing'],
        status: 'available',
        current_tasks: [],
        last_activity: new Date(),
        capabilities: ['backend', 'business_logic', 'validation', 'testing'],
        performance: {
          tasks_completed: 0,
          average_completion_time: 0,
          quality_score: 0
        }
      },
      {
        id: 'testing-ai-1',
        name: '测试AI',
        role: 'tester',
        specialization: ['unit_testing', 'integration_testing', 'e2e_testing'],
        status: 'available',
        current_tasks: [],
        last_activity: new Date(),
        capabilities: ['jest', 'cypress', 'performance_testing', 'api_testing'],
        performance: {
          tasks_completed: 0,
          average_completion_time: 0,
          quality_score: 0
        }
      },
      {
        id: 'documentation-ai-1',
        name: '文档AI',
        role: 'documentation',
        specialization: ['technical_writing', 'api_documentation', 'user_manuals'],
        status: 'available',
        current_tasks: [],
        last_activity: new Date(),
        capabilities: ['markdown', 'swagger', 'documentation', 'user_guide'],
        performance: {
          tasks_completed: 0,
          average_completion_time: 0,
          quality_score: 0
        }
      }
    ];

    defaultAIs.forEach(ai => {
      if (!this.aiStatuses.has(ai.id)) {
        this.aiStatuses.set(ai.id, ai);
      }
    });

    this.saveData();
    console.log('✅ AI配置初始化完成');
  }

  // 创建任务
  createTask(taskData: Omit<Task, 'id' | 'created_at' | 'updated_at'>): string {
    const task: Task = {
      ...taskData,
      id: this.generateId('TASK'),
      created_at: new Date(),
      updated_at: new Date()
    };

    this.tasks.set(task.id, task);
    this.saveData();

    console.log(`✅ 任务创建成功: ${task.id} - ${task.title}`);
    return task.id;
  }

  // 分配任务
  assignTask(taskId: string, aiId?: string): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    const ai = this.aiStatuses.get(aiId || this.recommendAI(task));
    if (!ai) {
      throw new Error(`AI不存在: ${aiId}`);
    }

    if (ai.status !== 'available') {
      throw new Error(`AI ${ai.name} 当前不可用`);
    }

    task.assigned_to = ai.id;
    task.status = 'in_progress';
    task.updated_at = new Date();

    ai.current_tasks.push(taskId);
    ai.status = 'busy';
    ai.last_activity = new Date();

    this.saveData();

    console.log(`✅ 任务已分配: ${task.title} → ${ai.name}`);
  }

  // 推荐最适合的AI
  private recommendAI(task: Task): string {
    // 根据任务类型和专业领域推荐AI
    const specialistMap: Record<string, string> = {
      'user_system': 'developer-ai-1',
      'shop_system': 'developer-ai-2',
      'payment_system': 'developer-ai-1',
      'database_design': 'architect-ai-1',
      'api_design': 'architect-ai-1',
      'testing': 'testing-ai-1',
      'documentation': 'documentation-ai-1',
      'coordination': 'coordinator-ai-1'
    };

    // 检查任务标签匹配
    for (const tag of task.tags) {
      if (specialistMap[tag]) {
        const recommendedAI = this.aiStatuses.get(specialistMap[tag]);
        if (recommendedAI && recommendedAI.status === 'available') {
          return recommendedAI.id;
        }
      }
    }

    // 如果没有专业匹配，选择负载最轻的可用AI
    const availableAIs = Array.from(this.aiStatuses.values())
      .filter(ai => ai.status === 'available')
      .sort((a, b) => a.current_tasks.length - b.current_tasks.length);

    return availableAIs[0]?.id || 'coordinator-ai-1';
  }

  // 更新任务状态
  updateTaskStatus(taskId: string, status: Task['status'], actualHours?: number): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    const oldStatus = task.status;
    task.status = status;
    task.updated_at = new Date();

    if (actualHours) {
      task.actual_hours = actualHours;
    }

    // 如果任务完成，更新AI状态
    if (status === 'completed' && task.assigned_to) {
      const ai = this.aiStatuses.get(task.assigned_to);
      if (ai) {
        ai.current_tasks = ai.current_tasks.filter(id => id !== taskId);

        // 更新性能指标
        ai.performance.tasks_completed++;
        if (task.actual_hours) {
          const totalTime = ai.performance.average_completion_time * (ai.performance.tasks_completed - 1) + task.actual_hours;
          ai.performance.average_completion_time = totalTime / ai.performance.tasks_completed;
        }

        if (ai.current_tasks.length === 0) {
          ai.status = 'available';
        }
      }
    }

    this.saveData();

    console.log(`✅ 任务状态更新: ${task.title} (${oldStatus} → ${status})`);

    // 检查依赖任务
    if (status === 'completed') {
      this.checkDependentTasks(taskId);
    }
  }

  // 检查依赖任务
  private checkDependentTasks(completedTaskId: string): void {
    for (const task of this.tasks.values()) {
      if (task.dependencies.includes(completedTaskId) && task.status === 'pending') {
        const allDependenciesCompleted = task.dependencies.every(depId => {
          const depTask = this.tasks.get(depId);
          return depTask?.status === 'completed';
        });

        if (allDependenciesCompleted) {
          console.log(`🔔 任务依赖已完成，可以开始: ${task.title}`);
        }
      }
    }
  }

  // 添加知识条目
  addKnowledge(item: Omit<KnowledgeItem, 'id' | 'created_at' | 'usage_count'>): string {
    const knowledgeItem: KnowledgeItem = {
      ...item,
      id: this.generateId('KNOWLEDGE'),
      created_at: new Date(),
      usage_count: 0
    };

    this.knowledge.set(knowledgeItem.id, knowledgeItem);
    this.saveData();

    console.log(`✅ 知识条目已添加: ${knowledgeItem.title}`);
    return knowledgeItem.id;
  }

  // 搜索知识
  searchKnowledge(query: string): KnowledgeItem[] {
    const results: KnowledgeItem[] = [];
    const queryLower = query.toLowerCase();

    for (const item of this.knowledge.values()) {
      let relevance = 0;

      // 标题匹配
      if (item.title.toLowerCase().includes(queryLower)) {
        relevance += 10;
      }

      // 内容匹配
      if (item.content.toLowerCase().includes(queryLower)) {
        relevance += 5;
      }

      // 标签匹配
      for (const tag of item.tags) {
        if (tag.toLowerCase().includes(queryLower)) {
          relevance += 3;
        }
      }

      if (relevance > 0) {
        results.push({ ...item, relevance_score: relevance });
      }
    }

    return results.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
  }

  // 检测冲突
  detectConflicts(): Array<{type: string, description: string, severity: string}> {
    const conflicts: Array<{type: string, description: string, severity: string}> = [];

    // 检测文件修改冲突
    const fileModifiers = new Map<string, string[]>();
    for (const [aiId, ai] of this.aiStatuses) {
      if (ai.current_tasks.length > 0) {
        for (const taskId of ai.current_tasks) {
          const task = this.tasks.get(taskId);
          if (task && task.tags.includes('file_modification')) {
            const fileName = task.title.match(/文件[：:]?\s*(.+)/)?.[1] || 'unknown';
            if (!fileModifiers.has(fileName)) {
              fileModifiers.set(fileName, []);
            }
            fileModifiers.get(fileName)!.push(ai.name);
          }
        }
      }
    }

    for (const [file, modifiers] of fileModifiers) {
      if (modifiers.length > 1) {
        conflicts.push({
          type: 'file_conflict',
          description: `多个AI同时修改文件: ${file} (${modifiers.join(', ')})`,
          severity: 'high'
        });
      }
    }

    // 检测资源竞争
    const busyAIs = Array.from(this.aiStatuses.values())
      .filter(ai => ai.status === 'busy');

    if (busyAIs.length >= this.aiStatuses.size - 1) {
      conflicts.push({
        type: 'resource_competition',
        description: '大部分AI都处于忙碌状态，新任务可能需要等待',
        severity: 'medium'
      });
    }

    return conflicts;
  }

  // 生成报告
  generateReport(): void {
    console.log('\n📊 AI协同开发报告');
    console.log('='.repeat(50));

    // 任务统计
    const totalTasks = this.tasks.size;
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed').length;
    const inProgressTasks = Array.from(this.tasks.values()).filter(t => t.status === 'in_progress').length;
    const pendingTasks = Array.from(this.tasks.values()).filter(t => t.status === 'pending').length;

    console.log(`\n📋 任务统计:`);
    console.log(`  总任务数: ${totalTasks}`);
    console.log(`  已完成: ${completedTasks} (${((completedTasks/totalTasks)*100).toFixed(1)}%)`);
    console.log(`  进行中: ${inProgressTasks}`);
    console.log(`  待开始: ${pendingTasks}`);

    // AI状态统计
    console.log(`\n🤖 AI状态:`);
    for (const [id, ai] of this.aiStatuses) {
      const status = ai.status === 'available' ? '✅ 可用' :
                    ai.status === 'busy' ? '🔄 忙碌' : '❌ 离线';
      console.log(`  ${ai.name}: ${status} (任务数: ${ai.current_tasks.length})`);
    }

    // 性能统计
    console.log(`\n⚡ 性能统计:`);
    for (const [id, ai] of this.aiStatuses) {
      if (ai.performance.tasks_completed > 0) {
        console.log(`  ${ai.name}:`);
        console.log(`    完成任务: ${ai.performance.tasks_completed}`);
        console.log(`    平均耗时: ${ai.performance.average_completion_time.toFixed(1)}小时`);
      }
    }

    // 冲突检测
    const conflicts = this.detectConflicts();
    if (conflicts.length > 0) {
      console.log(`\n⚠️  检测到 ${conflicts.length} 个冲突:`);
      conflicts.forEach(conflict => {
        console.log(`  ${conflict.severity === 'high' ? '🔴' : '🟡'} ${conflict.description}`);
      });
    } else {
      console.log(`\n✅ 未检测到冲突`);
    }

    console.log('\n' + '='.repeat(50));
  }

  // 生成ID
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  // 获取所有任务
  getTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  // 获取所有AI状态
  getAIStatuses(): AIStatus[] {
    return Array.from(this.aiStatuses.values());
  }

  // 获取知识库
  getKnowledge(): KnowledgeItem[] {
    return Array.from(this.knowledge.values());
  }
}

// 命令行接口
const program = new Command();
const collaboration = new CollaborationManager();

program
  .name('ai-collaboration')
  .description('AI协同开发管理工具')
  .version('1.0.0');

// 初始化命令
program
  .command('init')
  .description('初始化AI协同环境')
  .action(() => {
    collaboration.initializeAI();
    console.log('🎉 AI协同环境初始化完成！');
  });

// 创建任务命令
program
  .command('create-task')
  .description('创建新任务')
  .requiredOption('-t, --title <title>', '任务标题')
  .requiredOption('-d, --description <description>', '任务描述')
  .option('-p, --priority <priority>', '优先级 (low|medium|high|urgent)', 'medium')
  .option('-e, --estimated-hours <hours>', '预估小时数', '8')
  .option('-s, --specialist <specialist>', '专业领域')
  .option('--tags <tags>', '标签，用逗号分隔', '')
  .action((options) => {
    const taskId = collaboration.createTask({
      title: options.title,
      description: options.description,
      priority: options.priority,
      status: 'pending',
      estimated_hours: parseInt(options.estimatedHours),
      dependencies: [],
      tags: options.tags ? options.tags.split(',').map(t => t.trim()) : [],
      ai_specialist: options.specialist,
      subtasks: []
    });

    console.log(`📝 任务已创建，ID: ${taskId}`);
  });

// 分配任务命令
program
  .command('assign-task <taskId>')
  .description('分配任务给AI')
  .option('-a, --ai <aiId>', '指定AI ID')
  .action((taskId, options) => {
    try {
      collaboration.assignTask(taskId, options.ai);
    } catch (error) {
      console.error('❌ 分配失败:', error.message);
    }
  });

// 更新任务状态命令
program
  .command('update-task <taskId> <status>')
  .description('更新任务状态')
  .option('-h, --hours <hours>', '实际耗时')
  .action((taskId, status, options) => {
    try {
      collaboration.updateTaskStatus(taskId, status as any, options.hours ? parseInt(options.hours) : undefined);
    } catch (error) {
      console.error('❌ 更新失败:', error.message);
    }
  });

// 查看任务列表
program
  .command('tasks')
  .description('查看所有任务')
  .option('-s, --status <status>', '按状态筛选')
  .action((options) => {
    const tasks = collaboration.getTasks();
    let filteredTasks = tasks;

    if (options.status) {
      filteredTasks = tasks.filter(t => t.status === options.status);
    }

    console.log('\n📋 任务列表:');
    console.log('='.repeat(80));

    for (const task of filteredTasks) {
      const status = task.status === 'completed' ? '✅' :
                    task.status === 'in_progress' ? '🔄' :
                    task.status === 'blocked' ? '🚫' : '⏳';

      console.log(`${status} [${task.id}] ${task.title}`);
      console.log(`    描述: ${task.description}`);
      console.log(`    优先级: ${task.priority} | 预估: ${task.estimated_hours}h`);

      if (task.assigned_to) {
        const ai = collaboration.getAIStatuses().find(a => a.id === task.assigned_to);
        console.log(`    分配给: ${ai?.name || 'Unknown'}`);
      }

      if (task.dependencies.length > 0) {
        console.log(`    依赖: ${task.dependencies.join(', ')}`);
      }

      console.log(`    创建时间: ${task.created_at.toLocaleString()}`);
      console.log('');
    }
  });

// 查看AI状态
program
  .command('ai-status')
  .description('查看所有AI状态')
  .action(() => {
    const ais = collaboration.getAIStatuses();

    console.log('\n🤖 AI状态列表:');
    console.log('='.repeat(80));

    for (const ai of ais) {
      const status = ai.status === 'available' ? '✅ 可用' :
                    ai.status === 'busy' ? '🔄 忙碌' : '❌ 离线';

      console.log(`${status} ${ai.name} (${ai.id})`);
      console.log(`    角色: ${ai.role}`);
      console.log(`    专业领域: ${ai.specialization.join(', ')}`);
      console.log(`    当前任务数: ${ai.current_tasks.length}`);

      if (ai.current_tasks.length > 0) {
        console.log(`    任务列表:`);
        for (const taskId of ai.current_tasks) {
          const task = collaboration.getTasks().find(t => t.id === taskId);
          console.log(`      - ${task?.title || taskId}`);
        }
      }

      if (ai.performance.tasks_completed > 0) {
        console.log(`    完成任务: ${ai.performance.tasks_completed}`);
        console.log(`    平均耗时: ${ai.performance.average_completion_time.toFixed(1)}h`);
      }

      console.log(`    最后活动: ${ai.last_activity.toLocaleString()}`);
      console.log('');
    }
  });

// 添加知识
program
  .command('add-knowledge')
  .description('添加知识条目')
  .requiredOption('-t, --title <title>', '标题')
  .requiredOption('-c, --content <content>', '内容')
  .requiredOption('-a, --ai <aiId>', 'AI ID')
  .requiredOption('--type <type>', '类型 (solution|pattern|best_practice|lesson_learned)')
  .option('--tags <tags>', '标签，用逗号分隔', '')
  .action((options) => {
    const knowledgeId = collaboration.addKnowledge({
      title: options.title,
      content: options.content,
      ai_id: options.ai,
      type: options.type as any,
      tags: options.tags ? options.tags.split(',').map(t => t.trim()) : []
    });

    console.log(`📚 知识已添加，ID: ${knowledgeId}`);
  });

// 搜索知识
program
  .command('search-knowledge <query>')
  .description('搜索知识库')
  .action((query) => {
    const results = collaboration.searchKnowledge(query);

    console.log(`\n🔍 搜索结果 "${query}":`);
    console.log('='.repeat(80));

    if (results.length === 0) {
      console.log('未找到相关知识');
      return;
    }

    for (const item of results) {
      console.log(`📄 ${item.title} (相关度: ${item.relevance_score})`);
      console.log(`   类型: ${item.type}`);
      console.log(`   标签: ${item.tags.join(', ')}`);
      console.log(`   AI: ${item.ai_id}`);
      console.log(`   内容: ${item.content.substring(0, 100)}...`);
      console.log(`   创建时间: ${item.created_at.toLocaleString()}`);
      console.log('');
    }
  });

// 检测冲突
program
  .command('detect-conflicts')
  .description('检测协同冲突')
  .action(() => {
    const conflicts = collaboration.detectConflicts();

    console.log('\n🔍 冲突检测结果:');
    console.log('='.repeat(50));

    if (conflicts.length === 0) {
      console.log('✅ 未检测到冲突');
      return;
    }

    for (const conflict of conflicts) {
      const icon = conflict.severity === 'high' ? '🔴' : '🟡';
      console.log(`${icon} ${conflict.type}: ${conflict.description}`);
    }
  });

// 生成报告
program
  .command('report')
  .description('生成协同开发报告')
  .action(() => {
    collaboration.generateReport();
  });

// 主程序
program.parse();

// 导出管理器实例供其他模块使用
export { CollaborationManager };