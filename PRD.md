# Game of Codes — Product Requirements Document

Last updated: 2026-10-25

---

## Product Overview

Sovereign is a WebXR royal court where four AI-animated characters collaborate with you to design, build, and inspect web applications through voice and hand interaction. You speak an idea; the team turns it into running HTML, CSS, and JavaScript.

The core metaphor is a seated audience with a working team. You are the sovereign directing a court. Characters speak back, animate, and show state. Everything runs locally on your machine by default; no cloud API keys required in the local configuration.

Target platforms: Meta Quest 3 / 3S (hands-first WebXR) and desktop browser.

---

## Competition Context — Meta VR Start 2026

- **Deadline:** November 18, 2026 · Winners announced December 11
- **Division:** Adapted / Significantly Updated Experience
- **Primary track:** Productivity
- **Eligibility:** India confirmed eligible

### Prize targets

| Award | Prize | Confidence |
| --- | --- | --- |
| Best Adapted Productivity Experience (winner) | $70,000 | Primary target |
| Best Adapted Productivity Experience (runner-up) | $35,000 | Fallback |
| Best Agentic Interaction | $25,000 | High — voice-first AI team in VR |
| Best First Five Minutes | $25,000 | Edmund onboarding targets this |
| Boldest Original Concept | $25,000 | Royal court directing metaphor |
| Judge's Choice | $20,000 | Possible if spatial layout stands out |

### Why it only works in VR (Boldest Original Concept argument)
Directing a team by physically turning to face them, the embodiment of being the sovereign, the Wall of Fame as a real space you walk into, the Meeting Room where you watch your app being built on a physical screen — these collapse on any flat screen. The court metaphor requires presence.

### Hard gates (must complete before Nov 18)
1. Join Meta VR Start Program
2. Cloud mode live on `167.71.227.218:5443`
3. 3-minute demo video uploaded to YouTube / Vimeo

---

## Current State vs Target State

| Area | Current | Target (Nov 18) |
| --- | --- | --- |
| Characters | 3 (Elara, Bram, Iris) | 5 (+ Virus the Advisor, Mira the Artiste) |
| Onboarding | Cold start, no guidance | Virus-guided 10-step cinematic arc — starts in castle garden |
| Deployment | Local LAN only (Windows) | Docker on `167.71.227.218:5443` |
| AI backend | Local CLIs only | Dual-mode: local CLIs + cloud REST APIs |
| Spatial layout | Single forward-facing court | 360°: Court · Meeting Room · Workspace · Wall of Fame |
| Speech (TTS) | Windows SAPI5 (Zira/David, robotic) | ElevenLabs British English voices |
| Speech (STT) | Browser Web Speech API (en-US) | Unchanged — any English accent accepted |
| Provider UI | Global top-right button + brain picker | Brain picker only |
| Workspace selection | None — throwaway temp folders | Pre-session picker, shared by all agents |
| Milestones | None | Edmund captures at kickoff; wall shows achievements |
| FoV-aware design | Not validated | Audited to ±40° / ±30° rules |
| Performance | Not measured on Quest | 72Hz target; zone culling applied |
| Passthrough | None | Personal Workspace zone uses passthrough |

---

## Execution Waves

Each wave is one focused Claude Code conversation with a clear deliverable. Waves 1–3 are the competition critical path.

### Wave 1 — Cloud Mode & Deployment *(Week 1: Oct 25 – Nov 1)*

**Goal:** Public URL live at `https://167.71.227.218:5443`. Judges can open it in Quest Browser.

**Deliverables:**
- `SOVEREIGN_MODE=cloud` env var switches inference from CLI spawning to REST API calls
- `cloudGenerate()` in `server/providers.mjs` — Anthropic API / OpenAI API / Google Gemini API / Meta Llama API (disabled pending key fix)
- `Dockerfile` — builds Node.js server + compiled Vite client + Playwright Chromium
- `docker-compose.yml` — local cloud-mode testing with `.env` file
- Self-signed TLS cert generation at container startup (port 5443)
- Deploy to `167.71.227.218`, `docker run --restart=always`
- Remove global `#provider-button` from header

