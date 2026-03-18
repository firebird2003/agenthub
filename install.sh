#!/usr/bin/env bash
# -*- coding: utf-8 -*-
#
# AgentHub 安装脚本
# AI 代理管理平台
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTHUB_DIR="$HOME/agenthub"

# 打印函数
print_info() { echo -e "${BLUE}[信息]${NC} $1"; }
print_success() { echo -e "${GREEN}[成功]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[警告]${NC} $1"; }
print_error() { echo -e "${RED}[错误]${NC} $1"; }

# 检测 Node.js
check_node() {
    print_info "检测 Node.js..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js 版本: $NODE_VERSION"
    else
        print_error "Node.js 未安装，请先安装 Node.js"
        echo "安装方法："
        echo "  macOS: brew install node"
        echo "  Ubuntu: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
        exit 1
    fi
}

# 检测 npm
check_npm() {
    print_info "检测 npm..."
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm 版本: $NPM_VERSION"
    else
        print_error "npm 未安装"
        exit 1
    fi
}

# 安装依赖
install_deps() {
    print_info "安装依赖..."

    # 复制文件到目标目录
    if [ "$SCRIPT_DIR" != "$AGENTHUB_DIR" ]; then
        print_info "复制文件到 $AGENTHUB_DIR..."
        mkdir -p "$AGENTHUB_DIR"
        cp -r "$SCRIPT_DIR"/* "$AGENTHUB_DIR/" 2>/dev/null || true
    fi

    cd "$AGENTHUB_DIR"

    # 安装 npm 依赖
    print_info "安装 npm 包..."
    npm install --registry=https://registry.npmmirror.com || npm install

    print_success "依赖安装完成"
}

# 初始化数据库
init_database() {
    print_info "初始化数据库..."
    cd "$AGENTHUB_DIR"
    node -e "
        const { initDatabase } = require('./database/init.js');
        initDatabase();
    "
}

# 启动服务
start_service() {
    print_info "启动 AgentHub 服务..."

    cd "$AGENTHUB_DIR"

    # 检查是否已在运行
    if pgrep -f "node server.js" > /dev/null; then
        print_warning "服务已在运行"
        return
    fi

    # 后台启动
    nohup node server.js > "$AGENTHUB_DIR/logs/agenthub.log" 2>&1 &
    sleep 2

    # 检查是否启动成功
    if pgrep -f "node server.js" > /dev/null; then
        # 获取端口
        sleep 1
        PORT=$(cat "$AGENTHUB_DIR/logs/agenthub.port" 2>/dev/null || echo "3000")
        print_success "服务已启动！"
        echo ""
        echo "访问地址: http://localhost:$PORT"
    else
        print_error "服务启动失败，请查看日志: $AGENTHUB_DIR/logs/agenthub.log"
    fi
}

# 停止服务
stop_service() {
    print_info "停止服务..."
    pkill -f "node server.js" 2>/dev/null || true
    print_success "服务已停止"
}

# 查看状态
service_status() {
    if pgrep -f "node server.js" > /dev/null; then
        PORT=$(cat "$AGENTHUB_DIR/logs/agenthub.port" 2>/dev/null || echo "3000")
        print_success "服务正在运行，访问地址: http://localhost:$PORT"
    else
        print_warning "服务未运行"
    fi
}

# 卸载
uninstall() {
    print_warning "确定要卸载 AgentHub 吗？"
    read -p "此操作将删除所有数据 (y/N): " CONFIRM

    if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
        stop_service
        rm -rf "$AGENTHUB_DIR"
        print_success "卸载完成"
    else
        print_info "取消卸载"
    fi
}

# 显示帮助
show_help() {
    cat << EOF
AgentHub 安装脚本

用法: $0 [命令]

命令:
  install           安装并启动服务
  start             启动服务
  stop              停止服务
  restart           重启服务
  status            查看服务状态
  uninstall         卸载
  help              显示帮助

示例:
  $0 install        # 安装并启动
  $0 start          # 启动服务
  $0 status         # 查看状态
EOF
}

# 主入口
main() {
    # 确保日志目录存在
    mkdir -p "$AGENTHUB_DIR/logs"

    case "$1" in
        install)
            check_node
            check_npm
            install_deps
            init_database
            start_service
            ;;
        start)
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            stop_service
            sleep 1
            start_service
            ;;
        status)
            service_status
            ;;
        uninstall)
            uninstall
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            # 无参数时显示帮助
            show_help
            ;;
    esac
}

main "$@"
