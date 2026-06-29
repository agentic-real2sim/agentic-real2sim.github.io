---
name: work-toward-a-goal
description: Explore the codebase, translate a high-level user goal into a concrete architect-reviewed and critic-reviewed blueprint, implement the resulting features in order using the build-a-feature skill, and audit each completed feature before moving on. Invoked when both conditions are met (1) the /goal slash command is used and (2) the user explicitly asks for invocation of this skill.
---

# work-toward-a-goal

Work toward a high-level user goal by first translating the user's loose intent into a concrete, reviewable engineering blueprint, then implementing the blueprint feature by feature using the `build-a-feature` skill.

This skill is intended for goals that are too broad, underspecified, or multi-step to implement safely in one pass.

The core loop is:

1. Architect interprets the user's goal and drafts a blueprint.
2. Critic reviews whether the Architect understood the user's intent and whether the blueprint is logically sound.
3. Architect and Critic iterate until the blueprint is well-scoped.
4. Critic is closed.
5. Feature teams implement the blueprint one feature at a time.
6. Architect audits each completed feature before the main agent moves on.

---

## Overview

This skill orchestrates four distinct actors:

| Actor | Role | Active when |
|---|---|---|
| **Architect** | Interprets the user's high-level goal, translates loose intent into concrete requirements, decomposes the work into ordered features, and audits completed features against the final blueprint | Blueprint phase + feature audit rounds only |
| **Critic** | Reviews the Architect's interpretation and blueprint for intent mismatch, underspecified requirements, logical gaps, unsafe assumptions, over-engineering, weak acceptance criteria, and poor feature boundaries | Blueprint review phase only |
| **Feature team** | Explorer, planner, implementor, validator through the `build-a-feature` skill | One feature at a time after the final blueprint is written |
| **Main agent** | Orchestrator: spawns and closes sub-agents, passes context, enforces phase boundaries, invokes skills, and drives the loop | Throughout |

The Architect and Critic may interact only during the blueprint phase.

The Critic is closed permanently once the final blueprint is accepted. The Critic must not participate in feature implementation, validation, or feature audits unless the human user explicitly asks to reopen blueprint-level review.

The Architect must not run concurrently with a feature team during implementation. The Architect is active only during blueprinting and explicit post-validation feature audits.

The final blueprint is the source of truth for implementation.

---

## Phase 1 — Blueprint with Architect–Critic Review

### 1.1 Spawn the Architect

The main agent spawns the Architect sub-agent using:

- **Model**: GPT 5.5 xhigh or Claude Opus 4.7 with the highest reasoning level available, whichever is available.

The Architect's task is not to merely restate the user's request. It must translate the user's high-level, informal, or underspecified goal into a concrete engineering blueprint that can be implemented and validated.

### 1.2 Architect: Interpret user intent

The Architect must first infer the user's actual intent from the goal statement.

The Architect should identify:

- the concrete outcome the user wants;
- the motivation behind the request, if inferable;
- what is explicitly required;
- what is implied but not directly stated;
- what is ambiguous;
- what can safely be left to engineering judgment;
- what should not be done.

The Architect should use its best judgment to resolve ordinary implementation details without bothering the user.

The Architect should ask the user a clarifying question only if the ambiguity affects one of the following:

- the intended product behavior;
- safety or destructive operations;
- major architecture;
- compatibility with existing workflows;
- irreversible or hard-to-revert changes;
- scope boundaries that cannot be inferred from the codebase.

Clarifying questions must be targeted and asked one at a time.

If no clarification is truly needed, the Architect proceeds using clearly stated assumptions.

### 1.3 Architect: Gather codebase context

After interpreting the goal, the Architect gathers enough codebase context to design a realistic feature breakdown.

Context-gathering guidelines:

