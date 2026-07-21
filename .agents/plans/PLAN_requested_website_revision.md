# Plan: Requested Agentic Real2Sim Website Revision

## Objective and boundaries

Revise the static Agentic Real2Sim project page so its publication links, media, layout, and real/synthetic carousel timing accurately reflect the currently available assets.

This plan covers only:

- `/home/eric/research/ar2s_website/index.html`
- `/home/eric/research/ar2s_website/static/css/index.css`
- the explicitly listed PDF, image, and video assets under `static/`
- minimal inline or existing-page JavaScript needed to synchronize each real/synthetic carousel pair

Do not change Related Links or BibTeX content. Do not add packages or dependencies. Do not push; the local main branch is already ahead of origin.

## Known inputs

| Input | Required use |
|---|---|
| `/home/eric/research/droid_sim/docs/ar2s_arxiv_report/main.pdf` | Copy to `static/pdfs/agentic-real2sim.pdf`; source is 12 pages and has SHA-256 `b3341b7c9c02b950159fba16ebd4b793e11b488d968973d7c60ef8175f2ce73f`. |
| `/media/eric/data/droid_sim/data_from_bingyang/double_drag_cloth_26-07-15_tracked_pc.mp4` | Copy to `static/videos/`; expected 1920×1088, 10 fps, 104 frames, 10.4 s. |
| `/media/eric/data/droid_sim/data_from_bingyang/double_stretch_Toyandona_sloth_26-05-18_tracked_pc.mp4` | Copy to `static/videos/`; expected 2208×1248, 10 fps, 135 frames, 13.5 s. |
| Page 9 of the current paper | Re-extract Figure 4 with `pdfimages`, then crop the right panel starting near geometry `2170x1082+1720+0`; tune after visual inspection and overwrite `static/images/ar2s_humanoid.png`. |

## Files changed

| Path | Planned change |
|---|---|
| `index.html` | Update publication/actions links, section headings and layout, replace deformables image with two videos, remove YouTube section, synchronize carousel pairs, and remove stale footer GitHub link/icon. |
| `static/css/index.css` | Add/adjust responsive two-video and full-width humanoid layout styles; remove styles used only by the deleted YouTube section; style the disabled Code action consistently and accessibly. |
| `static/pdfs/agentic-real2sim.pdf` | New copied paper PDF. |
| `static/videos/double_drag_cloth_26-07-15_tracked_pc.mp4` | New copied deformables video. |
| `static/videos/double_stretch_Toyandona_sloth_26-05-18_tracked_pc.mp4` | New copied deformables video. |
| `static/images/ar2s_humanoid.png` | Replace with a newly extracted and visually tuned crop of Figure 4's right panel. |
| Existing three synthetic carousel video files | Atomically replace each with a retimed and duration-matched H.264/YUV420p version; identify the existing paths from the three pair elements in `index.html` before transcoding. |

No unrelated files should change.

## Implementation sequence

### 1. Establish exact edit targets without broad refactoring

1. Record `git status --short --branch` and `git diff -- index.html static/css/index.css` before editing so pre-existing user changes are preserved.
2. Inspect only the relevant portions of `index.html` and `static/css/index.css` to identify:
   - the top Paper, Arxiv, Video, Data, and Code controls;
   - the Deformables and Humanoid markup;
   - the standalone YouTube Video section and its dedicated selectors;
   - the three real/synthetic carousel pair elements and their existing asset paths;
   - the footer PDF and GitHub links;
   - the current carousel script and event handling.
3. Keep existing naming, indentation, framework conventions, and carousel behavior. Avoid unrelated cleanup.

### 2. Install and wire the paper PDF

1. Create `static/pdfs/` if it does not already exist.
2. Verify the source PDF before copying:
   - `sha256sum` must equal `b3341b7c9c02b950159fba16ebd4b793e11b488d968973d7c60ef8175f2ce73f`.
   - `pdfinfo` must report 12 pages.
