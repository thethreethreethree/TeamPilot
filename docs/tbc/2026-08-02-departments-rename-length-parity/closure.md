# CLOSURE — departments rename length parity

## What shipped
The departments PATCH rename path now enforces the same 1–80-char name rule the POST create path applies. An
admin can no longer rename a department to a name that creating it would have rejected. Small consistency fix
to a live admin-only route.

## Un-named reliance (not self-evident)
- **The `departments.name` column has NO DB length cap** (`text NOT NULL`, 0055:29). So application-layer
  validation is the ONLY guard on name length — which is exactly why the missing check on rename mattered. If
  a future change removes the route-level check, there is no DB backstop. The durable fix would be a CHECK
  constraint on the column; not done here (a migration), but the reliance is recorded so the constraint's
  absence is a known, deliberate state rather than a surprise.
- This is admin-only and RLS-scoped to the caller's company, so the gap was a data-quality / consistency issue,
  not a security one — no cross-tenant or privilege dimension.

## Audit result (the larger genuine finding)
The input-validation sweep of the 15 no-zod body-parsing routes came back well-hardened: the core DB-write
routes validate manually and defensively (resolutions: write-once + race + strictUpdate; departments:
rate-limit + admin gate + JSON guard + now length parity). This asymmetry was the single real gap.
