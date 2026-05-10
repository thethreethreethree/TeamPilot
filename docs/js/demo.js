// ExecOS Demo Application Logic

const SCREEN_META = {
  command:    { title: 'Command Center',          subtitle: 'AI-powered executive overview of your business health' },
  operations: { title: 'Operations Intelligence', subtitle: 'Real-time task board with AI bottleneck detection' },
  team:       { title: 'Team Intelligence',       subtitle: 'Workload analysis, performance scores & burnout detection' },
  convo:      { title: 'Conversation Intelligence', subtitle: 'Paste any meeting or thread — AI generates decisions & plans' },
  decision:   { title: 'AI Decision Engine',      subtitle: 'Claude AI generates Safe, Balanced & Aggressive options' },
  settings:   { title: 'Settings',                subtitle: 'Configure your ExecOS workspace and AI integration' },
};

let currentOpsFilter = 'All';
let selectedDecisionOpt = null;

// ── Screen switching ──────────────────────────────────────────────────────────
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + id);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBtn = document.querySelector('.nav-btn[data-screen="' + id + '"]');
  if (navBtn) navBtn.classList.add('active');

  const meta = SCREEN_META[id] || { title: id, subtitle: '' };
  const titleEl = document.getElementById('topbar-title');
  const subEl   = document.getElementById('topbar-sub');
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl)   subEl.textContent   = meta.subtitle;
}

