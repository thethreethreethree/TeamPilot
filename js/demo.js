// ExecOS Demo Logic

const SCREEN_META = {
  command:      { title: 'Command Center',            sub: 'Acme Corp Â· CEO View' },
  operations:   { title: 'Operations',                sub: 'Acme Corp Â· Execution Intelligence' },
  team:         { title: 'Team Intelligence',          sub: 'Acme Corp Â· Workforce Analysis' },
  conversation: { title: 'Conversation Intelligence', sub: 'Acme Corp Â· Meeting & Thread Analysis' },
  decisions:    { title: 'AI Decision Engine',        sub: 'Acme Corp Â· Structured Decision Making' },
  settings:     { title: 'Settings',                  sub: 'System Configuration' },
};

// â”€â”€ Screen switching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function switchScreen(id, btn) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sb-btn').forEach(b => b.classList.remove('active'));

  const screen = document.getElementById('screen-' + id);
  if (screen) screen.classList.add('active');
  if (btn) btn.classList.add('active');

  const meta = SCREEN_META[id];
  if (meta) {
    document.getElementById('tb-title').textContent = meta.title;
    document.getElementById('tb-sub').textContent = meta.sub;
  }
}

// â”€â”€ SVG helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function warnIcon(color) {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}
function infoIcon(color) {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
}

// â”€â”€ Render helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function pill(text, cls) {
  return `<span class="pill ${cls}">${text}</span>`;
}

