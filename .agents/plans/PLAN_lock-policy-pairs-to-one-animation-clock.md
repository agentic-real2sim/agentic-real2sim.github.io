# Plan: Lock Policy Real/Sim Pairs to One Animation Clock

## Goal and confirmed cause

Fix the apparent desynchronization in the `Policy Evaluation` section by making
each episode's Real and Sim panes one animated GIF and therefore one browser
resource, decoder, frame sequence, and animation clock.

The diagnosis in
`.agents/reports/BUG_FIX_policy-evaluation-gif-sync.md` is the basis for this
plan:

- every real and selected simulation source starts at timestamp zero and is
  1280x720 or 2560x720 respectively, 15 fps, 350 frames, and 23.333333 seconds;
- all 16 current GIFs are 320x180, 6 fps, 140 frames, and 23.34 seconds, so an
  encoded duration mismatch is not the cause;
- the current page loads each pair as two independent lazy, asynchronously
  decoded `<img>` elements;
- the real GIFs are substantially larger than the Sim GIFs, so the two
  independent resources can finish loading/decoding and start animating at
  different times, and the browser provides no mechanism that subsequently
  phase-locks them.

The durable fix is exactly eight 640x180 `episode_NN.gif` files, each containing
the 320x180 Real pane on the left and the timestamp-aligned 320x180 Gaussian Sim
pane on the right. Do not add JavaScript timers, attempt to restart two images
together, or change GIFs to another media format.

The fix guarantees playback-clock synchronization. It does not claim that the
robot actions have identical semantic cadence: the real demonstration and
simulated policy rollout are different executions, so motion content can differ
at the same timestamp.

## Scope

### Modify

- `.agents/scripts/create_policy_evaluation_gifs.sh`
  - replace the two-independent-GIF generation path with one timestamp-normalized
    side-by-side generation graph per episode;
  - add exact source-timeline, combined-output, frame-ordinal, looping, count,
    hash, and batch-install assertions;
  - regenerate reproducible probes, logs, and contact sheets;
  - remove only recognized obsolete policy-evaluation artifacts.
- `index.html`
  - replace the two `<figure>/<img>` elements in each of the eight existing
    episode cards with one figure, one two-column label row, and one combined
    `<img>`;
  - preserve the section copy, episode order, and all eight activity captions.
- `static/css/index.css`
  - adapt only the inner Policy Evaluation pair/label/media selectors for the
    single 2:1 media asset;
  - preserve the two-card desktop grid and the existing 560 px outer-grid
    collapse breakpoint.

### Replace generated and published assets

- In `outputs/policy_evaluation/generated/`, replace the 16
  `episode_NN_{real,gaussian}.gif` files with:
  `episode_01.gif` through `episode_08.gif`.
- In `static/images/policy_evaluation/`, make the same replacement, leaving
  exactly `episode_01.gif` through `episode_08.gif`.
- In `outputs/policy_evaluation/probes/`:
  - keep/regenerate the 16 source probe reports
    `episode_NN_{real,gaussian}_source.txt`;
  - replace the 16 old side-specific output reports with eight
    `episode_NN_output.txt` reports;
  - add `episode_NN_real_timeline.framemd5` and
    `episode_NN_gaussian_timeline.framemd5` for every episode;
  - rewrite `generated_manifest.txt` for the eight combined files.
- In `outputs/policy_evaluation/logs/`, replace the old
  `episode_NN_{real,gaussian}.log` files with one `episode_NN.log` per combined
  encode. Retain the existing log discipline of error-only text without ffmpeg
  progress control characters.
- Regenerate `outputs/policy_evaluation/contact_sheets/episode_NN.png` from the
  coalesced combined GIFs and rebuild
  `outputs/policy_evaluation/contact_sheets/all_episodes.png`.

### Explicitly out of scope

- changing the ordered episode selection, activity wording, section text, or
  neighboring page sections;
