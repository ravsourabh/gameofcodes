# Game of Codes — Channel Studio PRD

Last updated: October 30, 2026 · Asia/Calcutta

Status: approved direction from the current user requests. S01–S04 are implemented locally: retirement, studio persistence, reusable rich characters and the first-room workspace. Voice/performance/media/production-output acceptance remains in later waves. Historical W01–W06 completion records describe the earlier discussion/rehearsal product, not this release.

Delivery order: complete Room 1 first. Establish common contracts for every planned channel and Participant mode from the start; defer their complete sets and experiences until Room 1 works end to end. Detailed steps and completion gates are in [DELIVERY_WAVES.md](DELIVERY_WAVES.md). The previous PRD is retained as a [historical snapshot](archive/product/PRD-discussion-rehearsal-2026-10-27.md).

The previous November 18, 2026 target remains a planning reference for Room 1. This expanded scope has not been effort-estimated; no completion dates for the new waves or every future channel are asserted.

## 1. Product and current scope

Game of Codes is an AI ensemble studio. A creator enters a channel room, writes or narrates an episode premise, selects reusable characters, directs their dialogue and physical performance, edits the result and exports a show worth publishing. Desktop supports the complete creation journey. VR provides an optional spatial directing or participating experience through the same commands and records.

**Room 1 is बात का बवाल (Baat Ka Bawaal):** a fictional Hindi/Hinglish satire newsroom where a composed, vintage Indian radio-style host treats absurd everyday situations or selected memes with exaggerated seriousness. The name is a working channel name, not a change to the product name. The default cast is small, with up to four seats including the host and an optional guest. A polished 60–90 second episode is the first production benchmark; longer shows remain bounded and editable.

The initial host has an original identity and a measured announcer delivery. Voice selection, pacing and an optional radio audio effect are separate from the host's reasoning model. The description does not promise an imitation of a particular real broadcaster.

| Deliver for Room 1 | Structure now, complete later |
| --- | --- |
| Channel room, premise capture, channel settings, reusable cast and rich character profiles | Further independent channels, alternate physical sets and room-specific default casts |
| Scripted and hybrid satire; creator intervention and retakes | Broader improvised reality/comedy formats |
| Hindi, English and Hindi/English code-switching; Sarvam Hindi speech; accurate lip-sync | Additional language adapters and voice catalogues |
| Standalone in-room GIF/video playback and saved clips | Optional media understanding, transcript/frame analysis, advanced media cue timelines, additional screens and live-feed connectors (S16, last/future) |
| Core performance actions followed by full catalogue coverage across supported characters | Additional specialised rigs and licensed motion packs |
| Directed camera coverage, recording, editing, captions and video export | Interactive livestreaming and multi-channel scheduling |
| Director view | First-person Participant mode with hosts, contestants and judges |

Virus, a mandatory guide character, the sovereign/court decision journey, the council career-interview journey, court scoring and decision presenters are retired from the new default product. They do not block Room 1. Preserve useful input, follow-up, character, voice, gesture, persistence and interruption systems under the studio structure. The former interview track becomes Participant mode rather than a second disconnected application.

## 2. Channel-first experience

1. Open the channel directory and enter Room 1. Future rooms can show their planned state without implying that they run today.
2. Use the channel room as the workspace. Premise, cast, character design, media, language, brains, voices, programme settings and history are contextual room controls. Detailed editing opens on request; the primary screen has no long setup form.
3. Write or narrate a premise. Capture exact user words, propose a concise readback, and let corrections replace misinterpretations before generation. A settings change must not lose the premise.
4. Choose the channel's recurring cast, recall an existing character, create someone new or schedule a guest. Review each role without recreating the person's identity.
5. Select scripted or hybrid writing for Room 1. Review the proposed rundown, lines and media cues. Keep setup, escalation and payoff editable rather than generating an endless discussion.
6. Rehearse the performance, intervene, change an action or retake a line. Recording starts explicitly and has an observable receipt/state.
7. Review the episode, trim or replace a section, select horizontal/vertical coverage, and export a playable file with captions and an episode manifest.
8. Return to the same channel and cast for another premise. Prior episodes keep their original character, script, voice and media snapshots.

