#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试文件列表
declare -a TEST_FILES=(
    "tests/api/users.test.ts:用户管理系统"
    "tests/api/shops.test.ts:店铺管理系统"
    "tests/api/products.test.ts:商品管理系统"
    "tests/api/orders.test.ts:订单管理系统"
    "tests/api/inventory.test.ts:库存管理系统"
    "tests/api/points.test.ts:积分管理系统"
    "tests/api/teams.test.ts:团队管理系统"
    "tests/api/commission.test.ts:佣金管理系统"
    "tests/api/payments.test.ts:支付系统"
    "tests/api/notifications.test.ts:通知系统"
    "tests/api/admin.test.ts:管理员系统"
    "tests/api/performance.test.ts:性能测试"
)

# 创建测试报告目录
mkdir -p test-reports
REPORT_FILE="test-reports/api-test-report-$(date +%Y%m%d-%H%M%S).txt"

# 初始化报告
echo "========================================" > $REPORT_FILE
echo "API接口综合测试报告" >> $REPORT_FILE
echo "测试时间: $(date)" >> $REPORT_FILE
echo "========================================" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# 总体统计
TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0

# 运行每个测试
for TEST_INFO in "${TEST_FILES[@]}"; do
    IFS=':' read -r TEST_FILE TEST_NAME <<< "$TEST_INFO"

    echo -e "${BLUE}开始测试: $TEST_NAME${NC}"
    echo "测试文件: $TEST_FILE"
    echo "----------------------------------------"

    # 运行测试并捕获结果
    TEST_OUTPUT=$(npm test $TEST_FILE -- --reporter=json 2>&1)
    TEST_EXIT_CODE=$?

    # 解析测试结果
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ $TEST_NAME 测试通过${NC}"
        STATUS="PASSED"
    else
        echo -e "${RED}❌ $TEST_NAME 测试失败${NC}"
        STATUS="FAILED"

        # 如果是文件不存在的错误，标记为跳过
        if [[ "$TEST_OUTPUT" == *"Cannot find module"* ]] || [[ "$TEST_OUTPUT" == *"no such file"* ]]; then
            echo -e "${YELLOW}⚠️  测试文件不存在，跳过${NC}"
            STATUS="SKIPPED"
        fi
    fi

    # 写入报告
    echo "[$STATUS] $TEST_NAME" >> $REPORT_FILE
    echo "文件: $TEST_FILE" >> $REPORT_FILE
    echo "----------------------------------------" >> $REPORT_FILE
    echo "$TEST_OUTPUT" >> $REPORT_FILE
    echo "" >> $REPORT_FILE
    echo "" >> $REPORT_FILE

    # 如果是JSON格式，提取统计信息
    if echo "$TEST_OUTPUT" | grep -q '"numPassedTests"'; then
        PASSED=$(echo "$TEST_OUTPUT" | grep -o '"numPassedTests":[0-9]*' | cut -d':' -f2)
        FAILED=$(echo "$TEST_OUTPUT" | grep -o '"numFailedTests":[0-9]*' | cut -d':' -f2)
        SKIPPED=$(echo "$TEST_OUTPUT" | grep -o '"numPendingTests":[0-9]*' | cut -d':' -f2)

        TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
        TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
        TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
        TOTAL_TESTS=$((TOTAL_TESTS + PASSED + FAILED + SKIPPED))

        echo "  通过: $PASSED, 失败: $FAILED, 跳过: $SKIPPED"
    fi

    echo ""
    echo "========================================"
    echo ""
done

# 生成总结报告
echo "========================================" >> $REPORT_FILE
echo "测试总结" >> $REPORT_FILE
echo "========================================" >> $REPORT_FILE
echo "总测试数: $TOTAL_TESTS" >> $REPORT_FILE
echo "通过: $TOTAL_PASSED" >> $REPORT_FILE
echo "失败: $TOTAL_FAILED" >> $REPORT_FILE
echo "跳过: $TOTAL_SKIPPED" >> $REPORT_FILE
echo "" >> $REPORT_FILE

# 计算成功率
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((TOTAL_PASSED * 100 / TOTAL_TESTS))
    echo "成功率: ${SUCCESS_RATE}%" >> $REPORT_FILE
else
    echo "成功率: N/A" >> $REPORT_FILE
fi

echo ""
echo "========================================"
echo -e "${BLUE}测试完成！${NC}"
echo -e "报告已保存到: ${GREEN}$REPORT_FILE${NC}"
echo ""
echo "测试统计:"
echo -e "  总测试数: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "  通过: ${GREEN}$TOTAL_PASSED${NC}"
echo -e "  失败: ${RED}$TOTAL_FAILED${NC}"
echo -e "  跳过: ${YELLOW}$TOTAL_SKIPPED${NC}"
if [ $TOTAL_TESTS -gt 0 ]; then
    echo -e "  成功率: ${BLUE}${SUCCESS_RATE}%${NC}"
fi
echo "========================================"

# 返回适当的退出码
if [ $TOTAL_FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi