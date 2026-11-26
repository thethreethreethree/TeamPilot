# BUILD - Engage E5b: the tracker trigger

Migration 0380 (rss_valid_agent with tracker_heard).

### A tracker is first heard on a call
write-path: trackerScan / smartTrackerScan store hits → fireTrackerAgents → firstHeard → runAgentsForTrackers → the call's deal → runAgent → agent_runs.
read-path: Engage → Agents runs list.
