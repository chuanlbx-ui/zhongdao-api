#!/bin/bash

# MySQL 8.0 性能优化脚本
# 针对内存有限的服务器环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# 检查MySQL是否运行
check_mysql() {
    if ! systemctl is-active --quiet mysql; then
        error "MySQL服务未运行，请先启动MySQL"
        exit 1
    fi
}

# 获取可用内存
get_available_memory() {
    # 获取系统总内存（GB）
    TOTAL_MEM_GB=$(free -g | awk '/^Mem:/{print $2}')
    # 计算可用于MySQL的内存（50%的总内存）
    MYSQL_MEM_GB=$((TOTAL_MEM_GB / 2))

    log "系统总内存: ${TOTAL_MEM_GB}GB"
    log "MySQL分配内存: ${MYSQL_MEM_GB}GB"
}

# 创建MySQL优化配置
create_mysql_config() {
    log "创建MySQL优化配置..."

    # 计算内存相关参数
    INNOVADB_BUFFER_POOL_SIZE=$((MYSQL_MEM_GB * 1024 * 1024 * 1024 * 3 / 4))  # 75% of allocated memory
    INNOVADB_LOG_FILE_SIZE=$((MYSQL_MEM_GB * 1024 * 1024 * 128))  # 128MB per GB
    KEY_BUFFER_SIZE=$((MYSQL_MEM_GB * 1024 * 1024 * 32))  # 32MB per GB
    TMP_TABLE_SIZE=$((MYSQL_MEM_GB * 1024 * 1024 * 32))  # 32MB per GB

    # 创建配置文件
    sudo mkdir -p /etc/mysql/mysql.conf.d
    sudo tee /etc/mysql/mysql.conf.d/zhongdao-optimized.cnf > /dev/null << EOF
# 中道商城 MySQL 8.0 优化配置
# 针对内存有限环境 ($MYSQL_MEM_GB GB allocated)

[mysqld]
# === 基础配置 ===
user = mysql
pid-file = /var/run/mysqld/mysqld.pid
socket = /var/run/mysqld/mysqld.sock
port = 3306
datadir = /var/lib/mysql
tmpdir = /tmp

# === 字符集配置 ===
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
init_connect = 'SET NAMES utf8mb4'

# === 内存配置 ===
# InnoDB缓冲池大小 (最重要的内存参数)
innodb_buffer_pool_size = ${INNOVADB_BUFFER_POOL_SIZE}
innodb_buffer_pool_instances = $(($MYSQL_MEM_GB > 2 ? 4 : 1))

# InnoDB日志配置
innodb_log_file_size = ${INNOVADB_LOG_FILE_SIZE}
innodb_log_buffer_size = 67108864  # 64MB

# MyISAM键缓冲区
key_buffer_size = ${KEY_BUFFER_SIZE}

# 临时表配置
tmp_table_size = ${TMP_TABLE_SIZE}
max_heap_table_size = ${TMP_TABLE_SIZE}

# 查询缓存 (MySQL 8.0已移除，但保留注释以备参考)
# query_cache_type = 0
# query_cache_size = 0

# === 连接配置 ===
max_connections = 50
max_connect_errors = 1000
max_user_connections = 40
thread_cache_size = 16
table_open_cache = 2000
table_definition_cache = 1400

# === InnoDB配置 ===
innodb_flush_log_at_trx_commit = 2  # 性能优先，允许最多1秒数据丢失
innodb_flush_method = O_DIRECT      # 避免双重缓存
innodb_file_per_table = 1           # 每个表一个文件
innodb_open_files = 400             # 打开文件数量

# I/O配置
innodb_io_capacity = 2000           # 适用于SSD
innodb_io_capacity_max = 4000
innodb_read_io_threads = 8
innodb_write_io_threads = 8

# 锁配置
innodb_lock_wait_timeout = 50
innodb_deadlock_detect = ON

# === 日志配置 ===
log_error = /var/log/mysql/error.log
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
log_queries_not_using_indexes = 1
log_throttle_queries_not_using_indexes = 5

# 二进制日志配置（用于备份和复制）
log_bin = /var/log/mysql/mysql-bin.log
expire_logs_days = 7
max_binlog_size = 100M
binlog_format = ROW
sync_binlog = 1

# === 性能优化 ===
# 跳过域名解析
skip_name_resolve = 1

# SQL模式
sql_mode = STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO

# 网络配置
max_allowed_packet = 64M
interactive_timeout = 28800
wait_timeout = 28800

# === 安全配置 ===
local_infile = 0

[mysql]
default-character-set = utf8mb4

[client]
default-character-set = utf8mb4
EOF

    log "MySQL优化配置已创建"
}

