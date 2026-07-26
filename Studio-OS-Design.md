# Nova — Studio Operating System

> **Vision:** Nova is an AI-native Game Development Studio. Not a coding assistant
> and not a chatbot — the runtime that schedules cognition, governs memory, routes
> work, and operates the full studio lifecycle from concept to live ops. The user
> is the Creative Director; Nova supplies the entire development team. One
> architecture scales from a solo developer to a 2,000-person AAA organization.

---

## 1. Architectural Philosophy

| Principle | Meaning |
|-----------|---------|
| **Everything is a resource** | Projects, teams, assets, models, plugins, build servers, and tests are addressable, versioned, and quota-governed resources. |
| **Memory is the kernel** | A unified memory substrate is the single source of truth; isolation is a property of the namespace, not a separate system. |
| **Roles are responsibilities** | Specialist Roles are stable *responsibilities* — Producer, Lead Architect, Gameplay Engineer, and so on — not AI models. Models are interchangeable compute behind a Role; swapping the model never changes the Role's mandate. |
| **Workflows are programs** | Declarative, composable workflow definitions are the "binaries" the OS executes. |
| **Tenancy by namespace** | Isolation, billing, and policy are enforced at the namespace boundary — identical for one person or one studio. |
| **Designed for 10 years** | Capability-agnostic: models, plugins, and toolchains are pluggable so the platform outlives any vendor or engine generation. |

---

## 2. System Layers