The initial five-to-ten-minute introduction remains contextual and skippable. Teach selection, premise input, interruption and a useful retake through successful actions, with a useful first preview targeted within five minutes when connections/assets are ready. Optional deeper practice can continue through ten minutes. The channel workspace supplies instructions and help; there is no mandatory Virus greeting or guide lesson. Captions, type input and hand-selectable controls remain alternatives to the microphone.

## 3. Settings and ownership

- Channel defaults include room/set, allowed formats, regular cast slots, language, host direction, source policy, audio mix and camera style.
- Episode overrides include today's premise, participating cast, guest windows, writing mode, source clips, rundown and performance cues. Applying defaults to future episodes must not rewrite completed ones.
- Character identity, design and profile live in the reusable library. Channel roles, relationships expressed on that show, transient emotions and current positions remain separately scoped.
- Channel settings and character selection/design are accessed from the channel room, not unrelated global navigation. Provider keys, connection administration and storage/account configuration remain protected service administration. Never put secret values into channel, character or export records.
- The same validated commands are used by desktop controls, VR controls and direct creator instructions. Generated dialogue and media content cannot execute arbitrary application actions.

## 4. Layered architecture

| Layer | Contract and responsibility |
| --- | --- |
| Channel | Versioned programme identity, defaults, format selection and recurring roster |
| Room set | Layout, seats, participant marks, props, screen surfaces and camera anchors; independent of tone |
| Format | Segments, roles, writing modes, turn-taking, interruption and source rules |
| Character library | Durable appearance, behavioural/psychological profile, preferences, backstory, canon, model and voice assignments |
| Episode/rundown | Premise, reviewed sources, cast snapshots, script, guest windows, takes and ordered beats |
| Director | Validates and schedules proposed dialogue, actions, media, pauses, human turns and camera cues |
| Performance | Separate posture, locomotion, upper-body, face, gaze, mouth, voice and prop tracks |
| Adapters | Reasoning providers, Sarvam/other speech, transcription/alignment, media ingestion/perception and persistence |
| Presentation/output | Room rendering, desktop/VR input and preview, recording, editing, export and later broadcast |

Channel, set, format, writing mode, tone, language and viewer mode must remain independent. Adding a comedy channel or a participant camera must not require copying the session controller. Provider/model choices must not determine identity or room geometry. The episode clock and event stream coordinate speech, animation, source playback and camera shots.

The `shared/studio/` foundation defines these data contracts and a 124-action catalogue. S02 mounts channel/episode storage and immutable accepted snapshots at `/api/studio/`, using atomic replacement, revisions, request receipts and cancellation epochs. Existing libraries/sessions have read-only studio adapters; no migration or Virus bootstrap occurs on studio reads. The [API and ordering contract](STUDIO_API.md) separates this foundation from later UI, inference, rendering, animation and recording adapters. S05–S07 add final-audio alignment, optional prepared conversations and a performance adapter. The October 28 S07/S11 expansion supplies 110 explicit bindings from native Rocketbox clips and authored contacts/expressions, with 15 stage/partner actions still pending; see [S07_S11_AUDIT.md](S07_S11_AUDIT.md). [S05_S07_AUDIT.md](S05_S07_AUDIT.md) distinguishes implemented bindings from remaining animation and release acceptance.

## 5. Reusable characters and durable creation

Every accepted character creation is saved for future use, including cast suggestions accepted into a show and generated guests. Creation and adding to a channel can be one acknowledged operation. A retry or lost receipt cannot create a second person. Temporary visual previews remain explicitly labelled previews; accepting one turns it into a durable character without a separate manual Save ritual.

Removing a person from a room, ending an episode, changing rooms or rotating the cast never deletes the library identity. Provide search, portraits, recent use, role suitability and a way to recall old characters. Explicit archive/delete actions are distinct from leaving the cast; historical episode snapshots remain readable.

