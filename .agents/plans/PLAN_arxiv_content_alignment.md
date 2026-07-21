# PLAN: Align Website Copy with the Agentic Real2Sim arXiv Report

## Scope and source of truth

- Treat `/home/eric/research/droid_sim/docs/ar2s_arxiv_report/main.tex` and its `sections/*.tex` inputs as canonical.
- Modify only `index.html` and `README.md`; add no assets, styles, scripts, packages, or dependencies.
- Preserve copy already identical to the report, especially the full Abstract and BibTeX metadata, plus the PDF path, links/buttons, viewer controls, accessibility/fallback text, footer/license/attribution, and other implementation-oriented UI copy.
- Treat the current working tree at implementation time as the baseline. Concurrent humanoid media work in `index.html`, `static/css/index.css`, and static assets is unrelated and must not be reverted, replaced, reformatted, or removed. Do not edit CSS/assets; in `index.html`, restrict humanoid changes to report-aligned prose only when the edit is unambiguous.

## `index.html`

1. Replace both the document title and visible paper heading with the canonical primary title: `Agentic Real2Sim: Physics-based World Modeling with Vision-Language Agents`. Align the metadata description/keywords only where needed to use the report's terminology.
2. Replace the lab placeholder with the report's 23 authors in exact order, mimicking the [Nerfies author header](https://nerfies.github.io/): one `span.author-block` per author, an individual linked name, and a following `sup` containing affiliation/contribution markers. Do not link a whole author row or institution marker. Use `*` only for the five co-first authors; intentionally omit the report's `#` marker from Guanxiong Chen and omit all project-lead text. Render only the note `* Equal technical contribution.`

### Verified author links and markers

The following mapping was identity-checked on 2026-07-21 against the person's own biography or a matching LinkedIn profile. It follows the requested priority for non-PIs (personal homepage, then LinkedIn, then OpenReview); PIs use personal homepages.

| # | Linked author | Marker | Link type | Exact URL |
|---:|---|---|---|---|
| 1 | Guanxiong Chen | `1,*` | Personal | `https://www.cs.ubc.ca/~gxchen/` |
| 2 | Qianjun Xia | `1,*` | Personal | `https://qianjun-xia.github.io/` |
| 3 | Jiawei Peng | `2,*` | LinkedIn | `https://www.linkedin.com/in/jiawei-peng-59a713190` |
| 4 | Heng Zhang | `1,*` | Personal | `https://home.mediosz.club/` |
| 5 | Bole Ma | `3,*` | LinkedIn | `https://de.linkedin.com/in/david-bole-ma` |
| 6 | Justin Qian | `1` | LinkedIn | `https://ca.linkedin.com/in/justin-qian` |
| 7 | Ziyi Jiao | `1` | LinkedIn | `https://ca.linkedin.com/in/allison-ziyi-jiao` |
| 8 | Bingyang Zhou | `6` | LinkedIn | `https://sg.linkedin.com/in/bingyang-zhou-69613b292` |
| 9 | Luoxin Ye | `2` | LinkedIn | `https://www.linkedin.com/in/luoxin-ye-b584a0317` |
| 10 | Kaifeng Zhang | `4` | Personal | `https://kywind.github.io/` |
| 11 | Kunyi Wang | `1` | LinkedIn | `https://ca.linkedin.com/in/kunyi-wang-0933b2241` |
| 12 | Weijia Zeng | `1` | LinkedIn | `https://www.linkedin.com/in/weijia-zeng-0a4686238` |
| 13 | Yunuo Chen | `5` | Personal | `https://yunuoch.github.io/` |
| 14 | Pengzhi Yang | `6` | Personal | `https://pengzhi1998.github.io/` |
| 15 | Ziqiu Zeng | `6` | Personal | `https://ziqiu-zeng.github.io/homepage/` |
| 16 | Huamin Wang | `7` | PI personal | `https://wanghmin.github.io/` |
| 17 | Chao Liu | `1` | PI personal | `https://chaoliu.tech/` |
| 18 | Alan Yuille | `2` | PI personal | `https://www.cs.jhu.edu/~ayuille1/` |
| 19 | Fan Shi | `6` | PI personal | `https://fanshi14.github.io/me/` |
| 20 | Changxi Zheng | `4` | PI personal | `https://www.cs.columbia.edu/~cxz/` |
| 21 | Yunzhu Li | `4` | PI personal | `https://people.csail.mit.edu/liyunzhu/` |
| 22 | Chenfanfu Jiang | `5` | PI personal | `https://www.math.ucla.edu/~cffjiang/` |
| 23 | Peter Yichen Chen | `1` | PI personal | `https://peterchencyc.com/` |
3. Replace abbreviated/reordered institution labels with the seven full affiliations in numeric order:
   1. University of British Columbia
   2. Johns Hopkins University
   3. Erlangen National High Performance Computing Center (NHR@FAU), Friedrich-Alexander-Universität Erlangen-Nürnberg
   4. Columbia University
   5. University of California, Los Angeles
   6. National University of Singapore
   7. Style3D
