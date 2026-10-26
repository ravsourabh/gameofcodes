# Environment asset inventory

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
