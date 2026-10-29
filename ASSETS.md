# Environment asset inventory

## बात का बवाल broadcast identity

### P01 publishing kit October 30

The [publishing kit](publishing/baat-ka-bawaal/v1/index.html) prepares a dedicated
**Baat Ka Bawaal** channel with the creator-confirmed publisher credit **Game of
Codes Production**. Chhola Bhatura's saved `Male_Adult_05` identity leads the
channel banner and default thumbnail/portrait artwork; Chintu is a separately
labelled supporting example. This does not change casting or appearance in the
running app.

The square profile badge is a built-in image-generation edit of the existing
logo; its original output and exact prompt are retained under the kit's `source/`.
Other artwork is authored as editable HTML/CSS with the original logo and bundled
Noto font. Transparent neutral/smile/surprised cutouts come from Blender renders
of all seven shipped rigs, not invented replacement faces. They use original
clothing; episode-specific tint/accessories must match the actual accepted take.

The kit includes channel and episode artwork, portrait covers, short caption and
nameplate overlays, a watermark, landscape/portrait intro/outro MP4s, audio
excerpts and Hindi/Hinglish public copy. `manifest.json` records output hashes;
`SOURCES.json` and `notices/` retain provenance, MIT/OFL notices and audio credits.
Third-party episode screen media is not cleared by a brand template. The current
runtime branding below remains unchanged; P01 does not connect accounts or
publish anything externally. Final visual acceptance belongs to the creator.

`public/branding/baat-ka-bawaal/logo.png` (transparent) and `banner.png` were generated
with the built-in image_gen tool for the original Hindi comedy show. The prompts
are retained in `concept/baat-ka-bawaal/prompts.txt`. The logo appears on the idle
media screen and on framed, wall-mounted rear signs. `desk-led.png` is the shallow
desk-front variant, generated from the same artwork with the microphone placed
beside the title. Its prompt is retained in `concept/baat-ka-bawaal/desk-led-prompt.txt`.
It fills the desk fascia and uses a lightweight shader for moving light sweeps;
the letters stay still. The sign backs, metal rims, fixing screws and mounting
rails are local geometry. The rails meet the rear wall.
`src/studio-branding.ts` renders the Breaking News header and a carousel of the
actual episode premise on physical set surfaces, including VR and video exports.
It does not generate or invent additional headlines. Animation uses the saved
programme clock during playback/export and respects reduced motion.

The bundled `public/fonts/NotoSansDevanagari.ttf` comes from Google Fonts
(`ofl/notosansdevanagari`), under the adjacent SIL Open Font License. It keeps
the live topic text readable without depending on an installed Hindi font.

The environment uses local Three.js geometry rather than downloaded GLB models.
`src/scene.ts` assembles the spaces; `src/environment-assets.ts` supplies reusable
materials, vegetation, furniture, lanterns and static geometry batching.

| Space | Assets | Improvements in this pass |
| --- | --- | --- |
| Garden | Ground, paving, borders, shrubs, trees, flowers, seats, lanterns, gate | Textured soil and staggered stone joints; leaf and flower instancing; branching tree crowns; raised beds; iron lantern cages; timber gate boards, straps, rivets and ring handles |
| Court | Dais, floor, arch, pillars, planters, desk, throne | Stone colour and bump textures; column bases and capitals; brass trim; upholstered throne; writing mat, cups and foliage |
| Meeting room | Table, chairs, floor, wall, screen | Shared masonry and timber materials; upholstered chairs facing the table |
| Workspace | Desk, books, board, chair, lamp | Shared timber and stone; upholstered chair and caged desk lantern |
| Wall of Fame | Wall, trim, milestone frames and lamps | Shared textured masonry and timber frames |
| Background | Sky, moon, mountain silhouettes | Existing procedural sky and silhouettes retained; exposure and fill balanced for readable materials |
| Characters | Articulated procedural figures and brain tokens | Existing character geometry and interactions retained; figures remain stylised |

All texture generation is deterministic and runs once at scene creation. Colour
maps use sRGB; bump maps use linear height values. Texture resolution is 512×512.
Repeated vegetation uses instance colours. Static details are merged by material;
gate leaves remain separate animated groups. No remote asset services are needed.

Visual review: run `node scripts/review-assets.mjs` with the local development
server running. It captures garden and court images in `test-results/`, reports
render counts and browser errors, and does not call inference or speech APIs.

This is a more detailed procedural environment, not a photogrammetry asset set.
Headset frame rate still requires testing on physical Quest hardware.


## Construction and arrival additions

- `src/construction-stage.ts`: locally authored miniature table stage, abstract assembly blocks, wireframe and orbiting sparks; follows authoritative build phases and respects reduced motion. No downloaded assets.
- `src/scene.ts`: closer castle arrival over extended continuous terrain, reusing the existing soil and stone materials.

## Default human avatars (Rocketbox)

