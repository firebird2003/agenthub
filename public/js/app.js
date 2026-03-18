// AgentHub 前端脚本

const API_BASE = '';

// 预设角色数据
const ROLE_PRESETS = {
    dev: {
        duties: ['代码开发', 'Bug修复', '代码审查', '技术方案设计'],
        skills: [
            { name: 'coding', desc: '编程开发' },
            { name: 'git', desc: '版本控制' },
            { name: 'code-review', desc: '代码审查' },
            { name: 'debug', desc: '调试排错' }
        ]
    },
    writer: {
        duties: ['内容创作', '文档撰写', '文案编辑', '调研分析'],
        skills: [
            { name: '写作', desc: '各类文章撰写' },
            { name: '调研', desc: '信息收集分析' },
            { name: '编辑', desc: '文字润色修改' },
            { name: '翻译', desc: '中英文翻译' }
        ]
    },
    tester: {
        duties: ['测试用例编写', 'Bug验证', '质量把控', '测试报告'],
        skills: [
            { name: '测试', desc: '功能测试用例' },
            { name: '调试', desc: '问题定位分析' },
            { name: '质量把控', desc: '代码质量评估' },
            { name: '自动化测试', desc: '自动化测试脚本' }
        ]
    },
    ops: {
        duties: ['系统监控', '部署维护', '故障处理', '性能优化'],
        skills: [
            { name: '监控', desc: '系统状态监控' },
            { name: '部署', desc: '应用部署发布' },
            { name: '运维', desc: '日常运维管理' },
            { name: '备份', desc: '数据备份恢复' }
        ]
    },
    hr: {
        duties: ['代理生命周期管理', '健康监控', '报告生成', '绩效统计'],
        skills: [
            { name: '监控', desc: '代理状态监控' },
            { name: '报告生成', desc: '各类报告编写' },
            { name: '沟通', desc: '协调联络' },
            { name: '数据分析', desc: '绩效数据分析' }
        ]
    },
    pm: {
        duties: ['项目计划', '进度追踪', '资源协调', '风险管理'],
        skills: [
            { name: '项目管理', desc: '整体项目把控' },
            { name: '任务分配', desc: '工作分配调度' },
            { name: '进度跟踪', desc: '项目进度监控' },
            { name: '沟通协调', desc: '跨团队协调' }
        ]
    },
    custom: {
        duties: [],
        skills: []
    }
};

// 当前选中的选项
let selectedDuties = [];
let selectedSkills = [];

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
    renderSkillsOptions(preset.skills);

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

// 渲染技能选项
function renderSkillsOptions(skills) {
    const container = document.getElementById('skills-options');
    selectedSkills = [];

    if (!skills || skills.length === 0) {
        container.innerHTML = '<span class="option-hint">请在下方输入自定义技能</span>';
        return;
    }

    container.innerHTML = skills.map(skill => `
        <div class="option-card ${selectedSkills.includes(skill.name) ? 'selected' : ''}"
             onclick="toggleSkill('${skill.name}', this)">
            <div class="option-card-name">${skill.name}</div>
            <div class="option-card-desc">${skill.desc}</div>
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

// 更新技能输入框
function updateSkillsInput() {
    const input = document.querySelector('input[name="skills"]');
    // 保留用户手动输入的内容
    const customSkills = input.value.split(',').map(s => s.trim()).filter(s => s && !Object.values(ROLE_PRESETS).flatMap(p => p.skills).map(s => s.name).includes(s));

    // 合并选中的预设和自定义
    const allSkills = [...selectedSkills, ...customSkills].filter((v, i, a) => a.indexOf(v) === i);
    if (allSkills.length > 0) {
        input.value = allSkills.join(', ');
    }
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
