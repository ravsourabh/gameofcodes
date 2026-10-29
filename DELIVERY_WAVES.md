# Channel Studio delivery waves

Updated October 30, 2026 · Asia/Calcutta. This plan supersedes the earlier planned W07–W12 sequence. W01–W06 and subsequent audits remain historical evidence for reusable prototype components.

**Focus: Room 1, बात का बवाल (Baat Ka Bawaal).** The common structure includes future news/comedy/reality channels and first-person Participant mode immediately. Complete their full experiences after Room 1. No new date estimates are implied by wave numbering.

Current status: **S01–S04 are complete locally**. The first-room workspace, rich character library, exact premise review/correction and native headset controls are implemented. Evidence is in [S01_S02_AUDIT.md](S01_S02_AUDIT.md) and [S03_S04_AUDIT.md](S03_S04_AUDIT.md). S05–S07 now have local speech/alignment, optional prepared conversation and core procedural-performance implementations; see [S05_S07_AUDIT.md](S05_S07_AUDIT.md) for evidence and remaining acceptance. S09/S10 now add the newsroom set, directed cameras, practice, saved editions and horizontal/vertical MP4 output. S12 deploys the supported core pilot; S07/S11 now have 110 bound actions across all seven rigs, backed by native Rocketbox clips and authored contacts; see [S07_S11_AUDIT.md](S07_S11_AUDIT.md). Fifteen stage/partner actions, physical Quest acceptance and human audience pilots remain separate release gates. See [S09_S10_S12_AUDIT.md](S09_S10_S12_AUDIT.md).

**Hosted animation subset, October 28:** the Microsoft/Rocketbox browser studio
now includes 110 bound actions backed by 36 native clips. Fifteen stage/partner
actions and the remaining S11 acceptance work are still pending. The experimental
MetaHuman GLB is excluded. Native Unreal development is a separate renderer path;
see [the separation strategy](METAHUMAN_INTEGRATION.md).

## Overview

| Wave | Outcome | Dependency |
| --- | --- | --- |
| S01 ✓ local | Retire obsolete entry points and protect the reusable foundation | Scope lock |
| S02 ✓ local | Versioned Channel/Set/Format/Episode and participant contracts | S01 |
| S03 ✓ local | Durable reusable characters with behaviour, psychology and canon | S02 |
| S04 ✓ local | Room 1 workspace with settings, casting/design and premise input | S02, S03 |
| S05 · local implementation | Hindi host delivery, audio pipeline and accurate lip-sync | S03, S04 |
| S06 · local implementation | Editable scripted/hybrid episodes with coherent cast interaction | S02–S05 |
| S07 · local implementation | Layered performance engine and core Room 1 actions | S03, S05, S06 |
| S08 · playback delivered | Standalone GIF/video playback and durable room clips | S04 |
| S09 · implemented | Room 1 set, directed camera coverage and contextual onboarding | S04–S07; existing standalone playback |
| S10 · implemented | Recording, retakes, editor and horizontal/vertical export | S05–S09 |
| S11 | Full action catalogue coverage across the supported cast | S07–S10 |
| S12 · hosted core pilot | Room 1 reliability, migration, pilots and hosted release | S01–S11 |
| S13 | Additional independent news/comedy channels | Room 1 release |
| S14 | First-person Participant mode with hosts and judges | Shared contracts; Room 1 release |
| S15 | Producer-controlled live broadcast and later multi-channel operation | Stable recorded channels; live-specific gates |
| S16 · last/future | Optional media understanding and advanced media-grounded cue timelines | Stable recorded channels; explicit later scope |

S10 is the first usable recorded-pilot milestone with an explicitly supported action subset. S11 completes the universal action promise; S12 is the first-room release gate. S13–S15 do not block a useful Room 1 pilot or require parallel room development now.

## Recorded publishing priority P01 to P10

