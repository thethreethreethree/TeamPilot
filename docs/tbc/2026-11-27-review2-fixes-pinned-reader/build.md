# BUILD - Review fixes; pinned reader

### MCP deal reads and find_calls
write-path: none.
read-path: dealCallsForCompany = the deal's call ids minus hides → loadCallsByIds (newest five); find_calls keeps isSalesCall.

### listProspects(companyId)
write-path: none.
read-path: with companyId every table read is pinned (remote_prospects_current, remote_prospect_tasks, tasks, accounts_current, deal_contacts_current, deal_stage_list_current, deal_playbook_current, deal_element_notes); signals and sentiment are keyed by the pinned deal ids.
