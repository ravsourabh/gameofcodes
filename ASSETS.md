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
