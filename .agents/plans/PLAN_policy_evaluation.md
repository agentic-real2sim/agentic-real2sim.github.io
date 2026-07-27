# Plan: Policy Evaluation Episode Grid

## Goal and placement

Add a new `Policy Evaluation` block to `index.html` immediately after the existing `Selected 25 Episodes from DROID Dataset` block and before the `Video` block. The section will:

- state that the π₀.₅ policy was pretrained on real-world DROID data and evaluated in synthetic scenes created by the Agentic Real2Sim pipeline;
- present exactly eight episodes in a two-episode-wide, four-row desktop grid;
- show the real-world episode GIF on the left and the Gaussian-rendered policy-execution GIF on the right inside every episode card;
- give every episode one short, gray activity phrase;
- keep the real/Gaussian comparison horizontal when the outer episode grid stacks on screens at or below 768 px.

Use this concise section copy:

> We evaluate π₀.₅, pretrained on real-world DROID data, on synthetic scenes created by our pipeline. Each episode pairs the real-world demonstration (left) with policy execution rendered from the Gaussian representation (right).

This is a static-site change. It requires no JavaScript, package installation, build-system change, or network dependency.

## Scope and files

### Modify

- `index.html`
  - Insert only the new Policy Evaluation section between the selected-DROID and Video blocks.
  - Reference the 16 new GIFs in fixed episode order.
- `static/css/index.css`
  - Add narrowly scoped Policy Evaluation card, nested-grid, media, label, and activity styles.
  - Extend the existing `@media screen and (max-width: 768px)` rule only to stack the outer Policy Evaluation grid.

### Add

- `.agents/scripts/create_policy_evaluation_gifs.sh`
  - Reproducibly validates the source manifest, crops policy composites, generates optimized GIFs, records probe data, and installs only validated outputs.
- `static/images/policy_evaluation/episode_01_real.gif`
- `static/images/policy_evaluation/episode_01_gaussian.gif`
- `static/images/policy_evaluation/episode_02_real.gif`
- `static/images/policy_evaluation/episode_02_gaussian.gif`
- Continue the same naming scheme through:
  - `static/images/policy_evaluation/episode_08_real.gif`
  - `static/images/policy_evaluation/episode_08_gaussian.gif`

### Generated intermediates, not page assets

Create a new repository-local `outputs/policy_evaluation/` hierarchy for all temporary and review products:

- `outputs/policy_evaluation/generated/` for staged GIFs before installation;
- `outputs/policy_evaluation/contact_sheets/` for caption/content review;
- `outputs/policy_evaluation/probes/` for source/output `ffprobe` reports and sizes;
- `outputs/policy_evaluation/logs/` for ffmpeg logs.

Do not place palettes, temporary GIFs, contact sheets, or logs in `.agents/scripts`, `static/`, or the repository root. Whether `outputs/policy_evaluation/` is committed should follow the repository's existing ignore policy; the 16 final GIFs and conversion script are the durable deliverables.

Do not remove or alter `static/images/combined_5x5_tight.gif`, any existing section, or any external source clip. Do not add MP4 versions, simulated-twin media, interactivity, autoplay controls, a carousel, or unrelated visual cleanup.

## Canonical source manifest and episode order

Use this source root exactly:

`/media/eric/data/droid_sim/data_from_qianjun/policy_eval_sim_3dgs-20260726T051956Z-1-001`

The conversion script must encode the following explicit ordered manifest rather than discover files with a glob:

| Episode | Source directory | Real-world input | Gaussian policy-execution input |
| ---: | --- | --- | --- |
| 01 | `GuptaLab_success_2023_04_20_14_40_40` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 02 | `GuptaLab_success_2023_04_20_12_41_59` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 03 | `CLVR_success_2023_05_21_19_29_34` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 04 | `CLVR_success_2023_05_20_17_14_07` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 05 | `AUTOLab_success_2023_07_14_15_13_14` | `video_raw_ext1.mp4` | `gs_hires_run3_canonical.mp4` |
| 06 | `AUTOLab_success_2023_08_17_17_02_12` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 07 | `GuptaLab_success_2023_05_19_10_46_48` | `video_raw_ext1.mp4` | `video_sim.mp4` |
| 08 | `PennPAL_success_2023_04_29_18_21_36` | `video_raw_ext1.mp4` | `video_sim.mp4` |

All eight real inputs are 1280×720 H.264 clips. All eight selected policy inputs are 2560×720, with the required Gaussian-rendered view in the left 1280×720 half. The script and HTML must never select or reference `video_simulated_twin.mp4`; those clips are explicitly out of scope even though seven episode directories contain them.

## GIF conversion and compression

Implement `.agents/scripts/create_policy_evaluation_gifs.sh` as a Bash script with `set -euo pipefail`. Resolve the repository root from the script location so the script can be run from any working directory. Assert that `ffmpeg`, `ffprobe`, all 16 manifest inputs, and the expected stream geometry are present before generating anything.

Use the full 23.334-second source timeline for both sides of each episode so the paired action is not selectively trimmed. Produce looped GIFs with the same visual geometry and timing:

- output dimensions: 320×180;
- sample rate: 6 fps;
- scaling: Lanczos;
- looping: infinite (`-loop 0`);
- no audio, subtitle, or data streams;
- real-world filter: `fps=6,scale=320:180:flags=lanczos`;
- Gaussian filter: `crop=1280:720:0:0,fps=6,scale=320:180:flags=lanczos`;
- palette generation: `palettegen=max_colors=64:stats_mode=diff`;
- palette application: `paletteuse=dither=sierra2_4a:diff_mode=rectangle`.

Use a single per-output `filter_complex` split/palette pipeline, or an equivalent two-pass pipeline whose palette PNG remains under `outputs/policy_evaluation/`. The selected 320×180 at 6 fps with a 64-color palette is a pragmatic match for the roughly 220–230 CSS-pixel-wide panels in the site's max-desktop container. A representative full-length pair remained visually clear at that display size while decreasing from about 6.2 MiB real + 1.5 MiB Gaussian at 384×216/8 fps to about 2.9 MiB real + 0.84 MiB Gaussian. Do not resize the full 2560-pixel composite before cropping.

Generate each file first as `outputs/policy_evaluation/generated/episode_NN_{real,gaussian}.gif`. After all 16 staged files pass validation, copy/install them to `static/images/policy_evaluation/`; do not leave a partially regenerated final set if a later episode fails. Record source and output dimensions, frame rates/counts, durations, and byte sizes in `outputs/policy_evaluation/probes/`.

Compression acceptance criteria:

- exactly 16 nonempty final GIFs;
- every GIF reports 320×180 and approximately 140 frames (23.334 s sampled at 6 fps);
- each animation covers the complete source action and loops;
- the Gaussian output contains only the left half of the 2560×720 source;
- no file is unexpectedly larger than its 720p source input, and the total final GIF payload is reviewed as a single page-load budget;
- use the same 320×180, 6 fps, 64-color settings for every episode; do not shorten individual episodes or use inconsistent settings to hit a target.

`gifsicle` is not installed and is not required. Keep the ffmpeg palette recipe self-contained.

## Activity phrases and caption-selection method

Each card gets exactly one `.ar2s-policy-activity` phrase beneath its media pair. Keep it neutral, literal, sentence-case, and approximately 3–7 words; do not claim policy success, generalization, or exact object identity unless the visible frames support it.

During asset generation, create a contact sheet for each real/Gaussian pair under `outputs/policy_evaluation/contact_sheets/`, sampling at least the start, approach, interaction, and final state. Select the phrase from the action that is visibly shared by the paired clips. Use DROID's `current_task` metadata only to corroborate the visual read, because several metadata entries are category-level rather than object-specific.

Provisional phrases, in display order, are:

1. `Placing an object in a container`
2. `Repositioning an object on the table`
3. `Repositioning an object on the table`
4. `Placing an object in a container`
5. `Stacking one bowl on another`
6. `Dropping a yellow block into a blue cup`
7. `Stacking objects in sequence`
8. `Repositioning an object on the table`

Before committing the HTML copy, replace a provisional generic phrase with a more specific concise description only when the paired contact sheet clearly supports it. Preserve one phrase per card and the manifest order; do not use lab names, episode IDs, filename fragments, or task-category boilerplate as the visible caption.

## HTML structure and accessibility

Follow the existing page's Bulma wrapper and heading hierarchy:

- outer `.columns.is-centered`;
- `.column.is-full`;
- `.content`;
- `<h2 class="title is-3">Policy Evaluation</h2>`;
- the explanatory paragraph;
- one `.ar2s-policy-grid` containing eight ordered `<article class="ar2s-policy-episode">` cards.

Inside each card:

- add one `.ar2s-policy-pair` nested two-column grid;
- put the real-world `<figure>` first and the Gaussian-rendered policy execution `<figure>` second;
- use a concise visible media label such as `Real world` and `Gaussian-rendered policy execution`;
- use an `<img class="ar2s-policy-media">` for each GIF with explicit `width="320"` and `height="180"`, `loading="lazy"`, and `decoding="async"`;
- write episode-specific alt text that states the activity and side, for example `Real-world demonstration of stacking one bowl on another.` and `Gaussian-rendered policy execution of stacking one bowl on another.`;
- place the single `<p class="ar2s-policy-activity">…</p>` after the pair.

The explicit dimensions reserve layout space and reduce cumulative layout shift. Native animated `<img>` elements satisfy the requested GIF presentation; no controls or JavaScript are needed.

## CSS and responsive behavior

Add only `ar2s-policy-*` selectors:

- `.ar2s-policy-grid`: CSS Grid with `grid-template-columns: repeat(2, minmax(0, 1fr))` and about `1rem` gap, yielding four rows of two cards on desktop;
- `.ar2s-policy-episode`: `min-width: 0`, modest padding, 1 px `#ddd` border, 8 px radius, and white/background-inherited card treatment consistent with existing media panels;
- `.ar2s-policy-pair`: nested `repeat(2, minmax(0, 1fr))` grid with a compact 0.5–0.625 rem gap;
- scoped `figure` reset: remove `.content figure` margins only inside `.ar2s-policy-pair`;
- media labels: compact, centered, semibold, and subordinate to the section heading;
- `.ar2s-policy-media`: block-level, 100% width, auto height, fixed `aspect-ratio: 16 / 9`, and `object-fit: contain`; use the site's existing `#ddd` border and 8 px radius;
- `.ar2s-policy-activity`: centered, concise, `color: #777`, approximately 0.9 rem, and spaced below the pair.

At the existing `max-width: 768px` breakpoint, change only `.ar2s-policy-grid` to `grid-template-columns: 1fr`. Do not include `.ar2s-policy-pair` in the stacking selector: its real-left/Gaussian-right tracks must remain side by side on mobile. Allow labels to wrap and reduce only local gap/padding if a 390 px rendered check exposes overflow.

## Implementation sequence

1. Add the ordered source manifest and strict preflight checks to `.agents/scripts/create_policy_evaluation_gifs.sh`.
2. Generate probe reports and the eight paired contact sheets under `outputs/policy_evaluation/`; visually confirm that the selected policy inputs are Gaussian-rendered execution and that the left-half crop is correct.
3. Finalize the eight activity phrases using the paired visual-review method.
4. Generate all 16 staged GIFs with the common crop/fps/scale/palette settings, validate them as a batch, then install the batch under `static/images/policy_evaluation/`.
5. Insert the semantic Policy Evaluation markup in `index.html` at the exact required location.
6. Add scoped desktop and responsive styles in `static/css/index.css`.
7. Run static, media, payload, and rendered validation; make only Policy Evaluation-specific adjustments.

## Validation

### Source, script, and asset checks

1. Run the conversion script from both the repository root and another working directory to confirm location-independent path handling.
2. Confirm its preflight rejects missing sources, wrong dimensions, and any manifest path containing `video_simulated_twin.mp4`.
3. Use `ffprobe`/ImageMagick identification if available to assert all 16 final GIFs are 320×180, animated, approximately 140 frames/full-length at 6 fps, and nonempty.
4. Compare staged/final hashes and assert there are exactly two assets for each episode number, with no unexpected file in `static/images/policy_evaluation/`.
5. Review contact sheets and representative GIF loops for every pair, checking:
   - real footage is on the real side;
   - Gaussian policy execution is the left-half crop on the synthetic side;
   - no split-screen seam or right-hand simulated view remains;
   - action timing/content is complete;
   - each activity phrase matches both sides.
6. Report individual and aggregate GIF byte sizes and compare representative outputs against the measured approximately 2.9 MiB real / 0.84 MiB Gaussian reference pair; investigate large outliers without changing the common encoding settings per episode.
7. Search the script, HTML, and new asset names for `video_simulated_twin` and assert it appears only in a rejection/check or explanatory comment, never as an input or page asset.

### Markup and repository checks

1. Assert the DOM order is Selected DROID → Policy Evaluation → Video.
2. Assert exactly eight `.ar2s-policy-episode` cards, 16 GIF `<img>` references, eight activity phrases, and real-before-Gaussian order in every card.
3. Assert every image path exists with matching case and every image has meaningful alt text plus explicit width/height.
4. Run `git diff --check`.
5. Inspect `git status --short` to ensure no source MP4, unrelated website file, or unplanned generated intermediate is staged.

### Local rendered validation

1. Run `python3 -m http.server 8000` from the repository root.
2. Use `curl` to confirm `index.html` and all 16 GIF URLs return successfully.
3. Capture the new section at approximately 1440 px width and verify exactly two episode cards per row, four rows, correct inner left/right order, aligned media, readable labels, and gray activity phrases.
4. Capture at approximately 390 px width and verify the eight cards stack in order while every real/Gaussian pair remains horizontal without overflow.
5. Observe all 16 animations through at least one loop, including lazy-loaded cards below the fold.
6. Inspect the neighboring Selected DROID and Video blocks to confirm placement, spacing, and layout were not regressed.

## Risks and decisions

- **GIF payload is large because 16 full-length animations share one page.** Use the tested 320×180/6 fps/64-color differential-palette recipe for all 16 files, measure the aggregate, and investigate outliers while preserving duration and consistent comparison quality.
- **Policy MP4s are split-screen composites.** Crop `1280:720:0:0` before scaling and verify representative frames; never publish the full composite or its right half.
- **Episode 05 has a differently named canonical render.** Keep it as an explicit manifest exception rather than a filename fallback that could silently select the simulated twin.
- **Generic DROID metadata can overstate what is visible.** Base the final phrase on paired contact sheets, using metadata only as corroboration and avoiding success language.
- **Long media labels may wrap on phones.** Permit wrapping and tune local spacing; retain the horizontal inner pair.
- **Browser GIF playback offers no user controls and can consume CPU.** Lazy-load below-fold images and keep the compressed resolution/frame rate; adding video controls or a JavaScript playback system is outside this request.