// â”€â”€ Command Center â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderCriticalTasks() {
  const el = document.getElementById('critical-tasks');
  if (!el) return;
  const critical = TASKS.filter(t => t.status === 'Blocked' || t.priority === 'Critical').slice(0, 3);
  el.innerHTML = critical.map(t => `
    <div style="display:flex;align-items:start;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:8px;background:var(--bg);border:1px solid var(--b1);margin-bottom:7px">
      <div>
        <div class="task-title">${t.title}</div>
        ${t.blocker ? `<div class="task-blocker">&#x26A0; ${t.blocker}</div>` : `<div style="font-size:10px;color:var(--t3)">${t.assignee} &middot; Due ${t.due}</div>`}
      </div>
      ${pill(t.status, STATUS_PILL[t.status] || 'pill-gray')}
    </div>
  `).join('');
}

function renderAlerts() {
  const el = document.getElementById('alerts-list');
  if (!el) return;
  const iconMap = { red: ['#f06e6e', 'warn'], yellow: ['#f5c842', 'warn'], blue: ['#60a5fa', 'info'] };
  el.innerHTML = ALERTS.map(a => {
    const [color, type] = iconMap[a.type] || ['#8b97c8', 'info'];
    const icon = type === 'warn' ? warnIcon(color) : infoIcon(color);
    return `<div class="alert-row alert-${a.type}" style="margin-bottom:7px">
      ${icon}
      <div><div class="al-title">${a.title}</div><div class="al-desc">${a.desc}</div></div>
    </div>`;
  }).join('');
}

function renderDecisionMemory() {
  const el = document.getElementById('decision-memory');
  if (!el) return;
  el.innerHTML = DECISIONS.map(d => `
    <div class="dm-item">
      <div><div class="dm-title">${d.title}</div><div class="dm-date">${d.date}</div></div>
      ${pill(d.status, d.pill)}
    </div>
  `).join('');
}

// â”€â”€ Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let currentFilter = 'All';

function renderOpsTable(filter) {
  const el = document.getElementById('ops-table');
  if (!el) return;
  const rows = filter === 'All' ? TASKS : TASKS.filter(t => t.status === filter);
  el.innerHTML = rows.map(t => {
    const scoreColor = t.score >= 90 ? '#f06e6e' : t.score >= 70 ? '#f5c842' : '#00d4ff';
    return `<tr>
      <td>
        <div class="task-title">${t.title}</div>
        ${t.blocker ? `<div class="task-blocker">&#x26A0; ${t.blocker}</div>` : ''}
      </td>
      <td>
        <div class="assignee-cell">
          <div class="assignee-av">${t.initials}</div>
          <span style="font-size:12px;color:var(--t2)">${t.assignee.split(' ')[0]}</span>
        </div>
      </td>
      <td>
        <div class="pri-cell">
          <span class="pri-dot" style="background:${PRI_COLOR[t.priority]}"></span>
          <span style="color:var(--t2)">${t.priority}</span>
        </div>
      </td>
      <td>
        <div class="score-cell">
          <div class="score-bar"><div class="score-fill" style="width:${t.score}%;background:${scoreColor}"></div></div>
          <span style="font-size:10px;color:var(--t3);font-family:'JetBrains Mono',monospace">${t.score}</span>
        </div>
      </td>
      <td>${pill(t.status, STATUS_PILL[t.status] || 'pill-gray')}</td>
      <td><span style="font-size:11px;color:var(--t3);font-family:'JetBrains Mono',monospace">${t.due}</span></td>
    </tr>`;
  }).join('');
}

function filterOps(filter, btn) {
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = filter;
  renderOpsTable(filter);
}

// â”€â”€ Team Intelligence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderTeam() {
  const el = document.getElementById('team-grid');
  if (!el) return;
  el.innerHTML = TEAM.map(m => `
    <div class="team-card">
      <div class="tc-header">
        <div class="tc-left">
          <div class="tc-avatar">${m.avatar}</div>
          <div>
            <div class="tc-name">${m.name}</div>
            <div class="tc-role">${m.role}</div>
          </div>
        </div>
        ${pill(m.workload, WL_PILL[m.workload] || 'pill-gray')}
      </div>
      <div class="tc-stats">
        <div><div class="tc-stat-val" style="color:#60a5fa">${m.active}</div><div class="tc-stat-lbl">Active</div></div>
        <div><div class="tc-stat-val" style="color:#10e0a0">${m.done}</div><div class="tc-stat-lbl">Done</div></div>
        <div><div class="tc-stat-val" style="color:#f06e6e">${m.overdue}</div><div class="tc-stat-lbl">Overdue</div></div>
        <div><div class="tc-stat-val" style="color:#f5833c">${m.blocked}</div><div class="tc-stat-lbl">Blocked</div></div>
      </div>
      <div class="tc-wl-row">
        <span class="tc-wl-lbl">Workload</span>
        <span style="font-size:10px;font-weight:600;color:${WL_COLOR[m.workload]}">${m.workload}</span>
      </div>
      <div class="tc-wl-bar"><div class="tc-wl-fill" style="width:${m.wl_pct}%;background:${WL_COLOR[m.workload]}"></div></div>
      <div class="tc-footer">
        <div class="tc-scores">
          <div class="tc-score-item"><div class="tc-score-val">${m.perf}</div><div class="tc-score-lbl">Perf.</div></div>
          <div class="tc-score-item"><div class="tc-score-val">${m.consist}</div><div class="tc-score-lbl">Consist.</div></div>
        </div>
        <div class="tc-activity">${m.activity}</div>
      </div>
    </div>
  `).join('');
}

// â”€â”€ Conversation Intelligence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function analyzeConvo() {
  const btn = document.getElementById('convo-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg style="animation:spin .8s linear infinite" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Analyzing conversation...`;

  setTimeout(() => {
    document.getElementById('convo-output').innerHTML = `
      <div class="card" style="animation:fadeIn .3s ease">
        <div class="clabel">Summary</div>
        <p class="ctext">The team aligned on a phased pricing model transition &mdash; tiered + usage-based for net-new customers in Q2, with existing client migration deferred to Q3 to protect renewal contracts and reduce commercial risk.</p>
      </div>
      <div class="card card-cyan" style="animation:fadeIn .3s .1s ease both">
        <div class="ai-head"><span class="ai-dot"></span><span class="ai-lbl">Decision</span></div>
        <p style="font-size:13px;font-weight:600;color:var(--t1);line-height:1.5">Adopt tiered pricing + usage for all net-new customers starting Q2. Existing clients remain on current pricing with a grandfathering policy through Q3.</p>
      </div>
      <div class="card" style="animation:fadeIn .3s .2s ease both">
        <div class="row-between" style="margin-bottom:10px">
          <span class="ai-lbl" style="color:var(--t1)">Action Plan &mdash; Auto-Generated</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px">
          <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;padding:9px 11px;border-radius:8px;background:var(--bg);border:1px solid var(--b1)">
            <div style="display:flex;align-items:start;gap:7px"><span class="pnum">1</span><div><div class="task-title">Define final pricing tiers &amp; amounts</div><div style="font-size:10px;color:var(--t3)">Sarah Kim &middot; Friday</div></div></div>
            ${pill('High', 'pill-orange')}
          </div>
          <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;padding:9px 11px;border-radius:8px;background:var(--bg);border:1px solid var(--b1)">
            <div style="display:flex;align-items:start;gap:7px"><span class="pnum">2</span><div><div class="task-title">Begin backend metering infrastructure</div><div style="font-size:10px;color:var(--t3)">Marcus Chen &middot; This week</div></div></div>
            ${pill('High', 'pill-orange')}
          </div>
          <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;padding:9px 11px;border-radius:8px;background:var(--bg);border:1px solid var(--b1)">
            <div style="display:flex;align-items:start;gap:7px"><span class="pnum">3</span><div><div class="task-title">Draft customer communication plan</div><div style="font-size:10px;color:var(--t3)">James Okafor &middot; Next week</div></div></div>
            ${pill('Medium', 'pill-yellow')}
          </div>
          <div style="display:flex;align-items:start;justify-content:space-between;gap:8px;padding:9px 11px;border-radius:8px;background:var(--bg);border:1px solid var(--b1)">
            <div style="display:flex;align-items:start;gap:7px"><span class="pnum">4</span><div><div class="task-title">Create enterprise grandfathering policy</div><div style="font-size:10px;color:var(--t3)">Sarah Kim &middot; Before May renewals</div></div></div>
            ${pill('High', 'pill-orange')}
          </div>
        </div>
      </div>
      <div class="card" style="border-color:rgba(16,224,160,.2);background:rgba(16,224,160,.04);animation:fadeIn .3s .3s ease both">
        <div class="clabel" style="color:#10e0a0">Executive Note</div>
        <p class="ctext">Solid, well-structured decision. Phasing net-new vs. existing reduces commercial risk while capturing Q2 revenue upside. Ensure legal reviews grandfathering terms before any client communication goes out.</p>
      </div>`;

    btn.innerHTML = '&#x2713; Analysis Complete';
    btn.style.background = 'rgba(16,224,160,.15)';
    btn.style.color = '#10e0a0';
    btn.style.boxShadow = 'none';
  }, 1900);
}