| Profile component | Required content |
| --- | --- |
| Identity and design | Stable ID, name, supported avatar selection/customisation and revision |
| Behaviour | Speech style, mannerisms, energy, gesture habits, social conduct and preferred pacing |
| Psychology as characterisation | Traits, motivations, values, stress response and conflict style; creator-editable fictional descriptions |
| Likes and dislikes | Specific preferences that can support relevant conversation and callbacks |
| Backstory | Creator-provided or reviewed generated history; meaningful facts rather than constant exposition |
| Canon and relationships | Versioned facts with provenance, visibility, relevant channel/episode and relationships to other known characters |
| Brains and voices | Independently selectable provider/model and compatible voice; preserve actual output provenance |

Other characters can refer to public facts and facts they learned in the current channel or episode. Private motivations and unrelated channel history are not automatically shared. A callback should be occasional, relevant and traceable to a known fact. Characters cannot invent a new biography, preference or shared incident and silently make it permanent canon. Creator edits and approved episode-derived memories have explicit provenance/revisions.

Changing a profile affects future snapshots or an explicitly selected retake; it does not alter recorded history. Recalled identities retain their appearance, preferences and approved canon. Current mood, disagreement and programme role remain episode state rather than rewriting personality.

## 6. Casting and guests

The S03/S04 room saves accepted characters in a separate studio library, preserves legacy IDs through an overlay, and recalls their portraits, rich profiles and voice/model preferences. Character context exposes approved public/learned information to other actors; internal motivations and private canon are not included in another actor's context. The first room has live realistic previews and paged editing, with settings and casting inside the room. Current source/rundown controls establish saved episode context; performance and media playback remain their dedicated waves.

- Channels maintain recurring cast assignments to stable library IDs. Episodes can add rotating panellists and guests through explicit choices; a saved reload must not reroll the roster.
- A guest has an entrance beat, an exit beat and a role. Dialogue and action cues outside that window are rejected.
- The full cast receives the latest actual contribution and the current corrected premise, including on its first turn. Responses engage a named claim instead of producing disconnected monologues.
- Group scenes require multiple actual character calls or deliberately authored speaker lines. A single model's invented multi-person transcript is not evidence of separate actors participating.
- A bounded scheduler preserves role opportunities and supports interruptions according to the format. Room 1 favours readable comic timing; continuous screaming is not the default.
- Multiple stored channels have independent episodes and canon scopes. Simultaneously running background channels require an explicit later scheduler and per-channel budgets.

## 7. Script, improvisation and director control

### Prepared Room 1 and a separate future Live Desk

Room 1 uses a prepared production pipeline by default. A creator may provide only a premise, or delegate a fictional starter premise and cast; writing a script is optional. The cast's assigned models collaborate sequentially, receiving the actual preceding contributions. Finish and save that conversation before generating voices or starting audience playback.

| Stage | Saved output | Changes that invalidate it |
| --- | --- | --- |
| Conversation | Speaker lines, actual model attribution, corrected premise, approved script locks | A changed premise or selected line retake |
| Speech and articulation | Final voice recording, audio hash, mouth cues in recording time | Changed words, language, voice or delivery |
| Performance and direction | Separate expression, gaze, body/prop and camera cues referencing actual lines | Changes to selected cues or their referenced timing |
| Playback and output | One deterministic timeline using approved text, audio and cue versions | New accepted production revision |

Editing a reaction or camera shot must retain the dialogue and audio. Editing a line replaces that line's speech/alignment and reflows subsequent timings; it must not silently regenerate the entire conversation. Review, interruption, resumable preparation and cached replay are first-room requirements. Cinematic camera coverage and video export remain S09/S10.

**Future, separate room: Live Desk (S15).** Live discussion is explicitly deferred from Room 1. It will have its own channel-room identity, live format, audience/guest input, bounded turn and cost budgets, interruption policy and producer controls. Reuse the same character library, models, voice/alignment adapters and performance tracks, but produce a short buffered next segment instead of requiring a fully completed show. Audience input can change future contributions without rewriting already transmitted material. A live room preview and an actual platform broadcast are separate release gates. Do not market prepared Room 1 playback as a live conversation or enable the Live Desk before its reliability and operator controls pass.


Scripted mode performs the approved lines and cues. Model-written suggestions are editable drafts until accepted. Hybrid mode locks the creator's setup/payoff and allows bounded responses in designated beats. Improvised mode has an explicit premise, role brief, segment/time budget and stop conditions; full improvised reality production belongs to a later wave.

