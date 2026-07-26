# AI Model Routing Architecture Specification: Nova

## 1. Purpose and Principle

Nova supports a heterogeneous fleet of AI models spanning local, cloud, free, and premium tiers. The defining requirement of the routing system is that the Creative Director never manually selects a model. Routing is fully automatic: the platform observes the Mission, the Role requesting it, the environment, and historical outcomes, then dispatches work to the most appropriate model along the dimensions of quality, latency, cost, and reliability. Roles declare a *needed capability*, not a model name, so models remain interchangeable.

The routing system is provider-agno 8stic. Models are registered as capabilities, not brands, so the platform can absorb new providers and model generations without user intervention or core changes.

## 2. Model Categories

### 2.1 Local Models

Models executed on the user's own machine through the desktop runtime. They require no network, incur no per-call cost after provisioning, and offer predictable latency. They are generally smaller in capacity and context but are the backbone of offline-first operation and privacy-sensitive work.

### 2.2 Cloud Models

Models hosted by external providers and accessed over the network. They offer larger capacity, broader context, and specialized capabilities (such as image or 3D generation) at the cost of latency, per-call pricing, and connectivity dependence.

### 2.3 Free Models

Models available without direct monetary cost, which may be local or cloud-hosted. They are used as the default for low-complexity, high-frequency, and exploratory work to minimize spend.

### 2.4 Premium Models

High-capability models, typically cloud-hosted, reserved for tasks where quality, reasoning depth, or specialization justifies cost. They are selected only when the task complexity, risk, or required specialization demands them.

## 3. Routing Factors

The router evaluates every task against the following factors:

- **Task complexity** — the reasoning depth, ambiguity, and multi-step nature of the work.
- **Latency** — the responsiveness required by the interaction or workflow stage.
- **Cost** — the acceptable monetary expenditure, governed by user and studio policy.
- **Context size** — the volume of project, memory, and code context the task requires.
- **Offline mode** — whether network connectivity is available; offline forces local routing.
- **Reliability** — the need for consistent, dependable output and provider uptime.
- **Model specialization** — whether the task requires a capability only certain models possess (e.g., image or 3D generation).
- **Game engine** — engine-specific tasks may benefit from models fine-tuned or prompted for that engine's idioms.
- **Programming language** — code tasks are routed toward models with strong competence in the relevant language.
- **Task type** — the specific cognitive workload (research, documentation, architecture, etc.), detailed below.

## 4. Task-Type Routing Policy

For each task type, the router applies a default category selection and rationale. These are policies, not hard rules; they are overridden by environment state (e.g., offline) and refined by learning.

### Documentation

Low complexity, tolerant latency, large context frequently required. Routed to **free or local models** by default; cloud models used when context size exceeds local capacity or when higher prose quality is requested. Rationale: documentation is repetitive and well-scoped, so cost-efficient models suffice.

### Architecture

High complexity, reasoning-intensive, high stakes. Routed to **premium cloud models** when online and complexity is high; **local models** only for initial drafts or when offline. Rationale: architectural reasoning benefits from the deepest models, and errors are costly.

### Research

Variable complexity, exploratory, tolerant latency. Routed to **free or local models** for breadth exploration, escalating to **premium cloud models** when synthesis and depth are required. Rationale: research often begins broad and narrows; spend is concentrated where it matters.

### Image Generation

Requires specialized generative capability not present in general text models. Routed to **specialized cloud models** (or local generative models where available). Rationale: this is a capability-bound task, not a complexity decision.

### 3D Generation

Requires specialized generative or procedural capability. Routed to **specialized cloud models** or engine-specific local tooling (e.g., Blender plugin pipelines). Rationale: 3D generation depends on model or tool specialization, not generic reasoning.

### Code Review

Moderate to high complexity, context-heavy, reliability-sensitive. Routed to **premium cloud models** for critical paths; **local or free models** for routine, low-risk review. Rationale: review quality directly affects defect rates, so capability is weighted heavily.

### Debugging

Variable complexity, often context-heavy and time-sensitive. Routed to **local or free models** for simple, well-scoped bugs; **premium cloud models** when root cause is elusive or the blast radius is high. Rationale: debugging cost scales with difficulty, so routing follows diagnosed complexity.

## 5. Routing Pipeline

The routing pipeline transforms a task request into a model dispatch decision:

