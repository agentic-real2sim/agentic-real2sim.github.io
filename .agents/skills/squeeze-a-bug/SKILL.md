---
name: squeeze-a-bug
description: Spawn a hypothesizer to form root-cause hypotheses and evaluate whether evidence supports them, driving a feature-team implement → hypothesizer-evaluate loop until the bug is confirmed fixed. Invoked under the /goal slash command when the user asks to solve a difficult bug.
---

# squeeze-a-bug

Systematically debug a hard-to-reproduce or hard-to-diagnose bug by iterating through hypotheses. A **Hypothesizer** generates root-cause theories, defines a single feature encapsulating all fixes and instrumentation needed to test each theory, and evaluates whether the runtime evidence supports or refutes each hypothesis. A **Feature team** (via `build-a-feature`) implements the feature. The **Main agent** orchestrates both actors, never implements code itself, and maintains a permanent written record.

---

## Overview

| Actor | Model | Role | Active when |
|---|---|---|---|
| **Hypothesizer** | GPT 5.5 xhigh or Claude Opus 4.7 with highest level of reasoning possible, whichever is available | Proposes root-cause hypothesis; defines confirmation checklist; defines a single feature to test it; evaluates runtime evidence; refines or replaces hypothesis based on evidence | Hypothesis rounds and evidence-evaluation rounds |
| **Feature team** | (via `build-a-feature` skill) | Implements the feature specified by the Hypothesizer for the current hypothesis | One feature per hypothesis round |
| **Main agent** | — | Orchestrates actors, passes context, drives the loop, writes the report | Throughout |

---

## Phase 0 — Context gathering

Before spawning any sub-agent, the Main agent collects and consolidates the following from the user and the codebase:

- **Bug description**: what the observed misbehavior is, and what the expected behavior is.
- **Reproduction steps**: minimal steps or script invocation that triggers the bug.
- **Relevant error output**: stack traces, assertion failures, log lines, rendered artifacts.
- **Suspected scope**: files, modules, or subsystems the user believes are involved (if any).
- **Prior attempts**: any fixes already tried and why they did not resolve the issue.
- **Branch knowledge**: read `.agents/knowledge/<branch>.md` if it exists.

If any of the above are missing and cannot be inferred from the codebase, ask the user before proceeding.

Consolidate all context into an in-thread **Context block** that will be passed verbatim to the Hypothesizer in every round.

---

## Phase 1 — First hypothesis (H0)

### 1.1 Spawn the Hypothesizer

The Main agent spawns the Hypothesizer sub-agent with:
- **Model**: GPT 5.5 xhigh or Claude Opus 4.7 with highest level of reasoning possible, whichever is available
- **Input**: full Context block from Phase 0.

### 1.2 Hypothesizer: propose H0

The Hypothesizer must produce:

1. **Hypothesis statement** (H0): a precise, falsifiable claim about the root cause of the bug. It must name specific code locations, data flows, timing conditions, or invariants that are believed to be broken.
2. **Rationale**: why this hypothesis is consistent with the observed symptoms.
3. **Confirmation checklist**: a set of necessary and sufficient conditions that, when all satisfied, would constitute confirmation that H0 is true and the bug is resolved. Each condition must be:
   - Observable (tied to runtime output, a test result, a log line, or a code property)
   - Unambiguous (clear pass/fail)
   - Specific to H0, not generic
4. **Feature**: a single, self-contained unit of work that applies all fixes and instrumentation needed to test the hypothesis. It must include:
   - **Name**: short slug (e.g., `add-null-check-in-loader`)
   - **Goal**: one or two sentences on what the feature must accomplish to probe the hypothesis
   - **Acceptance criteria**: verifiable conditions confirming the feature is in place
   - **Expected observable effect**: what change in runtime behavior or output confirms the feature contributed to testing the hypothesis

The feature must be minimal — only what is necessary to test H0, not a general improvement.

### 1.3 Suspend the Hypothesizer

After H0, the confirmation checklist, and the feature are produced and the Main agent has recorded them (see Phase 5), the Hypothesizer is suspended BUT NOT CLOSED. It must not influence the feature team's work.

---

## Phase 2 — Feature implementation

### 2.1 Invoke `build-a-feature`

The Main agent invokes the `build-a-feature` skill for the Hypothesizer's feature, passing:
- The feature's name, goal, acceptance criteria, and expected observable effect.
- The full Context block.
- The current hypothesis (H_n) for broader context.
- The path to the current bug report file (`.agents/reports/BUG_FIX_<name>.md`) so the feature team can read prior history.

The `build-a-feature` skill runs its Explore → Plan → Implement → Validate sequence. The Main agent waits until the validator sub-agent confirms the feature's acceptance criteria pass.

---

## Phase 3 — Hypothesis evaluation

### 3.1 Run the bug reproduction scenario

Once the feature is implemented, the Main agent instructs the feature team's **validator** to run the reproduction steps from Phase 0 against the current implementation. The validator reports:
- Full terminal output and any generated artifacts.
- Whether the originally reported misbehavior still occurs.
- Any new or changed behavior.

### 3.2 Hypothesizer: evaluate evidence

The Main agent re-activates the Hypothesizer to evaluate the evidence against each condition in the Confirmation checklist and produces a **Hypothesis verdict** with one of three outcomes:

#### Outcome 1 — CONFIRMED
All conditions in the Confirmation checklist are satisfied. The bug is resolved. The Hypothesizer writes a brief summary explaining the evidence.

#### Outcome 2 — PARTIAL
Some conditions are satisfied but others are not, or the behavior has changed but new evidence suggests the hypothesis needs refinement. The Hypothesizer must:
- List which conditions passed and which failed.
- Describe what the evidence suggests about the true root cause that H_n did not fully capture.
- Propose specific amendments or extensions to the hypothesis.

