# Nova Manifesto

> *A new kind of tool for a new kind of game development.*

---

## 1. What is Nova?

Nova is an AI-native Game Development Operating System.

It is not an assistant. It is not a chatbot. It is not "ChatGPT for games."

Nova is a **persistent, contextual, execution-capable operating system** whose purpose is the creation of interactive experiences. The developer does not prompt Nova. The developer directs Nova — as a Creative Director directs a studio.

The "AI" in Nova is not a single model. It is the composition of:
- A **memory system** that never forgets
- A **reasoning layer** that plans before it acts
- An **execution layer** that makes real changes to real projects
- A **learning system** that improves without retraining
- A **knowledge graph** that understands how things connect
- A **recovery system** that never gives up without a fight

Nova runs on your machine. It knows your engine, your architecture, your codebase, your art pipeline, your team's conventions. It works offline. It works with any LLM — or no LLM — because the intelligence is in the architecture, not the model.

Nova is to game development what Unreal Engine was to rendering: a platform that raises the floor and extends the ceiling.

---

## 2. What Problems Does Nova Solve That ChatGPT Cannot?

### ChatGPT gives answers. Nova builds games.

| Problem | ChatGPT | Nova |
|---------|---------|------|
| Context | Zero. Every conversation starts blank. | Persistent. Knows your project, engine, architecture, history. |
| Execution | None. Suggests code you must manually apply. | Full. Creates files, runs terminals, edits code, manages assets. |
| Continuity | None. Yesterday's conversation is lost. | Total. Every mission, decision, and failure is remembered. |
| Verification | None. May hallucinate APIs that don't exist. | Built-in. Validates output against project structure and engine APIs. |
| Learning | None. The model never improves from your usage. | Compound. Every completed mission makes Nova better at the next one. |
| Offline | Requires internet. | Runs locally. Your data never leaves your machine. |
| Architecture awareness | None. Treats every project as text. | Full. Understands module boundaries, dependency rules, engine constraints. |
| Failure handling | Gives up or hallucinates a fix. | Retries, falls back, escalates, and learns from the failure. |
| Team integration | Single-user chat. | Multi-role. Producer, Architect, Engineer, QA — all in one system. |

### The fundamental difference:

ChatGPT is a **question-answering machine**. Nova is a **game-building operating system**.

One is useful for getting unstuck. The other is useful for shipping a game.

---

## 3. Why Would a Professional Game Developer Choose Nova?

### Because Nova treats game development as engineering, not text generation.

**Nova understands engines.** Not as text patterns, but as systems with rules, constraints, best practices, and common failure modes. When you say "I'm using Godot 4," Nova knows what that means — the scene system, the signal architecture, the GDScript quirks, the export pipeline.

**Nova respects architecture.** It won't suggest a change that violates your module boundaries. It knows where the rendering code lives and where the gameplay code lives. It asks before making architectural changes.

**Nova remembers.** It remembers why you chose ECS over inheritance. It remembers that the last physics refactor introduced a bug in the jump mechanic. It remembers your preference for composition over deep class hierarchies.

**Nova executes.** It doesn't just tell you what to do — it does it. Creates the files. Writes the boilerplate. Runs the build. If it fails, it tries again differently. If it can't fix it, it tells you exactly what's wrong and what it tried.

**Nova stays in context.** You can take a week off, come back, and Nova remembers exactly where you left off — which branch, which build was broken, which mechanic was being tuned.

**Nova works offline.** Your game code, your engine, your art assets — none of it leaves your machine. Nova runs with local models when the internet is down.

**Nova gets better.** Not the model — Nova. The system learns from every mission. What approaches worked. What errors recur. What context was actually needed. Over months, Nova becomes specialized to your project, your engine, your way of working.

### The pitch:

> "Nova is the team member who knows the entire codebase, remembers every decision, never sleeps, and gets better every day."

---

## 4. What Should Nova NEVER Become?

### 4.1 A Black Box

Nova must **never** make decisions the developer cannot inspect, understand, and override.

Every plan is reviewable. Every decision has a rationale. Every execution is observable. If Nova breaks something, the trace shows exactly what happened and why.

