# Wave 6 — Throne court and spatial discussion

Implemented and locally verified October 27, 2026; prepared for the existing server deployment.

## Court and presence

The discussion room now has a locally authored stone hall, ribbed arches, colonnades, rose and aisle windows, heraldic banners, lanterns, floor inlay, a sovereign's throne/dais, central presenter seal, lectern and waiting bench. Static architecture is merged by material. The council room remains separate for W08. There are no downloaded environment assets, runtime asset services, dynamic shadow maps or automatic camera tours.

The active cast is centred for its actual size, up to five people plus the guide. Realistic identity remains independent of seat, role or ordering. The guide stands beside the group; participants orient toward the sovereign and look toward the actual speaker. Thinking, speaking, listening and unavailable states drive restrained gestures, gaze, name emphasis and floor rings. The central seal and waiting bay are staging for W07; no fake presenter queue or points are generated.

Desktop dragging/arrow keys turn the view; Home returns to the throne. VR retains user-controlled head movement. No discussion event moves the camera or teleports a speaker. Reduced-motion preferences still suppress idle/speech gestures.

## Less persistent UI

- Welcome/capture instructions share the caption dock, with a small guide choice group. Readbacks, notes and supporting-context review retain explicit pages. Tools reveals optional guide links.
- A running discussion has a small primary control group, captions and speech/type input. Controls reveals one-contribution, finish, guide, reasoning interventions and turn review. Error/retry messages remain visible. Provider failures are also narrated as error captions on the native surface.
- Selecting a participant inspects them without interrupting the current contribution. Giving the floor is explicit and saves the existing W05 intervention. Brain inspection pauses before opening the studio.
- The left surface pages through identity/role, guiding code, current/earlier view and actual latest reasoning. Text is escaped and paged, not inserted as markup or presented as verified evidence.
- The right judgement surface shows actual saved rating counts or a truthful unrated state, plus the agreed criteria. Awarding points and decision presenters remain W07.
- Native VR uses separate caption, action, left-view and judgement surfaces. Captions sit below faces. The large control panel appears for Controls, keyboard input or the studio. Hand rays select the real meshes; HTML is the desktop equivalent.
- Exit and interruption stay available on the native action surface. Detailed menus close after an action; entering/exiting a menu does not resume automatic model work.

## Verification

All 68 unit/service checks and all 35 browser journeys pass in the final production regression run. TypeScript and the production build pass, including release metadata. Browser coverage includes selection without interruption, explicit floor redirection, brain inspection, native caption pass-through, short/zoomed layouts, group cancellation/recovery, native start/pause/finish, keyboard/studio transitions and avatar retry alongside a full guide choice group.

The regression pass exposed and corrected two layout overlaps, a stale test interaction before Join had closed, non-interactive native caption areas intercepting character rays, and transient Windows replacement locks during saved-state updates. State replacement now retries bounded Windows lock errors using the same atomic rename; a persistent failure keeps both acknowledged data and the pending file. It never deletes/truncates the acknowledged destination as a workaround. Two additional service checks verify those guarantees.

Browser automation uses explicit deterministic inference/playback fixtures and real isolated service/storage. Native testing uses IWER Quest hand emulation with real ray intersections. Pixel ratio is fixed at one, the Windows runner uses ANGLE D3D11 on AMD Radeon Graphics, and pinch transitions wait for actual rendered frames. Native journey timeouts allow cold shader compilation. Early software-rendered runs timed out; the final hardware-rendered suite passes. These conditions do not establish physical Quest frame rate or comfort.

`scripts/review-court.mjs` inspected all six actual models at 1466×840 after warm-up, with no browser/shader errors and no provider calls. It reported 83 draw calls, 62,384 triangles, CPU render submission p50 4.0 ms / p95 5.4 ms, and frame cadence p95 33.4 ms at the intentionally capped desktop rate. These are desktop integration measurements, not GPU timing or headset results. The local capture is `.sovereign/review/wave-6-full-court.png`.

Rendering exposes rolling CPU submission timings, frame cadence, draw calls and triangle counts. Inactive rooms are hidden and static court geometry is batched. XR framebuffer scale is bounded at 0.8; desktop pixel ratio remains capped at 1.5 and idle rendering at about 30 Hz. Physical GPU/frame timing, thermal behaviour, microphone/tracking, seated readability and unfamiliar-user five/ten-minute timing still require a physical headset. Independent modular hair/beard/outfit art is not supplied by the six complete human presets; the studio only offers supported edits.

## Release

The existing GitHub main-branch deployment invokes `scripts/deploy.sh`. It serialises activation, keeps the prior image, archives the existing data volume, builds with the Git revision, preserves the Compose volume/environment, verifies discussion/setup capabilities and the served revision, and restores the previous image if activation/health fails. Build failure leaves the prior running container in place. The public host and all saved state/configuration are verified separately after activation. No credentials are committed.

The next wave is W07: user scoring and decision presenters. Physical Quest acceptance remains a release-validation requirement in W10/W11.