#### Outcome 3 — REFUTED
The evidence does not support H_n. The bug persists or the changes made no meaningful difference. The Hypothesizer must:
- Explain why H_n is ruled out.
- Describe what the evidence points to instead (alternative candidate causes, modules, or flows).

---

## Phase 4 — Hypothesis iteration (outcomes 2 or 3)

### 4.1 Close the current feature team

The Main agent closes (terminates) all sub-agents associated with the current feature team, EXCEPT the Hypothesizer. Each new hypothesis created by the hypothesizer gets a fresh feature team.

### 4.2 Re-activate the Hypothesizer

If the previous hypothesis is not fully validated, i.e. the bug can't be fully solved by the hypothesis, the Hypothesizer must produce an updated hypothesis H_{n+1}:
- For **PARTIAL**: a refined hypothesis that preserves what was confirmed and corrects what was wrong. The Hypothesizer must explicitly state what changed from H_n and why.
- For **REFUTED**: a completely new hypothesis different from previous hypotheses (but can be an augmentation of earlier hypotheses, if the Hypothesizer deems fit). The Hypothesizer must explain why the new candidate is more consistent with the accumulated evidence than H_n was.

In both cases, the Hypothesizer produces a new confirmation checklist and feature for H_{n+1}, following the same format as Phase 1.2.

### 4.3 Loop back to Phase 2

The Main agent invokes a fresh `build-a-feature` run for H_{n+1}'s feature, then repeats Phases 2 → 3 → 4 as needed.

There is no hard iteration limit, but if three consecutive hypotheses are refuted without progress, the Main agent must pause the loop and ask the human user for guidance (e.g., new reproduction steps, access to additional logs, permission to instrument the code more aggressively).

---

## Phase 5 — Report (maintained throughout)

The Main agent maintains a permanent bug-fix report at:

```
.agents/reports/BUG_FIX_<name>.md
```

Choose `<name>` as a short, descriptive, slug-friendly identifier for the bug (e.g., `mesh-loader-null-crash`). Create the file at the start of Phase 1 and **update it after every hypothesis round**.

### Report format

```md
# Bug Fix Report: <human-readable bug title>

## Bug description

<Exact bug description, reproduction steps, and error output as collected in Phase 0.>

---

## Hypothesis H0

**Statement**: <Hypothesizer's root-cause claim>

**Rationale**: <Why H0 is consistent with the observed symptoms>

**Confirmation checklist**:
- [ ] <condition 1>
- [ ] <condition 2>
- ...

**Feature**: `<feature-name>` — <goal> — Acceptance criteria: <criteria>

**Runtime result summary**: <what the validator observed when running the reproduction scenario>

**Hypothesis verdict**: CONFIRMED / PARTIAL / REFUTED

**Hypothesizer reasoning**: <full evaluation feedback>

---

## Hypothesis H1  *(if applicable)*

... (same structure as H0)

---

## Executive summary

*(Appended by the Main agent after a CONFIRMED verdict.)*

- **Bug confirmed fixed by**: H_n
- **Root cause**: <one paragraph>
- **Fix implemented**: <files changed, what was done>
- **Evidence**: <which confirmation conditions were satisfied and how>
- **Total hypotheses tested**: N
- **Remaining uncertainties**: <anything not fully explained>
```

---

## Operating rules

### 1. The Main agent does not implement code
The Main agent's sole implementation-related action is invoking the `build-a-feature` skill. It must not directly edit files.

### 2. Every hypothesis is recorded before any implementation begins
The Main agent must write H_n and its confirmation checklist to the report file before the feature team starts any work for that hypothesis round.

### 3. Hypothesizer evidence evaluation uses actual runtime results
The Hypothesizer must not speculate about runtime behavior when evaluating evidence. It evaluates only what the validator actually reported in Phase 3.1. Speculation must be labeled clearly as such.

### 4. Human escalation
Escalate to the human user when:
- A required piece of context (e.g., reproduction script, log file path, test name) is missing and cannot be inferred.
- Three consecutive hypotheses are refuted with no clear progress.
- The Hypothesizer cannot determine a verdict from the available evidence alone, after at least eight hypotheses have been tested.

### 5. Keep sub-agent sessions clean
Close feature team sub-agents after each hypothesis round. Do not let stale sub-agents accumulate. Each new hypothesis gets a fresh feature team. The Hypothesizer stays alive across rounds but is suspended when not actively evaluating or propsing new hypothesis.

---

## Default output structure

At each stage, the Main agent reports briefly to the user:

### After H_n is established
```
Hypothesis H<n> recorded.
Root cause claim: <one-line summary>
Feature to implement: <feature-name>
Report: .agents/reports/BUG_FIX_<name>.md
```

### After feature implementation
```
Feature <name>: implemented (validator confirmed acceptance criteria)
```

### After Hypothesizer evaluates evidence
```
Hypothesis H<n> verdict: CONFIRMED / PARTIAL / REFUTED
Reason: <one-line summary>
```

### After CONFIRMED verdict
```
Bug confirmed fixed under H<n>.
Executive summary appended to: .agents/reports/BUG_FIX_<name>.md
```

---

## Success criteria

This skill succeeds when:
- The bug description and reproduction steps were collected before any hypothesis was formed.
- Every hypothesis was written to the report file before implementation began.
- Every feature was implemented via `build-a-feature`.
- The Hypothesizer evaluated actual runtime evidence (not speculation) for each hypothesis.
- The loop terminated with a CONFIRMED verdict supported by all conditions in the Confirmation checklist.
- The report file is complete, accurate, and includes the executive summary.
- No sub-agent sessions remain active at the end.
