# Nova — Workflow Engine Design

> **Scope:** Design only. The Workflow Engine turns the Creative Director's
> *direction* into *production-ready workflows*. This is **not** a task scheduler
> (no cron, no queue, no job orchestration). It is a goal-driven, memory-aware
> composition engine that plans Missions, executes, validates, gates, and learns.

---

## 1. Core Concepts

| Term | Definition |
|------|------------|
| **Goal** | A declarative intent supplied by the user (e.g. "add a minimap", "stop the memory leak in level loader"). |
| **Workflow** | A named, reusable recipe: a sequence of **stages** that transform a goal into a verified result. |
| **Stage** | A single unit of work inside a workflow (plan, research, implement, validate, …). |
| **Memory** | The agent's persistent knowledge store (codebase facts, decisions, past runs, asset registry, conventions). |
| **Plugin** | An external capability (VCS, build system, asset pipeline, LLM provider, static analysis, CI). |
| **Model** | A specific LLM/role selected per stage for capability and cost fit. |
| **Approval Gate** | A human-or-policy checkpoint that must pass before a stage (or the whole workflow) proceeds. |
| **Rollback** | A deterministic undo path that returns the environment to a known-good state. |
| **Workflow Call** | A workflow invoking another workflow as a stage (composability primitive). |

### Engine Contract

```
Goal
  → Resolve Workflow (by intent + memory match)
  → Plan (stages, memory reads, plugin/model assignment)
  → Pre-flight Validation (memory + plugins + models available?)
  → Execute Stages (each: read memory → call plugin/model → write artifacts → update memory)
  → Stage Validation (per stage)
  → Approval Gates (at configured boundaries)
  → Workflow Validation (end-to-end)
  → Memory Update (lessons, decisions, new artifacts)
  → Rollback Hook (if any stage fails a gate)
```

---

## 2. Workflow Catalog

Each workflow below follows the same 10-section template.

> **Shared assumption:** every workflow reads `memory.codebase`, `memory.conventions`, and `memory.decisions` at planning time, and writes a `memory.run` record on completion. These are omitted per workflow for brevity but always apply.

---

### 2.1 Create Feature

- **Goal:** Implement a new, user-requested capability end-to-end and merge it safely.
- **Planning:**
  1. Decompose goal into sub-requirements.
  2. Locate insertion points via codebase memory.
  3. Identify affected systems, data models, and UI surfaces.
  4. Produce an implementation plan with milestones.
- **Required Memory:** `codebase`, `conventions`, `decisions`, `roadmap`, `asset_registry`.
- **Required Plugins:** VCS (branch/create/PR), Build, Static Analysis, Test Runner, Code Search.
- **Required Models:** *Planner* (reasoning), *Coder* (implementation), *Reviewer* (self-review).
- **Execution:**
  1. Create feature branch.
  2. Scaffold modules following conventions.
  3. Implement logic, tests, and docs in parallel stages.
  4. Run build + unit/integration tests.
- **Validation:** Build green, tests pass, lint clean, coverage delta ≥ threshold, no convention violations.
- **Approval Gates:** (a) plan sign-off before coding; (b) PR review before merge.
- **Rollback:** Delete branch, revert merge commit, drop any new asset registry entries.
- **Memory Update:** Record new modules, API surface, decisions, and test gaps discovered.

---

### 2.2 Fix Bug

- **Goal:** Reproduce, root-cause, and eliminate a defect with a regression test.
- **Planning:**
  1. Reproduce from report/symptoms.
  2. Trace execution path via call-graph memory.
  3. Hypothesize root cause; rank by likelihood.
- **Required Memory:** `codebase`, `bug_history`, `decisions`, `codebase_metrics`.
- **Required Plugins:** Debugger, Test Runner, Profiler (optional), VCS, Static Analysis.
- **Required Models:** *Investigator* (root-cause), *Coder* (fix), *Reviewer*.
- **Execution:**
  1. Write a failing reproduction test.
  2. Apply minimal fix.
  3. Confirm test goes green; run full suite.
- **Validation:** Reproduction test passes, no new failures, root cause documented.
- **Approval Gates:** (a) root-cause confirmation before fix (for high-severity bugs).
- **Rollback:** Revert fix commit; keep reproduction test disabled or removed if fix abandoned.
- **Memory Update:** Add to `bug_history` (symptom→cause→fix), update `codebase_metrics`.

