# Wave 1 implementation audit

Date: October 26, 2026 · Release target: November 18, 2026 (Asia/Calcutta)

Status: Implemented and verified locally. Physical headset validation and public deployment are not claimed by this audit.

## Delivered boundary

The default entry is `src/session-main.ts`, backed by `server/session-server.mjs` and `server/sessions.mjs`. It creates, edits, saves, lists, and reopens draft discussion/rehearsal sessions. `src/session-scene.ts` supplies two independent seated greyboxes and native WebXR selection. There is no inference or live-session start route in this wave.

`scripts/dev.mjs` starts only the session service, HTTP desktop server, and HTTPS headset server by default. It does not import the old court service, browser streamer, fixed characters, coding prompts, provider adapters, or speech adapters. `/api/court/*` is absent from the new service. The optional `--legacy` development fixture is separate and cannot be selected in production mode.

## Foundation audit and reuse decisions

| Area | Finding | Decision / follow-up |
| --- | --- | --- |
| Rendering | The original scene combines characters, construction theatre, streamed apps, garden travel, and four zones. | Keep its source; use a small independent Three.js/WebXR scene. Reusable rendering techniques can be extracted in later waves. |
| Hand input | Three.js native select events and the existing IWER runtime provide a suitable path. | Use native hand target rays, pinch selection, local sphere hand models, and an in-world panel. Verify physical Quest comfort later. |
| Characters | The old class is keyed by fixed jobs and provider tokens. | Preserve it for reference. W02 introduces stable identities, modular appearances, guiding codes, and reusable casts. A greybox chair does not establish character completion. |
| Profiles/setup | Existing profiles bind old projects to local/cloud setup and a coding folder. | Import only valid profile labels/IDs into a separate versioned store. The new setup requires no directory or model access. |
| Speech | Transcription, TTS, synthesis fallback, and cancellation are tied to old roles/routes. | Keep source unchanged. W03 must generalise identity/voice routing and verify browser/host/voice capabilities. The new shell makes no speech request. |
| Local providers | Adapters implement CLI discovery, account checks, constrained invocation, and environment filtering. | Retain these boundaries. W03 must audit actual model selection/reporting and interruption. Installation is not live availability. |
| Cloud providers | Adapters have provider-specific requests and hardcoded model choices. | Treat these as unverified implementation inputs. W03 must verify supported IDs, cancellation, limits, and configured access before use. |
| Persistence | Old court state, browser project storage, and generated artifacts have different meanings from sessions. | Use a new namespace; never reinterpret a project file as a session or reset unknown data. |
| Hosting | Node/Vite, HTTPS, and Docker can host the new shell. | Proxy loopback port 4176, preserve host endpoints/data volume, and remove Chromium from default runtime requirements. Public release checks remain later work. |
| Tests | Outgoing provider/domain tests remain useful; browser journeys target the retired entry. | Keep all existing unit tests. Add new domain/service/browser checks and retain the old browser suite behind an explicit legacy configuration. |

## Records, states, and persistence

`shared/session-domain.mjs` defines schema version 1 for Character, Scenario, Participant, Session, Contribution, Rating, Decision point, Outcome, and session events. Its declaration file exposes the same shapes to TypeScript. Runtime validation checks identity, ownership, kinds, references, settings, revisions, and ordered event ledgers.

The state graph includes draft, ready, running, paused, completed, stopped, and failed. Readiness and terminal transitions are validated in the domain. Only draft editing and pending-work cancellation are exposed by the Wave 1 HTTP service; the ready/running controller belongs to later waves.

New files live at `.sovereign/sessions/v1/<profile-id>/<session-id>.json`. Changes serialize per session, require an expected revision, and commit through a unique temporary file followed by replacement. Request IDs make retries idempotent, including after restart. Configuration changes and cancellation advance an epoch so later orchestration can reject obsolete results. Event count, body size, and stored-record size are bounded.

Legacy directories are never new session storage. UUID validation prevents caller-supplied paths; storage junctions are rejected. Corrupt/future records are reported and kept intact, without a fabricated replacement. Browser profile IDs scope operations but are not authentication credentials.

## Current HTTP surface

