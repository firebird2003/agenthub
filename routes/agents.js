/**
 * 代理相关 API 路由
 */

const { getDb } = require('../database/init');

function agentRoutes(fastify, options) {
    const db = getDb();

    // 获取所有代理列表（含当前状态）
    fastify.get('/api/agents', async (request, reply) => {
        const agents = db.prepare(`
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

        const agent = db.prepare(`
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
        const { id, name, personality, role, duties, skills, channel, workspace } = request.body;

        if (!id || !name) {
            reply.code(400);
            return { error: '缺少必要字段' };
        }

        try {
            // 插入代理基本信息
            db.prepare(`
                INSERT INTO agents (id, name, personality, role, duties, skills, channel, workspace)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(id, name, personality, role, duties, skills, channel, workspace);

            // 初始化状态
            db.prepare(`
                INSERT INTO agent_status (agent_id, online, last_active)
                VALUES (?, 0, datetime('now'))
            `).run(id);

            reply.code(201);
            return { success: true, id };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                reply.code(409);
                return { error: '代理ID已存在' };
            }
            throw error;
        }
    });

    // 更新代理基本信息
    fastify.put('/api/agents/:id', async (request, reply) => {
        const { id } = request.params;
        const { name, personality, role, duties, skills, channel, workspace } = request.body;

        const result = db.prepare(`
            UPDATE agents
            SET name = COALESCE(?, name),
                personality = COALESCE(?, personality),
                role = COALESCE(?, role),
                duties = COALESCE(?, duties),
                skills = COALESCE(?, skills),
                channel = COALESCE(?, channel),
                workspace = COALESCE(?, workspace),
                updated_at = datetime('now')
            WHERE id = ?
        `).run(name, personality, role, duties, skills, channel, workspace, id);

        if (result.changes === 0) {
            reply.code(404);
            return { error: '代理不存在' };
        }

        return { success: true };
    });

    // 删除代理
    fastify.delete('/api/agents/:id', async (request, reply) => {
        const { id } = request.params;

        // 删除状态历史
        db.prepare('DELETE FROM agent_status_history WHERE agent_id = ?').run(id);

        // 删除状态
        db.prepare('DELETE FROM agent_status WHERE agent_id = ?').run(id);

        // 删除消息
        db.prepare('DELETE FROM messages WHERE from_agent_id = ? OR to_agent_id = ?').run(id, id);

        // 删除代理
        const result = db.prepare('DELETE FROM agents WHERE id = ?').run(id);

        if (result.changes === 0) {
            reply.code(404);
            return { error: '代理不存在' };
        }

        return { success: true };
    });

    // 获取代理状态历史
    fastify.get('/api/agents/:id/history', async (request, reply) => {
        const { id } = request.params;
        const { limit = 50 } = request.query;

        const history = db.prepare(`
            SELECT * FROM agent_status_history
            WHERE agent_id = ?
            ORDER BY changed_at DESC
            LIMIT ?
        `).all(id, parseInt(limit));

        return history;
    });
}

module.exports = agentRoutes;
