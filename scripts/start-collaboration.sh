#!/bin/bash
# AI协同开发工具启动脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 显示Banner
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                中道商城 AI协同开发工具                      ║"
    echo "║                      一键启动系统                           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检查依赖
check_dependencies() {
    log_info "检查依赖环境..."

    local missing_deps=()

    # 检查Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js")
    fi

    # 检查npm
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi

    # 检查TypeScript
    if ! command -v tsc &> /dev/null; then
        missing_deps+=("TypeScript (npm install -g typescript)")
    fi

    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "缺少以下依赖："
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        exit 1
    fi

    log_success "依赖检查通过"
}

# 初始化协同环境
init_collaboration() {
    log_info "初始化AI协同环境..."

    # 安装TypeScript相关依赖
    if [[ ! -d "node_modules" ]]; then
        log_info "安装项目依赖..."
        npm install
    fi

    # 确保TypeScript相关包已安装
    npm install typescript @types/node ts-node commander --save-dev

    # 初始化AI配置
    if [[ ! -f ".ai-collaboration/ai-status.json" ]]; then
        log_info "初始化AI配置..."
        npx ts-node scripts/ai-collaboration.ts init
    fi

    log_success "协同环境初始化完成"
}

# 创建示例任务
create_sample_tasks() {
    log_info "创建示例任务..."

    # 创建用户系统任务
    npx ts-node scripts/ai-collaboration.ts create-task \
        --title "实现用户等级体系" \
        --description "实现6级用户等级体系，包括普通会员、VIP会员、一星至五星店长、董事" \
        --priority high \
        --estimated-hours 16 \
        --specialist "developer-ai-1" \
        --tags "user_system,authentication,authorization"

    # 创建店铺系统任务
    npx ts-node scripts/ai-collaboration.ts create-task \
        --title "实现店铺管理系统" \
        --description "实现云店和五通店双店铺体系，包括店铺申请、等级升级、权益管理" \
        --priority high \
        --estimated-hours 20 \
        --specialist "developer-ai-2" \
        --tags "shop_system,inventory,order_processing"

    # 创建数据库设计任务
    npx ts-node scripts/ai-collaboration.ts create-task \
        --title "设计数据库架构" \
        --description "设计符合业务需求的数据库架构，包括用户、店铺、订单、库存等核心表" \
        --priority high \
        --estimated-hours 12 \
        --specialist "architect-ai-1" \
        --tags "database_design,system_design"

    # 创建API设计任务
    npx ts-node scripts/ai-collaboration.ts create-task \
        --title "设计RESTful API" \
        --description "设计符合RESTful规范的API接口，包括用户、店铺、订单、支付等模块" \
        --priority medium \
        --estimated-hours 8 \
        --specialist "architect-ai-1" \
        --tags "api_design,system_design"

    # 创建测试任务
    npx ts-node scripts/ai-collaboration.ts create-task \
        --title "编写单元测试" \
        --description "为核心业务逻辑编写完整的单元测试，确保代码质量" \
        --priority medium \
        --estimated-hours 16 \
        --specialist "testing-ai-1" \
        --tags "testing,unit_testing,quality_assurance"

    # 创建文档任务
    npx ts-node scripts/ai-collaboration.ts create-task \
        --title "编写技术文档" \
        --description "编写API文档、开发指南和部署文档" \
        --priority low \
        --estimated-hours 8 \
        --specialist "documentation-ai-1" \
        --tags "documentation,api_docs,user_guide"

    log_success "示例任务创建完成"
}

