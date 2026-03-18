# AgentHub

AI 代理管理平台 - 可视化管理多个 AI 代理

## 一键安装/启动

```bash
bash <(curl -sL https://raw.githubusercontent.com/firebird2003/agenthub/main/install.sh)
```

或者：

```bash
# 克隆到本地后安装
git clone https://github.com/firebird2003/agenthub.git ~/agenthub
cd ~/agenthub
bash install.sh install
```

## 命令

| 命令 | 说明 |
|------|------|
| `install` | 安装并启动 |
| `start` | 启动服务 |
| `stop` | 停止服务 |
| `restart` | 重启服务 |
| `status` | 查看状态 |
| `uninstall` | 卸载 |

服务启动后访问 http://localhost:3000

## 功能

- **代理管理**：创建、编辑、删除 AI 代理
- **状态监控**：实时查看代理状态（5分钟无活动显示需要介入）
- **主代理支持**：显示主代理（main）状态
- **消息中心**：接收代理的报告和警报

## API

```bash
# 获取所有代理
curl http://localhost:3000/api/agents

# 获取代理详情
curl http://localhost:3000/api/agents/dev-001

# 创建代理
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"id":"dev-001","name":"开发代理"}'
```

## 数据位置

- 数据库：`~/agenthub/database/agenthub.db`
- 日志：`~/agenthub/logs/`

## 相关项目

- [openclaw](https://github.com/yeji/openclaw) - AI 代理管理平台

## 许可证

MIT