The October 30 publishing request adds an independent execution sequence in [PUBLISHING_WAVES.md](PUBLISHING_WAVES.md). Start from the usable Room 1 take/export pipeline, before additional rooms and live broadcasting; pending universal animation, Unreal and physical-headset gates do not block recorded publishing development. Actual output-quality checks still gate each approved release. S16 remains last/future.

| Wave | Outcome |
| --- | --- |
| P01 | Channel identity, logo/banner variants, thumbnail/cover/caption and audio asset kit |
| P02 | YouTube/Instagram accounts, developer applications and secure connections |
| P03 | Background rendering, persistent jobs, approval snapshots and temporary storage |
| P04 | Full publishing package with video, metadata, thumbnail and calendar approval |
| P05 | Full-episode YouTube upload, attachments, processing and scheduled release |
| P06 | Complete comedy clip selection, independent review and vertical rendering |
| P07 | YouTube Shorts and persistent release calendar |
| P08 | Instagram Reels using the approved clips/calendar |
| P09 | Recovery, cleanup and supervised publishing pilot |
| P10 | Audience results and suggestions for future packages |

**P02 local implementation:** connection UI, encrypted owner-bound OAuth, protected sessions/CSRF, refresh/revocation and a separately confirmed private YouTube test pass 32 local checks. Account creation, app/DNS/gateway setup and real provider acceptance remain open. Follow [P02_SETUP.md](P02_SETUP.md); evidence is in [P02_AUDIT.md](P02_AUDIT.md). P02 is not marked complete by fixture tests or a successful build.

P01 has creator-confirmed channel identity and a technically verified [48-output local asset kit](publishing/baat-ka-bawaal/v1/index.html) prepared for visual acceptance; see [P01_AUDIT.md](P01_AUDIT.md). P02–P10 remain planned. The channel is Baat Ka Bawaal, the exact publisher credit is Game of Codes Production, and Chhola Bhatura leads the default artwork. P01/P02 preparation can overlap; P05 is a YouTube-only milestone, P09 completes the requested cross-platform workflow, and P10 follows as an optional improvement. Each detailed wave includes assets, creator instructions, dependencies and an exit check. The app origin is https://app.gameofcodes.si, password-protected according to the creator; historical deployment links are not the current connection/callback configuration.

## S01 — Product retirement and reusable-code inventory

1. Archive the former discussion/rehearsal PRD and identify the current PRD as authoritative. Remove obsolete court-scoring/presenter waves from the active roadmap.
2. Disable the old coding-preview launcher, legacy entry substitution and old API/preview proxy. Remove their npm launch aliases; retain saved records and necessary compatibility readers.
3. Inventory default client/server imports, assets, tests and storage consumers. Classify each as reused, adapted, retired, historical or compatibility-only. Do not delete modules because a name includes court, guide or legacy.
4. Remove/archive unreferenced old coding source and exclude it from production only after import, build and data-read checks. Keep regression fixtures only when they still test a retained invariant.
5. Record the Virus, sovereign/court UI and standalone council/interview retirement paths. Their visible replacement is S04; do not break the current app by deleting its guide before a channel entry exists.

**Exit check:** default launch/build has no path to the old coding application; legacy launch is explicitly rejected; retained data/readers and the reusable session runtime pass their relevant checks. Every remaining obsolete module has a named disposition.

**Completed locally:** historical PRD/README snapshots, fail-fast retired launcher, import/asset/test inventory, archived obsolete code/tools/assets/tests, removal of the direct `ws` dependency, production/archive exclusions and retained data readers. Visible guide/court replacement remains explicitly assigned to S04/S09. See [the inventory](RETIREMENT_PLAN.md) and [verification evidence](S01_S02_AUDIT.md).

## S02 — Shared studio domain and persistence

