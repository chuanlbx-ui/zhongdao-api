#!/bin/bash

# 中道商城服务器优化脚本
# 适用于Ubuntu 22.04 + 宝塔面板环境

set -e  # 遇到错误立即退出

echo "🚀 开始服务器优化..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "请不要以root用户运行此脚本!"
        exit 1
    fi
}

# 系统信息收集
system_info() {
    log "收集系统信息..."

    echo "=== 系统基本信息 ===" > /tmp/system_info.txt
    echo "操作系统: $(lsb_release -d | cut -f2)" >> /tmp/system_info.txt
    echo "内核版本: $(uname -r)" >> /tmp/system_info.txt
    echo "CPU信息: $(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)" >> /tmp/system_info.txt
    echo "CPU核心数: $(nproc)" >> /tmp/system_info.txt
    echo "内存总量: $(free -h | grep Mem | awk '{print $2}')" >> /tmp/system_info.txt
    echo "可用内存: $(free -h | grep Mem | awk '{print $4}')" >> /tmp/system_info.txt
    echo "磁盘使用: $(df -h / | tail -1 | awk '{print $5}')" >> /tmp/system_info.txt

    cat /tmp/system_info.txt
    echo ""
}

# 内存优化
optimize_memory() {
    log "优化内存配置..."

    # 优化虚拟内存参数
    sudo sysctl -w vm.swappiness=10
    sudo sysctl -w vm.dirty_ratio=15
    sudo sysctl -w vm.dirty_background_ratio=5
    sudo sysctl -w vm.min_free_kbytes=65536

    # 持久化配置
    sudo tee -a /etc/sysctl.conf << EOF
# 内存优化配置
vm.swappiness=10
vm.dirty_ratio=15
vm.dirty_background_ratio=5
vm.min_free_kbytes=65536
EOF

    # 清理系统缓存
    warn "清理系统缓存..."
    sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'

    log "内存优化完成"
}

# 禁用不必要的服务
disable_services() {
    log "禁用不必要的服务..."

    # 禁用一些不常用的系统服务
    services_to_disable=(
        "bluetooth"
        "cups"
        "snapd"
        "whoopsie"
        "avahi-daemon"
    )

    for service in "${services_to_disable[@]}"; do
        if systemctl is-active --quiet $service; then
            sudo systemctl stop $service
            sudo systemctl disable $service
            log "已禁用服务: $service"
        fi
    done
}

# 宝塔面板优化
optimize_bt_panel() {
    log "优化宝塔面板配置..."

    # 检查宝塔是否安装
    if [ -d "/www/server/panel" ]; then
        # 关闭宝塔面板的自动更新
        if [ -f "/www/server/panel/data/admin_path.pl" ]; then
            warn "宝塔面板已检测到，请手动关闭自动更新和不需要的插件"
        fi

        # 优化PHP配置
        if [ -d "/www/server/php" ]; then
            log "优化PHP配置..."
            # 这里可以添加具体的PHP配置优化
            # 例如调整memory_limit等参数
        fi
    else
        log "未检测到宝塔面板"
    fi
}

