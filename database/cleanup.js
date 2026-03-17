#!/usr/bin/env node
/**
 * 日志清理脚本
 * 保留最近90天的状态历史记录
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.env.HOME || process.env.USERPROFILE, 'agenthub', 'database', 'agenthub.db');

const db = new Database(DB_PATH);

function cleanup() {
    console.log('开始清理旧数据...');

    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffStr = cutoffDate.toISOString();

    // 清理90天前的状态历史
    const historyResult = db.prepare(`
        DELETE FROM agent_status_history
        WHERE changed_at < ?
    `).run(cutoffStr);

    console.log(`删除 ${historyResult.changes} 条状态历史记录`);

    // 清理已读的旧消息（90天前）
    const messagesResult = db.prepare(`
        DELETE FROM messages
        WHERE read_at IS NOT NULL AND read_at < ?
    `).run(cutoffStr);

    console.log(`删除 ${messagesResult.changes} 条已读消息`);

    console.log('清理完成！');
}

cleanup();
db.close();
