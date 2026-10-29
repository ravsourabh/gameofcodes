# Studio foundation — S02

Implemented locally October 27, 2026. The session server mounts this service at `/api/studio/`; desktop/headset proxies forward it. S03/S04 add rich-character storage and the channel-room UI. These endpoints save production plans and accepted **data snapshots**; they do not yet record rendered video, generate a show or publish a stream.

## Layers and records

`shared/studio/` contains pure contracts, catalogues and validation. It makes no inference, speech, media, rendering, export or network calls. `server/studio-service.mjs` owns HTTP operations and receipts; `server/studio-store.mjs` owns guarded, atomic storage. Existing model/voice/renderer adapters remain separate consumers for later waves.

All records use schema version 1. Channel instances contain a creator-owned ID and a definition separate from the reusable template. RoomSet and Format registry entries are independently versioned. Episodes pin their channel definition and channel revision. CastAssignment, GuestAppearance, MediaSource, RundownBeat and PerformanceCue components carry their own versions inside the episode; character profiles and accepted takes have separate versions as well. Unknown component versions are rejected.

The catalogue registers Room 1 and future news/reality sets, format policies, screens, props, participant/judge anchors and the shared action vocabulary. Capability flags now enable persistence, rich profiles, reusable characters, premise capture and the channel workspace. Full production sets/format execution remain `planned`; performance, media playback/perception, recording, export and live output are false. The Room 1 UI uses a provisional desk/preview scene until its S09 set/direction wave.

## Storage and ownership

```
.sovereign/studio/v1/<profile-id>/channels/<channel-id>.json
.sovereign/studio/v1/<profile-id>/episodes/<episode-id>.json
.sovereign/studio/v1/<profile-id>/characters/<profile-id>.json
```

Profile, channel, episode, request and take IDs use UUID v4. Records cannot cross the requested profile namespace. The browser's existing profiles remain convenience boundaries, not authenticated accounts; this service does not add an account system.

Reads create no directories or default characters. Missing libraries return `null` through the studio reader. Casting resolves existing owned library IDs. No character is added automatically. Channel defaults hold regular/rotating cast assignments; guests are assigned per episode with an entrance and exit beat. Rich-profile creation/editing/search is S03, using the profile contract already present.

Storage checks each directory and record for redirection, refuses symlinks/junctions, validates versions/identities before use, and bounds each JSON record to 8 MB. Writes replace a temporary file atomically, using the retained Windows-lock retry helper. A failed replacement keeps the acknowledged file. A single service process serialises changes per record, as in the existing session service; do not run multiple independent writers against the same local store. Collections are bounded to 1,000 listed records, histories to 1,000 operations, episodes to 20 accepted takes/100 human responses, and HTTP bodies to 1 MB.

## HTTP routes

Except `catalog`, include `?profileId=<uuid>` on every route. Responses use JSON with no caching. Mutations require same-origin JSON requests; cross-site requests are rejected.

| Method and route | Operation/result |
| --- | --- |
| `GET /api/studio/catalog` | Templates, RoomSets, Formats, schema versions and truthful capability flags |
| `GET /api/studio/characters` | Read-only merged legacy/studio library view; `null` if absent |
| `POST /api/studio/characters` | Accept/create, update, recall or explicitly learn a fact using a durable library receipt |
| `GET /api/studio/character-context` | Approved context for `observerId`, `subjectId`, `channelId`; omits private/unlearned information |
| `GET /api/studio/legacy-sessions/:id` | Read-only original session plus compatibility projection; corrected brief preferred as the suggested premise |
| `GET /api/studio/channels` | Channel summaries and unavailable-record count |
| `POST /api/studio/channels` | Create `{id, requestId, templateId, definition?}`; omit `definition` to clone the registered template with the new ID |
| `GET /api/studio/channels/:id` | Complete owned channel record |
| `PATCH /api/studio/channels/:id` | `revise` with a complete `definition` |
| `POST /api/studio/channels/:id/cast` | Recall a character or accept-and-join a new person without duplicate identities |
| `POST /api/studio/channels/:id/premise` | Capture exact attributed words, or confirm the latest note |
| `GET /api/studio/episodes` | Episode summaries; optionally filter with `&channelId=<uuid>` |
| `POST /api/studio/episodes` | Create `{id, requestId, channelId, plan}` |
| `GET /api/studio/episodes/:id` | Complete episode including accepted takes and input history |
| `PATCH /api/studio/episodes/:id` | `revise`, `cancel`, `human-input` or `accept-take` |

