# Product and code retirement

Updated October 27, 2026. The channel-first [PRD](PRD.md) and [S01–S15 waves](DELIVERY_WAVES.md) supersede the previous sovereign/council release sequence. Scope is Room 1 first, with shared contracts for future rooms and Participant mode.

## Retired launch surface

- `npm run dev:legacy` and `npm run test:legacy` aliases are removed from the active package scripts.
- `scripts/dev.mjs --legacy` fails before starting an application service.
- The launcher no longer imports `server/preview.mjs`, substitutes `src/court-main.ts`, or proxies the old port 4175/preview application.
- The ordinary session service, current entry, private-storage denial and retired `/preview` response remain intact.

These are local code changes. They do not establish that the channel-first UI has already replaced the current Virus flow, and no new deployment is implied.

## Product surfaces to remove during replacement

| Surface | Replacement | Gate |
| --- | --- | --- |
| Virus bootstrap, default guide actor and mandatory greeting | Channel directory and direct Room 1 entry | S03/S04 provide durable characters and premise UI first |
| Guide-led global setup and guide-specific tutorial state | Contextual channel instructions and action-based optional practice | S04/S09 |
| Global character/settings navigation | Room-level cast/design/settings, with protected service administration kept separate | S04 |
| King/sovereign/throne language and court presentation | Room 1 newsroom/radio set and director controls | S04/S09 |
| Court point awards, decision presenters and decision queue as next wave | Episode writing, performance, media, retakes and export | Superseded roadmap; old records remain readable |
| Council career-interview entry and independent rehearsal application | First-person Participant mode before show hosts/judges | S02 contracts; full experience S14 |
| Endless autonomous discussion as the primary outcome | Bounded episode rundown with setup/escalation/payoff and accepted takes | S06/S10 |

## Completed S01 source inventory

The dependency check traced the active `src/session-main.ts`, `scripts/dev.mjs` and `server/session-server.mjs` entries, static/type imports, literal dynamic imports, Worker URLs, styles, build/test configuration and literal asset references. The retained unit suite contains regression consumers of the current domain/storage/provider adapters. The old coding-service tests were coupled to retired functionality, so they were archived with that source instead of keeping those services in the active runtime solely to run their tests.

Paths below describe original locations. Archived files retain their relative layout under `archive/legacy-coding/`, except the separately noted procedural-avatar snapshot. Their archive README explicitly marks commands/tests as historical.

| Original modules/assets | Disposition and reason |
| --- | --- |
| `src/court-main.ts`, `court-setup.ts`, `court.css`, `construction-stage.ts`, `preview.ts`, `scene.ts` | Archived: unused coding entry, build workshop and preview transport; no active entry imports them. |
| `src/brains.ts`, `characters.ts`, `connections.ts`, `court-intents.ts`, `onboarding.ts`, `spatial-ui.ts`, `voice.ts` | Archived: only consumed by the retired graph and its historical tests. Current model routing, onboarding, interaction and speech use separate retained modules. |
| `src/session-avatar.ts` | Historical under `archive/prototype/src/`: unused procedural stand-in. Active scenes import realistic avatars directly. |
| `server/preview.mjs`, `court.mjs`, `protocol.mjs`, `providers.mjs`, `cloud-providers.mjs`, `source-archive.mjs`, `workspace-setup.mjs`, `speech.mjs`, `tts-elevenlabs.mjs` | Archived: no consumer in the active service graph. Current cloud/Sarvam/ElevenLabs handling is in `server/session-ai.mjs`; current atomic persistence is retained independently. |
| `scripts/capture.mjs`, `check-connections.mjs`, `install-muse.mjs`, `review-assets.mjs`, `verify-public-preview.mjs`, `speak.ps1`, `transcribe.ps1` | Archived: target the old coding/CLI/preview application or its platform speech bridge. |
| `tests/protocol.test.mjs`, `court.test.mjs`, `providers.test.mjs`, `speech.test.mjs`, `cloud-providers.test.mjs`, `workspace-setup.test.mjs`, `workspace.spec.ts`, `guided-flow.spec.ts`, `playwright.legacy.config.ts` | Historical with their tested graph; removed from the active unit/browser command surface. No active storage/character/correction regression was removed. |
| `board/index.html`, `board/board.js`, `board/board.css`, `public/brands/*.svg` | Archived: coding demo board and five provider icons have no active consumers. |
| `src/environment-assets.ts`, `throne-court.ts`, browser fixtures and current Playwright configuration | Reused; small historical copies accompany archived source to preserve reference context. Active originals remain authoritative. |
| `src/session-main.ts`, `guide-setup.ts`, `character-workshop.ts` | Adapt in S03/S04/S06: current users still need entry, identity editing, exact-input capture, readback and retry. Remove Virus/global setup only when channel entry exists. |
| `src/session-conversation.ts`, `session-discussion.ts` | Reuse/adapt for S05/S06: actual speech interruption, corrected memory and multi-character turns. |
| `src/session-scene.ts`, `throne-court.ts`, `roundtable.ts`, `court-surfaces.ts`, `broadcast-camera.ts`, `environment-assets.ts`, `realistic-avatar.ts` | Reuse/adapt in S04/S07/S09: live XR surfaces, assets, rigs, staging and cameras; remove old room art/default wording behind the new room adapter. |
| `server/sessions.mjs`, `character-library.mjs`, `session-server.mjs` | Reused current consumers and compatibility readers. Studio routes are mounted alongside them; the library gains a non-initialising read method. |
| `server/atomic-file.mjs`, `session-ai.mjs`, `discussion-service.mjs`, `discussion-prompts.mjs`, `setup-schema.mjs`, `context-extract.mjs`, `context-worker.mjs`, `indian-news.mjs` | Reused/adapted: atomic replacement, provider/speech routes, bounded discussion, context parsing and news-source validation. |
| Existing `shared/*-domain`, avatar, language, style, interface-intent, discussion-memory/progress and room-performance modules/declarations | Reused/compatibility: current saved records and callers require them. Studio records use separate contracts; current records are not silently reinterpreted. |
| `shared/studio/*`, `server/studio-service.mjs`, `studio-store.mjs` | New active S02 domain/storage/HTTP layers. Future render/inference/media adapters are explicitly separate. |
| Remaining current tests, `scripts/review-court.mjs`, `verify-court-setup-live.mjs`, `verify-guided-live.mjs`, `verify-offline-leetcode.mjs`, `verify-session-discussion.mjs`, `verify-session-setup.mjs`, `verify-shows-live.mjs` and their fixture | Reused current regressions/manual verification, despite historical filenames; never run provider calls just to inventory them. |
| `scripts/fetch-avatars.mjs`, `public/avatars/**`, `public/arrival.js`, `logo.png`, `crown.svg` | Retained assets/provisioning/boot shell. Avatar meshes, textures and animation support remain required; arrival/branding language adapts with S04. |

