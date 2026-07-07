-- 0096 — pin search_path on this session's guard trigger functions
--
-- Follow-up hygiene for 0090/0091/0093/0095. Those migrations added guard trigger
-- functions but did not `set search_path` on them, so they trip the same
-- Supabase-advisor "function_search_path_mutable" finding that 0088 was written to
-- resolve. Bringing them to the same standard.
--
-- Risk is LOW (they are SECURITY INVOKER — run as the calling user, not the owner —
-- and authenticated users have no CREATE grant on public, so they cannot plant a
-- shadow `profiles` / `chat_topics` earlier on the path to hijack the guards'
-- unqualified reads). But pinning guarantees the guards resolve the REAL tables
-- regardless of the caller's search_path, and keeps the advisor clean. All three
-- reference only public-schema objects (profiles, chat_topics, is_topic_admin), so
-- search_path = public is correct and changes no resolution.
--
-- Metadata-only alter (like 0088) — no function-body change, no behavioral change.

alter function guard_profile_privileged_columns()   set search_path = public;
alter function guard_chat_participant_privilege()    set search_path = public;
alter function guard_care_agent_state_admin_cols()   set search_path = public;
