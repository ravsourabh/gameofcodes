# S03/S04 local completion evidence

October 27, 2026 · Windows · Node 24. Scope is the first newsroom and reusable studio structure. No deployment, physical headset acceptance, new voice-model rollout or completed show output is asserted.

## S03 — durable characters and recall

- `server/studio-characters.mjs` adds a versioned character overlay at `.sovereign/studio/v1/<profile>/characters/<profile>.json`. It reuses existing IDs and reads original libraries without rewriting them or creating a guide. New studio characters never require the legacy bootstrap.
- Accepted characters retain their real bundled appearance, optional captured portrait, independently saved brain/voice preference, rich fictional profile, provenance and profile revision. Editable fields cover speaking style, habits/energy, traits, motivations/values, stress/conflict responses, likes/dislikes, backstory and canon. New previews have editable original starter personas; legacy enrichment does not invent a historical biography.
- One accept-and-join operation persists the person before linking their stable ID. Durable receipts recover an interrupted join or lost acknowledgement after restart without a second character. Clearing a seat preserves the library identity. Recall, search and recent-use ordering work across channels.
- Canon distinguishes public, private and channel facts. Explicit creator-approved learning records an observer/subject/channel relationship. Another actor's context omits private canon, unrelated learned history and internal motivation/stress/conflict notes. Episode-derived canon needs explicit approval and an owned source episode.
- Episode plans and accepted take data snapshots preserve rich-profile versions. Later library edits do not rewrite accepted history. Actual conversational callbacks use this context boundary in S06.

## S04 — first-room workspace

- `src/session-main.ts` dispatches fresh visits to `src/studio-main.ts`. Existing session/project links and explicit compatibility tests load `src/legacy-session-main.ts`; saved data and earlier conversation functionality remain available. The fresh studio flow neither creates nor displays Virus.
- The directory focuses on the Meme Desk. Future news/reality rooms are labelled planned. Unsupported saved room definitions are preserved and identified rather than rendered as a functioning alternate set.
- Cast recall/design, portraits and personality/canon editing, voice/model preferences, channel versus episode language, episode recall, source references and rundown review belong inside the room. Editing uses live realistic previews, visual identity/outfit/accessory controls and one-detail input, rather than long forms or repeated character saves.
- Exact written or browser-narrated words are attributed and durably captured before a cast exists. Paged readback requires confirmation; corrections retain earlier notes and supersede them explicitly. Confirmed corrections update a selected draft, while earlier accepted take snapshots remain intact. Missing microphone support offers typed input rather than claiming successful transcription.
- `src/studio-scene.ts` supplies a provisional studio/desk and realistic actors, desktop selection/look controls, native WebXR ray/pinch panels and Latin/Hindi keyboards. Pause/exit remain available in the keyboard as well as other room surfaces. Asset failure has an explicit retry with no fabricated replacement avatar. Full production set, shot direction and gesture onboarding remain S09.
- The launcher supports independent verification ports, so the new entry/API can be tested without restarting a different thread's application. A running older local server needs a restart to load the new routes; this task does not restart another thread or publish production.

## Verified results

| Check | Result |
| --- | --- |
| Active unit/service suite | **99 passed, 0 failed**, including nine new rich-profile/premise integration checks |
| Selected browser regressions | **9 passed**: six studio flows plus three compatibility entry/conversation/interruption flows |
| Character lifecycle | Rich creation, genuine rendered portrait, voice/model preferences, two-channel recall, removal/re-entry, original-file preservation and immutable accepted profiles pass |
| Retry/partial failure | Injected library-before-channel failure resumes the same person; browser-lost join receipt recovers after reload without duplicates |
| Premise/correction | Written/Hindi transcript input, attribution, confirmation, correction/reload and late-transcript rejection on pause pass |
| Layout | Room, character and settings panels fit 1280×800, 900×600 and 390×740 without scrolling/clipped panel content |
| Native headset controls | Quest emulation uses real ray/pinch selection for casting, preview, keyboard input/acceptance, pause and exit; no direct test-only action injection |
| Asset recovery | A deliberately failed GLB displays retry and subsequently loads a real model without saving a phantom character |
| Build/types | Production build and strict studio declaration compilation pass; the existing large shared-bundle advisory remains |

Browser transport/inference fixtures are explicit. These checks do not establish real microphone recognition quality, paid model performance, physical Quest comfort/frame rate or V4 audio quality.

## Registered finding and remaining work

[SARVAM_V4_FINDING.md](SARVAM_V4_FINDING.md) records pay-as-you-go, current public pricing versus the launch reference, the creator-reported promotional expiry, model-specific persona IDs and required auditions. V4 Flash is the **S05 target**; tested V3 selections remain unchanged and explicit alternatives must be preserved.

S05 owns real speech performance, V4/V3 audition and accurate mouth alignment. S06 owns authored/AI episode writing and actual actor-to-actor callbacks. Current source links are saved references, not media playback/perception; that is S08. S09 owns the full set/camera/onboarding experience. Recorded takes/export and production release follow S10–S12. See [DELIVERY_WAVES.md](DELIVERY_WAVES.md).