- Read the branch-specific knowledge file under `.agents/knowledge/` if it exists.
- Identify relevant modules, entry points, APIs, data structures, configs, tests, scripts, and existing conventions.
- Understand how the goal fits into the current architecture.
- Identify integration risks, backward-compatibility constraints, validation constraints, and likely failure modes.
- Reuse relevant `PLAN_*.md`, `BLUEPRINT_*.md`, design notes, or existing reports if they are relevant.
- Prefer adapting the existing architecture over inventing a new one.
- Do not design a large refactor unless the existing architecture cannot support the goal.

### 1.4 Architect: Draft blueprint

The Architect writes a draft blueprint that converts the user's loose goal into well-scoped requirements.

The draft blueprint must include:

```md
# Draft Blueprint: <human-readable goal title>

## Interpreted user intent

<What the Architect believes the user actually wants.>

## Explicit requirements

<Requirements stated directly by the user.>

## Inferred requirements

<Reasonable requirements inferred from the user's goal and codebase context.>

## Assumptions

<Assumptions the Architect is making instead of asking the user.>

## Non-goals

<Things that should not be done, even if they seem related.>

## Context summary

<Key codebase findings: relevant files, architecture, conventions, constraints, and risks.>

## Proposed feature breakdown

### Feature 1: <name>

**Goal**: ...
**Prerequisites**: ...
**Deliverables**: ...
**Acceptance criteria**: ...
**Out of scope**: ...
**Risks**: ...

### Feature 2: <name>

...

## Open questions

<Only questions that truly require human judgment. Leave empty if none.>
```

Each feature must be designed so that:

* it is as self-contained as possible;
* it can be implemented, compiled, and validated independently where practical;
* it has clear prerequisites;
* it has concrete deliverables;
* it has acceptance criteria that a validator can actually check;
* it has explicit out-of-scope boundaries;
* it avoids coupling to future features unless that dependency is unavoidable.

Features must be ordered by dependency.

If integration is nontrivial, the final feature should be a dedicated integration feature that wires together earlier features.

Save the draft blueprint to:

```text
.agents/plans/DRAFT_BLUEPRINT_<name>.md
```

Choose `<name>` as a short, descriptive, slug-friendly identifier for the overall goal.

### 1.5 Spawn the Critic

After the Architect writes the draft blueprint, the main agent spawns the Critic sub-agent using:

* **Model**: GPT 5.5 xhigh or Claude Opus 4.7 with the highest reasoning level available, whichever is available.

The Critic must read:

1. the original user goal;
2. the Architect's draft blueprint;
3. the key codebase context cited by the Architect;
4. any relevant project or branch knowledge files used by the Architect.

The Critic must not implement anything.

The Critic must not propose a completely separate plan unless the Architect's plan is fundamentally wrong.

The Critic's job is to stress-test the Architect's understanding and blueprint.

### 1.6 Critic: Review the draft blueprint

The Critic evaluates the draft blueprint along these dimensions:

#### Intent fidelity

* Did the Architect correctly understand the user's actual goal?
* Did the Architect over-constrain something the user wanted to leave to agent judgment?
* Did the Architect ignore an important phrase, constraint, or implied preference?
* Did the Architect ask for clarification where it should have used reasonable judgment?
* Did the Architect use assumptions that should instead be surfaced to the user?

#### Requirement quality

* Are the requirements concrete enough to implement?
* Are deliverables clearly stated?
* Are acceptance criteria verifiable?
* Are non-goals explicit enough to prevent scope creep?
* Are failure cases and fallback behavior specified where needed?
* Could a validator pass all criteria while the user's actual goal remains unsatisfied?

#### Feature decomposition

* Are features ordered by dependency?
* Is each feature independently implementable and testable where practical?
* Are feature boundaries too large, too small, or poorly coupled?
* Is there a dedicated integration feature if integration is nontrivial?
* Are prerequisites and carry-over effects clearly stated?

#### Architectural fit

* Does the plan respect the current codebase architecture?
* Does it avoid unnecessary refactors?
* Does it reuse existing mechanisms where appropriate?
* Does it identify integration risks?
* Does it avoid inventing abstractions before they are needed?