**Env vars needed from user before this wave:**
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `META_LLAMA_API_KEY`

---

### Wave 2 — ElevenLabs TTS *(Wave 1 parallel or immediately after)*

**Goal:** All four characters speak with distinct British English voices. User's speech input unchanged.

**Status:** Code written. Waiting on correct `sk_...` API key from user.

**What's done:**
- `server/tts-elevenlabs.mjs` — ElevenLabs API client, PCM→WAV conversion, per-character voice settings
- `server/speech.mjs` — `TTS_PROVIDER=elevenlabs` routes to ElevenLabs instead of PowerShell

**Voice assignments:**

| Character | Voice | Voice ID | Personality |
| --- | --- | --- | --- |
| Edmund | Daniel | `onwK4e9ZLuTAKqWW03F9` | Deep, authoritative, BBC news |
| Elara | Lily | `pFZP5JQG7iQjIQuC4Bku` | Warm, thoughtful, raspy |
| Bram | George | `JBFqnCBsd6RMkjVDRZzb` | Resonant, confident, distinctive |
| Iris | Alice | `Xb7hH8MSUJpSbSDYk0k2` | Clear, precise, analytical |

**Model:** `eleven_flash_v2_5` — ~75ms latency, cheapest tier, real-time capable

**⚠️ Voice expiry:** Default voices expire December 31, 2026. Fine for competition (ends Dec 11). Clone voices before January.

**STT note:** `SpeechRecognition.lang = 'en-US'` stays unchanged. The user speaks in any English accent. ElevenLabs only affects character output, not user input.

**Env vars needed:**
- `ELEVENLABS_API_KEY=sk_...` (not the key ID — get the `sk_...` value from ElevenLabs Dashboard → Profile → API Keys)
- `TTS_PROVIDER=elevenlabs`

---

### Wave 4 — 360° Spatial Layout *(Must ship BEFORE Wave 3 onboarding narrative)*

**Goal:** Four zones accessible by physically turning. Virus guides the user through them in the onboarding, so the zones must exist first.

| Direction | Zone | Content |
| --- | --- | --- |
| Front (0°) | The Court | Virus, Elara, Bram, Iris, Mira. Conversation, proposal, approval. ✅ Exists (partially) |
| Right (90°) | Meeting Room | Round table, all characters, wall-mounted live preview screen |
| Left (270°) | Personal Workspace | Your desk, passthrough enabled, scratch surface |
| Behind (180°) | Wall of Fame | Milestone achievement cards — empty frames until achieved |

**Implementation tasks:**
- [ ] Zone offsets in `src/scene.ts` (Meeting Room: +8m X, Workspace: -8m X, Wall of Fame: -8m Z)
- [ ] Zone detection: track yaw from seated origin, zone change event at ±45° boundaries
- [ ] Zone culling: `visible = false` outside active ±90° arc
- [ ] Meeting Room geometry: round table, chairs, wall screen (reuse board UV mapping)
- [ ] Reposition `PreviewConnection` frame to Meeting Room screen when zone active
- [ ] Wall of Fame geometry: gallery wall, card slots loaded from milestone JSON
- [ ] Personal Workspace geometry: desk surface, blank panel, Quest passthrough enabled
- [ ] Zone transition indicator: glow/arrow at FoV edge pointing to adjacent zones
- [ ] Desktop fallback: compass rose at viewport edge to rotate camera

**Wall of Fame card:** title, achievement date, build thumbnail, linked build. Unachieved = dark empty frames with milestone title engraved.

---

### Wave 3 — Virus + Onboarding + The Artiste *(Week 2: Nov 2 – Nov 8, after Wave 4)*

**Goal:** A continuous, action-driven introduction beginning in the garden. Virus leads the user from an idea to a reviewable plan without long scripted pauses. Targets the $25k Best First Five Minutes award. Wave 4 spatial zones must exist before this wave ships.

