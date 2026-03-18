#!/usr/bin/env node
/**
 * 数据库初始化脚本 - 使用同步方式
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(process.env.HOME || process.env.USERPROFILE, 'agenthub', 'database');
const DB_PATH = path.join(DB_DIR, 'agenthub.db');

let db = null;
let SQL = null;

// 同步方式初始化
function initDatabaseSync() {
    // 同步创建目录
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }

    return new Promise(async (resolve, reject) => {
        try {
            SQL = await initSqlJs();

            // 尝试加载现有数据库
            if (fs.existsSync(DB_PATH)) {
                const fileBuffer = fs.readFileSync(DB_PATH);
                db = new SQL.Database(fileBuffer);
            } else {
                db = new SQL.Database();
            }

            // 创建表
            db.run(`
                CREATE TABLE IF NOT EXISTS agents (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    personality TEXT,
                    role TEXT,
                    duties TEXT,
                    skills TEXT,
                    channel TEXT,
                    workspace TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS agent_status (
                    agent_id TEXT PRIMARY KEY,
                    online INTEGER DEFAULT 0,
                    last_active TEXT,
                    current_task TEXT,
                    health_score INTEGER,
                    tokens_used INTEGER DEFAULT 0,
                    tasks_completed INTEGER DEFAULT 0,
                    FOREIGN KEY (agent_id) REFERENCES agents(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS agent_status_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    status_type TEXT NOT NULL,
                    old_value TEXT,
                    new_value TEXT,
                    changed_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY (agent_id) REFERENCES agents(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    from_agent_id TEXT,
                    to_agent_id TEXT,
                    type TEXT NOT NULL,
                    priority TEXT DEFAULT 'normal',
                    payload TEXT,
                    requires_ack INTEGER DEFAULT 0,
                    ack_status TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    read_at TEXT
                )
            `);

            // 保存数据库
            saveDatabase();

            console.log('数据库初始化完成！');
            console.log('数据库路径:', DB_PATH);

            resolve(db);
        } catch (error) {
            reject(error);
        }
    });
}

function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    }
}

function getDb() {
    return db;
}

function closeDatabase() {
    if (db) {
        saveDatabase();
        db.close();
    }
}

// 封装查询方法
function prepare(sql) {
    return {
        run: (...params) => {
            db.run(sql, params);
            saveDatabase();
            return { changes: db.getRowsModified() };
        },
        get: (...params) => {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            if (stmt.step()) {
                const result = stmt.getAsObject();
                stmt.free();
                return result;
            }
            stmt.free();
            return null;
        },
        all: (...params) => {
            const results = [];
            const stmt = db.prepare(sql);
            stmt.bind(params);
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        }
    };
}

module.exports = { initDatabase: initDatabaseSync, closeDatabase, getDb, saveDatabase, prepare, DB_PATH };
