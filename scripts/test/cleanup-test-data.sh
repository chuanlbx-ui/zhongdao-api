#!/bin/bash

# 中道商城 - 清理测试数据脚本
# 该脚本会清理所有测试相关的数据

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

# 确认提示
confirm() {
    local message=$1
    local default=${2:-n}

    if [[ "$default" == "y" ]]; then
        read -p "$message (Y/n): " -r response
        case "$response" in
            [nN][oO]|[nN]) return 1 ;;
            *) return 0 ;;
        esac
    else
        read -p "$message (y/N): " -r response
        case "$response" in
            [yY][eE][sS]|[yY]) return 0 ;;
            *) return 1 ;;
        esac
    fi
}

# 清理测试数据库
cleanup_test_database() {
    print_section "清理测试数据库"

    if confirm "是否清理所有测试数据？这将删除所有数据！" "n"; then
        print_message "开始清理数据库..."

        # 获取数据库连接信息
        DB_URL=${DATABASE_URL:-"mysql://dev_user:dev_password_123@127.0.0.1:3306/zhongdao_mall_dev?authPlugin=mysql_native_password"}

        # 使用Prisma清理数据
        print_message "清理订单相关数据..."
        npm run tsx -- -e "
        import { PrismaClient } from '@prisma/client';
        const prisma = new PrismaClient();

        async function cleanup() {
            const tables = [
                'OrderItem', 'RefundRecord', 'PaymentLog',
                'Order', 'Cart', 'CouponUsage'
            ];

            for (const table of tables) {
                try {
                    await prisma.\$executeRawUnsafe('DELETE FROM ' + table + ';');
                    console.log('  ✓ 清理表: ' + table);
                } catch (e) {
                    console.log('  ⚠️ 跳过表: ' + table);
                }
            }
            await prisma.\$disconnect();
        }

        cleanup().catch(console.error);
        "

        print_message "清理用户相关数据（保留管理员）..."
        npm run tsx -- -e "
        import { PrismaClient } from '@prisma/client';
        const prisma = new PrismaClient();

        async function cleanup() {
            // 删除非管理员的测试用户
            await prisma.users.deleteMany({
                where: {
                    NOT: [
                        { level: 'DIRECTOR' },
                        { openid: { startsWith: 'admin_' } }
                    ]
                }
            });

            console.log('  ✓ 清理测试用户');

            const tables = [
                'ReferralRecord', 'TeamRelation', 'UserStatistics',
                'Notification', 'GiftRecord', 'CommissionCalculation'
            ];

            for (const table of tables) {
                try {
                    await prisma.\$executeRawUnsafe('DELETE FROM ' + table + ';');
                    console.log('  ✓ 清理表: ' + table);
                } catch (e) {
                    console.log('  ⚠️ 跳过表: ' + table);
                }
            }

            await prisma.\$disconnect();
        }

        cleanup().catch(console.error);
        "

        print_message "清理其他测试数据..."
        npm run tsx -- -e "
        import { PrismaClient } from '@prisma/client';
        const prisma = new PrismaClient();

        async function cleanup() {
            const tables = [
                'PointsTransaction', 'InventoryTransaction',
                'Shop', 'Product', 'ProductCategory',
                'InventoryItem', 'Warehouse'
            ];

            for (const table of tables) {
                try {
                    await prisma.\$executeRawUnsafe('DELETE FROM ' + table + ';');
                    console.log('  ✓ 清理表: ' + table);
                } catch (e) {
                    console.log('  ⚠️ 跳过表: ' + table);
                }
            }

            await prisma.\$disconnect();
        }

        cleanup().catch(console.error);
        "

        print_message "✓ 测试数据库清理完成"
    fi
}