- selecting any `video_simulated_twin.mp4`;
- changing the current outer-grid responsiveness;
- adding controls, client-side synchronization code, packages, or build
  dependencies;
- editing the bug report's pending verdict fields, which belong to the later
  validation/hypothesis-review phase.

## Canonical source manifest

Keep the existing fixed, ordered manifest and source root:

`/media/eric/data/droid_sim/data_from_qianjun/policy_eval_sim_3dgs-20260726T051956Z-1-001`

| Episode | Directory | Real input | Sim input |
| ---: | --- | --- | --- |
| 01 | `GuptaLab_success_2023_04_20_14_40_40` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 02 | `GuptaLab_success_2023_04_20_12_41_59` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 03 | `CLVR_success_2023_05_21_19_29_34` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 04 | `CLVR_success_2023_05_20_17_14_07` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 05 | `AUTOLab_success_2023_07_14_15_13_14` | `video_raw_ext1.mp4` | `gs_hires_run3_canonical.mp4` |
| 06 | `AUTOLab_success_2023_08_17_17_02_12` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 07 | `GuptaLab_success_2023_05_19_10_46_48` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 08 | `PennPAL_success_2023_04_29_18_21_36` | `video_raw_ext1.mp4` | `video_sim.mp4` |

Preflight the complete manifest before encoding. For every Real source assert
1280x720; for every selected Sim source assert 2560x720. For both members of
every pair assert `avg_frame_rate=15/1`, 350 decoded video frames, a start
timestamp of zero, and duration approximately 23.333333 seconds. Use a narrow
floating-point tolerance (for example, 0.001 seconds) rather than string
equality for duration. Abort before changing staged or final assets if any
source is absent or fails these invariants. Keep the explicit rejection of any
path ending in `video_simulated_twin.mp4`.

## Exact combined encoding pipeline

For each manifest entry, pass the Real source as input 0 and selected Sim source
as input 1 to one ffmpeg invocation and one `filter_complex`. The graph must:

1. reset each branch with `setpts=PTS-STARTPTS`;
2. crop the Sim branch to its left Gaussian-rendered half with
   `crop=1280:720:0:0` before scaling;
3. sample both branches on the same 6 fps timeline with
   `fps=fps=6:start_time=0:round=near`;
4. scale each branch to 320x180 with Lanczos and set square sample aspect ratio;
5. after sampling, normalize each branch's output timestamps to the exact
   ordinal clock with `settb=AVTB,setpts=N/(6*TB)`;
6. use timestamp-aware `hstack=inputs=2:shortest=1`, with Real first and Sim
   second, to create a 640x180 stream;
7. split that combined stream for one palette generation/application pipeline;
8. encode an infinitely looping GIF using `-loop 0`.

Use the following graph shape, with harmless label/whitespace variations
allowed:

```text
[0:v]setpts=PTS-STARTPTS,
     fps=fps=6:start_time=0:round=near,
     scale=320:180:flags=lanczos,setsar=1,
     settb=AVTB,setpts=N/(6*TB)[real];
[1:v]setpts=PTS-STARTPTS,crop=1280:720:0:0,
     fps=fps=6:start_time=0:round=near,
     scale=320:180:flags=lanczos,setsar=1,
     settb=AVTB,setpts=N/(6*TB)[sim];
[real][sim]hstack=inputs=2:shortest=1,
     split[frames][palette_source];
[palette_source]palettegen=max_colors=128:stats_mode=diff[palette];
[frames][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle[out]
```

Map only `[out]`. The 128-color shared palette is deliberate: the previous
layout gave each 320x180 side its own 64-color palette, so a 128-color combined
palette reduces the risk of visible quality loss without per-episode tuning.
Record the resulting total size and review it against the current 27.72 MiB
aggregate. Do not shorten episodes, reduce frame rate, or silently vary palette
size by episode to meet a payload target. If the combined total is unexpectedly
larger or visual quality is materially worse, report the measured result for
review rather than weakening synchronization or using different settings per
episode.

