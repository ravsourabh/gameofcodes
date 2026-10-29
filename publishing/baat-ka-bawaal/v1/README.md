# Baat Ka Bawaal publishing kit

P01 prepares local assets for the **Baat Ka Bawaal** channel with the exact credit **Game of Codes Production**. Identity is confirmed; final visual acceptance is pending your review. No account, live studio appearance or public post is changed by this kit.

**Featured host:** Chhola Bhatura leads the banner, main thumbnail and portrait cover, using his saved tan-vest `Male_Adult_05` identity. Chintu's suited model is a separately labelled supporting episode example. Do not substitute the reserved custom host model for Chhola Bhatura merely because it has “Host” in its asset ID.

## Review and use

Open `index.html` for all previews and individual downloads. It works as a local file after the build. A lightweight local server is also available:

```powershell
node scripts/build-publishing-kit.mjs --serve
```

Use the printed local URL. This server serves only the publishing kit, existing show branding and font assets on loopback; it does not expose server configuration or stored episodes.

1. Review the profile badge at 800 px, circular crop and 98 px, then the full and mobile banner previews.
2. Upload only `assets/profile-800.png` and `assets/youtube-banner-2560x1440.png` when you choose to set up the channel. Files named `preview` or containing crop guides are for review, not upload.
3. Review the example thumbnail, portrait cover and transparent caption/nameplate overlays. Sample artwork uses the existing auto-driver premise; public metadata still needs package approval later.
4. Play the intro/outro clips and audio masters. The intro is 2.5 seconds and the outro is 4 seconds; use a shortened variant if it gets in the way of a joke. These assets do not replace the app's existing camera/audio behavior.
5. Choose a handle in your accounts during P02. Supply a public contact email only if you want one displayed. Use `CHANNEL_COPY.md` for ready-to-paste About and bio text.
6. Review the channel artwork before it is used publicly. The P01 visual acceptance gate remains open until you accept it. P02 handles account setup and authorization; this kit does not perform that step.

## Editable sources

- `brand.json`: versioned identity, palette, typography, unset account fields and authoring rules.
- `layout.html`, `layout.css`, `layout.mjs`: editable artwork compositions. Template types include profile, banner, thumbnail, vertical-cover, caption-landscape/portrait, lower-landscape/portrait, intro-landscape/portrait and outro-landscape/portrait.
- URL parameters: `hook1`, `hook2`, `model`, `expression`, `caption`, `name`, `role`, `guides`. Values are assigned as text, not injected markup. `model` is restricted to shipped rig IDs; `expression` is neutral, smile or surprised.
- `source/profile-badge-generated.png`: original built-in image-generation output; prompt in `source/PROMPTS.md`. Existing runtime logo/banner files remain untouched.
- `cast/*.png`: neutral/smile/surprised transparent cutouts from the seven actual shipped models; adjacent JSON records morph values. Model ID does not imply a named character. Match the accepted take's model, clothing tint and accessories before publishing. The current base cutouts use original clothing and no per-character accessories.
- `notices/`: copied Rocketbox MIT, font SIL OFL and original audio credits.
- `SOURCES.json`: source/use inventory and assets requiring episode-specific review.
- `manifest.json`: exported dimensions, sizes and hashes.

Rebuild the cast with Blender 4.5:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 4.5\blender.exe' --background --python scripts/render-publishing-cast.py
```

Then rebuild artwork/audio/videos with installed Playwright Chromium and FFmpeg:

```powershell
node scripts/build-publishing-kit.mjs
```

`--no-video` skips the four MP4 encodes during layout iteration. Build steps call no model, speech or publishing API. They use existing local assets and the retained badge output. For a changed generated badge, use the image-generation prompt and save a new version before updating the source.

## Layout and audio decisions

The 2560 × 1440 banner keeps essential copy in a conservative centred 1480 × 394 region, within the approximate scaled YouTube safe area. Inspect the platform's own crop preview before applying. [YouTube branding guidance](https://support.google.com/youtube/answer/10456525?hl=en)

Full-video thumbnails use a short Hindi hook at the left and a real model cutout at the right. Portrait covers keep the headline and core identity near the centre; the green guide is an editorial crop check, not a promise about every Instagram surface. Exact platform crops are checked again in P02/P08.

Captions use high-contrast cream text, restrained navy backing and one thin gold rule. Use at most two short lines and saved speech timings; split a long paragraph into cues. Portrait captions reserve the right side and bottom for platform UI. Check every rendered episode for faces and longer words rather than assuming the template fits all text.

Audio mastering targets: intro approximately −15 LUFS, outro −16 LUFS and quiet dialogue-bed preview −29 LUFS, with a −1.5 dBTP limiter target. These are mix design targets, not measured platform requirements. The existing theme is edited with fades. The 20-second bed is a mix preview, not a seamless loop. Full-programme voice ducking is later rendering work; no new speech, imitated voice or new AI song is generated here.

Retain the Kevin MacLeod source, CC BY 4.0 link and modification statement in each published asset's description when that music is present. [Music license options](https://incompetech.com/music/royalty-free/licenses/) and [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/)
