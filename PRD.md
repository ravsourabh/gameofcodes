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
| Characters | 3 (Elara, Bram, Iris) | 4 (+ Edmund the Steward) |
| Onboarding | Cold start, no guidance | Edmund-guided 8-step setup + project charter |
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
- `cloudGenerate()` in `server/providers.mjs` — Anthropic API / OpenAI API / Meta Llama API
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

### Wave 3 — Edmund (4th Character + Onboarding) *(Week 2: Nov 2 – Nov 8)*

**Goal:** A new character who guides the user from cold start to first instruction. Targets the $25k Best First Five Minutes award.

**Deliverables:**
- Add `'steward'` to `CourtRole` union in `src/characters.ts`
- Edmund character model — formal court attire (herald tabard), carries a glowing staff
- Position: forward-centre of court at app load; moves to throne-left after seating
- `stewardCommand()` parser — responds to "Edmund, help me", "Edmund, open settings", milestone commands
- Onboarding state: `onboarded: true` in `.sovereign/connection.json`
- Onboarding sequence (skipped if `onboarded: true`):
  1. Edmund greets, introduces the court
  2. Names and gestures toward Elara, Bram, Iris
  3. Guides WebXR recenter (throne seating)
  4. Asks: local computer or cloud?
  5. Local → opens brain picker per character, checks connections, prompts sign-in commands
  6. Local → prompts workspace directory
  7. Cloud → confirms API keys loaded
  8. Project charter → what are you building? up to 5 milestones
  9. Announces court is open, steps aside

**Project charter / milestone data model:**
```json
{
  "milestones": [
    {
      "id": "m1",
      "title": "Working task board",
      "created": "2026-10-25T14:00:00Z",
      "achieved": null,
      "buildVersion": null,
      "thumbnail": null
    }
  ]
}
```
Stored in `.sovereign/projects/<id>.json`. Milestone marked `achieved` when user says "Milestone [name] is done" or approves a build tagged to it. Edmund confirms aloud.

**The 10-minute first session map** (Best First Five Minutes test):

| Minute | What happens |
| --- | --- |
| 0:00 | App opens. Edmund visible, greets. |
| 0:30 | Edmund names the team, gestures toward each character. |
| 1:00 | User sits on throne (WebXR recenter prompt). |
| 1:30 | Edmund walks through model connection (or confirms cloud is ready). |
| 2:30 | Project charter: user states their idea + 2–3 milestones. |
| 3:30 | Edmund steps aside. User addresses Elara. |
| 4:00 | Elara proposes a plan. Proposal card appears. |
| 5:00 | User approves (Royal Seal stamp — see Wave 5). |
| 5:30 | Bram begins building. Characters animate. |
| 8:00 | Bram delivers build (physical card on table). |
| 8:30 | User enters Meeting Room (right turn) to review. |
| 9:30 | Iris reports checks. First milestone achievable. |
| 10:00 | Edmund announces first achievement. Wall of Fame card appears. |

---

### Wave 4 — 360° Spatial Layout *(Week 2: Nov 2 – Nov 8)*

**Goal:** Four zones accessible by physically turning. Core spatial differentiator.

| Direction | Zone | Content |
| --- | --- | --- |
| Front (0°) | The Court | Elara, Bram, Iris, Edmund. Current setup. ✅ Exists |
| Right (90°) | Meeting Room | Round table, 4 characters, wall-mounted live preview screen |
| Left (270°) | Personal Workspace | Your desk, passthrough enabled, scratch surface |
| Behind (180°) | Wall of Fame | Milestone achievement cards, empty frames for pending |

**Implementation tasks:**
- [ ] Define zone offsets in `src/scene.ts` (Meeting Room: +8m X, Workspace: -8m X, Wall of Fame: -8m Z)
- [ ] Zone detection: track yaw from seated origin, emit zone change event at ±45° boundaries
- [ ] Zone culling: `visible = false` for objects outside active ±90° arc (performance)
- [ ] Meeting Room geometry: round table, 4 chairs, wall screen (reuse board UV mapping)
- [ ] Reposition `PreviewConnection` frame to Meeting Room screen when zone active
- [ ] Wall of Fame geometry: gallery wall, card slots from milestone JSON
- [ ] Personal Workspace geometry: desk surface, blank panel
- [ ] Passthrough: enable Quest passthrough in Personal Workspace zone
- [ ] Zone transition indicator: faint glow/arrow at FoV edge pointing to adjacent zones
- [ ] Desktop fallback: compass rose at viewport edge to rotate camera
- [ ] Edmund first-visit zone announcements

**Wall of Fame card:**
Each card = one achieved milestone. Title, date, build link, preview thumbnail. Unachieved milestones = dark empty frames (visual hook to return).

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

### Cloud Mode (167.71.227.218)
```
Quest Browser / Any Browser
  Three.js WebXR scene (identical)
    ├── CourtVoice → ElevenLabs API (server-side) | browser speechSynthesis fallback
    └── CourtMicrophone → browser Web Speech API (no server transcription)
  Docker container (SOVEREIGN_MODE=cloud)
    ├── /api/court/converse → Anthropic API | OpenAI API | Meta Llama API
    ├── /api/court/build    → same REST APIs
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
| 5 | Get **Anthropic API key** | Wave 1 |
| 6 | Get **OpenAI API key** | Wave 1 |
| 7 | Get **Meta Llama API key** (llama.developer.meta.com) | Wave 1 |
| 8 | Set all API keys in env file on `167.71.227.218` | Wave 1 |
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
