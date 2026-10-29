# Recorded publishing delivery waves

Updated October 30, 2026 · Asia/Calcutta. P01 identity is confirmed and its 48-output local asset kit is prepared and technically verified; final artwork acceptance is pending. See [P01_AUDIT.md](P01_AUDIT.md). P02 connection code/UI and secure setup are verified locally; accounts, DNS/gateway configuration and live-provider acceptance remain open. See [P02_AUDIT.md](P02_AUDIT.md) and [account creation/setup steps](P02_SETUP.md). P03–P10 remain planned; automated episode publishing/scheduling is not implemented.

Build an approval-driven distribution system for बात का बवाल (Baat Ka Bawaal). The creator reviews a finished episode, thumbnail, metadata, complete comedy clips and release calendar, then approves that exact package. Background workers upload the full episode to YouTube and release the approved clips to YouTube Shorts and Instagram Reels. Approval does not permit subsequent AI rewrites or additional posts.

The studio address is **https://app.gameofcodes.si**, password-protected according to the creator. Use this origin for new configuration and OAuth callbacks. Existing audit URLs remain historical evidence. Recorded distribution is independent of S15 live broadcasting, native Unreal/MetaHuman and additional rooms. Optional media understanding remains S16, last/future; clip selection initially uses our saved scripts, speech timings and performance cues.

## Execution order

| Wave | Deliverable | Dependencies | Creator involvement |
| --- | --- | --- | --- |
| P01 | Channel identity and reusable publishing assets | Existing Room 1 branding | Choose channel identity; approve asset kit |
| P02 | Accounts, API applications and secure connections | P01 identity; can run alongside asset production | Create/select accounts and authorize access |
| P03 | Background rendering, durable jobs, storage and approval records | Existing take/export pipeline | Choose temporary storage and spending policy |
| P04 | Episode publishing package and approval interface | P01, P03 | Review video, thumbnail, metadata and schedule |
| P05 | Full-episode YouTube upload and scheduled release | P02–P04 | Approve first test package and release |
| P06 | Comedy-aware clip selection and vertical rendering | P03, P04 | Review initial clip quality and exclusions |
| P07 | YouTube Shorts and persistent release calendar | P05, P06 | Choose interval, posting windows and timezone |
| P08 | Instagram Reels publishing | P02, P06, P07 scheduler | Authorize professional account; approve first Reel |
| P09 | Recovery, cleanup and supervised launch | P05, P07, P08 | Approve pilot calendar; inspect published results |
| P10 | Performance reporting and suggestions | P09; platform analytics access | Review results and approve changes to future defaults |

P01 and P02 preparation can overlap. Build P03 before claiming unattended operation. P05 is the first useful YouTube-only milestone; Instagram approval must not block it. Complete P06–P09 for the full requested workflow. P10 is a later improvement, not a prerequisite for publishing.

Track implemented code, local verification, real-provider verification and creator acceptance separately. No commits or public posts are authorized merely by adding this plan.

## P01 Channel identity and asset kit

**Identity decision, October 30:** the creator selected a **Baat Ka Bawaal channel** and specified the exact publisher credit **Game of Codes Production**. The [local kit](publishing/baat-ka-bawaal/v1/index.html) includes editable sources, downloads, copy and provenance. Visual acceptance remains separate from this identity decision.

**Build and create**

1. Establish a versioned publishing brand profile: public show name, publisher name, language, short description, contact address, social links and default credits. Suggested starting identity: show/channel “बात का बवाल / Baat Ka Bawaal”, with “Game of Codes” as publisher; the creator chooses the final account structure.
2. Reuse and adapt `public/branding/baat-ka-bawaal/logo.png`, `banner.png` and `desk-led.png`. Create profile-safe and small-screen variants rather than assuming the wide desk image suits every surface.
3. Produce the asset kit below, retain editable sources and record fonts, provenance and allowed uses. Check Hindi text visually; preserve original fictional character identities.
4. Prepare Hindi/Hinglish channel bio, About text, contact/link copy, fictional-satire description and episode description/credit templates. Inventory music, fonts, reactions and third-party screen media for the intended platforms; replace unsupported assets before packaging.