# 应用配置并重启MySQL
apply_mysql_config() {
    log "应用MySQL配置..."

    # 备份原配置
    if [ -f "/etc/mysql/mysql.conf.d/mysqld.cnf" ]; then
        sudo cp /etc/mysql/mysql.conf.d/mysqld.cnf /etc/mysql/mysql.conf.d/mysqld.cnf.backup.$(date +%Y%m%d_%H%M%S)
        warn "原配置已备份"
    fi

    # 重启MySQL服务
    sudo systemctl restart mysql

    # 等待MySQL启动
    sleep 5

    if systemctl is-active --quiet mysql; then
        log "MySQL服务重启成功"
    else
        error "MySQL服务重启失败，请检查配置文件"
        sudo journalctl -u mysql --no-pager -l
        exit 1
    fi
}

# 运行时优化配置
runtime_optimization() {
    log "应用运行时优化配置..."

    # 连接数限制
    mysql -e "SET GLOBAL max_connections = 50;"
    mysql -e "SET GLOBAL max_user_connections = 40;"
    mysql -e "SET GLOBAL thread_cache_size = 16;"

    # 内存配置（已在配置文件中设置，这里验证）
    mysql -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"
    mysql -e "SHOW VARIABLES LIKE 'max_connections';"

    # 查询配置
    mysql -e "SET GLOBAL long_query_time = 2;"
    mysql -e "SET GLOBAL slow_query_log = 'ON';"

    log "运行时配置应用完成"
}

# 创建数据库监控脚本
create_monitor_script() {
    log "创建MySQL监控脚本..."

    sudo tee /opt/mysql-monitor.sh > /dev/null << 'EOF'
#!/bin/bash

# MySQL监控脚本
MYSQL_USER="root"
MYSQL_PASSWORD="d035fda4686c0150"
MYSQL_SOCK="/var/run/mysqld/mysqld.sock"
LOG_FILE="/var/log/mysql-monitor.log"
ALERT_THRESHOLD_CONNECTIONS=40
ALERT_THRESHOLD_SLOW_QUERIES=10

# 确保日志目录存在
mkdir -p $(dirname $LOG_FILE)

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    # 检查MySQL连接数
    CONNECTIONS=$(mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -S $MYSQL_SOCK -e "SHOW STATUS LIKE 'Threads_connected';" | tail -1 | awk '{print $2}')

    # 检查慢查询数量
    SLOW_QUERIES=$(mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -S $MYSQL_SOCK -e "SHOW GLOBAL STATUS LIKE 'Slow_queries';" | tail -1 | awk '{print $2}')

    # 获取内存使用
    MEMORY_USED=$(mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -S $MYSQL_SOCK -e "SHOW STATUS LIKE 'Innodb_buffer_pool_pages_data';" | tail -1 | awk '{print $2}')
    MEMORY_TOTAL=$(mysql -u $MYSQL_USER -p$MYSQL_PASSWORD -S $MYSQL_SOCK -e "SHOW STATUS LIKE 'Innodb_buffer_pool_pages_total';" | tail -1 | awk '{print $2}')
    MEMORY_USAGE=$((MEMORY_USED * 100 / MEMORY_TOTAL))

    echo "$TIMESTAMP | Connections: $CONNECTIONS/$ALERT_THRESHOLD_CONNECTIONS | Slow Queries: $SLOW_QUERIES | Buffer Pool: ${MEMORY_USAGE}%" >> $LOG_FILE

    # 检查是否需要告警
    if [ $CONNECTIONS -gt $ALERT_THRESHOLD_CONNECTIONS ]; then
        echo "$TIMESTAMP ALERT: MySQL连接数过高: $CONNECTIONS" >> $LOG_FILE
    fi

    if [ $SLOW_QUERIES -gt $ALERT_THRESHOLD_SLOW_QUERIES ]; then
        echo "$TIMESTAMP ALERT: 慢查询过多: $SLOW_QUERIES" >> $LOG_FILE
    fi

    sleep 300  # 5分钟检查一次
done
EOF

    sudo chmod +x /opt/mysql-monitor.sh

    # 创建systemd服务
    sudo tee /etc/systemd/system/mysql-monitor.service > /dev/null << 'EOF'
[Unit]
Description=MySQL Monitor Service
After=mysql.service

[Service]
Type=simple
ExecStart=/opt/mysql-monitor.sh
Restart=always
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable mysql-monitor
    sudo systemctl start mysql-monitor

    log "MySQL监控脚本已启动"
}