1. Adopt separate versioned Channel, RoomSet, Format, CharacterProfile, Episode, RundownBeat, CastAssignment, GuestAppearance, MediaSource, PerformanceCue and Take records.
2. Keep viewer mode independent of writing mode and language. Define a human participant independently of AI character IDs; human-input beats wait for input.
3. Persist creator-owned channels/defaults and independent episodes. Reuse atomic replacement, revisions, idempotency and cancellation; introduce adapters/readers for existing session records.
4. Store channel and character snapshots in an accepted take so later edits cannot silently change an existing episode.
5. Register future channel/set/format IDs and participant-stage anchors as contracts. Disabled/planned capabilities remain explicit; they must not look like functioning rooms.
6. Separate pure domain rules from model, speech, media, renderer and export adapters. Document the episode clock and event ordering.

**Exit check:** save/reload two channel definitions and episodes without shared context leakage; reject invalid references, unsupported modes, duplicated cast IDs and fabricated human input. Old records remain readable without a write-on-read migration.

**Completed locally:** mounted `/api/studio/` routes, guarded versioned storage, independent channel/episode defaults, versioned nested components/guest windows, durable receipts and epochs, immutable accepted data snapshots, participant-input gating, truthful planned capability flags, read-only existing-data adapters, and [clock/API documentation](STUDIO_API.md). No recording, UI or renderer completion is claimed by snapshot acceptance. See [verification evidence](S01_S02_AUDIT.md).

## S03 — Character creation, recall and rich profiles

1. Extend the reusable library with behaviour, psychology as fictional characterisation, likes, dislikes, backstory, canon, provenance and profile revisions.
2. Autosave every accepted character once, including accepted generated panellists and guests. Keep temporary previews clearly distinct. A single create-and-join operation handles lost receipts and partial failures without duplicate people.
3. Make channel membership and episode role independent of library ownership. Removing/rotating a cast member never deletes their reusable identity.
4. Add recall/search/recent-use, portraits and compatible appearance/voice/model editing. Preserve existing IDs and supported realistic assets when enriching old characters.
5. Add public, private and channel-learned canon. Supply each actor only relevant known facts; allow occasional callbacks to another actor's approved history/preferences.
6. Preserve accepted profiles in episode/take snapshots. Canon changes require creator editing or explicit approved episode provenance, not an incidental model claim.

**Exit check:** create a person, close/reopen, recall them into another episode and a second channel, preserve appearance/profile and keep private canon hidden. Remove them from a room and recall them again. Retry a failed creation without a second identity.

**Completed locally:** a separate versioned studio library overlays legacy identities without rewriting their source files. Accepted people save once, with rich editable fictional profiles, portraits, model/voice preferences, provenance and recent use. Atomic character acceptance plus durable cast receipts recover partial/lost acknowledgements. Creator-approved public/channel/private canon and learned-fact context are implemented; other actors do not receive private canon or internal motivations. The room editor uses supported live human models, visual choices and one-detail-at-a-time input. Actual AI callbacks are exercised by the S06 episode adapter, using the context boundary established here.

## S04 — Channel-room workspace and Virus removal

1. Make the channel directory/Room 1 entry the default. Remove the mandatory Virus avatar, greeting, guide-led navigation and guide lesson dependency from new sessions.
2. Place premise capture, channel settings, language, cast recall/design, brains/voices, media and rundown controls inside the channel workspace. Keep the primary interaction concise and form-optional.
3. Implement acknowledged written/narrated premise capture, short readback and correction. Help belongs to contextual room UI; it need not be a recurring on-screen character.
4. Let settings apply to channel defaults or the current episode explicitly. Secrets/connection administration remain protected service configuration.
5. Remove sovereign, throne-session, council-career and court-decision wording/navigation from the new flow. Preserve historical displays/readers for old records.
6. Keep a visible exit, pause, captions and input recovery path through all settings/cast transitions.

**Exit check:** a fresh user enters Room 1, recalls/designs a saved cast, changes language and submits a premise without encountering Virus or leaving for unrelated global settings. Old records and newly created characters survive reload.

