# S09, S10 and S12 hosted core-pilot audit

October 27, 2026. Public site: https://gameofcodes.si.

## Release and scope

The hosted release is `studio-3b14aca28923c5b8`, built at `2026-10-27T02:13:14.103Z`. Its public release metadata identifies wave 12, milestone `studio-core-pilot`. All 110 runtime files match the local release manifest. The image was built from an immutable workspace snapshot, including the current studio changes; the server's original Git checkout and credential file were not rewritten. No Git commit or push is implied.

The requested batch implements S09/S10 and the technical core-pilot portion of S12. S11 was skipped in the requested order. Complete action coverage, physical headset acceptance and human audience approval remain separate gates below.

## S09: set, camera direction and practice

- Room 1 has a radio/newsroom desk, seated cast, microphones, lights, screen and camera anchors. New entry does not create Virus or revive court navigation.
- Automatic coverage follows actual saved contributions. Manual wide, host, speaker, two-person, reaction and screen shots are available; editions retain shot selections. Two-person framing chooses a nearby participant. Portrait output has its own speaker framing.
- The headset retains head control. Directed video recording uses an independent desktop output camera. Recording resets the automatic shot sequence so a preview does not alter later cuts.
- Skippable five/ten-minute practice advances on actual selections, premise input, pausing, camera choice and saved-take receipts. These are estimated practice paths, not a measured novice completion-time claim.
- Contextual cast, media and settings panels retain compact desktop/mobile layouts. Creator panels, name tags and selection rings are excluded from audience recordings.

## S10: takes, editing and playable output

- Accepted takes retain source cast/profile, script, final speech/alignment, performance and edition snapshots. Original takes survive line trimming, reordering and shot revisions. New versions retain parent IDs; creators can recall the previous version.
- A shared Web Audio timeline schedules cached recordings, mouth sampling and captions. Pause, seek and trims use the same audio positions. Playback and rendering do not request another conversation or regenerate speech.
- The rendered audience scene and audio mix are recorded as WebM, then converted to horizontal `1280x720` or vertical `720x1280` H.264/AAC MP4 at 24 fps. Outputs include video preview/download, VTT captions and a sanitised manifest.
- Export jobs and their captured source persist. Interrupted processing is recoverable through explicit retry. Identical repeated uploads return the receipt; conflicting recordings are rejected. Binary limits, media validation and ranged downloads are enforced.
- Room GIF/video uploads persist independently and can be referenced by a take. Playback does not automatically send media to models. Full authored media cue timelines and optional AI media understanding remain pending.

## Verification evidence

- **112 domain/service tests passed.** Coverage includes source-take immutability, edition bounds and timing, captions, actual FFmpeg output, malformed/foreign media, retry/idempotency, recovery after process restart, profile isolation and the reused studio/session foundations.
- **57 distinct browser scenarios passed across the complete and focused runs.** The full run initially exposed a test with a hardcoded local origin; the test now uses the isolated server's actual origin, and the affected native/legacy/conflict journeys passed on rerun. Focused final take/practice checks passed after the final interaction fixes.
- Strict TypeScript and the production client build passed; the final Linux image also built successfully. Local browser tests used port 5191 and its isolated services, preserving the existing development server.
- Browser take tests edited a saved version, retained the original audio/snapshot, exported both ratios through the real encoder, checked byte-range downloads and reloaded the saved takes. Their deterministic speech fixture checks timing, not pronunciation.
- Actual hosted UI acceptance on the final release loaded the reserved custom host, saved/joined it, uploaded and reloaded an animated GIF, exercised practice, then used emulated Quest hand rays/pinches to pause and exit VR. There were no page errors and no AI/production requests. This is emulation evidence, not a physical headset result.
- Final-release cached-take checks produced fresh horizontal and vertical files from an existing accepted show, checked captions and ranged playback, and reloaded the unchanged source take. No dialogue or speech request was made. These two additional files are distinct from the seven six-pilot files.

## Six hosted technical pilots