Every PATCH contains `requestId`, `expectedRevision`, `expectedEpoch` and `operation`. Additional fields depend on the operation:

- `revise`: complete `definition` for a channel, or complete authored `plan` for an episode.
- `cancel`: no additional fields. Cancels future acceptance; accepted takes remain.
- `human-input`: `beatId`, `participantId`, `text`, `source: "human"`. Records explicit human input separately from authored/generated lines.
- `accept-take`: client-chosen `takeId`. Copies the current rundown, pinned channel, actual owned character/brain/voice identities, available rich profiles and current human answers into an immutable accepted snapshot.

Create responds 201; an exact acknowledged replay responds 200 with `replayed: true`. PATCH responds 200. Invalid contracts return 400, missing owned records 404, changed revisions/epochs or conflicting receipts 409, oversized requests 413 and unsupported content types 415. Unsupported/corrupt saved versions return 409 without changing the file; unavailable list entries are counted. Unexpected I/O failures are masked and leave saved data intact.

An episode `plan` contains `premise`, optional `formatId`, `writingMode`, `language`, `viewerMode`, `humanParticipant`, and `cast`, `media`, `beats`, `cues`. Channel defaults supply omitted cast on creation only. IDs and server-derived snapshots are not client-editable fields. Use `episodeInput()` from the shared package when adapting a complete saved plan, and omit its `id` in the HTTP plan body.

Writing mode (`scripted`, `hybrid`, `improvised`) is independent of viewer mode (`director`, `participant`) and language (`hi-IN`/`en-IN`, optional code switching). Channel/format policies constrain valid combinations. Human participants are separate from all library character IDs. Human-input beats contain no authored human answer, and acceptance waits for their actual responses. A revised episode opens a new epoch, so earlier answers remain historical and cannot satisfy its new participant turns.

## Revisions, cancellation and time

Each record has a monotonic revision and an ordered event for every acknowledged operation. Durable receipts bind a request ID to a canonical command signature. Exact retries survive restart and never append a second operation, character or take; reuse for another command conflicts. Revision and epoch comparisons occur under the same per-record lock as persistence.

Revising a channel or episode, or cancelling an episode, increments its epoch. Human input and acceptance require the current revision/epoch. A cancelled episode must be deliberately revised before acceptance. These tokens are the cancellation contract for later asynchronous adapters: capture both before work, stop on cancellation, and reject late commits against a changed token. No background inference/render job is started by this wave.

Accepted takes are append-only. Channel edits affect new episodes; existing episodes retain their pinned channel definition. Episode edits affect future takes; accepted snapshots retain their original channel/cast/script. Later character edits are captured only by later accepted takes. There is no silent propagation or write-on-read migration.

Performance time is integer milliseconds from episode-clock zero, excluding pauses once playback is implemented. `atMs` and `durationMs` define a half-open interval; adjacent intervals do not overlap. `beatId` associates a cue with its rundown segment and guest window; it does not reset the clock. Cue intervals stay within two hours, and incompatible lanes on the same actor cannot overlap. Order same-time events by rundown order, then their saved cue order; use record revision for durable command order. S07 implements the playback clock/scheduling adapter; S10 adds actual recorded takes and output assets.

## Compatibility

Original session/library JSON is validated and returned without being rewritten. The legacy view retains the complete source record, original character IDs, guide attribution, corrections, language and model provenance. It suggests the latest durable corrected topic before the original situation. It does not automatically import a court session, enrol its guide in a channel or copy historical discussion into another show's context.

Old coding/build records remain preserved in their original directories, with the former source archived under `archive/legacy-coding/`. They are never reinterpreted as studio episodes. Active session/library readers remain until the channel UI replaces their current consumers.

## S03 character authoring and context

The studio overlay stores accepted full character records, rich profiles, optional bounded WebP portraits, provenance, recent use, learned facts and request signatures. Legacy files remain byte-preserved. A merged library's revision is the legacy revision plus the studio revision; both component revisions are returned. Exact retries check their durable receipt before comparing the current revision. There is no write-on-read enrichment, auto-created guide, or automatic deletion when clearing a cast slot.