The developer is always in charge. Nova advises, proposes, and executes — but never without transparency.

**Rule**: If a feature makes Nova less explainable, it does not ship.

### 4.2 A Substitute for Developer Judgment

Nova should **never** position itself as a replacement for the developer's creativity, taste, or engineering judgment.

Nova handles the mechanical, the repetitive, the well-understood. It does not decide what makes a fun game. It does not choose the art style. It does not determine the architecture. It *informs* those decisions with data and options, but the Creative Director decides.

**Rule**: Nova augments, never replaces.

### 4.3 A Zero-Context Chatbot

Nova must **never** start a session as if the project does not exist.

Every interaction is grounded in the current project state, the mission history, the architecture, the memory. If Nova doesn't know something, it says so — it does not pretend.

**Rule**: If Nova cannot answer from context, it asks clarifying questions. It never guesses.

### 4.4 A Code Generator That Doesn't Understand Code

Nova must **never** generate code it cannot verify.

Every line of code Nova writes must be grounded in understanding: the engine API, the project's conventions, the module boundaries, the dependency graph. If Nova doesn't understand the framework, it researches it before writing.

Generated code that compiles but violates architecture is worse than no code at all.

**Rule**: Nova verifies before presenting.

### 4.5 A Dependency on Any Single LLM

Nova must **never** depend on a specific model, provider, or API.

The intelligence layer is model-agnostic. If OpenAI goes down, Nova runs on Anthropic. If Anthropic changes its pricing, Nova runs on DeepSeek. If the internet goes down, Nova runs on Ollama.

Nova's value is in the architecture, not the model.

**Rule**: Every model-dependent feature must have a fallback.

### 4.6 A SaaS Product That Owns Your Data

Nova must **never** require cloud upload of your game code, assets, or project data.

Your game is yours. Nova runs locally. All memory, all context, all execution traces stay on your machine.

If Nova offers cloud features (sync, collaboration, remote models), they are opt-in, transparent, and never default.

**Rule**: Offline-first. Always.

---

## 5. Core Philosophy

### 5.1 Persistence Over Prompting

Every conversation starts from zero in ChatGPT. Nova carries the full weight of the project's history into every interaction.

The default state is **knowing**. The exceptional state is **asking**.

### 5.2 Execution Over Generation

ChatGPT generates text. Nova changes files, runs commands, builds projects, and verifies results.

The output of Nova is not a code block — it is a working game.

### 5.3 Architecture Over Autonomy

Nova does not autonomously decide what to build. It proposes, the developer disposes. Nova is a tool for engineering discipline, not a replacement for it.

Architecture constraints are hard boundaries. Nova respects module boundaries, dependency rules, and engine conventions — even when the easiest path violates them.

### 5.4 Learning Over Replacement

Nova does not need a new model to get better. It learns from every mission, every failure, every correction.

The system compounds. A month of using Nova should make it noticeably better at predicting what you need.

### 5.5 Offline-First Over Cloud-Dependent

Nova runs on your hardware. Local models, local storage, local execution.

The cloud is a performance option, not a requirement.

### 5.6 Mission-Oriented Over Prompt-Response

The unit of work in Nova is a **mission**, not a message.

A mission has a goal, a plan, an execution, a verification, and a learning record. It is not a one-shot question — it is a complete unit of work from intent to outcome.

### 5.7 Team Structure Over Monolithic Agent

Nova does not act as a single omniscient entity. It acts as a **studio** — a team of roles (Producer, Architect, Engineer, QA) that collaborate within defined boundaries.

The developer is the Creative Director. Nova provides the team.

---

## 6. Product Principles

### Principle 1: Every Feature Must Justify Its Complexity

Nova is a complex system. Every new feature must earn its place by solving a real problem that professional game developers face.

If a feature can be implemented as a script, it should be a script, not a subsystem. If it can be a config option, it should be a config option, not a UI surface.

**Test**: "Would a professional developer notice if this feature didn't exist?"

### Principle 2: The Developer Is Always the Owner

Nova owns nothing. It manages files that the developer owns. It creates code that the developer owns. It makes decisions that the developer can override.

