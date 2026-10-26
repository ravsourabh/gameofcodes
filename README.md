# Game of Codes · Make room for perspective

A seated WebXR experience for discussing problems, making decisions, and rehearsing real situations. The complete requirements and delivery waves are in [PRD.md](PRD.md).

## Current implementation: Waves 1–6

Virus is visible when the app opens. Choose **Quick practice** or **Start talking**, then describe the situation in one sentence. Your words save first; Virus proposes a short readback, room, goal, constraints, criteria and useful roles. Correct the readback or choose **That’s right**, mix new people with saved characters, then **Review room & cast → Approve setup**. In discussion mode, **Start discussion** explicitly opens the floor. Browser profiles separate saved sessions and character libraries.

Characters discuss the reviewed situation through their own assigned brains, refer to committed arguments, answer directed challenges and retain their current positions. Roundtable, hearing and adversarial verbal formats share pause/resume, giving the floor, simpler explanations, examples, evidence requests, challenges, switch-sides and summary controls. Typed corrections save as exact user words and update a durable working topic before another turn. All later speakers receive that topic and the correction history, including after reload or a brain swap; the original setup/transcript remains historical evidence. **One contribution** advances once. **Stop/Finish** saves a partial summary; it does not invent a final user decision.

Group discussion requires at least two real cast members. With only one, **Discuss with others** or “discuss it with others” invites two complementary AI perspectives, saves them in the reusable library and opens the actual group exchange. They initially inherit the current character's selected brain/voice, which can be changed individually. Interrupted invitations resume their saved identities without generating duplicates. **One-to-one coaching** is an explicit alternative. An essential question for the human pauses both scheduling and the clock; answer it or choose **Continue with assumptions**. Repeated intent questions and retired-topic drift get at most one model repair, then pause with an actionable error. See [the conversation repair audit](CONVERSATION_REPAIR_AUDIT.md).

The scheduler allows at most 20 group contributions within the approved duration, alongside the server's model/audio request budgets. Invalid/repeated output, provider failure, loss of connection or voice failure pauses automatic scheduling. Voices are coordinated one at a time; Quiet mode leaves reading time between contributions. Reload opens an interrupted discussion paused. A guide explanation, model/roster edit, Repeat, settings or leaving VR yields the floor first; resuming is an explicit user action.

The throne court now surrounds the discussion with stone arches, windows, banners, a throne/dais, presenter circle and waiting bay. **Drag** or use arrow keys on the scene to look around; **Home** returns to the throne view. VR head movement stays under the user's control. Participants show real thinking/speaking states and turn their attention toward the speaker.

Select a participant to inspect their guiding code, current/earlier view and latest reasoning on the left. Selection leaves the speaker talking; **Give floor** explicitly pauses and redirects. The judgement surface on the right remains unrated until ratings exist; point awards/presenters arrive in W07. **Controls** reveals secondary discussion actions, and **Tools** reveals optional guide/header links. Native VR has small caption/action/information surfaces; its full panel opens for detailed controls, text entry or the studio.

**Characters** opens the avatar workshop. Point at a character's head/body or select a feature, try visual options directly on the 3D character, keep a feature while shuffling the rest, or speak/type a description for an AI suggestion. **Join the room** saves and adds the character in one action. New previews stay temporary until accepted. Saved characters use the same workshop; name, role and guiding-code edits are optional small controls. The primary journey has no scrolling appearance form or repeated Save buttons.

The app uses a fixed viewport, one current guide choice group, paged notes/readbacks/context and native hand controls. **Details** keeps the optional form available, **Saved** opens history and **Ask freely** enables direct conversation. **Help** offers practice and simpler explanations. The introduction records actual guide selection, confirmed input, interruption/giving the floor and optional brain inspection; explicit skips remain distinct. Reload resumes saved progress. Core actions are designed for the first five minutes; the complete timed journey and optional scoring/presenter/rehearsal lessons connect in Waves 5–10 and still need unfamiliar-user/physical-headset validation.