| Asset | Proposed design target | Use |
| --- | --- | --- |
| Profile logo | 800 × 800 master with circular-crop preview | YouTube and Instagram identity |
| Channel banner | 2560 × 1440 master with platform safe-area previews | YouTube channel |
| Full-episode thumbnail template | 1280 × 720; short readable Hindi hook | Per-episode YouTube thumbnail |
| Vertical cover template | 1080 × 1920; feed/profile crop previews | Reel cover and short-video opening frame |
| Cast cutouts and expression stills | Transparent originals from supported characters | Thumbnails and episode artwork |
| Caption and lower-third templates | Landscape and portrait; UI safe margins | Full video and clips |
| Intro, outro and audio package | Short branded sting, ending card, balanced music and credits | Consistent publishing output |

These are production targets, not a promise that every platform accepts every field or custom cover. Validate current upload specifications during implementation. Reuse the current news theme only with its required credit, and carry attribution into each derivative clip where applicable.

**Your steps:** choose a dedicated show channel or an umbrella Game of Codes channel; confirm preferred Hindi/English display names and handles; approve the logo/banner/template previews. Handle availability has not been checked.

**Exit check:** asset previews remain legible on desktop and phone crops; the creator accepts the kit and every included asset has a recorded source/use decision.

## P02 Accounts and secure publishing connections

**Local implementation, October 30:** Settings → Publishing, owner/gateway/session/CSRF controls, encrypted OAuth state/tokens, provider lifecycle and an explicitly confirmed private YouTube smoke upload are implemented. The creator has not created either social account yet. [P02_SETUP.md](P02_SETUP.md) starts with account creation and includes exact callback URLs and private configuration steps. Real grants and upload/processing acceptance are pending; the intended app subdomain also failed DNS lookup from both tested hosts. The [audit](P02_AUDIT.md) distinguishes 32 passing local checks from those external gates. No production credential or gateway change has been made.

**Build**

1. Add Settings → Publishing → Connections for YouTube, Instagram and private temporary storage. Display actual connected channel/account IDs, names, granted permissions and reconnect state.
2. Implement server-side OAuth, validated state, owner-bound connection records, encrypted tokens, refresh/reconnect handling and disconnect/revocation. Store secrets outside source control, browser storage and logs.
3. Configure callbacks under `app.gameofcodes.si`. Verify the password gateway permits the chosen OAuth flow. Any callback exception is restricted to the exact route and still validates state; no general `/api` or studio bypass.
4. Record the Google/Meta application mode and applicable account, permission or review requirements. Test actual upload/publishing eligibility; catalogue access or successful login alone is not evidence. Request analytics access later if P10 needs it.

**Your steps**

1. Create or select the YouTube channel in your Google account. Confirm its exact channel ID and handle, and enable the channel features needed for the proposed full-video length and custom thumbnails.
2. Create/select a Google Cloud project, enable YouTube Data API v3, configure the OAuth consent application and a Web application client. Register the exact callback URL supplied by the implementation. Authorize the intended channel and verify its name in Settings. Complete any applicable verification/review and durable authorization setup; a short-lived test connection is not the unattended release gate.
3. Create/select an Instagram **Business or Creator** account. Create/select the Meta developer application and use one documented login route consistently. Instagram Login and Facebook Login have different permissions and prerequisites; a linked Facebook Page is required when using the Facebook Login route. Do not require a Page unconditionally.
4. Supply public account identifiers and non-secret preferences through the app. Configure client secrets and storage credentials through the secure server configuration flow; do not paste passwords or tokens into chat.
5. Choose the private storage provider and approve its costs before a new paid resource is provisioned. Retain recovery access to both platform accounts yourself.

**Exit check:** the app identifies the correct destinations, reconnects after token expiry where supported, rejects cross-owner access and revokes access on disconnect. A tiny authorized private YouTube upload and the applicable Instagram connection checks pass; external account-review delays are recorded without blocking offline development.

## P03 Background rendering and durable publishing foundation

**Build**

