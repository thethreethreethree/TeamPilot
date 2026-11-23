# REMEDIATE - Link a call to its prospect, from any call view

### F1 - the control was unreachable in the full call view and could only create a new prospect
Fixed: CallPipelineLink in both views, with existing prospects offered first.
gate-or-promise: gate (pipeline-link route tests; MacroCallView render tests assert the shared control)
