#!/bin/bash

# 中道商城服务器快速健康检查脚本
# 用于快速评估服务器是否适合部署

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查结果变量
ISSUES=0
WARNINGS=0

# 输出函数
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  中道商城服务器健康检查报告${NC}"
    echo -e "${BLUE}  检查时间: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_error() {
    echo -e "  ${RED}✗${NC} $1"
    ((ISSUES++))
}

print_section() {
    echo -e "${BLUE}📊 $1${NC}"
    echo ""
}

# 检查系统基本信息
check_system_info() {
    print_section "系统基本信息"

    local os_info=$(lsb_release -d 2>/dev/null | cut -f2 || echo "Unknown")
    local kernel=$(uname -r)
    local uptime=$(uptime -p 2>/dev/null | sed 's/up //' || echo "Unknown")

    echo "  操作系统: $os_info"
    echo "  内核版本: $kernel"
    echo "  运行时间: $uptime"

    if [[ $os_info == *"Ubuntu 22.04"* ]]; then
        print_success "操作系统版本符合要求"
    else
        print_warning "建议使用Ubuntu 22.04 LTS"
    fi
    echo ""
}

# 检查CPU信息
check_cpu() {
    print_section "CPU信息检查"

    local cpu_model=$(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)
    local cpu_cores=$(nproc)
    local cpu_threads=$(lscpu | grep 'CPU(s):' | awk '{print $2}')

    echo "  CPU型号: $cpu_model"
    echo "  物理核心: $cpu_cores"
    echo "  逻辑线程: $cpu_threads"

    if [[ $cpu_cores -ge 4 ]]; then
        print_success "CPU核心数充足 ($cpu_cores 核)"
    elif [[ $cpu_cores -ge 2 ]]; then
        print_warning "CPU核心数较少 ($cpu_cores 核)，建议4核以上"
    else
        print_error "CPU核心数不足 ($cpu_cores 核)，强烈建议升级"
    fi

    # 检查CPU架构年代
    if [[ $cpu_model == *"E5620"* ]]; then
        print_error "检测到老旧CPU架构 (Xeon E5620)，性能可能严重不足"
    elif [[ $cpu_model == *"E5"* ]]; then
        print_warning "检测到较老CPU架构，建议升级到现代CPU"
    fi
    echo ""
}

# 检查内存信息
check_memory() {
    print_section "内存信息检查"

    local mem_info=$(free -h | grep '^Mem:')
    local total_mem=$(echo $mem_info | awk '{print $2}')
    local used_mem=$(echo $mem_info | awk '{print $3}')
    local free_mem=$(echo $mem_info | awk '{print $4}')
    local available_mem=$(free -h | grep '^Mem:' | awk '{print $7}')

    # 转换为MB进行比较
    local total_mb=$(free -m | grep '^Mem:' | awk '{print $2}')
    local available_mb=$(free -m | grep '^Mem:' | awk '{print $7}')
    local usage_percent=$(echo "scale=1; ($total_mb - $available_mb) * 100 / $total_mb" | bc -l)

    echo "  总内存: $total_mem"
    echo "  已使用: $used_mem"
    echo "  空闲: $free_mem"
    echo "  可用: $available_mem"
    echo "  使用率: ${usage_percent}%"

    if [[ $total_mb -ge 16384 ]]; then
        print_success "内存容量充足 (16GB+)"
    elif [[ $total_mb -ge 8192 ]]; then
        print_warning "内存容量一般 (8GB)，建议16GB以上"
    else
        print_error "内存容量不足 (8GB以下)，强烈建议升级到16GB+"
    fi

    if [[ $available_mb -ge 4096 ]]; then
        print_success "可用内存充足 (${available_mb}MB)"
    elif [[ $available_mb -ge 2048 ]]; then
        print_warning "可用内存较少 (${available_mb}MB)"
    else
        print_error "可用内存严重不足 (${available_mb}MB)，系统可能不稳定"
    fi

    if (( $(echo "$usage_percent > 80" | bc -l) )); then
        print_error "内存使用率过高 (${usage_percent}%)"
    elif (( $(echo "$usage_percent > 60" | bc -l) )); then
        print_warning "内存使用率较高 (${usage_percent}%)"
    else
        print_success "内存使用率正常 (${usage_percent}%)"
    fi
    echo ""
}

