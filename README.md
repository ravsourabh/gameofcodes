# Game of Codes · Channel Studio

An AI ensemble studio for creating shows from written or narrated premises. The current product direction and scope are in [PRD.md](PRD.md); implementation steps and exit checks are in [DELIVERY_WAVES.md](DELIVERY_WAVES.md).

## Current priority: Room 1

Build the **Very Serious Meme Desk** first: a fictional Hindi/Hinglish satire newsroom with an original, composed vintage radio-style host, reusable panellists/guests, an in-room media screen, directed performance, retakes and video export. Settings, casting and character design belong inside the channel room. The new entry removes the mandatory Virus guide and sovereign/council journey.

Shared contracts cover future news/comedy/reality channels and first-person Participant mode with hosts/judges from the start. Their complete environments and experiences follow Room 1. Character identities are saved for reuse; behaviour, psychology as fictional characterisation, likes/dislikes, backstory and visible canon are versioned and snapshotted per episode.

## Implementation status

Fresh visits now open the channel studio and Room 1 workspace. Cast selection/design, rich character profiles, brain/voice preferences, channel/episode language, written or browser-narrated premise review, corrections, saved episodes and source/rundown controls belong inside the room. Realistic previews support desktop interaction and native headset ray/pinch/keyboards. No guide is automatically created or shown. Old session/project links retain the earlier UI through a separate compatibility entry.

S01–S04 are complete locally. S05–S07 now have the local speech, prepared-conversation and core-performance implementation; see [S05_S07_AUDIT.md](S05_S07_AUDIT.md) and the [earlier audit](S03_S04_AUDIT.md) and [studio API](STUDIO_API.md). Accepted characters save once and remain reusable after leaving a cast. Rich profiles include behaviour, psychology, likes/dislikes, backstory and scoped canon; creator-approved presets are fictional and editable. The studio layer enriches old characters without rewriting their original library. Exact receipts recover lost/partial joins without duplicates, and accepted take data snapshots remain immutable.

Room 1 prepares the conversation before voices or playback. Scripts are optional; a delegated starter can save a cast and fictional premise. Each assigned model receives actual prior contributions and the corrected premise. Authored lines lock; selected edits retain other lines and cached recordings. V4 Flash model/persona pairs are available for new casts, with explicit V3 selection and preserved old assignments. Final WAV audio drives a local phonetic mouth track; pause and seek use the recording clock. Core procedural gestures and reactions have per-rig bindings, with remaining actions visibly pending. The fixed title board is replaced by a standalone GIF/video preview screen, without automatic AI ingestion. Room media uploads now persist without AI ingestion. The studio adds directed cameras, saved take editions, line trims/reordering/shot revisions, and horizontal/vertical MP4 recording with captions. Optional media understanding, full action coverage, physical headset acceptance and the separate future Live Desk remain later work. See [S09_S10_S12_AUDIT.md](S09_S10_S12_AUDIT.md).

S01–S12 focus on Room 1, with an initial recorded pilot at S10. S13–S15 complete additional rooms, Participant mode and live publication. Historical audit counts describe reused foundation tests rather than acceptance of these new experiences.

