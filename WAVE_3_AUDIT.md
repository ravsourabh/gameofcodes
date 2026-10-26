# Wave 3 and avatar-workshop correction

Date: October 26, 2026. Status: implemented and locally verified for the configured cloud mode. No public deployment or physical-headset verification is claimed.

## Experience delivered

The primary app occupies the viewport. Browser scrolling is replaced by paged visual choices, saved-character/history pages, caption pages and a native in-world keyboard. The character workshop is a transparent scene overlay: select a feature on the actual character or its feature dock, try visual choices immediately, keep a feature while shuffling, or type/speak a description for an AI suggestion. It has no appearance dropdown grid.

Generated looks remain temporary previews. **Join the room** saves the identity and adds it to the session in one action. Discarding/shuffling previews does not fill the saved library. Existing identities can be edited, reused, removed, or selected as a future-session guide. Name, role and guiding-code inputs are small optional controls. Deliberate **Use this look** changes can update the current character while preserving roles, positions, assigned brains and committed replies; ordinary library changes still do not rewrite other sessions.

Virus and participants can receive real direct questions through typed or recorded input. Captions, speech, voice preview/pacing, repeat, quiet and immediate interruption use one playback coordinator. Select a character to address them; the ordinary **Brain & voice** control and a second head selection open inspection. Native hand controls share the same feature/choice/join/brain/voice actions. A paged keyboard supplies microphone-free in-world instructions. Detailed identity/role text editing remains a desktop control; full hands-only journey validation is W10 work.

This wave supplies real guide conversation and AI-assisted avatar creation. W04 still owns confirmed situation notes, conversational setup and the action-based five-minute core introduction with optional lessons through ten minutes. Existing tutorial lessons remain pending. W05 still owns character-to-character scheduling; direct questions in this wave do not simulate a complete group discussion.

## Runtime and provider audit

`server/session-ai.mjs` uses provider catalogues and bounded requests independently of the retired court/build/preview adapters. OpenAI, Claude and Gemini model metadata is queried with the configured account keys; catalogue membership is labelled separately from guaranteed inference access. An unavailable model returns an error and keeps its assignment. It does not trigger a different model/provider automatically.

Live service-path verification used two characters in one saved session:

| Character assignment | Actual response model recorded |
| --- | --- |
| OpenAI `gpt-5.4-nano` | `gpt-5.4-nano-2026-03-17` |
| Claude `claude-haiku-4-5-20251001` | `claude-haiku-4-5-20251001` |

A separate bounded live request produced a validated cosmetic avatar proposal. OpenAI MP3 generation and transcription through `gpt-transcribe` succeeded, including a full HTTP service-path round trip. Microphone input is capped to a 20-second browser recording; permission/recognition failures leave typed/visual alternatives available. These checks use generated test audio, not a physical Quest microphone.

The supplied ElevenLabs key is recognised but returns `missing_permissions` for `voices_read`. Its voice catalogue remains unavailable until that scope is enabled. OpenAI and device voices are separate selectable choices. The runtime does not pretend a failed ElevenLabs request succeeded or silently replace an already assigned voice. Current ElevenLabs speech access cannot be established through its unavailable account catalogue.

The original local CLI adapters remain retained for regression/reference. Their fixed roles and model-selection capabilities have not been generalised/verified for this session runtime. They are not offered as connected model choices. Meta cloud routing also remains unavailable pending verification; copying an older key does not establish support. The current implementation and completion evidence apply to cloud mode.

## Persistence, cancellation and limits

`shared/session-domain.mjs` adds scoped exchanges and assignment/character-update events without requiring read-time migration of old sessions. Exchanges retain the user input, speaker ID, actual model provenance, epoch and timestamp. Participant replies also create attributed contributions. Assignments retain identity, role, code, position and previous history. Rendering and playback use the same committed session.

The session service exposes `/api/ai/catalog` and same-origin POST actions for `avatar`, `assign`, `talk`, `preview`, `speech` and `transcribe`. Session-bound actions resolve their character from the matching profile/session and active roster; scenario material and model responses do not become application commands. Avatar proposals pass the cosmetic-field validator before they can be saved.

Only one model reply may hold a session's floor. Model work runs outside the storage lock so cancellation remains available. Committing a reply requires its original revision/epoch; changed/cancelled sessions reject late output. Client generation tokens and abort signals prevent obsolete audio or transcription from restarting playback or speaking as a different character. Input is retained on model failure; audio failures preserve the committed caption. Brain/voice changes require the existing exchange to be interrupted or finished.