---

### 2.3 Refactor

- **Goal:** Improve structure/readability/maintainability without changing external behavior.
- **Planning:**
  1. Identify refactor target and motivation (smell, coupling, duplication).
  2. Map behavioral contracts that must be preserved.
  3. Define safe incremental steps.
- **Required Memory:** `codebase`, `conventions`, `decisions`, `test_coverage`.
- **Required Plugins:** VCS, Test Runner, Static Analysis, Code Search, Diff Viewer.
- **Required Models:** *Architect* (structure), *Coder*, *Reviewer*.
- **Execution:**
  1. Lock behavior with characterization tests.
  2. Apply refactor steps one at a time.
  3. Re-run tests after each step.
- **Validation:** Behavioral equivalence (tests unchanged pass), no coverage drop, lint clean.
- **Approval Gates:** (a) plan sign-off; (b) final diff review.
- **Rollback:** `git revert` each step commit; restore prior module boundaries.
- **Memory Update:** Note new structure, removed smells, convention refinements.

---

### 2.4 Optimize Performance

- **Goal:** Reduce latency, memory, or frame-time against a measured baseline.
- **Planning:**
  1. Establish baseline metrics (frame time, allocs, load time).
  2. Profile to find bottlenecks.
  3. Propose optimizations ranked by impact/risk.
- **Required Memory:** `codebase`, `codebase_metrics`, `decisions`, `profiles`.
- **Required Plugins:** Profiler, Benchmark Harness, Build, Test Runner, VCS.
- **Required Models:** *Performance Analyst*, *Coder*, *Reviewer*.
- **Execution:**
  1. Capture baseline profile (stored in memory).
  2. Apply optimization.
  3. Re-profile and compare; reject if no improvement or regression.
- **Validation:** ≥ target improvement, no correctness regression, memory within budget.
- **Approval Gates:** (a) baseline + plan approval; (b) results review before merge.
- **Rollback:** Revert commit; restore profile baseline record.
- **Memory Update:** Store `profiles` before/after, record winning techniques.

---

### 2.5 Generate Assets

- **Goal:** Produce game-ready assets (sprites, models, audio, VFX) from a spec.
- **Planning:**
  1. Parse asset spec (type, style, dimensions, format, poly budget).
  2. Check `asset_registry` for naming/collisions.
  3. Select generation approach (procedural vs model-assisted).
- **Required Memory:** `asset_registry`, `conventions` (art style guide), `decisions`.
- **Required Plugins:** Asset Generator, Format Converter, Preview Renderer, VCS.
- **Required Models:** *Creative* (concept), *Asset Specialist* (generation), *Reviewer* (QA).
- **Execution:**
  1. Generate raw asset.
  2. Convert/optimize to engine format.
  3. Render preview for review.
- **Validation:** Meets format/size/poly constraints; preview approved; no license conflict.
- **Approval Gates:** (a) concept approval; (b) final asset approval.
- **Rollback:** Remove asset files and registry entry; restore prior registry state.
- **Memory Update:** Register asset (hash, path, metadata, dependencies).

---

### 2.6 Import Assets

- **Goal:** Safely bring external/third-party assets into the project with correct wiring.
- **Planning:**
  1. Verify source license and format compatibility.
  2. Map to engine import settings.
  3. Identify dependent systems (materials, prefabs, scenes).
- **Required Memory:** `asset_registry`, `conventions`, `license_records`, `codebase`.
- **Required Plugins:** Asset Importer, License Checker, VCS, Build.
- **Required Models:** *Asset Specialist*, *Reviewer*.
- **Execution:**
  1. Validate license + format.
  2. Import with standardized settings.
  3. Wire references; rebuild dependent bundles.
- **Validation:** Imports cleanly, references resolve, no missing dependencies, license logged.
- **Approval Gates:** (a) license clearance before import.
- **Rollback:** Remove imported files + references; revert project settings.
- **Memory Update:** Add to `asset_registry` and `license_records`.

---

### 2.7 Review Pull Request

- **Goal:** Provide a thorough, convention-aware review of a PR.
- **Planning:**
  1. Fetch diff + linked issue/goal.
  2. Load relevant `codebase` and `conventions`.
  3. Build a review checklist from diff scope.