The creator can direct by selection or natural language: who acts, what they do, whom/what they address, intensity, duration and trigger. Validate the result against the active cast, props, media, guest windows and supported action bindings. Unsupported requests have a clear pending/unavailable state rather than an unrelated substitute.

Keep exact user corrections and a durable corrected working brief. Old readbacks, consumed interventions or earlier model replies must not override later corrections. Repeated clarification, failed inference or missing context pauses production rather than producing a loop. The offline/mindfulness correction regression remains a generic memory test, not a revived coding product feature.

Retake one line, gesture, reaction or camera cue while retaining the approved cast and surrounding beats. Save the take lineage and allow comparison/undo. Editing one line must not pay for or regenerate an entire episode by default.

## 8. Character action and reaction library

All supported characters share the complete action vocabulary. The catalogue covers natural presence, speaking gestures, listening, agreement/disagreement, expressions, comedy, debate, cooperation, locomotion, dance/celebration, fatigue/sleep, prop interactions and dramatic reactions. `shared/studio/actions.mjs` started as a 124-entry inventory and now includes disgust (125 total). It remains traceable to the [coverage matrix](S07_S11_COVERAGE.md).

An action is production-ready only after its real animation/pose, rig binding, prop alignment, transitions and interruption behaviour have been validated. Track catalogued, needs-animation, needs-prop, unsupported-rig and ready states per character/asset combination. Never present a catalogue entry as an already implemented motion.

Use composable tracks. A facial smile can accompany speech and a hand gesture; incompatible simultaneous full-body actions are rejected or explicitly sequenced. Actions such as jumping, dancing, sleeping on the desk, drinking, handshakes and changing seats need credible contact and recovery. Laughter and other vocal performances coordinate body, face and audio. Reduced-motion preferences and an immediate stop/reset remain available.

First establish a polished core set for Room 1. Full catalogue coverage follows in its own wave before claiming universal action support. Introducing other full rooms is not a dependency of either step.

## 9. Voice, language and accurate lip-sync

Speech migration decision: [Bulbul V4 Flash finding](SARVAM_V4_FINDING.md). Keep pay-as-you-go, migrate model/persona pairs deliberately in S05, and retain explicit V3 choices. Saved V3 voices must not be renamed or silently rerouted.

- Hindi/Hinglish is Room 1's default. English remains selectable. Language policy is stored independently of the reasoning model and character identity; changing it does not rewrite old recordings or silently discard voice assignments.
- Use Sarvam for Hindi speech. Voice IDs and model compatibility are validated; missing/failed speech leaves captions and an explicit retry or deliberate replacement choice.
- Host delivery is composed, warm and measured. Radio EQ belongs to audio mixing, not unsupported TTS parameters. Preview voice/delivery on the actual host before treating the archetype as achieved.
- Lip-sync follows a timed phoneme/viseme or validated audio-driven track aligned to the final generated audio, using playback position as its clock. Loudness-only mouth movement is a fallback, not an accurate lip-sync completion claim.
- Test Hindi, Hinglish and English, plosive lip closure, rounded vowels, silence, laughter, pauses, interruption, seeking, retakes and final export. Blend expressions without suppressing speech articulation; close/reset the mouth when speech stops.
- Recorded/transcribed premise and human speech retain the confirmation/correction path. Microphone-free text and caption interaction remains functional.

## 10. In-room screens now; optional media understanding last/future (S16)

**October 28 scope decision:** retain standalone playback in Room 1. Move all unfinished media understanding, automatic transcription/frame perception and advanced media-grounded cue timelines to S16, after the other future waves. They do not block S07/S11 or Room 1 release. The following perception requirements describe that future scope.

Room 1 replaces the fixed “Very Serious Meme” title board with a real GIF/video screen. Playback is display-only by default and can run independently of the cast, script and model calls. Choosing or playing media must not automatically transcribe it, sample its frames, send it to AI or start a conversation. Provide play, pause, restart, supported seeking, mute and replace controls; volume/mixing follows production output. A programme title board alone does not satisfy this requirement. Use supported user-supplied clips or compatible source references with clear loading, playback, unsupported-format and access errors.