# 检查磁盘信息
check_disk() {
    print_section "磁盘信息检查"

    local disk_info=$(df -h /)
    local total_disk=$(echo "$disk_info" | tail -1 | awk '{print $2}')
    local used_disk=$(echo "$disk_info" | tail -1 | awk '{print $3}')
    local available_disk=$(echo "$disk_info" | tail -1 | awk '{print $4}')
    local usage_percent=$(echo "$disk_info" | tail -1 | awk '{print $5}' | sed 's/%//')

    echo "  根分区总容量: $total_disk"
    echo "  已使用: $used_disk"
    echo "  可用空间: $available_disk"
    echo "  使用率: ${usage_percent}%"

    # 检查文件系统类型
    local fs_type=$(df -T / | tail -1 | awk '{print $2}')
    echo "  文件系统类型: $fs_type"

    if [[ $fs_type == "ext4" ]]; then
        print_success "文件系统类型正确 (ext4)"
    else
        print_warning "文件系统类型: $fs_type"
    fi

    if [[ $usage_percent -le 70 ]]; then
        print_success "磁盘使用率正常 (${usage_percent}%)"
    elif [[ $usage_percent -le 85 ]]; then
        print_warning "磁盘使用率较高 (${usage_percent}%)"
    else
        print_error "磁盘使用率过高 (${usage_percent}%)"
    fi

    # 磁盘IO性能简单检查
    local io_test=$(dd if=/dev/zero of=/tmp/testfile bs=1M count=100 2>&1 | grep -o '[0-9.]* MB/s' | tail -1)
    echo "  磁盘写入速度: $io_test"
    rm -f /tmp/testfile
    echo ""
}

# 检查网络连接
check_network() {
    print_section "网络连接检查"

    # 检查网络接口
    local interfaces=$(ip -br addr show | awk '{print $1, $3}')
    echo "  网络接口:"
    echo "$interfaces" | while read line; do
        echo "    $line"
    done

    # 检查外网连接
    if ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1; then
        print_success "外网连接正常"
    else
        print_error "外网连接失败"
    fi

    # 检查DNS解析
    if nslookup google.com >/dev/null 2>&1; then
        print_success "DNS解析正常"
    else
        print_warning "DNS解析可能有问题"
    fi

    # 检查防火墙状态
    if command -v ufw >/dev/null 2>&1; then
        local ufw_status=$(ufw status | head -1)
        echo "  防火墙状态: $ufw_status"
    fi

    echo ""
}

# 检查必要软件
check_software() {
    print_section "必要软件检查"

    # 检查Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        echo "  Node.js版本: $node_version"
        local node_major=$(echo $node_version | cut -d'.' -f1 | sed 's/v//')
        if [[ $node_major -ge 18 ]]; then
            print_success "Node.js版本符合要求 ($node_version)"
        else
            print_error "Node.js版本过低，需要18+ ($node_version)"
        fi
    else
        print_error "Node.js未安装"
    fi

    # 检查NPM
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        echo "  NPM版本: $npm_version"
        print_success "NPM已安装 ($npm_version)"
    else
        print_error "NPM未安装"
    fi

    # 检查MySQL
    if command -v mysql >/dev/null 2>&1; then
        local mysql_version=$(mysql --version | awk '{print $5}' | cut -d',' -f1 | cut -d'-' -f1)
        echo "  MySQL版本: $mysql_version"
        if [[ $mysql_version == "8.0"* ]]; then
            print_success "MySQL版本符合要求 (8.0+)"
        else
            print_warning "建议使用MySQL 8.0+ (当前: $mysql_version)"
        fi
    else
        print_error "MySQL未安装"
    fi

    # 检查Nginx
    if command -v nginx >/dev/null 2>&1; then
        local nginx_version=$(nginx -v 2>&1 | cut -d'/' -f2)
        echo "  Nginx版本: $nginx_version"
        print_success "Nginx已安装 ($nginx_version)"
    else
        print_error "Nginx未安装"
    fi

    # 检查PM2
    if command -v pm2 >/dev/null 2>&1; then
        local pm2_version=$(pm2 --version)
        echo "  PM2版本: $pm2_version"
        print_success "PM2已安装 ($pm2_version)"
    else
        print_error "PM2未安装"
    fi

    echo ""
}