1. **Task classification** — the task is classified by type, complexity, and required specialization using the intent and planning context.
2. **Constraint evaluation** — the router assesses offline status, latency tolerance, context size, and active cost policy.
3. **Candidate generation** — models matching the required capabilities and constraints are enumerated from the registry.
4. **Scoring** — each candidate is scored against the routing factors using policy weights (quality, latency, cost, reliability).
5. **Selection** — the highest-scoring candidate within policy bounds is chosen; ties break toward lower cost and local execution.
6. **Dispatch** — the task is sent to the selected model with appropriate context and permission scope.
7. **Observation** — the outcome, latency, cost, and quality signal are recorded for learning and benchmarking.

The pipeline is itself a plugin-compatible subsystem; scoring policies can be adjusted per studio without code changes.

## 6. Fallback Strategy

The router defines a cascading fallback order to maintain reliability:

- **Primary to alternative** — if the selected model fails, times out, or violates a quality threshold, the router retries with the next-best scored candidate of the same tier.
- **Tier downgrade** — if all candidates in the preferred tier are unavailable, the router downgrades (premium to free, cloud to local) while preserving task validity.
- **Local safety net** — when cloud models are unreachable, all routable tasks fall back to local models where the task is executable locally.
- **Graceful degradation** — tasks that cannot be completed by any available model are deferred, queued, or returned with a clear status rather than failing silently.
- **Circuit breaking** — providers exhibiting repeated failures are temporarily deprioritized to protect latency and cost.

## 7. Offline Strategy

Offline mode is a first-class routing state, not an exception:

- **Forced local routing** — when connectivity is absent, the router restricts candidates to local models and local tooling.
- **Capability gating** — tasks requiring cloud-only specialization (e.g., certain image or 3D generation) are deferred with an explicit "requires connectivity" status.
- **Queueing** — cloud-bound tasks initiated offline are queued and automatically dispatched when connectivity returns, preserving offline-first workflow continuity.
- **Status transparency** — the system clearly indicates which capabilities are available offline versus pending, so the user is never surprised.

## 8. Cost Optimization

- **Default-to-free** — routine, low-complexity, and exploratory tasks default to free or local models.
- **Premium only when justified** — premium models are selected strictly when complexity, risk, or specialization demands, with the rationale recorded.
- **Context trimming** — the router minimizes sent context to the necessary scope, reducing token cost on cloud models.
- **Batching** — compatible tasks are batched to reduce per-call overhead where latency permits.
- **Policy ceilings** — studios and users set cost ceilings and premium-model budgets; the router enforces them and escalates for approval when exceeded.
- **Spend telemetry** — routing decisions and outcomes feed cost reports, making expenditure observable and controllable.

## 9. Model Benchmarking

The platform maintains a continuous, internal benchmarking process:

- **Quality signals** — verification outcomes, user corrections, and task success rates attribute quality back to the model used.
- **Performance signals** — latency, throughput, and reliability are recorded per model and per task type.
- **Cost efficiency** — cost per successful outcome is computed to identify the most economical model for each task class.
- **Specialization tracking** — models are scored on specialized task types (image, 3D, code review) independently of general reasoning.
- **Benchmark-driven weights** — routing policy weights are recalibrated from benchmark data so the system improves without manual tuning.

## 10. Learning from Previous Routing

The router learns from its own history:

- **Outcome memory** — successful model selections for similar tasks and contexts are remembered with provenance and confidence.
- **Preference reinforcement** — task-type-to-model mappings that consistently yield good outcomes are reinforced; poor ones are down-weighted.
- **Context adaptation** — the router learns per-project and per-studio patterns (e.g., a studio's codebase favors a particular language model) and biases selection accordingly.
- **Feedback loop** — user overrides and corrections to routing are captured as signals, allowing the system to align with human preference over time.
- **Conservative promotion** — learned biases are promoted across boundaries only through permission-gated policies, avoiding unreliable generalizations.

## 11. Future Model Plugins

The routing system is designed for indefinite model evolution:

- **Capability-based registration** — any new model, local or cloud, registers by declaring capabilities and constraints; no core change is required.
- **Provider adapters as plugins** — new providers are added through the plugin system, including credentials handling and endpoint configuration.
- **Dynamic policy extension** — new task types and routing factors can be introduced through policy definitions rather than code.
- **Benchmark integration** — newly registered models automatically enter the benchmarking and learning cycle, so they earn routing share through demonstrated performance.
- **Backward compatibility** — model and provider contracts are versioned, ensuring older models remain routable as the fleet expands.

This design guarantees that as AI models and providers evolve over the studio's multi-year life, Nova continues to choose optimally without ever requiring the Creative Director to make that choice.