- **Required Memory:** `codebase`, `conventions`, `decisions`, `bug_history`.
- **Required Plugins:** VCS (diff/PR), Static Analysis, Test Runner, CI Bridge.
- **Required Models:** *Reviewer* (primary), *Security Analyst* (if diff touches auth/net), *Coder* (for suggested fixes).
- **Execution:**
  1. Analyze diff for bugs, smells, convention breaks.
  2. Run CI + tests via plugin.
  3. Post structured review (blocking vs non-blocking).
- **Validation:** All blocking comments resolved or acknowledged; CI green.
- **Approval Gates:** (a) human maintainer final approval (engine recommends, human decides).
- **Rollback:** N/A (read-only advisory); if auto-fix offered, follows Fix Bug rollback.
- **Memory Update:** Record recurring issues, new conventions discovered.

---

### 2.8 Documentation

- **Goal:** Produce or update accurate docs that match the actual code.
- **Planning:**
  1. Identify doc targets (API, tutorials, architecture).
  2. Cross-check existing docs vs `codebase`.
  3. Outline missing/changed sections.
- **Required Memory:** `codebase`, `conventions`, `decisions`, `roadmap`.
- **Required Plugins:** Doc Generator, VCS, Link Checker, Build (doc site).
- **Required Models:** *Technical Writer*, *Reviewer*.
- **Execution:**
  1. Extract symbols/examples from code.
  2. Draft/update docs.
  3. Build doc site; verify links/rendering.
- **Validation:** Builds without errors, links valid, examples compile/run.
- **Approval Gates:** (a) content review before publish.
- **Rollback:** Revert doc commits; unpublish pages.
- **Memory Update:** Record doc locations and freshness metadata.

---

### 2.9 Testing

- **Goal:** Increase confidence via new or expanded test coverage.
- **Planning:**
  1. Identify untested modules from `test_coverage`.
  2. Choose test types (unit/integration/E2E/perf).
  3. Define coverage targets.
- **Required Memory:** `codebase`, `test_coverage`, `conventions`, `bug_history`.
- **Required Plugins:** Test Runner, Coverage Tool, Fuzz/Property Harness, VCS.
- **Required Models:** *Test Designer*, *Coder*, *Reviewer*.
- **Execution:**
  1. Generate tests for target modules.
  2. Run suite; measure coverage delta.
  3. Triage flaky/failing tests.
- **Validation:** Target coverage met, no flaky tests, all green.
- **Approval Gates:** (a) test plan approval for large suites.
- **Rollback:** Remove added tests; restore coverage baseline.
- **Memory Update:** Update `test_coverage`, note fragile areas.

---

### 2.10 Build Release

- **Goal:** Produce a shippable, versioned build with release notes.
- **Planning:**
  1. Determine version + changelog from merged goals.
  2. Select target platforms.
  3. Define acceptance criteria.
- **Required Memory:** `codebase`, `decisions`, `roadmap`, `asset_registry`, `bug_history`.
- **Required Plugins:** Build System, Signing, Packaging, CI, VCS (tag), Store/Distributor.
- **Required Models:** *Release Engineer*, *Reviewer*.
- **Execution:**
  1. Cut release branch; bump version.
  2. Build all platforms; sign artifacts.
  3. Generate release notes; run smoke tests.
- **Validation:** All platform builds succeed, smoke tests pass, artifacts signed, notes accurate.
- **Approval Gates:** (a) release candidate review; (b) go/no-go before publish.
- **Rollback:** Untag; pull artifacts; revert version bump; hotfix or re-cut.
- **Memory Update:** Record release version, known issues, post-mortem.

---

### 2.11 Research

- **Goal:** Answer an open question or evaluate an approach before committing code.
- **Planning:**
  1. Frame the question and success criteria.
  2. Select sources (web, codebase, papers, prior `decisions`).
  3. Define a synthesis structure.
- **Required Memory:** `decisions`, `codebase`, `roadmap`, `profiles` (prior research).
- **Required Plugins:** Web Search/Fetch, Code Search, Doc Reader, Note Store.
- **Required Models:** *Researcher*, *Analyst* (synthesis), *Reviewer*.
- **Execution:**
  1. Gather evidence from sources.
  2. Compare options with trade-offs.
  3. Produce recommendation + confidence.
