/**
 * 状态相关 API 路由
 */

const fp = require('fastify-plugin');
const { prepare } = require('../database/init');

async function statusRoutes(fastify, options) {
    // 更新代理状态
    fastify.patch('/api/agents/:id/status', async (request, reply) => {
        const { id } = request.params;
        const { online, current_task, health_score, tokens_used, tasks_completed } = request.body;

        // 检查代理是否存在
        const agent = prepare('SELECT id FROM agents WHERE id = ?').get(id);
        if (!agent) {
            reply.code(404);
            return { error: '代理不存在' };
        }

        // 记录状态变更历史
        const oldStatus = prepare('SELECT * FROM agent_status WHERE agent_id = ?').get(id);

        // 更新状态
        const updates = [];
        const values = [];

        if (online !== undefined) {
            updates.push('online = ?');
            values.push(online ? 1 : 0);
        }
        updates.push("last_active = datetime('now')");

        if (current_task !== undefined) {
            updates.push('current_task = ?');
            values.push(current_task);
        }
        if (health_score !== undefined) {
            updates.push('health_score = ?');
            values.push(health_score);
        }
        if (tokens_used !== undefined) {
            updates.push('tokens_used = ?');
            values.push(tokens_used);
        }
        if (tasks_completed !== undefined) {
            updates.push('tasks_completed = ?');
            values.push(tasks_completed);
        }

        values.push(id);

        prepare(`UPDATE agent_status SET ${updates.join(', ')} WHERE agent_id = ?`).run(...values);

        // 记录状态变化
        if (oldStatus) {
            const changes = [];
            if (online !== undefined && online !== (oldStatus.online === 1)) {
                changes.push({ field: 'online', old: oldStatus.online, new: online ? 1 : 0 });
            }
            if (current_task !== undefined && current_task !== oldStatus.current_task) {
                changes.push({ field: 'current_task', old: oldStatus.current_task, new: current_task });
            }
            if (health_score !== undefined && health_score !== oldStatus.health_score) {
                changes.push({ field: 'health_score', old: oldStatus.health_score, new: health_score });
            }

            for (const change of changes) {
                prepare(`
                    INSERT INTO agent_status_history (agent_id, status_type, old_value, new_value)
                    VALUES (?, ?, ?, ?)
                `).run(id, change.field, JSON.stringify(change.old), JSON.stringify(change.new));
            }
        }

        // 如果状态离线，同时发送消息通知
        if (online !== undefined && online === 0) {
            prepare(`
                INSERT INTO messages (from_agent_id, to_agent_id, type, priority, payload)
                VALUES (?, ?, ?, ?, ?)
            `).run(id, 'user', 'status_change', 'high', JSON.stringify({
                event: 'agent_offline',
                agent_id: id,
                timestamp: new Date().toISOString()
            }));
        }

        return { success: true };
    });

    // 心跳接口
    fastify.post('/api/agents/:id/heartbeat', async (request, reply) => {
        const { id } = request.params;
        const { status, current_task, health } = request.body;

        // 检查代理是否存在
        const agent = prepare('SELECT id FROM agents WHERE id = ?').get(id);
        if (!agent) {
            reply.code(404);
            return { error: '代理不存在' };
        }

        // 更新心跳
        prepare(`
            UPDATE agent_status
            SET online = 1,
                last_active = datetime('now'),
                current_task = ?,
                health_score = ?
            WHERE agent_id = ?
        `).run(current_task, health?.score || null, id);

        return { success: true };
    });
}

module.exports = fp(statusRoutes);
