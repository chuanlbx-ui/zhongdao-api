#!/bin/bash
# SSH隧道管理脚本 - 建立本地到远程开发数据库的安全连接

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

# 配置
REMOTE_HOST="162.14.114.224"
REMOTE_USER="root"
LOCAL_PORT="3307"
REMOTE_PORT="3306"
TUNNEL_PID_FILE="/tmp/ssh-tunnel-zhongdao.pid"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ 错误: $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 启动SSH隧道
start_tunnel() {
    log "🔐 建立SSH隧道..."
    
    # 检查是否已有隧道运行
    if [ -f "$TUNNEL_PID_FILE" ]; then
        OLD_PID=$(cat "$TUNNEL_PID_FILE")
        if kill -0 "$OLD_PID" 2>/dev/null; then
            warning "SSH隧道已在运行 (PID: $OLD_PID)"
            log "连接信息:"
            echo "  本地: localhost:$LOCAL_PORT"
            echo "  远程: $REMOTE_HOST:$REMOTE_PORT"
            echo "  用户: $REMOTE_USER"
            return 0
        else
            rm -f "$TUNNEL_PID_FILE"
        fi
    fi
    
    # 启动新的隧道
    # -L 本地端口:远程主机:远程端口
    # -N 不执行远程命令
    # -f 后台运行
    ssh -L $LOCAL_PORT:localhost:$REMOTE_PORT \
        -N -f \
        -o ConnectTimeout=10 \
        -o StrictHostKeyChecking=no \
        ${REMOTE_USER}@${REMOTE_HOST} \
        || error "SSH隧道建立失败"
    
    # 获取SSH进程ID
    SSH_PID=$(pgrep -f "ssh -L $LOCAL_PORT:localhost:$REMOTE_PORT" | head -n 1)
    echo "$SSH_PID" > "$TUNNEL_PID_FILE"
    
    success "SSH隧道已建立 (PID: $SSH_PID)"
    log "连接信息:"
    echo "  本地: localhost:$LOCAL_PORT"
    echo "  远程: $REMOTE_HOST:$REMOTE_PORT"
    echo "  用户: $REMOTE_USER"
}

# 停止SSH隧道
stop_tunnel() {
    log "🔓 关闭SSH隧道..."
    
    if [ -f "$TUNNEL_PID_FILE" ]; then
        PID=$(cat "$TUNNEL_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" || true
            success "SSH隧道已关闭 (PID: $PID)"
        else
            warning "SSH隧道进程不存在 (PID: $PID)"
        fi
        rm -f "$TUNNEL_PID_FILE"
    else
        warning "未找到SSH隧道信息文件"
    fi
}

# 检查隧道状态
check_tunnel() {
    log "🔍 检查SSH隧道状态..."
    echo ""
    
    if [ -f "$TUNNEL_PID_FILE" ]; then
        PID=$(cat "$TUNNEL_PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            success "SSH隧道正在运行 (PID: $PID)"
            echo ""
            echo "📊 连接信息:"
            echo "  本地: localhost:$LOCAL_PORT"
            echo "  远程: $REMOTE_HOST:$REMOTE_PORT"
            echo "  用户: $REMOTE_USER"
            echo ""
            
            # 尝试测试连接
            log "测试数据库连接..."
            if command -v mysql &> /dev/null; then
                if mysql -h localhost -P $LOCAL_PORT -u dev_user -pdev_password_secure \
                    -e "SELECT 1;" &>/dev/null; then
                    success "数据库连接成功！"
                else
                    warning "无法连接到数据库（可能MySQL客户端未安装）"
                fi
            else
                warning "MySQL客户端未安装，无法测试连接"
            fi
        else
            error "SSH隧道进程已停止 (PID: $PID)"
        fi
    else
        error "SSH隧道未运行"
    fi
}

# 重启隧道
restart_tunnel() {
    log "🔄 重启SSH隧道..."
    stop_tunnel
    sleep 1
    start_tunnel
}

# 主程序
main() {
    case "${1:-start}" in
        start)
            start_tunnel
            ;;
        stop)
            stop_tunnel
            ;;
        status|check)
            check_tunnel
            ;;
        restart)
            restart_tunnel
            ;;
        *)
            echo "使用方法: $0 {start|stop|status|restart}"
            echo ""
            echo "选项:"
            echo "  start   - 建立SSH隧道"
            echo "  stop    - 关闭SSH隧道"
            echo "  status  - 检查隧道状态"
            echo "  restart - 重启隧道"
            exit 1
            ;;
    esac
}

main "$@"
