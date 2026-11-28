# BUILD - Call-added agents when the transcript lands

### Transcript lands
write-path: agent_fires claims keyed call:<deal>:<call>:v<version>; agent_runs as before.
read-path: runAgentsForCallLinked reads the call's transcript version (none → waits); generateSessionArtifacts ends with fireCallLinkedOnTranscript for a call already on a deal.