# 检查服务状态
check_services() {
    print_section "系统服务检查"

    # MySQL服务
    if systemctl is-active --quiet mysql 2>/dev/null || systemctl is-active --quiet mysqld 2>/dev/null; then
        print_success "MySQL服务正在运行"
        # 检查端口
        if netstat -tulpn 2>/dev/null | grep -q ":3306 "; then
            print_success "MySQL端口3306正在监听"
        else
            print_warning "MySQL端口3306未监听"
        fi
    else
        print_error "MySQL服务未运行"
    fi

    # Nginx服务
    if systemctl is-active --quiet nginx; then
        print_success "Nginx服务正在运行"
        # 检查端口
        if netstat -tulpn 2>/dev/null | grep -q ":80 "; then
            print_success "Nginx端口80正在监听"
        else
            print_warning "Nginx端口80未监听"
        fi
        if netstat -tulpn 2>/dev/null | grep -q ":443 "; then
            print_success "Nginx端口443正在监听 (HTTPS)"
        else
            print_warning "Nginx端口443未监听 (HTTPS)"
        fi
    else
        print_error "Nginx服务未运行"
    fi

    # 宝塔面板
    if command -v bt >/dev/null 2>&1; then
        local bt_status=$(bt status 2>/dev/null || echo "Unknown")
        echo "  宝塔面板状态: $bt_status"
        print_success "宝塔面板已安装"
    else
        print_warning "未检测到宝塔面板"
    fi

    echo ""
}

# 检查端口占用
check_ports() {
    print_section "端口占用检查"

    local ports_to_check=("3000" "3001" "3002" "9090" "22" "80" "443" "3306")

    for port in "${ports_to_check[@]}"; do
        if netstat -tulpn 2>/dev/null | grep -q ":$port "; then
            local service=$(netstat -tulpn 2>/dev/null | grep ":$port " | head -1 | awk '{print $7}' | cut -d'/' -f2)
            echo "  端口 $port: 已被 $service 占用"
        else
            echo "  端口 $port: 可用"
        fi
    done
    echo ""
}

# 部署建议
give_recommendations() {
    print_section "部署建议"

    if [[ $ISSUES -eq 0 && $WARNINGS -eq 0 ]]; then
        echo -e "  ${GREEN}🎉 恭喜！服务器状态良好，可以进行部署${NC}"
        echo ""
        echo "  建议的部署步骤："
        echo "  1. 运行数据库优化脚本: ./scripts/mysql-optimization.sh"
        echo "  2. 运行系统优化脚本: ./scripts/server-optimization.sh"
        echo "  3. 按照部署检查清单进行部署: ./scripts/deployment-checklist.md"
    elif [[ $ISSUES -eq 0 ]]; then
        echo -e "  ${YELLOW}⚠️ 服务器基本可用，但建议先解决警告项${NC}"
        echo ""
        echo "  建议优先处理："
        if [[ $WARNINGS -gt 0 ]]; then
            echo "  1. 解决上述 $WARNINGS 个警告项"
        fi
        echo "  2. 运行优化脚本提升性能"
        echo "  3. 在测试环境验证后再部署到生产"
    else
        echo -e "  ${RED}❌ 服务器存在问题，不建议立即部署${NC}"
        echo ""
        echo "  必须解决的问题 ($ISSUES 个)："
        echo "  1. 解决上述所有错误项"
        echo "  2. 升级硬件配置（特别是内存和CPU）"
        echo "  3. 重新运行此脚本检查"
        echo ""
        echo "  如需在当前服务器部署，请："
        echo "  1. 阅读详细优化方案: ./docs/服务器优化升级方案.md"
        echo "  2. 考虑云服务器替代方案"
    fi

    echo ""
    echo "  更多帮助："
    echo "  - 详细优化方案: ./docs/服务器优化升级方案.md"
    echo "  - 部署检查清单: ./scripts/deployment-checklist.md"
    echo "  - 系统优化脚本: ./scripts/server-optimization.sh"
    echo "  - MySQL优化脚本: ./scripts/mysql-optimization.sh"
    echo ""
}

# 主函数
main() {
    print_header

    check_system_info
    check_cpu
    check_memory
    check_disk
    check_network
    check_software
    check_services
    check_ports

    give_recommendations

    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}检查完成: 发现 $ISSUES 个错误，$WARNINGS 个警告${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# 运行主函数
main "$@"