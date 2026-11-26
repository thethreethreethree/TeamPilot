# BUILD - Brief templates: a manager's questions, answered from a call

Migration 0364 (brief_templates, custom_briefs, rss_erase_sessions + custom_briefs). No env keys.

### A manager writes a template
write-path: POST /api/coach/remote/brief-templates {name, sections} → parseSections → brief_templates. Retire: PATCH → retired_at.
read-path: GET /brief-templates → the company's live templates → the Coaching editor list and the call page's picker.

### Someone runs it on a call
write-path: POST /api/coach/remote/[id]/custom-brief {templateId} → getSession through the caller's client (404 before any AI) → live company template → runBriefTemplate → loadLines (current version) → stored? return it : customBriefCoach → parseAnswers (cited lines only, else "Not discussed") → custom_briefs.
read-path: GET /[id]/custom-brief?templateId= → custom_briefs through the caller's client (rep/tree, hidden calls) → the answers with play-from-here citations.
