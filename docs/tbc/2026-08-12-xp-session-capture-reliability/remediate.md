# REMEDIATE — F1 session capture loss

## F1 — persist the audio on Stop; make recovery + indication honest
Root cause: the live path recorded audio only into a browser blob and never persisted it; the sole recovery UI
lived on the page the Standard flow immediately leaves. A live-STT capture failure therefore lost the audio.

Remediation (parts 1 + 3 of the founder's 4):
1. `persistOnly` branch on `/upload-recording` — stamps `audio_asset_url` from the stored object and returns,
   skipping transcription (cheap, always-runs-on-Stop save).
2. `persistRecording` client helper — sign → uploadToSignedUrl → finalize(persistOnly), mirroring the proven
   direct-to-storage flow.
3. `LiveCoachingPanel` — auto-persist the blob the instant recording stops, with a blocking "Saving recording…"
   state that gates the advance to After-Pitch until the save settles (founder's "block" choice), timeout-bounded
   (60s) so a stall can't trap the rep; the recovery fallback now re-transcribes from the saved audio instead of
   re-uploading (no double-upload).
4. After-Pitch indication — distinguishes "transcription didn't connect, your audio was saved, recover it" from
   "nothing was recorded", an honest WHY (§3.4).

Test added: the persistOnly route branch (stamps the company-scoped pointer + returns persisted + does NOT call
transcription). The existing persist-before-transcribe recovery-contract tests still pass.

Outcome: fixed (parts 1 + 3). severity: critical. class: ephemeral-only capture of a load-bearing artifact.
Parts 2 (auto-recover) + 4 (short-call feedback) follow immediately — see closure residual.
