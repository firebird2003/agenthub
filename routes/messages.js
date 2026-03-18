/**
 * 消息相关 API 路由
 */

const fp = require('fastify-plugin');
const { prepare } = require('../database/init');

async function messageRoutes(fastify, options) {
    // 获取所有消息（或指定代理的消息）
    fastify.get('/api/messages', async (request, reply) => {
        const { agent_id, type, limit = 50 } = request.query;

        let query = 'SELECT * FROM messages WHERE 1=1';
        const params = [];

        if (agent_id) {
            query += ' AND (from_agent_id = ? OR to_agent_id = ?)';
            params.push(agent_id, agent_id);
        }

        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const messages = prepare(query).all(...params);
        return messages;
    });

    // 获取未读消息数
    fastify.get('/api/messages/unread/count', async (request, reply) => {
        const { agent_id } = request.query;

        let query = 'SELECT COUNT(*) as count FROM messages WHERE read_at IS NULL';
        const params = [];

        if (agent_id) {
            query += ' AND (to_agent_id = ? OR to_agent_id = "user")';
            params.push(agent_id);
        }

        const result = prepare(query).get(...params);
        return { count: result.count };
    });

    // 发送消息
    fastify.post('/api/messages', async (request, reply) => {
        const { from_agent_id, to_agent_id, type, priority, payload, requires_ack } = request.body;

        if (!type) {
            reply.code(400);
            return { error: '缺少消息类型' };
        }

        prepare(`
            INSERT INTO messages (from_agent_id, to_agent_id, type, priority, payload, requires_ack)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(from_agent_id, to_agent_id, type, priority || 'normal', JSON.stringify(payload), requires_ack ? 1 : 0);

        reply.code(201);
        return { success: true };
    });

    // 标记消息为已读
    fastify.patch('/api/messages/:id/read', async (request, reply) => {
        const { id } = request.params;

        const result = prepare(`
            UPDATE messages SET read_at = datetime('now') WHERE id = ?
        `).run(id);

        if (result.changes === 0) {
            reply.code(404);
            return { error: '消息不存在' };
        }

        return { success: true };
    });

    // 确认消息
    fastify.post('/api/messages/:id/ack', async (request, reply) => {
        const { id } = request.params;
        const { status } = request.body;

        const result = prepare(`
            UPDATE messages SET ack_status = ?, read_at = datetime('now') WHERE id = ?
        `).run(status, id);

        if (result.changes === 0) {
            reply.code(404);
            return { error: '消息不存在' };
        }

        return { success: true };
    });

    // 删除消息
    fastify.delete('/api/messages/:id', async (request, reply) => {
        const { id } = request.params;

        const result = prepare('DELETE FROM messages WHERE id = ?').run(id);

        if (result.changes === 0) {
            reply.code(404);
            return { error: '消息不存在' };
        }

        return { success: true };
    });
}

module.exports = fp(messageRoutes);
