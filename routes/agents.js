/**
 * 代理相关 API 路由
 */

const fp = require('fastify-plugin');
const { prepare } = require('../database/init');

async function agentRoutes(fastify, options) {
    // 获取所有代理列表（含当前状态）
    fastify.get('/api/agents', async (request, reply) => {
        const agents = prepare(`
            SELECT a.*, s.online, s.last_active, s.current_task,
                   s.health_score, s.tokens_used, s.tasks_completed
            FROM agents a
            LEFT JOIN agent_status s ON a.id = s.agent_id
            ORDER BY a.created_at DESC
        `).all();

        return agents;
    });

    // 获取单个代理详情
    fastify.get('/api/agents/:id', async (request, reply) => {
        const { id } = request.params;

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
        const { id, name, personality, role, duties, skills, channel, workspace, initial_tokens, max_concurrent_tasks } = request.body;

        if (!id || !name) {
            reply.code(400);
            return { error: '缺少必要字段' };
        }

        try {
            // 插入代理基本信息
            prepare(`
                INSERT INTO agents (id, name, personality, role, duties, skills, channel, workspace, initial_tokens, max_concurrent_tasks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(id, name, personality || null, role || null, duties || null, skills || null, channel || null, workspace || null, initial_tokens || 10000, max_concurrent_tasks || 1);

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
        const { name, personality, role, duties, skills, channel, workspace, initial_tokens, max_concurrent_tasks } = request.body;

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
            channel || current.channel,
            workspace || current.workspace,
            initial_tokens || current.initial_tokens || 10000,
            max_concurrent_tasks || current.max_concurrent_tasks || 1,
            id
        );

        return { success: true };
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
