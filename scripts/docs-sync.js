#!/usr/bin/env node

/**
 * 文档自动同步脚本
 *
 * 功能：
 * 1. 从源代码提取OpenAPI文档
 * 2. 同步架构图和业务流程文档
 * 3. 更新Docusaurus文档
 * 4. 验证文档完整性
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  sourceDir: path.resolve(__dirname, '..'),
  docsDir: path.resolve(__dirname, '../docs'),
  portalDir: path.resolve(__dirname, '../docs-portal'),
  apiDocUrl: 'http://localhost:3000/api-docs.json',
  outputDir: path.resolve(__dirname, '../docs-portal/static'),
};

class DocsSyncer {
  constructor() {
    this.apiSpec = null;
    this.errors = [];
  }

  async run() {
    console.log('🚀 开始同步文档...\n');

    try {
      // 1. 提取API文档
      await this.extractApiDocs();

      // 2. 同步架构文档
      await this.syncArchitectureDocs();

      // 3. 同步ADR文档
      await this.syncADRD();

      // 4. 生成API示例
      await this.generateApiExamples();

      // 5. 验证文档
      await this.validateDocs();

      // 6. 构建文档门户
      await this.buildDocsPortal();

      console.log('\n✅ 文档同步完成！');

      if (this.errors.length > 0) {
        console.log('\n⚠️ 发现以下问题：');
        this.errors.forEach(error => console.log(`  - ${error}`));
      }
    } catch (error) {
      console.error('\n❌ 同步失败：', error.message);
      process.exit(1);
    }
  }

  async extractApiDocs() {
    console.log('📚 提取API文档...');

    try {
      // 尝试从运行中的服务获取API文档
      const response = await axios.get(CONFIG.apiDocUrl, {
        timeout: 5000,
      });
      this.apiSpec = response.data;

      // 保存到静态目录
      const outputPath = path.join(CONFIG.outputDir, 'api-docs.json');
      fs.writeFileSync(outputPath, JSON.stringify(this.apiSpec, null, 2));

      console.log('  ✓ API文档已更新');
    } catch (error) {
      // 如果服务未运行，尝试使用swagger-jsdoc生成
      console.log('  ⚠️ 服务未运行，使用swagger-jsdoc生成文档...');
      await this.generateApiSpecFromSource();
    }
  }

  async generateApiSpecFromSource() {
    const swaggerJsdoc = require('swagger-jsdoc');

    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: '中道商城系统 API',
          version: '1.0.0',
          description: '中道商城系统后端API文档',
        },
        servers: [
          {
            url: 'http://localhost:3000/api/v1',
            description: '开发环境',
          },
        ],
      },
      apis: [
        path.join(CONFIG.sourceDir, 'src/routes/v1/**/*.ts'),
        path.join(CONFIG.sourceDir, 'src/modules/**/*.ts'),
      ],
    };

    this.apiSpec = swaggerJsdoc(options);

    const outputPath = path.join(CONFIG.outputDir, 'api-docs.json');
    fs.writeFileSync(outputPath, JSON.stringify(this.apiSpec, null, 2));

    console.log('  ✓ API文档已生成');
  }

  async syncArchitectureDocs() {
    console.log('🏗️ 同步架构文档...');

    const architectureDir = path.join(CONFIG.docsDir, 'diagrams');
    const targetDir = path.join(CONFIG.portalDir, 'docs/architecture');

    // 确保目标目录存在
    fs.mkdirSync(targetDir, { recursive: true });

    // 同步C4架构图
    const c4Files = [
      'c4-model/context.md',
      'c4-model/containers.md',
    ];

    for (const file of c4Files) {
      const source = path.join(architectureDir, file);
      const target = path.join(targetDir, path.basename(file));

      if (fs.existsSync(source)) {
        fs.copyFileSync(source, target);
        console.log(`  ✓ 已同步: ${file}`);
      } else {
        this.errors.push(`架构文件不存在: ${file}`);
      }
    }

    // 生成架构概览文档
    await this.generateArchitectureOverview();
  }

  async syncADRD() {
    console.log('📝 同步ADR文档...');

    const adrSourceDir = path.join(CONFIG.docsDir, 'adr');
    const adrTargetDir = path.join(CONFIG.portalDir, 'docs/adr');

    // 确保目标目录存在
    fs.mkdirSync(adrTargetDir, { recursive: true });

    // 复制所有ADR文件
    const adrFiles = fs.readdirSync(adrSourceDir).filter(file => file.endsWith('.md'));

    for (const file of adrFiles) {
      const source = path.join(adrSourceDir, file);
      const target = path.join(adrTargetDir, file);
      fs.copyFileSync(source, target);
    }

    console.log(`  ✓ 已同步 ${adrFiles.length} 个ADR文件`);
  }

  async generateApiExamples() {
    console.log('💡 生成API示例...');

    if (!this.apiSpec) {
      console.log('  ⚠️ 跳过：API文档未生成');
      return;
    }

    const examplesDir = path.join(CONFIG.portalDir, 'docs/api-examples');
    fs.mkdirSync(examplesDir, { recursive: true });

    // 生成各模块的示例代码
    const modules = Object.keys(this.apiSpec.paths || {}).reduce((acc, path) => {
      const parts = path.split('/').filter(p => p);
      const module = parts[2] || 'default';
      if (!acc[module]) acc[module] = [];
      acc[module].push(path);
      return acc;
    }, {});

    for (const [module, paths] of Object.entries(modules)) {
      const examples = await this.generateModuleExamples(module, paths);
      const exampleFile = path.join(examplesDir, `${module}.md`);
      fs.writeFileSync(exampleFile, examples);
    }

    console.log(`  ✓ 已生成 ${Object.keys(modules).length} 个模块示例`);
  }

  async generateModuleExamples(module, paths) {
    let content = `# ${module} API 示例\n\n`;
    content += `本文档提供 ${module} 模块的常用API使用示例。\n\n`;

    for (const path of paths.slice(0, 3)) { // 只取前3个路径作为示例
      const methods = Object.keys(this.apiSpec.paths[path]);

      for (const method of methods) {
        const spec = this.apiSpec.paths[path][method];

        content += `## ${method.toUpperCase()} ${path}\n\n`;
        content += `**描述**: ${spec.summary || spec.description || '无描述'}\n\n`;

        // 添加请求示例
        if (spec.requestBody) {
          content += `### 请求示例\n\n`;
          content += `\`\`\`javascript\n`;
          content += `const response = await fetch('/api/v1${path}', {\n`;
          content += `  method: '${method.toUpperCase()}',\n`;
          content += `  headers: {\n`;
          content += `    'Content-Type': 'application/json',\n`;
          content += `    'Authorization': 'Bearer YOUR_TOKEN'\n`;
          content += `  },\n`;
          content += `  body: JSON.stringify({\n`;
          // 这里可以添加具体的请求体示例
          content += `    // 请求参数\n`;
          content += `  })\n`;
          content += `});\n`;
          content += `\`\`\`\n\n`;
        }

        // 添加响应示例
        if (spec.responses && spec.responses['200']) {
          content += `### 响应示例\n\n`;
          content += `\`\`\`json\n`;
          content += `{\n`;
          content += `  "success": true,\n`;
          content += `  "data": {\n`;
          content += `    // 响应数据\n`;
          content += `  },\n`;
          content += `  "message": "操作成功",\n`;
          content += `  "timestamp": "2025-12-09T00:00:00.000Z"\n`;
          content += `}\n`;
          content += `\`\`\`\n\n`;
        }
      }
    }

    return content;
  }

  async generateArchitectureOverview() {
    const content = `# 系统架构概述

## 系统特性

中道商城系统是一个复杂的多层级供应链社交电商平台，具有以下核心特性：

### 技术栈
- **后端**: Node.js + TypeScript + Express
- **数据库**: MySQL + Prisma ORM
- **缓存**: Redis
- **认证**: JWT
- **文档**: OpenAPI 3.0 + Swagger

### 架构模式
- **微服务架构**: 模块化服务设计
- **事件驱动**: 异步处理关键业务
- **读写分离**: 优化数据库性能
- **缓存策略**: 多级缓存提升响应速度

## 系统边界

```mermaid
flowchart LR
    A[用户] --> B[微信小程序]
    C[管理员] --> D[管理后台]
    B --> E[API网关]
    D --> E
    E --> F[后端服务]
    F --> G[MySQL]
    F --> H[Redis]
```

## 核心模块

| 模块 | 功能 | 技术特点 |
|------|------|----------|
| 用户服务 | 用户管理、团队关系 | 多层级关系计算 |
| 商品服务 | 商品目录、定价策略 | 差异化定价 |
| 订单服务 | 订单处理、业务规则 | 复杂业务流程 |
| 支付服务 | 支付集成、通券管理 | 多渠道支付 |
| 库存服务 | 多仓库管理 | 实时同步 |

## 性能指标

- **响应时间**: < 200ms (95%)
- **并发处理**: 1000+ QPS
- **可用性**: 99.9%
- **数据一致性**: 强一致性
`;

    const targetPath = path.join(CONFIG.portalDir, 'docs/architecture/overview.md');
    fs.writeFileSync(targetPath, content);
  }

  async validateDocs() {
    console.log('🔍 验证文档完整性...');

    // 检查必要文件
    const requiredFiles = [
      'docs/intro.md',
      'docs/api/authentication.md',
      'docs/architecture/overview.md',
      'docs/guides/getting-started.md',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(CONFIG.portalDir, file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`缺少必要文档: ${file}`);
      }
    }

    // 验证API文档
    if (this.apiSpec) {
      // 检查是否有接口缺少描述
      const paths = this.apiSpec.paths || {};
      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, spec] of Object.entries(methods)) {
          if (!spec.summary && !spec.description) {
            this.errors.push(`API缺少描述: ${method} ${path}`);
          }
        }
      }
    }

    console.log('  ✓ 文档验证完成');
  }

  async buildDocsPortal() {
    console.log('🔨 构建文档门户...');

    try {
      // 切换到文档门户目录
      process.chdir(CONFIG.portalDir);

      // 安装依赖（如果需要）
      if (!fs.existsSync('node_modules')) {
        console.log('  📦 安装依赖...');
        execSync('npm install', { stdio: 'inherit' });
      }

      // 构建文档
      console.log('  🏗️  构建中...');
      execSync('npm run build', { stdio: 'inherit' });

      console.log('  ✓ 文档构建成功');

      // 返回原目录
      process.chdir(CONFIG.sourceDir);
    } catch (error) {
      this.errors.push(`文档构建失败: ${error.message}`);
    }
  }
}

// 主程序
if (require.main === module) {
  const syncer = new DocsSyncer();
  syncer.run();
}

module.exports = DocsSyncer;