3. Copy it byte-for-byte to `static/pdfs/agentic-real2sim.pdf`.
4. Point both the top Paper action and the footer PDF link at `static/pdfs/agentic-real2sim.pdf`, using the page's existing relative-link convention.
5. Recompute the destination hash and assert it matches the source hash.

### 3. Correct the top action controls and footer

1. Delete the top Arxiv, Video, and Data buttons completely, including their icons and wrappers if those wrappers become empty.
2. Retain the top Paper control and update its target to the local PDF.
3. Convert Code into a genuinely disabled non-navigation control:
   - exact visible text: `Code (coming soon)`;
   - no `href` or other click-through behavior;
   - `aria-disabled="true"`;
   - preserve the surrounding visual language while giving it a clear disabled cursor/opacity treatment;
   - if an anchor is retained for styling compatibility, remove it from keyboard navigation with `tabindex="-1"`; prefer a semantically disabled button/span if compatible with the existing markup.
4. Remove the stale footer GitHub icon/link because code is not yet available.
5. Leave the footer PDF entry present and point it to the new local paper.

### 4. Replace the Deformables still image with exactly two videos

1. Verify each source using `ffprobe` before copying:
   - drag cloth: 1920×1088, 10 fps, 104 decoded/declared frames, 10.4 s;
   - stretch sloth: 2208×1248, 10 fps, 135 decoded/declared frames, 13.5 s.
2. Copy exactly those two named files into `static/videos/`, retaining their filenames. Do not copy any neighboring media.
3. Replace the Deformables image in `index.html` with two responsive `<video>` elements, each using:
   - `autoplay`
   - `controls`
   - `muted`
   - `loop`
   - `playsinline`
   - a direct local source path and appropriate `video/mp4` MIME declaration if the existing markup uses `<source>`.
4. Keep meaningful accessible fallback text and, if the page convention supports it, concise labels/captions distinguishing the two examples.
5. Use CSS grid/flex styles consistent with the page: two columns when space permits and one column on narrow viewports; videos must be `max-width: 100%`, preserve aspect ratio, and not overflow their card/container.
6. Rename the relevant heading exactly from `Interactive Simulator Twin` to `Interactive Twin (Replay)`.

### 5. Move Humanoid into its own full-width block

1. Move the Humanoid content below the Deformables block rather than leaving it as a peer column beside Deformables.
2. Make the Humanoid container span the available content width while retaining the page's established spacing, typography, and image responsiveness.
3. Ensure DOM order is Deformables first, then Humanoid, for both visual flow and reading order.

### 6. Re-extract and tune the Humanoid figure

1. Work in a temporary directory outside the tracked asset tree.
2. Run `pdfimages` against the verified current paper PDF and identify the raster corresponding to Figure 4 on PDF page 9. Account for the distinction between human page numbering and zero-based page-selection flags.
3. Inspect the extracted image dimensions and orientation. Crop the Figure 4 right panel beginning with the supplied approximate geometry `2170x1082+1720+0`.
4. Visually inspect the crop at full resolution. Tune the crop bounds only as needed to:
   - contain the complete right-hand Humanoid panel;
   - exclude the left panel, page margins, captions, and neighboring text;
   - avoid clipping labels, robot/human content, or panel edges;
   - preserve useful resolution and the original aspect relationship.
5. Overwrite `static/images/ar2s_humanoid.png` only after the tuned temporary crop is confirmed. Preserve PNG output and do not recompress destructively beyond what the extraction/crop requires.
6. Open the final file and visually verify it once more in the actual page layout at desktop and narrow widths.

### 7. Remove the standalone YouTube section cleanly

1. Delete the entire standalone YouTube Video section from `index.html`, including its heading, embed/iframe, wrapper, and any section-only script or initialization.
2. Remove CSS selectors that are exclusively used by that deleted section.
3. Do not remove generic responsive-media rules still used by the newly added local videos or other sections.
4. Confirm there are no remaining `youtube`, `youtu.be`, iframe embed, or stale standalone `Video` section strings in the rendered page source.

### 8. Normalize the three synthetic carousel videos

Map the three carousel items by their real-video identifiers and use the actual existing synthetic paths found in `index.html`:

| Pair | Real reference | Current synthetic reference | Required synthetic output |
|---|---:|---:|---:|
| `052` | 12 fps, 121 frames, 10.083333 s | 2,425 frames, 161.666667 s | 12 fps, exactly 121 frames, exactly the real duration |
| `089` | 12 fps, 37 frames, 3.083333 s | 749 frames, 49.933333 s | 12 fps, exactly 37 frames, exactly the real duration |
| `091` | 12 fps, 20 frames, 1.666667 s | 405 frames, 27 s | 12 fps, exactly 20 frames, exactly the real duration |

For each synthetic file:

1. Probe and record the original path, codec, average/rational frame rates, duration, and frame count.
2. Transcode to a temporary file in the same destination directory, never directly over the input. Apply the semantic equivalent of:
   - `setpts=PTS/16`
   - `fps=12`
   - trim to the exact paired real duration/frame boundary
   - `libx264`
   - `yuv420p`
   - `+faststart`
   - no audio unless the current page explicitly relies on it (the carousel is expected to be visual-only).
3. Prefer an explicit frame cap (`-frames:v 121`, `37`, or `20`) together with the requested timing/filter chain so floating-point duration rounding cannot add a frame. Ensure timestamps begin at zero.
4. Probe the temporary result and assert all of the following before replacement:
   - 12 fps;
   - H.264 video;
   - `yuv420p`;
   - exact frame count 121, 37, or 20;
   - duration equal to the matching real video within one frame-time tolerance, with the container duration representing the exact requested frame sequence;
   - decodes without errors.
5. Atomically rename the validated temporary file over its original synthetic path. Leave no transcode temp files behind.
6. Do not alter the real videos.

### 9. Synchronize each visible real/synthetic pair

1. Preserve the existing carousel's previous/next, indicators, autoplay, and slide activation behavior.
2. Add the smallest page-local JavaScript necessary to treat the real and synthetic `<video>` elements inside one carousel item as a pair:
   - when a pair becomes active, reset or align both to a common start time and call `play()` together;
   - when either video seeks, propagate the normalized position to its partner while using a re-entrancy guard to prevent event loops;
   - on manual play/pause, mirror the state to the partner;
   - on ended/loop boundary, restart both at zero together rather than allowing independent drift;
   - pause/reset videos in inactive carousel items so hidden slides do not continue independently.
3. Because the paired files now have equal durations, use direct time alignment; clamp to the shorter duration only to avoid a browser seeking beyond a media boundary.
4. Keep `muted`/`playsinline` behavior compatible with autoplay policies. Handle the returned `play()` promise without masking implementation errors; a rejected autoplay attempt may leave both paused until user interaction.
5. Avoid a timer-heavy synchronization loop unless browser testing demonstrates material drift. Prefer media and carousel lifecycle events, with an occasional correction only if the absolute time delta crosses a small threshold (for example, one 12 fps frame).

### 10. CSS and responsive cleanup

1. Add only selectors required for:
   - the responsive two-video Deformables layout;
   - the new full-width Humanoid block;
   - the disabled Code appearance/state;
   - any pair layout adjustments needed after media replacement.
2. Reuse existing breakpoints and naming conventions.
3. Remove dead YouTube-section rules after confirming they have no other consumers.
4. Check at representative desktop, tablet, and phone widths that controls remain usable, media does not overflow, headings do not collide, and the two Deformables videos stack cleanly.

## Validation plan

### Asset integrity and media probes

- `sha256sum` on source and destination paper must both equal `b3341b7c9c02b950159fba16ebd4b793e11b488d968973d7c60ef8175f2ce73f`.
- `pdfinfo static/pdfs/agentic-real2sim.pdf` must report 12 pages.
- Compare source/destination hashes for both copied Deformables videos to confirm byte-identical copies.
- Use `ffprobe` for all two copied videos, three real carousel videos, and three transcoded synthetic videos. Capture width, height, codec, pixel format, frame rates, duration, and frame count.
- Decode-test each changed/new MP4 to a null sink so a file that probes but contains corrupt frames cannot pass.
- Confirm synthetic counts are exactly 121, 37, and 20 at 12 fps and their durations match their respective real files.