Media records retain source/asset identity, attribution, relevant publication/recording and retrieval times, transcript/frame references, review status and episode usage. Clips, images and extracted context are reference data, never director commands. Real news requires reviewed dated sources; fictional premises and satirical exaggeration are clearly framed.

Playback and AI perception are separate capabilities. AI perception is optional and explicitly enabled for a selected source; it is not a prerequisite for showing a GIF/video. Characters can react to creator-supplied context, supplied transcripts or actually sampled frames using compatible adapters only when that context is deliberately supplied. Do not imply they watched a clip because its URL appeared in a prompt. Share only the reviewed/permitted portion and identify what the model actually received. Pause the programme or use an explicit fallback if needed material cannot be understood.

Screen playback, reactions and camera coverage share the episode clock. Replaying or exporting the same take must not trigger fresh model analysis or new dialogue.

## 11. Room 1 set, cameras and studio UI

Replace the throne/sovereign staging with a recognisable compact newsroom/radio set: host desk, guest seats, microphones, primary media screen and restrained programme graphics. The host and panellists sit and address each other naturally. Keep the supported realistic identities consistent across studio, editing, reuse and export.

Room-level settings, cast recall/design, premise, media and rundown open within the channel workspace. Recording/output controls are clear and compact. Provider, character and history details stay contextual; the viewer export excludes editing overlays.

Desktop directed coverage includes establishing, host, panellist, two-person, reaction and media shots tied to actual beats. Manual control and retakes are available. VR head movement remains user-controlled; cinematic output can use independent virtual cameras rather than moving the headset. Test readability, seating, input and measured physical headset performance separately from emulator checks.

## 12. Recording, review, export and production scale

Save a take with its script, cast/profile snapshots, actual model/voice routes, audio, action and camera cues, media timing and interruption history. Rehearsal, recording, final export and later live publication are distinct states. Undo and regeneration create revisions rather than replacing acknowledged history.

Room 1 needs a playable horizontal and vertical video export, useful framing in each ratio, synchronised audio, captions, a previewable result and a recoverable export job. Re-render an accepted take without new dialogue inference. Keep private credentials and unshared character/context material out of exports.

Bulk production means reusable assets, saved presets and efficient revisions with fresh premises and meaningful episode variation. The initial quality pilot is six short episodes with different premises/payoffs. Measure completion, sharing, creator editing time, failure rate and provider usage rather than counting autonomous turns or room presets. Do not claim viral success from technical tests.

Interactive live publication is a later milestone, with verified platform integration, a producer preview/queue, immediate mute/holding scene, source and chat handling, budget controls and sustained reliability tests. A working browser performance is not itself a live-broadcast implementation.

### Approved recorded distribution

The October 30 scope adds recorded publishing through [P01–P10](PUBLISHING_WAVES.md), independently of S15 livestreaming. The current studio origin is **https://app.gameofcodes.si**, password-protected according to the creator. Preserve that access boundary while adding explicitly scoped OAuth callbacks and any temporary platform media delivery.

Prepare a full-episode YouTube package plus self-contained vertical comedy clips for YouTube Shorts and Instagram Reels. Include reusable channel assets, the public Hindi title, thumbnail/cover, descriptions, subtitles, credits, account destinations and exact release times. The creator reviews and approves the concrete package once; only that frozen revision and its listed posts/calendar can execute. Changed content or destinations require a new approval. Existing export or take acceptance is not permission to publish.

Run rendering, uploading, processing checks, scheduling and recovery as durable background jobs with the creator browser closed. Persist remote receipts and reconcile uncertain outcomes before retrying to prevent duplicates. Keep queued assets in private temporary storage until all consumers confirm processing; ordinary export cleanup must not delete publishing inputs. Remove successful unused binaries and visibly expire abandoned failed jobs, while preserving episode/take history and lightweight publication records. No arbitrary new full-episode length cap is introduced; current platform constraints remain explicit.

The creator selects/authorizes the YouTube channel and an Instagram professional account, configures the developer applications and approves any new infrastructure spending. Secrets stay in protected server configuration. Clip editing preserves complete setup/payoff exchanges and existing character/audio identity, using saved script/timing/camera data without making deferred S16 media understanding a dependency. P09 is the cross-platform release gate; analytics suggestions in P10 cannot silently alter approved packages.