```
┌──────────────────────────────────────────────────────────────┐
│                        STUDIO SHELL (UX)                       │
├──────────────────────────────────────────────────────────────┤
│                   WORKFLOW & ROLE SCHEDULER                    │
│        (Workflow Coordinator · PM · Gate/Approval Bus)         │
├──────────────────────┬───────────────────────┬───────────────┤
│   COGNITION LAYER    │   MEMORY KERNEL        │  TOOL LAYER   │
│  (AI Models·Roles)   │ (Unified Namespaced   │ (Plugins·     │
│                      │   Knowledge Store)     │  Build·Test)  │
├──────────────────────┴───────────────────────┴───────────────┤
│              STUDIO FABRIC (Projects·Teams·Assets)             │
├──────────────────────────────────────────────────────────────┤
│     LIVE OPS · DEPLOYMENT · ANALYTICS · TELEMETRY BUS          │
├──────────────────────────────────────────────────────────────┤
│                 INFRASTRUCTURE ABSTRACTION                     │
│        (Compute·Storage·Network·Secrets·Identity)              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Studio

The **Studio** is the top-level tenant and the root namespace. It owns:
- **Identity & policy root:** SSO, RBAC, compliance, data-residency.
- **Billing & quotas:** Compute, model tokens, storage, build minutes.
- **Global service catalog:** Approved plugins, model endpoints, engine versions.
- **Federation:** Studios can peer (co-dev, outsourcing) via scoped cross-namespace trusts.

A studio is provisioned in seconds from a declarative manifest. The same manifest shape applies whether the studio has one member or ten thousand.

---

## 4. Workspace

A **Workspace** is the Creative Director's working surface — the container that
groups their Projects under one cohesive environment. A Workspace owns the
default tooling, conventions, and shared resources that its Projects inherit, and
provides the day-to-day surface the Creative Director operates from (Nova Studio,
Nova Web, Nova CLI, or Nova VS Code).

The hierarchy is: **Studio → Workspace → Projects → Missions → Roles →
Execution**. A Workspace is the unit of "what I'm working on right now"; a Studio
is the tenant that owns identity, policy, and billing across all Workspaces.

## 5. Projects

A **Project** is an isolated sub-namespace under the **Workspace**. It is the
**first-class root object** of Nova: Memory, Knowledge, Missions, Plugins, Model
configuration, and Git all belong to a Project. A Project represents a game, a
DLC, a tool, or a live service.

- **Project manifest** declares: engines, target platforms, pipelines, team bindings, budget caps, approval policies.
- **Lifecycle states:** `concept → pre-production → production → release → live → sunset`.
- **Multi-project sharing:** Projects share the studio's *infrastructure* (models, build fleet, plugin catalog) but **never** each other's memory unless explicitly granted by a cross-project trust.
- **Project as a "process tree":** every workflow run is a child of the project, inheriting its policies and quotas.

---

## 5. Teams

**Teams** are dynamic, role-based groupings bound to projects (or cross-project programs).

- **Team = policy + membership + quota slice**, not a fixed org chart.
- Teams can be **human-only, Role-only, or hybrid**. The OS treats a human and a Role as peers on the bus.
- **Ephemeral teams:** spun up for a workflow (e.g. "minimap squad" = Architect + Builder + Technical Artist + QA) and dissolved on completion.
- **Capability routing:** work is assigned by *capability*, not by person — the scheduler matches Missions to the cheapest sufficient Role or human with the skill.

---

## 6. Assets

The **Asset Subsystem** is the studio's versioned, queryable content repository.

- **Asset Registry:** every asset (mesh, texture, audio, VFX, prefab, level) has a content-addressed ID, metadata, dependencies, and license record.
- **Pipeline-as-resource:** import/optimization pipelines are registered plugins; assets flow through them deterministically.
- **Provenance:** each asset records its generator (human, AI model, third party), version, and downstream dependents.
- **Garbage collection:** orphaned/unreferenced assets are flagged by the Memory Kernel and reclaimed on policy.
- **Cross-project reuse:** assets can be published to a studio-wide **Asset Library** and consumed by reference, never copied into project memory.

---

## 7. Knowledge

**Knowledge** is the unified, namespaced memory substrate — the kernel of the OS.

- **Layers:**
  - *Codebase facts* (symbols, dependencies, metrics).
  - *Decisions / ADRs* (rationale, rejected alternatives).
  - *Conventions* (style, art direction, process).
  - *Run history* (every workflow execution, outcome, lessons).
  - *External knowledge* (research, docs, market).
- **Storage is polyglot:** vector index for semantic retrieval, graph for dependencies, relational for structured facts, object store for blobs.
- **Knowledge is the long-term memory of the studio** — it compounds. A lesson learned in project A is retrievable in project B only through an explicit, audited grant.

---

## 8. AI Models

Models are **pluggable compute endpoints**, never baked into logic.

- **Model Registry:** providers, versions, capabilities, cost, latency, licensing, and allowed scopes (e.g. "code model", "vision model", "reasoning model").
- **Routing policy:** the scheduler selects the cheapest model that satisfies a stage's capability requirement. Models are swapped without touching workflows.
- **Capability abstraction:** roles declare *needed capability*, not *model name* — protecting the platform from vendor lock-in and model obsolescence over 10 years.
- **Private/edge models:** studios can register on-prem or fine-tuned models; the OS routes to them with the same interface as cloud endpoints.
- **Governance:** prompt/data egress, retention, and redaction are enforced at the model gateway.

---

## 9. Plugins

**Plugins** are the device drivers of the studio OS — they expose external capabilities (VCS, build, asset tools, CI, stores, analytics).

- **Plugin SDK & contract:** uniform interface (auth, quota, idempotency, schema). Any tool becomes a first-class resource.
- **Plugin Catalog:** studio-approved, versioned, with security and license vetting by the Plugin Engineer role.
- **Sandboxing:** plugins run isolated; secrets are injected by the Secret Manager, never stored in memory.
- **Marketplace:** studios can publish internal plugins to a shared catalog; federation allows cross-studio plugin discovery.

---

## 10. Build Servers

The **Build Subsystem** is a distributed, elastic fleet — the compute fabric for compilation, packaging, and artifact signing.

- **Build as a service:** declarative build graphs; the scheduler distributes jobs across the fleet by platform and capacity.
- **Artifact repository:** signed, immutable build outputs addressed by content hash; reproducible builds enforced.
- **Platform farm:** consoles, mobile, PC, cloud targets provisioned on demand; no studio maintains idle hardware.
- **Quota-aware:** build minutes are a billable studio resource; projects draw from the studio pool.

---

## 11. Testing

**Testing** is a continuous, policy-driven verification layer.

- **Test as a resource:** suites, fixtures, and environments are registered and versioned.
- **Layered validation:** unit → integration → E2E → performance → compliance, mapped to workflow gates.
- **Intelligent test selection:** the Memory Kernel identifies changed code→test impact and runs the minimal relevant subset; full suites run on gates.
- **Flaky-test governance:** QA Engineer role maintains a quarantine and trend analysis; regressions block releases automatically.

---

## 12. Documentation

**Documentation** is a living, auto-synchronized knowledge surface.

- **Doc-as-memory:** documentation is generated from and linked to the Knowledge layer, not a separate wiki that rots.
- **Freshness metadata:** every doc carries a source-of-truth pointer and last-verified timestamp.
- **Multi-audience rendering:** the same knowledge renders to internal engineering docs, public API docs, and player-facing guides via role-based views.

---

## 13. Deployment

**Deployment** is the controlled promotion of artifacts through environments to players.

- **Pipeline stages:** `dev → internal → alpha → beta → GA → live`, each gated by policy.
- **Progressive delivery:** canary, staged rollout, and kill-switch are native primitives; the OS can halt a bad deploy autonomously on telemetry anomaly.
- **Release governance:** versioning, changelog, and compliance attestation are produced by the workflow, not manually.
- **Multi-store publishing:** console, PC, and mobile storefronts are plugins; one release definition targets all.

---

## 14. Live Operations

**Live Ops** is the runtime control plane for shipped games.

- **Hotfix workflow:** a live incident triggers a bounded workflow (Debugger → Builder → QA → Deploy) with accelerated gates.
- **Configuration service:** live tuning (events, economy, difficulty) is a versioned, reversible resource — changes are staged and rolled back like code.
- **Incident bus:** anomalies raise tickets that route to the right role/team automatically; the OS maintains runbooks as workflows.
- **Content cadence:** seasonal content is produced by reusable asset+feature workflows on a schedule (still workflow-driven, not cron-scheduler logic for the studio itself).

---

## 15. Analytics

**Analytics** closes the loop — the studio's senses.

- **Telemetry ingestion:** gameplay, performance, crash, and economy signals flow into the Analytics subsystem.
- **Signal → workflow:** anomalies and opportunities automatically spawn Research or Optimize workflows (e.g. "frame-time spike on level 3" → Optimizer).
- **Privacy-by-design:** player data is anonymized at ingest; egress governed by policy and jurisdiction.
- **Decision support:** PM and Architect consume trend synthesis to steer roadmap; the Knowledge layer records outcomes for future learning.

---

## 16. Shared Infrastructure, Isolated Memory

This is the core design choice that makes one architecture serve all scales.

### 16.1 The Namespace Kernel
- Infrastructure (models, build fleet, plugin catalog, storage, identity) is **studio-global and multi-tenant-safe**.
- Memory is **partitioned by namespace**: `studio / project / team / run`.
- Isolation is enforced by the **Memory Kernel's access policy**, not by separate databases. A project literally cannot read another project's memory unless a **cross-namespace grant** exists and is audited.

### 16.2 How Sharing Works
- **Shared:** models, plugins, build servers, asset library (by reference), global conventions (opt-in), billing/quota.
- **Isolated:** codebase facts, decisions, run history, asset registry entries, test state, live config.
- **Copy-on-grant:** when project B is granted access to project A's asset or decision, it receives a *reference + snapshot*, never mutable linkage — preventing cross-contamination.

### 16.3 Why This Scales
A solo developer runs the *identical* kernel with one namespace and zero teams. A AAA studio runs the same kernel with hundreds of namespaces. The difference is **data and quota**, not **architecture**. No rewrite, no separate "small mode."

---

## 17. Solo Developer = AAA Studio

The architecture is **scale-invariant by construction**:

| Dimension | Solo Dev | AAA Studio |
|-----------|----------|------------|
| Studio namespace | 1 | 1 |
| Projects | 1–2 | hundreds |
| Teams | ephemeral/auto | structured orgs |
| Roles | activated on demand, same roles | same roles, more concurrent |
| Models | same registry, lower quota | same registry, higher quota |
| Build fleet | elastic, pay-per-use | elastic, pool + reservation |
| Memory isolation | single namespace | many namespaces, same kernel |
| Plugins | same catalog | same catalog + private |
| Deployment | same pipelines | same pipelines + compliance |

The solo developer is not a "reduced" version — they are a studio with one member, running the **exact same OS**. The only delta is provisioned capacity and policy strictness. This is the "single binary" property of a real operating system.

---

## 18. Ten-Year Design Trajectory

| Horizon | Evolution |
|---------|-----------|
| **0–2 yr** | Workflow + role kernel, namespaced memory, plugin/model abstraction, solo→mid studio adoption. |
| **2–5 yr** | Autonomous live-ops loops, self-improving workflows (workflows that edit workflows), cross-studio federation and asset marketplaces. |
| **5–8 yr** | Agentic teams operating full project slices unattended under human policy; model routing fully capability-driven as new modalities (video, 3D-gen, simulation) arrive. |
| **8–10 yr** | Studio OS as industry substrate: third parties build *on* it; memory becomes a portable, standards-based studio identity that follows talent across companies. |

### Durability Mechanisms
- **Capability abstraction** ensures no model, plugin, or engine generation can obsolete the platform.
- **Declarative everything** (projects, teams, workflows, policies) means the OS is reconfigured, not rewritten.
- **Memory portability** lets a studio's accumulated knowledge survive tool and vendor churn.
- **Federation** lets the system grow beyond single-studio boundaries without a new architecture.

---

## 19. Summary

Nova is not an assistant bolted onto a codebase. It is the **operating system of a
game studio**: a namespaced memory kernel, a schedulable cognition layer of
specialist Roles, a declarative workflow runtime, and a federated fabric of
plugins, build servers, deployment, live ops, and analytics. One architecture —
isolated by namespace, shared by infrastructure — serves a lone developer and a
AAA publisher with equal fidelity, and is built to outlast the next decade of
tooling.
