// ExecOS Demo Data

const TASKS = [
  { id:'t1', title:'Fix checkout payment gateway timeout', dept:'Operations', assignee:'Marcus Chen', initials:'MC', status:'Blocked', priority:'Critical', score:98, blocker:'Awaiting API credentials from finance team', due:'2025-05-12' },
  { id:'t2', title:'Q2 investor report draft', dept:'Operations', assignee:'Sarah Kim', initials:'SK', status:'In Progress', priority:'High', score:87, blocker:null, due:'2025-05-14' },
  { id:'t3', title:'Onboard 3 new engineering hires', dept:'Team', assignee:'David Park', initials:'DP', status:'In Progress', priority:'Medium', score:72, blocker:null, due:'2025-05-15' },
  { id:'t4', title:'Security audit — API endpoints', dept:'Operations', assignee:'Lena Torres', initials:'LT', status:'To Do', priority:'High', score:83, blocker:null, due:'2025-05-18' },
  { id:'t5', title:'Update team performance review process', dept:'Team', assignee:'David Park', initials:'DP', status:'Needs Review', priority:'Low', score:45, blocker:null, due:'2025-05-20' },
  { id:'t6', title:'Deploy v2.4 to production', dept:'Operations', assignee:'Marcus Chen', initials:'MC', status:'Blocked', priority:'Critical', score:95, blocker:'Blocked by payment gateway fix', due:'2025-05-13' },
];

const TEAM = [
  { name:'Marcus Chen', role:'Lead Engineer', dept:'Engineering', avatar:'MC', active:4, done:12, overdue:2, blocked:2, workload:'Overloaded', wl_pct:95, perf:82, consist:78, activity:'2 hours ago' },
  { name:'Sarah Kim', role:'Operations Lead', dept:'Operations', avatar:'SK', active:3, done:18, overdue:0, blocked:0, workload:'Balanced', wl_pct:55, perf:96, consist:94, activity:'30 min ago' },
  { name:'David Park', role:'HR Manager', dept:'People', avatar:'DP', active:2, done:9, overdue:0, blocked:0, workload:'Balanced', wl_pct:50, perf:90, consist:88, activity:'1 hour ago' },
  { name:'Lena Torres', role:'Security Engineer', dept:'Engineering', avatar:'LT', active:1, done:6, overdue:0, blocked:0, workload:'Underutilized', wl_pct:22, perf:74, consist:71, activity:'3 hours ago' },
  { name:'James Okafor', role:'Product Manager', dept:'Product', avatar:'JO', active:5, done:22, overdue:1, blocked:0, workload:'High', wl_pct:78, perf:88, consist:91, activity:'15 min ago' },
];

const ALERTS = [
  { type:'red',    title:'2 critical tasks blocked',       desc:'Payment gateway + v2.4 deploy stalled 26h. Revenue at risk.' },
  { type:'yellow', title:'Marcus Chen is overloaded',      desc:'4 active tasks, 2 overdue. Burnout risk detected.' },
  { type:'yellow', title:'Operations efficiency down 9%',  desc:'Blocked approvals and workload imbalance causing slowdown.' },
  { type:'blue',   title:'Lena Torres underutilized',      desc:'Only 1 active task. Ready to absorb tasks from Marcus.' },
];

const DECISIONS = [
  { title:'Migrate to new payment provider',       date:'2025-04-28', status:'In Progress', pill:'pill-blue' },
  { title:'Hire 3 additional engineers for Q2',   date:'2025-04-15', status:'In Progress', pill:'pill-blue' },
  { title:'Delay v2.4 release by 1 week',          date:'2025-05-01', status:'Blocked',     pill:'pill-red'  },
];

const STATUS_PILL = {
  'Blocked':      'pill-red',
  'In Progress':  'pill-blue',
  'To Do':        'pill-gray',
  'Needs Review': 'pill-yellow',
  'Completed':    'pill-green',
};
const PRI_COLOR = { Critical:'#f06e6e', High:'#f5833c', Medium:'#f5c842', Low:'#2e3860' };
const WL_COLOR  = { Overloaded:'#f06e6e', High:'#f5833c', Balanced:'#10e0a0', Underutilized:'#f5c842' };
const WL_PILL   = { Overloaded:'pill-red', High:'pill-orange', Balanced:'pill-green', Underutilized:'pill-yellow' };
