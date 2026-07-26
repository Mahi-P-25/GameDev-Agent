# Nova — Specialist Role System

> **Scope:** Design only. Instead of a single monolithic AI, Nova is staffed by
> **multiple specialist Roles** that share one **unified memory**. Roles are
> activated per workflow stage; they collaborate, hand off work, and resolve
> conflicts through defined protocols. A Role is a stable *responsibility*, not an
> AI model — models are interchangeable compute behind the Role. No implementation.

---

## 1. Shared Foundations

### 1.1 Unified Memory
All Roles read from and write to the **same memory store** (codebase facts, decisions, conventions, asset registry, run history, metrics). Memory is the single source of truth that lets specialists stay consistent without direct coupling.

### 1.2 Role Contract
A Role is a responsibility boundary, defined by: **Mission, Responsibilities, Knowledge, Decision Authority, Tools, Plugins, Interactions, Activation, Hand-off, Conflict Resolution.** The model that powers a Role is selected by the Router from a *capability* requirement and can change without altering the Role's mandate.

### 1.3 Activation Model
- Roles are **activated by the Workflow Engine** per stage, not globally.
- Only the **minimum set** of roles needed for a stage is active (cost/latency control).
- A role may **request** another role's activation when it detects out-of-scope work.

### 1.4 Authority Tiers
| Tier | Meaning |
|------|---------|
| **Advisory** | Recommends; human or higher tier decides. |
| **Operational** | Acts within its domain autonomously. |
| **Gating** | Can block progress (e.g. Reviewer, PM). |

---

## 2. Role Catalog

### 2.1 Architect
- **Mission:** Define and safeguard system structure, boundaries, and technical direction.
- **Responsibilities:** Design modules/services, define interfaces and NFRs, write ADRs, evaluate trade-offs, prevent coupling/rot.
- **Knowledge:** System topology, design patterns, NFR budgets, dependency graphs, past ADRs.
- **Decision Authority:** **Gating** on architecture/design sign-off; can reject implementations that violate boundaries.
- **Tools:** Diagram generator, code search, dependency analyzer, estimation/simulation.
- **Plugins:** Code Search, Diagram Tool, Doc Generator, VCS (ADR commits).
- **Interaction:** Feeds designs to **Builder**; consults **Researcher** for options; defers perf budgets to **Optimizer**; signs off via **Reviewer**.
- **Activated when:** New feature/scaffold, refactor, NFR change, or architecture-design workflow.
- **Hands off to:** **Builder** (implement), **Optimizer** (perf constraints), **Researcher** (unknown approach).
- **Conflict resolution:** Architecture vs implementation friction → Architect's boundary call wins for structure; performance exceptions require joint Architect+Optimizer sign-off.

### 2.2 Builder
- **Mission:** Implement features, fixes, and refactors to spec and convention.
- **Responsibilities:** Write/modify code, scaffold modules, wire systems, follow conventions, keep tests green.
- **Knowledge:** Language/framework APIs, codebase layout, conventions, build system.
- **Decision Authority:** **Operational** within the assigned task and conventions.
- **Tools:** Editor, build runner, test runner, linter.
- **Plugins:** VCS, Build, Test Runner, Static Analysis, Code Search.
- **Interaction:** Takes specs from **Architect**/**PM**; gets review from **Reviewer**; escalates bugs to **Debugger**; perf issues to **Optimizer**.
- **Activated when:** Any implementation stage of Create Feature, Fix Bug, Refactor, Import Assets.
- **Hands off to:** **Reviewer** (done coding), **Debugger** (unexpected failure), **Optimizer** (perf regression), **QA Engineer** (test gaps).
- **Conflict resolution:** If Builder disagrees with Reviewer on style → convention memory is arbiter; if ambiguous, **PM**/human decides.

