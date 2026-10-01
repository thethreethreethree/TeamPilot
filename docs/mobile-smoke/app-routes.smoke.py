"""
Unauthenticated production smoke of every route the app calls (mobile plan, Phase 0 step 4).

Reads the route list from APP_ROUTES (a file of /api/... paths, one per line; build it with
  grep -rhoE '/api/[A-Za-z0-9_/.{}$-]+' <app>/src --include=*.ts --include=*.tsx | sort -u > routes.txt
) and calls each method the website's route file exports, with NO login and NO body. Expected: 401/403/405.
A 404 is a missing dependency; a 500 is a broken one; a 200 is a route answering a stranger. Writes nothing.
"""
import os, re, glob, subprocess, json

os.chdir(r"C:\Users\johns\Documents\GitHub\TeamPilot")
routes = [l.strip() for l in open(os.environ.get("APP_ROUTES", os.environ.get("TEMP", "") + "/approutes.txt"), encoding="utf-8") if l.strip()]
UUID = "00000000-0000-0000-0000-000000000000"
norm = set()
for r in routes:
    r = re.sub(r"/(X|\{id\}|\$\{encodeURIComponent)(?=/|$)", "/" + UUID, r)
    if r in ("/api/coach/extension", "/api/coach/kpi"):  # template prefixes, not routes
        continue
    norm.add(r)


def route_file(path):
    # map /api/a/<uuid>/b -> src/app/api/a/[x]/b/route.ts
    parts = path.strip("/").split("/")
    pattern = "src/app/" + "/".join("*" if p == UUID else p for p in parts) + "/route.ts"
    hits = [h for h in glob.glob(pattern) if all(
        (seg.startswith("[") if want == UUID else seg == want)
        for seg, want in zip(h.replace("\\", "/").split("/")[2:-1], parts))]
    return hits[0] if hits else None


results = []
for path in sorted(norm):
    f = route_file(path)
    if not f:
        results.append((path, "-", "NO ROUTE FILE"))
        continue
    src = open(f, encoding="utf-8").read()
    methods = re.findall(r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b", src)
    methods += re.findall(r"export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=", src)
    for m in sorted(set(methods)):
        code = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", m, "--max-time", "20",
             "-H", "content-type: application/json", "https://elostate.com" + path],
            capture_output=True, text=True).stdout
        results.append((path, m, code))

bad = [r for r in results if r[2] not in ("401", "403", "405")]
for r in results:
    flag = "" if r[2] in ("401", "403", "405") else "   <-- look"
    print(f"{r[2]:>4} {r[1]:6} {r[0]}{flag}")
print(f"\n{len(results)} calls, {len(bad)} not 401/403/405")