### Static HTML/CSS/JavaScript checks

- Search the edited HTML for the exact text `Code (coming soon)` and `aria-disabled="true"`.
- Assert the Code element has no misleading `href`.
- Assert the top Arxiv, Video, and Data controls are absent.
- Assert both top Paper and footer PDF links resolve to `static/pdfs/agentic-real2sim.pdf`.
- Assert the footer GitHub link/icon is absent.
- Assert the heading is exactly `Interactive Twin (Replay)` and `Interactive Simulator Twin` is absent.
- Assert exactly the two requested Deformables video filenames appear and each video carries `autoplay`, `controls`, `muted`, `loop`, and `playsinline`.
- Assert the Humanoid block follows Deformables in DOM order and is no longer constrained to the former side-by-side column.
- Search case-insensitively for stale YouTube URLs/identifiers, iframe embed markup, deleted button labels, and CSS selectors belonging only to the removed section.
- Confirm Related Links and BibTeX diffs are empty.
- Run any existing repository-native formatting/static validation command, but install nothing new.

### Served-site checks

1. Serve the repository root with the project's existing static-site command or a local static HTTP server.
2. Request the page and all newly referenced assets, confirming HTTP 200:
   - `/`
   - `/static/pdfs/agentic-real2sim.pdf`
   - both copied Deformables MP4s
   - `static/images/ar2s_humanoid.png`
   - all three transcoded synthetic carousel MP4s
3. Confirm useful MIME types: `text/html`, `application/pdf`, `video/mp4`, and `image/png` respectively.
4. In a browser, verify:
   - Paper links open/download the local PDF;
   - Code is visibly and semantically disabled;
   - no deleted buttons, YouTube section, or stale footer GitHub entry remains;
   - both Deformables videos render, autoplay when permitted, loop, expose controls, and resize without overflow;
   - Humanoid appears full-width below Deformables and its crop is sharp, complete, and free of adjacent panel/page material;
   - carousel navigation remains functional;
   - for all three slides, real and synthetic videos start, seek, pause/play, and loop together with no visible drift greater than about one frame;
   - inactive slide media is paused/reset.
5. Capture desktop and narrow/mobile screenshots if browser tooling is available, including the Deformables/Humanoid region and at least one carousel pair. Compare visually for overflow, crop quality, spacing, and control state.

### Change-scope checks

- Review `git diff --stat` and `git diff --check`.
- Review the full diff and confirm only the files enumerated above changed.
- Confirm no package manifest, lockfile, Related Links content, or BibTeX content changed.
- Confirm the branch remains local only; do not push even though main is ahead of origin.

## Acceptance matrix

| Requirement | Acceptance evidence |
|---|---|
| Local paper installed | Destination exists, is 12 pages, and has exact SHA-256 `b3341b7c9c02b950159fba16ebd4b793e11b488d968973d7c60ef8175f2ce73f`. |
| Paper links corrected | Top Paper and footer PDF both resolve over HTTP 200 to `static/pdfs/agentic-real2sim.pdf`. |
| Obsolete top buttons removed | Arxiv, Video, and Data controls are absent from source and rendered header/action area. |
| Code accurately disabled | Exact text `Code (coming soon)`, `aria-disabled="true"`, no `href`/navigation, disabled visual state, and no keyboard/click activation. |
| Footer GitHub removed | No stale footer GitHub icon or link remains. |
| Deformables media replaced | Exactly the two requested source files are copied byte-identically and rendered as responsive videos with all five required attributes. |
| Heading renamed | `Interactive Twin (Replay)` is rendered; old heading is absent. |
| Humanoid layout changed | Humanoid is a full-width block below Deformables at desktop and mobile widths. |
| Humanoid figure refreshed | `ar2s_humanoid.png` comes from current paper page 9 Figure 4 right panel and passes visual crop inspection without clipping or neighboring content. |
| YouTube section removed | No standalone section, iframe/URL, initialization code, or section-only CSS remains. |
| Synthetic `052` retimed | H.264/YUV420p/faststart, 12 fps, exactly 121 frames, duration aligned with 10.083333 s real video, clean decode. |
| Synthetic `089` retimed | H.264/YUV420p/faststart, 12 fps, exactly 37 frames, duration aligned with 3.083333 s real video, clean decode. |
| Synthetic `091` retimed | H.264/YUV420p/faststart, 12 fps, exactly 20 frames, duration aligned with 1.666667 s real video, clean decode. |
| Pair synchronization works | Within every active carousel slide, paired videos start, seek, play/pause, and loop together; visible drift stays within roughly one 12 fps frame; inactive pairs stop/reset. |
| Carousel preserved | Existing slide navigation, indicators, and activation behavior still work. |
| Static delivery valid | Page and every changed/new asset return HTTP 200 with an appropriate MIME type. |
| Responsive presentation valid | Browser inspection/screenshots show no media overflow and a clean one-column fallback on narrow screens. |
| Scope respected | Related Links and BibTeX unchanged; no dependencies added; no unrelated files modified; no push performed. |

