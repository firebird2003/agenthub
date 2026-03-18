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

    // 获取已安装的技能列表
    fastify.get('/api/skills', async () => {
        const skillsDir = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'workspace', 'skills');
        const skills = [];

        try {
            if (fs.existsSync(skillsDir)) {
                const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const skillPath = path.join(skillsDir, entry.name);
                        const skillMdPath = path.join(skillPath, 'SKILL.md');

                        let name = entry.name;
                        let description = '';

                        if (fs.existsSync(skillMdPath)) {
                            const content = fs.readFileSync(skillMdPath, 'utf-8');
                            // 解析 frontmatter
                            const match = content.match(/^---\n([\s\S]*?)\n---/);
                            if (match) {
                                const fm = match[1];
                                const nameMatch = fm.match(/name:\s*(.+)/);
                                const descMatch = fm.match(/description:\s*(.+)/);
                                if (nameMatch) name = nameMatch[1].trim();
                                if (descMatch) description = descMatch[1].trim();
                            }
                        }

                        skills.push({
                            slug: entry.name,
                            name,
                            description
                        });
                    }
                }
            }
        } catch (error) {
            console.error('获取技能列表失败:', error);
        }

        return skills;
    });

    // 获取代理活动状态（检查文件更新时间）
    fastify.get('/api/agents/activity', async () => {
        const agentsDir = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'workspace', 'agents');
        const mainAgentDir = path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw', 'workspace');
        const activity = {};
        const now = new Date();
        const threshold = 5 * 60 * 1000; // 5分钟

        // 检查子代理目录
        try {
            if (fs.existsSync(agentsDir)) {
                const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        const agentPath = path.join(agentsDir, entry.name);
                        const lastActivity = getLastActivityTime(agentPath);
                        if (lastActivity) {
                            const diff = now - lastActivity;
                            activity[entry.name] = {
                                last_active: lastActivity.toISOString(),
                                is_active: diff < threshold,
                                diff_minutes: Math.floor(diff / 60000)
                            };
                        }
                    }
                }
            }
        } catch (error) {
            console.error('检查代理目录失败:', error);
        }

        // 检查主代理
        try {
            const lastActivity = getLastActivityTime(mainAgentDir);
            if (lastActivity) {
                const diff = now - lastActivity;
                activity['main'] = {
                    last_active: lastActivity.toISOString(),
                    is_active: diff < threshold,
                    diff_minutes: Math.floor(diff / 60000)
                };
            }
        } catch (error) {
            console.error('检查主代理目录失败:', error);
        }

        return activity;
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

// 获取目录最后活动时间（检查关键文件）
function getLastActivityTime(dirPath) {
    const keyFiles = ['MEMORY.md', 'IDENTITY.md', 'SOUL.md', 'sessions', 'memory'];
    let latestTime = null;

    try {
        // 检查目录本身
        const dirStat = fs.statSync(dirPath);
        latestTime = dirStat.mtime;

        // 检查关键文件
        for (const file of keyFiles) {
            const filePath = path.join(dirPath, file);
            if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                if (stat.mtime > latestTime) {
                    latestTime = stat.mtime;
                }
            }
        }

        // 检查子目录（如 sessions/）
        const subDirs = ['sessions', 'memory', 'skills'];
        for (const subDir of subDirs) {
            const subPath = path.join(dirPath, subDir);
            if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
                const entries = fs.readdirSync(subPath);
                for (const entry of entries) {
                    const entryPath = path.join(subPath, entry);
                    const stat = fs.statSync(entryPath);
                    if (stat.mtime > latestTime) {
                        latestTime = stat.mtime;
                    }
                }
            }
        }
    } catch (error) {
        // 忽略错误
    }

    return latestTime;
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