**Completed locally:** the default entry is the channel directory and Meme Desk workspace. Cast/character design, voices/brains, channel versus episode settings, exact written/device-narrated premise capture, paged readback/correction, episode recall and source/rundown controls live in the room. Native ray/pinch surfaces and Latin/Hindi keyboards include pause/exit, with typed fallback for unavailable voice input. Future rooms remain visibly planned. Historical session/project links use a separate compatibility entry; the guide is never bootstrapped by a studio read or fresh-room flow. Full gesture onboarding remains S09; source playback is S08 and authored/AI rundown editing is S06.

## S05 — Speech performance and accurate lip-sync

**New decision:** [Bulbul V4 Flash finding](SARVAM_V4_FINDING.md). Keep pay-as-you-go; migrate model and persona together after auditioning, preserving V3 as an explicit alternative. Treat ₹1 pricing as time-sensitive and the reported 12 November offer expiry as account-provided information; use ₹2 as the regular planning reference.

1. Finish Hindi/Hinglish and selectable English policy across lines, captions, voice selection, preview and narration. Reasoning model and voice remain independent.
2. Preview an original serious vintage Hindi announcer delivery with a compatible V4 Flash persona, measured pacing and optional audio-mix EQ. Add model-specific voice catalogues, retain explicit V3 selection, and test Hindi/Hinglish pronunciation, cost, latency and interrupted playback before switching defaults. Do not send unsupported voice parameters.
3. Introduce an alignment/lip-sync adapter for the final generated audio. Drive mouth shapes from playback position, with smooth transitions and proper silence/closed-lip handling.
4. Validate each supported face's mouth shapes. Blend expressions and laughter with articulation rather than replacing the speech mouth animation.
5. Preserve timing through pause, interruption, seeking, retakes and offline export; cache accepted audio/alignment rather than regenerating on replay.
6. Retain explicit provider failure and deliberate retry/replacement behaviour. Device/emulated mouth pulses are labelled fallback evidence, not an accurate speech pass.

**Exit check:** inspect actual Hindi, Hinglish and English samples on the supported cast, including plosives, rounded vowels, silence and interrupted playback. Exported and preview timing agree; speech failure never starts stale audio.

## S06 — Optional writing, prepared conversation and cast interaction

1. Make scripts optional: a premise alone, or an explicitly delegated fictional starter, can produce a saved multi-character conversation before speech or audience playback. Build Room 1's setup, clip, panel and payoff rundown. Permit direct scripts as well as reviewed AI suggestions derived from a written/narrated premise.
2. Implement scripted execution and designated hybrid improvisation windows. Preserve authored lines/payoffs and make tone/length/turn budgets explicit.
3. Keep permanent, rotating and guest cast assignments stable. Validate entrances/exits for speech and performance cues.
4. Give every speaker the latest actual contribution, corrected premise and relevant visible character canon. Respond to the specific prior line; avoid generic monologues and constant biography recitation.
5. Add director revision of a line, role, beat, callback or ending. Preserve the earlier version and make targeted regeneration possible.
6. Stop repeated clarification, off-topic drift, provider errors and runaway continuation with a clear recovery path.

**Exit check:** a three-character episode has a coherent setup/escalation/payoff, an actual response/callback, a correctly timed guest and a retained correction after reload/model swap. Scripted lines stay fixed; hybrid lines remain within their chosen windows.

## S07 — Performance tracks and core action library

1. Implement posture, locomotion, upper-body, facial expression, gaze, mouth, voice and prop tracks with explicit priorities and interruption/blending rules.
2. Bind a polished Room 1 core: idle/breathing/blink, listening gaze/nod, head shake, explanation gestures, point, shrug, sceptical look, smile, chuckle/laugh, facepalm, surprise, sit/stand and yield/interject.
3. Expose the complete shared action catalogue to every actor with truthful per-rig readiness. A missing animation/prop is recoverable and cannot be silently substituted.
4. Validate director/model-proposed cues against actors, targets, furniture, guest windows, time bounds and conflicting tracks.
5. Vary energy and mannerisms from the saved character profile; maintain director control, reduced motion and immediate reset/stop.
6. Ensure reactions follow an actual trigger rather than every person randomly performing an unrelated action.