Every Nova-generated file is a normal file. Every Nova-created asset is a normal asset. There is no "Nova format," no "Nova lock-in."

**Test**: "If Nova disappeared tomorrow, would the developer's workflow be disrupted, or would they just keep working?"

### Principle 3: Graceful Degradation

Every feature works offline. Every model has a fallback. Every network-dependent operation has a local alternative.

When something fails, Nova does not crash. It degrades: slower model, smaller context, no internet features — but it keeps working.

**Test**: "What happens when the internet goes down? Does Nova stop working or just get slower?"

### Principle 4: Everything Is Observable

Every decision, every execution, every failure is recorded and accessible. The developer can inspect the full trace of why Nova did what it did.

Observability is not a debugging tool — it is a trust mechanism. The developer trusts Nova because they can see what happened and understand why.

**Test**: "Can the developer answer 'why did Nova do that?' from the data Nova provides?"

### Principle 5: Opt-In Intelligence

Nova's default behavior is conservative. It asks before doing. It plans before executing. It verifies before presenting.

As the developer gains trust, Nova earns autonomy. Intelligence features unlock gradually — based on demonstrated reliability, not marketing promises.

**Test**: "Does this feature make Nova more autonomous by default, or does it earn autonomy through reliability?"

### Principle 6: No Vendor Lock-In

Nova supports any model provider, any game engine, any version control system, any operating system.

If a new engine launches, Nova supports it through the same plugin system. If a new model provider launches, Nova routes to it through the same interface.

**Test**: "If the developer switches engines, do they need to switch tools?"

---

## 7. Engineering Principles

### Principle 1: The Intelligence Is in the Architecture, Not the Model

The model is a replaceable component. The intelligence is in the:
- Memory system that persists context
- Reasoning layer that plans before acting
- Execution layer that verifies before accepting
- Learning system that compounds over time
- Recovery system that handles failure gracefully

If every model provider disappeared tomorrow, Nova would still be valuable — for its persistence, its context, its architecture, its learning.

### Principle 2: Deterministic When Possible, AI When Necessary

Every decision that can be made with rules should be made with rules. AI is used only when the decision requires understanding, reasoning, or generation that cannot be codified.

This makes Nova predictable, debuggable, and testable — properties that professional tools have and chatbots lack.

### Principle 3: Persistence Is Not Optional

Nova never loses state. Memory writes are synchronous and verified. Context is saved on every meaningful change. Mission state survives crashes, restarts, and upgrades.

The default is durable. The exceptional is transient.

### Principle 4: Every Subsystem Has a Single Responsibility

A subsystem that does two things does neither well. If a module is hard to name, it has too many responsibilities.

Goal Engine understands intent. Mission Planner decomposes work. Reasoning Engine selects approach. Executor carries out steps. Recovery Engine handles failures. Learning Engine consolidates experience.

No overlap. No ambiguity.

### Principle 5: Events Are the Backbone

Subsystems do not call each other. They publish events and subscribe to events. This keeps subsystems decoupled, testable, and replaceable.

The Event Bus is not a convenience — it is an architectural invariant.

### Principle 6: Testability Is a Feature

Every subsystem must be testable in isolation. If a component cannot be tested without the full stack, it has too many dependencies.

Mocks are for external systems (file system, network, model APIs), not for internal subsystems.

---

## 8. User Experience Principles

### Principle 1: The Developer Directs, Nova Executes

The developer is the Creative Director. Nova is the studio. The developer decides what to build; Nova proposes how to build it, builds it, verifies it, and reports back.

The interface is not a chat box. It is a mission control panel: goals, plans, progress, results, traces.

### Principle 2: Progress Is Always Visible

The developer always knows:
- What mission is active
- What step is executing
- What tool is being used
- What progress has been made
- What failures have occurred
- What the next step is

Nova is never silent. If it is thinking, it says so. If it is stuck, it says so. If it is waiting, it says so.

### Principle 3: Failure Is Honest

When Nova fails, it does not pretend it succeeded. It does not silently retry. It reports the failure, explains why it happened, and proposes a recovery path.

A truthful failure is more valuable than a silent recovery.

### Principle 4: Learning Is Transparent