1. Freeze accepted take versions into a publishing package. Persist asset hashes, metadata revision, intended account IDs, destinations, schedule, creator approval and remote upload receipts.
2. Add persistent jobs with leases, bounded concurrency, retry/backoff, cancellation and restart recovery. Suggested states: draft, preparing, ready for approval, approved, uploading, processing, scheduled, published, failed and cancelled. A closed browser or restarted app server must not lose the queue.
3. Run the existing renderer/export pipeline in a separate supported background browser/worker, with saved audio and the same programme clock. Measure memory, render time and output quality on the actual host; use a separately approved rendering service if required. Keep rendering load from disrupting studio playback. Do not assume the current interactive browser export already supports this.
4. Put approved publishing assets in private object storage with a bounded local cache. Reference-count files across uploads and scheduled clips. An ordinary export download may retain its current automatic cleanup; it must not delete assets leased by publishing jobs.
5. Retain pending files until their destinations confirm ingestion/processing, then remove temporary binaries when no job needs them. Failed jobs get a visible retry/expiry deadline, not indefinite retention. Cancelling a queue releases its files after in-flight operations settle; deleting a local asset does not delete a platform post.
6. If a platform fetches media by URL, expose only that object via a sufficiently long-lived signed link or supported resumable upload. Keep the studio and all other files protected. Preserve the source while the platform still needs it, revoke the link afterward, and exclude signatures from logs.

**Your steps:** choose storage retention/retry-expiry preferences and approve any extra infrastructure cost. No new arbitrary full-episode length cap; platform constraints and estimated processing time/storage remain visible.

**Exit check:** render and prepare a real accepted episode with the creator browser closed; restart during rendering/upload preparation; recover without duplicated jobs. Verify audio/video timing, data preservation, disk bounds, signed-link expiry and cancellation cleanup.

## P04 Publishing package and approval interface

**Build**

1. Add a concise episode Publish panel with Full video, Clips and Schedule views. Carry the saved writer-generated Hindi title into a proposed public title, allowing a separate public hook without changing the original script/title.
2. Prepare thumbnail candidates, title, description, chapters, subtitle file, language, credits, playlist choice and applicable audience/synthetic-media declarations. Derive claims from the actual episode; use readable branded Hindi thumbnails rather than invented scenes or quotes.
3. Assemble real previews and an export check for missing audio, black frames, clipping, excessive subtitles, wrong-speaker shots and duration/format compatibility. Automated checks complement the creator's review.
4. Show exactly which accounts receive which files and when. “Approve & schedule” freezes that package. Full-video-only approval authorizes no clips; a complete package can approve all visible clips and slots together. Changed content, assets, destinations or unapproved schedule changes invalidate the affected approval.
5. AI may draft assets and copy before approval. After approval, workers execute the approved package; they cannot invent new clips or rewrite published copy. A new revision does not silently replace or remove an existing post.

**Your steps:** review the complete exported video, select a thumbnail, correct metadata and approve the displayed destinations/calendar. In the first YouTube-only milestone, the panel clearly contains only the full episode; P06 later adds clips before a fresh package approval.

**Exit check:** approving one package publishes only its frozen contents. Duplicate approval clicks, stale revisions, changed destination accounts and tampered asset hashes cannot trigger an unintended upload.

## P05 Full episodes on YouTube

**Build**

1. Upload the approved master with resumable transfers and durable remote video IDs. Start private, attach the approved metadata, custom thumbnail, subtitle track and playlist membership with the required permissions.
2. Wait for processing and check required attachments before releasing. Publish immediately or at the approved time, using supported YouTube scheduling. Do not present an accepted upload as a playable published video.
3. Record the YouTube URL, processing state, release time and per-step failures. Reconcile an uncertain upload before retrying; never create a second video just because a response was lost.
4. Make unmet channel features, permissions, quota or review requirements actionable in the Publishing panel. Keep a downloadable publishing package available if a platform blocks automation.

**Your steps:** authorize the first private test, inspect its actual YouTube playback and approve the pilot release in the app. Confirm publication preferences such as audience designation and subscriber notifications in the package.

**Exit check:** one approved real episode reaches the correct channel with correct Hindi metadata, thumbnail, playable audio/video and selectable subtitles. Disconnect/restart/retry tests do not duplicate the video; processing failure prevents release and preserves recovery assets.

## P06 Complete comedy clips and vertical output

**Build and create**

