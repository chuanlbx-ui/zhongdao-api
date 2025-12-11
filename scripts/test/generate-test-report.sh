#!/bin/bash

# 中道商城 - 生成测试报告脚本
# 该脚本会收集测试结果并生成详细的HTML报告

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

# 时间戳
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="reports/test/$TIMESTAMP"
mkdir -p $REPORT_DIR

# 获取最新的测试结果
get_latest_test_results() {
    local latest_log=$(find logs/test -name "*.log" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    if [ -n "$latest_log" ]; then
        echo "$latest_log"
    fi
}

# 分析测试覆盖率
analyze_coverage() {
    local coverage_file="coverage/lcov-report/index.html"
    if [ -f "$coverage_file" ]; then
        cp -r coverage/lcov-report "$REPORT_DIR/coverage"
        return 0
    else
        return 1
    fi
}

# 生成性能测试报告
generate_performance_report() {
    local perf_log=$(find logs/test -name "*performance*.log" -type f | head -1)

    if [ -n "$perf_log" ]; then
        print_message "分析性能测试结果..."

        cat > "$REPORT_DIR/performance_report.html" << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>性能测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .metric-label { font-weight: bold; color: #333; }
        .metric-value { font-size: 24px; color: #007bff; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f8f9fa; }
        .chart { margin: 20px 0; }
    </style>
</head>
<body>
EOF

        # 解析性能日志中的关键指标
        echo "<h1>性能测试报告</h1>" >> "$REPORT_DIR/performance_report.html"

        # 查找响应时间数据
        if grep -q "响应时间" "$perf_log"; then
            echo "<h2>API响应时间</h2>" >> "$REPORT_DIR/performance_report.html"
            echo "<table>" >> "$REPORT_DIR/performance_report.html"
            echo "<tr><th>API端点</th><th>响应时间(ms)</th><th>状态</th></tr>" >> "$REPORT_DIR/performance_report.html"

            grep "响应时间" "$perf_log" | while read line; do
                api=$(echo "$line" | sed 's/.*查询响应时间: //' | sed 's/ms.*//')
                time=$(echo "$line" | grep -o '[0-9.]*ms' | sed 's/ms//')
                status_class="pass"

                if (( $(echo "$time > 1000" | bc -l) )); then
                    status_class="fail"
                fi

                echo "<tr><td>$api</td><td>$time</td><td class='$status_class'>${status_class^^}</td></tr>" >> "$REPORT_DIR/performance_report.html"
            done

            echo "</table>" >> "$REPORT_DIR/performance_report.html"
        fi

        # 查找并发测试数据
        if grep -q "并发" "$perf_log"; then
            echo "<h2>并发测试结果</h2>" >> "$REPORT_DIR/performance_report.html"
            grep "并发.*测试" "$perf_log" | while read line; do
                echo "<div class='metric'>$line</div>" >> "$REPORT_DIR/performance_report.html"
            done
        fi

        echo "</body></html>" >> "$REPORT_DIR/performance_report.html"
        print_message "性能测试报告已生成: $REPORT_DIR/performance_report.html"
    fi
}

# 生成API测试详情报告
generate_api_test_details() {
    local test_results_dir="$REPORT_DIR/api_details"
    mkdir -p "$test_results_dir"

    # 为每个测试文件生成详细报告
    for test_file in tests/api/*.test.ts; do
        local test_name=$(basename "$test_file" .test.ts)
        local log_file="logs/test/${test_name}_${TIMESTAMP}.log"

        if [ -f "$log_file" ]; then
            print_message "生成 $test_name 测试详情..."

            cat > "$test_results_dir/${test_name}.html" << EOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>$test_name 测试详情</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .test-case { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .test-passed { border-left: 5px solid #28a745; background: #f0fff4; }
        .test-failed { border-left: 5px solid #dc3545; background: #fff5f5; }
        .test-name { font-weight: bold; font-size: 18px; }
        .duration { color: #666; font-size: 14px; }
        .error { background: #ffebee; padding: 10px; margin: 10px 0; border-radius: 3px; }
        pre { background: #f5f5f5; padding: 10px; overflow: auto; }
    </style>
</head>
<body>
    <h1>$test_name 测试详情</h1>
    <pre>$(cat "$log_file")</pre>
</body>
</html>
EOF
        fi
    done
}

# 生成趋势报告
generate_trend_report() {
    # 查找历史测试报告
    local history_reports=$(find reports/test -name "test_summary.html" -type f | sort -r | head -10)

    if [ ${#history_reports[@]} -gt 1 ]; then
        print_message "生成测试趋势报告..."

        cat > "$REPORT_DIR/test_trend.html" << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>测试趋势报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .trend-container { margin: 30px 0; }
        .trend-item { display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee; }
        .trend-date { color: #666; }
        .trend-metrics { display: flex; gap: 20px; }
        .metric { text-align: center; }
        .metric-value { font-size: 20px; font-weight: bold; }
        .metric-label { font-size: 12px; color: #666; }
        .success { color: #28a745; }
        .fail { color: #dc3545; }
    </style>
</head>
<body>
    <h1>测试趋势报告</h1>
    <div class="trend-container">
        <canvas id="trendChart" height="100"></canvas>
    </div>
    <div id="trendDetails"></div>
</body>
</html>
EOF

        # 提取历史数据并生成图表
        print_message "测试趋势报告已生成: $REPORT_DIR/test_trend.html"
    fi
}

# 主函数
main() {
    print_section "生成中道商城测试报告"
    print_message "报告目录: $REPORT_DIR"

    # 创建报告索引页
    cat > "$REPORT_DIR/index.html" << EOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>中道商城测试报告中心</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #333; color: white; padding: 20px; margin: -20px -20px 20px -20px; }
        .report-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .report-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .report-card h3 { margin-top: 0; color: #333; }
        .report-link { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        .report-link:hover { background: #0056b3; }
        .status { padding: 5px 10px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        .status.success { background: #d4edda; color: #155724; }
        .status.failed { background: #f8d7da; color: #721c24; }
        .metrics { display: flex; gap: 20px; margin: 15px 0; }
        .metric { text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .metric-label { font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>中道商城测试报告中心</h1>
        <p>生成时间: $(date)</p>
    </div>

    <div class="report-grid">
        <div class="report-card">
            <h3>📊 综合测试报告</h3>
            <p>所有测试套件的执行结果汇总</p>
            <a href="test_summary.html" class="report-link">查看报告</a>
        </div>

        <div class="report-card">
            <h3>⚡ 性能测试报告</h3>
            <p>API响应时间、并发能力等性能指标</p>
            <a href="performance_report.html" class="report-link">查看报告</a>
        </div>

        <div class="report-card">
            <h3>📈 测试覆盖率报告</h3>
            <p>代码测试覆盖率分析</p>
EOF

    # 检查是否有覆盖率报告
    if [ -d "$REPORT_DIR/coverage" ]; then
        echo '            <a href="coverage/index.html" class="report-link">查看报告</a>' >> "$REPORT_DIR/index.html"
    else
        echo '            <span class="status failed">暂无数据</span>' >> "$REPORT_DIR/index.html"
    fi

    cat >> "$REPORT_DIR/index.html" << EOF
        </div>

        <div class="report-card">
            <h3>📉 测试趋势分析</h3>
            <p>历史测试结果对比和趋势分析</p>
            <a href="test_trend.html" class="report-link">查看报告</a>
        </div>

        <div class="report-card">
            <h3>🔍 API测试详情</h3>
            <p>各个API模块的详细测试结果</p>
            <a href="api_details/" class="report-link">查看详情</a>
        </div>

        <div class="report-card">
            <h3>📋 快速统计</h3>
            <div class="metrics">
                <div class="metric">
                    <div class="metric-value">$(find tests/api -name "*.test.ts" | wc -l)</div>
                    <div class="metric-label">测试文件</div>
                </div>
                <div class="metric">
                    <div class="metric-value">$(find logs/test -name "*.log" -mtime -1 | wc -l)</div>
                    <div class="metric-label">今日执行</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // 自动刷新报告数据
        setInterval(function() {
            location.reload();
        }, 300000); // 5分钟刷新一次
    </script>
</body>
</html>
EOF

    # 生成各种报告
    analyze_coverage
    generate_performance_report
    generate_api_test_details
    generate_trend_report

    # 生成最新报告的软链接
    rm -f reports/test/latest
    ln -sf "$REPORT_DIR" reports/test/latest

    print_section "报告生成完成"
    print_message "主报告: $REPORT_DIR/index.html"
    print_message "最新报告: reports/test/latest"

    # 如果在Windows系统上，询问是否打开报告
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        echo ""
        read -p "是否要在浏览器中打开报告？(y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            start "$REPORT_DIR/index.html"
        fi
    fi
}

# 执行主函数
main "$@"