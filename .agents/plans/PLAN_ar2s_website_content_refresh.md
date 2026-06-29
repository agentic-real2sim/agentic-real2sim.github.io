# PLAN: Agentic Real2Sim Website Content Refresh

## Exploration summary

- The repository is a small static Nerfies website fork. The primary entry point is `index.html`, with site styling in `static/css/index.css` and carousel/interpolation behavior in `static/js/index.js`.
- Existing Nerfies media, carousel, interpolation frames, and buttons are already committed under `static/`; the requested work is a content/media replacement, not a framework migration.
- The Agentic Real2Sim report title and abstract live in `/home/eric/research/droid_sim/docs/ar2s_arxiv_report/main.tex` and `sections/0_abstract.tex`.
- Involved institution logos are explicitly listed in the report as NHR FAU, Columbia University, Style3D, National University of Singapore, Johns Hopkins University, UCLA, and UBC. The LaTeX author/affiliation fields are placeholders, so the website should use the user-requested temporary author string `UBC PhysAI Lab`.
- Usable video assets are in `/media/eric/data/droid_sim/ar2s_usable_videos_26-06-29/` and include paired real/sim DROID clips for episodes 052, 089, and 091 plus an IRIS raw clip.
- Existing static images suitable for the two replacement side-by-side sections are in the report figures directory, especially `phystwin_humanoid.png`, which contains a left PhysTwin/deformable panel and a right humanoid panel.

## Requirements and scope

1. Remove the top `More Research` navbar dropdown.
2. Replace title, author, and institution text with Agentic Real2Sim content.
3. Keep the existing Nerfies Paper/arXiv/Video/Code/Data links as placeholders.
4. Generate a local looping teaser video from the available DROID/AR2S clips and use it in the teaser hero.
5. Replace the Nerfies teaser subtitle with Agentic Real2Sim copy.
6. Replace the Abstract section with the Agentic Real2Sim abstract adapted from the report.
7. Keep the Nerfies Video section unchanged.
8. Replace `Visual Effects` and `Matting` with `Deformables` and `Humanoid`, using locally generated/cropped static images from current report assets.
9. Remove the `Animation` section.
10. Keep Related Links and BibTeX sections unchanged.
11. Add footer text: `Source code mainly borrowed from Keunhong Park's Nerfies website`.
12. Do not publish the site. Provide local viewing instructions after validation.

## Files to modify

- `index.html`: primary content replacements and section removal.
- `static/css/index.css`: add small styling rules for the generated AR2S media and static panels; avoid broad redesign.
- `static/js/index.js`: remove interpolation preloading and slider setup after deleting the Animation section.
- `README.md`: update the project description while preserving Nerfies citation/license context.

## Files/assets to add or generate

- `static/videos/ar2s_teaser.mp4`: generated looping teaser from the provided real/sim clips.
- `static/videos/ar2s_ep_052_real.mp4`, `static/videos/ar2s_ep_052_simulated.mp4`, `static/videos/ar2s_ep_089_real.mp4`, `static/videos/ar2s_ep_089_simulated.mp4`, `static/videos/ar2s_ep_091_real.mp4`, `static/videos/ar2s_ep_091_simulated.mp4`: local copies for the carousel.
- `static/images/ar2s_deformables.png`: cropped left panel from `phystwin_humanoid.png`.
- `static/images/ar2s_humanoid.png`: cropped right panel from `phystwin_humanoid.png`.

## Implementation steps

1. Generate media assets with `ffmpeg`/`convert`, not Python. Since no Python script is needed, do not create the requested conda environment scaffolding.
2. Update `index.html`:
   - remove the navbar dropdown;
   - change metadata, title, displayed title, author, and institution blocks;
   - keep Nerfies placeholder link URLs;
   - point teaser to `static/videos/ar2s_teaser.mp4`;
   - point carousel items to local AR2S clips;
   - replace abstract paragraphs with report-derived copy;
   - replace the two side-by-side sections with Deformables/Humanoid image panels;
   - delete Animation markup;
   - add the requested footer attribution.
3. Update `static/css/index.css` only for necessary image/video presentation.
4. Update `static/js/index.js` so it only handles the burger menu and carousel initialization.
5. Update `README.md` to describe the AR2S website fork and how to preview locally.

## Validation

- Start a local static HTTP server with `python3 -m http.server` in this repo.
- Use browser or HTTP checks to confirm `index.html` and new generated media return successfully.
- Inspect the rendered page enough to confirm the main content, media, and deleted sections match requirements.
- Check `git diff --stat` and `git status --short` to report changed files.

## Risks and assumptions

- The exact final author list is not available in the report; per user instruction, the page uses only `UBC PhysAI Lab`.
- The LaTeX affiliation fields are placeholders. Institution names are inferred from the explicit report logo filenames.
- Generated media is intentionally short and compressed for a website teaser. It is a preview asset, not final publication media.
