---
name: build-a-feature
description: Explore the codebase, produce a concrete implementation plan, implement the feature, then validate it using multiple subagents.
---

# build-a-feature

Build a feature (or patch, fix) in four explicit phases, using one distinct sub-agent for each phase:

1. **Explore**: GPT 5.4 mini or Sonnet 4.6, whichever's available; if both are available, use 5.4 mini
2. **Plan**: latest full model (GPT or Claude, same as the main agent's configuration), high reasoning
3. **Implement**: GPT 5.4 mini or Sonnet 4.6, whichever's available; if both are available, use 5.4 mini
4. **Validate**: GPT 5.4 mini or Sonnet 4.6, whichever's available; if both are available, use 5.4 mini

Do not skip phases. Do not jump into implementation before exploration and planning are complete.

## Goals

This skill is for feature work that benefits from deliberate structure rather than immediate coding.  
It is especially appropriate when the task involves:
- multiple files or subsystems
- unclear existing architecture
- nontrivial integration points
- risk of regressions
- ambiguous requirements that must be operationalized into a concrete implementation plan

The objective is not merely to "make something work", but to produce an implementation that is well-scoped, grounded in the current codebase, and validated.

---

## Phase 1: Explore

First, the explorer agent the relevant parts of the repository before proposing changes.

### Explore objectives
- Understand the user's requested feature
- Identify the relevant modules, files, entry points, APIs, configs, tests, and execution flow
- Determine how similar features are implemented elsewhere in the codebase
- Identify constraints, invariants, conventions, and likely pitfalls
- Surface ambiguity, missing information, or architectural risks

### Explore guidelines
- Read, no editing
- Trace key control/data flows
- Look for existing abstractions that should be reused instead of duplicated
- Look for tests, fixtures, examples, docs, or comments that clarify intended behavior
- Prefer finding the "natural extension point" over bolting on ad hoc logic
- Leverage information already available in the current thread's context as well as the distilled, branch-wise knowledge base (`.agents/knowledge/`)

### Explore deliverable
Produce a concise exploration summary that includes:
- relevant files/components
- current behavior
- likely insertion points
- dependencies and risks
- user-provided requirements and design choices
- open questions or assumptions

Do **not** implement during this phase unless a tiny exploratory patch is absolutely necessary to understand behavior. If that happens, explicitly say so and ask for user's permission before editing.

---

## Phase 2: Plan

After exploration, the planner agent takes what the explorer agent has discovered and creates a concrete implementation plan.

### Plan objectives
- Translate the feature request into a list of requirements, and bound the scope of each requirement
- Create a sequence of implementation steps based on the requirements
- Identify what will and will not change
- Anticipate validation requirements
- Identify missing library dependencies

### Plan guidelines
The plan must be specific enough that another dummer agent could implement it with minimal reinterpretation.

Include:
- what the feature to be implemented is, requirements, and scope of each requirement
- files to modify
- new files to add, if any
- data structure / API / interface invariants and changes
- behavior invariants and changes
- migration / compatibility considerations
- tests or validation steps
- risks and fallback options
- additional packages to install, if any

Always write the plan into a file located at `.agents/plans/PLAN_<feature_name>.md` so it can serve as the source of truth for later steps.

### Plan requirements
- Prefer incremental changes per step, rather than large sweeping changes in one step
- Preserve existing architecture only when reasonable. If the planner believes the user's intent is to replace existing architecture with a new one, the planner should not add fallback options or backwards compatibility considerations
- Avoid unnecessary refactors unless they are required for correctness or maintainability
- Distinguish required work from optional improvements
- Make assumptions explicit
- Consult with human user on architectural decisions
- Specify exact version of missing Python libraries. Consult latest version on PyPI.

### Plan deliverable
Produce a step-by-step implementation plan before editing code.

Do **not** start implementation until the plan is complete.

---

## Phase 3: Implement

The implementor agent implements exactly according to the plan. First load the plan from `.agents/plans/PLAN_<feature_name>.md`, then follow it faithfully. 

### Implementation objectives
- Execute the planned changes faithfully
- Keep the implementation aligned with existing code style and architecture
- Minimize unrelated edits
- Preserve readability and maintainability

### Implementation guidelines
- Follow the plan rather than improvising continuously
- Reuse existing helpers, patterns, and abstractions when appropriate
- Keep diffs focused
- If the plan proves flawed during implementation, pause and state the deviation clearly before proceeding with a revised plan
- Avoid speculative cleanup unrelated to the feature
- Update docs, config, or tests when needed to keep the feature integrated and understandable

### During implementation
Keep a lightweight running log of:
- what was changed
- any deviations from the original plan
- any newly discovered constraints

---

## Phase 4: Validate

After implementation, the planner agent validates the feature, by comparing the implementation statically against the saved plan. If the planner believes that all requirements it has specified have been implemented, the main agent closes the explorer agent. Otherwise, the main agent instructs the implementor agent to continue implementing the remaining requirements.

Then the main agent spawns a validator agent which compiles, inspects compilation messages, check for compilation failures, reason why compilation fails; instruct the implementor agent to fix the issue, and repeat the loop until compilation succeeds. After that, the validator agent runs the relevant test suite or simulation scene, inspect the output, reason about any failure, instruct the implementor agent to fix the issue, and repeat the loop until the test/scene runs successfully.

### Validation objectives
- Verify the feature works as intended
- Catch regressions or integration issues
- Fix issues revealed by compilation, execution, or tests
- End with a grounded summary of validation status

### Validation instructions
Eeither activate conda environment `droid_sim` for running scripts (if the script involves MuJoCo) or use the environment under `.venv/` (if the script involves Newton). Refer to `readme.md` for CLI arguments to pass to the script; but note that if what's instructed in `readme.md` is inconsistent with the script's content, update `readme.md` according to the script. Ask me if you're unsure about path to files (needed as CLI arguments). Refer to `readme.md` for CLI arguments to pass to the script; but note that if what's instructed in `readme.md` is inconsistent with the script's content, update `readme.md` according to the script. Ask the human user if you're unsure about path to files (needed as CLI arguments).

If the validator agent is not given explicit instruction to debug (or "tune until success"), just conduct a "pilot run" and notify user of the results printed to terminal and artifacts generated; bring up anything that looks like a bug/error. If the agent is explicitly instructed to debug (or "tune until success"), run script, inspect outputs (terminal output and generated artifacts), reason about the expected outputs, the current/actual outputs and the difference; then determine what need to be changed, request the implementor agent to make the necessary changes, and rerun the code. Carry out this run->assess results->fix->run... loop until any identifable issues have been resolved. The loop should break when, after over 5 trials of debugging the expected and final results still have significant differences, indicating that the issue might be too hard for the agent to solve on its own and human intervention is needed. In that case, the agent should clearly summarize the issue, what has been tried, and why it thinks human intervention is needed.


### Validation deliverable
Provide:
- what validation was performed
- what passed
- what failed
- what was fixed during validation
- any remaining limitations, uncertainties, or blockers

---

## Operating rules

### 1. Respect phase boundaries
The default sequence is:

**Explore -> Plan -> Implement -> Validate**

Do not collapse everything into a single undifferentiated coding burst.

### 2. Prefer explicit artifacts
For nontrivial feature work, create and use explicit planning artifacts such as `PLAN.md`.  
Treat the plan as the source of truth during implementation and validation.

### 3. Be honest about uncertainty
If requirements are ambiguous, state your interpretation clearly.  
If you must make assumptions, record them.

### 4. Keep changes scoped
Do not perform broad refactors, renames, or cleanup unless they are necessary for the feature.

### 5. Validation is mandatory
A feature is not complete merely because code was written.  
It must go through compilation, and in some cases execution or tests, to verify it actually works and does not break existing functionality.

---

## Default output structure

When using this skill, structure your work roughly as:

### Exploration summary
- Relevant files / components
- Current behavior
- Constraints / risks
- Assumptions

### Implementation plan
1. ...
2. ...
3. ...

### Implementation progress
- Changed ...
- Added ...
- Adjusted ...

### Validation results
- Ran ...
- Observed ...
- Fixed ...
- Remaining issues ...

---

## Success criteria

This skill succeeds when:
- the codebase was explored before editing
- a concrete implementation plan was produced
- the feature was implemented with scoped, justified changes
- validation was performed;
- the final report clearly states status, evidence, and any remaining issues

All agents, except the explorer agents should remain unclosed upon successful completion of the skill, so that the user can ask follow-up questions about the implementation or validation details.