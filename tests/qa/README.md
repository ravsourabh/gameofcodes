# Browser video export acceptance

Run serially with other browser, build and media QA on memory-constrained hosts.
The runner creates a new `.sovereign/review/browser-export-<timestamp>-<uuid>`
directory for each attempt. It uses port 5571 by default and refuses to reuse an
existing listener. Set `GOC_QA_PORT` to another free port if needed.

```powershell
$node = 'C:/Users/kumar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& $node scripts/qa/run-studio-export.mjs
```

By default Vite builds directly into the unique output directory. To test the
existing production build without rebuilding or competing for the main `dist`:

```powershell
$env:GOC_QA_SNAPSHOT_DIST = '1'
# Optional: use a parent's immutable candidate instead of the workspace dist.
# $env:GOC_QA_SOURCE_DIST = 'D:/projects/sovereign/.sovereign/releases/<candidate>/dist'
& $node scripts/qa/run-studio-export.mjs
```

Snapshot mode verifies that `dist/index.html` and its referenced assets remain
consistent while copying. `build-snapshot.json` records the existing release
timestamp and index hash. Every run records source hashes before and after and
lists concurrent source edits in `run.json`; this identifies precisely what was
tested without claiming that an older build contains subsequent edits.

The gateway serves frozen production files and streams `/api/` to a temporary
fixture service selected by the test. Chromium's native attachments use their
unchanged same-origin URL, with actual Origin/Referer checks. No `page.route`,
anchor monkeypatch or production backend is used in gateway mode. All dialogue,
alignment and voice responses are deterministic local fixtures. The PCM voice
fixture is an audible 440 Hz tone, not real speech or a paid provider call.

The acceptance test exercises Versions/Edit/Export tabs, then exports landscape
with separate subtitles and portrait with burned-in subtitles. It retains:

- `horizontal.mp4`, `vertical.mp4`, extracted frames and export-tab screenshots.
- `saved-take.srt`, downloaded after cloud cleanup.
- `verification.json`: ffprobe streams, exact expected frame counts and duration,
  decoded audio RMS/peak, SHA-256 hashes, unchanged saved-take/audio evidence,
  cloud API 404 and absence of every file belonging to each downloaded job.
- `gateway.jsonl` and `transfers.json`: real API and attachment transfer evidence.
- Playwright report, failure screenshot/trace and recoverable failed export files.

`GOC_QA_SHORT_EXPORT=1` explicitly creates a 250 ms edited fixture for a resource
smoke test. It is off by default and must never be represented as full-duration
acceptance. It does not alter the application or impose a duration limit.

For separate duration and transfer regressions, run these serially after browser
QA has released resources:

```powershell
& $node --test --test-concurrency=1 tests/studio-export-gateway.test.mjs tests/studio-export-download.test.mjs tests/studio-export-chunks.test.mjs
```

The chunks test covers 259.222-second and two-hour admission, a complete
259.222-second encode with continuous frame/audio counts, restart/retry and
owned-file cleanup. Its synthetic frames supplement browser 3D acceptance;
they do not establish visual quality for a four-minute browser render.