| Method / route | Behaviour |
| --- | --- |
| `GET /api/health` | Session service identity, schema version, and disabled preview/inference. |
| `GET /api/session-capabilities` | Truthful draft/live/model/voice capability flags. |
| `GET /api/sessions?profileId=<uuid>` | Profile-scoped session list and unavailable-record count. |
| `POST /api/sessions?profileId=<uuid>` | Creates a draft using session/request IDs and validated title/mode/situation. |
| `GET /api/sessions/<uuid>?profileId=<uuid>` | Loads a matching profile's versioned session. |
| `PATCH /api/sessions/<uuid>?profileId=<uuid>` | Revision-checked `update` or `cancel` with a request ID. |

Mutations require same-origin JSON. Unsupported fields, methods, schema versions, and actions are rejected. The HTTP surface does not accept arbitrary record replacement or model-produced control instructions.

## Verification evidence

- TypeScript check and production Vite build pass with bundled Node 24.19.0.
- All 29 existing/new unit and service tests pass, including schemas, invalid states/references, valid lifecycle transitions, stale revisions, idempotent retries, cancellation, competing writes, Unicode input, restart, corrupt/future data, and junction rejection.
- All five development browser tests pass using the real new service for save/reload, profile separation, legacy browser-metadata preservation, lost-response retry, concurrent-edit recovery, and native WebXR hand selection.
- HTTPS WebXR emulation installs IWER's Quest 3 runtime, enters an immersive session, aims a native hand ray, pinches to select the council room, saves through the real API, and exits VR.
- The new-entry test observes no request to retired court/preview endpoints; the service does not import or start them.
- Two browser checks also pass against the built production client: session save/reload with retired/private routes blocked, and native hand selection/save/exit. The exit check holds a save request pending and confirms VR can still be left before the network responds.
- The rendered desktop shell has been visually inspected. These checks do not establish physical headset frame rate, microphone behaviour, or selection comfort.

## Constraints and schedule risks

| Constraint | Impact and next checkpoint |
| --- | --- |
| Default machine Node is 20.19.4, below the requirement. | Validation uses bundled Node 24.19.0. Development requires Node 22.12+ or Node 24; package metadata now declares this. |
| No live model, voice, or credential provisioning was needed or performed. | W03 must establish real capabilities without silent provider substitution or unavailable selectable choices. |
| No physical Quest/device connection is established. | The emulated input path is verified; obtain device evidence during integration and before release. |
| Docker client is present, but its engine is not running; remote release is not deployed. | The image could not be built locally. Verify it with a working engine and validate the public path in W12. |
| Greyboxes do not establish final art, cast scale, or performance. | W02/W06/W08 must budget rendering; W11 measures the full workload. |
| Vite reports a client chunk above 500 kB, including Three.js. | The build passes. Measure startup/device behaviour and consider chunk splitting during integration rather than treating bundle size as measured headset performance. |
| Substantial work remains in the target schedule. | Live routing, orchestration, presenter dependencies, and rehearsal quality are the highest risks. Reassess after W03/W05 without silently dropping either mode or agreed features. |

## Next dependency

W02 can build editable characters, a reusable cast library, and Virus as the entry guide on the versioned domain. W03 wires his speech/listening and brains. W04 replaces the default setup form with guide-led note-taking, confirmed interpretation, draft autosave, and interactive gesture orientation. W10 validates/refines the full introduction; onboarding is not deferred until that wave.

The user clarified after inspecting Wave 1 that its form-heavy UI is scaffolding, not the intended product interface. This correction is captured in the PRD and AC-19/AC-20. Wave 1's implementation evidence remains valid for the foundation; it does not claim that assistant-led entry or the first-five/ten-minute introduction is already implemented. The current UI continues to label setup preview and later availability explicitly.

Wave 2 follow-up: its HTTPS regression run exposed the dependency cache under the blocked private-storage path. The cache was moved to ignored `node_modules/.vite-headset`, preserving the static-data restriction. The existing native selection/save/exit test and the new guide/character hand test were rerun after the correction. Current delivery and verification are recorded in [WAVE_2_AUDIT.md](WAVE_2_AUDIT.md).
