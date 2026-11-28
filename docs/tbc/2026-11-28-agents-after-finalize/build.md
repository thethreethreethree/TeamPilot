# BUILD - agents after finalize

### After the reply
write-path: as before (agent_fires, agent_runs), now from after() on /finalize.
read-path: generateSessionArtifacts({ agentsLater: true }) skips the hook; finalize schedules fireCallLinkedOnTranscript after its reply.
