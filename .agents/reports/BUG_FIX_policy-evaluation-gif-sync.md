# Bug Fix Report: Policy Evaluation GIF Synchronization

## Bug description

The Policy Evaluation section shows eight episodes, each as a real-world GIF
beside a Gaussian-rendered synthetic policy-execution GIF. The observed
misbehavior is that the two panes become desynchronized: their apparent cadence
differs and their lengths appear different.

Expected behavior: each pair should appear together, advance on the same source
timeline, and cross each loop boundary together while retaining the Real/Sim
comparison.

Reproduction:

1. Serve `index.html` as a local static site.
2. Cold-load the page and scroll to Policy Evaluation.
3. Watch any Real/Sim pair during initial loading and for at least two complete
   loops.

There is no runtime exception. Probe reports show that all eight real sources and
all eight sim sources are 15 fps, 350 frames, and 23.333333 seconds. Every
generated GIF is 6 fps, 140 frames, and 23.34 seconds. The source and output
durations therefore match exactly across every pair.

The conversion pipeline in
`.agents/scripts/create_policy_evaluation_gifs.sh` independently encodes each
side. The page then loads each episode as two separate
`<img loading="lazy" decoding="async">` elements. Real GIFs are approximately
2.7–3.2 MB, while sim GIFs are approximately 0.24–1.18 MB. The page contains no
shared playback clock or synchronization mechanism. Contact-sheet samples at
source frames 0, 117, 233, and 349 show that both inputs cover the full timeline.
Real demonstrations and simulated policy rollouts are distinct executions, so
their semantic action phases need not be pixel-identical even when their source
timestamps are aligned.

A pre-existing, unrelated worktree modification in `static/css/index.css`
lowers the Policy Evaluation grid collapse breakpoint. It must be preserved.
The current branch is `main`; no `.agents/knowledge/main.md` exists.

---

## Hypothesis H0

**Statement**: The encoded media durations are not mismatched. The apparent
desynchronization is caused by `index.html` loading each real/sim pair as two
independent animated GIF `<img>` resources with `loading="lazy"` and
`decoding="async"`. Because the real GIFs are substantially larger, their
download/decode and animation clocks commonly begin later than the sim GIFs.
Independent GIF clocks provide no invariant that preserves phase across first
load, frame scheduling, tab throttling, or subsequent loops. The minimal robust
fix is to generate one side-by-side animated GIF per episode, synchronizing both
inputs by normalized timestamps in one filter graph before encoding, and display
that single resource while retaining separate Real and Sim labels.

**Rationale**: All eight source pairs and all sixteen current GIFs have equal
nominal frame rate, frame count, and duration. This rules out unequal encoded
length as the cause of browser playback phase. Separate resources can still
start at different times due to their large size asymmetry and independent
download, decode, and animation scheduling. A combined artifact has one
resource, decoder, frame sequence, and clock.

**Confirmation checklist**:

- [x] For every episode, both source timelines reset to zero, are sampled at the
  same rate and dimensions, only the intended Gaussian-rendered half is cropped,
  and matching timestamps are combined before GIF encoding.
- [x] Each combined artifact contains exactly 140 frames, lasts approximately
  23.34 seconds, loops indefinitely, and has a 2:1 width ratio with equal Real
  and Sim panes.
- [x] Sampled first, middle, last, and loop-boundary frames demonstrate that
  both displayed panes derive from the same ordinal source frame.
- [x] Policy Evaluation contains exactly one animated image per episode and no
  independently animated Real/Sim image pair, while labels and descriptions
  remain intact.
- [x] A cold-cache browser load shows both panes appearing and advancing
  together.
- [x] Across at least two complete loops, both panes cross the final-to-first
  boundary together without independent restart offsets.
- [x] Validation distinguishes any remaining content-level action-cadence
  divergence from playback-clock divergence.

**Feature**: `lock-policy-pairs-to-one-animation-clock` — Generate and render
each episode as one timestamp-aligned side-by-side GIF and add frame-ordinal
validation. Acceptance criteria: eight reproducible combined GIFs; frame count,
duration, loop, dimensions, and ordinal checks pass; one animated resource per
episode preserves labels, descriptions, layout, and the unrelated breakpoint
change; cold-load and multi-loop validation show simultaneous start and restart.

**Expected observable effect**: Real and Sim appear simultaneously and remain
mechanically phase-locked through every loop. Differences in performed motion
may remain because the recordings are distinct executions.

**Runtime result summary**: The generator produced exactly eight combined
640x180 GIFs. Each is 6 fps, 140 frames, 23.340 seconds, and infinitely looping.
For every episode, the Real and Sim normalized timeline manifests contain the
same 140 timing rows with exact DTS/PTS ordinals 0 through 139. A second complete
generation run produced byte-identical published hashes.

The page contains eight episode cards and one combined animated image per card,
with no legacy side-specific GIF references. A fresh-profile, cold-cache Firefox
run requested exactly the eight combined assets, loaded all of them at natural
640x180 dimensions, and requested no legacy assets. The section remained visible
for 48.028 seconds, more than two full loops, with no reloads. Screenshots at
1440, 720, and the headless Firefox minimum of 500 CSS pixels showed the intended
two-card/two-card/one-card responsive layouts without overflow.

Because each episode's two panes are regions of one decoded GIF canvas and one
frame sequence, they necessarily share browser frame scheduling and the 139-to-0
loop boundary. Distinct real and simulated trajectories can still reach semantic
action milestones at different timestamps.

The combined payload is 44,682,952 bytes (42.61 MiB), compared with 27.72 MiB
before the fix: an increase of 14.89 MiB (53.7%). This may delay when a card
first appears, but it cannot create an intra-pair phase offset because both panes
now load as one resource.

**Hypothesis verdict**: CONFIRMED.

**Hypothesizer reasoning**: Equal source and output durations ruled out an
encoded-length mismatch. The former two-image design allowed different download,
decode, startup, and scheduling phases. The new one-image design removes that
causal mechanism: normalized Real and Sim frame ordinals are combined before
encoding, and the browser receives one canvas, decoder, frame sequence, and
animation clock per episode. All checklist conditions passed. Any remaining
difference in how quickly the action itself unfolds is content-level policy
behavior rather than media-clock desynchronization.

---

## Executive summary

- **Bug confirmed fixed by**: H0.
- **Root cause**: Each Real/Sim pair was encoded with equal duration but rendered
  as two independent lazy, asynchronously decoded GIF resources. Their strongly
  different payload sizes let them become playable at different times, leaving
  equal-duration loops permanently phase-offset.
- **Fix implemented**: The media generator now resets and normalizes both source
  timelines, crops the intended Gaussian view, combines matching 6 fps ordinals
  into one 640x180 canvas, and encodes one looping GIF per episode. The page now
  renders eight combined images while preserving labels, captions, card layout,
  and the existing 560 px breakpoint. The generator also emits strict timeline,
  frame-count, loop, directory-inventory, hash, and contact-sheet evidence.
- **Evidence**: All eight outputs pass 140-frame/23.340-second/infinite-loop
  checks; all sixteen branch timelines match ordinals 0–139; repeated generation
  is hash-stable; cold-cache Firefox loaded exactly eight combined assets; and a
  48.028-second visible run crossed more than two loops without resource reload.
- **Total hypotheses tested**: 1.
- **Remaining uncertainties**: No before-fix browser trace exists, so the
  original runtime phase offset was not recorded directly. Semantic action
  cadence remains intentionally unconstrained because Real and Sim are distinct
  executions. The combined GIF strategy raises total payload by 53.7%, which is
  a separate loading-performance tradeoff.