- **Validation:** Claims sourced, alternatives considered, recommendation actionable.
- **Approval Gates:** (a) recommendation review before any downstream action.
- **Rollback:** N/A (no code changes); mark research superseded.
- **Memory Update:** Store findings in `decisions`/research notes for future reuse.

---

### 2.12 Architecture Design

- **Goal:** Propose or revise system architecture for a capability or constraint.
- **Planning:**
  1. Capture requirements, constraints, NFRs (perf, scale, mod-ability).
  2. Review existing architecture from `codebase`/`decisions`.
  3. Generate candidate designs + trade-off matrix.
- **Required Memory:** `codebase`, `decisions`, `conventions`, `roadmap`, `codebase_metrics`.
- **Required Plugins:** Diagram Tool, Code Search, Doc Generator, VCS (ADR).
- **Required Models:** *Architect* (primary), *Performance Analyst*, *Reviewer*.
- **Execution:**
  1. Draft design + diagrams + ADR.
  2. Validate against constraints (simulate/estimate).
  3. Produce migration path if revising existing system.
- **Validation:** Meets NFRs, no hidden coupling, ADR reviewed, rollback path defined.
- **Approval Gates:** (a) design sign-off before implementation; (b) ADR approval.
- **Rollback:** Revert ADR; archive design as rejected with rationale.
- **Memory Update:** Record ADR, decision rationale, rejected alternatives.

---

## 3. Workflow Composition

### 3.1 Calling Other Workflows

A workflow can invoke another as a **stage** via a `call` primitive:

```
stage "Generate sprites":
  call workflow Generate Assets
    with:
      spec: minimap_icons
      gate: concept_approval

stage "Wire sprites":
  call workflow Import Assets
    with:
      source: <output of previous call>
```

Rules:
- The **calling workflow owns the gate**; child gates still apply unless explicitly delegated.
- Child **outputs are passed by reference** (artifact IDs, memory keys) to the parent.
- If a child **fails a gate or validation**, control returns to the parent's error handler (rollback or retry).
- A called workflow runs in an **isolated memory scope** but can read shared memory; it writes its own `memory.run` entry.

### 3.2 Nested Workflows

Nesting = a called workflow itself calls another. Example chain:

```
Create Feature
  └─ Generate Assets          (child)
       └─ Research            (grandchild: pick art approach)
```

Properties:
- **Depth limit:** engine enforces `max_nesting_depth` (default 5) to prevent runaway recursion.
- **Scoped rollback tree:** rollbacks unwind bottom-up; a failed grandchild triggers its parent's rollback, then the root's.
- **Gate propagation:** approval gates bubble per level; the human sees a consolidated gate stack, not N separate prompts.
- **Memory isolation:** each level gets a child scope; writes merge upward only on success.
- **Model context:** parent context is summarized and injected into the child (no full-context blowup).

### 3.3 Reusable Workflows

Reusability is achieved by **parameterization + registry**:

- **Parameters:** every workflow declares typed inputs (`spec`, `target`, `threshold`) with defaults and constraints, so the same workflow serves many goals.
- **Workflow Registry:** workflows are stored as versioned definitions (YAML/JSON) in a registry, not hardcoded. New workflows are registered, not patched into the engine.
- **Library workflows:** common sub-sequences (e.g. `Run Test Suite`, `Create Branch`, `Capture Profile`) are registered as *reusable building blocks* and composed into larger workflows.
- **Overrides:** a parent can override a child's `model`, `plugins`, or `gate` settings without forking the definition.
- **Versioning & deprecation:** workflows carry semantic versions; breaking changes create a new version; old callers pin until migrated.
- **Discovery:** the engine matches a user goal to the best workflow using `intent` tags + memory, and can suggest composing multiple workflows.

---

## 4. Cross-Cutting Design Notes

- **Memory is the spine:** planning, validation, and reuse all depend on memory being fresh. Every workflow updates memory on success *and* on instructive failure.
- **Models are per-stage, not per-workflow:** cost/latency are controlled by assigning the cheapest sufficient model to each stage.
- **Approval gates are declarative:** defined in the workflow definition, not in code, so policy changes don't require engine edits.
- **Rollback is first-class:** each stage declares its undo; the engine composes them into a transaction-like tree.
- **No scheduling:** the engine runs a workflow to completion (or gate) on demand. Long-running coordination is out of scope.
