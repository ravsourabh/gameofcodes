# S01/S02 local completion evidence

October 27, 2026 · Windows · Node 24. Both waves are complete for their stated foundation scope. This is local work; no commit, push, deployment, physical-headset acceptance or completed video output is asserted.

## S01 — retirement

- Traced default client/server/launcher imports, literal dynamic imports and Workers, styles, tests and asset references. Every identified outgoing module has a named disposition in [RETIREMENT_PLAN.md](RETIREMENT_PLAN.md).
- Archived the unused coding/preview source, CLI/speech helpers, old board/provider icons and their historical tests. Retained current scene rigs/assets, XR interaction, session/library readers, correction/discussion logic, speech/provider adapters and atomic-save regressions.
- Removed legacy launch aliases, entry replacement, preview proxy and direct `ws` dependency. `--legacy` rejects before opening a service. The current entry graph resolves without any archived module.
- Denied archive access through both development configurations, excluded it from Docker inputs, and limited production script copying to the active launcher. The current entry builds after source retirement.
- Left saved records, IDs, credentials, historical audits and provider configuration in place. Current library/session readers remain active. Studio compatibility tests verify unchanged session/library bytes, and existing session tests preserve old coding records.

## S02 — studio domain and storage

- Added independently versioned channel/set/format/profile/episode contracts and nested cast, guest, media, beat and cue records. Catalogue status distinguishes planned rooms/features from functioning persistence.
- Mounted [the studio API](STUDIO_API.md) alongside the current session service. Channels and episodes save separately beneath `.sovereign/studio/v1/<profile>/`, with atomic replacement, serial writes, durable request receipts, revisions and cancellation epochs.
- Channels have independent language/format/cast defaults. Episodes pin a channel snapshot; cast assignments resolve owned reusable identities. Guests have explicit bounded appearance windows. No guide is auto-enrolled.
- Accepted takes retain immutable plan/channel/character/model/voice snapshots. Later edits affect later work; existing accepted takes remain unchanged. These are accepted data snapshots; recording/rendered takes are S10.
- Participant mode uses an identity separate from AI characters, explicit human-input beats, and actual separately submitted answers. Invented human script text is rejected and snapshot acceptance waits for the human.
- Added non-initialising character reads and complete read-only historical session views. Missing studio libraries return `null` without folders, Virus creation or migration writes.
- Documented endpoint bodies, error/retry semantics, event ordering, epoch cancellation and the future playback clock. Pure domain logic remains separate from inference, speech, media, rendering and export.

## Verification

| Check | Result |
| --- | --- |
| `npm run test:unit` | **90 passed, 0 failed** across retained current regressions and studio/retirement checks |
| Studio HTTP integration | Two channels/episodes survive restart independently; cast defaults, owned IDs, receipt replay, revision/epoch conflicts, immutable takes, human-input gating, same-origin/body limits, corrupt/future records, replacement failure and junction rejection pass |
| Existing-data preservation | Original library/session bytes unchanged by studio reads; fresh profile reads create no library/studio folders; other-profile legacy reads return 404 |
| Browser discussion regressions | **3 passed**: referenced multi-character turns and direction, interruption rejects late output, seated desktop camera/short viewport remains usable |
| `npm run build` | TypeScript and production Vite build pass; existing large-bundle advisory remains |
| Studio declaration check | Standalone strict declaration compilation passes |
| Retirement checks | Active import graph resolves without archived coding modules; retired launcher fails before services start |

The previous 94-test count belongs to the earlier mixed current/coding test command. Coding-only tests are archived with their implementation; the new active suite has 90 tests. No retained current-domain regression was dropped to obtain this result. Browser checks use explicit fixture inference and isolated temporary persistence, with no paid provider calls.

## Remaining waves

S03 owns saved rich-profile editing/creation/recall. S04 owns the channel workspace and visible Virus/global-settings removal. S05–S12 complete the voice/performance/media/set/recording/release journey for Room 1. Future sets/participant anchors exist as contracts; their actual environments and live broadcasting remain later work. See [DELIVERY_WAVES.md](DELIVERY_WAVES.md).