#### Logical rigor

* Are there contradictions inside the blueprint?
* Are there hidden assumptions?
* Are there missing failure-handling paths?
* Are there unclear ownership boundaries between agents or features?
* Are there vague phrases that would allow the feature team to fake completion?

The Critic writes an inline review in this format:

```md
## Critic Review

**Verdict**: PASS | REVISE

### Intent fidelity issues

...

### Requirement and acceptance-criteria issues

...

### Feature-decomposition issues

...

### Architectural concerns

...

### Logical gaps

...

### Required revisions

1. ...
2. ...
3. ...

### Optional suggestions

...
```

Use `PASS` only if the blueprint is ready to become the implementation source of truth.

Use `REVISE` if any required change is needed before implementation begins.

### 1.7 Architect revision loop

If the Critic verdict is `REVISE`, the main agent passes the Critic's required revisions back to the Architect.

The Architect must revise the draft blueprint and explicitly address each required revision.

For each required revision, the Architect must either:

* incorporate the change; or
* explain why the change is rejected and why the original design is still correct.

The Critic then reviews the revised blueprint again.

Repeat until the Critic verdict is `PASS`.

If the same disagreement between Architect and Critic persists for three review rounds, the main agent must pause and ask the human user for guidance. The main agent should summarize:

* the disputed issue;
* the Architect's position;
* the Critic's position;
* the practical consequence of choosing each side.

Do not let agents resolve persistent value judgments by inventing new user constraints.

### 1.8 Write the final blueprint

Once the Critic verdict is `PASS`, the Architect writes the final blueprint to:

```text
.agents/plans/BLUEPRINT_<name>.md
```

The final blueprint must use this format:

```md
# Blueprint: <human-readable goal title>

## Goal

<One paragraph summary of the user's intent.>

## Interpreted intent

<Concise statement of how the Architect interpreted the user's loose request.>

## Explicit requirements

<Requirements stated directly by the user.>

## Inferred requirements

<Reasonable inferred requirements.>

## Clarifications and assumptions

<Clarifications from the user, if any. Also include important assumptions made by the Architect.>

## Context summary

<Key findings from codebase exploration: relevant files, architecture, conventions, constraints, and risks.>

## Non-goals

<Explicitly excluded work.>

## Features

### Feature 1: <name>

**Goal**: ...
**Prerequisites**: ...
**Deliverables**: ...
**Acceptance criteria**: ...
**Out of scope**: ...
**Risks**: ...

### Feature 2: <name>

...

## Blueprint review record

<Brief summary of Architect–Critic review rounds and major revisions made before finalization.>

## Summary

(Appended by the main agent at the end, after all features are implemented and audited. See Phase 3.)
```

The final blueprint must be concrete enough that feature teams can work from it without rereading the entire Architect–Critic discussion.

### 1.9 Close the Critic

After the final blueprint is written, the main agent permanently closes the Critic sub-agent.

The Critic must not participate in feature implementation, validation, or feature audits unless the human user explicitly asks to reopen blueprint-level review.

### 1.10 Suspend the Architect

After the final blueprint is written and the Critic is closed, the Architect becomes inactive until a feature audit is needed.

The main agent then proceeds to Phase 2.

### Default output after blueprint

After the final blueprint is written, the main agent reports briefly:

```text
Blueprint written: .agents/plans/BLUEPRINT_<name>.md
Features: [list of feature names in order]
Critic: closed after blueprint PASS
```

---

## Phase 2 — Feature Implementation Loop

For each feature in the final blueprint, in the order listed, the main agent executes the following loop.

### Step A — Invoke `build-a-feature`

The main agent invokes the `build-a-feature` skill with:

* the current feature's name;
* the feature goal;
* prerequisites;
* deliverables;
* acceptance criteria;
* out-of-scope notes;
* risks;
* the path to the final blueprint;
* carry-over findings from previously completed features.

The feature team must read the final blueprint before planning.

