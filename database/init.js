#!/usr/bin/env node
/**
 * 数据库初始化脚本
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(process.env.HOME || process.env.USERPROFILE, 'agenthub', 'database');
const DB_PATH = path.join(DB_DIR, 'agenthub.db');

// 确保目录存在
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// 启用 WAL 模式
db.pragma('journal_mode = WAL');

function initDatabase() {
    console.log('初始化数据库...');

    // agents 表
    db.exec(`
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            personality TEXT,
            role TEXT,
            duties TEXT,
            skills TEXT,
            channel TEXT,
            workspace TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // agent_status 表
    db.exec(`
        CREATE TABLE IF NOT EXISTS agent_status (
            agent_id TEXT PRIMARY KEY,
            online INTEGER DEFAULT 0,
            last_active DATETIME,
            current_task TEXT,
            health_score INTEGER,
            tokens_used INTEGER DEFAULT 0,
            tasks_completed INTEGER DEFAULT 0,
            FOREIGN KEY (agent_id) REFERENCES agents(id)
        )
    `);

    // agent_status_history 表
    db.exec(`
        CREATE TABLE IF NOT EXISTS agent_status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT NOT NULL,
            status_type TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents(id)
        )
    `);

    // messages 表
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_agent_id TEXT,
            to_agent_id TEXT,
            type TEXT NOT NULL,
            priority TEXT DEFAULT 'normal',
            payload TEXT,
            requires_ack INTEGER DEFAULT 0,
            ack_status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME
        )
    `);

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_agent_id);
        CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent_id);
        CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
        CREATE INDEX IF NOT EXISTS idx_status_history_agent ON agent_status_history(agent_id);
    `);

    console.log('数据库初始化完成！');
    console.log('数据库路径:', DB_PATH);
}

function closeDatabase() {
    db.close();
}

module.exports = { initDatabase, closeDatabase, getDb: () => db, DB_PATH };
