/**
 * AgentHub 配置文件
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    // 默认端口
    DEFAULT_PORT: 3000,

    // 获取默认端口（支持环境变量覆盖）
    getPort() {
        return process.env.PORT || this.DEFAULT_PORT;
    },

    // 获取数据库路径
    getDbPath() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
        return path.join(homeDir, 'agenthub', 'database', 'agenthub.db');
    },

    // 获取日志目录
    getLogDir() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
        return path.join(homeDir, 'agenthub', 'logs');
    },

    // 获取人事文件目录
    getHrDir() {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
        return path.join(homeDir, 'agenthub', 'hr');
    },

    // 检查端口是否可用
    async isPortAvailable(port) {
        const net = require('net');
        return new Promise((resolve) => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => {
                server.close();
                resolve(true);
            });
            server.listen(port);
        });
    },

    // 查找可用端口
    async findAvailablePort(startPort = 3000) {
        let port = startPort;
        while (port < startPort + 100) {
            if (await this.isPortAvailable(port)) {
                return port;
            }
            port++;
        }
        throw new Error('找不到可用端口');
    },

    // 确保必要目录存在
    ensureDirs() {
        const dirs = [
            path.dirname(this.getDbPath()),
            this.getLogDir(),
            this.getHrDir()
        ];

        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
};

module.exports = CONFIG;
