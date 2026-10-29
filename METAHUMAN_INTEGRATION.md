# Optional MetaHuman rendering

October 28, 2026. The GLB experiment works mechanically but **failed visual acceptance**. Its altered neck, procedural collar, clothes and material approximation are not an acceptable MetaHuman result. Do not deploy that character or treat it as the new Unreal flow. The browser animation release uses Microsoft Rocketbox characters only.

## Browser and Unreal separation

The existing browser studio stays the production experience at gameofcodes.si.
Its semantic actions, saved characters, writer/director, final voice recordings,
captions and episode/take storage remain the common product foundation. The
experimental MetaHuman GLB controls now require the explicit local build flag
`VITE_GOC_AVATAR_LAB=1`; they are hidden by default. A browser release must contain
an empty MetaHuman catalogue and no experimental Epic GLB files. Its immutable
release manifest is assembled from the current live baseline plus reviewed
animation changes, preserving unrelated live fixes.

The new Unreal path should be a separate renderer, not another AI writing flow:

1. Keep the current browser producer workspace. Add an explicit **Cinematic
   render (Preview)** output only after the Unreal worker passes acceptance.
   Choose an engine per output/take, rather than using a per-character checkbox
   to imply that a browser can execute Unreal assets.
2. Create a dedicated `unreal/StudioRenderer/` project and a separate GPU render
   worker deployment. Keep Unreal assets, plugins and build outputs outside the
   browser's public assets and Node image. The current `scripts/metahuman/`
   project is only a conversion experiment, not that renderer.
3. Define a versioned show package from an accepted, immutable take: source take
   ID/revision, character IDs and profile snapshots, exact dialogue, final audio
   hashes, mouth-cue timing, semantic action/gaze/prop cues, camera shots, pauses,
   music, captions and set configuration. Engine-specific bones, materials and
   animation asset paths belong in each renderer's adapter and asset manifest.
4. Unreal maps that package to its native MetaHuman rigs, facial animation,
   native motions, cameras and lighting. Reuse the saved audio and timing; do not
   rewrite dialogue, recreate personalities or silently regenerate voices.
   Report unsupported actions explicitly. A format-valid asset is not a visual
   quality approval.
5. Persist a separate render job/output with renderer ID/version, engine and
   asset versions, source take ID, status, progress and result. New Unreal renders
   never overwrite episodes, browser takes, original WAVs or older exports.
   Missing renderer metadata on existing records continues to mean browser.
6. First prove one untouched, properly assembled MetaHuman with native body,
   clothing, materials, Hindi delivery and representative actions inside Unreal.
   Then prove a multi-character newsroom episode and compare timing and cameras
   against the same accepted browser take. Release the video-render option only
   after visual and export acceptance. Physical Quest remains a separate test.
7. Add Pixel Streaming later if live interactive Unreal direction is needed.
   It has a separate GPU/session/networking lifecycle; it should not replace the
   stable browser experience during development.

Keep release identities and rollback independent: a browser deployment changes
the website image; an Unreal worker deployment changes the native renderer.
Both consume the same versioned show package and owned media APIs. No rewriting
or migration of existing shows is required to start the Unreal prototype.

In the explicit local avatar lab, Settings contains **Enable MetaHuman avatars** and **Choose per character**. The
first enable assigns the available imported sample to the channel host. Other
people retain their current Rocketbox identities. Choices can be changed per
character. Disabling the checkbox restores current avatars and retains the
MetaHuman assignments for later. Character records, personalities, voices and AI
models are not rewritten by a rendering selection.

The preference belongs to the room. New accepted takes snapshot it; derived
editions inherit their parent's appearance. Existing takes without this field
use the original avatars. Replaying/exporting a saved take uses its snapshot,
not a later room preference.

## Asset state and official source

The character source is Epic's [MetaHuman Crowd Sample on Fab](https://www.fab.com/listings/5f481d73-afb1-4d94-ba6e-7cabf5d296fa),
installed through Epic Games Launcher. The creator approved the Fab EULA and
using an official Epic sample. Epic's earlier OpenRigLogic Sample Content
contains only `Sample.dna` and `faceboard.json`, including its Unreal package;
it does not supply a character mesh. No Rocketbox character is relabelled or
shipped as a MetaHuman.

The selected source is `AverageMale_Head01`. Local Unreal inspection confirmed
its separate face/body meshes, native skeletons and baked material assets. Its
face has no conventional morph targets: facial deformation comes from the
native post-process animation blueprint and RigLogic. Those evaluated poses
must be baked into the GLB before the switch can be enabled.

The format-valid experimental import is `epic-average-male-01-v1`. The lab checkbox becomes available
when its GLB and catalogue hash pass inspection. The first sample is bald, with
portable clothing and materials; this does not reproduce Unreal's strand grooms
or full cinematic skin shader. A manifest entry alone is not acceptance evidence.

## Portable character contract

The current browser adapter consumes a self-contained glTF 2.0 binary GLB with:

- One combined body/face/clothing skin and the standard MetaHuman body/eye joints listed
  in `shared/studio/avatar-rendering.mjs`.
- Baked, named ARKit facial morphs for jaw, lip closure, funnel/pucker, smiles,
  blinks and brows. Raw DNA/RigLogic alone is not supported in Three.js.
