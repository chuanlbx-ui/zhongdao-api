#!/bin/bash

# 中道商城 - 运行所有测试脚本
# 该脚本会依次运行所有测试套件并生成报告

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# 创建日志目录
LOG_DIR="logs/test"
mkdir -p $LOG_DIR

# 时间戳
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="reports/test/$TIMESTAMP"
mkdir -p $REPORT_DIR

# 测试结果汇总
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_SUITES=()

# 运行单个测试套件
run_test_suite() {
    local suite_name=$1
    local test_file=$2
    local log_file="$LOG_DIR/${suite_name}_${TIMESTAMP}.log"

    print_message "运行测试套件: $suite_name"
    echo "日志文件: $log_file"

    # 运行测试并捕获输出
    if npm test -- $test_file --reporter=verbose --run > "$log_file" 2>&1; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        print_message "✓ $suite_name 测试通过"

        # 移动测试报告到报告目录
        if [ -f "test-results.html" ]; then
            mv test-results.html "$REPORT_DIR/${suite_name}.html"
        fi
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_SUITES+=("$suite_name")
        print_error "✗ $suite_name 测试失败"

        # 保留失败日志的详细信息
        echo "----------------------------------------" >> "$REPORT_DIR/failed_tests.log"
        echo "失败的测试套件: $suite_name" >> "$REPORT_DIR/failed_tests.log"
        echo "时间: $(date)" >> "$REPORT_DIR/failed_tests.log"
        echo "----------------------------------------" >> "$REPORT_DIR/failed_tests.log"
        tail -50 "$log_file" >> "$REPORT_DIR/failed_tests.log"
        echo "" >> "$REPORT_DIR/failed_tests.log"
    fi

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# 生成测试摘要报告
generate_summary_report() {
    local summary_file="$REPORT_DIR/test_summary.html"

    cat > "$summary_file" << EOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>中道商城 API 测试报告</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .summary-card.success {
            background: linear-gradient(135deg, #00b09b 0%, #96c93d 100%);
        }
        .summary-card.danger {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 48px;
        }
        .summary-card p {
            margin: 0;
            font-size: 18px;
            opacity: 0.9;
        }
        .test-list {
            margin-top: 30px;
        }
        .test-item {
            background: #f8f9fa;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .test-item.passed {
            border-left: 4px solid #28a745;
        }
        .test-item.failed {
            border-left: 4px solid #dc3545;
        }
        .status {
            font-weight: bold;
        }
        .status.passed {
            color: #28a745;
        }
        .status.failed {
            color: #dc3545;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .chart-container {
            margin: 30px 0;
            height: 300px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>中道商城 API 测试报告</h1>

        <div class="summary">
            <div class="summary-card">
                <h3>$TOTAL_TESTS</h3>
                <p>总测试套件</p>
            </div>
            <div class="summary-card success">
                <h3>$PASSED_TESTS</h3>
                <p>通过</p>
            </div>
            <div class="summary-card danger">
                <h3>$FAILED_TESTS</h3>
                <p>失败</p>
            </div>
            <div class="summary-card">
                <h3>$(((PASSED_TESTS * 100) / TOTAL_TESTS))%</h3>
                <p>成功率</p>
            </div>
        </div>

        <div class="chart-container">
            <canvas id="testChart"></canvas>
        </div>

        <div class="test-list">
            <h2>测试结果详情</h2>
EOF

    # 添加测试结果
    for suite in "${FAILED_SUITES[@]}"; do
        cat >> "$summary_file" << EOF
            <div class="test-item failed">
                <span>$suite</span>
                <span class="status failed">失败</span>
            </div>
EOF
    done

    # 如果有失败的测试，显示错误详情
    if [ $FAILED_TESTS -gt 0 ]; then
        cat >> "$summary_file" << EOF
            <div style="margin-top: 30px;">
                <h3>失败测试详情</h3>
                <pre style="background: #f5f5f5; padding: 20px; border-radius: 5px; overflow: auto;">
$(cat "$REPORT_DIR/failed_tests.log")
                </pre>
            </div>
EOF
    fi

    cat >> "$summary_file" << EOF
        </div>

        <div class="footer">
            <p>测试执行时间: $(date)</p>
            <p>报告生成时间: $(date)</p>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        const ctx = document.getElementById('testChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['通过', '失败'],
                datasets: [{
                    data: [$PASSED_TESTS, $FAILED_TESTS],
                    backgroundColor: ['#28a745', '#dc3545'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    </script>
</body>
</html>
EOF

    print_message "测试摘要报告已生成: $summary_file"
}

# 主函数
main() {
    print_section "中道商城 API 测试执行"
    print_message "开始时间: $(date)"
    print_message "报告目录: $REPORT_DIR"

    # 检查依赖
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装，请先安装 Node.js"
        exit 1
    fi

    # 确保数据库连接正常
    print_message "检查数据库连接..."
    if ! npm run db:validate &> /dev/null; then
        print_warning "数据库验证失败，尝试重新连接..."
        npm run db:push
    fi

    # 清理旧的测试数据
    print_message "清理旧的测试数据..."
    npm run db:clean &> /dev/null || true

    # 生成测试数据
    print_section "生成测试数据"
    print_message "生成 Comprehensive 级别测试数据..."
    if npm run db:seed:comprehensive; then
        print_message "✓ 测试数据生成成功"
    else
        print_error "✗ 测试数据生成失败"
        exit 1
    fi

    # 运行测试套件
    print_section "执行测试套件"

    # 核心API测试
    run_test_suite "用户管理" "tests/api/users.test.ts"
    run_test_suite "店铺管理" "tests/api/shops.test.ts"
    run_test_suite "库存管理" "tests/api/inventory.test.ts"
    run_test_suite "团队管理" "tests/api/teams.test.ts"
    run_test_suite "佣金管理" "tests/api/commission.test.ts"
    run_test_suite "五通店权益" "tests/api/wutong-benefit.test.ts"

    # 已有的测试
    run_test_suite "认证系统" "tests/api/auth.test.ts"
    run_test_suite "商品管理" "tests/api/products.test.ts"
    run_test_suite "订单管理" "tests/api/orders.test.ts"
    run_test_suite "支付系统" "tests/api/payments.test.ts"
    run_test_suite "积分系统" "tests/api/points.test.ts"

    # 集成测试和性能测试
    run_test_suite "集成测试" "tests/api/integration.test.ts"
    run_test_suite "性能测试" "tests/api/performance.test.ts"

    # 生成报告
    print_section "生成测试报告"
    generate_summary_report

    # 打印测试结果摘要
    print_section "测试结果摘要"
    echo -e "总测试套件: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "失败: ${RED}$FAILED_TESTS${NC}"
    echo -e "成功率: ${BLUE}$(((PASSED_TESTS * 100) / TOTAL_TESTS))%${NC}"

    if [ $FAILED_TESTS -gt 0 ]; then
        echo ""
        print_error "失败的测试套件:"
        for suite in "${FAILED_SUITES[@]}"; do
            echo -e "  - ${RED}$suite${NC}"
        done
    fi

    echo ""
    print_message "测试完成！"
    print_message "详细报告: $REPORT_DIR/test_summary.html"
    print_message "结束时间: $(date)"

    # 返回适当的退出码
    if [ $FAILED_TESTS -gt 0 ]; then
        exit 1
    else
        exit 0
    fi
}

# 执行主函数
main "$@"