# 创建监控脚本
create_monitor_scripts() {
    log "创建监控脚本..."

    # 内存监控脚本
    sudo tee /opt/memory-monitor.sh > /dev/null << 'EOF'
#!/bin/bash

THRESHOLD=85
LOG_FILE="/var/log/memory-monitor.log"
RESTART_SERVICE="zd-api"

# 确保日志目录存在
mkdir -p $(dirname $LOG_FILE)

while true; do
    # 获取内存使用率（排除buff/cache）
    MEMORY_USED=$(free | grep '^Mem:' | awk '{printf("%.0f"), ($3/$2) * 100.0}')

    if [ $MEMORY_USED -gt $THRESHOLD ]; then
        echo "$(date): 内存使用率过高: ${MEMORY_USED}%" >> $LOG_FILE

        # 清理缓存
        sync && echo 3 > /proc/sys/vm/drop_caches

        # 重启Node.js应用
        if command -v pm2 &> /dev/null; then
            pm2 restart $RESTART_SERVICE
            echo "$(date): 已重启服务 $RESTART_SERVICE" >> $LOG_FILE
        fi

        # 发送告警（需要配置webhook）
        # curl -X POST "your-webhook-url" -d "内存使用率: ${MEMORY_USED}%" 2>/dev/null || true
    fi

    sleep 60
done
EOF

    sudo chmod +x /opt/memory-monitor.sh

    # 性能监控仪表板
    sudo tee /opt/performance-dashboard.js > /dev/null << 'EOF'
const http = require('http');
const { exec } = require('child_process');

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.url === '/health' || req.url === '/') {
        exec('free -m && df -h / && uptime', (error, stdout) => {
            if (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    status: 'error',
                    message: '获取系统信息失败',
                    timestamp: new Date().toISOString()
                }));
            }

            const lines = stdout.split('\n');
            const memoryLine = lines[1].split(/\s+/);
            const diskLine = lines[6].split(/\s+/);

            const totalMem = parseInt(memoryLine[1]);
            const usedMem = parseInt(memoryLine[2]);
            const freeMem = parseInt(memoryLine[3]);
            const memoryUsage = ((usedMem / totalMem) * 100).toFixed(2);

            const totalDisk = diskLine[1];
            const usedDisk = diskLine[2];
            const diskUsage = diskLine[4];

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: memoryUsage > 80 ? 'warning' : 'ok',
                memory: {
                    total: totalMem + 'MB',
                    used: usedMem + 'MB',
                    free: freeMem + 'MB',
                    usage: memoryUsage + '%'
                },
                disk: {
                    total: totalDisk,
                    used: usedDisk,
                    usage: diskUsage
                },
                uptime: lines[0].trim(),
                timestamp: new Date().toISOString()
            }));
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(9090, '0.0.0.0', () => {
    console.log('性能监控仪表板启动成功，监听端口 9090');
});
EOF

    sudo chmod +x /opt/performance-dashboard.js

    log "监控脚本创建完成"
}

# 配置systemd服务
setup_systemd_services() {
    log "配置系统服务..."

    # 内存监控服务
    sudo tee /etc/systemd/system/memory-monitor.service > /dev/null << EOF
[Unit]
Description=Memory Monitor Service
After=network.target

[Service]
Type=simple
ExecStart=/opt/memory-monitor.sh
Restart=always
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

    # 性能仪表板服务
    sudo tee /etc/systemd/system/performance-dashboard.service > /dev/null << EOF
[Unit]
Description=Performance Dashboard Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/performance-dashboard.js
Restart=always
User=root
Group=root
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    # 启用并启动服务
    sudo systemctl daemon-reload
    sudo systemctl enable memory-monitor
    sudo systemctl start memory-monitor

    sudo systemctl enable performance-dashboard
    sudo systemctl start performance-dashboard

    log "系统服务配置完成"
}

# 优化文件句柄限制
optimize_limits() {
    log "优化文件句柄限制..."

    # 设置当前会话的限制
    ulimit -n 65535

    # 持久化配置
    sudo tee -a /etc/security/limits.conf << EOF
# 优化文件句柄限制
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF

    # 系统级优化
    sudo sysctl -w fs.file-max=2097152
    sudo tee -a /etc/sysctl.conf << EOF

# 文件句柄优化
fs.file-max=2097152
EOF

    log "文件句柄限制优化完成"
}

# 网络优化
optimize_network() {
    log "优化网络配置..."

    # TCP优化
    sudo sysctl -w net.core.rmem_max=134217728
    sudo sysctl -w net.core.wmem_max=134217728
    sudo sysctl -w net.ipv4.tcp_rmem='4096 65536 134217728'
    sudo sysctl -w net.ipv4.tcp_wmem='4096 65536 134217728'
    sudo sysctl -w net.ipv4.tcp_congestion_control=bbr
    sudo sysctl -w net.core.netdev_max_backlog=5000

    # 持久化配置
    sudo tee -a /etc/sysctl.conf << EOF

# 网络优化
net.core.rmem_max=134217728
net.core.wmem_max=134217728
net.ipv4.tcp_rmem=4096 65536 134217728
net.ipv4.tcp_wmem=4096 65536 134217728
net.core.netdev_max_backlog=5000
EOF

    log "网络优化完成"
}