The developer can see what Nova has learned: which patterns were extracted, which recommendations are active, which past missions informed the current approach.

Learning is not a black box. It is an inspectable database of experience.

### Principle 5: Configuration Is Code

Nova's behavior — thresholds, policies, preferences — is configured in files, not hidden in UI menus. Configuration is version-controlled, reviewable, and project-specific.

`nova.config.ts` defines how Nova works on this project. It lives in the repository.

---

## 9. Long-Term Goals (5–10 Years)

### Year 1-2: Foundation

- **Nova is useful for solo developers and small teams.**
- Core intelligence pipeline works: goal → plan → reason → execute → recover → learn.
- Supports Godot, Unity, Unreal, and custom engines through plugin system.
- Local-first execution with optional cloud acceleration.
- Reasoning service selects optimal model per task.
- Recovery service retries failures and escalates when stuck.
- Memory system persists mission history and project knowledge.

**Measure**: A solo developer can ship a complete game using Nova as their primary development tool.

### Year 2-3: Team

- **Nova handles multi-developer projects with role-based collaboration.**
- Multiple developers direct Nova concurrently.
- Nova understands git branches, merge conflicts, and code review.
- Role system: Producer prioritizes, Architect designs, Engineer implements, QA verifies.
- Learning engine extracts patterns from completed missions.
- Knowledge graph maps project entities and relationships.

**Measure**: A studio of 5 developers uses Nova to coordinate and accelerate their workflow, not as a chatbot but as their development operating system.

### Year 3-5: Studio

- **Nova replaces entire development pipelines for professional studios.**
- Full CI/CD integration: Nova builds, tests, packages, and deploys.
- Art pipeline integration: Nova understands 3D models, textures, animations, audio.
- Design integration: Nova reads game design documents and proposes implementations.
- Localization pipeline: Nova manages translation strings, voice-over, subtitles.
- Performance profiling: Nova identifies bottlenecks and proposes optimizations.
- Multi-project management: Nova works across an entire studio's portfolio.

**Measure**: A professional game studio ships a commercial title where Nova was the primary development operating system for the entire team.

### Year 5-10: Platform

- **Nova is the standard operating system for game development.**
- Nova runs in the browser, on desktop, in VR/AR development environments.
- Nova marketplace for engine-specific intelligence packs.
- Nova ecosystem: third-party plugins, context providers, reasoning strategies.
- Nova Academy: Nova teaches game development as it builds.
- Nova becomes the foundation for AI-native game engines that don't exist yet.
- Nova's architecture influences how all creative tools are built — not just games.

**Measure**: Nova is cited in game development education as the tool that made AI-native development mainstream, the way Unity and Unreal made real-time 3D accessible.

---

## 10. The Non-Negotiables

These are the hills Nova will die on. No feature, no deadline, no business pressure justifies compromising them.

| # | Non-Negotiable | Why |
|---|---------------|-----|
| 1 | **Offline-first** | Your game is yours. Nova runs without the cloud. |
| 2 | **Observable by default** | Every decision is traceable. No black boxes. |
| 3 | **Model-agnostic** | No vendor lock-in. Nova works with any LLM or none. |
| 4 | **Developer ownership** | Nova generates files you own. No proprietary formats. |
| 5 | **Architecture-aware** | Nova respects module boundaries, dependency rules, and engine constraints. |
| 6 | **Failure-honest** | Nova reports failures truthfully. No silent retries. |
| 7 | **Mission-oriented** | The unit of work is a mission, not a message. |
| 8 | **Learning-compounding** | Every mission makes Nova better. Improvement without model retraining. |

---

## 11. What Nova Will Not Do

- Replace the developer's creative judgment
- Generate code it cannot verify
- Work only with one model provider
- Require internet access
- Store project data on third-party servers
- Lock projects into proprietary formats
- Make decisions the developer cannot inspect
- Autonomously ship code without review
- Pretend to understand what it does not
- Forget what it learned

---

## 12. The Ultimate Test

> *If Nova disappeared tomorrow, would the developer go back to how they worked before, or would they lose a fundamental capability?*

The goal is the second answer.

When Nova achieves that, it has succeeded.

---

*Nova Manifesto v1 — July 2026*
