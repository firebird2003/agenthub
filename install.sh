#!/usr/bin/env bash
# -*- coding: utf-8 -*-

# AgentHub 安装脚本 - 简洁交互式界面

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 路径配置
AGENTHUB_DIR="$HOME/agenthub"

print_info() { echo -e "${BLUE}[信息]${NC} $1"; }
print_success() { echo -e "${GREEN}[成功]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[警告]${NC} $1"; }
print_error() { echo -e "${RED}[错误]${NC} $1"; }

# 检测 Node.js
check_node() {
    if command -v node &> /dev/null; then
        print_success "Node.js $(node --version)"
    else
        print_error "Node.js 未安装"
        echo "请先安装 Node.js: brew install node (macOS) 或 apt install nodejs (Ubuntu)"
        exit 1
    fi
}

# 检测 npm
check_npm() {
    if command -v npm &> /dev/null; then
        print_success "npm $(npm --version)"
    else
        print_error "npm 未安装"
        exit 1
    fi
}

# 安装依赖
install_deps() {
    print_info "安装依赖..."
    mkdir -p "$AGENTHUB_DIR"
    cp -r "$(dirname "$0")"/* "$AGENTHUB_DIR/" 2>/dev/null || true
    cd "$AGENTHUB_DIR"
    npm install --registry=https://registry.npmmirror.com 2>/dev/null || npm install
    print_success "依赖安装完成"
}

# 初始化数据库
init_db() {
    print_info "初始化数据库..."
    cd "$AGENTHUB_DIR"
    node -e "require('./database/init').initDatabase()" 2>/dev/null || node -e "const{initDatabase}=require('./database/init');initDatabase()"
    print_success "数据库初始化完成"
}

# 启动服务
start() {
    if pgrep -f "node server.js" > /dev/null 2>&1; then
        print_warning "服务已在运行"
        PORT=$(cat "$AGENTHUB_DIR/logs/agenthub.port" 2>/dev/null || echo "3000")
        echo "访问 http://localhost:$PORT"
        return
    fi

    print_info "启动服务..."
    cd "$AGENTHUB_DIR"
    mkdir -p "$AGENTHUB_DIR/logs"
    nohup node server.js > "$AGENTHUB_DIR/logs/agenthub.log" 2>&1 &
    sleep 2

    if pgrep -f "node server.js" > /dev/null 2>&1; then
        PORT=$(cat "$AGENTHUB_DIR/logs/agenthub.port" 2>/dev/null || echo "3000")
        echo ""
        print_success "AgentHub 已启动！"
        echo "访问 http://localhost:$PORT"
    else
        print_error "启动失败，请查看日志: $AGENTHUB_DIR/logs/agenthub.log"
    fi
}

# 停止服务
stop() {
    pkill -f "node server.js" 2>/dev/null || true
    print_success "服务已停止"
}

# 查看状态
status() {
    if pgrep -f "node server.js" > /dev/null 2>&1; then
        PORT=$(cat "$AGENTHUB_DIR/logs/agenthub.port" 2>/dev/null || echo "3000")
        echo "● 运行中 - http://localhost:$PORT"
    else
        echo "○ 未运行"
    fi
}

# 卸载
uninstall() {
    echo -n "确定要卸载 AgentHub 吗？(y/n): "
    read -r confirm
    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
        stop
        rm -rf "$AGENTHUB_DIR"
        print_success "已卸载"
    else
        echo "取消"
    fi
}

# 主菜单
show_menu() {
    echo ""
    echo "┌─────────────────────────────┐"
    echo "│     AgentHub 安装向导      │"
    echo "├─────────────────────────────┤"
    echo "│  1. 安装并启动             │"
    echo "│  2. 启动服务              │"
    echo "│  3. 停止服务              │"
    echo "│  4. 查看状态              │"
    echo "│  5. 卸载                  │"
    echo "│  0. 退出                  │"
    echo "└─────────────────────────────┘"
    echo ""
    echo -n "请选择 [0-5]: "
}

# 主入口
main() {
    # 检查命令参数
    case "${1:-menu}" in
        install)
            check_node
            check_npm
            install_deps
            init_db
            start
            ;;
        start)
            start
            ;;
        stop)
            stop
            ;;
        restart)
            stop
            sleep 1
            start
            ;;
        status)
            status
            ;;
        uninstall)
            uninstall
            ;;
        menu)
            # 交互模式
            while true; do
                show_menu
                read -r choice
                case "$choice" in
                    1)
                        check_node
                        check_npm
                        install_deps
                        init_db
                        start
                        break
                        ;;
                    2)
                        start
                        ;;
                    3)
                        stop
                        ;;
                    4)
                        status
                        ;;
                    5)
                        uninstall
                        ;;
                    0)
                        echo "再见!"
                        exit 0
                        ;;
                    *)
                        print_error "无效选择，请重试"
                        ;;
                esac
            done
            ;;
        help|--help|-h)
            echo "用法: $0 [命令]"
            echo ""
            echo "命令:"
            echo "  install   - 安装并启动"
            echo "  start     - 启动服务"
            echo "  stop      - 停止服务"
            echo "  restart   - 重启服务"
            echo "  status    - 查看状态"
            echo "  uninstall - 卸载"
            echo "  menu      - 交互模式 (默认)"
            ;;
        *)
            echo "未知命令: $1"
            echo "使用 $0 help 查看帮助"
            exit 1
            ;;
    esac
}

main "$@"
