> Historical baseline. The October 28 animation expansion supersedes the action counts and pending-motion list below; see [S07_S11_AUDIT.md](S07_S11_AUDIT.md).

# S05–S07 local implementation audit

October 27, 2026. Local implementation; no deployment or Git publication is implied.

## Scope and layers

Room 1 now prepares its conversation first, then final speech/mouth tracks, then plays saved material. Scripts remain optional. A delegated fictional starter accepts a stable reusable cast once; different assigned models receive actual preceding contributions, the corrected premise, format/role and filtered character knowledge. Authored lines lock. Per-line edits preserve original versions and other recordings; targeted regeneration is bounded.

The PRD and S15 explicitly reserve the **Live Desk as a separate future room**, with buffered real-time generation, audience input and producer controls. Current preparation is independent of future live discussion and external broadcast. S09 owns full camera direction; S10 owns video export.

## Speech and articulation

- New auto-casts use explicit Bulbul V4 Flash model/persona pairs. The picker retains V3; existing model-less short speaker IDs retain V3 semantics. Voices and reasoning models are independent.
- Final PCM WAV is cached with its hash, voice/model, language and delivery preferences. Pinned Rhubarb 1.14.0 phonetic recognition derives mouth cues from that actual recording. PP closure, rounded vowels and silence map to real Rocketbox morph targets; playback position drives the sampler. Pause closes the mouth, and seeking/replay does not request new inference.
- Local setup installs a checksum-pinned official archive. Docker packaging installs the Linux helper and FFmpeg. Docker execution was not verified here.
- The existing ElevenLabs key rejected a forced-alignment probe. The implemented path uses local phonetic recognition; it is not transcript-forced alignment and must not be described as perfect phoneme alignment.

## Performance

The 124-action vocabulary remains shared. Twenty-three core procedural bindings cover presence, gaze/listening, nod/head shake, shrug/eyebrow, explanatory gestures, smile/surprise, physical chuckle/laugh/facepalm, seated/standing posture and yield/interject. Every original supported rig exposes its required bones/morphs and per-action availability; 101 remaining catalogue entries need animation/props/rig support. Cue validation enforces actor/target identity, guest windows, bounds and conflicting lanes. Reactions reference actual saved lines; energy comes from the character profile. Reduced motion scales the body track without changing articulation time.

Full jumps, dances, sleep-on-desk, contact/prop choreography, vocal laughter assets and polished contact validation remain S11. A bound procedural motion is not evidence that every contact pose has passed a human quality review. The six original bundled rigs are the verification baseline; a separately added reserved custom host requires its own asset QA.

## Verification

- 110 domain/service checks passed in the final run; new cases cover no-script creation, actual multi-model history, correction persistence, rejected late replies, authored locks, final-audio cache/replay, layered preparation and a one-line retake retaining other audio.
- Twelve selected browser journeys passed across the complete and focused runs; module-reload interruptions and a brief diagnostic sampling-window issue were corrected and rerun. Coverage includes the existing studio/legacy journeys plus prepared playback, real morph PP/O sampling from an audio clock, immediate closed-mouth pause and core binding availability on all six original real rigs. Browser audio in the deterministic clock test is explicitly a silent fixture, not pronunciation evidence.
- The production client build and strict TypeScript checks passed. Final strict TypeScript and Vite build passed after the last functional changes.
- Real-provider smoke check: OpenAI `gpt-5.4-nano-2026-03-17`, Claude `claude-haiku-5-5` and Gemini `gemini-3.5-flash-lite` committed three independent Hindi/Hinglish contributions on the offline mindfulness/LeetCode premise, each referencing the prior real turn. Image-generation models are excluded from the reasoning catalogue. Hindi script policy receives a bounded repair before pausing on invalid output.
- Real voice/alignment auditions succeeded: V4 Hindi `anand_hi_news` (3.660 s, 34 cues), V4 Hinglish `shubh_enhi_ads` (5.527 s, 30 cues), V4 English `aparna_en_edtech` (5.246 s, 26 cues), and explicit V3 `shubh` (3.197 s, 31 cues). These single-sample wall times are integration observations, not a latency/cost benchmark. Ignored local evidence is under `.sovereign/studio-auditions/live-a61e3049-e237-49bf-ac4e-ca3a9b5e7df9/`.

## Remaining acceptance

Human Hindi/Hinglish pronunciation and comedy/delivery review, physical headset comfort/performance, polished contact choreography, actual media playback, directed cameras and exported video timing remain the relevant later-wave acceptance work. No human pilot or physical Quest acceptance is claimed. Source URLs alone never establish media perception.

## Follow-up: standalone room screen

The creator requested replacing the fixed title board with a GIF/video, independently of AI understanding. The local room screen accepts GIF, MP4/WebM files and compatible direct HTTPS media links. It animates GIF frames through ImageDecoder and displays video frames on the actual 3D screen, with pause/play, restart, video seek/mute and replace/clear controls. Screen playback does not add source material to an episode or call a model. Local previews require reselection after reload; durable media storage, frame-rate/audio mixing, optional perception and export timing remain S08/S10. GIF decoding support is browser-dependent, with an explicit MP4/WebM alternative.

The standalone screen browser check passed GIF animation/freeze, real WebM playback, pause/seek/restart and zero AI/production requests; responsive room panels and native emulated Quest controls also passed after this addition.
