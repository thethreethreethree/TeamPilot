# BUILD - Revenue Phase 3b: playbooks and the AI Deal Reviewer

Migration 0373 (deal_playbooks, deal_element_notes, deal_playbook_current, rss_valid_playbook, both erasure functions
extended). No env keys; the reviewer uses the existing engine (call(), engine rss_deal_review).

### A manager picks a playbook
write-path: Board → Playbook → POST /api/coach/remote/playbooks → deal_playbooks row (policy: is_sales_coach_manager; CHECK rss_valid_playbook).
read-path: GET /playbooks; the deal panel and the board's letters.

### A rep reviews a deal with AI
write-path: deal panel → Review with AI → POST /prospects/:id/playbook {review} → the deal's calls via the caller's client → dealReviewCoach → parseReview → ai_suggest rows (service role) for cited elements whose state allows.
read-path: GET /prospects/:id/playbook → replayNotes → letters, evidence with line links.

### A rep writes, a manager validates
write-path: POST {write | validate | clear} → deal_element_notes through the caller's client (validate: rep or tree manager, by policy).
read-path: the letters' states on the panel and the board (listProspects replays per deal).

### Erasure
write-path: rss_erase_sessions / rss_erase_prospects → notes '[erased]', AI reads {answer: '[erased]'}; rows kept.
read-path: the note reads "[erased]".