# 清理日志文件
cleanup_logs() {
    print_section "清理日志文件"

    if confirm "是否清理所有测试日志？" "y"; then
        # 清理测试日志
        if [ -d "logs/test" ]; then
            print_message "清理测试日志..."
            rm -rf logs/test/*
            print_message "✓ 测试日志已清理"
        fi

        # 清理覆盖率报告
        if [ -d "coverage" ]; then
            print_message "清理覆盖率报告..."
            rm -rf coverage/*
            print_message "✓ 覆盖率报告已清理"
        fi

        # 清理临时文件
        print_message "清理临时文件..."
        find . -name ".nyc_output" -type d -exec rm -rf {} + 2>/dev/null || true
        find . -name "test-results.*" -delete 2>/dev/null || true
        print_message "✓ 临时文件已清理"
    fi
}

# 清理测试报告
cleanup_reports() {
    print_section "清理测试报告"

    if confirm "是否清理所有测试报告？" "n"; then
        if [ -d "reports/test" ]; then
            print_message "清理测试报告..."
            # 保留最新的5个报告
            cd reports/test
            ls -t | tail -n +6 | xargs -r rm -rf
            cd - > /dev/null
            print_message "✓ 旧报告已清理（保留最新5个）"
        fi
    fi
}

# 清理node_modules中的测试文件
cleanup_node_modules() {
    print_section "清理测试相关的node_modules"

    if confirm "是否清理测试缓存？" "y"; then
        # 清理npm缓存
        print_message "清理npm缓存..."
        npm cache clean --force > /dev/null 2>&1 || true

        # 清理.nyc_output
        if [ -d ".nyc_output" ]; then
            rm -rf .nyc_output
        fi

        # 重新安装依赖
        print_message "重新安装依赖..."
        npm install > /dev/null 2>&1
        print_message "✓ 依赖已重新安装"
    fi
}

# 重置环境
reset_environment() {
    print_section "重置测试环境"

    print_message "停止所有开发服务器..."
    pkill -f "npm run dev" 2>/dev/null || true
    pkill -f "ts-node" 2>/dev/null || true
    pkill -f "nodemon" 2>/dev/null || true

    sleep 2

    print_message "清理进程..."
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        taskkill /F /IM node.exe 2>/dev/null || true
    else
        pkill -f node 2>/dev/null || true
    fi

    print_message "✓ 环境已重置"
}

# 生成清理报告
generate_cleanup_report() {
    print_section "生成清理报告"

    local report_file="reports/cleanup_report_$(date +%Y%m%d_%H%M%S).txt"
    mkdir -p reports

    cat > "$report_file" << EOF
中道商城测试环境清理报告
============================
清理时间: $(date)
清理人: ${USER:-未知}

清理项目:
EOF

    if [ $? -eq 0 ]; then
        echo "- 测试数据库: 已清理" >> "$report_file"
    else
        echo "- 测试数据库: 未清理" >> "$report_file"
    fi

    echo "- 日志文件: 已清理" >> "$report_file"
    echo "- 测试报告: 已清理" >> "$report_file"
    echo "- 测试缓存: 已清理" >> "$report_file"
    echo "- 运行环境: 已重置" >> "$report_file"

    echo "" >> "$report_file"
    echo "清理完成！" >> "$report_file"

    print_message "清理报告已生成: $report_file"
}

# 主函数
main() {
    print_section "中道商城测试环境清理工具"

    # 检查是否在项目根目录
    if [ ! -f "package.json" ]; then
        print_error "请在项目根目录运行此脚本"
        exit 1
    fi

    print_warning "此操作将清理所有测试相关的数据"
    print_warning "请确保已备份重要数据"

    # 显示清理选项
    echo ""
    echo "请选择清理选项："
    echo "1) 清理所有（推荐）"
    echo "2) 仅清理测试数据库"
    echo "3) 仅清理日志文件"
    echo "4) 仅清理测试报告"
    echo "5) 仅重置环境"
    echo "6) 自定义选择"
    echo ""

    read -p "请输入选项 (1-6): " -n 1 -r
    echo ""

    case "$REPLY" in
        1)
            cleanup_test_database
            cleanup_logs
            cleanup_reports
            reset_environment
            ;;
        2)
            cleanup_test_database
            ;;
        3)
            cleanup_logs
            ;;
        4)
            cleanup_reports
            ;;
        5)
            reset_environment
            ;;
        6)
            echo ""
            confirm "清理测试数据库？" "n" && cleanup_test_database
            confirm "清理日志文件？" "y" && cleanup_logs
            confirm "清理测试报告？" "n" && cleanup_reports
            confirm "重置环境？" "n" && reset_environment
            ;;
        *)
            print_error "无效的选项"
            exit 1
            ;;
    esac

    # 生成清理报告
    generate_cleanup_report

    print_section "清理完成"
    print_message "测试环境已清理干净"
    print_message "可以运行 'npm run test:comprehensive' 重新开始测试"
}

# 执行主函数
main "$@"