Stable request IDs and revisions cover library saves, roster updates, deliberate look changes, assignments and direct-message retry. A lost acknowledgement can be reconciled without duplicating an identity or committed turn. Completed avatar proposals have a bounded in-memory request cache; they do not save identities or join a session until accepted.

Prototype limits include 30 committed replies per session, 10 model requests and 20 audio requests per profile per minute, and 50 AI requests across the server per minute. Model output is bounded to 1,000–1,500 tokens, user instructions to 2,000 characters, audio uploads to 5 MB, and upstream responses to 6 MB. Rolling counters reset on service restart; the session reply limit persists. These are operational request bounds, not a provider billing cap or authentication system.

## Credentials and compatibility

At the user's explicit request, the earlier deployment configuration was copied from its saved server env file into ignored `.env.local`. The subsequently supplied ElevenLabs key updated only that local entry. No secret values were printed in verification output. `.dockerignore` now excludes local env files, keys and saved state from build context; `.env.example` documents the current runtime. Static secret/storage restrictions remain intact.

Legacy project data, source and regression tests remain preserved. The runtime serves neither the retired preview nor court build routes. Health/capability flags now distinguish available direct AI features from the unfinished full live-session controller.

## Verification and limits

- All 45 unit/service tests pass. Seven new AI tests cover safe identity/brain changes, explicit appearance updates, actual-model provenance, stale-output rejection, budgets, format-correct transcription, restart, idempotency, origin/profile boundaries and interruption during inference.
- All twelve distinct browser journeys have been verified against the built client. After correcting the retry-control rendering bug, the three affected workshop journeys were rerun and passed: direct feature selection/one-action join, unaccepted previews/lost acknowledgement, and native hand creation/keyboard/exit. Other passing journeys cover viewport bounds, AI-description transport, session save/reload, profile separation, revision conflicts, preserved captions on voice failure and browser rejection of late replies/audio after interruption.
- Browser AI-description/catalogue cases use explicit transport fixtures, with real local library/session persistence. They are not evidence of paid inference; the separate live service checks above establish that path.
- TypeScript checking and the production build pass with Node 24.19.0. The generated client still exceeds Vite's 500 kB chunk warning; physical startup/frame time remains to be measured.
- Desktop home/workshop renders were visually inspected. IWER's Quest 3 runtime verifies native hand rays and keyboard actions. Physical tracking, comfort, microphone permissions/recording, frame rate and the complete seated journey remain unverified.
- A local check found no copied credential values in changed tracked/unignored source. `.env.local` remains ignored. No deployment, push, Docker build or release submission was performed.

The next wave is W04. The local CLI boundary, ElevenLabs permission restriction and device limitations must remain visible in later release validation.

## Follow-up: direct interface requests and action spacing

The user reported Virus answering “open your brain” as a literal chat question. `shared/interface-intents.mjs` now recognises a bounded set of complete, direct user requests before the conversation/avatar path. Opening brain/voice/appearance controls uses the same helper as the ordinary picker and head shortcut, preserves an in-progress preview, and interrupts existing speech/inference. Quiet, repeat and character-workshop requests also use real controls. Named characters are resolved against known identities; ambiguous names ask for selection. Model replies, scenario context, quotations and compound/unknown instructions do not execute these actions. Guide instructions now describe the actual meaning of a character brain without claiming to control the UI themselves.

The crowded guide/summary buttons were reproduced at a 1280×560 viewport with 1.5 device scale. Their containers had gap values without flex layout. Explicit flex layout, wrapping, separate primary/secondary rows and padded secondary targets correct the spacing without adding scrolling.

Two intent unit tests cover command variants, names and non-command discussion. Three additional built-browser regressions cover command-only inspection without inference/session creation, opening the brain during a pending reply, and the screenshot's short/zoomed layout. Existing voice-failure and late-reply browser checks are rerun with them. Physical microphone recognition remains outside this regression evidence; all recognised text enters the same command router.

## API references used

Model response structure and validated generation follow the [OpenAI structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs). Audio requests use the documented [speech generation](https://developers.openai.com/api/docs/guides/text-to-speech) and [file transcription](https://developers.openai.com/api/docs/guides/speech-to-text) paths. Model catalogues follow the [Claude model endpoint](https://platform.claude.com/docs/en/api/models/list) and [Gemini model endpoint](https://ai.google.dev/api/models). Account voices and speech use the [ElevenLabs voice catalogue](https://elevenlabs.io/docs/api-reference/voices/search) and [speech conversion](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) endpoints. Availability is established by the actual account requests, not these documents alone.