# 分配任务
assign_tasks() {
    log_info "自动分配任务..."

    # 获取待分配任务
    local tasks=$(npx ts-node -e "
        const collab = require('./scripts/ai-collaboration.ts');
        const manager = new collab.CollaborationManager();
        const pendingTasks = manager.getTasks().filter(t => t.status === 'pending');
        pendingTasks.forEach(task => {
            try {
                manager.assignTask(task.id);
                console.log(\`任务已分配: \${task.id} - \${task.title}\`);
            } catch (error) {
                console.error(\`分配失败: \${task.id} - \${error.message}\`);
            }
        });
    ")

    log_success "任务分配完成"
}

# 添加示例知识
add_sample_knowledge() {
    log_info "添加示例知识条目..."

    # 添加用户等级升级规则
    npx ts-node scripts/ai-collaboration.ts add-knowledge \
        --title "用户等级升级规则" \
        --content "用户等级升级必须满足双维度条件：1. 销量要求（总销售额÷599元）；2. 团队要求（必须有对应数量的直推下级）。两个条件必须同时满足，不可缺一。" \
        --ai "architect-ai-1" \
        --type "best_practice" \
        --tags "user_levels,business_rules,upgrade_logic"

    # 添加采购权限规则
    npx ts-node scripts/ai-collaboration.ts add-knowledge \
        --title "采购权限验证规则" \
        --content "采购权限严格遵循层级限制：只能向更高级别且非平级的上级进货。采购价格由买方等级决定，不是卖方。必须使用validatePurchasePermission函数进行验证。" \
        --ai "developer-ai-1" \
        --type "business_rules" \
        --tags "purchase_permissions,business_rules,validation"

    # 添加积分流转规则
    npx ts-node scripts/ai-collaboration.ts add-knowledge \
        --title "积分流转安全规则" \
        --content "所有积分操作必须使用数据库事务确保数据一致性。积分转账时必须检查余额，使用乐观锁防止并发问题。记录完整的流水用于审计追踪。" \
        --ai "developer-ai-2" \
        --type "best_practice" \
        --tags "points_flow,transactions,security,data_consistency"

    # 添加双仓库存管理规则
    npx ts-node scripts/ai-collaboration.ts add-knowledge \
        --title "双仓库存管理规则" \
        --content "云仓是团队共享的虚拟库存，下级可采购但不可退货。本地仓是个人实体库存，支持退货。库存流转只能从云仓到本地仓，不可逆向。" \
        --ai "developer-ai-2" \
        --type "business_rules" \
        --tags "inventory_management,cloud_warehouse,local_warehouse"

    log_success "示例知识添加完成"
}

# 显示协同状态
show_status() {
    log_info "当前协同状态："
    echo ""

    # 显示AI状态
    echo "🤖 AI状态："
    npx ts-node scripts/ai-collaboration.ts ai-status
    echo ""

    # 显示任务列表
    echo "📋 任务列表："
    npx ts-node scripts/ai-collaboration.ts tasks
    echo ""

    # 检测冲突
    echo "🔍 冲突检测："
    npx ts-node scripts/ai-collaboration.ts detect-conflicts
    echo ""
}

# 启动监控
start_monitoring() {
    log_info "启动协同监控..."

    # 创建监控脚本
    cat > scripts/collaboration-monitor.sh << 'EOF'
#!/bin/bash
# 协同监控脚本

while true; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 执行协同检查..."

    # 检测冲突
    conflicts=$(npx ts-node scripts/ai-collaboration.ts detect-conflicts 2>/dev/null | grep -c "检测到")

    if [ "$conflicts" -gt 0 ]; then
        echo "⚠️ 发现 $conflicts 个冲突，需要处理"
    fi

    # 检查任务进度
    blocked_tasks=$(npx ts-node scripts/ai-collaboration.ts tasks --status blocked 2>/dev/null | grep -c "🚫")

    if [ "$blocked_tasks" -gt 0 ]; then
        echo "🚫 有 $blocked_tasks 个被阻塞的任务"
    fi

    # 检查AI负载
    busy_ais=$(npx ts-node scripts/ai-collaboration.ts ai-status 2>/dev/null | grep -c "🔄 忙碌")

    if [ "$busy_ais" -ge 4 ]; then
        echo "🔄 大部分AI都在忙碌中，考虑负载均衡"
    fi

    sleep 300  # 5分钟检查一次
done
EOF

    chmod +x scripts/collaboration-monitor.sh

    # 启动监控
    nohup scripts/collaboration-monitor.sh > logs/collaboration-monitor.log 2>&1 &
    MONITOR_PID=$!

    echo "协同监控已启动，PID: $MONITOR_PID"
    echo "监控日志: logs/collaboration-monitor.log"
}

# 显示使用指南
show_usage_guide() {
    echo ""
    echo "==================== 使用指南 ===================="
    echo ""
    echo "🚀 常用命令："
    echo "  ./scripts/start-collaboration.sh          # 启动协同系统"
    echo "  ./scripts/start-collaboration.sh status    # 查看状态"
    echo "  ./scripts/start-collaboration.sh monitor   # 启动监控"
    echo ""
    echo "📝 任务管理："
    echo "  npx ts-node scripts/ai-collaboration.ts create-task [选项]"
    echo "  npx ts-node scripts/ai-collaboration.ts assign-task <taskId>"
    echo "  npx ts-node scripts/ai-collaboration.ts update-task <taskId> <status>"
    echo ""
    echo "👥 AI管理："
    echo "  npx ts-node scripts/ai-collaboration.ts ai-status"
    echo "  npx ts-node scripts/ai-collaboration.ts report"
    echo ""
    echo "📚 知识管理："
    echo "  npx ts-node scripts/ai-collaboration.ts add-knowledge [选项]"
    echo "  npx ts-node scripts/ai-collaboration.ts search-knowledge <query>"
    echo ""
    echo "🔍 冲突管理："
    echo "  npx ts-node scripts/ai-collaboration.ts detect-conflicts"
    echo ""
    echo "=================================================="
}

# 主函数
main() {
    local command=${1:-start}

    case $command in
        "start")
            show_banner
            check_dependencies
            init_collaboration
            create_sample_tasks
            assign_tasks
            add_sample_knowledge
            start_monitoring
            show_status
            show_usage_guide
            ;;
        "status")
            show_status
            ;;
        "monitor")
            start_monitoring
            ;;
        "reset")
            log_warning "重置协同环境..."
            rm -rf .ai-collaboration
            init_collaboration
            create_sample_tasks
            add_sample_knowledge
            log_success "协同环境已重置"
            ;;
        "help"|"--help"|"-h")
            echo "用法: $0 [command]"
            echo ""
            echo "命令:"
            echo "  start    启动协同系统（默认）"
            echo "  status   查看协同状态"
            echo "  monitor  启动监控"
            echo "  reset    重置协同环境"
            echo "  help     显示帮助信息"
            ;;
        *)
            log_error "未知命令: $command"
            echo "使用 '$0 help' 查看帮助信息"
            exit 1
            ;;
    esac
}

# 检查是否在项目根目录
if [[ ! -f "package.json" ]]; then
    log_error "请在项目根目录运行此脚本"
    exit 1
fi

# 创建必要目录
mkdir -p logs

# 执行主函数
main "$@"