`public/avatars/rocketbox/` holds six people from the
[Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox) library
(MIT, see `LICENSE.md` there): `Business_Male_04` (the guide), `Business_Female_01`
and `Male_Adult_05`, plus `Business_Male_02`, `Business_Female_02` and `Female_Adult_07`. Each GLB was converted from the library's `*_facial.fbx` with
Blender 4.5: textures downscaled from 2048 to 1024 px and stored as WebP, specular maps
dropped, and 23 of the 176 face shapes kept (15 visemes, blinks, jaw open, smiles,
brows). The original three GLBs are 0.9–1.5 MB; the three additional GLBs are 1.6–2.5 MB.

`src/realistic-avatar.ts` poses the T-pose arms at load (relaxed arms, palms inward,
slight finger curl) and animates breathing, a slow weight shift, gaze towards the
viewer, blinks, and mouth shapes from the speech audio. All default-session views use these people, including the studio and native VR. The selected model is saved on the character; old records derive one deterministically from the saved seed. Seat and guide/cast roles never choose the body. The former style query/preference no longer enables cartoon rendering.

The studio offers actual-model portraits, complete-person selection, clothing tint and supported glasses/brooch accessories. Tint affects torso clothing weights and preserves face, hands and exposed limbs. Geometry/textures are shared; instance materials are independent so changing one person cannot recolour another. Loading failures show a retry surface without substituting a different style. Physical Quest frame time remains unmeasured.

The additional source revision is `0943055db6ec570bcef9f2c8b41c9e5467c808f9`. Optional rebuild: `node scripts/fetch-avatars.mjs`, Blender 4.5 with `--background --python scripts/convert-avatars.py`, then `python scripts/avatar-thumbnails.py` with Pillow. Raw FBX/TGA inputs stay in ignored `.sovereign/asset-build/rocketbox`; the runtime needs only local GLBs/WebP portraits and the retained MIT licence. Independent face/hair/clothing modules are not supplied by these complete-body assets.

## Throne court (W06)

`src/throne-court.ts` authors the current discussion hall using local geometry and deterministic stone/wood/cloth textures from `EnvironmentAssets`. It includes the sovereign throne/dais, ribbed arches, columns, rose/aisle windows, heraldic banners, lanterns, radial floor inlay, presenter seal, lectern and waiting bench. Static meshes are merged by material; inactive rooms are hidden. Two bounded warm lights supplement the shared daylight; there are no dynamic shadows or downloaded environment assets. `scripts/review-court.mjs` renders all six bundled people with an explicit AI fixture, captures a screenshot and reports integration timings/draw counts without provider calls. Physical Quest performance remains to be measured.

### Custom host (Host_Anchor_01)

`Host_Anchor_01.glb` is derived from Rocketbox `Male_Adult_15` (MIT): its skullcap is reshaped
into slicked hair, the face texture is painted from the creator's own Gemini-generated reference
sheet, and the kurta is tinted cream with a pen in the pocket. It keeps the shared skeleton and
the same 23 face shapes, so lip-sync and actions work as for the other people. It is marked
`reserved` in `shared/avatar-catalog.mjs`, so it is chosen deliberately and never assigned to
generated characters. Build steps: `concept/host/build/README.md`.

## Studio motion library (S07/S11, October 28)

`public/motions/rocketbox/body.json` contains 36 skeleton-only clips derived from the official [Microsoft Rocketbox animation library](https://github.com/microsoft/Microsoft-Rocketbox/tree/0943055db6ec570bcef9f2c8b41c9e5467c808f9/Assets/Animations), pinned at `0943055db6ec570bcef9f2c8b41c9e5467c808f9`. `SOURCES.json` records each FBX URL, Git blob and SHA-256; the adjacent MIT `LICENSE.md` is retained. No additional avatar identities are introduced.

Rebuild: `python scripts/fetch-studio-motions.py`, then Blender 4.5 `--background --python scripts/convert-studio-motions.py`. Inputs remain in ignored `.sovereign/asset-build/rocketbox/motions/`. The shipped JSON is about 3.6 MB and is cached once per page, with 20 Hz source joint directions, palms and pelvis tracks; frames are interpolated on the recording clock. Retargeting preserves each destination skeleton's bone lengths.

`src/studio-motion.ts` supplies authored contact IK, seated/standing transitions, jump/hop arcs and procedural desk props (cup, microphone, paper, pen, laptop and watch). These are local geometry; no extra downloaded prop licence is required. Hand gestures (heart hands, thumbs, namaste, salute, finger guns and others) place a wrist or fingertip by IK with per-finger curls and an explicitly aimed thumb, because the Rocketbox rest thumb points into the palm. Facial reactions reuse the shipped face shapes and leave speech visemes authoritative; winks close one eye and pouts use the rounded-lip visemes only while silent. Some related action IDs deliberately share a native clip with different pose/contact/face treatment.

Walking, exits, partner meetings and seat changes follow authored routes in `shared/studio/stage-paths.mjs`: out through the gap beside the chair, along a lane behind the chairs, and back. Legs use the native `m_walk_neutral_01` cycle phase-locked to distance travelled (1.0 m per cycle measured best on the bundled rigs). The studio scene gives partnered actions the partner's seat offset and adds the partner's mirrored part. See [coverage](S07_S11_COVERAGE.md); 155 bindings are not 155 distinct mocap recordings.
