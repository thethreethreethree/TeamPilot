# ExecOS / TeamPilot - local setup check
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/check-setup.ps1
#         (or just: npm run setup:check)

$ErrorActionPreference = 'Stop'

function Write-Ok($msg)   { Write-Host ("  [OK]   " + $msg) -ForegroundColor Green }
function Write-Warn($msg) { Write-Host ("  [WARN] " + $msg) -ForegroundColor Yellow }
function Write-Bad($msg)  { Write-Host ("  [MISS] " + $msg) -ForegroundColor Red }
function Section($name)   { Write-Host ""; Write-Host $name -ForegroundColor Cyan }

$problems = 0

Section 'Toolchain'

try {
  $node = & node --version
  $major = [int]($node.TrimStart('v').Split('.')[0])
  if ($major -ge 18) { Write-Ok "Node $node" }
  else { Write-Warn "Node $node (recommend 18 or newer)"; $problems++ }
} catch { Write-Bad 'Node is not installed (https://nodejs.org)'; $problems++ }

try { $npm = & npm --version; Write-Ok "npm $npm" }
catch { Write-Bad 'npm is not on PATH'; $problems++ }

try { $git = (& git --version) -replace 'git version ',''; Write-Ok "git $git" }
catch { Write-Warn 'git is not installed (recommended)' }

Section 'Project'

if (Test-Path './package.json') { Write-Ok 'package.json found' }
else { Write-Bad 'Run this from the TeamPilot repo root'; $problems++ }

if (Test-Path './node_modules') { Write-Ok 'node_modules installed' }
else { Write-Warn 'node_modules missing (run: npm install)'; $problems++ }

Section 'Environment'

if (Test-Path './.env.local') {
  Write-Ok '.env.local present'
  $envFile = Get-Content ./.env.local -Raw

  if ($envFile -match 'DEEPSEEK_API_KEY=sk-') { Write-Ok 'DEEPSEEK_API_KEY looks set (primary LLM provider)' }
  elseif ($envFile -match 'ANTHROPIC_API_KEY=sk-') { Write-Ok 'ANTHROPIC_API_KEY looks set (LLM provider fallback)' }
  else { Write-Warn 'No LLM provider configured (DEEPSEEK_API_KEY preferred; ANTHROPIC_API_KEY as alternate). AI features will fail; demo UI still works.' }

  if ($envFile -match 'NEXT_PUBLIC_SUPABASE_URL=https://') { Write-Ok 'NEXT_PUBLIC_SUPABASE_URL set' }
  else { Write-Warn 'NEXT_PUBLIC_SUPABASE_URL missing (app runs in demo mode, no auth/no DB)' }

  if ($envFile -match 'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ') { Write-Ok 'NEXT_PUBLIC_SUPABASE_ANON_KEY set' }
  else { Write-Warn 'NEXT_PUBLIC_SUPABASE_ANON_KEY missing (app runs in demo mode)' }
} else {
  Write-Warn '.env.local not found (copy .env.example to .env.local)'
}

Section 'Ports'

function Test-Port($port) {
  $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
  return [bool]$listener
}

if (Test-Port 3000) { Write-Warn 'Port 3000 is in use (we use 4321 instead)' }
else { Write-Ok 'Port 3000 free' }

if (Test-Port 4321) { Write-Warn 'Port 4321 already in use (dev server may already be running)' }
else { Write-Ok 'Port 4321 free (TeamPilot dev port)' }

Write-Host ''
if ($problems -gt 0) {
  Write-Host "$problems blocker(s) found - see [MISS]/[WARN] above." -ForegroundColor Yellow
  exit 1
} else {
  Write-Host 'All good. Run:  npm run dev' -ForegroundColor Green
}
