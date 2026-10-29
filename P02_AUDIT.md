# P02 publishing connection implementation

October 30, 2026 · Asia/Calcutta.

**Status:** implemented and verified locally; live acceptance remains open. The creator confirmed that the YouTube and Instagram accounts have not been created. No real grant, account upload, public post, gateway/DNS change or production credential change was performed. No commits.

## Implemented

- Settings → Publishing cards for YouTube, Instagram and the unselected private-storage connection, with account IDs/names, scopes, expiry, actual app mode, reconnect and disconnect state. Account-creation and developer setup instructions appear in the panel and [P02_SETUP.md](P02_SETUP.md).
- Settings → Publishing now links to `/publishing/baat-ka-bawaal/v1/index.html`. Every Vite production build packages the 48 reviewed outputs plus nine support files into `dist/publishing/baat-ka-bawaal/v1`. The copy hook pins the manifest, checks every media hash/size and PNG dimensions, and rejects source/output links or junctions. It includes individual downloads, audience-facing brand/copy, the gallery font and notices; internal source records, private host references/concept files, saved character identifiers, authoring instructions and duplicate ZIPs are excluded. Changed inputs require explicit review/hash updates. Creator visual acceptance remains pending.
- A configured owner profile, canonical origin and HTTPS gateway proof are required before the server issues a signed HttpOnly/SameSite session. Mutations also require a session-bound CSRF header. Browser profile IDs alone cannot access connections, and directly reaching the backend port cannot bypass the gateway proof.
- Google server OAuth with PKCE, offline consent and feature-specific video/caption permissions. Instagram Login uses its own permission family and Graph host; it is not mixed with Facebook Login/Page scopes. Live endpoint acceptance remains necessary, especially because Meta documentation access was rate-limited.
- Browser/session/provider-bound single-use authorization state, bounded expiry, atomic consumption before exchanging the code and restart-safe encrypted pending grants.
- AES-256-GCM storage bound to owner/origin, a separate private 32-byte key, atomic ciphertext replacement and explicit failure if the matching key is wrong/missing. No token, client secret or code is returned in connection-status JSON or written to browser storage/logs.
- Refresh/reconnect checks and a revocation-pending state that immediately disables use when remote disconnect has not finished. Disconnect invalidates pending callbacks. No token is silently substituted from another provider/account.
- A separately confirmed one-second private YouTube test. It checks the displayed account, generates a real tiny silent H.264 clip and records the returned private video ID. Processing is checked separately; an unknown upload outcome is not blindly retried. Test videos are not silently deleted from the platform.
- A private configuration helper that imports a downloaded Google Web OAuth client, preserves unrelated existing provider settings and prints only field names/paths. It generates the private gateway snippet but does not install it, reload Caddy or provision any paid storage.

## Local evidence

- P01 distribution check: `node --test tests/publishing-kit.test.mjs`: **6 passed**. It checks the exact 57-file release, hashes and PNG dimensions, byte-identical repeated copies, stale-file removal, unexpected/private file exclusion, manifest/media/support-text tampering, junction denial and output containment. The existing production HTTP handler serves every gallery reference and MP4 range requests; excluded authoring files return 404.
- `npm run build` passed with the new copy hook. The built kit contains **48 media outputs / 57 files / 37,618,852 bytes**. All 41 PNG dimensions and hashes matched; independent FFprobe inspection confirmed all four MP4 dimensions, 24 fps and 2.5/4-second durations plus the three WAV durations and 48 kHz audio. A full byte scan found no private filesystem paths or credential markers. Chromium decoded all 35 gallery images with no failed resources/page errors or horizontal overflow at 1440 px and 390 px. Local report/screenshots are under `.sovereign/review/p01/production-kit-*`; they are excluded from the release.
- The isolated Publishing panel browser test passed with the new exact kit-link assertion; OAuth/private-upload confirmation behavior remains covered. This does not verify the live password gateway.

- `node --test tests/studio-publishing.test.mjs`: **19 passed**, including wrong-owner/gateway/origin/CSRF denial, encrypted tokens, browser/state/provider mismatch, expired/replayed/concurrent callbacks, service restart, refresh, revocation failure/retry, account-bound private upload, ambiguous outcome protection, wrong/missing key preservation, provider diagnostic redaction, Instagram grant lifecycle fixtures, real FFmpeg smoke-clip encoding and secret-free configuration import.
- `node --test tests/studio-service.test.mjs tests/studio-web.test.mjs`: **12 passed**. Existing persistence/casting/output service behavior and static HTTP/HTTPS serving/proxy behavior remain working.
- `tests/studio-publishing.spec.ts`: **1 passed** using an isolated lightweight browser panel. It checks account-creation instructions, disabled unconfigured provider, exact callbacks, destination ID, separate private-test confirmation, CSRF header, no CSRF in localStorage and 390 px layout. No full 3D studio load or physical headset test is claimed.
- TypeScript and the normal application production build passed. The isolated release candidate is also built/packaged through the guarded release workflow; this is preparation, not evidence of a production deployment.

The tests use isolated temporary profiles, fake credentials and protocol adapters; the actual FFmpeg test reaches only the fake upload adapter. They do not establish real Google/Meta account readiness.

## Live gates and current findings

The kit packaging/link change is local preparation. The parent deployment task owns
the full password gateway at `app.gameofcodes.si`, including all `/publishing/`
assets and downloads, and must verify unauthenticated denial after deployment.
No production mutation or live authentication test was performed for this change.
Accounts remain uncreated and OAuth credentials unconfigured; automatic uploads
and scheduling remain future work.

1. Create the Baat Ka Bawaal YouTube channel and dedicated Instagram Creator/Business account using [the P01 assets](publishing/baat-ka-bawaal/v1/index.html). The exact publisher credit remains **Game of Codes Production**.
2. Confirm the app hostname. `app.gameofcodes.si` failed resolution from both workstation and server during this work. The existing server Caddy app block still names `gameofcodes.si` and `www.gameofcodes.si`. No fallback hostname was silently registered or configured.
3. Make the intended app address reachable over HTTPS and verify its actual password gate. Install the gateway proof only inside that authenticated app route. Exclude/redact OAuth query strings and credential headers from gateway/access logs; do not expose a broad API exception.
4. Configure Google/Meta developer applications, owner profile, provider credentials and actual application modes privately. Add real public privacy/deletion policy pages if required by platform review; draft placeholders and password-protected pages do not satisfy that gate.
5. Complete real grants and verify account identity, required permissions, refresh/revocation and the tiny private YouTube upload/processing. No such check is marked passed yet.
6. Select and verify private temporary storage during P03 before costs/resources are provisioned. P02 reports environment credentials as unverified and does not claim bucket privacy from their presence.

P02 does not enable full-episode publishing, recurring schedules, clip generation or Reels uploads; those remain P03–P09. Native Unreal, deferred media understanding and further animation expansion are not prerequisites for creating the social accounts.
