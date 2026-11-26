# BUILD - Revenue Phase 2: the deal board

Migration 0371 (deal_stage_lists, deal_board_views, their current views, rss_valid_stage_list). No env keys.

### A manager sets the company's stages
write-path: Pipeline → Board → Stages → POST /api/coach/remote/deal-stages → deal_stage_lists row (policy: is_sales_coach_manager; CHECK: rss_valid_stage_list).
read-path: GET /deal-stages → the board's stage groups and the deal panel's stage picker.

### A rep moves a deal to a stage
write-path: deal panel stage picker → POST /prospects/:id {set stage {status: the stage's kind, label}} → a stage event.
read-path: remote_prospects_current.stage_label/status → the board's group.

### Filtering and saving a view
write-path: Board → Save view → POST /deal-views → deal_board_views row; remove → a row with removed=true.
read-path: GET /deal-views → the saved chips; filterDeals/byStage/rollUp over the listed deals (with account and contacts, prospects.ts).