Character POST bodies contain `requestId`, `expectedRevision` (zero for an absent library), `action`, `id`, plus operation fields:

- `create` / `update`: `character` contains existing validated identity/appearance fields; `profile` contains the versioned rich profile; optional `assignment` contains independent brain/voice preferences. Optional `portrait` is a bounded WebP data URL. Profile revisions advance on accepted edits. `origin` identifies a creator or reviewed AI proposal; all accepted provenance is creator-approved. New or changed episode-origin canon additionally requires `approvedCanon: true` and an owned source episode. Ordinary edits preserve already approved memory without asking for approval again.
- `recall`: owned `channelId`; records recent use while retaining identity.
- `learn`: `observerId`, `subjectId`, `channelId`, `factId`; only approved public or matching-channel facts qualify. Private facts cannot be learned through this operation.

`character-context` returns another person's approved public introduction and public/explicitly learned channel canon. It excludes private canon and their internal motivations/stress/conflict notes. Own-role context includes the richer psychology. S06 inference adapters must use this context boundary rather than passing the producer's complete library to another actor. Creator-facing library reads intentionally retain their complete editable profiles.

Casting POST bodies use channel revision/epoch tokens plus `slotId` and either `characterId` with `libraryRevision`, or `create: {id, expectedRevision, character, profile, assignment?, portrait?, origin?}`. The same request ID binds both the new-person acceptance and the cast receipt. A library save followed by a failed channel replacement resumes the same person on retry. Guest appearances remain episode assignments with validated entrance/exit beats; they are not regular channel defaults.

## S04 premise and room workspace

The default client enters the channel directory and Meme Desk; future sets are visibly planned. Settings/casting/design are in the room. Historical links containing `session`/`project`, or the explicit `legacy-session=1` compatibility selector, load the separate historical UI.

Premise POST bodies use channel revision/epoch tokens and `operation: "capture" | "confirm"`, `noteId`. Capture additionally contains exact bounded `text` and `source: "written" | "spoken"`. A new capture supersedes the previous active note while retaining its text, attribution, status and timestamp. Confirmation references the current note without sending replacement text. Notes save even before a cast exists. The active setup is channel-level authoring context, separate from each pinned episode/take.

The client uses browser speech recognition only when available and explicitly activated. It reviews words before confirming and has Latin/Hindi headset keyboards and typed fallback; it makes no new paid transcription/inference request in this wave. Pause/navigation invalidate late recognition callbacks. Full provider speech delivery and real alignment remain S05.

Language/code-switch settings explicitly target either channel defaults for new episodes or the selected draft. Room casting changes channel defaults without silently changing earlier episode assignments. A selected old episode retains its premise; accepting a correction deliberately revises it. Source controls store pending references and rundown controls review saved beats; source playback/review and authored/AI writing are separate S08/S06 adapters.

## S05–S07 prepared production

- `GET voices`: model-specific Sarvam voice IDs and local aligner availability, without credentials.
- `POST channels/:id/produce`: channel tokens and optional `premise`/`source`. A delegated fictional starter and deterministic reusable cast can be accepted once. Partial/lost receipts recover the same IDs.
- `POST episodes/:id/production`: episode tokens plus `operation`. `start` supports writing `mode`, bounded `turnLimit` and `prepareOnly: true`. Default Room 1 preparation moves through `composing`, `voicing`, `ready`; it is separate from audience playback.
- `turn` calls the scheduled character's actual assigned model and commits one attributed contribution. `drafted` advances the saved conversation without playing speech. `voice` binds final audio/alignment to `turnId`; `ready` accepts the prepared timeline only after every selected line has audio, or with explicit `captions: true`.
- `pause`/`stop`, `resume`, `edit-line`, selected unlocked `regenerate` and validated `cue` controls retain history. Provider output is rejected after cancellation/epoch changes. Edits to an already performed line add an authored variant; other recordings remain available.
- `GET audio/:sha256`: owned final WAV plus matching lip metadata. Hash/profile checks reject inconsistent or redirected assets. Replaying/seeking never calls a reasoning or voice provider.
- `POST speech-preview`: owned `characterId`, language policy and request ID; fixed original audition text and the saved voice route.

