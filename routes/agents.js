/**
 * 代理相关 API 路由
 */

const fp = require('fastify-plugin');
const path = require('path');
const fs = require('fs');
const { prepare } = require('../database/init');

async function agentRoutes(fastify, options) {
    // 获取所有代理列表（含当前状态和活动状态）
    fastify.get('/api/agents', async (request, reply) => {
        const agents = prepare(`
            SELECT a.*, s.online, s.last_active, s.current_task,
                   s.health_score, s.tokens_used, s.tasks_completed
            FROM agents a
            LEFT JOIN agent_status s ON a.id = s.agent_id
            ORDER BY a.created_at DESC
        `).all();

        // 获取活动状态
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        const agentsDir = path.join(homeDir, '.openclaw', 'workspace', 'agents');
        const mainAgentDir = path.join(homeDir, '.openclaw', 'workspace');
        const now = new Date();
        const threshold = 5 * 60 * 1000; // 5分钟

        // 获取目录最后活动时间
        const getLastActivityTime = (dirPath) => {
            const keyFiles = ['MEMORY.md', 'IDENTITY.md', 'SOUL.md', 'sessions', 'memory'];
            let latestTime = null;
            try {
                const dirStat = fs.statSync(dirPath);
                latestTime = dirStat.mtime;
                for (const file of keyFiles) {
                    const filePath = path.join(dirPath, file);
                    if (fs.existsSync(filePath)) {
                        const stat = fs.statSync(filePath);
                        if (stat.mtime > latestTime) latestTime = stat.mtime;
                    }
                }
                const subDirs = ['sessions', 'memory', 'skills'];
                for (const subDir of subDirs) {
                    const subPath = path.join(dirPath, subDir);
                    if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
                        const entries = fs.readdirSync(subPath);
                        for (const entry of entries) {
                            const stat = fs.statSync(path.join(subPath, entry));
                            if (stat.mtime > latestTime) latestTime = stat.mtime;
                        }
                    }
                }
            } catch (e) {}
            return latestTime;
        };

        // 合并活动状态到代理列表
        const result = agents.map(agent => {
            const agentPath = path.join(agentsDir, agent.id);
            let isActive = false;
            let lastActivity = null;

            if (fs.existsSync(agentPath)) {
                const lastTime = getLastActivityTime(agentPath);
                if (lastTime) {
                    lastActivity = lastTime.toISOString();
                    isActive = (now - lastTime) < threshold;
                }
            }

            // 如果数据库中有在线状态，优先使用
            const online = agent.online || isActive;

            return {
                ...agent,
                is_active: online,
                last_activity: lastActivity || agent.last_active
            };
        });

        // 添加主代理
        if (fs.existsSync(mainAgentDir)) {
            const mainLastTime = getLastActivityTime(mainAgentDir);
            if (mainLastTime) {
                const isMainActive = (now - mainLastTime) < threshold;
                result.unshift({
                    id: 'main',
                    name: '主代理',
                    role: 'main',
                    is_active: isMainActive,
                    last_activity: mainLastTime.toISOString(),
                    is_main: true
                });
            }
        }

        return result;
    });

    // 获取单个代理详情
    fastify.get('/api/agents/:id', async (request, reply) => {
        const { id } = request.params;

        // 处理主代理
        if (id === 'main') {
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            const mainAgentDir = path.join(homeDir, '.openclaw', 'workspace');
            const now = new Date();
            const threshold = 5 * 60 * 1000;

            const getLastActivityTime = (dirPath) => {
                const keyFiles = ['MEMORY.md', 'IDENTITY.md', 'SOUL.md', 'sessions', 'memory'];
                let latestTime = null;
                try {
                    const dirStat = fs.statSync(dirPath);
                    latestTime = dirStat.mtime;
                    for (const file of keyFiles) {
                        const filePath = path.join(dirPath, file);
                        if (fs.existsSync(filePath)) {
                            const stat = fs.statSync(filePath);
                            if (stat.mtime > latestTime) latestTime = stat.mtime;
                        }
                    }
                    const subDirs = ['sessions', 'memory', 'skills'];
                    for (const subDir of subDirs) {
                        const subPath = path.join(dirPath, subDir);
                        if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
                            const entries = fs.readdirSync(subPath);
                            for (const entry of entries) {
                                const stat = fs.statSync(path.join(subPath, entry));
                                if (stat.mtime > latestTime) latestTime = stat.mtime;
                            }
                        }
                    }
                } catch (e) {}
                return latestTime;
            };

            const lastTime = getLastActivityTime(mainAgentDir);
            const isActive = lastTime ? (now - lastTime) < threshold : false;

            // 读取主代理的 SOUL.md 获取名字
            let name = '主代理';
            const soulPath = path.join(mainAgentDir, 'SOUL.md');
            if (fs.existsSync(soulPath)) {
                const content = fs.readFileSync(soulPath, 'utf-8');
                const nameMatch = content.match(/^## 名字$\s*([^\n]+)/m);
                if (nameMatch) name = nameMatch[1].trim();
            }

            return {
                id: 'main',
                name: name,
                role: 'main',
                personality: '',
                duties: '',
                skills: '',
                wanted_skills: '',
                channel: null,
                workspace: homeDir,
                created_at: '',
                is_active: isActive,
                last_activity: lastTime ? lastTime.toISOString() : null,
                is_main: true
            };
        }

        const agent = prepare(`
            SELECT a.*, s.online, s.last_active, s.current_task,
                   s.health_score, s.tokens_used, s.tasks_completed
            FROM agents a
            LEFT JOIN agent_status s ON a.id = s.agent_id
            WHERE a.id = ?
        `).get(id);

        if (!agent) {
            reply.code(404);
            return { error: '代理不存在' };
        }

        return agent;
    });

    // 创建新代理
    fastify.post('/api/agents', async (request, reply) => {
        const { id, name, personality, role, duties, skills, wanted_skills, channel, workspace, initial_tokens, max_concurrent_tasks } = request.body;

        if (!id || !name) {
            reply.code(400);
            return { error: '缺少必要字段' };
        }

        try {
            // 插入代理基本信息
            prepare(`
                INSERT INTO agents (id, name, personality, role, duties, skills, wanted_skills, channel, workspace, initial_tokens, max_concurrent_tasks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(id, name, personality || null, role || null, duties || null, skills || null, wanted_skills || null, channel || null, workspace || null, initial_tokens || 10000, max_concurrent_tasks || 1);

            // 初始化状态
            prepare(`
                INSERT INTO agent_status (agent_id, online, last_active)
                VALUES (?, 0, datetime('now'))
            `).run(id);

            reply.code(201);
            return { success: true, id };
        } catch (error) {
            console.error('Create agent error:', error);
            if (error.message && error.message.includes('UNIQUE constraint failed')) {
                reply.code(409);
                return { error: '代理ID已存在' };
            }
            reply.code(500);
            return { error: error.message };
        }
    });

    // 更新代理基本信息
    fastify.put('/api/agents/:id', async (request, reply) => {
        const { id } = request.params;
        const { name, personality, role, duties, skills, wanted_skills, channel, workspace, initial_tokens, max_concurrent_tasks } = request.body;

        // 获取当前值
        const current = prepare('SELECT * FROM agents WHERE id = ?').get(id);
        if (!current) {
            reply.code(404);
            return { error: '代理不存在' };
        }

        prepare(`
            UPDATE agents
            SET name = ?,
                personality = ?,
                role = ?,
                duties = ?,
                skills = ?,
                wanted_skills = ?,
                channel = ?,
                workspace = ?,
                initial_tokens = ?,
                max_concurrent_tasks = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).run(
            name || current.name,
            personality || current.personality,
            role || current.role,
            duties || current.duties,
            skills || current.skills,
            wanted_skills || current.wanted_skills,
            channel || current.channel,
            workspace || current.workspace,
            initial_tokens || current.initial_tokens || 10000,
            max_concurrent_tasks || current.max_concurrent_tasks || 1,
            id
        );

        return { success: true };
    });

    // 更新代理配置（同步到 OpenClaw 文件系统）
    fastify.patch('/api/agents/:id/config', async (request, reply) => {
        const { id } = request.params;
        const { name, personality, role, duties, skills, wanted_skills, workspace } = request.body;

        // 获取当前值
        const current = prepare('SELECT * FROM agents WHERE id = ?').get(id);
        if (!current) {
            reply.code(404);
            return { error: '代理不存在' };
        }

        const homeDir = process.env.HOME || process.env.USERPROFILE;
        const agentDir = path.join(homeDir, '.openclaw', 'workspace', 'agents', id);

        try {
            // 更新 IDENTITY.md - 直接构建新内容
            const identityPath = path.join(agentDir, 'IDENTITY.md');
            if (fs.existsSync(identityPath)) {
                let content = fs.readFileSync(identityPath, 'utf-8');
                const lines = content.split('\n');

                // 提取各部分内容
                let sections = {};
                let currentSection = null;
                let sectionContent = [];

                for (const line of lines) {
                    if (line.startsWith('## ')) {
                        if (currentSection) {
                            sections[currentSection] = sectionContent.join('\n');
                        }
                        currentSection = line.substring(3).trim();
                        sectionContent = [line];
                    } else {
                        sectionContent.push(line);
                    }
                }
                if (currentSection) {
                    sections[currentSection] = sectionContent.join('\n');
                }

                // 更新字段
                if (name) {
                    sections['基本信息'] = sections['基本信息'].replace(/- 名字:\s*.*/, `- 名字: ${name}`);
                }
                if (role) {
                    sections['基本信息'] = sections['基本信息'].replace(/- 角色:\s*.*/, `- 角色: ${role}`);
                }
                if (duties) {
                    const dutiesList = duties.split(',').map(d => `- ${d.trim()}`).join('\n');
                    sections['工作职责'] = `## 工作职责\n${dutiesList}`;
                }
                if (skills) {
                    const skillsList = skills.split(',').map(s => `- ${s.trim()}`).join('\n');
                    sections['技能'] = `## 技能\n${skillsList}`;
                }

                // 重建文件
                const newContent = Object.values(sections).join('\n\n');
                fs.writeFileSync(identityPath, newContent, 'utf-8');
            }

            // 更新 SOUL.md
            const soulPath = path.join(agentDir, 'SOUL.md');
            if (fs.existsSync(soulPath)) {
                let content = fs.readFileSync(soulPath, 'utf-8');

                // 更新名字章节
                if (name) {
                    const nameMatch = content.match(/## 名字\n([\s\S]*?)(?=\n## )/);
                    if (nameMatch) {
                        content = content.replace(nameMatch[0], `## 名字\n${name}\n`);
                    }
                }

                // 更新性格章节
                if (personality) {
                    const personalityMatch = content.match(/## 性格\n([\s\S]*?)(?=\n## )/);
                    if (personalityMatch) {
                        content = content.replace(personalityMatch[0], `## 性格\n${personality}\n`);
                    }
                }

                // 更新角色章节
                if (role) {
                    const roleMatch = content.match(/## 角色\n([\s\S]*?)(?=\n## )/);
                    if (roleMatch) {
                        content = content.replace(roleMatch[0], `## 角色\n${role}\n`);
                    }
                }

                fs.writeFileSync(soulPath, content, 'utf-8');
            }

            // 更新数据库
            prepare(`
                UPDATE agents
                SET name = ?,
                    personality = ?,
                    role = ?,
                    duties = ?,
                    skills = ?,
                    wanted_skills = ?,
                    workspace = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            `).run(
                name || current.name,
                personality || current.personality,
                role || current.role,
                duties || current.duties,
                skills || current.skills,
                wanted_skills || current.wanted_skills,
                workspace || current.workspace,
                id
            );

            return { success: true };
        } catch (error) {
            console.error('更新代理配置失败:', error);
            reply.code(500);
            return { error: error.message };
        }
    });

    // 删除代理
    fastify.delete('/api/agents/:id', async (request, reply) => {
        const { id } = request.params;

        // 检查是否存在
        const agent = prepare('SELECT id FROM agents WHERE id = ?').get(id);
        if (!agent) {
            reply.code(404);
            return { error: '代理不存在' };
        }

        // 删除状态历史
        prepare('DELETE FROM agent_status_history WHERE agent_id = ?').run(id);

        // 删除状态
        prepare('DELETE FROM agent_status WHERE agent_id = ?').run(id);

        // 删除消息
        prepare('DELETE FROM messages WHERE from_agent_id = ? OR to_agent_id = ?').run(id, id);

        // 删除代理
        prepare('DELETE FROM agents WHERE id = ?').run(id);

        return { success: true };
    });

    // 获取代理状态历史
    fastify.get('/api/agents/:id/history', async (request, reply) => {
        const { id } = request.params;
        const { limit = 50 } = request.query;

        const history = prepare(`
            SELECT * FROM agent_status_history
            WHERE agent_id = ?
            ORDER BY changed_at DESC
            LIMIT ?
        `).all(id, parseInt(limit));

        return history;
    });
}

module.exports = fp(agentRoutes);
