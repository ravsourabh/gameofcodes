# Wave 4 — Guide-led setup and core introduction

Implemented locally on October 26, 2026. Public deployment, physical Quest comfort/frame rate and timed unfamiliar-user validation are outside this completion claim.

## Delivered

The default entry is Virus-led. A short sentence saves the user's exact words before inference; a validated model proposal supplies a title, room/mode, format, intensity, goal, constraints, duration, criteria and one-to-five suggested roles. The guide reads back the interpretation for correction/confirmation. Historical readbacks retain their original confirmation state, and corrections preserve the user's earlier words. Actual response-model provenance is saved with the proposal.

The contextual cast picker explains one role at a time and mixes newly generated people with saved characters. New people are created only when invited. Library identity, guiding code, session role and model assignment remain separate. Character controls provide editing/removal/replacement. The final recap needs an explicit **Approve setup** action and saves a `ready` session. It does not start a fabricated group discussion; W05 owns automatic scheduling.

The guide uses a small current choice group with paged readback, notes and context. Details and free conversation remain explicit alternatives. Known direct requests for notes/help/brain controls use host actions. Settings, navigation, workshop inspection and interruption cancel pending guidance; late proposals cannot restart narration or overwrite a changed session. Stable request IDs and resumable multi-step actions preserve acknowledged work when receipts are lost.

Core practice teaches actual guide selection, situation input/readback, interruption and giving a participant the floor. Brain inspection is an optional lesson. Profile/tutorial-version progress records completed/skipped/pending separately and resumes after reload; session records retain the setup stage, guide, notes and lesson envelope. No elapsed timer completes a lesson. Help, repeat, quiet, skip, direct start, speech, typed input and the in-world keyboard remain available. Scoring, presenter and rehearsal lessons stay pending until their later waves.

Context accepts pasted text, UTF-8 text files and PDFs under 2 MB. PDF.js runs in a disposable worker with a 10-second extraction timeout and a bounded heap. It reads at most 12 pages/12,000 characters per file; sessions accept four items and 24,000 characters total. Users review paged excerpts explicitly. Only reviewed text reaches setup inference. Unreadable/encrypted/scanned documents expose a removal/pasted-excerpt path; no OCR is claimed. Original file binaries are not retained. PDF support raises the documented Node minimum to 22.13; verification used Node 24.

## Plan additions from the avatar feedback

- **W04:** one current choice group, paged content and acknowledged saves; explicitly label the stylised editor preview when the realistic room prototype is enabled.
- **W06:** integrate consistent realistic room/workshop previews; persist body identity independently of seat; provide loading/retry/explicit fallback; expose only supported cosmetic controls and connect AI/body-part edits to actual capabilities.
- **W08:** apply that same identity/editor integration to council staging.
- **W10:** validate these paths, paged review and confirmation without scrolling, including short desktop viewports and reloads.
- **W11:** complete compatible modular assets, licensing, facial animation and measured Quest budgets. Three Rocketbox bodies with facial morphs do not constitute modular hair/beard/clothing support.

## Verification

- All 54 unit/service checks pass on Node 24, including note provenance/correction, proposal validation, scoped progress, reviewed-only model context, real PDF text extraction, HTTP ownership/provenance, stale revisions and idempotent proposal replay.
- The 22-check production browser regression suite passed. After the receipt-recovery refinement, the final eight-check guide suite also passed against the rebuilt production client. That covers 23 distinct browser checks overall, including the added lost-progress-receipt check.
- Desktop guide checks cover corrected readback, mixed saved/new cast, explicit approval, reload, lost note acknowledgement, failed proposal retry, context review, late-result cancellation and short viewport layout. Browser AI is an explicit deterministic fixture, using real isolated storage/service boundaries.
- Emulated Quest hands select the actual guide, type a situation through the native keyboard, confirm the readback, invite a character, approve and leave VR without HTML forms. Desktop practice demonstrates actual interruption. Physical tracking/microphone/comfort remain unverified.
- One bounded live service check used requested `gpt-5.4-nano`, with actual response model `gpt-5.4-nano-2026-03-17`. It proposed three research-defence roles, persisted an unconfirmed readback and kept the session in draft. It made one inference request, no speech/transcription requests, and removed its isolated temporary store. Re-run explicitly with `node scripts/verify-session-setup.mjs`.
- TypeScript and the production build pass. The existing large-client-chunk warning remains; physical performance and bundle optimisation belong to W11.

The next implementation wave is **W05: real character-to-character discussion and user intervention**. Complete useful group/rehearsal exchanges, optional five-to-ten-minute lessons and measured onboarding pace require W05/W07/W08/W10. This wave does not claim the entire app or a timed headset introduction is finished. No deployment or cloud configuration was changed.
