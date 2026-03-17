# AgentHub

AI 代理管理平台 - 可视化管理多个 AI 代理

## 功能特性

- **代理管理**：创建、查看、删除 AI 代理
- **状态监控**：实时查看代理在线状态、当前任务、健康评分
- **消息中心**：接收代理的报告、警报、状态变更通知
- **WebSocket 支持**：实时状态更新
- **本地部署**：数据存储在本地 SQLite 数据库

## 技术栈

- 后端：Node.js + Fastify
- 前端：原生 HTML/CSS/JS
- 数据库：SQLite (WAL 模式)
- 实时通信：WebSocket

## 系统要求

- Node.js 18+
- npm 8+

## 安装

### 一键安装

```bash
curl -sL https://raw.githubusercontent.com/firebird2003/agenthub/main/install.sh | bash
```

### 手动安装

```bash
# 克隆仓库
git clone https://github.com/firebird2003/agenthub.git
cd agenthub

# 运行安装脚本
chmod +x install.sh
./install.sh
```

## 使用

### 服务管理

```bash
./install.sh install    # 安装并启动
./install.sh start      # 启动服务
./install.sh stop       # 停止服务
./install.sh restart    # 重启服务
./install.sh status     # 查看状态
./install.sh uninstall  # 卸载
```

### 访问

服务启动后，访问 http://localhost:3000

如果端口被占用，会自动选择可用端口（3000-3099）。

## API 接口

### 代理管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/agents` | GET | 获取所有代理 |
| `/api/agents/:id` | GET | 获取单个代理 |
| `/api/agents` | POST | 创建代理 |
| `/api/agents/:id` | PUT | 更新代理 |
| `/api/agents/:id` | DELETE | 删除代理 |

### 状态管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/agents/:id/status` | PATCH | 更新状态 |
| `/api/agents/:id/heartbeat` | POST | 心跳 |
| `/api/agents/:id/history` | GET | 状态历史 |

### 消息

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/messages` | GET | 获取消息 |
| `/api/messages` | POST | 发送消息 |
| `/api/messages/:id/read` | PATCH | 标记已读 |

## 代理状态上报

代理可以通过 API 上报状态：

```javascript
// 任务完成时
await fetch('http://localhost:3000/api/agents/dev-001/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        online: true,
        current_task: '完成代码审查',
        health_score: 90,
        tokens_used: 5000,
        tasks_completed: 1
    })
});

// 心跳
await fetch('http://localhost:3000/api/agents/dev-001/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        status: 'working',
        current_task: '处理 PR #123',
        health: { score: 85, cpu: 45, memory: 60 }
    })
});
```

## 目录结构

```
agenthub/
├── package.json           # 项目配置
├── server.js              # 主入口
├── config.js              # 配置文件
├── install.sh             # 安装脚本
├── database/
│   ├── init.js            # 数据库初始化
│   └── cleanup.js         # 清理脚本
├── routes/
│   ├── agents.js          # 代理 API
│   ├── status.js          # 状态 API
│   └── messages.js        # 消息 API
├── public/                # 前端页面
│   ├── index.html         # 仪表盘
│   ├── agent.html         # 代理详情
│   ├── messages.html      # 消息中心
│   ├── css/style.css
│   └── js/app.js
└── hr/                    # 人事文件目录
```

## 数据存储

- 数据库：`~/agenthub/database/agenthub.db`
- 日志：`~/agenthub/logs/`
- 人事文件：`~/agenthub/hr/`

## 常见问题

### 端口被占用

安装脚本会自动检测并选择可用端口。如果需要手动指定端口：

```bash
PORT=8080 node server.js
```

### 数据库备份

```bash
# 备份
cp ~/agenthub/database/agenthub.db ~/backup/agenthub-$(date +%Y%m%d).db

# 恢复
cp ~/backup/agenthub-20260317.db ~/agenthub/database/agenthub.db
```

### 查看日志

```bash
tail -f ~/agenthub/logs/agenthub.log
```

## 相关项目

- [openclaw](https://github.com/yeji/openclaw) - AI 代理管理平台
- [conversation-save](https://github.com/firebird2003/conversation-save) - AI 对话保存工具

## 许可证

MIT License

## 作者

yeji