1. Give a selectable clip editor model the frozen script, actual speech timing, character identities and relevant performance cues. Rank self-contained setup → exchange → payoff sequences; retain necessary preceding context, reaction pauses and callbacks. Do not divide the episode into fixed time slices or force a minimum number of clips.
2. Use an independent reviewer to reject orphaned punchlines, misleading edits, repetitions and jokes that require missing context. Preserve character wording and voice; do not regenerate dialogue just to make a short.
3. Render portrait coverage from the saved scene where possible. Frame the actual speaker and useful listener reactions; compare with a crop fallback. Create readable captions, an opening hook, platform copy, cover frame and complete music credits for each candidate.
4. Offer suggested 20–60 second clips as an editorial starting range, allowing longer complete jokes within each platform's current requirements. Keep full-episode export unrestricted by this preference. Deduplicate overlapping candidates and allow individual exclusion/trim.
5. Use saved script/timing/camera data first. Analysis of unrelated uploaded media is not introduced by this wave and remains S16 scope.

**Your steps:** inspect the first candidates for context, timing, voice and character consistency; reject weak clips. Approve the selected clips and their copy as part of a publishing package.

**Exit check:** selected clips make sense to someone who has not watched the episode, contain the complete payoff and retain smooth motion/audio through cuts. Portrait output is visually inspected; exact source take and time ranges are recoverable.

## P07 YouTube Shorts and release calendar

**Build**

1. Upload compatible approved vertical clips through the YouTube adapter, validating current Shorts eligibility. Do not assume a hashtag alone makes an upload a Short, or promise identical custom-cover controls for Shorts and full videos.
2. Add persistent posting windows, interval, timezone, daily frequency and cross-episode collision handling. Suggested starting policy: full episode first, then one approved clip per day at a creator-chosen time in Asia/Calcutta. This is editable, not a claim about optimal audience performance.
3. Let the creator review exact timestamps before approval and pause/cancel future jobs. Use the shared calendar for both platforms with independently approved slots. Define late-job behavior explicitly: flag a missed slot rather than silently posting a backlog in a burst.
4. Keep the full-episode dependency visible. If its release fails, dependent promotional clips wait unless the approved plan explicitly permits standalone release. Support descriptions with the full-episode link; expose any unavailable native related-video controls honestly.

**Your steps:** choose days/time, interval and maximum frequency; review the exact calendar. You can approve the full video and every selected short together without returning for each release.

**Exit check:** multiple clips release at approved times across a restart with one remote video per job. Check private/unlisted test output first; run an approved public pilot to verify actual Shorts classification and appearance.

## P08 Instagram Reels

**Build**

1. Create and publish Reel containers through the chosen official Instagram API flow. Upload directly where supported or supply the narrowly scoped media URL from P03; poll processing before publication.
2. Apply approved Instagram captions, relevant hashtags and supported cover controls. Validate current format/length/account requirements and API rate limits; show restrictions before approval.
3. Execute calendar slots with the shared worker and Instagram-specific receipts, status checks and retries. Do not create all containers weeks ahead without accounting for their expiry. Preserve media until platform fetching/processing has finished.
4. Reconcile uncertain publish responses before retrying and distinguish account authorization failure from bad media. Record the actual Reel URL. No automatic comments, DMs, Facebook cross-posts or unrelated account changes are included.

**Your steps:** finish professional-account authorization and any applicable Meta application review; inspect the first approved Reel on phone and in the profile/feed crop.

**Exit check:** a creator-approved clip appears on the intended Instagram account with correct audio, captions, crop and copy. A delayed processing result, expired token or lost response never causes an unapproved duplicate or deletes the source prematurely.

## P09 Recovery and supervised launch

**Build and verify**

