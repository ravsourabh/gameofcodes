# Create and connect the Baat Ka Bawaal accounts

October 30, 2026 · Asia/Calcutta. P02 supplies the local Publishing settings and protected connection flow. You confirmed that the accounts have not been created. Account creation, developer credentials, real grants and a private upload are still required before live-provider acceptance. No public episode or Reel is uploaded by these instructions.

## Start with these two accounts

### YouTube

1. Sign in to [YouTube](https://www.youtube.com/) using the Google account you want to own the show. You can use an existing Google account and create a separate show channel; you do not need to rename your personal Google account.
2. Open [your channel list](https://www.youtube.com/channel_switcher). Choose **Create a channel / Create a new channel**. YouTube also exposes this under profile picture → Settings → Account → Add or manage channels.
3. Use **बात का बवाल | Baat Ka Bawaal** as the display name. Try `@baatkabawaal`, then `@baatkabawaalshow` if necessary. Availability has not been checked; choose an available consistent spelling rather than assuming either is reserved.
4. Upload the [profile badge](publishing/baat-ka-bawaal/v1/assets/profile-800.png). In YouTube Studio → Customization, upload the [clean channel banner](publishing/baat-ka-bawaal/v1/assets/youtube-banner-2560x1440.png). Do not upload a crop-guide preview.
5. Copy the Hindi About text from [CHANNEL_COPY.md](publishing/baat-ka-bawaal/v1/CHANNEL_COPY.md). The publisher is exactly **Game of Codes Production**. Add only actual public links/contact details; omit the password-protected studio address.
6. Check YouTube Studio → Settings → Channel → Feature eligibility and complete the platform's verification needed for custom thumbnails and your intended video length. Keep account recovery and two-factor authentication under your control.
7. Keep the resulting public channel URL/handle. The app will verify the actual channel ID during authorization; you do not need to guess it.

[Official channel creation instructions](https://support.google.com/youtube/answer/1646861?hl=en) and [branding specifications](https://support.google.com/youtube/answer/10456525?hl=en).

### Instagram

1. Create a **dedicated show account** in Instagram using an email/phone you control. Do not convert or rename a personal account unless you intend to use that account for the show.
2. Choose an available matching username, with **Baat Ka Bawaal** as the display name. Use the same profile badge and the Instagram bio in [CHANNEL_COPY.md](publishing/baat-ka-bawaal/v1/CHANNEL_COPY.md).
3. Open the account's settings → account type/professional tools → **Switch to professional account**. Menu wording can vary. Choose an appropriate entertainment/creator category and **Creator** account type, or Business if you prefer that structure. Review the platform's visibility/contact choices before confirming.
4. Add the public YouTube channel link once it exists. Keep passwords, recovery codes and two-factor authentication private.
5. Keep the public username/profile link. This implementation uses **Instagram API with Instagram Login**, with `instagram_business_basic` and `instagram_business_content_publish`; do not mix in the separate Facebook Login permission family. This route does not require a linked Facebook Page.

[Instagram professional-account help](https://help.instagram.com/502981923235522) and [Meta Instagram Login documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/). Meta's documentation was rate-limited during implementation; the route-specific adapter still needs real-account acceptance, beyond its local protocol fixtures.

**You can stop here initially.** Creating the channel and Instagram account is the first user task. Share only their public links/handles when ready; never send passwords or client secrets in chat.

## Confirm the private app address

The desired app origin is **https://app.gameofcodes.si**. It must resolve publicly, load over HTTPS and retain its password gate before OAuth can return to it. During this work, both the workstation and server failed to resolve that subdomain. The existing server's Caddy application block still names `gameofcodes.si` and `www.gameofcodes.si`; no DNS or gateway change has been made by P02.

This is a live acceptance dependency, not a reason to silently register callbacks against the old domain. If the intended hostname is different, confirm the correct one before registering OAuth clients. If it is correct, configure the subdomain and its authenticated app route, then check it in an external browser.

Keep the password gate on the entire studio. Browser OAuth redirects normally return through that same authenticated route. No broad `/api` bypass or public token endpoint is needed. The backend also requires a private gateway proof on publishing requests, so access to port 5443 alone cannot claim a publishing session.

## Google developer setup

1. Open [Google Cloud Console](https://console.cloud.google.com/). Create/select a project for this show and enable **YouTube Data API v3**.
2. Configure Google Auth Platform / OAuth consent with the real app name and support contact. For testing, add your own authorizing Google account as a test user if required. Record the actual testing/production mode; a successful test grant is not a promise of permanent unattended authorization.
3. Create an OAuth client with type **Web application**. Register this exact authorized redirect URI:

   `https://app.gameofcodes.si/api/studio/publishing/oauth/youtube/callback`

4. Download the Web client JSON into a private location. Do not upload it into `public/`, an asset folder or chat. An API key alone does not authorize uploading to your YouTube channel.
5. Configure the client ID/secret through the private environment setup below. The app requests video upload and video/caption management permissions; it does not request analytics, email or Drive access in P02.
6. Once server/gateway setup is complete, open the studio → Settings → **Publishing** → **Connect YouTube**. In the official Google flow, select the **Baat Ka Bawaal channel**, especially if your Google account owns several personal/brand channels.
7. On return, verify the exact channel name, handle, ID, granted scopes and refresh-authorization status in the Publishing card. Use **Check connection**. Do not infer upload readiness merely from successful login.

[Google server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server) and [YouTube authorized channel lookup](https://developers.google.com/youtube/v3/docs/channels/list).

## Meta developer setup

1. Open [Meta for Developers](https://developers.facebook.com/), create/select an app and add the **Instagram API with Instagram Login** use case/product. Use the Instagram application's ID/secret supplied by that product.
2. Follow the dashboard's account-role/tester steps for your new professional account, accepting any tester invitation in Instagram when required. Developer/test access and access for unrelated accounts are different gates.
3. Register this exact Instagram Login callback:

   `https://app.gameofcodes.si/api/studio/publishing/oauth/instagram/callback`

4. Configure the two publishing permissions shown in Settings. Do not use Facebook Page scopes or the deprecated short `business_*` names in this flow.
5. Enter the Instagram app ID/secret in protected server configuration. Record the actual development/live mode and pinned supported Graph API version. The initial adapter pins `v22.0`; verify its current support and the actual account endpoint behavior before live acceptance.
6. Open Settings → Publishing → **Connect Instagram**. Sign in on the official Instagram page and grant the displayed permissions. On return, verify the actual professional account ID/username and use **Check connection**.
7. Complete any applicable app review/business verification before broader or ongoing use. Meta may require accessible privacy-policy and data-deletion instructions; prepare real public policy pages with your chosen contact and data practices before submitting. Do not label a password-protected studio page as a publicly accessible policy or claim a placeholder policy is approved.

P02 checks account identity, scopes, expiry and revocation. A public Reel test belongs to P08/P09 and its approved publishing package, not this connection step.

## Private server configuration

No real provider credentials were added during implementation. New variables are documented in [.env.example](.env.example). `GOC_PUBLISHING_OWNER_PROFILE` is the current studio profile UUID shown in the Publishing setup panel; the old browser profile UUID alone is not an authorization token.

From the project folder, initialize the private environment and gateway token:

```powershell
node scripts/configure-publishing.mjs --profile YOUR-STUDIO-PROFILE-UUID --origin https://app.gameofcodes.si
```

After downloading the Google **Web** client JSON with the registered callback, import it without printing its contents:

```powershell
node scripts/configure-publishing.mjs --profile YOUR-STUDIO-PROFILE-UUID --origin https://app.gameofcodes.si --google-client-json C:\private\google-web-client.json
```

These are templates: replace the UUID and private path with actual values. The helper preserves unrelated environment keys, writes atomically and prints only field names/paths. It writes `.env.local` by default; `--env-file` targets the actual private deployment environment file when running on the server. Configure the Instagram ID/secret through the same protected environment management, without placing secret values on a command line.

For HTTPS, install the generated private `.sovereign/publishing/caddy-header.snippet` **inside the already password-authenticated app's reverse_proxy block**, as a Caddy include readable only by the service/admin. The snippet overwrites `X-GOC-Publishing-Gateway` with the shared private token. Do not copy it into a public marketing-site route. Validate/reload Caddy and restart the app with the matching environment. The setup helper does not change DNS, Caddy, firewall rules or production credentials by itself.

The server creates `.sovereign/publishing/v1/master.key` with private permissions on first authorized session and uses AES-256-GCM for `connections.enc`. Keep the matching key and encrypted data in a private backup. Never regenerate a missing key over existing ciphertext. Moving the configured owner/origin requires deliberate migration of this bound data; do not casually change them after connecting accounts.

Private temporary storage remains unselected. Environment credential presence is shown as **unverified**, never proof that a bucket is private. P03 selects/verifies the storage and any costs before provisioning a paid resource.

## Run the private YouTube connection test

1. Save your current studio take before navigating away for OAuth.
2. Connect YouTube and check the destination name/ID.
3. Select **Test with a private 1-second video**. Review the displayed channel and confirm **Upload private test**. It sends a one-second silent navy clip, with no episode content, and consumes API quota.
4. The clip stays **private** in your channel for inspection. Open its returned YouTube link. Use **Check connection** again to verify processing; an accepted upload and completed processing are recorded separately.
5. An unknown outcome is not retried automatically, even with another button click. Inspect YouTube Studio first. Delete that private test in YouTube Studio when you no longer need it; the app does not silently delete platform videos.

For disconnect, use the account card. If remote revocation fails, the connection immediately becomes unusable for publishing and shows **Disconnect pending**; retry revocation rather than treating a hidden token as successfully revoked.

## What is ready and what remains

Ready locally: connection UI; canonical-origin/owner/gateway/session/CSRF checks; Google PKCE and browser-bound one-time state; encrypted persistent token/authorization journal; refresh and reconnect handling; disconnect/revocation state; secret-free status; restart/replay protection; explicitly confirmed private YouTube test; account-creation guide. No account has been created or linked on your behalf.

Remaining before P02 is accepted: create the two accounts; make the intended app hostname reachable and authenticated; configure the developer applications and private server credentials; authorize both accounts; verify real identity/scopes/refresh/revocation; inspect the private YouTube upload and processing. P03–P09 still own durable episode rendering, publication approval, scheduling and real Reels delivery.