// â”€â”€ Decision Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let selectedOpt = null;

function generateDecision() {
  const btn = document.getElementById('decision-btn');
  btn.disabled = true;
  btn.innerHTML = `<svg style="animation:spin .8s linear infinite" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Generating options...`;

  setTimeout(() => {
    const output = document.getElementById('decision-output');
    output.classList.remove('hidden');
    output.style.animation = 'fadeIn .4s ease';

    // also render decision memory
    const dm = document.getElementById('d-memory');
    if (dm) {
      dm.innerHTML = DECISIONS.map(d => `
        <div class="dm-item">
          <div><div class="dm-title">${d.title}</div><div class="dm-date">${d.date}</div></div>
          ${pill(d.status, d.pill)}
        </div>
      `).join('');
    }

    btn.innerHTML = '&#x2713; Options Generated';
    btn.style.background = 'rgba(16,224,160,.15)';
    btn.style.color = '#10e0a0';
    btn.style.boxShadow = 'none';
  }, 1900);
}

function selectOpt(key) {
  ['safe','balanced','aggressive'].forEach(k => {
    document.getElementById('opt-' + k).classList.remove('selected');
  });

  if (selectedOpt === key) {
    selectedOpt = null;
    const ar = document.getElementById('approve-row');
    if (ar) ar.style.display = 'none';
  } else {
    selectedOpt = key;
    document.getElementById('opt-' + key).classList.add('selected');
    const ar = document.getElementById('approve-row');
    if (ar) { ar.classList.remove('hidden'); ar.style.display = 'flex'; }
  }
}

// â”€â”€ Spin keyframe injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
(function() {
  const style = document.createElement('style');
  style.textContent = '@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(style);
})();

// â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', () => {
  renderCriticalTasks();
  renderAlerts();
  renderDecisionMemory();
  renderOpsTable('All');
  renderTeam();
});