Generate only into `outputs/policy_evaluation/generated/` until all eight files
pass every validation. The encoded invariant is exactly 140 frames, 6/1 average
frame rate, 23.34 seconds (within 0.01 seconds), 640x180, nonempty, and infinite
looping. Use `identify -verbose 'file.gif[0]'` (ImageMagick 6) to assert
`Iterations: 0`; do not infer looping solely from ffprobe.

## Frame-ordinal proof and review artifacts

The script must produce machine-checkable structural evidence that both hstack
inputs contribute 140 ordered frames at the same timestamps:

1. For each source branch, run the same reset/crop/fps/scale/aspect/timebase
   filters used before `hstack`, outputting `-f framemd5` to
   `episode_NN_{real,gaussian}_timeline.framemd5`.
2. Assert each framemd5 contains exactly 140 data rows.
3. Strip comments and hashes, compare the frame-index/timing fields
   (stream index, DTS, PTS, duration, and frame size) row by row, and assert
   exact equality between Real and Sim for all 140 ordinals. Pixel hashes are
   expected to differ and must not be compared.
4. Assert ordinal zero has timestamp zero, ordinals are strictly ordered, each
   duration is one normalized 6 fps tick, and the last row is ordinal 139.
5. Decode the combined staged GIF and assert it also yields exactly 140 ordered
   frames. This confirms the final animation did not drop an hstack result.

Because differential GIF encoding may store rectangle deltas, create output
review sheets only after coalescing each animation with ImageMagick 6
`convert ... -coalesce`. Sample frames 0, 46, 93, and 139 from the coalesced
sequence, tile them in chronological order, and preserve the full 640x180 canvas
for each sample. Each sheet must make it possible to confirm Real is always the
left 320 pixels, Sim is always the right 320 pixels, the Sim crop has no
split-screen seam/right-hand twin view, and both panes cover the full episode.
Rebuild `all_episodes.png` from the eight per-episode sheets using the installed
ImageMagick tools so the aggregate artifact is reproducible.

These checks prove shared timestamps and one output frame sequence. Visual
review should separately note any content-level difference in action timing as
an expected property of distinct trajectories, not a reappearance of the
browser-clock bug.

## Safe generation, stale cleanup, and installation

Retain `set -euo pipefail`, repository-root resolution from the script path, and
preflight checks for required executables. Require only tools already present:
`ffmpeg`, `ffprobe`, `sha256sum`, ImageMagick 6 `convert`, and `identify`. Do not
install Python, npm, system, or other packages.

Use this ordering so a failed encode cannot publish a mixed final set:

1. preflight all 16 inputs and all commands;
2. clean only recognized `episode_*.gif` files from the staged generated
   directory and recognized obsolete output probe/log names;
3. generate all eight combined staged GIFs, timeline manifests, probes, logs,
   and coalesced contact sheets;
4. validate the complete staged set and assert its sorted basenames are exactly
   `episode_01.gif` through `episode_08.gif`;
5. prepare a clean install-staging directory under
   `outputs/policy_evaluation/`, install all eight GIFs there with mode 0644,
   and compare its hashes with the generated set;
6. only after the install-staging batch passes, update
   `static/images/policy_evaluation/` and assert its final sorted file list is
   exactly those eight basenames;
7. compare generated, install-staged, and published SHA-256 hashes and record
   final individual/aggregate sizes in `generated_manifest.txt`;
8. remove the temporary install-staging directory.

Before deleting from either final directory, reject any file whose name is not
one of the eight new `episode_NN.gif` names or the 16 recognized old
`episode_NN_{real,gaussian}.gif` names. This permits intentional stale cleanup
without deleting unrelated user files. Remove obsolete side-specific output
probes and logs by the same explicit naming pattern. Do not delete source probe
reports, source videos, the section's contact-sheet directory, or files outside
`outputs/policy_evaluation/` and `static/images/policy_evaluation/`.

