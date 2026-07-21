# Relocate Video and Remove Related Links

## Objective

Move the existing local **Video** block from below **Abstract** to immediately below **Humanoid**, and remove the obsolete **Related Links** block. This is an HTML-only layout change.

## Scope and Invariants

- Modify only `index.html`.
- Move the complete block delimited by `<!-- Paper video. -->` and `<!--/ Paper video. -->` unchanged, including its Bulma classes, heading, native `<video>` attributes, fallback text, and `./static/videos/demo_0718.mp4` source.
- Insert that block immediately after `<!--/ Humanoid. -->` and before the enclosing section's container/section closing tags.
- Remove the complete block delimited by `<!-- Concurrent Work. -->` and `<!--/ Concurrent Work. -->`, including the **Related Links** heading, paragraphs, and links.
- Keep exactly one Video block and one reference to `demo_0718.mp4`.
- Preserve Abstract, Interactive Twin, Deformables, Humanoid, BibTeX, all CSS, JavaScript, media, and unrelated/untracked files exactly as they are.
- Install no packages. Do not commit or push.

## Implementation Steps

1. In `index.html`, cut the full existing Paper video block from its current position after Abstract.
2. Delete the full Concurrent Work / Related Links block after Humanoid.
3. Paste the Paper video block, byte-for-byte unchanged, immediately after the Humanoid closing marker and before the current container and section closing tags.
4. Inspect the focused `index.html` diff to ensure the change is purely block relocation plus Related Links deletion, with no edits inside the Video block or elsewhere.

## Minimal Validation

1. Run focused static searches/assertions confirming:
   - `Paper video`, the `Video` heading, and `demo_0718.mp4` each occur exactly once;
   - `Related Links`, `Concurrent Work`, and its old outbound URLs no longer occur;
   - document order is Humanoid → Paper video → section close → BibTeX;
   - Abstract no longer contains the Video block.
2. Confirm `git diff --name-only` adds no modified implementation file beyond the already changed `index.html`; specifically, this task must not change CSS or media.
3. Request `http://localhost:61499/` with `curl` and confirm the served HTML contains the relocated Video block after Humanoid and contains no Related Links heading. Do not restart the server unless it is no longer serving this repository.
4. Check `git status --short` to verify pre-existing untracked files remain untouched and no commit or push occurred.