**Add context** accepts pasted text and `.txt`/PDF files under 2 MB. Review the paged excerpt before it is shared: at most 12 PDF pages/12,000 characters per item, four items and 24,000 characters total. Encrypted/scanned/unreadable PDFs need a pasted excerpt; no OCR is claimed. Only reviewed text reaches model requests. Notes distinguish exact user statements from proposed interpretations, and save failures retain a retry path.

Virus and active characters now accept real typed or recorded input with captions, speech, Repeat, Quiet mode and immediate interruption. Choose a character to address them; open **Brain & voice**, or select their head twice, to inspect/change assignments. The connected cloud catalogues supply model choices, with actual response provenance saved per reply. Voice choices include connected OpenAI voices, permitted ElevenLabs voices and explicit device speech. No provider is silently substituted after failure.

Direct requests such as **“open your brain”**, **“show notes”**, **“help”**, **“quiet”** and **“repeat that”** operate the matching controls before conversation or avatar generation. They share the typed/transcribed/in-world input path. Quoted instructions and ordinary questions about brains/models remain conversation; generated replies do not execute interface actions.

Quest supports native hand selection for avatar features, visual choices, joining, brain/voice choices, voice preview, pacing, speech input, group controls and a small in-world keyboard. Detailed identity/role text editing currently uses the desktop control; complete hands-only journey validation remains W10 work. Final throne staging, scoring, presenters and panel rehearsal/feedback remain subsequent waves.

**Human avatars throughout:** the room, Character Studio, previews and VR use six bundled Rocketbox people by default, including older session links and browsers with the former classic preference. A character keeps its selected body through room/editor changes, cast reordering and reload. Choose a person, tint their clothing, add supported accessories, or describe the closest look to the AI. Faces, hair and clothing cut belong to the selected person; independent modular hair/clothes require later compatible art. Model loading has an explicit retry and never substitutes a cartoon. See [ASSETS.md](ASSETS.md).

The new runtime starts without the retired application-preview service or a headless browser. Existing records and artifacts remain preserved. [Wave 1](WAVE_1_AUDIT.md), [Wave 2](WAVE_2_AUDIT.md), [Wave 3](WAVE_3_AUDIT.md), [Wave 4](WAVE_4_AUDIT.md), [Wave 5](WAVE_5_AUDIT.md) and [Wave 6](WAVE_6_AUDIT.md) record delivery, verification and constraints.

## Run

Requires **Node.js 22.13+ or Node 24** (including PDF text extraction).

```powershell
npm install
npm run dev
```

Open **http://localhost:5173/** on this computer. For Quest, open the printed **HTTPS Network URL on port 5443** in Quest Browser on the same Wi-Fi, enable hand tracking, and select **Enter VR**. The development certificate may need to be accepted or replaced by a trusted development certificate. No controller or model connection is needed for the room/character-selection and save paths.

The session service binds to loopback on port **4176**. Vite proxies `/api` to it from the desktop and headset endpoints. Ports 4174/4175 and `/api/court/*` are not part of the default session runtime.

## AI configuration

Put server keys in ignored **`.env.local`**, following `.env.example`, then restart `npm run dev`. One of `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` enables that provider's model catalogue. OpenAI also supplies cloud speech/transcription. `ELEVENLABS_API_KEY` is optional and needs voice-catalogue read and speech access. If its key lacks `voices_read`, the app reports the restriction; OpenAI/device voices remain separate choices. Never use a `VITE_` prefix for secrets. Local environment files are excluded from Git and Docker build context.

Catalogues establish listed choices, not guaranteed inference access for every model. Requests can still fail because of model access, permissions or usage balance; the user explicitly chooses a replacement. The new session runtime currently supports cloud model calls. The retained local CLI adapters have not been generalised/verified for per-character session model selection and are not offered as connected choices.

## Saved sessions and compatibility

- New data: `.sovereign/sessions/v1/<profile-id>/<session-id>.json`.
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

## Retained legacy regression fixture

The outgoing source and tests remain available for migration/regression work. They do not supply the current default entry or service. Stop the ordinary development server first, then use:

```powershell
npm run dev:legacy
```

The retained browser suite is available through `npm run test:legacy`; it starts its own legacy server and needs the test browser. Legacy unit tests remain in `npm run test:unit`. The legacy fixture is development-only, uses the old data paths, and is not a prerequisite for the new session shell.
