# Game of Codes · Your royal court

> Live at [gameofcodes.si](https://gameofcodes.si)

A character-led WebXR workspace. You sit across from **Elara the architect, Bram the builder, and Iris the inspector**. Address a character by pointing and pinching, or select them on desktop. They speak, look toward you, gesture, and show when they are listening or considering your request. The application preview is brought forward when you choose to review the work.

Select **Meet your court** to hear the spoken introduction. Enter an instruction in the conversation field or use the microphone. On Quest, an in-world conversation panel provides Speak, Write, approval, review, Quiet, and exit controls; Write opens a keyboard you can select with your hands.

Each character carries a faint provider mark in their forehead. Say or type **“Elara, open your head”**, or select their forehead, to lift the hair cap and reveal a glowing mechanical brain. Pinch a floating Muse, ChatGPT, or Claude symbol to change it; **“Change your brain to Claude”** and **“Close your head”** also work. Desktop provides the same choices through **Open head**. These explicit commands run locally after transcription and do not spend a model turn.

Assignments are saved per character and project. Elara's conversation uses her assigned provider; approved builds use Bram's provider. A brain inherits the default assistant until explicitly assigned. A provider logo identifies an assignment, while the choice's status distinguishes setup or sign-in needs from a verified connection. Changing a logo does not grant model access or transfer an account subscription.

## Connect a local assistant

Open **Connect assistant** on desktop and choose **Muse Code**, **ChatGPT · Codex**, or **Claude Code**. Game of Codes discovers the official native CLIs on this computer. Sign in in your terminal using `muse`, `codex login`, or `claude auth login`, then select **Check connection**. This sends a small real request using the CLI's account access. An installed CLI is labeled separately from a verified connection.

Install missing tools from their official guides: [Muse Code](https://dev.meta.ai/docs/muse-code), [Codex](https://learn.chatgpt.com/docs/cli), and [Claude Code](https://code.claude.com/docs/en/quickstart). `node scripts/install-muse.mjs` installs Meta's native Windows stable release after verifying its published size and SHA-256 checksum; interrupted download parts can be resumed. Muse's standard Windows install folder is detected directly, including Meta's versioned native binaries. For other PATH changes, restart Sovereign. Override discovery with an absolute `SOVEREIGN_MUSE_PATH`, `SOVEREIGN_CODEX_PATH`, or `SOVEREIGN_CLAUDE_PATH`. Shell wrappers are not executed.

The CLI owns authentication, model access and account limits. Sovereign stores only the selected provider in `.sovereign/connection.json`; there is no API-key entry form or direct provider API call. API-key environment variables are removed from child processes. Codex and Claude must confirm account/OAuth sign-in before inference; an API-key login is rejected. Muse Code manages its own onboarding credential and billing. Allowances and availability depend on provider and plan. This is a local personal prototype; a hosted or commercial integration needs the provider's supported product authentication.

Elara returns a versioned proposal. Approval asks the selected CLI for HTML, CSS and JavaScript; Sovereign validates those fields and writes them into `.sovereign/builds/<project>/<version>/`. Bram brings that version forward, and Iris reports recorded startup checks. Source export and the existing review browser work with all three connections. CLI runs use disposable folders, bounded output and timeouts. Codex runs read-only with shell, apps, hooks and multi-agent tools disabled. Claude runs with tools and MCP disabled. Muse keeps its sandbox and strict approval posture. No unrestricted execution flags are used.

Spoken replies use Windows synthesis with a browser fallback. Microphone input uses browser speech recognition where supported, otherwise a maximum 20-second recording is transcribed by the Windows English speech recognizer on this computer. Local transcription requires an installed English recognition engine. Audio is processed in memory without saving recordings; no Meta transcription API is called.

Inspect installations with `node scripts/check-connections.mjs`. To make a real check, use `node scripts/check-connections.mjs --check codex` (or `muse` / `claude`). Checks use the account's allowance. Conversation and build requests are limited to 30 per local server session.

## Run

Requires Node.js 22.12+ (or Node 24).

```powershell
npm install
npm run setup:browser
npm run dev
```

Open **http://localhost:5173/** on this computer. The desktop preview uses loopback HTTP and opens without a certificate prompt. Browsers treat localhost as a secure context.

The separate **HTTPS port 5443** serves Quest on your local network. Its development certificate is self-signed; the headset will need to accept it or use a trusted development certificate. Desktop browsing does not require that exception.

The first visit opens the three-character court. **Review starter** launches a browser for the supplied task board and streams its frames into the review surface. Introductions and the starter work before account connection. Real replies and building require one of the local assistants described above.

To use an alternative browser executable, set `SOVEREIGN_BROWSER_PATH` before starting. The service prefers Playwright's installed Chromium, then an installed Chrome/Edge or Linux Chromium.

## Use on Quest 3 / 3S

1. Connect the headset and this computer to the same Wi-Fi. Keep the server running.
2. Open the terminal's **Quest VR / Network** URL (for example `https://192.168.1.8:5443/`) in **Quest Browser**. `localhost` on Quest refers to the headset, so use the Network address.
3. Accept the local development certificate. If the browser still reports an insecure context, use a locally trusted HTTPS certificate or forward the service through a trusted HTTPS development tunnel. WebXR requires a secure context.
4. Enable hand tracking in Quest settings. On this page, select **Enter VR** and allow immersive access.
5. Stay seated. Point at Elara, Bram, or Iris and pinch to address them. Native WebXR selection events support controller triggers too.
6. Choose **Speak to me**, or **Write an instruction** to open the in-world conversation keyboard. Select and sign in to your assistant on desktop first. Quest uses that same local assistant connection and the local transcription service.
7. Choose **Review our work** to bring forward the application. The review controls include **Back to court**; the conversation panel includes **Leave VR**. Head movement remains controlled by the headset; there is no artificial locomotion.

If your firewall blocks the headset, allow port 5443 on your private network. The desktop server on port 5173 and the preview's internal ports 4174 and 4175 bind only to loopback. The headset's HTTPS server on port 5443 proxies the same preview bridge.

## Continue the same project on desktop and Quest

Projects have a UUID in the page URL (`?project=...`). Settings → **Copy this project's link** copies the computer's Quest HTTPS Network address with that project ID included. Open it in Quest Browser to operate the same task board. For manual transfer, use the printed Quest URL on port 5443 and preserve the project ID.

Tasks and activity are saved after each input in `.sovereign/projects/<project-id>.json`. That directory is ignored by Git. Closing the tab pauses frame capture; inactive browser contexts are closed after a minute. Reopening the same project restores its saved data. Reconnects keep the same project identity. Up to four browser projects may be open simultaneously; idle projects can be saved and evicted when another seat is needed.

Settings → **Export starter task data** downloads the starter's JSON. The supplied application's source is in `board/`. After an approved build, **Export application source ZIP** downloads its HTML, CSS, JavaScript, and recorded check results. The generated source also remains in `.sovereign/builds/`.

## What is built

- A procedural 3D observatory, seated WebXR session, stereo rendering, rendered hand joints, native hand/controller rays, pinch/trigger selection, and immediate local selection feedback.
- Three articulated characters with gaze, breathing, blinking, speaking gestures and mouth animation; local audible speech, captions, voice cancellation, and character selection.
- Local Muse Code, Codex/ChatGPT and Claude Code connections, browser or local push-to-talk transcription, saved history, versioned approvals, generated files, startup checks and source ZIP export. Each live connection requires its installed CLI and account sign-in.
- A browser-rendered task board with create, edit, delete, status changes, urgent filtering, activity, physical keyboard input, and a selectable on-screen keyboard.
- Real UV-to-browser pointer mapping, ordered input, per-project browser contexts, server-side project persistence, connection recovery, and stale-preview indication.
- In-world help and controls, desktop settings and task export, optional soft interaction audio, and render/input diagnostics.
- HTTPS development access for LAN headset testing.

**Review starter** opens the supplied task board while no generated application exists. It is labeled as a starter. After a real approved build, that review action opens the generated artifact. The application does not include subscription billing, arbitrary repository execution, databases, production authentication, or public deployment.

## Architecture

```text
Quest Browser / desktop
  Three.js WebXR scene
    ├── native target rays → board UV → browser pixel coordinates
    └── JPEG frames → GPU texture on the review surface
             │ HTTP / WS :5173 (desktop loopback)
             │ HTTPS / WSS :5443 (Quest LAN)
  Vite development servers / static-build servers
             │ loopback proxy
  Preview bridge :4175
    ├── one browser context per project (up to four)
    ├── ordered input queue and persisted browser storage
    └── active capture at a 125 ms target interval, idle capture every ~2 s
             │ loopback only
  Supplied board origin :4174
```

The 3D render loop runs independently of the application stream. The stream targets up to 8 frames per second after input and captures about every two seconds while idle; actual capture rate depends on the host. The desktop companion caps its static scene at approximately 30 fps; the headset uses its native WebXR frame loop. Scene FPS in Settings is a measured rendering rate, not a claimed Quest performance result. Input round-trip is the browser action acknowledgement, not motion-to-photon latency.

The board origin has a restrictive CSP and its browser context blocks requests to other origins. The bridge accepts only bounded click, text, key, reload, and data-export commands. This is a **local LAN development service without authentication**, intended for the supplied starter. It is not a production sandbox for arbitrary generated code and should not be exposed publicly.

## Check and build

```powershell
npm run test:unit
npm test
npm run build
npm start
```

`npm start` serves the built client through the same desktop HTTP and headset HTTPS endpoints with the same preview service. Run `npm run build` first. The browser service remains necessary because the application preview is a real browser session.

Tests cover local audio, character selection, provider selection, missing-CLI behavior, CLI event parsing, literal prompt transport, API-key environment filtering, versioned approvals, source writing and export, the starter preview and an emulated Quest session. Test transports are never used by the running application. IWER is test-only. Live checks require each CLI and account sign-in; physical headset comfort, hand tracking, microphone behavior and frame rate still require a device test.

Scene geometry was authored for this prototype. Provider SVG marks come from [Lobe Icons](https://github.com/lobehub/lobe-icons), with its MIT license in `public/brands/LICENSE.txt`; the Meta mark identifies Muse. Brand marks belong to their respective owners. There are no external model assets or remote font requests.