# 生成优化后的PM2配置
create_optimized_pm2_config() {
    log "生成优化后的PM2配置..."

    cat > ecosystem.config.js.optimized << 'EOF'
module.exports = {
  apps: [
    {
      name: 'zd-api',
      script: './dist/index.js',
      cwd: '/www/wwwroot/zd-api.wenbita.cn',
      instances: 1,                    // 单实例节省内存
      exec_mode: 'fork',               // 单进程模式
      autorestart: true,
      watch: false,                    // 关闭文件监听
      max_memory_restart: '768M',      // 降低内存重启阈值
      node_args: [
        '--max-old-space-size=768',    // 限制V8内存
        '--max-semi-space-size=64'     // 限制新生代内存
      ],
      env: {
        NODE_ENV: 'production',
        UV_THREADPOOL_SIZE: 4,         // 降低线程池大小
        NODE_OPTIONS: '--max-old-space-size=768'
      },
      out_file: '/www/wwwlogs/zd-api-out.log',
      error_file: '/www/wwwlogs/zd-api-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 3000,
      listen_timeout: 5000
    },
    {
      name: 'zd-h5',
      script: 'serve',
      args: 'dist -l 3001 -s',
      cwd: '/www/wwwroot/zd-h5.wenbita.cn',
      autorestart: true,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=256'
      }
    },
    {
      name: 'zd-admin',
      script: 'serve',
      args: 'dist -l 3002 -s',
      cwd: '/www/wwwroot/zd-admin.wenbita.cn',
      autorestart: true,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=256'
      }
    }
  ]
};
EOF

    log "优化的PM2配置已保存为 ecosystem.config.js.optimized"
}

# 生成Nginx配置
create_nginx_config() {
    log "生成Nginx配置..."

    sudo tee /etc/nginx/sites-available/zhongdao-mall-optimized > /dev/null << 'EOF'
# 中道商城 - 优化版Nginx配置
server {
    listen 80;
    server_name zd-api.wenbita.cn zd-admin.wenbita.cn zd-h5.wenbita.cn;

    # 日志配置
    access_log /var/log/nginx/zhongdao_access.log;
    error_log /var/log/nginx/zhongdao_error.log;

    # 基础配置
    client_max_body_size 10M;
    client_body_timeout 30s;
    client_header_timeout 30s;

    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_comp_level 6;

    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时配置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # 缓冲配置（优化内存使用）
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 4 4k;
        proxy_busy_buffers_size 8k;

        # 连接池优化
        proxy_set_header Connection "";
        proxy_http_version 1.1;
    }

    # 管理后台
    location /admin/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # H5前端
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # SPA支持
        try_files $uri $uri/ @fallback;
    }

    location @fallback {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 健康检查端点
    location /nginx-health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    log "Nginx配置已生成，请手动启用："
    echo "sudo ln -s /etc/nginx/sites-available/zhongdao-mall-optimized /etc/nginx/sites-enabled/"
    echo "sudo nginx -t && sudo systemctl reload nginx"
}

# 显示优化后的状态
show_optimization_status() {
    log "优化完成！当前系统状态："

    echo ""
    echo "=== 内存使用情况 ==="
    free -h

    echo ""
    echo "=== 磁盘使用情况 ==="
    df -h /

    echo ""
    echo "=== 系统负载 ==="
    uptime

    echo ""
    echo "=== 服务状态 ==="
    sudo systemctl status memory-monitor --no-pager -l
    sudo systemctl status performance-dashboard --no-pager -l

    echo ""
    echo "=== 访问监控仪表板 ==="
    echo "http://$(hostname -I | awk '{print $1}'):9090"

    echo ""
    echo "=== 下一步操作 ==="
    echo "1. 备份当前的 PM2 配置"
    echo "2. 使用优化的 PM2 配置: ecosystem.config.js.optimized"
    echo "3. 配置并启用优化的 Nginx 配置"
    echo "4. 重启应用服务"
    echo "5. 监控系统性能变化"
}

# 主函数
main() {
    log "开始执行服务器优化..."

    check_root
    system_info
    optimize_memory
    disable_services
    optimize_bt_panel
    create_monitor_scripts
    setup_systemd_services
    optimize_limits
    optimize_network
    create_optimized_pm2_config
    create_nginx_config
    show_optimization_status

    log "服务器优化脚本执行完成！"
    warn "请重启相关服务以应用所有优化配置"
    warn "建议在业务低峰期执行此脚本"
}

# 运行主函数
main "$@"