**Exit check:** multiple supported characters perform the core actions and speech together without invalid limb/desk contact; incompatible cues are rejected, interruptions recover and expressions do not break lip-sync.

**S05–S07 implementation note:** Room 1 saves the complete cast conversation before voice generation and playback. Final audio and mouth cues are cached separately from body/face/gaze cues; revising one line retains other recordings. Core bindings are available across the original six rigs, while full action coverage remains S11. Human delivery/contact review, physical headset acceptance and exported timing checks remain their release gates. See [S05_S07_AUDIT.md](S05_S07_AUDIT.md).

## S08 — Standalone GIF/video playback; understanding deferred to S16

**October 28 priority override:** standalone playback remains implemented. Items 3–5 below (unfinished understanding and advanced media cue timing) move to S16, last/future. They are no longer Room 1/S09/S11 release dependencies. Preserve existing upload, playback, take and export behaviour while animation work proceeds.

1. Replace the fixed “Very Serious Meme” board with standalone GIF/video playback. Do not send playback media to AI or require model conversations by default. Add bounded ingestion, supported source references, play/pause/seek/mute/replace and explicit load/access/format errors.
2. Store media provenance, source/date, review status, transcript/frame references and episode usage; keep creator controls out of audience output.
3. Separately add opt-in transcript extraction and compatible frame-sampling/perception adapters. A creator can keep a clip display-only. Tell the dialogue layer exactly which text/frames it receives only after explicit selection.
4. Share reviewed excerpts/frames with the relevant episode cast; generate a response tied to the supplied clip and current beat.
5. Coordinate playback, laughter/reaction holds and camera cuts on the episode clock. Cache analysis for replay/takes.
6. Keep live-feed connector contracts available for later adoption. Room 1's first screen does not depend on every streaming format working.

**Exit check:** a GIF animates and a video plays, pauses, seeks/restarts and mutes in the room without any AI request. Optional understanding is tested separately: only deliberately supplied transcript/frame context can ground a claimed media reaction. A failed/unsupported/unseen clip cannot produce a claim of having watched it. Durable media storage, basic controls and existing clip export timing are delivered. Unfinished perception and advanced media-grounded cue authoring are S16, last/future.

## S09 — Room 1 set, cameras and onboarding

1. Deliver a distinct radio/newsroom set with host desk, panellist/guest seats, microphones, media screen, programme graphics and clear stage/camera anchors.
2. Replace the throne-court default for Room 1. Keep room art independent of script, personality and voice routing.
3. Direct establishing, host, speaker, two-person, reaction and screen coverage from real rundown events, with manual selection and shot retakes.
4. Build a clean creator workspace and separate audience composition. Keep settings/cast/media panels contextual and short-viewport usable.
5. Deliver skippable five/ten-minute practice through selection, premise input, pause and a useful retake. No Virus dependency or mandatory onboarding delay.
6. Preserve headset head control, hand/text alternatives and readable spatial controls. Measure physical Quest behaviour separately from emulated hands.

**Exit check:** a newcomer reaches a useful preview in Room 1 and performs a successful interruption/retake without a guide character or long form. Camera coverage captures the joke/reaction while VR movement remains user-controlled.

## S10 — Recording, retakes, editing and export

1. Separate rehearsal, recording and accepted take states with explicit start/stop and saved receipts.
2. Save script, cast/profile revisions, actual model/voice routes, audio/alignment, media, performance and camera timing as a reproducible take.
3. Add line/action/shot retakes, trim/reorder and comparison/undo while preserving the surrounding episode and original take.
4. Export playable horizontal and vertical video with appropriate reframing, synchronised audio and captions. Provide an output preview and recoverable export jobs.
5. Re-render accepted material without another model conversation. Retain an episode manifest and keep settings/keys/private canon out of the audience file.
6. Produce an initial Room 1 pilot with the declared core action subset; make unsupported catalogue entries visible in creator tooling.