## 13. Participant mode: the successor to interviews

Participant mode lets the user enter a reality/comedy/talent/panel show in first person, face hosts or judges, answer or perform, receive responsive questions/reactions and retry a segment. It uses the same Channel, RoomSet, Format, Character, Episode and performance/output systems.

Viewer mode (director/participant) is independent of writing mode (scripted/hybrid/improvised). Store the human as a separate participant, never as a fabricated AI character or data-source persona. Human-input beats wait for actual typed/recorded input; the system must not invent an answer or imply the user performed an action they did not perform.

Judges use the show's stated criteria and actual user response. Their reactions and feedback are part of the chosen show format; scores are optional, attributable and revisable. A participant scene needs its own stage mark, judging positions and first-person controls. Broadcast coverage/recording is separately directed and explicitly started. The previous interview entry, career-specific onboarding and sovereign/council distinction are retired; useful responsive-questioning and feedback components can be adapted here.

## 14. Existing foundation and retirement

| Existing component | Disposition |
| --- | --- |
| Character library, stable IDs, appearance/editor, model/voice separation | Reuse; extend with rich profiles, durable accepted creation and channel membership |
| Session records, revisions, atomic writes, cancellation, actual provenance | Reuse under Channel/Episode adapters; preserve historical readers |
| Corrected brief, per-speaker history and bounded discussion scheduling | Reuse inside rundown/director logic |
| Sarvam integration, captions, recording input, playback | Reuse and improve alignment/lip-sync and channel-level control |
| Realistic rigs, seating, procedural gestures, TV cameras | Reuse as rendering/performance adapters; complete proper set/action assets |
| Virus guide/bootstrap/guide-led landing and compulsory guide lessons | Remove from new default entry in the channel workspace wave; preserve old saved snapshots |
| Throne, sovereign wording, council career-interview entry, court point/decision-presenter UI | Retire from the new product; keep compatibility readers until migration is proven |
| Coding preview/build/browser service and legacy product entry | Retired; legacy launch aliases removed and `--legacy` rejected |
| Unreferenced old coding modules/assets/tests | Inventory and remove/archive after import and saved-data checks; never delete by filename keyword |
| Historical PRD and W01–W06 audits | Keep as dated history; they do not describe current release completion |

See [RETIREMENT_PLAN.md](RETIREMENT_PLAN.md) for concrete paths, checks and status. New wave IDs use S01–S15. They replace the old planned W07–W12 sequence; W07 courtroom scoring/presenters is no longer the next product wave.

## 15. Functional acceptance criteria

