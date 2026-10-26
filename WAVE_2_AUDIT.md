# Wave 2 implementation audit

Date: October 26, 2026 · Release target: November 18, 2026 (Asia/Calcutta)

Status: Implemented and verified locally. Physical Quest performance and public deployment remain unverified.

## Delivered experience

Virus appears as a selectable animated character before a session or cast is required. His identity is created once in each profile's saved character library. A user can customise him or choose a saved character as the default guide for future sessions. Existing sessions retain their guide snapshots.

The default room entry now shows a compact session summary; the large title/situation form is available through **Session details**. **Characters** opens an optional drawer alongside the actual 3D preview. This is the character foundation for assistant-led entry. It does not implement conversation or claim to have completed the five/ten-minute introduction.

The workshop supports:

- Seeded random generation and explicit face, skin, hair, hair colour, beard, clothes, clothing colour and accessory choices.
- Individual rerolls and rerolling all unlocked attributes; kept attributes remain unchanged.
- Name, personality and guiding-code editing, saved voice-style/pace preferences, reload and reuse.
- Up to five active participants alongside a separate guide, session-role changes and removal from a session without deleting the saved identity.
- Stable identity snapshots: later library edits do not rewrite an existing session. Reuse in another session starts with no prior contributions, position or scenario notes.
- Primitive-based modular avatars with breathing, blink, gaze and selection feedback. Reduced-motion preferences limit body movement. Geometry, materials and label textures are disposed when a representation is replaced or removed.

Quest's native hand ray can select an avatar and operate the in-world character panel: generate, reroll, cycle, save and add/remove. Leaving VR preserves an unfinished character edit and opens it in the desktop drawer. Detailed attribute, name and role editing currently uses that drawer. The complete hands-only text-input journey remains W10 work.

## Domain and storage

`shared/character-domain.mjs` defines the appearance catalogue, deterministic generation/rerolls, editable-field validation, library validation and guide progress. `src/session-avatar.ts` renders identity data without tying appearance to a role, position or model. `src/character-workshop.ts` coordinates the optional editor with the library and session services.

`server/character-library.mjs` stores `.sovereign/characters/v1/<profile-id>/library.json`. The library has its own schema, revision and request ledger. Writes serialize per profile and use atomic replacement. Expected revisions reject competing changes; request IDs permit safe retries after a lost acknowledgement or service restart. Libraries are bounded to 100 characters, 1,000 changes and 8 MB. API request bodies remain bounded to 32 KB. These prototype storage bounds will need reassessment for long-term use.

`GET /api/characters?profileId=<uuid>` loads a profile's library and bootstraps Virus only when no library exists. `POST` accepts create, update and default-guide selection with a request ID and expected revision. It accepts cosmetic/description/preference fields; scenario context, roles and model controls cannot be embedded as editable identity fields. Unsupported appearance fields are rejected as well. New capabilities report characters/guide available, while voice, model routing and live sessions remain disabled.

Session `PATCH` now accepts a draft-only roster action. It resolves identities from the matching saved library, preserves participant IDs and snapshots, checks the active-cast limit and guide separation, and advances the session epoch. Removal deactivates a participant rather than erasing history or library data. A session's guiding-code override remains separate from the saved character's default code.

Old Wave 1 records without a guidance envelope remain readable without modifying their files. A real roster mutation can then attach the current guide. Corrupt/future-version records and storage junction conflicts are reported and preserved. Profile IDs are convenience boundaries, not authentication.

## Introduction foundation and remaining dependencies

Guide progress belongs to the profile and tutorial version; all eight lesson states start pending. Each new session stores its guide snapshot, an empty notes list and a null active lesson. Selecting Virus, waiting or generating a character does not complete a lesson.

W03 must supply actual listening, speech, captions, interruption and verified model assignments. Stored voice styles are preferences, not connected voices or audio previews. W04 must implement acknowledged note capture/readback/correction, conversational setup, autosave and action-based introduction progression. The core journey teaches real selection, input and interruption within five minutes, with optional deeper lessons through ten; W10 validates the finished journey with both modes and hands-only alternatives.

The presenter queue remains W07 work. Only the guide, active cast or editor preview is instantiated; the modular representation is reusable for later presenters without creating a background crowd now. Final court/council staging and measured headset rendering budgets remain W06/W08/W11 work.

## Verification

- All 38 unit/service tests pass, including nine character tests for seeded appearances, locks, stable/scoped guide creation, saved edits, idempotency/revisions/restart, identity boundaries, cast limits, snapshot/reuse separation, older draft compatibility and preserved corrupt/future/junction data.
- All ten development browser tests pass. They exercise real session/library services for editor persistence, kept attributes, role changes/removal/reuse, explicit discard, lost-response retry, profile separation and existing session recovery.
- Six selected browser checks pass against the built production client: editor persistence, role/removal/reuse, discard/lost-response recovery, the expanded native character journey, session save/reload with retired/private routes blocked, and native room selection/save/exit.
- TypeScript checking and the production Vite build pass with bundled Node 24.19.0. The client bundle still exceeds Vite's 500 kB warning threshold; this is not measured headset performance.
- Desktop guide, cast and editor screenshots were visually inspected. The editor leaves the avatar preview visible beside its optional drawer.
- HTTPS IWER Quest 3 emulation verifies native hand selection. The built-client checks also exercise generating/rerolling/saving/adding a character through the in-world panel and preserving an unfinished edit on VR exit.
- No new model, speech or credential operation is performed. Retired preview/court services remain absent from the default runtime.

During Wave 2 verification, the HTTPS Vite dependency cache was found under the private `.sovereign` path, where the private-storage middleware blocked it. The cache now uses ignored `node_modules/.vite-headset`; private storage remains inaccessible over static routes. HTTPS WebXR checks are rerun against both development and built clients.

Development and emulation do not establish physical tracking quality, comfort, frame rate, microphone behaviour or public hosting. No Docker build is claimed: the local Docker engine was unavailable during the foundation audit. The next implementation wave is W03.