# 创建数据库备份脚本
create_backup_script() {
    log "创建数据库备份脚本..."

    sudo tee /opt/mysql-backup.sh > /dev/null << 'EOF'
#!/bin/bash

# MySQL数据库备份脚本
DB_NAME="zhongdao_mall_dev"
BACKUP_DIR="/var/backups/mysql"
BACKUP_FILE="zhongdao_backup_$(date +%Y%m%d_%H%M%S).sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"
MYSQL_USER="root"
MYSQL_PASSWORD="d035fda4686c0150"
RETENTION_DAYS=7

# 创建备份目录
mkdir -p $BACKUP_DIR

echo "$(date): 开始数据库备份..."

# 执行备份
mysqldump -u $MYSQL_USER -p$MYSQL_PASSWORD \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    $DB_NAME > $BACKUP_DIR/$BACKUP_FILE

if [ $? -eq 0 ]; then
    # 压缩备份文件
    gzip $BACKUP_DIR/$BACKUP_FILE

    echo "$(date): 数据库备份成功: $BACKUP_DIR/$COMPRESSED_FILE"

    # 删除过期备份
    find $BACKUP_DIR -name "zhongdao_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "$(date): 清理${RETENTION_DAYS}天前的备份文件"
else
    echo "$(date): 数据库备份失败" >&2
    rm -f $BACKUP_DIR/$BACKUP_FILE
    exit 1
fi
EOF

    sudo chmod +x /opt/mysql-backup.sh

    # 添加到crontab
    (sudo crontab -l 2>/dev/null; echo "0 2 * * * /opt/mysql-backup.sh") | sudo crontab -

    log "数据库备份脚本已创建，每天凌晨2点自动备份"
}

# 性能测试
performance_test() {
    log "执行MySQL性能测试..."

    echo "=== 基础性能信息 ==="
    mysql -e "SELECT VERSION();"
    mysql -e "SHOW STATUS LIKE 'Uptime';"

    echo ""
    echo "=== 内存使用情况 ==="
    mysql -e "SHOW STATUS LIKE 'Innodb_buffer_pool_pages_%';"
    mysql -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"

    echo ""
    echo "=== 连接信息 ==="
    mysql -e "SHOW STATUS LIKE 'Threads_connected';"
    mysql -e "SHOW STATUS LIKE 'Threads_running';"
    mysql -e "SHOW VARIABLES LIKE 'max_connections';"

    echo ""
    echo "=== 查询性能 ==="
    mysql -e "SHOW STATUS LIKE 'Slow_queries';"
    mysql -e "SHOW STATUS LIKE 'Questions';"
    mysql -e "SHOW STATUS LIKE 'Com_select';"

    log "性能测试完成，详细信息已显示"
}

# 生成优化报告
generate_report() {
    log "生成优化报告..."

    REPORT_FILE="/tmp/mysql_optimization_report_$(date +%Y%m%d_%H%M%S).txt"

    cat > $REPORT_FILE << EOF
# MySQL优化报告
生成时间: $(date)

## 系统信息
操作系统: $(lsb_release -d | cut -f2)
内存信息: $(free -h)
CPU信息: $(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)

## MySQL信息
MySQL版本: $(mysql -e "SELECT VERSION();" | tail -1)
分配给MySQL的内存: ${MYSQL_MEM_GB}GB

## 主要优化参数
$(mysql -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';" 2>/dev/null)
$(mysql -e "SHOW VARIABLES LIKE 'max_connections';" 2>/dev/null)
$(mysql -e "SHOW VARIABLES LIKE 'innodb_log_file_size';" 2>/dev/null)

## 监控信息
监控脚本状态: $(systemctl is-active mysql-monitor)
备份脚本状态: $(sudo crontab -l | grep mysql-backup | wc -l) 个备份任务

## 下一步建议
1. 监控慢查询日志
2. 定期检查性能指标
3. 根据业务增长调整配置
4. 定期验证备份文件

## 监控地址
性能监控: http://$(hostname -I | awk '{print $1}'):9090
MySQL监控日志: /var/log/mysql-monitor.log
备份文件目录: /var/backups/mysql
EOF

    cat $REPORT_FILE
    echo ""
    log "完整报告已保存到: $REPORT_FILE"
}

# 主函数
main() {
    log "开始MySQL优化..."

    check_mysql
    get_available_memory
    create_mysql_config
    apply_mysql_config
    runtime_optimization
    create_monitor_script
    create_backup_script
    performance_test
    generate_report

    log "MySQL优化完成！"
    warn "建议在业务低峰期执行此脚本"
    warn "请监控MySQL性能，根据实际情况调整参数"
}

# 运行主函数
main "$@"