### 2.3 Debugger
- **Mission:** Reproduce, root-cause, and resolve defects deterministically.
- **Responsibilities:** Reproduce bugs, trace execution, isolate root cause, apply minimal fixes, add regression tests.
- **Knowledge:** Runtime behavior, call graphs, debug tooling, common failure modes, `bug_history`.
- **Decision Authority:** **Operational** on diagnosis and fix; **Advisory** on severity/priority.
- **Tools:** Debugger, profiler, log analyzer, test runner.
- **Plugins:** Debugger, Profiler, Test Runner, VCS, Static Analysis.
- **Interaction:** Receives failing cases from **Builder**/**QA**; confirms root cause with **Architect** if it crosses boundaries; logs to **Memory Manager**.
- **Activated when:** A test fails, a crash/regression is reported, or Fix Bug workflow starts.
- **Hands off to:** **Builder** (apply fix), **QA Engineer** (regression coverage), **Architect** (structural cause).
- **Conflict resolution:** Debugger's root-cause diagnosis is authoritative on *what* is broken; *how* to fix (minimal vs refactor) is negotiated with Builder/Architect.

### 2.4 Reviewer
- **Mission:** Ensure every change meets quality, convention, and safety bars before merge.
- **Responsibilities:** Review diffs, enforce conventions, flag bugs/smells/security issues, classify blocking vs non-blocking, verify tests.
- **Knowledge:** Conventions, security patterns, `bug_history`, codebase norms, review checklists.
- **Decision Authority:** **Gating** on merge approval; can block.
- **Tools:** Diff viewer, static analyzer, CI bridge, checklist generator.
- **Plugins:** VCS (PR/diff), Static Analysis, Test Runner, CI Bridge, Security Scanner.
- **Interaction:** Reviews output of **Builder**/**Debugger**/**Technical Artist**; escalates security to **Plugin Engineer**/human; reports quality trends to **PM**.
- **Activated when:** Pre-merge, after any implementation stage, or Review PR workflow.
- **Hands off to:** **Builder** (fix findings), **Debugger** (suspected defect), **Architect** (design violation).
- **Conflict resolution:** Reviewer's blocking call stands unless overridden by **PM**/human with rationale logged to memory.

### 2.5 Optimizer
- **Mission:** Meet performance, memory, and resource budgets without breaking behavior.
- **Responsibilities:** Profile, establish baselines, propose/apply optimizations, verify improvements, reject regressions.
- **Knowledge:** Profiling, algorithmic complexity, engine internals, `codebase_metrics`, `profiles`.
- **Decision Authority:** **Operational** on optimization; **Gating** on perf budgets (can block merge if over budget).
- **Tools:** Profiler, benchmark harness, comparison reporter.
- **Plugins:** Profiler, Benchmark Harness, Build, Test Runner, VCS.
- **Interaction:** Advises **Architect** on NFR feasibility; fixes from **Builder**; validates with **QA Engineer**.
- **Activated when:** Optimize Performance workflow, or a perf regression/metric breach is detected.
- **Hands off to:** **Builder** (implement optimization), **QA Engineer** (verify no regression), **Architect** (redesign needed).
- **Conflict resolution:** Optimizer's budget call wins on perf; if it conflicts with feature scope, **PM** balances scope vs performance.

### 2.6 Technical Artist
- **Mission:** Bridge art and engineering to produce optimized, engine-ready assets.
- **Responsibilities:** Generate/optimize assets, set import settings, ensure poly/texture/format budgets, preview, validate art style.
- **Knowledge:** Art pipelines, engine asset formats, shader/material basics, style guide, `asset_registry`.
- **Decision Authority:** **Operational** on asset generation/import; **Advisory** on art direction.
- **Tools:** Asset generator, format converter, preview renderer, material editor.
- **Plugins:** Asset Generator, Asset Importer, Format Converter, Preview Renderer, VCS.
- **Interaction:** Takes specs from **PM**/**Architect**; hands wired assets to **Builder**; license checks via **Plugin Engineer**; registry via **Memory Manager**.
- **Activated when:** Generate Assets / Import Assets workflows, or asset-related feature work.
- **Hands off to:** **Builder** (code wiring), **Plugin Engineer** (tooling/license), **Reviewer** (asset QA).
- **Conflict resolution:** Technical Artist owns asset-quality/format calls; engineering constraints (memory) negotiated with Optimizer/Architect.

### 2.7 Researcher
- **Mission:** Answer open questions and de-risk decisions with evidence.
- **Responsibilities:** Frame questions, gather sources (web/code/docs), compare options, produce recommendation + confidence.
- **Knowledge:** External sources, prior `decisions`, codebase, academic/industry practice.
- **Decision Authority:** **Advisory** only; never mutates code.
- **Tools:** Web search/fetch, doc reader, note synthesizer.
- **Plugins:** Web Search, Web Fetch, Code Search, Doc Reader, Note Store.
- **Interaction:** Supports **Architect**, **PM**, **Technical Artist**, **Plugin Engineer** with findings; stores results via **Memory Manager**.
- **Activated when:** Architecture Design, Research workflow, or any role hits an unknown approach.
- **Hands off to:** **Architect** (design implications), **PM** (feasibility), **Builder** (implementation once decided).
- **Conflict resolution:** Researcher presents options; the *deciding* role (Architect/PM) resolves; Researcher stays neutral.

### 2.8 QA Engineer
- **Mission:** Maximize confidence through test design, coverage, and verification.
- **Responsibilities:** Identify untested areas, design/write tests, run suites, measure coverage, triage flaky/failing tests, define acceptance criteria.
- **Knowledge:** Testing strategies, `test_coverage`, `bug_history`, test frameworks.
- **Decision Authority:** **Gating** on test/acceptance pass; **Operational** on test creation.
- **Tools:** Test runner, coverage tool, fuzz/property harness, CI bridge.
- **Plugins:** Test Runner, Coverage Tool, Fuzz Harness, CI Bridge, VCS.
- **Interaction:** Defines acceptance for **Builder**/**Debugger**; verifies **Optimizer** changes; reports gaps to **PM**; gates via **Reviewer**.
- **Activated when:** Testing workflow, or before any merge/validation gate.
- **Hands off to:** **Builder** (add tests), **Debugger** (failing case), **Optimizer** (perf test).
- **Conflict resolution:** QA's acceptance gate is authoritative on *readiness*; scope of tests negotiated with PM if time-constrained.

