"""
Unauthenticated GET smoke of EVERY API route on the website (widens app-routes.smoke.py; 2026-10-01).

For each src/app/api/**/route.ts that exports GET, call it once on production with no login, no cookie and no
body. GET only, so nothing is written. Dynamic segments get a nil UUID. A 200 is listed for review: it is
either a route meant to be public (health, a public page's data) or a route answering a stranger.

  python docs/mobile-smoke/all-get-routes.smoke.py
"""
import glob, os, re, subprocess
from concurrent.futures import ThreadPoolExecutor

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
UUID = "00000000-0000-0000-0000-000000000000"
BASE = os.environ.get("SMOKE_BASE", "https://elostate.com")

targets = []
for f in sorted(glob.glob("src/app/api/**/route.ts", recursive=True)):
    src = open(f, encoding="utf-8").read()
    if not re.search(r"export\s+(async\s+)?function\s+GET\b|export\s+const\s+GET\s*=", src):
        continue
    parts = f.replace("\\", "/").split("/")[2:-1]  # api/...
    path = "/" + "/".join(("x" if p.startswith("[...") or p.startswith("[[...") else UUID if p.startswith("[") else p) for p in parts)
    targets.append(path)


def call(path):
    r = subprocess.run(["curl", "-s", "-o", "-", "-w", "\n%{http_code}", "--max-time", "25", BASE + path],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    body, _, code = r.stdout.rpartition("\n")
    return path, code, body[:160].replace("\n", " ")


with ThreadPoolExecutor(max_workers=6) as ex:
    results = list(ex.map(call, targets))

counts = {}
for _, code, _ in results:
    counts[code] = counts.get(code, 0) + 1
print("GET routes:", len(results), " by status:", dict(sorted(counts.items())))
for path, code, body in results:
    if code not in ("401", "403", "405"):
        print(f"{code}  {path}  {body}")
