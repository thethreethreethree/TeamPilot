# BUILD - Six-hour cap

### Recorder
write-path: none new (stop() as a rep's Stop).
read-path: a timer from when the call first went live.

### Audio-chunk route
write-path: refuses (409, capped) before storage when audio_started_at is over six hours + 15 min ago.
read-path: session.audioStartedAt.
