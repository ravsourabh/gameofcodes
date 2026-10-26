# Roundtable and show-room follow-up before Wave 7

October 27, 2026. Scores and decision presenters remain W07 work.

## Delivered behaviour

The six bundled people share a procedural seated rig, with hips on chair height, bent thighs/calves, supported feet, lowered selection targets and arm/forearm/wrist gestures. Listeners look toward the active speaker. The shared conference table, chairs and room-coloured programme backdrop replace the standing line; the lectern moves out of the table. The workshop keeps the same identities in a standing edit pose.

Desktop TV direction uses actual committed turn IDs for speaker, two-person and wide framing. Drag, arrow keys and Home take manual control; the TV control can re-enable it. Reduced-motion preferences disable automatic direction by default. Headset tracking remains authoritative; the director never moves the VR camera.

Start a show offers roundtable, heated panel, comedy room and serious newsroom. Tone is a separate serious/funny/satire/mixed choice. The premise can be typed or recorded; proposed room/tone interpretations appear in the readback and apply at confirmation. Each saved show retains its own configuration, cast and history. There is one active performance per client; other saved shows do not accrue background inference cost.

Every participant's first turn now receives the actual latest utterance, with references validated against committed contributions. Other speakers' position notes are excluded from utterance history, and the model is instructed to keep its own position faithful to its spoken text. An unheard participant gets a first-round opportunity before a directed challenge returns to an already-heard speaker; an explicit user floor assignment still takes priority. The previous correction-memory and clarification-loop guards remain in force, including Indic combining marks in text normalisation.

Heated mode prepares the next turn and voice while audio plays, then cuts the previous speaker only when the response is ready. Store the actual elapsed playback time, source and interrupting contribution. Cloud clips also have a measured total duration; device speech leaves that value unknown. Every third contribution is protected from automatic cut-ins. Quiet mode, single-step and other rooms keep sequential turns. User interruption stops speech and cancels outstanding inference/preparation. The saved full argument remains available, with its cut-off metadata distinguishing the performance from the intended complete text.

Hindi mode routes speech through the configured Sarvam key and documented Bulbul v3 speaker/model pairing, with independent reasoning models and explicit audio failures. Eight supported voices are offered when configured; existing English choices remain saved. Setup uses a validated structured-output schema with a larger Hindi token allowance. Satirical contributions have a fictional label in captions and spoken playback. Comedy prompts use playful callbacks and occasional spoken laughter/interjections; no recorded audience or human laughter track is claimed.

Indian Express and BBC India RSS supply bounded, dated headlines/excerpts. Host checks enforce source hosts, HTTPS, a seven-day publication window, future-date rejection, request/body limits, coalescing and five-minute caching. Excerpts retain publisher, source URL, publication/retrieval times and a notice that they are not independent verification/full articles. Review precedes model access. Selecting a new story preserves the previous show record.

## Verification

The local release passes 84 unit/service tests and 44 production browser journeys, TypeScript and the production build. Browser tests exercise actual rig-joint positions and hand movement, TV/manual control, real timed audio cut-offs using explicit synthetic audio fixtures, custom Hindi premise/confirmation/reload, news review boundaries and native hand language selection with a head-controlled view. Existing correction/retry/cast and native avatar/workshop paths remain covered.

The bounded live script recognises a Sarvam-narrated Hindi premise through configured transcription, then runs three actual characters with OpenAI Mini and Claude Haiku and synthesises three distinct Sarvam voices. A separate serious newsroom uses a freshly retrieved publisher excerpt and generates a referenced reply. The final local run used 12 provider requests. Its private JSON, Markdown and WAV files are under `.sovereign/review/`; none contains API keys. `scripts/verify-shows-live.mjs` caps each run at 20 provider POSTs and uses a temporary store, with no writes to original user conversations.

Live testing caught an invalid Hindi setup contract, an initial-round fairness issue and a response to an unspoken position note. Structured setup, first-round scheduling and text-only utterance history address those causes. Browser testing also caught concurrent room/language saves and an actor-selection test running before the rendered pose existed; language saves now have conflict recovery, stale room callbacks cannot overwrite newer state, and the selection helper waits for actual pose/camera data.

The hosted release is checked separately for its exact Git revision, public capabilities, configured Sarvam catalogue, dated news, avatar assets, browser/VR entry/exit, bounded live Hindi/news output and unchanged pre-existing saved data. Deployment retains the prior image and a data-volume backup. Review reports remain in the ignored private directory.

## October 27 recovery follow-up

The OpenAI model catalogue still listed `o1` after its reported October 23 shutdown. The app had discarded `shutdown_date`; it now filters shutdown models before ranking choices and blocks saved retired assignments with an explicit model/character error. Future shutdown dates remain selectable. Runtime `model_not_found` responses invalidate the catalogue and temporarily exclude only that model, without exposing provider response text or substituting a model. Other provider failures no longer uniformly suggest a key/balance problem. The user's explicit GPT-5.4 Mini choice was applied to the affected saved Host through the revision-checked assignment API; character identity, voice and history were retained.

Closing the studio previously rendered discussion visibility before clearing its open flag, hiding Resume until a later state change. Studio notifications now publish the actual open state before rendering, including cancellation and delayed-save close paths. Whole-utterance Start/Continue/Go ahead and Hindi equivalents route to approved start/resume actions before note capture. Quoted commands and topic sentences remain ordinary input. An unavailable model targets the affected character when Brain & voice opens.

Focused browser regressions exercise studio close, explicit model replacement, English/Hindi resumption, unchanged direction/brief counts and reload. A private in-memory copy of the affected session produced three real Hindi contributions across GPT-5.4 Mini and Claude Haiku, with both follow-ups referencing the preceding actual utterance. Two Sarvam clips decoded as 17.49- and 32.92-second mono WAV audio. The replay did not write to the production conversation. Private reports and audio remain under `.sovereign/review/`.

Recovery verification passes 87 unit/service checks, 46 production browser journeys, TypeScript and the production build. Completed conversations remain byte-identical; the deliberately repaired active session retains its history and subsequent user-driven contributions. Hosted checks separately verify the release revision, filtered catalogue, selected Host brain and visible Resume after studio close.

## Remaining limits

Room presets share the court architecture; this release does not create a walkable multi-room building or schedule multiple unattended shows concurrently. Voice acting and spontaneous laughter depend on the selected synthesis voice and generated text. News reasoning is source-aware interpretation, not an independent fact-checking service. Physical Quest microphone/tracking, comfort, GPU frame time and thermal behaviour still require W10/W11 hardware validation; browser hand emulation is not evidence of those results.