Running the script twice must produce the same eight published hashes and no
additional artifacts.

## HTML structure and accessibility

Keep the existing eight `<article class="ar2s-policy-episode">` elements and
their order. Inside each article, use this shape:

```html
<figure class="ar2s-policy-pair">
  <figcaption class="ar2s-policy-labels">
    <span>Real</span>
    <span>Sim</span>
  </figcaption>
  <img
    src="./static/images/policy_evaluation/episode_NN.gif"
    class="ar2s-policy-media"
    alt="Synchronized side-by-side comparison of [activity]: real-world demonstration on the left and Gaussian-rendered policy execution on the right."
    width="640"
    height="180"
    loading="lazy"
    decoding="async">
</figure>
<p class="ar2s-policy-activity">Existing activity phrase</p>
```

There must be exactly one `.ar2s-policy-media` image per episode and eight in the
section. The explicit 640x180 dimensions reserve the correct 32:9 layout space.
Keep the visible `Real` and `Sim` labels, existing section paragraph, existing
activity text, lazy loading, async decoding, and meaningful episode-specific
alt text. The two labels describe the fixed halves of one image and therefore
do not need separate image elements.

## CSS behavior

Preserve `.ar2s-policy-grid` as two cards per row and preserve the committed
`@media screen and (max-width: 560px)` rule that changes only that outer grid to
one column.

Adapt the inner styles as follows:

- `.content figure.ar2s-policy-pair`: reset the content margin, retain
  `min-width: 0`, and do not make it a two-column media grid;
- `.ar2s-policy-labels`: a two-column `repeat(2, minmax(0, 1fr))` grid using the
  existing compact centered label typography and spacing;
- `.ar2s-policy-media`: keep block display, 100% width, auto height, border,
  radius, and `object-fit: contain`, but change its aspect ratio from 16:9 to
  32:9 for the 640x180 combined asset;
- remove the obsolete CSS rule that treats two child figures as the two media
  columns;
- preserve the card styling, outer gaps, activity styling, and all unrelated
  selectors/media queries.

At desktop widths the result remains four rows of two cards, and each card reads
`Real | Sim` over one matching side-by-side animation. At widths at or below
560 px the cards stack while the two halves and label columns remain horizontal.

## Implementation sequence

1. Record `git status --short` and the current diff before editing. Preserve the
   untracked bug report and any unrelated concurrent work.
2. Update only `.agents/scripts/create_policy_evaluation_gifs.sh` with the fixed
   manifest preflight, combined graph, ordinal evidence, staged validation,
   reproducible contact-sheet generation, safe cleanup, and batch installation
   described above.
3. Run the script once, review all eight combined contact sheets and
   `generated_manifest.txt`, and resolve only failures against this plan.
4. Run it a second time and compare hashes/file lists to prove idempotence.
5. Update the eight Policy Evaluation cards in `index.html` to the single-image
   structure and combined filenames.
6. Apply the narrow Policy Evaluation CSS adaptation without touching the
   outer-grid breakpoint.
7. Perform static, media, repository, HTTP, and browser validation.

## Validation and acceptance criteria

### Static and media validation

- The manifest still selects exactly the eight listed pairs and never selects a
  simulated twin.
- There are exactly eight generated and eight published GIFs, named
  `episode_01.gif` through `episode_08.gif`; none of the old
  `_real.gif`/`_gaussian.gif` files remain.
- Each published GIF is 640x180, 6 fps, exactly 140 decoded/coalesced frames,
  approximately 23.34 seconds, and `Iterations: 0`.
- Every episode's two timeline framemd5 files contain the same 140 ordered
  timing rows; Real and Sim pixel hashes are allowed and expected to differ.
- Every combined image has Real on the left and only the intended
  Gaussian-rendered Sim crop on the right.
- Staged, install-staged, and published hashes match; a second script run is
  hash-stable.
- Contact sheets show first, middle, last, and near-loop-boundary content on
  full coalesced canvases. Review all eight for palette quality and crop
  correctness.