The feature team must implement only the current feature.

The feature team must not start later features early unless the blueprint explicitly says the current feature must create scaffolding for them.

The `build-a-feature` skill runs its Explore → Plan → Implement → Validate sequence.

The main agent waits until the validator confirms that all acceptance criteria for the current feature pass.

Validator passing is necessary but not sufficient for feature completion.

### Step B — Architect audit

After the validator confirms that the feature passes, the main agent re-activates the Architect only.

The Critic remains closed and must not participate in implementation audits.

The Architect audits the completed feature against the final blueprint.

The Architect must:

1. Read the final blueprint section for the completed feature.
2. Read the implementation plan produced by the feature team, such as `PLAN_<feature_name>.md`, if present.
3. Inspect the actual code changes made by the implementor.
4. Verify that the implementation is consistent with the final blueprint.
5. Confirm that all acceptance criteria are satisfied.
6. Confirm that deliverables match what was promised.
7. Confirm that nothing explicitly marked out of scope was done.
8. Confirm that the implementation does not create architectural conflicts for later features.
9. Confirm that validation evidence is meaningful and not merely superficial.

The Architect produces an inline audit report:

```md
## Architect Audit: <feature_name>

**Verdict**: PASS | FAIL

### Checked blueprint requirements

...

### Validation evidence reviewed

...

### Discrepancies

1. ...

### Architectural concerns

...

### Required fixes

1. ...

### Notes

...
```

For `PASS`, the audit should be brief but must mention the key acceptance criteria checked.

For `FAIL`, the audit must include concrete discrepancies, each tied to the relevant blueprint section or acceptance criterion.

### Step C — Fix loop if audit fails

If the Architect's audit verdict is `FAIL`:

1. The main agent keeps the current feature team active, or re-activates it if it was already closed.
2. The main agent passes the Architect's discrepancy list to the planner, implementor, and validator.
3. The feature team addresses each discrepancy.
4. The validator re-validates the feature.
5. The main agent requests a new Architect audit.
6. Repeat until the Architect's verdict is `PASS`.

If the same discrepancy appears in three consecutive audit reports without resolution, the main agent must pause and ask the human user for guidance.

The escalation summary must include:

* the feature name;
* the repeated discrepancy;
* what the feature team attempted;
* why the Architect still rejects it;
* the decision needed from the user.

### Step D — Close the feature team

After the Architect's audit verdict is `PASS`:

1. The main agent closes the feature team associated with the completed feature.
3. The main agent records the feature as completed.
4. The main agent advances to the next feature in the blueprint.
5. The next feature gets a fresh feature team.

Do not let stale feature-team sub-agents accumulate.

Do not keep the Architect active between feature audits.

### Default output after each feature

After each feature audit passes, the main agent reports:

```text
Feature <n>/<total> — <name>: PASS (Architect audit confirmed)
```

After each failed audit round, the main agent reports:

```text
Feature <n>/<total> — <name>: audit FAIL (round <k>)
Discrepancies: [list]
Requesting fixes from feature team...
```

---

## Phase 3 — Final Summary

After all features have been implemented, validated, and audited, the main agent appends a `## Summary` section to the final blueprint file:

```text
.agents/plans/BLUEPRINT_<name>.md
```

The summary must include:

* **Completion date**: when the loop finished.
* **Features implemented**: table with each feature name, final audit verdict, and notable deviations from the original blueprint.
* **Changes made**: high-level list of files added or modified across all features.
* **Validation method**: what tests, scripts, import checks, manual checks, or validators were used.
* **Validation results**: pass/fail status for each feature's acceptance criteria.
* **Architect audit results**: final audit verdict for each feature.
* **Known limitations**: anything discovered but left unresolved, with rationale.
* **Follow-up recommendations**: optional next steps identified during implementation or audit.
* **Sub-agent cleanup status**: confirmation that Critic and feature teams are closed, while the Architect is inactive but left open for future audits if desired.

