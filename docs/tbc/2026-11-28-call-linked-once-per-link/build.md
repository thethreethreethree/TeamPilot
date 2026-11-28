# BUILD - Call-added agents once per link

### Once per link
write-path: agent_fires claim call:<deal>:<call> (as before 20d9abb8), taken only once the call has a transcript.
read-path: fireCallLinkedOnTranscript runs the agents for a linked call whose claim is free; a reprocess finds it taken.
