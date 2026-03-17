// AgentHub 前端脚本

const API_BASE = '';

// 获取端口
async function getPort() {
    try {
        const response = await fetch('/api/health');
        return '';
    } catch {
        // 尝试从文件读取端口
        return '';
    }
}

// API 请求
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return await response.json();
    } catch (error) {
        console.error('API 请求失败:', error);
        return { error: error.message };
    }
}

// 获取代理列表
async function fetchAgents() {
    return await apiRequest('/api/agents');
}

// 获取未读消息数
async function fetchUnreadCount() {
    const result = await apiRequest('/api/messages/unread/count');
    return result.count || 0;
}

// 渲染代理列表
function renderAgents(agents) {
    const container = document.getElementById('agent-list');

    if (!agents || agents.length === 0) {
        container.innerHTML = '<div class="empty">暂无代理，点击"新建代理"添加</div>';
        return;
    }

    container.innerHTML = agents.map(agent => `
        <div class="agent-card" onclick="window.location.href='/agent.html?id=${agent.id}'">
            <div class="agent-card-header">
                <div class="agent-name">${agent.name}</div>
                <div class="agent-status ${agent.online ? 'online' : ''}">
                    <span class="status-dot ${agent.online ? 'online' : ''}"></span>
                    ${agent.online ? '在线' : '离线'}
                </div>
            </div>
            <div class="agent-info">
                ID: ${agent.id} | 角色: ${agent.role || '-'}
            </div>
            ${agent.current_task ? `
                <div class="agent-task">
                    ${agent.current_task}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// 更新统计
async function updateStats() {
    const agents = await fetchAgents();
    const unreadCount = await fetchUnreadCount();

    const total = agents.length || 0;
    const online = agents.filter(a => a.online).length;
    const offline = total - online;

    document.getElementById('total-agents').textContent = total;
    document.getElementById('online-agents').textContent = online;
    document.getElementById('offline-agents').textContent = offline;
    document.getElementById('unread-messages').textContent = unreadCount;
}

// 初始化仪表盘
async function initDashboard() {
    const agents = await fetchAgents();
    renderAgents(agents);
    await updateStats();

    // 定时刷新
    setInterval(updateStats, 30000);
}

// 模态框
function showCreateModal() {
    document.getElementById('create-modal').classList.add('show');
}

function closeModal() {
    document.getElementById('create-modal').classList.remove('show');
}

// 创建代理
async function createAgent(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const data = {
        id: formData.get('id'),
        name: formData.get('name'),
        role: formData.get('role'),
        personality: formData.get('personality'),
        duties: formData.get('duties'),
        skills: formData.get('skills'),
        workspace: formData.get('workspace')
    };

    const result = await apiRequest('/api/agents', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    if (result.success) {
        closeModal();
        form.reset();
        initDashboard();
    } else {
        alert(result.error || '创建失败');
    }
}

// 删除代理
async function deleteAgent(id) {
    if (!confirm(`确定要删除代理 ${id} 吗？`)) {
        return;
    }

    const result = await apiRequest(`/api/agents/${id}`, {
        method: 'DELETE'
    });

    if (result.success) {
        window.location.href = '/';
    } else {
        alert(result.error || '删除失败');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('agent-list')) {
        initDashboard();
    }
});

// 格式化日期
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}