**Exit check:** create a short episode, retake one weak line/reaction, export both ratios and inspect the actual files/captions/audio. Reload and reproduce the accepted take without new dialogue generation.

**S09/S10 delivered:** automatic and manual wide/host/speaker/two-person/reaction/screen coverage; independent portrait framing; unchanged headset head control; contextual five/ten-minute practice; take acceptance and immutable source editions; selected line trim/reorder/shot versions and undo by recalling the original; cached-audio timeline playback; clean audience recording, server conversion to horizontal/vertical H.264/AAC MP4, captions and recoverable processing. Uploaded room media persists separately without automatic AI ingestion.

## S11 — Complete the action/reaction catalogue

**October 28 implementation:** 110 explicit bindings, 36 native source clips, authored facial/prop/contact actions, reversible previews and saved-line attachment. All seven actual rigs pass the deterministic contact/reset matrix. Fifteen travelling/paired/staged-contact actions remain unavailable; per-actor vocal laughter, physical Quest and broader human quality acceptance remain open. See [S07_S11_AUDIT.md](S07_S11_AUDIT.md).

1. Acquire/create compatible motion/pose and prop assets for the remaining catalogue entries, with an explicit per-action plan rather than procedural placeholders labelled finished.
2. Complete jump/hop, dancing/celebration, fatigue/sleep/wake, movement/seat changes, microphones/notes/cup/laptop, contact gestures and dramatic reactions.
3. Validate transitions, contact, recovery, intensity and interruption across every supported avatar/rig. Record per-character bindings and exceptions.
4. Coordinate laughter and other vocal performances, expressions, gestures and camera reactions; support grouped sequences without loss of individual control.
5. Finish director cue timing/triggers and repeatable sequences such as doze, notice, wake and reaction shot.
6. Maintain the catalogue coverage matrix and distinguish absent props/unsupported rigs from ready capabilities. Keep reduced-motion and stop behaviour tested.

**Exit check:** the current 125-action inventory (the original 124 plus disgust) has a tested disposition for every supported character; universal support is claimed only for ready bindings. The showcase includes jump, dance, sleep-on-desk/wake and a multi-character reaction sequence using real animations.

## S12 — Room 1 release and production validation

1. Complete remaining Virus/court/interview UI and obsolete-code removal after replacement/import checks. Verify that no default prompt, route or navigation revives those workflows.
2. Validate migration and preservation of existing characters, profiles, session history, accepted takes and provider configuration with backed-up data.
3. Run applicable domain/service tests, real provider/audio/alignment checks, desktop/native-hand journeys and physical headset acceptance. Inspect exported media, not just pass counters.
4. Test lost acknowledgements, partial creation/invitation/export, disconnected media, quota/model failures, interruption, seeking and recovery under bounded usage.
5. Produce six different short Room 1 episodes and record creator effort, human quality review, problems and audience-test results. Revise repetitive or weak comedy rather than counting generated minutes.
6. Deploy using the backed-up revision-verified path; verify the public output/room, preserved data and documented limitations. Publish an evidence-based release status.

**Exit check:** Room 1 completes premise-to-publishable-file repeatedly with reusable profiles, relevant interaction, media and reliable speech/performance. Remaining limitations are explicit; the hosted build and saved-data preservation are verified.

**S12 core-pilot scope:** deploy and verify S09/S10 with the already supported core action subset. The October 28 request resumes S07/S11 animation work; the current expansion is documented in [S07_S11_AUDIT.md](S07_S11_AUDIT.md). Do not mark the universal action release, physical headset acceptance, measured novice timing or human audience/comedy pilots complete on the strength of technical tests. Keep those gates pending while publishing the verified core pilot.

**Hosted technical evidence:** six isolated three-character Hindi pilots, saved speech and reloadable takes; inspected horizontal/vertical H.264/AAC output; final-release cached re-render without another model conversation; hosted GIF/host recall and emulated Quest pause/exit. The [S09/S10/S12 audit](S09_S10_S12_AUDIT.md) records deployment and preservation separately from the remaining human/hardware gates.