- Embedded standard PBR materials/textures, card or mesh hair, no required Draco,
  KTX2 or Meshopt decoder, a neutral upright rest pose and measured standing
  height. Files larger than 64 MB fail inspection; this is an import ceiling,
  not a physical Quest performance target.
- Source provenance and the original licence/notice retained beside the model.

Epic's in-engine DCC export is an authoring source, not this finished runtime
format. Assemble body, face, clothes, eyes and hair; combine the skeleton; bake
the facial controls into ARKit shapes; bake compatible PBR materials and export
the GLB. Do not omit facial articulation merely to pass a body preview. Native
RigLogic/WASM integration is not included in this adapter.

Install a completed export from the project directory:

```powershell
node scripts/install-metahuman.mjs --input "D:\exports\character.glb" --id epic-sample-v1 --name "Epic sample" --source https://www.fab.com/listings/5f481d73-afb1-4d94-ba6e-7cabf5d296fa --license "D:\exports\NOTICE.txt" --height 1.75
```

The importer checks bones, morphs, embedded resources and file integrity before
publishing the catalogue entry. IDs are immutable: use a new version ID for a
replacement so existing takes keep their appearance. Click Refresh availability
in Cast appearance after importing. The API inspects public assets locally and
the built `dist` assets in the production image; it does not fetch remote files.
Rebuild/redeploy a production client after importing; availability and rendering
must refer to the same immutable release assets.

## Runtime and failure behaviour

The existing scene and motion adapter remain shared. `src/metahuman-model.ts`
exposes canonical body joints without changing bind matrices or segment lengths.
`RealisticAvatar` normalises standing height, preserves the destination skeleton,
and translates final-audio mouth cues and expressions into baked ARKit controls.
A closing consonant takes precedence over a jaw-open reaction. Model caches are
keyed by provider, model ID and approved SHA-256.

Missing or broken selected assets show an avatar load failure; they are not
silently substituted with a different face. Settings remains available to turn
the option off. Exports wait for ready character assets and retain the take when
loading fails. Unavailable assets never prevent reading existing saved records.

## Evidence and remaining acceptance

Domain/HTTP tests cover per-character selection, ownership, unavailable files,
immutable imports, reversible switches, character preservation and pinned takes.
The browser adapter test uses a clearly labelled **synthetic rig fixture**
derived from the existing MIT model to exercise mixed providers and reloads. It
is never included in the production catalogue and is not an Epic visual test.

The actual Epic asset was sampled in the browser avatar adapter. Its
110 supported actions were sampled at five points each: 550 samples passed joint
and floor checks. Visual checks of rest, standing, gestures, nodding, laughter,
drinking and Hindi articulation revealed unacceptable clothing/anatomy quality.
The creator rejected that appearance; this conversion is not release-eligible.
These checks are specific to this conversion;
joint checks alone do not establish mesh quality or universal rig compatibility.

The real-asset UI test exercises a mixed cast, reload, reversible switching,
per-character assignment, unchanged personalities/voices/episode data, and a new
take with a pinned MetaHuman appearance. Horizontal 1280x720 and vertical 720x1280
MP4 exports completed. Browser export tests use deterministic fixture audio;
the separate Hindi review uses the existing final Sarvam WAV and its Rhubarb
alignment, including PP closure, open vowels and silence. No new voice API call
was required. Evidence is in `.sovereign/review/metahuman/` and the adjacent logs.

Physical Quest 3 frame time and memory remain unmeasured. The rejected MetaHuman
GLB remains local to the explicit avatar lab. The website animation release uses
Rocketbox only; a future native Unreal renderer will be deployed separately.

## Local authoring setup status

Unreal Engine 5.8.4 is installed at `D:\Epic\UE_5.8`. The 8.66 GB MetaHuman
Crowd Sample finished installing successfully at 11:34 IST on October 28,
2026. Native inspection ran successfully in an isolated, headless Unreal
project. The older Fab/Quixel plugin jobs pointed at the failed C: installation;
the sample was installed directly from the launcher's Fab library into D:.

The creator approved a fixed 16 GB D: pagefile while preserving C:. That setting
was recorded, but after the subsequent Windows restart only C: is active and
the measured commit limit is about 19.3 GiB. Do not describe the configured D:
pagefile as active without rechecking. No restart was initiated by this work.

The approved .NET Framework 4.8 SDK installation completed successfully. The
native facial-bake helper compiled and ran with Unreal 5.8.4. Reproducible source
is in `scripts/metahuman/`: run `convert.ps1` with the installed engine/sample and
Blender paths. Builds and licensed intermediate assets remain in the ignored
`.sovereign/asset-build/metahuman/` directory. The script does not acquire content,
accept terms, install software, restart Windows or import an unreviewed revision.

Important conversion details: restore reference offsets for inactive facial
joints; bake the evaluated RigLogic poses; derive mouthClose from native lip
presses; reconstruct BC5 normal Z and convert DirectX normal orientation; retain
native hands while removing the fitting body under clothes; transfer outfit
weights explicitly and add a fitted fabric collar. Every visible character part
must be skinned. The importer now rejects static clothes as well as target names
without baked facial geometry. Retain `scripts/metahuman/NOTICE.txt` with imports.
