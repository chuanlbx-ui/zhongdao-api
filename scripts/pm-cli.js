#!/usr/bin/env node

/**
 * PM-AI 命令行接口
 * 提供与PM-AI智能体交互的命令行工具
 */

const { ProjectManagerAgent } = require('./pm-agent.js');
const readline = require('readline');

class PMCLI {
  private pmAgent: ProjectManagerAgent;
  private rl: readline.Interface;

  constructor() {
    this.pmAgent = new ProjectManagerAgent();
    this.setupCLI();
  }

  /**
   * 设置命令行交互
   */
  private setupCLI() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'PM-AI> '
    });

    // 显示欢迎信息
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                    中道商城项目 - PM-AI 智能体                       ║
║                                                           ║
║  作为您的专属项目经理，我将协助您：                         ║
║  • 项目进度跟踪与管理                                       ║
║  • 任务分配与AI智能体调度                                   ║
║  • 技术决策支持                                            ║
║  • 风险评估与缓解                                            ║
║                                                           ║
║  输入 'help' 查看可用命令                                      ║
║  输入 'exit' 退出                                              ║
╚════════════════════════════════════════════════════════╝
    `);

    // 监听用户输入
    this.rl.on('line', this.handleCommand.bind(this));
  }

  /**
   * 处理用户命令
   */
  private async handleCommand(input: string) {
    const [command, ...args] = input.trim().split(' ');

    switch (command.toLowerCase()) {
      case 'help':
        this.showHelp();
        break;

      case 'status':
      case '项目状态':
        await this.pmAgent.getProjectOverview();
        break;

      case 'priority':
      case '优先任务':
        await this.pmAgent.handlePriorityTasks();
        break;

      case 'risks':
      case '风险评估':
        await this.pmAgent.assessRisks();
        break;

      case 'talk':
        const message = args.join(' ');
        if (message) {
          await this.pmAgent.communicateWithDeveloper(message);
        } else {
          console.log('请提供要沟通的消息');
        }
        break;

      case 'assign':
        if (args.length >= 2) {
          const taskType = args[0];
          const description = args.slice(1).join(' ');
          const priority = args.includes('high') ? 'high' :
                         args.includes('low') ? 'low' : 'medium';
          await this.pmAgent.assignTask(taskType, description, priority);
        } else {
          console.log('用法: assign <类型> <描述> [优先级]');
          console.log('类型: testing, architecture, user_system, shop_system, documentation, coordination');
        }
        break;

      case 'plan':
      case '计划':
        await this.generateActionPlan();
        break;

      case 'team':
      case '团队':
        this.showTeamInfo();
        break;

      case 'exit':
      case 'quit':
      case '退出':
        console.log('\n感谢使用PM-AI！期待下次为您服务。\n');
        this.rl.close();
        process.exit(0);
        break;

      case '':
        // 空输入，忽略
        break;

      default:
        console.log(`未知命令: ${command}`);
        console.log('输入 "help" 查看可用命令');
    }

    // 继续等待下一个命令
    this.rl.prompt();
  }

  /**
   * 显示帮助信息
   */
  private showHelp() {
    console.log(`
📋 PM-AI 命令帮助：

📊 项目管理:
  status/项目状态     - 查看项目整体状态和进度
  priority/优先任务   - 处理当前优先任务列表
  risks/风险评估       - 查看项目风险评估报告

🤝 AI智能体交互:
  talk <消息>       - 与PM-AI沟通
  assign <类型> <描述> - 分配任务给AI智能体
  team/团队          - 查看AI智能体团队信息

📋 项目规划:
  plan/计划           - 生成下一步行动计划

💬 系统命令:
  help               - 显示此帮助信息
  exit/quit/退出     - 退出PM-AI

示例:
  talk 我们需要修复积分API的性能问题
  assign testing 优化积分API性能测试
  assign architecture 重新设计数据库索引
    `);
  }

  /**
   * 生成行动计划
   */
  private async generateActionPlan() {
    console.log('\n📋 生成下一步行动计划...\n');

    const actions = [
      '1. 修复Points API性能问题（15个超时，2个500错误）',
      '2. 优化数据库查询性能',
      '3. 完成Products API测试（7个测试失败）',
      '4. 实现Users API（5个测试未开始）',
      '5. 整体性能优化和压力测试'
    ];

    console.log('建议执行顺序：');
    actions.forEach(action => console.log(action));

    console.log('\n💡 建议：先处理性能瓶颈问题，因为这是影响整体进度的关键因素。');
  }

  /**
   * 显示AI智能体团队信息
   */
  private showTeamInfo() {
    console.log('\n🤖 PM-AI 智能体团队：\n');

    const agents = [
      {
        name: 'Coordinator AI',
        role: '项目协调者',
        skills: ['任务分配', '团队协调', '冲突解决'],
        status: '✅ 活跃'
      },
      {
        name: 'Architect AI',
        role: '系统架构师',
        skills: ['系统设计', '技术决策', '数据库架构'],
        status: '✅ 活跃'
      },
      {
        name: 'User System AI',
        role: '用户系统专家',
        skills: ['认证系统', '用户等级', '团队管理'],
        status: '✅ 活跃'
      },
      {
        name: 'Shop System AI',
        role: '商店系统专家',
        skills: ['商店功能', '库存管理', '佣金计算'],
        status: '✅ 活跃'
      },
      {
        name: 'Test AI',
        role: '测试专家',
        skills: ['测试策略', '测试执行', '缺陷分析'],
        status: '✅ 活跃'
      },
      {
        name: 'Documentation AI',
        role: '文档专家',
        skills: ['API文档', '开发指南', '知识库'],
        status: '✅ 活跃'
      }
    ];

    agents.forEach(agent => {
      console.log(`\n${agent.name}`);
      console.log(`  角色: ${agent.role}`);
      console.log(`  技能: ${agent.skills.join(', ')}`);
      console.log(`  状态: ${agent.status}`);
    });

    console.log('\n🎯 协同工作模式：');
    console.log('PM-AI负责任务分配和进度跟踪，各AI智能体专注于各自领域的技术实现。');
  }

  /**
   * 启动CLI
   */
  start() {
    console.log('\n🚀 PM-AI CLI 启动成功！');
    this.pmAgent.start();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const cli = new PMCLI();
  cli.start();
}

export { PMCLI };