Six separate fictional Hindi premises were produced using isolated acceptance profiles: offline mindfulness/LeetCode, unnecessary meetings, cold tea, a sofa's gym membership, one-percent phone battery and a Wi-Fi password queue.

Each pilot saved three actual contributions from independently assigned OpenAI, Claude and Gemini models, with each subsequent turn referencing the preceding real turn. Eighteen committed contributions and their final Sarvam recordings were retained. All six accepted takes survived reload.

Seven hosted pilot files completed: six horizontal and one vertical. Inspection confirmed H.264 video, AAC audio, 24 fps and the declared dimensions, with durations from approximately 12 to 20 seconds. The first pilot's audio measured a mean of -15.0 dB, establishing that the hosted sample contains audible speech rather than the browser test's silent timing fixture. Exported frames were visually inspected, including Hindi captions and portrait speaker framing.

The six-pilot report was produced on release `studio-096bd8af7e450fee`. Subsequent revisions add take-navigation/practice fixes, a reproducible shot reset, pause-on-edit behaviour, corrected capture colours and tighter portrait framing. Final-release UI and cached-take export checks are recorded separately, so the earlier six-pilot run is not mislabelled as a run of a later revision.

Ignored local evidence is under `.sovereign/review/studio-release/`: `report.json`, `video-audit.json`, pilot videos/screenshots, `ui-report.json`, `source-verification.json` and the final cached-take report/videos. These private acceptance profile references are not publication links. The pilot report's control-request count is not a model-call count or billing estimate. Creator effort, billed cost and human comedy/audience scores have not been measured.

## Hosted issue found and corrected

Debian's FFmpeg interpreted the first browser WebM's nominal rate as 1000 fps, causing excessively slow conversion. Output now explicitly uses a 24 fps filter/rate and a duration bounded by the edition. The first accepted recording was recovered from its saved WebM through the retry route, without another model or voice request. All seven inspected pilot files use 24 fps.

The Docker aligner is installed under `/opt/rhubarb`, outside the persistent data mount; otherwise the mount hides an image-bundled helper. The final image preflight verified the aligner, FFmpeg and FFprobe before activation.

Frame inspection also found that offscreen exports bypassed the preview's colour conversion/tone mapping. Capture now uses a floating-point scene buffer and Three.js's output pass before byte readback. The focused two-format export journey passed again. Portrait coverage moves closer to the speaker, and smaller microphones sit to one side of the cast rather than covering their torsos. Actual final output frames are retained for inspection.

## Deployment and preservation

The final release uses the existing container/project, named data volume and provider configuration. Private pre-activation backup: `/home/deploy/sovereign-backups/studio-20261027T021143Z`. The previous image is retained for rollback. Deployment health checks verified the exact release identity and recording/export capability before accepting activation.

All **151 pre-existing files** at final activation retained their hashes. An additional check after hosted testing confirmed that all **57 files present before the first deployment** still have their original hashes. New isolated pilot/media/export files account for the added records. Existing characters, history and stored configuration were not replaced by acceptance data.

## Remaining release gates

- S11's remaining 101 catalogue entries, including complete jump/dance/sleep and prop/contact choreography, need real compatible animation assets and per-rig review. The existing 23 core bindings on the original six rigs do not establish universal action support. The custom host loaded and persisted in the hosted test; its complete animation/contact QA is still pending.
- Physical Quest performance/comfort, measured first-use timing and human Hindi/Hinglish delivery/lip-sync review remain open. Audio-derived phonetic cues are implemented; perfect transcript-forced alignment is not claimed.
- Human review must assess whether the six pilots are funny, varied and worth sharing. Technical completion does not establish comedy quality or audience traction.
- Full media cue timing/perception, additional finished channels, Participant/judges mode and external live broadcasting are not delivered here. The separate future **Live Desk remains S15**; Room 1 prepares conversation and speech before performance/playback.

This release establishes a repeatable Room 1 premise-to-file core pilot while preserving those acceptance boundaries.