## Assumptions

- The three real/synthetic carousel pairs can be unambiguously identified by the real identifiers `052`, `089`, and `091` in existing markup or filenames.
- The synthetic files are tracked local assets suitable for in-place replacement after validation.
- The supplied real durations represent frame-count divided by 12 fps; container metadata may display a rounded decimal, so frame count and time base are the authoritative exact checks.
- The two Deformables MP4s are browser-compatible as copied. If probing reveals a codec that browsers used by the project cannot play, stop and report the mismatch rather than silently transcoding, because the requirement is to copy these sources.
- `pdfimages`, an image crop utility, `ffmpeg`, `ffprobe`, `pdfinfo`, and a browser or screenshot facility are already available; no package installation is authorized.
- Existing page JavaScript provides carousel lifecycle events that can be extended locally without introducing a library.
- The approximate crop geometry refers to the extracted Figure 4 raster, not PDF points; visual tuning is expected before overwriting the tracked PNG.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `pdfimages` emits multiple image/mask files or page numbering is misinterpreted. | Correlate extracted dimensions/content with visible PDF page 9, inspect candidates, and crop only after visual confirmation. |
| Approximate crop clips content or includes the adjacent panel. | Crop to a temporary PNG, inspect at full resolution, tune bounds, and verify again in the rendered layout before replacement. |
| `setpts` plus `fps` rounding yields one extra/missing frame. | Use an explicit output frame cap, start timestamps at zero, and reject any temp output whose `ffprobe` count is not exactly 121/37/20. |
| MP4 duration metadata differs by a tiny rounding amount. | Treat exact 12 fps frame count as authoritative and accept container-duration variance only within one frame; compare playback endpoints in-browser. |
| Independent HTML video loops drift despite equal encodes. | Coordinate pair events, reset both on loop boundaries, and apply correction when drift exceeds about one frame. |
| Mirrored media events recurse indefinitely. | Use a per-pair synchronization guard while propagating seek/play/pause state. |
| Autoplay is blocked by browser policy. | Keep videos muted and playsinline; handle rejected play promises and verify paired behavior after a user gesture. |
| Removing generic video CSS breaks the new local media. | Remove only selectors proven exclusive to the old YouTube section and exercise desktop/mobile rendering. |
| Existing uncommitted work overlaps target files. | Record initial status/diff, edit narrowly, preserve unrelated hunks, and stop for direction if overlap cannot be safely separated. |
| Direct transcoding corrupts tracked assets on failure. | Encode and fully validate same-directory temporary files, then atomically rename over originals. |
| Main is ahead of origin and changes are accidentally published. | Perform no push or remote mutation; finish with local validation and diff review only. |

## Completion handoff

Report the files changed, exact PDF hash/page result, `ffprobe` summary for all relevant videos, final crop dimensions, static search results, served HTTP/MIME results, browser synchronization observations, and any validation unavailable in the environment. Explicitly state that no packages were added and no push was performed.