1. Exercise worker/server restart, closed browser, network loss, token expiry/revocation, quota, processing rejection, signed-link expiry and storage exhaustion. Check account ownership on every publish/cancel action; keep credentials and unpublished assets out of public responses.
2. Provide a compact release history with queued/published/failed items, destination links, retry/reconnect actions and storage usage. In-app status is the initial notification surface; connect external notifications only if the creator requests them.
3. Test cancellation before and during upload, conflicting calendar edits, duplicate workers and ambiguous API responses. Manual platform changes are reconciled; the system must not re-create a post the creator deliberately removed.
4. Verify cleanup after confirmed processing across all consumers. Keep lightweight script/timing/metadata/receipt history after binary cleanup so a new render can be requested without rewriting the show. Expire unsuccessful jobs visibly and retain no abandoned render fragments indefinitely.
5. Run a supervised one-episode pilot with two or three approved clips, only if that many complete jokes are available. Separate simulated adapter tests, real private tests and creator-approved public releases in the audit. Roll out YouTube and Instagram independently if one platform is blocked.

**Your steps:** approve the pilot calendar, check actual public outputs and confirm whether unattended operation should remain enabled. Pausing future posts must be available at all times.

**Exit check:** the pilot releases its approved items on schedule, recovers from injected failures without duplicates and cleans temporary storage. Save evidence and limitations before enabling ongoing use.

## P10 Audience results and future suggestions

**Build**

1. With separately granted permissions, collect available video/clip views, watch-time/retention, engagement and release-time results. Distinguish full videos, Shorts and Reels; show collection dates and unavailable metrics.
2. Link outcomes to the exact clip ranges, opening hooks, thumbnails and character exchanges. Suggest improvements for the next episode/clip package, with sample size visible rather than claiming a causal result from one post.
3. Suggest future posting windows and candidate-selection changes. Do not alter an approved queue, rewrite characters or change writer/director defaults without the creator accepting a new revision.

**Your steps:** review results after several releases and accept or reject suggested future defaults. Additional analytics access is optional and does not block publishing.

**Exit check:** a report links every metric to the correct platform item and approval snapshot; suggestions cannot mutate a live queue.

## Account and preference worksheet

Complete through the app or the secure setup flow during the relevant wave. These values are pending; do not infer existing connections from the app password or AI-provider keys.

| Detail | Needed in | Current value or instruction |
| --- | --- | --- |
| Studio origin | P02 | https://app.gameofcodes.si; creator reports password protection |
| Public show/channel name and publisher | P01 | Confirmed Baat Ka Bawaal channel; Game of Codes Production |
| YouTube channel URL, ID and handle | P02 | Creator to select; verify through connected account |
| Google Cloud project and OAuth client IDs | P02 | Creator to select/create; secrets only in secure server config |
| Instagram username, professional account ID and type | P02 | Creator to select; verify through API |
| Meta app ID, login route and review/access status | P02 | To configure; Page ID only if chosen route requires it |
| Public contact email, bio and profile links | P01 | Creator to provide public-facing details |
| Storage provider, bucket/region and spending approval | P03 | To choose; private storage and bounded cache required |
| Temporary retention and failed-job expiry | P03 | Delete successful unused binaries; agree retry window |
| Full-video release and clip posting windows | P04, P07 | Asia/Calcutta default; exact times require package approval |
| Audience/synthetic-media settings and default credits | P04 | Confirm for the actual content; preserve required attribution |
| Clip editor/reviewer model and generation budget | P06 | Select existing authorized connections where suitable |
| Publish permissions | P04 | Each approval covers only its listed accounts, assets and calendar |

## Platform references

Recheck these at implementation and before real-provider acceptance; do not freeze changing quotas, permissions, cover behavior or review rules into the contract.

- [YouTube server-side OAuth](https://developers.google.com/youtube/data/guides/auth/server-side-web-apps): delegated account authorization and offline server access. A normal creator channel uses user authorization rather than a generic service account.
- [YouTube video uploads and metadata](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert), [video status and scheduling](https://developers.google.com/youtube/v3/docs/videos), [thumbnail upload](https://developers.google.com/youtube/v3/docs/thumbnails/set) and [caption upload](https://developers.google.com/youtube/v3/docs/captions/insert).
- [YouTube Shorts eligibility](https://support.google.com/youtube/answer/15424877): validate current aspect ratio and duration classification at export/upload time.
- [Meta Instagram publishing guide](https://developers.facebook.com/docs/instagram-platform/content-publishing/) and [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api): professional accounts, chosen login route, publishing permissions and processing workflow. Meta's guide was rate-limited during planning; confirm route-specific details against accessible official documentation during P02/P08.