4. Audit non-preserved research copy against the report and use its canonical vocabulary consistently: `real-to-sim`, `simulatable digital twin` / `simulatable episodic twin`, `DROID robot manipulation episodes`, `MuJoCo-simulated episodic twins`, `visual processing`, `physical-prior inference`, `scene preparation`, and `simulator-in-the-loop refinement` (or `grasp optimization` where describing that stage).
5. Align scene-facing prose and labels without changing layout or behavior:
   - teaser and real/simulation pair labels should describe recorded real-world interactions and their MuJoCo episode twins;
   - the OpenUSD section should describe browser exploration as a presentation of reconstructed simulatable episode twins, without implying OpenUSD/three.js Hydra is the paper's simulation backend;
   - deformable copy should follow the report's PhysTwin/EMPM adapter description (tracked geometry/material or connectivity state and rollout-based reproduction of observed deformation);
   - humanoid copy should follow the report's motion-context retrieval, embodiment-specific initialization, and closed-loop replay against retargeted reference motion, avoiding claims not made in the report. Preserve all concurrently added humanoid media cards, sources, captions, classes, controls, ordering, and asset references; if a caption is inseparable from the media semantics, leave it unchanged rather than guessing.
6. Leave the Abstract byte-for-byte in substance (HTML emphasis aside), because it already matches `sections/0_abstract.tex`; leave BibTeX, PDF link/path, episode names, media captions, viewer button names, control instructions, video fallback strings, and footer/UI mechanics unchanged unless an exact report contradiction is found.

## `README.md`

1. Update the heading and opening project description to the canonical paper title and report-aligned one-sentence summary.
2. Preserve local-preview instructions, Nerfies attribution/citation, and license text; do not broaden the README into paper documentation or duplicate the full author/affiliation block.

## Validation

1. Run exact-string/static checks for the canonical title, all 23 linked authors and exact URLs in order, exactly five `*` markers, the sole contribution legend `* Equal technical contribution.`, and all seven full affiliations in numeric order. Assert the obsolete running title, `UBC PhysAI Lab`, abbreviated `UCLA`, old institution ordering, every `#` author marker, and all `Project lead` text are absent from the publication header.
2. Compare the rendered Abstract text and BibTeX block against their pre-edit contents to confirm they were preserved, and verify the PDF href and functional UI labels/attributes did not change.
3. Parse `index.html` with an available local HTML parser/validator and check for balanced/valid author and affiliation markup.
4. Serve the site locally and inspect desktop and mobile widths for title wrapping, 23-author flow, affiliation readability, contribution marks, and unchanged viewer/media controls. Run any existing static-site build/check if the repository provides one; otherwise record that no build system exists.
5. Before and after editing, snapshot the current humanoid-related lines and existing working-tree status. Confirm `git diff -- index.html README.md` adds only scoped content changes on top of the current baseline and that no concurrent humanoid markup/media references, CSS, assets, dependency, or unrelated file was modified or reverted.
