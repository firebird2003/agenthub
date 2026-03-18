// AgentHub 前端脚本

const API_BASE = '';

// 预设角色数据（仅保留工作职责）
const ROLE_PRESETS = {
    dev: {
        duties: ['代码开发', 'Bug修复', '代码审查', '技术方案设计']
    },
    writer: {
        duties: ['内容创作', '文档撰写', '文案编辑', '调研分析']
    },
    tester: {
        duties: ['测试用例编写', 'Bug验证', '质量把控', '测试报告']
    },
    ops: {
        duties: ['系统监控', '部署维护', '故障处理', '性能优化']
    },
    hr: {
        duties: ['代理生命周期管理', '健康监控', '报告生成', '绩效统计']
    },
    pm: {
        duties: ['项目计划', '进度追踪', '资源协调', '风险管理']
    },
    custom: {
        duties: []
    }
};

// 当前选中的选项
let selectedDuties = [];
let selectedSkills = [];
let installedSkills = []; // 从 API 获取的已安装技能

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

// 获取已安装的技能列表
async function fetchInstalledSkills() {
    const skills = await apiRequest('/api/skills');
    return skills || [];
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
async function showCreateModal() {
    document.getElementById('create-modal').classList.add('show');
    // 获取已安装的技能
    installedSkills = await fetchInstalledSkills();
    // 初始化时使用默认角色
    onRoleChange('dev');
}

function closeModal() {
    document.getElementById('create-modal').classList.remove('show');
}

// 角色切换时更新预设选项
function onRoleChange(role) {
    const preset = ROLE_PRESETS[role] || ROLE_PRESETS.custom;
    renderDutiesOptions(preset.duties);
    // 使用已安装的技能列表
    renderSkillsOptionsFromInstalled();

    // 更新工作区路径（基于代理ID）
    const workspaceInput = document.getElementById('workspace-path');
    workspaceInput.placeholder = role === 'custom' ? '代理ID' : `${role}-001`;
}

// 渲染工作职责选项
function renderDutiesOptions(duties) {
    const container = document.getElementById('duties-options');
    selectedDuties = [];

    if (!duties || duties.length === 0) {
        container.innerHTML = '<span class="option-hint">请在下方输入自定义工作职责</span>';
        return;
    }

    container.innerHTML = duties.map(duty => `
        <label class="option-tag">
            <input type="checkbox" value="${duty}" onchange="toggleDuty('${duty}', this.checked)">
            <span>${duty}</span>
        </label>
    `).join('');
}

// 渲染已安装的技能选项
function renderSkillsOptionsFromInstalled() {
    const container = document.getElementById('skills-options');
    selectedSkills = [];

    if (!installedSkills || installedSkills.length === 0) {
        container.innerHTML = '<span class="option-hint">未找到已安装的技能</span>';
        return;
    }

    container.innerHTML = installedSkills.map(skill => `
        <div class="option-card ${selectedSkills.includes(skill.slug) ? 'selected' : ''}"
             onclick="toggleSkill('${skill.slug}', this)">
            <div class="option-card-name">${skill.name}</div>
            <div class="option-card-desc">${skill.description || skill.slug}</div>
        </div>
    `).join('');
}

// 切换工作职责选择
function toggleDuty(duty, checked) {
    if (checked) {
        selectedDuties.push(duty);
    } else {
        selectedDuties = selectedDuties.filter(d => d !== duty);
    }
    updateDutiesInput();
}

// 切换技能选择
function toggleSkill(skillName, element) {
    element.classList.toggle('selected');

    if (selectedSkills.includes(skillName)) {
        selectedSkills = selectedSkills.filter(s => s !== skillName);
    } else {
        selectedSkills.push(skillName);
    }
    updateSkillsInput();
}

// 更新工作职责输入框
function updateDutiesInput() {
    const input = document.querySelector('input[name="duties"]');
    // 保留用户手动输入的内容
    const customDuties = input.value.split(',').map(s => s.trim()).filter(s => s && !Object.values(ROLE_PRESETS).flatMap(p => p.duties).includes(s));

    // 合并选中的预设和自定义
    const allDuties = [...selectedDuties, ...customDuties].filter((v, i, a) => a.indexOf(v) === i);
    if (allDuties.length > 0) {
        input.value = allDuties.join(', ');
    }
}

// 更新技能输入框（用于表单提交）
function updateSkillsInput() {
    const input = document.querySelector('input[name="skills"]');
    // 合并选中的已安装技能
    if (selectedSkills.length > 0) {
        input.value = selectedSkills.join(', ');
    }
}

// 创建代理
async function createAgent(event) {
    event.preventDefault();

    // 先更新技能输入框
    updateSkillsInput();

    const form = event.target;
    const formData = new FormData(form);

    const data = {
        id: formData.get('id'),
        name: formData.get('name'),
        role: formData.get('role'),
        personality: formData.get('personality'),
        duties: formData.get('duties'),
        skills: formData.get('skills'),
        wanted_skills: formData.get('wanted_skills'),
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