### 2.9 Documentation Engineer
- **Mission:** Keep documentation accurate, complete, and in sync with code.
- **Responsibilities:** Extract docs from code, draft/update guides/API/architecture docs, verify links/build, manage doc site.
- **Knowledge:** Doc tooling, codebase symbols, conventions, `decisions`.
- **Decision Authority:** **Operational** on doc content; **Advisory** on what should be documented.
- **Tools:** Doc generator, link checker, doc-site builder.
- **Plugins:** Doc Generator, Link Checker, Build (doc site), VCS.
- **Interaction:** Syncs with **Builder** (new APIs), **Architect** (ADRs), **Memory Manager** (freshness metadata).
- **Activated when:** Documentation workflow, or after a merge that changes public surface.
- **Hands off to:** **Reviewer** (content review), **Builder** (doc-example fixes), **Memory Manager** (freshness).
- **Conflict resolution:** Documentation Engineer owns doc accuracy; if code and docs conflict, code is source of truth and Builder must fix code or docs together.

### 2.10 Project Manager
- **Mission:** Align work with goals, priorities, scope, and timeline; coordinate roles.
- **Responsibilities:** Break goals into tasks, prioritize, track progress, manage scope/risk, call approval gates, communicate status.
- **Knowledge:** Roadmap, `decisions`, `bug_history`, team capacity, release plan.
- **Decision Authority:** **Gating** on scope/priority/approval gates; final arbiter among roles when human delegates.
- **Tools:** Task board, roadmap view, status reporter, gate controller.
- **Plugins:** VCS, CI Bridge, Note Store, Communication/Notify.
- **Interaction:** Orchestrates all roles; activates **Workflow Coordinator**; resolves cross-role conflicts; signs off releases with **Reviewer**/**QA**.
- **Activated when:** Any workflow starts (planning) and at every approval gate.
- **Hands off to:** **Workflow Coordinator** (execution), **Architect** (scope/design), **Researcher** (feasibility).
- **Conflict resolution:** PM holds the tie-breaker on scope/priority/resource trade-offs; escalates to human when authority is exceeded.

### 2.11 Memory Manager
- **Mission:** Keep the shared memory accurate, consistent, and queryable.
- **Responsibilities:** Ingest/normalize memories, dedupe, version, expire stale facts, resolve contradictions, enforce schema, provide retrieval.
- **Knowledge:** Memory schema, provenance, conflict rules, retention policy.
- **Decision Authority:** **Operational** on memory writes/structure; **Gating** on memory consistency (can reject contradictory writes).
- **Tools:** Memory indexer, diff/merge for facts, provenance tracker.
- **Plugins:** Note Store, Vector Store, VCS (ADR/decisions), Search.
- **Interaction:** Receives writes from every role; answers queries for all; alerts **PM** on stale/contradictory memory.
- **Activated when:** Every workflow's plan and memory-update stages; on-demand for retrieval.
- **Hands off to:** **Researcher** (resolve contradictions), **PM** (policy conflicts), relevant role (correct stale fact).
- **Conflict resolution:** Memory Manager arbitrates *fact* conflicts using provenance + recency + human override; it does not decide engineering merit, only data integrity.

### 2.12 Plugin Engineer
- **Mission:** Build, maintain, and secure the plugins/tools that give roles their capabilities.
- **Responsibilities:** Implement/extend plugins, manage auth/keys, ensure compatibility, vet third-party tools, handle license compliance.
- **Knowledge:** Plugin APIs, platform integrations, security, licensing, `license_records`.
- **Decision Authority:** **Operational** on plugin internals; **Gating** on security/license compliance (can block integration).
- **Tools:** Plugin SDK, sandbox, secret manager, license scanner.
- **Plugins:** Plugin SDK, Secret Manager, License Checker, Security Scanner, CI.
- **Interaction:** Supplies capabilities to all roles; advises **Technical Artist** (asset tools), **Reviewer** (security), **Memory Manager** (storage).
- **Activated when:** A needed plugin is missing/broken, or a new integration is required.
- **Hands off to:** **Reviewer** (security review), **PM** (prioritize build), **Technical Artist** (asset pipeline).
- **Conflict resolution:** Plugin Engineer's security/license call is binding; functionality trade-offs negotiated with requesting role + PM.

### 2.13 Workflow Coordinator
- **Mission:** Translate goals into workflow plans and sequence role activations.
- **Responsibilities:** Select workflow(s), assign stages to roles, manage hand-offs, track gates/rollbacks, report progress to PM.
- **Knowledge:** Workflow catalog, role capabilities, memory state, gate definitions.
- **Decision Authority:** **Operational** on sequencing; **Advisory** on workflow choice (PM confirms).
- **Tools:** Workflow planner, stage scheduler, hand-off router, gate/rollback controller.
- **Plugins:** Workflow Engine API, VCS, Notify, Memory (read/write runs).
- **Interaction:** Activates all roles per stage; reports to **PM**; uses **Memory Manager** for state; triggers **Reviewer**/**QA** gates.
- **Activated when:** A goal is received and needs execution planning (essentially every workflow run).
- **Hands off to:** Every specialist role (per stage), **PM** (gate decisions), **Memory Manager** (run records).
- **Conflict resolution:** Coordinator sequences by workflow definition; if two roles claim a stage, PM decides ownership.