- `generated_manifest.txt` reports every file size and the new total payload;
  compare it explicitly with the old 27.72 MiB total.

### Markup, CSS, and repository validation

- Policy Evaluation has exactly eight episode articles, eight label rows,
  eight `.ar2s-policy-media` images, eight activity captions, and no
  side-specific GIF reference.
- Each label row contains `Real` then `Sim`; each image has an existing file,
  episode-specific alt text, and explicit `width="640" height="180"`.
- DOM section order remains Selected DROID, Policy Evaluation, Video.
- The outer policy grid is two columns above 560 px and one column at or below
  560 px; each combined image and label row stays horizontally paired.
- Run `git diff --check`, inspect the focused diff, and run `git status --short`.
  No source MP4 or unrelated file may be modified or added.

### HTTP and browser/runtime validation

1. Serve the repository with `python3 -m http.server` on an available local
   port and verify `index.html` plus all eight combined GIF URLs return HTTP
   200.
2. Use the installed Firefox/geckodriver with a fresh temporary profile so the
   check begins with a cold cache. Load the page, scroll Policy Evaluation into
   view, and assert for all eight images:
   - `complete === true`;
   - `naturalWidth === 640` and `naturalHeight === 180`;
   - there is one `currentSrc` per episode;
   - resource timing/network observations contain eight combined GIF requests
     and no `_real.gif` or `_gaussian.gif` request.
3. Capture/review the section around 1440 px, the approximately 720 px Codex
   side-panel viewport where the earlier responsive issue was observed, and
   390 px. Check two cards per row at 1440/720, one card per row at 390, correct
   label/half alignment, no overflow, and unchanged activity captions.
4. Keep the cold-loaded page visible for at least two full 23.34-second loops.
   Confirm the combined image remains one loaded resource without reloads and
   that both halves cross each loop boundary as one bitmap. The single-resource
   structure plus the 140-frame ordinal proof is the authoritative mechanical
   synchronization evidence; do not reject the fix merely because the two
   independently executed trajectories perform motions at different moments.
5. Check the neighboring Selected DROID and Video sections for layout
   regression, then stop the local server/geckodriver and remove only their
   temporary profiles.

## Current-worktree preservation

At planning time the branch is `main` at `d077463`, `origin/main` points to the
same commit, and the working tree contains only the untracked bug report. The
Policy Evaluation breakpoint adjustment that was uncommitted when debugging
began has since been committed as `d077463 Fix policy grid breakpoint`; it is
not an unrelated dirty hunk anymore. Preserve it exactly: do not revert,
reapply, or move the 560 px rule.

Because another task may change the worktree after this plan is written, the
implementer must re-check status/diff immediately before editing. If
`static/css/index.css` has new unrelated modifications, patch only the
`ar2s-policy-pair`, label, and media blocks and leave all other hunks byte-for-byte
intact. Never use reset, checkout, or whole-file replacement to obtain a clean
state.

## Risks and fixed decisions

- **Distinct trajectories can still look semantically out of step.** The fix is
  about media-clock synchronization. Communicate that same-timestamp real and
  Sim content need not show the same action phase.
- **One shared palette covers twice the visual content.** Use the fixed
  128-color shared palette, inspect all coalesced contact sheets, and report the
  aggregate payload. Do not choose per-episode settings.
- **GIF rectangle deltas can mislead raw-frame inspection.** Coalesce with
  ImageMagick before visual sampling and separately validate decoded frame
  count/timing.
- **Replacing 16 files with eight can leave stale assets.** Enforce exact sorted
  filename sets in generated, install-staged, and final directories, and delete
  only explicitly recognized legacy names.
- **A generation error must not publish half a batch.** Complete and hash-check
  all eight files in repository-local staging before final installation.
- **No new dependency is needed.** Use the installed ffmpeg 4.4, ffprobe,
  ImageMagick 6, Firefox, geckodriver, and standard shell tools.