---

#### Character: Virus (formerly Edmund)

**Inspiration:** Varys from Game of Thrones — the whispering court advisor. Bald, robed, soft-spoken, knows everything, speaks in measured wisdom. Not a herald; a spider.

**Visual design:**
- Bald head (no hair — visually distinct from the three workers)
- Deep purple/charcoal court robes, flowing
- Carries a carved bone staff with a softly pulsing tip (replaces the herald's glowing staff)
- Soft, knowing smile; eyes that look like they see through walls
- Smaller frame than Bram; moves with deliberate quiet

**Voice — ElevenLabs:**
- Target: whispery, smooth, slightly conspiratorial British male
- Current voice: **Daniel** (`onwK4e9ZLuTAKqWW03F9`) — British, measured; distinct from Bram’s George voice
- Voice settings: `stability: 0.85` (very consistent), `similarity: 0.90`, `style: 0.10` (restrained, no theatrical peaks)
- Note: if a softer/more whispery voice is found in ElevenLabs library, swap. George is the best available British male from the pre-made set.

**Role:** `'virus'` in `CourtRole`. Onboarding guide, court advisor, milestone tracker, settings helper. Does not write code or generate assets.

**Voice commands:** `"Virus, help me"` · `"Virus, open settings"` · `"Virus, mark milestone done"` · `"Virus, what's next"`

---

#### Guided first visit and returning sessions (revised 2026-10-25)

1. Only Virus and his role button appear at the entrance. The user clicks or pinches to begin and enable audio.
2. Virus opens his own head and demonstrates the available brains. The user can swap by selecting a symbol or saying its name; “cloud” is treated as Claude in this specific context. Continue is always visible during this lesson.
3. Virus demonstrates point-and-pinch on visible orbs. Desktop users can click. Neither demonstration silently succeeds after a timeout.
4. Virus asks for the idea and intended audience. His assigned brain drafts 1–3 milestones and requirements through `/api/court/plan-idea`. The user is not required to invent milestones. Invalid model output is rejected before saving.
5. Virus opens the gate and visibly moves into the court. The camera transitions on desktop; VR uses a seated recenter rather than a forced moving camera. Reduced-motion mode skips travel animation.
6. Characters and their role buttons appear as Virus introduces them. The plan and suggested milestones are then shown for review, revision, or explicit build approval. A finished build opens the running preview.

**Returning:** Completion belongs to the project, not the shared server or provider settings. A returning user selects Continue with Virus to resume the saved plan or build. An unfinished project receives guidance rather than an idle advisor. Virus remains available after onboarding.

**Action commands:** “Take me to court”, “show code”, “review the app”, “open settings”, “show milestones”, and zone navigation execute application actions before ordinary AI conversation. Generated code is readable in a desktop source dialog and a paged in-world VR panel. Before a build exists, the guide explains the next step instead of pretending there is code to show.

**Availability:** Cloud Muse is visibly disabled in the desktop picker, omitted from selectable in-world tokens, and rejected by the brain-assignment API. It never silently uses Gemini. Local Muse remains available when its CLI is installed. Virus uses his actual assigned provider for planning.

**Interruptions:** Opening settings pauses the guide. Closing the dialog resumes it. Restarting the tour cancels pending waits and scene travel. Navigation requests made during a model request are carried out immediately where possible or visibly queued. A cancelled guide cannot mark onboarding complete.

**Speech:** Each narration beat completes before the next starts; unnecessary timed pauses are removed. ElevenLabs PCM output is requested through its query parameter and validated before WAV wrapping. Stopping playback releases the old narration wait without affecting a newer speaker.

**Verification:** Automated browser coverage exercises the first visit, transcription context, milestones, progressive introductions, re-entry, approval, preview and source viewing. Backend tests cover per-project completion, assigned-brain planning, output validation, and unavailable-provider rejection. Physical Quest comfort and microphone recognition remain hardware-validation tasks.

---

#### Character: Mira — The Artiste (5th Character)

Mira is the court's visual creator. She generates logos, icons, brand marks, and illustrations on request. She does not write code — she makes things beautiful.

**Visual design:** Feminine, ink-stained robes, carries a floating canvas. Quick hands, always sketching. Positioned at the edge of the court (right side, near where the Meeting Room arch begins).

**Voice — ElevenLabs:** Lily (`pFZP5JQG7iQjIQuC4Bku`) — warm, raspy. Currently used for Elara. Mira needs a different voice. **Candidate: Dorothy** (`ThT5KcBeYPX3keUQqHPh`) — pleasant, young British female. Alternatively a new voice from the ElevenLabs library.

**Role:** `'artiste'` in `CourtRole`.

**Brain assignments:**

| Brain | Provider | What it does |
| --- | --- | --- |
| **Nano Banana Pro** (default) | `models/gemini-3-pro-image` via Gemini API key | Image generation — logos, icons, illustrations |
| **ChatGPT** | DALL-E 3 via OpenAI API | Alternative image generation with different style |

**What Mira produces:**
- PNG images saved to `.sovereign/builds/<project>/assets/<uuid>.png`
- Displayed in the court on a floating canvas surface (texture plane in Three.js)
- Also shown in the Meeting Room on a dedicated panel
- User says: *"Mira, make a logo for [project name]"* or *"Mira, draw [description]"*

**Technical requirements:**
- New `/api/court/generate-asset` endpoint
- Gemini image API call: `POST /v1beta/models/gemini-3-pro-image:generateContent` with image response type
- DALL-E 3 fallback: `POST /v1/images/generations` (OpenAI API)
- Response: base64 PNG → save to disk → return URL
- Display: Three.js `TextureLoader` loads the PNG onto Mira's canvas surface
- Output schema: `{ imageUrl: string, description: string, speech: string }`

**Milestone connection:** If Mira generates a logo and the user approves it, that can be tagged as a milestone achievement (e.g., "Brand identity complete").

---

#### Project Charter — Data Model

```json
{
  "idea": "A task management app for indie developers",
  "milestones": [
    {
      "id": "m1",
      "title": "Working task board",
      "created": "2026-10-25T14:00:00Z",
      "achieved": null,
      "buildVersion": null,
      "thumbnail": null
    },
    {
      "id": "m2",
      "title": "Brand identity (logo + colours)",
      "created": "2026-10-25T14:00:00Z",
      "achieved": null,
      "assetUrl": null,
      "thumbnail": null
    }
  ]
}
```

Milestones marked `achieved` when: user says *"Milestone [name] is done"*, Virus confirms, Bram tags a build to it, or Mira's asset is approved.

---

#### Wave 3 Implementation Tasks

- [ ] Rename `steward` role → `virus` in `CourtRole`, `characters.ts`, `brains.ts`, `court.mjs`
- [ ] Add `artiste` role → `CourtRole`, `characters.ts`
- [ ] Virus character model: bald, robed, bone staff, purple/charcoal palette
- [ ] Mira character model: ink robes, floating canvas, positioned court-right
- [ ] Garden exterior scene: courtyard geometry, hedges, castle gate visible ahead
- [ ] Spawn point at garden (not inside court) on first launch
- [x] Action-driven guided flow with explicit demonstration steps and per-project completion
- [ ] `stewardCommand()` / `virusCommand()` parser for voice commands
- [ ] Milestone capture UI (voice + text input during Step 3)
- [ ] Hand gesture practice targets (floating interactive orbs, Step 5)
- [ ] Castle gate opening animation (Step 6 transition)
- [ ] `/api/court/generate-asset` endpoint (Nano Banana Pro + DALL-E fallback)
- [ ] Mira canvas surface texture display in Three.js
- [ ] ElevenLabs voice for Virus: George (`JBFqnCBsd6RMkjVDRZzb`) with low style (0.10)
- [ ] ElevenLabs voice for Mira: Dorothy (`ThT5KcBeYPX3keUQqHPh`) or new voice
- [ ] `onboarded: true` written to `connection.json` after Step 10
- [ ] Wall of Fame pre-population with empty milestone frames after Step 3

---

### Wave 5 — Visual Interactions *(Week 3: Nov 9 – Nov 15)*

**Goal:** Make key interactions physically satisfying in a way that only works in VR.

**Royal Seal for Approval** — highest priority
Elara places a scroll on the table. User picks up a glowing wax seal from the throne arm and presses it down. Scroll lights up, Bram begins. Replaces the "Approve plan" button entirely. Directly targets the Boldest Original Concept award.

**Bram's Build Delivery**
Build complete → Bram walks forward, sets a glowing tablet on the table. Picking it up triggers review mode. Replaces the "Review work" button.

**Zone Archways**
Visible glowing archways at ±90° from the court. Meeting Room arch pulses when the team is active. Seen in peripheral view before turning.

**Character Attention Ring**
Selecting a character raises a faint ring of light from the floor around them; they step forward, others dim. Replaces flat UI selection highlight.

**Milestone Banner Unfurl**
When Edmund marks a milestone achieved, a banner drops from a mounting point on the Wall of Fame — cloth unfurl animation, title embroidered. Empty frames are dark fabric; achieved ones are lit banners.

**Speaking Orb**
Activating the microphone summons an orb from the throne arm. It pulses with voice amplitude and floats toward the addressed character. Replaces abstract mic button.

---

### Wave 6 — FoV Audit + Performance *(Week 3: Nov 9 – Nov 15)*

**FoV rules (enforced, not guidelines):**

| Element | Horizontal limit | Vertical limit |
| --- | --- | --- |
| All 4 characters from throne | ±40° | ±20° |
| Captions, proposals, brain picker | ±30° | -20° to +10° |
| Critical actions (Approve, Mic, Send) | ±25° | — |
| Zone indicators | ±35° | — |
| Wall of Fame cards (browsed by turning) | ±60° | — |

**Performance targets:**

| Metric | Target |
| --- | --- |
| Frame rate | 72Hz sustained on Quest 3 |
| Frame budget | ≤13.9ms (JS + GPU) |
| Character draw calls | ≤8 total (4 chars × 2 meshes) |

**Tasks:**
- [ ] Profile with IWER Quest 3 emulation in Chrome DevTools
- [ ] Audit all positions against FoV rules in `src/scene.ts` + `src/spatial-ui.ts`
- [ ] Zone culling (deferred from Wave 4)
- [ ] Cap blink/breath animations at 30Hz
- [ ] Verify `createImageBitmap` async texture upload for JPEG frames
- [ ] Confirm `#fps` element works in XR presentation mode

---

### Wave 7 — Polish & Demo Recording *(Week 3: Nov 9 – Nov 15)*

**Goal:** Submission-quality materials.

- Workspace selector in Settings dialog + CLI flag `--workspace`
- Edmund post-onboarding availability (voice commands, staff pinch in VR)
- In-world help updates for new zones and interactions
- IWER / XR Simulator recording setup
- Record 3-minute demo video:
  - 0:00–0:30 Court overview
  - 0:30–1:00 Edmund onboarding
  - 1:00–2:00 Elara → Bram → Iris flow with Royal Seal
  - 2:00–2:30 360° zone tour (Meeting Room + Wall of Fame)
  - 2:30–3:00 Achievement card appearing
- Upload to YouTube (unlisted or public)

---

### Wave 8 — Submission *(Buffer: Nov 16 – Nov 18)*

- [ ] Join Meta VR Start Program (if not done)
- [ ] Devpost account created
- [ ] Devpost form completed: URL, video link, description, Division, Track
- [ ] Final QA on `167.71.227.218:5443` in Quest Browser (or IWER)
- [ ] Submission text: articulate the 10-minute experience, why it only works in VR, list significant updates

---

## Technical Architecture

### Local Mode
```
Quest Browser / Desktop
  Three.js WebXR scene
    ├── Hand tracking → character / brain / zone / seal selection
    ├── CourtVoice → GET /api/court/voice → ElevenLabs (TTS_PROVIDER=elevenlabs)
    │                                      → speak.ps1 fallback (OneCore/SAPI5)
    ├── CourtMicrophone → Browser Web Speech API (en-US, any accent)
    │                   → POST /api/court/transcribe → transcribe.ps1 (fallback)
    └── JPEG frames ← WebSocket :5443
  Node.js server (SOVEREIGN_MODE=local)
    ├── /api/court/converse → spawn muse | claude | codex
    ├── /api/court/build    → spawn assigned builder CLI
    └── /api/court/voice    → ElevenLabs API | PowerShell SAPI5
  Preview bridge :4175 → Playwright Chromium → board :4174
```

### Brain → Provider Mapping

Each character has an independently assignable brain. The brain determines which AI provider handles that character's conversations and builds. Muse ≠ Gemini — they are distinct providers.

| Brain | Local mode | Cloud mode | Model | Status |
| --- | --- | --- | --- | --- |
| **Muse** | Meta Muse Code CLI | Meta Llama API (`api.llama.com/compat/v1/`) | `Llama-4-Scout-17B-16E-Instruct` | ⚠️ Disabled — API key `invalid_api_key`, needs regeneration |
| **Claude** | Anthropic Claude Code CLI | Anthropic API | `claude-sonnet-4-6` | ✅ Working |
| **ChatGPT** | OpenAI Codex CLI | OpenAI API | `gpt-4o-mini` | ✅ Working |
| **Gemini** | Cloud only (no local CLI) | Google Gemini API | Conversation: `gemini-flash-lite-latest` · Build: `gemini-flash-latest` | ✅ Working · Default cloud brain |

**Important distinction:** Gemini (`gemini-flash-lite-latest` / `gemini-flash-latest`) is not a replacement for Muse — it is a separate 4th brain with its own logo and provider identity. Using Gemini as the default cloud brain is a temporary measure while the Meta Llama API key is resolved. When Muse is re-enabled, Gemini and Muse will be independent selectable options per character.

**The model split within Gemini** (Flash Lite vs Flash) is an internal Gemini routing decision only — it applies when a character's brain is set to Gemini. Characters assigned Claude or ChatGPT use a single model for both conversation and builds.

### Cloud Mode (167.71.227.218)
```
Quest Browser / Any Browser
  Three.js WebXR scene (identical)
    ├── CourtVoice → ElevenLabs API (server-side) | browser speechSynthesis fallback
    └── CourtMicrophone → browser Web Speech API (no server transcription)
  Docker container (SOVEREIGN_MODE=cloud)
    ├── /api/court/converse → Gemini Flash Lite (default) | Claude | GPT-4o-mini | Llama (disabled)
    ├── /api/court/build    → Gemini Flash (default) | Claude | GPT-4o-mini | Llama (disabled)
    └── /api/court/voice    → ElevenLabs API
  VPS: Docker + env file (API keys, TTS_PROVIDER=elevenlabs)
```

### 360° Scene
```
         [BEHIND 180°]
      Wall of Fame
   (milestone banners)

[LEFT 270°]  [YOU]  [RIGHT 90°]
Personal             Meeting Room
Workspace            (table + screen)
(passthrough)

         [FRONT 0°]
       The Court
  (Edmund · Elara · Bram · Iris)
```

---

## Things Required From You

| # | Action | When |
| --- | --- | --- |
| 1 | ✅ **Join Meta VR Start Program** | Done 2026-10-25 |
| 2 | ✅ Meta developer account **Developer Access** confirmed | Done 2026-10-25 |
| 3 | ✅ **Registered on Devpost** | Done 2026-10-25 |
| 4 | ✅ **ElevenLabs API key** (`sk_...`) obtained | Done 2026-10-25 |
| 5 | ✅ Anthropic API key | Done 2026-10-25 |
| 6 | ✅ OpenAI API key | Done 2026-10-25 |
| 7 | ✅ Gemini API key | Done 2026-10-25 |
| 7b | ⚠️ **Meta Llama API key** — `invalid_api_key` on `api.llama.com/compat/v1/`. Endpoint is correct; key needs regeneration at [api.llama.com](https://api.llama.com). Muse disabled in cloud until resolved. | Blocked |
| 8 | ✅ All working keys in `sovereign.env` on `167.71.227.218` | Done 2026-10-25 |
| 9 | **Record 3-minute demo video** (IWER on desktop is fine) | Wave 7 |
| 10 | **Upload video** to YouTube / Vimeo (public or unlisted) | Wave 7 |
| 11 | **Complete Devpost submission form** | Wave 8 |

---

## Deployment — 167.71.227.218

- **OS:** Ubuntu 24.04, RAM upgraded, Docker v29.9.2 installed
- **Port 5443:** Open in UFW firewall (Sovereign WebXR HTTPS)
- **Coexists with:** droneshows.in on Caddy (ports 80/443, Cloudflare-only) — no conflict
- **TLS:** Self-signed cert at container startup (same Quest workflow as LAN dev)
- **Container restart policy:** `--restart=always`
- **State:** `.sovereign/` volume-mounted for project persistence

---

## Out of Scope

| Item | Reason |
| --- | --- |
| Multiplayer / shared court | Too large for 3 weeks |
| Mobile (iOS / Android) | Not a Meta VR device |
| APK / native Quest build | WebXR is the submission path |
| Meta Ray-Ban glasses support | Different input model |
| Arbitrary repository execution | Security boundary |
| API key management UI | Keys are server env vars |
| User accounts / auth | Local personal tool |
| Custom domain / CDN | IP + self-signed cert sufficient for Quest Browser |
| Non-English language | Rules require English |
| Voice cloning | Post-competition (default voices expire Dec 31) |


### Build reliability (2026-10-25)

Cloud builds run as background jobs. The browser polls progress through short requests, so a long model response does not exceed the public proxy request window. Reloading reconnects to a project's active build request. Failed jobs retain the previous application and show a retryable error.

When Gemini is assigned to Bram, code generation uses `gemini-3.8-flash` (overridable with `GEMINI_BUILD_MODEL`), low thinking, and an explicit output schema; conversational planning still uses Flash Lite. This is internal Gemini routing and does not override another provider assigned to Bram. Truncated model output is rejected instead of being reported as a completed app.

### Arrival, conversation and waiting experience (October 25 revision)

- Paint a lightweight loading screen before the 3D bundle executes. Rotate original coding-court sayings every four seconds; show retry when loading fails or takes unusually long.
- On a fresh desktop visit, descend from a wide castle aerial view to the garden gate in a skippable 6.5-second shot. Reduced-motion users and immersive VR enter without camera travel.
- Keep one compact caption and instruction bar. Hide duplicate character nameplates on desktop; show only introduced characters. Brain settings and conversation history remain available in Settings. Show the tutorial’s Continue action only when needed.
- Selecting the microphone enables hands-free conversation for the current page session. Listen again after each reply; pause capture during speech generation/playback, build work, noninteractive tour stages, hidden pages and settings dialogs. Selecting the microphone again or saying “stop listening” disables it. Browser permission is required once; recognition errors stop automatic retries. Speech input accepts the user's own accent.
- Approving a plan immediately collapses its details and shows elapsed time with actual server stages: queued, generating files, saving files, and browser checks. Decorative quotes do not represent percentage completion. Open the application as soon as checks finish, without waiting for narration.
- Preview WebSockets validate the public forwarded hostname behind the deployment proxy. Disconnection and missing frames must show a recovery state rather than an endless opening message.
