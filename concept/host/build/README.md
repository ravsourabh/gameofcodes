# Host avatar build (Host_Anchor_01)

Rebuilds `public/avatars/rocketbox/Host_Anchor_01.glb` and its portrait from Rocketbox
`Male_Adult_15` (MIT) and the creator's Gemini reference sheet in `concept/host/`.

1. Download `Male_Adult_15/Export/Male_Adult_15_facial.fbx` and its `Textures/*.tga` from
   https://github.com/microsoft/Microsoft-Rocketbox into `../m15/` relative to this folder
   (`common.py` reads `m15/Export` and `m15/Textures`).
2. Run with Blender 4.5 (`blender -b --factory-startup --python <script> -- <args>`):
   - `render_face.py out` renders the base face for matching points (`pairs.json`).
   - `build_textures.py <head-sheet.png> out` re-tones skin, removes the beard, paints oiled hair,
     tints the kurta, adds the pen and warps the photo into the face camera.
   - `bake_head.py out` projects the warped photo onto the head UVs (front-facing areas only).
   - `build_glb.py out <glb> <portrait.webp>` lowers and rounds the skullcap into hair, keeps the
     23 face shapes and exports the GLB.
   - `render_host.py out` renders front, three-quarter, side and torso checks.

`pairs.json` holds matching facial points in the 1024 px face render and the full-size photo.
Change them if a new reference sheet is used.
