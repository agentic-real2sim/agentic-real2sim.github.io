# Restore the Local Paper Video Section

## Objective

Copy and compress the user-provided paper demo into this repository, then restore the original centered **Video** section immediately after **Abstract** and before **Interactive Twin (Replay)**. The section must play the new local media rather than embedding YouTube.

## Requirements and Scope

- Source (read-only): `/home/eric/Insync/cgx1997@gmail.com/Google Drive/Research PhysAI+PRIME+HcRL/agentic real2sim/video/demo_0718.mp4`.
- Add one repository asset: `static/videos/demo_0718.mp4`.
- Target approximately 20 MiB, accepting a narrow practical range of roughly 18–22 MiB.
- Preserve browser compatibility: MP4 container, H.264 video, `yuv420p`, AAC audio, and fast-start metadata.
- Preserve the full 254.741-second presentation and its audio. Downscale the 1920×1080 source to 1280×720 so the approximately 550 kbit/s video budget remains usable.
- Restore the prior section location and layout: centered, four-fifths width, `Video` heading, immediately after Abstract in `index.html`.
- Use a native local `<video controls playsinline preload="metadata">` element with a `video/mp4` source and fallback text. Do not autoplay the narrated paper video.
- Restore/adapt `.publication-video` styling in `static/css/index.css` for a responsive 16:9 local video with the existing rounded-corner treatment.
- Do not alter carousel synchronization, the USD viewer, other page sections, or unrelated assets.
- Preserve the existing untracked `static/images/ubc_physai_icon.png` and `static/paper/` files. Do not commit or push.
- No new packages are required; use the installed `ffmpeg`/`ffprobe` tools.

## Implementation Plan

1. **Confirm the source before writing**
   - Assert that the source exists and use `ffprobe` to reconfirm duration, video/audio streams, dimensions, and codecs.
   - Calculate the size budget from the probed duration rather than assuming it. For the currently observed 254.741 seconds, use approximately 550 kbit/s H.264 video plus 96 kbit/s AAC audio.

2. **Create the compressed repository asset**
   - Encode to a temporary explicit output path using two-pass `libx264`, 1280×720 scaling with aspect ratio preserved, `yuv420p`, 96 kbit/s AAC audio, and `-movflags +faststart`.
   - Keep pass-log files in a temporary directory and remove them after a successful encode.
   - Move the completed temporary MP4 to `static/videos/demo_0718.mp4` only after the encode succeeds, so an interrupted encode cannot leave a partial repository asset.
   - If the result falls outside roughly 18–22 MiB, adjust only the calculated video bitrate and re-encode once; do not shorten the video or remove audio.

3. **Restore the Video section in `index.html`**
   - Reinsert the prior `Paper video` block after the closing Abstract block and before the end of that section.
   - Retain the original Bulma layout (`columns is-centered has-text-centered`, `column is-four-fifths`, and `publication-video`).
   - Replace the deleted YouTube iframe with a native video sourced from `./static/videos/demo_0718.mp4`, including controls, inline playback, metadata-only preload, and browser fallback text.
   - Do not restore the removed header Video button unless separately requested; this task restores the standalone section only.

4. **Restore responsive CSS in `static/css/index.css`**
   - Restore `.publication-video` as the responsive 16:9 rounded container used previously.
   - Target `.publication-video video` instead of the old iframe and make it fill the container (`position: absolute`, full width/height), using a black background and `object-fit: contain` to avoid cropping.

## Essential Validation Only

1. Run `ffprobe` on `static/videos/demo_0718.mp4` and assert:
   - total size is roughly 18–22 MiB;
   - duration remains approximately 254.741 seconds;
   - video is H.264 at 1280×720 with `yuv420p`;
   - audio is AAC.
2. Run a short decode smoke test with `ffmpeg` (start and a later seek, a few seconds each) to catch container/codec corruption without spending time on a full decode.
3. Use focused static checks/diff inspection to confirm the section appears exactly once, points to the local asset, sits after Abstract and before the interactive viewer, and the CSS targets the native video.
4. With the existing server on `http://localhost:61499`, use `curl` to confirm `index.html` is reachable and the local MP4 returns successfully with an MP4 content type and nonzero content length. Do not restart or replace the server unless it is no longer serving this repository.
5. Check `git status --short` to ensure only the planned asset, HTML/CSS edits, and this plan changed, while pre-existing untracked files remain untouched.

## Risks and Fallbacks

- At roughly 20 MiB for a 4:15 video, 1080p would be visibly bitrate-starved; 720p is the planned quality/size compromise.
- Two-pass encoding targets size reliably, but muxing overhead may shift the final size slightly. Recalculate video bitrate from the actual result if it misses the accepted range.
- Native video avoids the cross-origin-isolation complication that required `credentialless` on the former YouTube iframe.
