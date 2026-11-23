# BUILD - Lock-screen and car controls for recorded calls

No migration. No env keys.

### Control a recorded call from the lock screen or the car
write-path: none — playback only.
read-path: a call page (Remote Sales) or Recordings (Sales Coach) → press play → useCallMediaSession sets "Recorded call"
metadata and play/pause/seek ±15 s/seekto handlers → lock screen, car display and headphone buttons drive the player;
leaving the page clears them.
