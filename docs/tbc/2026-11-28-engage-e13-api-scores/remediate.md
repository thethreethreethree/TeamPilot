# REMEDIATE

The score items' read was a .limit(5000) (PostgREST returns at most 1,000); it pages to the end with fetchAllPagedResult.