After appending the summary, the main agent reports:

```text
All features implemented and audited.
Summary appended to: .agents/plans/BLUEPRINT_<name>.md
```

---

## Operating Rules

### 1. Blueprint before implementation

No code may be written before the final blueprint is produced and accepted through Architect–Critic review.

### 2. Critic is blueprint-only

The Critic participates only in the blueprint phase.

Once the final blueprint is written, the Critic is closed and must not influence implementation, validation, or feature audits unless the human user explicitly asks to reopen blueprint-level review.

### 3. Architect is not a feature implementor

The Architect designs and audits. It does not implement features.

During implementation, the feature team works from the final blueprint.

### 4. Architect and feature team are not concurrently active during implementation

The Architect and feature team must not be active at the same time, except for the main agent passing audit feedback from the Architect to the feature team.

The Architect is activated for audits only after validator confirmation.

### 5. Blueprint is the source of truth

The final blueprint is the implementation source of truth.

If a feature team member identifies a genuine conflict between the blueprint and technical reality, the main agent must surface it during the next audit or escalate to the user if it blocks progress.

The feature team must not silently deviate from the blueprint.

### 6. Features are implemented in order

Do not start a feature until all earlier features are completed, validated, and audited.

The blueprint's feature order must be followed unless the Architect revises the blueprint and the main agent records the reason.

### 7. Audit is mandatory

A feature is not complete until the Architect's audit verdict is `PASS`.

Validator passing is necessary but not sufficient.

### 8. Prefer minimal sufficient changes

Feature teams should prefer small, inspectable, architecture-compatible changes.

Do not perform large refactors unless the blueprint explicitly calls for them.

Do not introduce new frameworks, registries, abstractions, or architectural layers unless required by the blueprint.

### 9. Human escalation

The main agent must pause and ask the human user for guidance if:

* the Architect and Critic disagree on the same blueprint issue for three rounds;
* the same Architect audit discrepancy recurs three times during feature implementation;
* a necessary product decision cannot be inferred from the user's goal or codebase;
* a requested operation is destructive, irreversible, or affects external repositories;
* implementation requires modifying another codebase or rebuilding external binaries without prior permission.

### 10. Keep sub-agent sessions clean

Close the Critic after blueprint approval.

Close feature teams after each audited feature.

No feature team sub-agents should remain active at the end.

The Architect should remain alive throughout the process but inactive during implementation. It should be left open after completion of the entire task, for future audits if desired.

---

## Default Output Structure

### After final blueprint

```text
Blueprint written: .agents/plans/BLUEPRINT_<name>.md
Features: [list of feature names in order]
Critic: closed after blueprint PASS
```

### After each feature's audit PASS

```text
Feature <n>/<total> — <name>: PASS (Architect audit confirmed)
```

### After each feature's audit FAIL round

```text
Feature <n>/<total> — <name>: audit FAIL (round <k>)
Discrepancies: [list]
Requesting fixes from feature team...
```

### After all features complete

```text
All features implemented and audited.
Summary appended to: .agents/plans/BLUEPRINT_<name>.md
```

---

## Success Criteria

This skill succeeds when:

* The user's intent was interpreted before any code was written.
* The Architect produced a draft blueprint.
* The Critic reviewed the draft blueprint for intent fidelity, requirement quality, feature decomposition, architectural fit, and logical rigor.
* Architect–Critic review reached `PASS`, or unresolved disagreement was escalated to the human user.
* A final blueprint was written to `.agents/plans/BLUEPRINT_<name>.md`.
* The Critic was closed after blueprint approval.
* Every feature in the final blueprint was implemented using the `build-a-feature` skill.
* Every feature passed validator checks.
* Every feature passed Architect audit before the main agent moved to the next feature.
* The blueprint's `## Summary` section was completed and accurately reflects what was done.
* No Critic, or feature team sub-agent remains active at the end. The Architect is inactive at the end but should be left open for future audits if desired.