// ── Operations table ──────────────────────────────────────────────────────────
function renderOpsTable(filter) {
  const tbody = document.getElementById('ops-tbody');
  if (!tbody) return;

  const rows = (filter === 'All')
    ? TASKS
    : TASKS.filter(t => t.status === filter);

  tbody.innerHTML = rows.map(t => {
    const priorityClass = { Critical:'badge-red', High:'badge-orange', Medium:'badge-yellow', Low:'badge-gray' }[t.priority] || 'badge-gray';
    const statusClass   = { Blocked:'badge-red', 'In Progress':'badge-blue', 'To Do':'badge-gray', 'Needs Review':'badge-yellow' }[t.status] || 'badge-gray';
    const scoreColor    = t.score >= 85 ? '#f87171' : t.score >= 70 ? '#fbbf24' : '#34d399';

    return `<tr>
      <td>
        <div class="task-title">${t.title}</div>
        ${t.blocker ? `<div class="task-blocker">&#x26A0; ${t.blocker}</div>` : ''}
      </td>
      <td>
        <div class="assignee-cell">
          <div class="avatar-sm">${t.initials}</div>
          <span>${t.assignee}</span>
        </div>
      </td>
      <td><span class="badge ${priorityClass}">${t.priority}</span></td>
      <td>
        <div class="score-wrap">
          <div class="score-bar-track"><div class="score-bar-fill" style="width:${t.score}%;background:${scoreColor}"></div></div>
          <span class="score-num">${t.score}</span>
        </div>
      </td>
      <td><span class="badge ${statusClass}">${t.status}</span></td>
      <td class="muted">${t.due}</td>
    </tr>`;
  }).join('');
}

function filterOps(filter, btn) {
  currentOpsFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderOpsTable(filter);
}

// ── Team grid ─────────────────────────────────────────────────────────────────
function renderTeam() {
  const grid = document.getElementById('team-grid');
  if (!grid) return;

  grid.innerHTML = TEAM.map(m => {
    const wlClass = { Overloaded:'badge-red', High:'badge-orange', Balanced:'badge-green', Underutilized:'badge-gray' }[m.workload] || 'badge-gray';
    const wlPct   = { Overloaded:95, High:75, Balanced:55, Underutilized:20 }[m.workload] || 40;
    const wlColor = { Overloaded:'#f87171', High:'#fb923c', Balanced:'#34d399', Underutilized:'#8895c4' }[m.workload] || '#8895c4';

    return `<div class="team-card">
      <div class="team-card-header">
        <div class="avatar-lg">${m.avatar}</div>
        <div class="team-info">
          <div class="team-name">${m.name}</div>
          <div class="team-role muted">${m.role} &middot; ${m.dept}</div>
        </div>
        <span class="badge ${wlClass}">${m.workload}</span>
      </div>
      <div class="task-counters">
        <div class="counter-item"><div class="counter-val">${m.active}</div><div class="counter-lbl muted">Active</div></div>
        <div class="counter-item"><div class="counter-val">${m.done}</div><div class="counter-lbl muted">Done</div></div>
        <div class="counter-item"><div class="counter-val" style="color:${m.overdue > 0 ? '#f87171' : 'inherit'}">${m.overdue}</div><div class="counter-lbl muted">Overdue</div></div>
        <div class="counter-item"><div class="counter-val" style="color:${m.blocked > 0 ? '#f87171' : 'inherit'}">${m.blocked}</div><div class="counter-lbl muted">Blocked</div></div>
      </div>
      <div class="workload-section">
        <div class="workload-label"><span class="muted">Workload</span><span style="color:${wlColor}">${wlPct}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${wlPct}%;background:${wlColor}"></div></div>
      </div>
      <div class="score-row">
        <div class="score-item"><span class="muted">Performance</span><span class="score-val">${m.perf}</span></div>
        <div class="score-item"><span class="muted">Consistency</span><span class="score-val">${m.consist}</span></div>
      </div>
      <div class="last-active muted">Last active: ${m.activity}</div>
    </div>`;
  }).join('');
}

// ── Conversation analysis ─────────────────────────────────────────────────────
function analyzeConvo() {
  const btn    = document.getElementById('analyze-btn');
  const output = document.getElementById('convo-output');
  const spinner= document.getElementById('convo-spinner');

  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Analyzing...';
  if (spinner) spinner.style.display = 'flex';
  if (output)  output.style.display  = 'none';

  setTimeout(() => {
    if (spinner) spinner.style.display = 'none';
    if (output) {
      output.style.display = 'block';
      output.innerHTML = `
        <div class="analysis-card">
          <div class="analysis-label">Summary</div>
          <p>The executive team discussed a critical pricing strategy decision. The current freemium model shows high conversion friction. Two competing approaches were debated: a usage-based model vs. a seat-based enterprise tier. The team aligned on pursuing a phased hybrid approach.</p>
        </div>
        <div class="analysis-card decision-card">
          <div class="analysis-label">Decision</div>
          <div class="decision-text">Transition to a hybrid pricing model: maintain freemium entry tier, introduce usage-based growth tier at $0.05/action, and launch an enterprise seat-based tier at $299/seat/mo by Q3 2025.</div>
        </div>
        <div class="analysis-card">
          <div class="analysis-label">Action Plan</div>
          <div class="action-list">
            <div class="action-item">
              <div class="action-num">1</div>
              <div class="action-body">
                <div class="action-title">Draft new pricing page & messaging</div>
                <div class="action-meta"><span class="badge badge-brand">Sarah Kim</span><span class="muted">Due May 20</span><span class="badge badge-red">High</span></div>
              </div>
            </div>
            <div class="action-item">
              <div class="action-num">2</div>
              <div class="action-body">
                <div class="action-title">Build usage metering infrastructure</div>
                <div class="action-meta"><span class="badge badge-brand">Marcus Chen</span><span class="muted">Due Jun 1</span><span class="badge badge-red">Critical</span></div>
              </div>
            </div>
            <div class="action-item">
              <div class="action-num">3</div>
              <div class="action-body">
                <div class="action-title">Set up enterprise billing & contracts</div>
                <div class="action-meta"><span class="badge badge-brand">James Okafor</span><span class="muted">Due Jun 15</span><span class="badge badge-orange">Medium</span></div>
              </div>
            </div>
            <div class="action-item">
              <div class="action-num">4</div>
              <div class="action-body">
                <div class="action-title">A/B test new pricing with pilot customers</div>
                <div class="action-meta"><span class="badge badge-brand">Sarah Kim</span><span class="muted">Due Jul 1</span><span class="badge badge-yellow">Low</span></div>
              </div>
            </div>
          </div>
        </div>
        <div class="analysis-card exec-note">
          <div class="analysis-label">Executive Note</div>
          <p>This pricing shift is the highest-leverage growth lever available. Execution speed matters — every week of delay costs estimated $18K in MRR. Prioritize the metering infrastructure above all other engineering work this sprint.</p>
        </div>`;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Analyze Conversation';
    }
  }, 1800);
}

// ── Decision engine ───────────────────────────────────────────────────────────
function generateDecision() {
  const btn    = document.getElementById('generate-btn');
  const output = document.getElementById('decision-output');
  const spinner= document.getElementById('decision-spinner');

  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Generating...';
  if (spinner) spinner.style.display = 'flex';
  if (output)  output.style.display  = 'none';
  selectedDecisionOpt = null;

  setTimeout(() => {
    if (spinner) spinner.style.display = 'none';
    if (output)  output.style.display  = 'block';
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Regenerate Options';
    }
  }, 1800);
}

function selectOpt(key) {
  selectedDecisionOpt = key;
  document.querySelectorAll('.opt-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector('.opt-card[data-opt="' + key + '"]');
  if (card) card.classList.add('selected');

  document.querySelectorAll('.approve-btn').forEach(b => b.style.display = 'none');
  const approveBtn = document.getElementById('approve-' + key);
  if (approveBtn) approveBtn.style.display = 'inline-flex';

  const recCard = document.getElementById('ai-recommendation');
  if (recCard) recCard.style.display = 'block';

  const recText = document.getElementById('rec-text');
  if (recText) {
    const labels = { safe: 'Safe — Temporary Fix', balanced: 'Balanced — Phased Solution', aggressive: 'Aggressive — Full Overhaul' };
    recText.textContent = 'You selected: ' + (labels[key] || key) + '. Claude recommends the Balanced approach as it addresses the root cause while managing execution risk. The Safe option delays inevitable rework; the Aggressive option carries high disruption risk given current team load.';
  }
}

function approveDecision(key) {
  const btn = document.getElementById('approve-' + key);
  if (btn) {
    btn.textContent = 'Decision Approved ✓';
    btn.style.background = '#34d399';
    btn.style.color = '#0c0d16';
    btn.disabled = true;
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
function saveSettings() {
  const btn = document.getElementById('save-settings-btn');
  if (!btn) return;
  btn.textContent = 'Saved ✓';
  btn.style.background = '#34d399';
  btn.style.color = '#0c0d16';
  setTimeout(() => {
    btn.textContent = 'Save Settings';
    btn.style.background = '';
    btn.style.color = '';
  }, 2000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  // Wire sidebar nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });

  // Wire filter tabs
  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => filterOps(btn.dataset.filter, btn));
  });

  // Render initial data
  renderOpsTable('All');
  renderTeam();

  // Start on command screen
  switchScreen('command');
}

document.addEventListener('DOMContentLoaded', init);