Legacy experimental per-line `played` acknowledgements remain for compatibility/tests. The Room 1 client uses prepared production. This internal capability does not implement the future Live Desk or platform broadcast.

Speech uses pinned Rhubarb 1.14.0 phonetic recognition on final PCM WAV, with audio-position sampling and a real 15-viseme Rocketbox map. It is language-independent audio recognition, not transcript-forced alignment or a promise of perfect pronunciation. Captions are an explicit recovery choice. `setup:lips` installs the verified archive; Docker includes the Linux aligner and FFmpeg.

Accepted takes can pin a `productionSnapshot` with actual turn/voice/cue history. Video/camera export remains S09/S10.

## Standalone display screen

`StudioScreen` is a client-only media adapter. A local GIF or MP4/WebM and compatible direct HTTPS links render on a 16:9 surface instead of the fixed programme title. Local files use browser object URLs; GIF frames use the browser ImageDecoder, with an explicit unsupported-browser error. Replacing/clearing media releases the old decoder, video and object URL. Play/pause, restart, video seek/mute and aspect-fit rendering operate independently of episode production. Playing a clip does not write a MediaSource, transcribe/sample it or request inference. Local files are previews for this tab; durable media storage remains S08.

## S09/S10 media and output

`POST media?mime=...&name=...` accepts same-origin binary GIF/MP4/WebM up to 80 MB, validates decodability/dimensions/duration, and returns a content-addressed asset. `GET media/:hash/info` reads owned metadata; `GET media/:hash` streams it with byte-range support. Channel PATCH `operation: screen` assigns or clears a saved display asset. This is separate from model perception.

Episode PATCH `accept-take` can include `edition`; `sourceTakeId` derives a new immutable version from a saved director take. An edition stores source turn IDs in order, bounded trims, per-line camera choices and optional display media. Saved source audio and prior takes remain unchanged.

`POST exports` creates an idempotent owned job `{id, episodeId, takeId, format, subtitleMode}` for horizontal or vertical output. `subtitleMode` is `separate` or `burned-in`. Current Chrome/Edge render fixed 24 fps video and offline PCM audio in bounded 20-second chunks, uploaded to `POST exports/:id/chunks/:index`. `POST exports/:id/finish` validates that every chunk is present before converting the complete programme to H.264/AAC MP4. Matching chunk retries are idempotent; conflicting bytes are rejected. Finished chunks are removed after the MP4 and completion metadata are safely saved. The older `POST exports/:id/recording` WebM route remains a browser fallback. `GET exports` and `GET exports/:id` report progress. A server conversion interrupted by restart is recoverable through `POST exports/:id/retry`; a read does not silently reset it.

Completed jobs stream `GET exports/:id/video`, `/captions` (WebVTT), `/subtitles` (YouTube-compatible SRT) and `/manifest` (sanitised timing/provenance). There is no export-duration cap. Two server conversions may run at once; actual processing and storage capacity still apply. Keep the browser open while frames are rendered and uploaded. A cancelled/early recording retains its saved take rather than presenting a partial capture as the complete programme. `DELETE exports/:id` removes only that profile's selected export, including unfinished chunks, final video, captions and export metadata. It is idempotent and refuses deletion during active processing; saved episodes, takes, uploaded screen media and speech assets remain available. The UI labels this action **Delete from cloud** and asks for confirmation.

When conversion completes, the UI starts `GET exports/:id/download` as an MP4 attachment. This route requires a same-origin request and removes that export's cloud files after the entire response and file stream complete. Interrupted transfers retain the files for another download; preview ranges through `/video` never delete them. If the browser blocks automatic downloads, the manual download link remains available. The saved take can still generate a separate `.srt` download after the cloud export is gone.


## Shared AI director

`GET /api/studio/orchestration/capabilities` returns the authoritative command and core-action catalogue. `POST /api/studio/channels/:channelId/orchestrate?profileId=:profileId` accepts `requestId`, `expectedRevision`, `expectedEpoch`, `text` and, when directing an episode, `episodeId`, `episodeRevision`, `episodeEpoch`. Optional `playback: {playing, positionMs, screenPlaying}` supplies bounded client playback state.

