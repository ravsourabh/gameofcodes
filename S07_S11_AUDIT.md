# S07/S11 animation expansion

October 28, 2026. The supported Microsoft/Rocketbox animation subset is released
on gameofcodes.si. S11 as a whole is not complete.

Current hosted release: `studio-8ee57f867e44dfbd`. Public checks confirmed the
110-action director catalogue, exact tested motion-pack hash and empty MetaHuman
catalogue. Three checks against the hosted frontend passed (responsive panels,
reversible motion preview/attachment and emulated native Quest menus), using an
isolated test service rather than changing any hosted user records. Both
deployments retained all 454 pre-existing saved files unchanged.

The 125-action inventory now has 110 explicit bindings and 15 actions that still
need stage/partner choreography. See [the per-action matrix](S07_S11_COVERAGE.md).
Related actions may share a clip; 110 bindings do not mean 110 distinct mocap
recordings.

## Implemented

- 36 native motions from the official Microsoft Rocketbox library, pinned at
  `0943055db6ec570bcef9f2c8b41c9e5467c808f9`. Source URLs/hashes and MIT licence
  accompany the runtime pack. Source FBXs remain in ignored build storage.
- Direction-based retargeting preserves each destination rig's limb lengths;
  recorded playback uses its own clock, with interpolated source motion.
- Seated/standing transitions, chair clearance, jumps/hops, standing and seated
  dance, listening/speaking motion, fatigue, doze/sleep/wake and comedy reactions.
- Contact IK and local geometry for paper, pen, cup, microphone, laptop and watch;
  a tabletop guard, planted seated feet and standing floor correction. Desktop
  props remain in place when an actor turns to camera two.
- Facial reactions reuse available shapes and preserve final-audio visemes.
  Blinks, frowns/brows and laughter motion are distinct from speech articulation.
- Direct reactions offers family/search/paging, reversible Preview and Reset,
  then explicit Attach to saved line. Preview does not mutate an episode. New
  cues replace conflicting lanes while retaining speech. Drinking, sleeping and
  yawning on the actor's speaking line require a listener/silent beat instead.

## Verification

The seven actual bundled Rocketbox rigs, including the reserved custom host,
were sampled at five points across all 110 bindings: 3,850 pose samples. Checks
covered finite joints, head/table and floor bounds, reset, deterministic seeking,
speech closure and reduced-motion jump amplitude. Representative drink,
facepalm, paper/pen/laptop, sleep and dance images were visually inspected;
contact/orientation defects found in the pass were corrected.

Domain/service tests and the production-build browser checks cover reversible
previews, explicit cue attachment, unchanged saved speech, native Quest controls
and both horizontal/vertical exports. A development-run export was interrupted
by page reload; the production-build export checks passed. Ignored local QA is
under `.sovereign/review/motion-matrix/` and `.sovereign/motions-*.log`.

The optional MetaHuman adapter is a separate asset integration. Synthetic-rig
adapter tests do not extend this real-character verification to Epic assets.

The hosted release contains 36 pinned native clips and 110 bound actions. Its
MetaHuman catalogue is empty and experimental avatar controls are hidden in the
desktop and headset menus. The rejected Epic GLB is not part of this release.
The browser build, reversible-preview/attachment flow, responsive panels, both
MP4 export formats, and emulated Quest controls passed against the frozen release
candidate. The seven-rig matrix was rerun: 3,850 pose samples, no reported joint,
floor, reset, seeking, closure or reduced-motion failures. This is limited
technical/visual evidence, not a claim of physical Quest performance or complete
human quality acceptance for every action. Release evidence and manifests are in
`.sovereign/releases/motion-browser/`. Saved production data is backed up and
checked before/after deployment; no Git commits were made.

## Open acceptance

Walking/travelling/seat changes, entrances/exits, group dance, handshake,
high-five, note handover and staged falling/stumbling remain unavailable.
They need destinations, partner contact and collision-safe stage choreography.
Per-actor vocal laughter/performance audio, sustained hold/interruption quality,
broader human review and physical Quest frame time remain open. Existing
audience-laughter audio is not evidence of individual character vocal laughter.

Unfinished media understanding and advanced media-grounded timelines are now
S16, last/future; existing GIF/video playback, saved media and export stay intact.
