#!/usr/bin/env node
/**
 * AgentHub 主服务器
 * AI 代理管理平台
 */

const path = require('path');
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const websocket = require('@fastify/websocket');
const fs = require('fs');

// 配置文件
const CONFIG = require('./config');

// 路由
const agentRoutes = require('./routes/agents');
const statusRoutes = require('./routes/status');
const messageRoutes = require('./routes/messages');

let fastify;

async function buildServer() {
    fastify = Fastify({
        logger: true
    });

    // 注册插件
    await fastify.register(cors, {
        origin: true
    });

    await fastify.register(websocket);

    // 注册路由
    fastify.register(agentRoutes);
    fastify.register(statusRoutes);
    fastify.register(messageRoutes);

    // 健康检查
    fastify.get('/api/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // WebSocket 端点
    fastify.get('/ws', { websocket: true }, (socket, req) => {
        console.log('WebSocket 客户端连接');

        socket.on('message', message => {
            try {
                const data = JSON.parse(message.toString());
                handleWebSocketMessage(socket, data);
            } catch (e) {
                console.error('WebSocket 消息解析失败:', e);
            }
        });

        socket.on('close', () => {
            console.log('WebSocket 客户端断开');
        });
    });

    // 提供静态文件
    fastify.register(require('@fastify/static'), {
        root: path.join(__dirname, 'public'),
        prefix: '/'
    });

    return fastify;
}

function handleWebSocketMessage(socket, data) {
    const { type, target, payload } = data;

    switch (type) {
        case 'ping':
            socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;

        case 'subscribe':
            socket.agentId = payload?.agent_id;
            socket.send(JSON.stringify({ type: 'subscribed', agent_id: payload?.agent_id }));
            break;

        case 'query':
            const { prepare } = require('./database/init');
            const agent = prepare(`
                SELECT a.*, s.online, s.last_active, s.current_task, s.health_score
                FROM agents a
                LEFT JOIN agent_status s ON a.id = s.agent_id
                WHERE a.id = ?
            `).get(target);

            socket.send(JSON.stringify({
                type: 'query_response',
                target,
                data: agent
            }));
            break;

        default:
            console.log('未知 WebSocket 消息类型:', type);
    }
}

async function start() {
    // 确保必要目录存在
    CONFIG.ensureDirs();

    // 初始化数据库
    const { initDatabase } = require('./database/init');
    await initDatabase();

    // 构建服务器
    fastify = await buildServer();

    // 获取端口
    let port = CONFIG.getPort();

    // 检查端口是否可用，如不可用则自动寻找可用端口
    const isAvailable = await CONFIG.isPortAvailable(port);
    if (!isAvailable) {
        port = await CONFIG.findAvailablePort(port);
        console.log(`默认端口被占用，使用端口: ${port}`);
    }

    // 启动服务器
    try {
        await fastify.listen({ port: port, host: '0.0.0.0' });
        console.log(`
============================================
  AgentHub 代理管理平台已启动
  本地访问: http://localhost:${port}
  WebSocket: ws://localhost:${port}/ws
============================================
        `);

        // 保存端口到文件
        const portFile = path.join(CONFIG.getLogDir(), 'agenthub.port');
        fs.writeFileSync(portFile, port.toString());

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务器...');
    const { closeDatabase } = require('./database/init');
    closeDatabase();
    await fastify.close();
    process.exit(0);
});

// 启动
start();