The channel definition's optional `orchestrationBrain: {provider, model}` chooses the director independently of cast models. A null/missing selection disables AI direction; it never silently falls back to another model. Settings uses the same provider/search/model selector as character settings.

The result contains a saved, model-attributed `direction` with a summary and up to four commands: `prepare`, `resume`, `pause`, `replay`, `shot`, `reaction`, `screen-play`, `screen-pause`. Commands use registered camera/action IDs and actual cast IDs. The browser executes these through the existing controls. Private character canon and credentials are never sent to the director. Unknown actions and stale results are rejected. Last 20 director receipts are retained on the channel; replaying the same request does not call the model again. This gateway does not publish, browse media, run arbitrary code, or change character identities.

## Sarvam catalogue and opening coverage

The bundled public catalogue is pinned in `shared/studio/sarvam-catalog.json` from Sarvam's official MCP repository (2026-10-27): 222 V4 personas and 37 V3 voices. Voice selection filters for the current supported episode language; All languages displays the full list and disables incompatible choices. Existing assignments and audio hashes retain their original semantics.

Automatic opening coverage uses the saved recording clock for a fly-in followed by camera two and a host body/gaze turn. It is shared by preview and both export ratios. Manual camera choices and reduced-motion preferences bypass the fly-in; the headset camera is never animated.

## Dialogue writer and performance director

Cast-led shows started with `adaptive: true` use a shared dialogue writer. Its model is selected by `channel.definition.writingBrain`, falling back to the host's assigned brain. The writer receives each character's saved personality, speech style, psychology, backstory and permitted facts; it does not replace character records, voice assignments or canon. Private canon is excluded from the shared writing packet.

The writer returns a complete, variable-length scene. Character IDs, introductions, question/addressee order, cast participation, line limits and the closing payoff are validated before the plan is saved. Optional personal detours are seeded once per run; generated low-stakes character colour is stable per character ID, and authored characterisation takes priority.

The performance director uses `orchestrationBrain`, falling back to the writer model. It receives the written dialogue and public cast identities, and can choose supported shots and brief reactions. Its schema cannot replace dialogue. If automatic AI staging is unavailable, saved dialogue remains usable with automatic staging. Manual directions use the same director selection and validated common command gateway.

`GET /api/studio/episodes/:id/production?profileId=...` reports the owned in-flight writing/staging phase. Completed or idle progress responses can return the owned episode so a returning client can recover its current revision. A completed writer plan is checkpointed before staging, so pausing during staging retains the script. Replays and speech preparation reuse the saved scene rather than calling the writer again.

`POST` to the same production route with `operation: "continue"` writes a continuation of a finished cast-led segment, preserving previous dialogue, audio, takes and the run ID. The director gateway also exposes the `continue` command for explicit requests for more dialogue. Scripts and human-input beats keep their existing boundaries.

Settings presents separate Dialogue writer and Performance director controls. Cast changes remain separate from saved episode snapshots; Use updated cast prepares a new version without replacing earlier episodes. The room displays four physical seats, including unoccupied places.

Scene turns can use `detached: true`. The production endpoint returns HTTP 202 with the request ID immediately; the client polls the owned progress endpoint with `requestId` until the saved contribution is ready. This avoids keeping a model request open through a reverse proxy. Repeating the same background request does not launch a second model call; conflicting reuse of a request ID is rejected. Pause still cancels the model task, and a returning browser can attach to a task already running. Completed scripts remain checkpointed before director staging.

## Optional MetaHuman appearance

`GET /api/studio/avatar-renderers` returns the installed, inspected MetaHuman
catalogue, per-model readiness/reason and an `available` flag. It never fetches
remote character URLs. The default catalogue is empty.

Channel `definition.avatarRendering` is optional:

```json
{
  "metaHuman": true,
  "assignments": [{"characterId": "<owned UUID>", "modelId": "epic-sample-v1"}]
}
```

The normal revision/receipt PATCH applies. Enabling/selecting requires a ready
installed asset and owned character IDs; disabling remains possible when an
asset is missing. Other channel edits and reads preserve prior choices. This
does not edit character appearance, personality, voice or AI assignments. New
takes snapshot the current rendering preference; derived editions inherit the
source take's preference, and legacy takes retain the original avatars.
See [asset import and acceptance](METAHUMAN_INTEGRATION.md).