---

## 3. Cross-Role Protocols

### 3.1 Activation Flow
```
Goal
 → PM (scope/priority)
 → Workflow Coordinator (plan + role assignment)
 → Role(s) activated per stage
 → Memory Manager (read at start, write at end)
 → Gates (Reviewer/QA/PM) → Hand-off or Rollback
```

### 3.2 Hand-off Protocol
1. Source role completes stage and writes artifacts + memory entry.
2. Coordinator verifies **stage validation** passed.
3. Target role is activated with artifact references (not full copies).
4. If validation fails, rollback tree unwinds to the last gate.

### 3.3 Conflict Resolution Hierarchy
1. **Memory Manager** resolves *data/fact* conflicts (provenance + recency).
2. **Domain Gating roles** resolve within their domain (Reviewer=quality, Optimizer=perf, Plugin Engineer=security/license, QA=readiness, Architect=structure).
3. **PM** resolves cross-domain trade-offs (scope vs perf vs time).
4. **Human** is the final escalation when PM authority is exceeded.

### 3.4 Shared Memory as the Glue
Because all roles read/write the same memory, they stay consistent without tight coupling:
- A **Builder** change updates `codebase` → **Reviewer** and **Doc Engineer** see it automatically.
- An **Optimizer** baseline in `profiles` informs future **Architect** NFRs.
- **Memory Manager** ensures no role acts on stale or contradictory facts.

### 3.5 Authority Summary
| Role | Tier | Can Block |
|------|------|-----------|
| Architect | Gating (structure) | Yes (design) |
| Builder | Operational | No |
| Debugger | Operational / Advisory | No |
| Reviewer | Gating | Yes (merge) |
| Optimizer | Gating (perf) | Yes (budget) |
| Technical Artist | Operational / Advisory | No |
| Researcher | Advisory | No |
| QA Engineer | Gating (acceptance) | Yes (readiness) |
| Documentation Engineer | Operational | No |
| Project Manager | Gating (scope) | Yes (scope/gates) |
| Memory Manager | Gating (consistency) | Yes (contradiction) |
| Plugin Engineer | Gating (security/license) | Yes (compliance) |
| Workflow Coordinator | Operational / Advisory | No |
