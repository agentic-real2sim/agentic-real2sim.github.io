# Update Agentic Real2Sim BibTeX Metadata

## Objective

Replace the inherited Nerfies BibTeX placeholder with an accurate website citation for **Agentic Real2Sim**. The project has not been submitted to a conference or arXiv, so the citation must not claim a venue, journal, preprint identifier, DOI, or publication status.

## Scope and Sources

- Modify only the BibTeX text inside the existing `#BibTeX` section of `index.html`.
- Authoritative manuscript metadata comes from `/home/eric/research/droid_sim/docs/ar2s_arxiv_report/main.tex`:
  - title: `Agentic Real2Sim: Physics-based World Modeling with Vision-Language Agents`;
  - date: June 2026;
  - the 23 authors and their order listed below.
- Use `@misc` because the project website is currently the sole public reference.
- Use citation key `chen2026agenticreal2sim`, based on the first author, year, and project name.
- Use `https://ericchen321.github.io/agentic_real2sim.github.io/` as the project URL. The repository contains no CNAME, canonical URL, or historical project URL; this address is derived from the configured origin `git@github.com:ericchen321/agentic_real2sim.github.io.git` using the standard GitHub Pages project-site convention.
- Preserve the existing BibTeX section heading/container and every other part of `index.html`.
- Do not modify CSS, JavaScript, media, README, plans from earlier work, or unrelated/untracked files.
- No packages are required. Do not commit or push.

## Exact Desired BibTeX

```bibtex
@misc{chen2026agenticreal2sim,
  author       = {Guanxiong Chen and Qianjun Xia and Jiawei Peng and Heng Zhang and Bole Ma and Justin Qian and Ziyi Jiao and Bingyang Zhou and Luoxin Ye and Kaifeng Zhang and Kunyi Wang and Weijia Zeng and Yunuo Chen and Pengzhi Yang and Ziqiu Zeng and Huamin Wang and Chao Liu and Alan Yuille and Fan Shi and Changxi Zheng and Yunzhu Li and Chenfanfu Jiang and Peter Yichen Chen},
  title        = {{Agentic Real2Sim}: Physics-based World Modeling with Vision-Language Agents},
  year         = {2026},
  month        = jun,
  howpublished = {Project website},
  url          = {https://ericchen321.github.io/agentic_real2sim.github.io/}
}
```

The braces around `Agentic Real2Sim` preserve the project name's capitalization in BibTeX styles. Do not add `journal`, `booktitle`, `eprint`, `archivePrefix`, `doi`, or a submission note.

## Implementation Plan

1. In `index.html`, locate the existing `<pre><code>` entry under `<section class="section" id="BibTeX">`.
2. Replace only the old `@article{park2021nerfies, ...}` text with the exact `@misc` entry above.
3. Inspect the focused diff to confirm there are no changes outside that code block and that prior uncommitted website work remains intact.

## Minimal Validation

1. Statically assert that `park2021nerfies`, the Nerfies title, and `journal = {ICCV}` are absent from the BibTeX block.
2. Extract the updated BibTeX block and verify the exact title, June 2026 fields, project URL, all 23 authors in manuscript order, and the absence of venue/arXiv/DOI fields.
3. Confirm the entry has balanced braces and exactly one citation record; no BibTeX parser dependency is needed.
4. Request `http://localhost:61499/` with `curl` and confirm the served BibTeX block contains `chen2026agenticreal2sim` and the project URL.
5. Check the focused `index.html` diff and `git status --short`; do not run broader browser/media tests, commit, or push.
