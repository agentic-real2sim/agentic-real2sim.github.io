# Plan: Humanoid Reference/Settling Media Pairs

## Feature and scope

Replace the single full-width Humanoid figure with two side-by-side examples sourced from `/media/eric/data/droid_sim/data_from_heng/humanoid/`:

- the left example is `idx13`;
- the right example is `idx20`;
- within each example, the cropped real photograph is on the left and the cropped full settling video is on the right;
- every displayed image and video uses the same 4:5 aspect ratio so each pair reads as a direct comparison;
- the crop emphasizes the humanoid without introducing any clipping of the robot during the video transient;
- the existing Humanoid heading remains, while the current explanatory paragraph and `static/images/ar2s_humanoid.png` display are replaced by concise pair-oriented copy and media.

This change is limited to the Humanoid section, its dedicated CSS, and four derived media assets. It does not change Deformables, the Paper video, global page layout, JavaScript, or the source files under `/media`.

## User-facing copy and ordering

Use this section introduction:

> Each pair shows a real reference pose (left) and the robot settling into that pose in simulation (right).

Use short example headings `Pose 13` and `Pose 20`. Inside each pair, label the photograph `Real reference` and the video `Settling transient`. These labels make the left/right meaning explicit within both examples without repeating a full sentence below each item.

DOM and desktop visual order must be:

1. Pose 13: real reference, then settling transient.
2. Pose 20: real reference, then settling transient.

## Files and assets

### Modify

- `index.html`
  - Replace only the current paragraph and `ar2s_humanoid.png` image inside the Humanoid block.
  - Add semantic example and media markup with accessible labels/fallback text.
- `static/css/index.css`
  - Add Humanoid example/pair layout rules and responsive behavior.
  - Retain `.ar2s-humanoid-block` spacing unless rendered inspection shows a conflict.
  - Reuse the existing border color/radius and caption typography where practical.

### Add derived assets

- `static/images/humanoid_idx13_real.png`
- `static/images/humanoid_idx20_real.png`
- `static/videos/humanoid_idx13_settling.mp4`
- `static/videos/humanoid_idx20_settling.mp4`

Do not overwrite or delete the external source files. Do not delete `static/images/ar2s_humanoid.png` as part of this feature; it may be retained as an unused historical asset to avoid broad cleanup outside the requested section.

## Crop and transcode specification

The source inspection established these dimensions:

| Example | Real source | Real dimensions | Video source | Video dimensions | Full duration |
| --- | --- | ---: | --- | ---: | ---: |
| idx13 | `idx13_real.png` | 1300x726 | `aligned_idx13.mp4` | 980x720 | about 9.657 s |
| idx20 | `idx20_real.png` | 1304x724 | `aligned_idx20.mp4` | 980x720 | about 14.537 s |

Use physical, baked-in crops rather than CSS-only `object-fit` cropping. The preferred crop windows, checked against representative and 2 fps dense contact sheets, are:

| Output | Crop window (`width x height + x + y`) | Resulting aspect |
| --- | --- | --- |
| idx13 real | `500x625+440+80` | 4:5 |
| idx20 real | `500x625+300+80` | 4:5 |
| idx13 video | `576x720+200+0` | 4:5 |
| idx20 video | `576x720+180+0` | 4:5 |

Implementation requirements for the crops:

1. Apply the image crop losslessly to PNG output and retain normal color/alpha handling.
2. Keep the videos' complete time ranges; do not trim, speed-change, freeze, or otherwise alter the settling transient.
3. Keep the full 720-pixel source height for both videos. This preserves every vertically available robot pixel. The idx20 source itself begins/ends with the upper body outside the source frame; the derived crop must not introduce additional clipping beyond that unavoidable source limitation.
4. Before accepting the preferred video windows, inspect an all-frame or sufficiently dense edge-contact diagnostic over each full clip. Confirm no robot pixel touches or crosses the new left/right crop boundaries. If that check contradicts the sampled inspection, minimally widen the crop and apply the matching 4:5 width/height strategy to that example's real image; document the final bounds in the implementation report. Do not use a tighter crop merely to make the humanoid appear larger.
5. Encode the video outputs as broadly compatible H.264 MP4 with `yuv420p` pixel format and `+faststart`, preserving the source frame rate and source frame count/duration. Use a visually high-quality CRF setting (approximately 20-23) and do not add an audio track when the source has none.
6. Confirm the final four files report a 4:5 display aspect. Do not rely on CSS to hide mismatched edges.

## HTML structure and behavior

Within the existing `.ar2s-humanoid-block`, create:

- one outer `.ar2s-humanoid-grid` containing two example elements;
- one `.ar2s-humanoid-example` per pose with its concise heading;
- one inner `.ar2s-humanoid-pair` per example containing two `figure` elements in real-then-video order;
- one `<img>` for the real reference and one `<video>` for the settling transient in each example;
- captions using the existing `.ar2s-media-caption` treatment or a narrowly scoped equivalent.

Media requirements:

- Give each image a specific alt description, for example `Real humanoid reference for pose 13.`
- Configure each video with `autoplay`, `controls`, `muted`, `loop`, and `playsinline`; use `preload="metadata"` to avoid eagerly downloading both full clips before they are needed.
- Include `type="video/mp4"` on each source and concise browser fallback text that identifies the corresponding settling video.
- Use a shared Humanoid media class for `display: block`, `width: 100%`, border, and radius. Since crops are physically 4:5, `height: auto` is sufficient and must not introduce a second crop.
- Preserve the existing heading hierarchy: section `h2`, example headings beneath it (prefer `h3`).

## CSS and responsive layout

Desktop/tablet behavior:

- `.ar2s-humanoid-grid` is a two-column grid so idx13 is visibly left of idx20.
- Each `.ar2s-humanoid-pair` is also a two-column grid so the real reference remains left of the settling video.
- Use `minmax(0, 1fr)` tracks and `min-width: 0` on children to prevent media overflow.
- Use compact gaps: approximately `1rem` between pose examples and `0.5-0.75rem` within each pair. Keep headings and captions visually subordinate to the Humanoid title.
- Remove default `.content figure` margins for only these Humanoid figures, following the existing Deformables pattern.

At the existing `max-width: 768px` breakpoint:

- stack the two pose examples into one column in idx13-then-idx20 order;
- keep each real/video pair in two columns, preserving the user's requested left/right comparison on phones;
- allow both 4:5 media panels to shrink fluidly without horizontal scrolling.

Do not make unrelated changes to the existing Deformables mobile rule. If a very narrow viewport exposes caption wrapping, allow normal wrapping rather than stacking or hiding labels.

## Compatibility and dependencies

- No JavaScript or new package is required.
- Use standard HTML5 image/video elements and CSS Grid already used in the repository.
- H.264/yuv420p MP4 supports the same browser class as the site's existing MP4 assets.
- Muted inline autoplay is retained for modern mobile-browser autoplay policy compatibility; controls remain available for pause, scrub, replay, and users with autoplay disabled.
- Preserve relative `./static/...` URLs so the page continues to work from the repository's simple static HTTP server.

## Implementation sequence

1. Generate temporary cropped image/video candidates from idx13 and idx20 using the preferred bounds; do not write final assets until visual edge validation passes.
2. Verify the complete video transients against the proposed horizontal bounds, adjust only if robot clipping is found, then create the four named final assets using the codec requirements above.
3. Replace the current Humanoid paragraph/image markup with the introduction, ordered pose examples, media, headings, captions, alt text, and video fallbacks.
4. Add scoped Humanoid grid/media styles and the mobile outer-grid stack rule.
5. Run static, media, and rendered validation. Fix crop/layout issues without altering unrelated sections.

## Validation

### Static and media checks

1. Run `ffprobe` on both source/output video pairs and assert:
   - outputs are 576x720 unless the required no-clipping verification forced a documented wider 4:5 crop;
   - H.264 codec and `yuv420p` pixel format;
   - source frame rate is preserved;
   - output duration/frame count matches the full source within normal container timestamp tolerance;
   - no unexpected audio stream was introduced.
2. Inspect image metadata and assert each output has a 4:5 pixel ratio and expected crop dimensions.
3. Produce source-versus-output contact sheets covering the beginning, settling motion, stable pose, and end of each video. Explicitly confirm the derived crop never newly clips the robot at any edge.
4. Search `index.html` and assert:
   - idx13 precedes idx20;
   - real media precedes video within each example;
   - both videos include all required playback attributes;
   - the old `ar2s_humanoid.png` reference is absent from the page;
   - the four new paths exist with matching case.
5. Run `git diff --check`.

### Local rendered validation

1. Start the documented preview server with `python3 -m http.server 8000` from the repository root.
2. Use `curl -I`/`curl` to confirm the page and all four new media URLs return successfully.
3. Render the page in a local browser and capture Humanoid-section screenshots at approximately:
   - 1440px desktop width, proving idx13 is left of idx20 and both internal pairs are image-left/video-right;
   - 390px mobile width, proving idx13 stacks above idx20 while each internal pair remains horizontal and no overflow occurs.
4. In the rendered page, play/scrub both clips through their full durations and verify the robot remains visible within the baked crop, controls work, looping works, captions are readable, and image/video dimensions align.
5. Inspect the neighboring Deformables and Paper video sections in the screenshots to confirm their layout and spacing did not regress.

## Risks and fallback decisions

- **Robot approaches a crop edge:** widen/recenter the physical video crop rather than using CSS pan/zoom or trimming time; keep all outputs within an example at a common 4:5 ratio.
- **idx20 source-level top clipping:** accept only the pixels present in the original video and record it as a source limitation; do not zoom further or fabricate missing content.
- **Autoplay blocked by a browser/user preference:** controls and the first video frame remain available; no script-based autoplay workaround is in scope.
- **Small captions wrap on narrow phones:** permit wrapping. Preserve the two-column real/video relationship unless actual 390px rendering shows overflow that cannot be solved with gap/font spacing.

No package installation, architecture migration, or backward-compatibility shim is needed.