| ID | Observable requirement |
| --- | --- |
| ST-01 | A user enters Room 1 and reaches premise, cast/design and settings within that room, without a mandatory guide character or setup form. |
| ST-02 | Channel, set, format, episode, viewer mode and language are independent validated records with clear defaults/overrides. |
| ST-03 | Every accepted created character is durably saved once, recalled later with the same ID/design/profile and not deleted by leaving a cast. |
| ST-04 | Behaviour, psychology, likes/dislikes and backstory are editable, versioned and snapshotted for episodes. |
| ST-05 | Other actors use relevant public/learned canon without exposing private or unrelated-channel history or silently inventing permanent biography. |
| ST-06 | Permanent, rotating and guest cast assignments survive reload; guest dialogue/actions respect entrance and exit windows. |
| ST-07 | Premise corrections govern every later speaker across consumption, reload, interrupted updates and model swaps. |
| ST-08 | Room 1 performs reviewed scripted and hybrid rundowns with specific responses, comic setup/escalation/payoff and bounded usage. |
| ST-09 | All supported actors share the action vocabulary; readiness is truthful, compatible tracks compose, and the required per-rig coverage matrix passes. |
| ST-10 | Hindi/Sarvam and selectable English/code-switching preserve identity/provenance; speech failure and retry are explicit. |
| ST-11 | Lip-sync passes actual Hindi/Hinglish/English speech, silence, interruption, seeking, retake and export checks. |
| ST-12 | An in-room screen plays real selected image/video media and exposes loading/error and playback controls. |
| ST-13 · future S16 | Characters react to actual supplied transcript/frame context, with source/review metadata and no claim of unseen media perception. |
| ST-14 | The Room 1 set, seated actions and directed shots work on desktop; VR retains head control and has measured physical-device acceptance. |
| ST-15 | Pause, stop, correction, room/settings/cast changes and failed requests reject stale work and recover without duplicate characters, turns or exports. |
| ST-16 | A line/action/shot can be retaken without regenerating the full episode; original takes and snapshots remain available. |
| ST-17 | Horizontal/vertical video and captions export with synchronised audio, suitable framing and no creator/settings overlays. |
| ST-18 | A skippable contextual five/ten-minute introduction records actual successful actions and supports type/hand alternatives to speech. |
| ST-19 | Historical data/configuration remains preserved and readable; default code/navigation/prompts do not revive the retired coding, Virus or sovereign journey. |
| ST-20 | Six different Room 1 pilot episodes demonstrate useful output and record production effort, quality failures and usage; technical pass counts are not audience validation. |
| ST-21 | Additional rooms can use distinct sets, formats, defaults and cast without copying the core director/episode engine. |
| ST-22 | Participant mode places a real human before responsive hosts/judges using actual answers and the same studio records. |
| ST-23 | Later live publishing has a tested producer/control/stream pipeline and accurately distinguishes live performance from recorded material. |
| ST-24 | A creator reviews and approves an immutable publishing package containing the actual videos, metadata, destinations and exact release calendar; changes invalidate the affected approval. |
| ST-25 | Full episodes reach the authorized YouTube channel with approved metadata, thumbnail and subtitle track, after processing checks and without duplicate uploads on recovery. |
| ST-26 | Approved complete comedy exchanges render in suitable portrait framing and release as YouTube Shorts/Instagram Reels at approved intervals with a persistent, pausable queue. |
| ST-27 | Background rendering/publishing survives a closed creator browser and server restart; queued assets remain private, recoverable and protected from ordinary export cleanup until no consumer needs them. |
| ST-28 | Actual account identity, permissions and reconnect state are visible; platform access, media processing, failed-job expiry and temporary-file cleanup pass real-provider acceptance without exposing studio credentials. |

## 16. Delivery and completion rules

S01–S12 focus on Room 1, with a usable recorded pilot at S10 and full action coverage/hardening afterward. S13–S15 complete additional rooms, Participant mode and live broadcast; S16 is last/future for optional media understanding and advanced media cue timelines. Their shared data contracts are introduced in S02, not postponed until a separate application is built.

P01–P09 add approved recorded distribution from the current Room 1 export pipeline before additional-room/live work; P10 adds later audience feedback. These publishing waves do not imply completion of remaining S11 animation or physical-headset acceptance. See [the publishing plan](PUBLISHING_WAVES.md) for account setup, asset creation, creator instructions and execution gates.

A wave is complete only when its stated exit check has run and evidence is recorded. Mark domain contracts, fixture tests, actual provider tests, desktop/VR emulation, physical headset results, exported media inspection and audience pilots separately. Prior audit counts are historical evidence for reused components, not automatic acceptance of new studio behaviour.

Do not begin unrelated room art, court scoring, decision queues or a parallel interview application while Room 1's current blocking wave is incomplete. Supported custom premises remain open; a broad product promise does not require every preset to be fully produced before the first channel works.

## October 27 core-pilot implementation

S09/S10 implement a compact studio set, actual-turn camera coverage, independent portrait output, skippable action-based five/ten-minute practice, saved take/edition lineage, line trimming/reordering and shot revisions, cached-audio playback, clean canvas recording, MP4 conversion and captions. Direct media uploads persist in the room and can be snapshotted in a take without sending them to AI. Export uses existing speech and character snapshots; it does not trigger a new model conversation. In VR the user controls head movement; video recording is a desktop producer operation with an independent camera.

S12 is delivered as a **hosted core pilot** because S11 was deliberately not requested in this batch. Technical validation and deployment do not establish complete animation coverage, physical headset comfort, novice five/ten-minute timing or human audience approval. Those remain open release gates. Evidence, deployed revision and limitations are in [S09_S10_S12_AUDIT.md](S09_S10_S12_AUDIT.md).