## S13 — Additional channels and sets

1. Produce real-but-funny news and serious news channels from the common contracts with distinct physical sets, recurring casts, voice direction, graphics and format rules.
2. Extend reviewed current-news/source handling and clearly distinguish reporting, commentary and fictional satire.
3. Add rotating/guest programmes and channel-specific character knowledge without duplicating the director or leaking unrelated history.
4. Validate independent channel settings/episodes and deliberate character reuse; preserve first-room recordings and the working Room 1 release.

**Exit check:** a new set/format/cast combination works through adapters/configuration and shared services rather than copied application logic; characters and episodes remain independently scoped.

## S14 — Participant mode and judges

1. Build the participant-stage/set anchors, first-person entry and a reality/comedy/talent format with hosts/judges/contestants.
2. Reuse existing responsive follow-up and feedback capabilities under the studio engine. Retire standalone career-interview onboarding/navigation.
3. Wait for actual typed/spoken human answers/performances; never generate the user as an AI actor. Preserve transcript corrections and immediate intervention.
4. Judge against agreed show criteria with attributable optional scoring, feedback, retries and relevant reactions to the actual answer.
5. Provide separate first-person experience and directed broadcast/recording coverage through the same take/event system.

**Exit check:** the user enters a show, answers a host/judge, receives a specific follow-up/reaction, retries and reviews the result; a director can produce the same format through the common studio structure.

## S15 — Live broadcasting and later channel scheduling

**Separate future room: Live Desk.** Keep Room 1 prepared: conversation first, then final speech/lips, then performance/camera tracks and playback. Implement real-time cast/audience collaboration only in this later room. It uses the shared architecture with a short buffer, live inputs, bounded provider spend, interruption handling, producer mute/hold and its own channel/format settings. Test private live preview before enabling any external broadcast.


1. Add a tested encoder/publishing adapter, producer preview/queue, immediate mute/holding scene, chat-topic review and explicit live-versus-recorded state.
2. Run sustained speech, action, media, latency, budget, failover and cancellation rehearsals before public interactive broadcasting.
3. Preserve factual/source and satire framing in live output; do not treat a disclosure label as factual verification.
4. Introduce background or simultaneous channel runners only with isolated state, resource budgets, monitoring and deliberate enablement. Reusing an actor does not merge channel memory.
5. Retain complete recordings and interruption/publication evidence; make recovery observable when a provider, media source or stream fails.

**Exit check:** a supervised real stream can be paused/recovered safely and accurately reflects what aired. Parallel channel operation remains unavailable until its independent scheduling/budget tests pass.

## S16 — Optional media understanding (last/future)

This wave runs after the other future work unless the creator explicitly reprioritises it. It contains opt-in transcript extraction, reviewed sampled-frame perception, media-grounded cast responses, cached analysis/provenance and advanced clip/reaction/camera cue authoring. Standalone display-only playback, current saved clips and existing export seek/synchronisation stay available now. No new AI media ingestion is enabled by this change.

**Exit check:** only explicitly reviewed transcript/frame context reaches the cast; unseen media is never described as watched. Cached analysis and media cues replay/export consistently.

## Evidence and acceptance mapping

Use the ST acceptance criteria in [PRD.md](PRD.md). S01/S12 own retirement and preservation; S02 owns shared contracts; S03/S04 own reusable profiles and channel entry; S05 owns language/voices/lip-sync; S06 owns writing and coherent memory; S07/S11 own real action readiness; S08 owns standalone media playback; S16 owns optional perception and advanced media cues; S09 owns the set, cameras and first-use/VR journey; S10 owns production output; S12 owns the Room 1 release/pilot; S13–S15 own the later formats/modes/broadcast.

Mark documentation, pure validators, integrated runtime behaviour and actual production evidence separately. A preset definition is not a completed room, a catalogue entry is not an animation, a video URL is not media perception, and an unlisted browser preview is not proof of broadcast readiness.
