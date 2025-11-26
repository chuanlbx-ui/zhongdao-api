#!/bin/bash

# GitHub身份验证设置脚本
# 用于快速配置GitHub访问权限

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# 显示帮助信息
show_help() {
    cat << EOF
GitHub身份验证设置脚本

用法: $0 [选项]

选项:
  -t, --token <TOKEN>     使用Personal Access Token
  -s, --ssh              使用SSH密钥方式
  -k, --setup-ssh        生成并配置SSH密钥
  -u, --user <USERNAME>  GitHub用户名 (默认: chuanlbx-ui)
  -h, --help             显示帮助信息

示例:
  $0 --token ghp_xxxxxxxxxxxx
  $0 --ssh --user chuanlbx-ui
  $0 --setup-ssh

EOF
}

# 解析命令行参数
GITHUB_TOKEN=""
GITHUB_USER="chuanlbx-ui"
USE_SSH=false
SETUP_SSH=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--token)
            GITHUB_TOKEN="$2"
            shift 2
            ;;
        -s|--ssh)
            USE_SSH=true
            shift
            ;;
        -k|--setup-ssh)
            SETUP_SSH=true
            USE_SSH=true
            shift
            ;;
        -u|--user)
            GITHUB_USER="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查Git是否已安装
if ! command -v git &> /dev/null; then
    log_error "Git未安装，请先安装Git"
    exit 1
fi

# 函数：使用Token配置
setup_token_auth() {
    local token="$1"

    log "使用Personal Access Token配置GitHub认证..."

    # 配置credential helper
    git config --global credential.helper store

    # 设置URL中包含token（可选，更直接的方式）
    log "配置Git远程仓库URL..."

    # 获取当前目录的远程仓库
    local current_remote=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ -n "$current_remote" ]]; then
        if [[ "$current_remote" == https://github.com/* ]]; then
            local new_remote="https://${token}@github.com/${current_remote#https://github.com/}"
            git remote set-url origin "$new_remote"
            log_success "已更新远程仓库URL"
        fi
    fi

    # 验证连接
    log "验证GitHub连接..."
    if curl -s -H "Authorization: token $token" https://api.github.com/user > /dev/null; then
        log_success "GitHub Token验证成功"
        return 0
    else
        log_error "GitHub Token验证失败"
        return 1
    fi
}

# 函数：生成SSH密钥
setup_ssh_keys() {
    log "设置SSH密钥认证..."

    # 检查是否已有SSH密钥
    if [[ -f ~/.ssh/id_ed25519 ]]; then
        log_warning "SSH密钥已存在，跳过生成"
    else
        log "生成新的SSH密钥..."
        ssh-keygen -t ed25519 -C "zhongdao-server@wenbita.cn" -f ~/.ssh/id_ed25519 -N ""
        log_success "SSH密钥生成完成"
    fi

    # 显示公钥
    log "你的SSH公钥是："
    echo "----------------------------------------"
    cat ~/.ssh/id_ed25519.pub
    echo "----------------------------------------"

    log "请将上述公钥添加到GitHub："
    log "1. 访问 https://github.com/settings/keys"
    log "2. 点击 'New SSH key'"
    log "3. Title: Zhongdao Mall Server"
    log "4. Key: 粘贴上面的公钥内容"

    # 测试SSH连接
    log "测试SSH连接..."
    if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
        log_success "SSH连接测试成功"
        return 0
    else
        log_warning "SSH连接测试失败，请确保已正确添加公钥到GitHub"
        log "可以稍后运行: ssh -T git@github.com 来测试"
        return 1
    fi
}

# 函数：配置使用SSH
configure_ssh_urls() {
    log "配置Git使用SSH远程地址..."

    # 仓库列表
    local repos=(
        "/www/wwwroot/zd-h5.wenbita.cn:https://github.com/chuanlbx-ui/zhongdao-mall-h5.git"
        "/www/wwwroot/zd-admin.wenbita.cn:https://github.com/chuanlbx-ui/zhondao-mall-admin.git"
        "/www/wwwroot/zd-api.wenbita.cn:https://github.com/chuanlbx-ui/zhondao-mall.git"
    )

    for repo_info in "${repos[@]}"; do
        local path="${repo_info%%:*}"
        local https_url="${repo_info##*:}"
        local ssh_url="git@github.com:${https_url#https://github.com/}"

        if [[ -d "$path" ]]; then
            cd "$path"
            local current_remote=$(git remote get-url origin 2>/dev/null || echo "")
            if [[ "$current_remote" != "$ssh_url" ]]; then
                log "更新 $path 的远程仓库地址为SSH"
                git remote set-url origin "$ssh_url"
                log_success "已更新: $path"
            fi
        fi
    done
}

# 主函数
main() {
    log "开始配置GitHub身份验证..."

    if [[ "$SETUP_SSH" == true ]]; then
        # 设置SSH密钥
        if setup_ssh_keys; then
            configure_ssh_urls
            log_success "SSH认证设置完成"
        else
            log_error "SSH认证设置失败"
            exit 1
        fi
    elif [[ -n "$GITHUB_TOKEN" ]]; then
        # 使用Token
        if setup_token_auth "$GITHUB_TOKEN"; then
            log_success "Token认证设置完成"
        else
            log_error "Token认证设置失败"
            exit 1
        fi
    elif [[ "$USE_SSH" == true ]]; then
        # 仅配置SSH URL
        configure_ssh_urls
        log_success "SSH URL配置完成"
    else
        log_error "请指定认证方式"
        show_help
        exit 1
    fi

    log ""
    log "🎉 GitHub身份验证配置完成！"
    log ""
    log "现在可以运行同步脚本了："
    log "  cd /www/wwwroot/zd-h5.wenbita.cn && ./sync-h5-repo.sh"
    log "  cd /www/wwwroot/zd-admin.wenbita.cn && ./sync-admin-repo.sh"
    log "  cd /www/wwwroot/zd-api.wenbita.cn && ./sync-backend-repo.sh"
}

# 运行主函数
main