The current Room 1 app is at [app.gameofcodes.si](https://app.gameofcodes.si), password-protected according to the creator. S09/S10 and the technical S12 pilot are implemented; full S11 animation coverage, physical headset acceptance and human audience/comedy review remain open. The [hosted audit](S09_S10_S12_AUDIT.md) records historical deployment evidence, six real-provider pilots, actual video exports and saved-data preservation.

Recorded YouTube, Shorts and Instagram publishing is planned in [PUBLISHING_WAVES.md](PUBLISHING_WAVES.md), with channel/account setup, asset creation, creator instructions and P01–P10 acceptance gates. This is an approval-driven distribution track, separate from future interactive livestreaming; the plan does not claim existing publishing integrations.

The [P01 publishing kit](publishing/baat-ka-bawaal/v1/index.html) prepares the creator-confirmed Baat Ka Bawaal channel, with Game of Codes Production as publisher and Chhola Bhatura as the featured host. It contains local artwork previews, editable templates, original-rig cutouts, audio/intro/outro assets, copy and source notices. Account connections and publishing remain later waves; final artwork acceptance is pending review.

P02 now adds **Settings → Publishing** locally, with protected YouTube/Instagram connections and private setup. Start with [creating your social accounts](P02_SETUP.md); no accounts or live grants have been created for you. The [P02 audit](P02_AUDIT.md) records local verification and outstanding DNS/gateway/provider gates. Full publishing and scheduling remain P03–P09.

## AI director, voices and opening cameras

Choose the shared **AI director** under **Settings** using the same provider/search/model selector as each character's **AI** tab. **Direct the show** accepts directions for playback, cameras, supported reactions and the existing room screen. Character dialogue models stay independent. The gateway advertises its available commands at `/api/studio/orchestration/capabilities` and rejects unsupported or stale plans; receipts recover a lost response without another inference request. See [STUDIO_API.md](STUDIO_API.md).

The **Voice** tab exposes 222 Sarvam V4 personas and 37 V3 voices from the pinned official catalogue. The default Hindi/Hinglish filter shows 129 choices; expand **Find a voice** to search and filter by style or display all languages. Existing saved voices and recordings are preserved.

With cameras on **Auto**, show playback starts with a deterministic fly-in, then cuts to a second camera as the host turns toward it. Preview and exported video share the recording clock. Manual camera choices and reduced motion bypass the fly-in; headset view stays under the user's control.

## Episode approval and deletion

The desktop workspace keeps the stage beside a dedicated controls column.
**Watch mode** expands the stage; **Show controls** returns to the workspace.
Playback keeps its main actions visible, with **Direct the performance** and
**Script & versions** opening the less frequent tools.

**Takes** separates **Versions** (review and story approval), **Edit** (dialogue
order, audio trims and camera shots), and **Export** (horizontal/vertical video
and subtitle choices). **Episodes** supports search and approval filtering.
**Settings** groups the writer, independent reviewer and director as the AI
team, with language, sound, audience and workspace settings below.

In **Episodes**, choose **Review & approve** to open an episode's saved versions.
Save a take if needed, select the version you want, then choose **Approve this
version**. Approval is a creator decision separate from the AI review and does
not publish a video. Only that saved edit supplies recent-show history to future
writing. New versions remain unapproved until selected explicitly; older shows
are also unapproved until you choose them.

**Withdraw approval**, **Delete version**, and **Delete episode** remove the
corresponding material from future story context. Deleting an approved version
does not approve another automatically. Episode-derived character facts must
identify the same approved source version; creator-authored characterisation is
kept. Deletion is logical: hidden records remain internally for durable retries
and version provenance, while shared cast, voices and media are preserved.

## Run

Requires **Node.js 22.13+ or Node 24** (including PDF text extraction).

```powershell
npm install
npm run setup:lips
npm run dev
```

Final-audio alignment uses the pinned Rhubarb 1.14.0 phonetic recognizer; FFmpeg must be available for non-WAV provider recordings. The Docker build installs these dependencies. `npm run setup:lips` installs the local aligner without touching credentials.

Open **http://localhost:5173/** on this computer. For Quest, open the printed **HTTPS Network URL on port 5443** in Quest Browser on the same Wi-Fi, enable hand tracking, and select **Enter VR**. The development certificate may need to be accepted or replaced by a trusted development certificate. No controller or model connection is needed for the room/character-selection and save paths.

The session service binds to loopback on port **4176**. Vite proxies `/api` to it from the desktop and headset endpoints. Ports 4174/4175 and `/api/court/*` are not part of the default session runtime.

## AI configuration

Put server keys in ignored **`.env.local`**, following `.env.example`, then restart `npm run dev`. One of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` enables that provider's model catalogue. OpenAI also supplies cloud speech/transcription. `SARVAM_API_KEY` enables Hindi speech through [Sarvam's REST API](https://docs.sarvam.ai/api-reference/text-to-speech/convert), using the documented Bulbul v3 model/speaker pairing and WAV output. A missing or failed Sarvam route leaves a visible recovery path and captions. `ELEVENLABS_API_KEY` is optional and needs voice-catalogue read and speech access. If its key lacks `voices_read`, the app reports the restriction; OpenAI/device voices remain separate choices. Never use a `VITE_` prefix for secrets. Local environment files are excluded from Git and Docker build context.

Catalogues establish listed choices, not guaranteed inference access for every model. Requests can still fail because of model access, permissions or usage balance; the user explicitly chooses a replacement. The current session runtime supports cloud model calls. The old local CLI coding adapters are archived and are not offered as connected choices.

## Saved sessions and compatibility

- New data: `.sovereign/sessions/v1/<profile-id>/<session-id>.json`.
- Studio channels/episodes: `.sovereign/studio/v1/<profile-id>/{channels,episodes}/<id>.json`. Accepted take snapshots live atomically with their episode. The studio UI uses these records independently of old session storage.
- Studio character overlays: `.sovereign/studio/v1/<profile-id>/characters/<profile-id>.json`. New accepted characters, rich-profile revisions, portraits, recent use, learned canon and durable receipts live here. Legacy source libraries are unchanged by enrichment.
- Character library and tutorial progress: `.sovereign/characters/v1/<profile-id>/library.json`. Guide snapshots, attributed notes, reviewed excerpts, proposal/model provenance, confirmations and setup step live with the session. Older drafts remain readable without a write-time migration on load.
- Browser profile selection: `goc-session-profiles-v1` in local storage. Existing profile names/IDs can be reused without copying their old project context.
- Session links use `?session=<uuid>`. Select the matching browser profile. Old `?project=` links are identified rather than reinterpreted as new sessions.
- Saves use request IDs, revision checks, a monotonic event sequence, atomic file replacement, and cancellation epochs. Retries do not duplicate changes; conflicting revisions ask the user to reload the saved version.
- Character exchanges and actual model provenance are session-scoped. Assignments and deliberate **Use this look** changes preserve roles, positions and previous replies. Library edits do not rewrite other sessions.
- Unknown schema versions, inconsistent records, and storage junction conflicts are reported without resetting or overwriting the saved record.
- Profiles are convenience boundaries, not authenticated accounts. The current hosting/access boundaries are unchanged; account-system redesign is outside the agreed release scope.

## Verify and build

Install the test browser once:

```powershell
npm run setup:browser
```

Then run:

```powershell
npm run test:unit
npm test
npm run build
npm start
```

Unit/service coverage includes schemas, appearances/kept attributes, cast limits, identity/role/brain separation, actual-model provenance, cancellation/late-result rejection, request budgets, idempotency, profile scoping and restart. Browser tests use explicit AI transport fixtures while retaining real character/session persistence; they exercise direct feature selection, one-action joining, temporary previews, retry and emulated Quest controls/keyboard. Separate bounded live checks verify actual model calls and audio. Emulation does not establish physical headset comfort or frame rate.

`npm start` serves the built client with the same desktop HTTP and headset HTTPS endpoints. Docker includes the shared session domain and does not install or start Chromium for the default runtime.

For isolated browser verification, set `GOC_TEST_PORT` to an unused port before running Playwright. The test launcher uses separate desktop, headset and API ports rather than restarting another running app. The launcher also accepts `GOC_HTTP_PORT`, `GOC_HTTPS_PORT` and `GOC_API_PORT`; their defaults are unchanged. Restart an existing local application process to load the new server routes. The wave implementation does not restart another thread's app or deploy production.

## Historical implementation and retired launchers

The old coding-preview entry and its npm launch aliases are retired. `scripts/dev.mjs --legacy` fails before starting a service. Its unused source, tools, fixtures and assets are retained in [the historical archive](archive/legacy-coding/README.md), denied by the development file server and excluded from Docker. The [retirement inventory](RETIREMENT_PLAN.md) identifies reused modules and the visible guide/court replacement still due in S04/S09. Existing saved work and character IDs remain preserved.

W01–W06, [the conversation repair audit](CONVERSATION_REPAIR_AUDIT.md), and [the show-room audit](SHOW_ROOMS_AUDIT.md) describe the earlier prototype and its follow-ups. Their completion claims do not mean the new studio release is complete. The former [PRD](archive/product/PRD-discussion-rehearsal-2026-10-27.md) and [prototype README](archive/product/README-prototype-2026-10-27.md) are retained as history.

## Make a recorded show

Prepare the cast conversation and voices, open **Takes**, and save the current take. Select a line to trim, reorder or change its shot; **Save new version** preserves the original for undo. **Preview take** uses the cached recordings. Choose **Horizontal video** or **Vertical video** to record the saved take, then use **Exports** to refresh processing, preview/download MP4 or captions, and retry an interrupted server conversion. Recording is a desktop operation; headset head control remains independent. Pause during recording stops it early and keeps the take so it can be recorded again. Room **Practice** offers skippable five/ten-minute action-based introductions, not a forced timer.

New storage includes profile-owned `media/` and `exports/` below `.sovereign/studio/v1/`. Export manifests retain internal take snapshots; public manifests omit psychology, private canon and credentials. The cloud runtime keeps the lip aligner in `/opt/rhubarb`, outside the persistent data volume. Immutable release deployments use `scripts/deploy-studio-release.sh`, the existing private environment and named data volume, a full data backup, exact release verification and image rollback.

### Production renderer and private access

The studio uses the Microsoft/Rocketbox browser renderer. The experimental
MetaHuman renderer, import tools, settings and project assets have been removed.
Legacy saved rendering fields remain readable without changing stored episodes.

Production runs at **https://app.gameofcodes.si** behind the private studio
password gate. Docker binds the studio port to server loopback; only the gateway
can reach it. Publishing setup is available in Settings, together with the
channel asset kit. Account creation and OAuth configuration are still required;
automatic uploads and scheduling are later publishing waves.

`node scripts/prepare-studio-release.mjs` builds and checks an explicitly scoped
runtime archive in `.sovereign/releases/`. The archive excludes private storage,
credentials and authoring experiments. Deploy it with the immutable release
script and verify its exact release identity before considering it live.
