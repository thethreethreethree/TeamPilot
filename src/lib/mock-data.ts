export const mockCompany = {
  name: "Acme Corp",
  industry: "Technology",
  size: "50-200",
  stage: "Growth",
  healthScore: 74,
  operationsScore: 68,
  teamScore: 81,
};

export const mockTasks = [
  {
    id: "t1",
    title: "Fix checkout payment gateway timeout",
    description: "Users experiencing 30s timeout on Stripe checkout flow",
    department: "Operations",
    assignee: "Marcus Chen",
    status: "Blocked",
    priority: "Critical",
    aiPriorityScore: 98,
    impactLevel: "High",
    blockerReason: "Awaiting API credentials from finance team",
    dueDate: "2025-05-12",
  },
  {
    id: "t2",
    title: "Q2 investor report draft",
    description: "Prepare slides and financial summary for board",
    department: "Operations",
    assignee: "Sarah Kim",
    status: "In Progress",
    priority: "High",
    aiPriorityScore: 87,
    impactLevel: "High",
    blockerReason: null,
    dueDate: "2025-05-14",
  },
  {
    id: "t3",
    title: "Onboard 3 new engineering hires",
    description: "Set up accounts, assign mentors, schedule first week",
    department: "Team",
    assignee: "David Park",
    status: "In Progress",
    priority: "Medium",
    aiPriorityScore: 72,
    impactLevel: "Medium",
    blockerReason: null,
    dueDate: "2025-05-15",
  },
  {
    id: "t4",
    title: "Security audit — API endpoints",
    description: "Review all public-facing endpoints for vulnerabilities",
    department: "Operations",
    assignee: "Lena Torres",
    status: "To Do",
    priority: "High",
    aiPriorityScore: 83,
    impactLevel: "High",
    blockerReason: null,
    dueDate: "2025-05-18",
  },
  {
    id: "t5",
    title: "Update team performance review process",
    description: "Revise review template and scoring criteria for Q2",
    department: "Team",
    assignee: "David Park",
    status: "Needs Review",
    priority: "Low",
    aiPriorityScore: 45,
    impactLevel: "Low",
    blockerReason: null,
    dueDate: "2025-05-20",
  },
  {
    id: "t6",
    title: "Deploy v2.4 to production",
    description: "Release new dashboard features and bug fixes",
    department: "Operations",
    assignee: "Marcus Chen",
    status: "Blocked",
    priority: "Critical",
    aiPriorityScore: 95,
    impactLevel: "High",
    blockerReason: "Blocked by payment gateway fix (t1)",
    dueDate: "2025-05-13",
  },
];

export const mockTeamMembers = [
  {
    id: "u1",
    name: "Marcus Chen",
    role: "Lead Engineer",
    department: "Engineering",
    activeTasks: 4,
    completedTasks: 12,
    overdueTasks: 2,
    blockedTasks: 2,
    workloadLevel: "Overloaded",
    consistencyScore: 78,
    performanceScore: 82,
    recentActivity: "2 hours ago",
    avatar: "MC",
  },
  {
    id: "u2",
    name: "Sarah Kim",
    role: "Operations Lead",
    department: "Operations",
    activeTasks: 3,
    completedTasks: 18,
    overdueTasks: 0,
    blockedTasks: 0,
    workloadLevel: "Balanced",
    consistencyScore: 94,
    performanceScore: 96,
    recentActivity: "30 minutes ago",
    avatar: "SK",
  },
  {
    id: "u3",
    name: "David Park",
    role: "HR Manager",
    department: "People",
    activeTasks: 2,
    completedTasks: 9,
    overdueTasks: 0,
    blockedTasks: 0,
    workloadLevel: "Balanced",
    consistencyScore: 88,
    performanceScore: 90,
    recentActivity: "1 hour ago",
    avatar: "DP",
  },
  {
    id: "u4",
    name: "Lena Torres",
    role: "Security Engineer",
    department: "Engineering",
    activeTasks: 1,
    completedTasks: 6,
    overdueTasks: 0,
    blockedTasks: 0,
    workloadLevel: "Underutilized",
    consistencyScore: 71,
    performanceScore: 74,
    recentActivity: "3 hours ago",
    avatar: "LT",
  },
  {
    id: "u5",
    name: "James Okafor",
    role: "Product Manager",
    department: "Product",
    activeTasks: 5,
    completedTasks: 22,
    overdueTasks: 1,
    blockedTasks: 0,
    workloadLevel: "High",
    consistencyScore: 91,
    performanceScore: 88,
    recentActivity: "15 minutes ago",
    avatar: "JO",
  },
];