`ws` was a direct dependency only for the archived preview transport and has been removed from both manifest and lockfile. The archive, tests and old board are excluded from Docker context; the final image copies only the current launcher script. Both development Vite configurations deny/ignore archived files. The production build uses the current entry and emits no legacy entry or archived source.

No blanket filename deletion or `.sovereign` move was used. The import-graph regression fails if a retained entry regains a retired dependency or loses a needed module.

## Records and configuration to preserve

Preserve `.sovereign` data, accepted characters and their IDs, old character/session/guide snapshots, historical transcripts, provider configuration, existing model provenance and deployment backups. `sovereign` remains a valid internal/storage identifier; renaming it is not a product requirement.

Removing a character from a channel is not deletion from the reusable library. Historical default Virus snapshots can remain readable without joining new shows or appearing as a compulsory guide. Existing appearances remain attributable to their original records.

Keep `WAVE_1_AUDIT.md` through `WAVE_6_AUDIT.md`, `CONVERSATION_REPAIR_AUDIT.md` and `SHOW_ROOMS_AUDIT.md` as historical evidence. The prior PRD and README are snapshotted under `archive/product/`. Their commands, feature promises, dates and completion counts are not current release acceptance.

## Completion

S01 is complete locally: the obsolete launch/import surface is closed, every identified outgoing module has a disposition, production inputs exclude the archived graph, the build succeeds and retained data readers pass. S02 adds its mounted, independently persisted studio foundation. [S01_S02_AUDIT.md](S01_S02_AUDIT.md) records verification.

S04/S09 still own visible guide/court replacement after a channel workspace/set exists. S12 owns final Room 1 release acceptance and hosted production contents. Completing S01/S02 does not claim that those later UI, physical-device, recording/export or release gates have passed.

## S04 follow-through

S04 now makes the channel studio the fresh entry. `src/session-main.ts` is a dispatcher; the former interactive session entry is preserved as `src/legacy-session-main.ts` for explicit historical links/compatibility journeys. The normal channel workspace has no Virus actor/bootstrap, mandatory guide lesson, sovereign/council navigation or global character/settings page. `src/studio-main.ts` and `src/studio-scene.ts` own the new room; shared rigs/assets and native surface primitives are reused. Full set/camera/gesture-onboarding work remains S09. Historical guides/transcripts retain their original attribution rather than being rewritten. See [S03_S04_AUDIT.md](S03_S04_AUDIT.md).