export const mockAlerts = [
  {
    id: "a1",
    type: "critical",
    title: "2 critical tasks are blocked",
    detail: "Payment gateway + v2.4 deploy blocked for 26h. Revenue at risk.",
    department: "Operations",
  },
  {
    id: "a2",
    type: "warning",
    title: "Marcus Chen is overloaded",
    detail: "4 active tasks, 2 overdue. Burnout risk detected.",
    department: "Team",
  },
  {
    id: "a3",
    type: "warning",
    title: "Operations efficiency dropped 9%",
    detail: "Blocked approvals and workload imbalance causing slowdown.",
    department: "Operations",
  },
  {
    id: "a4",
    type: "info",
    title: "Lena Torres is underutilized",
    detail: "Only 1 active task. Consider reassigning from Marcus.",
    department: "Team",
  },
];

export const mockDailyPriorities = [
  "Unblock payment gateway — assign temporary API credentials from finance",
  "Redistribute 1–2 tasks from Marcus Chen to Lena Torres",
  "Review Q2 investor report draft with Sarah Kim",
  "Approve security audit scope before Lena begins",
];

export const mockFinance = {
  financeScore: 71,
  cashOnHand: 2_450_000,
  monthlyBurn: 312_000,
  runwayMonths: 7.9,
  mrr: 188_000,
  mrrGrowth: 6.2,
  grossMargin: 68,
};

export const mockRevenueTrend = [
  { month: "Dec", mrr: 142_000, expenses: 268_000 },
  { month: "Jan", mrr: 151_000, expenses: 274_000 },
  { month: "Feb", mrr: 159_000, expenses: 281_000 },
  { month: "Mar", mrr: 168_000, expenses: 295_000 },
  { month: "Apr", mrr: 177_000, expenses: 304_000 },
  { month: "May", mrr: 188_000, expenses: 312_000 },
];

export const mockExpenses = [
  { category: "Payroll", amount: 198_000, share: 63, trend: "up" },
  { category: "Infrastructure & SaaS", amount: 41_000, share: 13, trend: "up" },
  { category: "Marketing & Growth", amount: 38_000, share: 12, trend: "flat" },
  { category: "Office & Operations", amount: 21_000, share: 7, trend: "flat" },
  { category: "Legal & Professional", amount: 14_000, share: 5, trend: "down" },
];

export const mockInvoices = [
  { id: "i1", client: "Northwind Retail", amount: 48_000, status: "Overdue", dueDate: "2025-05-02" },
  { id: "i2", client: "Vertex Logistics", amount: 32_500, status: "Pending", dueDate: "2025-05-20" },
  { id: "i3", client: "Brightline Media", amount: 27_000, status: "Paid", dueDate: "2025-05-08" },
  { id: "i4", client: "Cascade Health", amount: 61_000, status: "Pending", dueDate: "2025-05-25" },
  { id: "i5", client: "Orbit Software", amount: 19_500, status: "Overdue", dueDate: "2025-04-28" },
];

export const mockMarketing = {
  marketingScore: 66,
  monthlyLeads: 1240,
  leadGrowth: 11.4,
  cac: 312,
  conversionRate: 3.8,
  pipelineValue: 1_870_000,
};

export const mockMarketingChannels = [
  { channel: "Organic Search", leads: 438, cac: 0, roi: "∞", trend: "up" },
  { channel: "Paid Ads", leads: 372, cac: 480, roi: "2.1x", trend: "down" },
  { channel: "Content & SEO", leads: 198, cac: 95, roi: "5.4x", trend: "up" },
  { channel: "Referral", leads: 142, cac: 60, roi: "7.2x", trend: "flat" },
  { channel: "Social", leads: 90, cac: 210, roi: "1.6x", trend: "down" },
];

export const mockCampaigns = [
  { id: "c1", name: "Q2 Product Launch", status: "In Progress", budget: 80_000, spent: 51_000, leads: 312 },
  { id: "c2", name: "Webinar Series", status: "Completed", budget: 25_000, spent: 24_200, leads: 188 },
  { id: "c3", name: "Retargeting Push", status: "In Progress", budget: 40_000, spent: 9_500, leads: 64 },
  { id: "c4", name: "Brand Awareness", status: "Needs Review", budget: 60_000, spent: 58_800, leads: 96 },
];

export const mockFunnel = [
  { stage: "Visitors", count: 48_200 },
  { stage: "Leads", count: 1_240 },
  { stage: "Qualified", count: 410 },
  { stage: "Opportunities", count: 132 },
  { stage: "Customers", count: 47 },
];

export const mockDecisionHistory = [
  {
    id: "d1",
    title: "Migrate to new payment provider",
    date: "2025-04-28",
    outcome: "Approved — implementation started",
    executionStatus: "In Progress",
  },
  {
    id: "d2",
    title: "Hire 3 additional engineers for Q2",
    date: "2025-04-15",
    outcome: "Approved — onboarding in progress",
    executionStatus: "In Progress",
  },
  {
    id: "d3",
    title: "Delay v2.4 release by 1 week",
    date: "2025-05-01",
    outcome: "Approved — awaiting gateway fix",
    executionStatus: "Blocked",
  },
];
