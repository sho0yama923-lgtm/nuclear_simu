# AGENT

## Read First

1. `AGENT.md`
2. `docs/CODEBASE_STRUCTURE.md`
3. relevant `.skills/**/SKILL.md`
4. `PROGRESS.md` when touching physics model, main flow, classification, export/import, or proxy/native dependencies
5. `docs/ops/STUDIO_CONFIRMATION_GATES.md` when touching FEBio Studio-visible geometry, contact, pressure, load activation, or real-run force/response validation
6. `docs/febio/FEBIO_NATIVE_SPEC.md` when touching FEBio solver parameters, direct FEBio input, UI parameter conversion, or FEBio-native CLI/backend validation
7. `TASK_REQUEST_TEMPLATE.md` when shaping a new bounded task request

## Role

This file is the stable operating contract for Codex / AI agents in this repository. Current project state belongs in `PROGRESS.md`; detailed repo layout belongs in `docs/CODEBASE_STRUCTURE.md`; repeatable task request structure belongs in `TASK_REQUEST_TEMPLATE.md`.

## Code Exploration Constraints

- Explore in this order:
  1. explicitly requested edit target files
  2. direct imports of those files
  3. explicitly allowed reference files
  4. `index.ts`, `README`, or `SKILL.md` in the relevant directory
  5. everything else is off-limits unless a concrete reason is stated
- The following areas are off-limits by default:
  - `legacy/`
  - `experiments/`
  - `generated/`
  - `tmp/`
  - past export data
  - past logs, temporary output, and snapshots
- Deep imports are prohibited.
  - Do not import paths like `../a/b/c/internal/file`.
  - Go through public entrypoints such as `index.ts`.
- Keep each change scoped to the minimum read set.
  - Target: 5-8 files per change.
  - If you must exceed that, state why.
- Prefer structural docs before code:
  - `AGENT.md`
  - `docs/CODEBASE_STRUCTURE.md`
  - relevant `.skills/**/SKILL.md`
  - `PROGRESS.md`
- Token discipline is part of correctness.
  - If a task can be completed with minimal exploration, keep it minimal.
  - Do not expand from a local task into repo-wide search unless a concrete blocker appears.
  - Repeated edit workflows should be codified into `SKILL.md` or docs under `docs/ops/`.

## Source Of Truth Rules

Source-of-truth map:

- parameter schema: `src/model/schema.ts` for the current canonical / compatibility path
- future FEBio solver parameter source of truth: `docs/febio/FEBIO_NATIVE_SPEC.md`, then implementation under the FEBio-native spec path once added
- mesh generation: `src/febio/mesh/`
- nucleus-cytoplasm interface: `src/febio/interfaces/nucleusCytoplasm.ts`
- FEBio export: `src/febio/export/`
- result normalization: `src/febio/import/normalizeFebioResult.ts`
- classification: `src/results/classification.ts`

Rules:

- Do not define the same concept in multiple files.
- All secondary files must reference the source-of-truth file.
- Source-of-truth files must include a `SOURCE OF TRUTH` comment.
- If the source of truth is a directory, provide a public entrypoint such as `index.ts` or `README`.
- Keep the detailed source map in `docs/CODEBASE_STRUCTURE.md` aligned with this rule set.

## File Responsibility Contract

Major files use the following contract header:

```ts
/**
 * Responsibility:
 * Owns:
 * Does NOT own:
 * Primary entrypoints:
 * Depends on:
 */
```

Contract strength:

- Source-of-truth files must include the contract header.
- Newly created major files must include the contract header.
- Existing files should be backfilled when touched.

Required content:

- state the single responsibility
- state what the file owns
- state what it explicitly does not own
- state the primary entrypoints
- state major dependencies when needed

## File Size & Split Rules

- Typical target: 200-300 lines
- Recommended upper bound: 400 lines
- Split required above 500 lines

Split when:

- `mesh / material / interface / export / import / result` are mixed
- data definition and logic are mixed
- solver code and surrogate code are mixed
- UI metadata and physics logic are colocated
- code with different reasons for change is colocated

## Naming Rules

- Do not use multiple names for the same concept.
- Use `nucleusCytoplasm` for public source-of-truth names and `localNc` for local normalized result fields.
- Encode `proxy / native / planned / legacy / debug` explicitly in names when relevant.
- Keep one main entry function per behavior.
- Distinguish comparison or old implementations in the name.

Examples:

- `localNcNative`
- `localNcProxy`
- `membraneShellPlanned`
- `buildRefinedFebioGeometry`
- `buildCoarseFebioGeometryLegacy`

## Skill Usage Rules

- For repetitive tasks, prefer `.skills/**/SKILL.md`.
- If a matching task-specific skill exists, follow the skill before doing repo-wide exploration.
- Do not read outside the skill's target files unless the skill explicitly allows it or a concrete blocker exists.
- If a task is small enough to complete with a mature skill, use the skill path instead of expanding the prompt or the read set.
- Repeated edit workflows should be fixed in `SKILL.md`; daily operation should trend toward "refer to the skill and execute" rather than re-describing the same procedure every time.
- When a repetitive workflow stabilizes, add a new skill.
- When a skill becomes stale, update it in the same change set as the code change.

## Operational Feedback Rule

- If a recurring operational problem is discovered, codify it instead of leaving it only in chat history.
- Update the codified rule in the same change set as the fix or discovery.
- Route the feedback by layer:
  - global operating rules belong in `AGENT.md`
  - local procedures and bounded read-set rules belong in the relevant `SKILL.md` or `docs/ops/`
  - durable broad policy, roadmap stage plans, and long-term priority belong in `docs/ops/ROADMAP.md`
  - current state recognition, next bounded milestone, fine-grained implementation notes, done conditions, and blockers belong in `PROGRESS.md`
- If more than one layer is affected, update all affected layers together rather than only one of them.

## ROADMAP / PROGRESS Responsibility Rule

Purpose:

- keep long-term direction separate from current execution details
- prevent `docs/ops/ROADMAP.md` from becoming a volatile task checklist
- prevent `PROGRESS.md` from becoming a broad strategy document without executable milestones

Rules:

- `docs/ops/ROADMAP.md` owns broad policy, roadmap stage structure, current stage purpose, review gates, later/deferred work, and auxiliary roadmap positioning.
- `PROGRESS.md` owns current operating state, next bounded milestone, target files, fine-grained implementation notes, done conditions, blockers, and resume position.
- Fine-grained implementation bullets belong in `PROGRESS.md`, not `docs/ops/ROADMAP.md`.
- Broad priority changes, current stage changes, stage completion, stage scope changes, later/deferred changes, or auxiliary roadmap changes belong in `docs/ops/ROADMAP.md`.
- If a change only updates the current milestone, target files, done condition, blocker, or resume position, update `PROGRESS.md` only.
- If a change alters the broad stage plan or direction, update both `docs/ops/ROADMAP.md` and `PROGRESS.md` in the same change set.
- Agents should read `docs/ops/ROADMAP.md` to understand why the current work matters, then use `PROGRESS.md` to decide what to do next.

## Bounded Milestone Execution Rule

Purpose:

- make policy-driven work advance to a useful review boundary
- prevent agents from stopping at trivial partial edits
- prevent agents from expanding into uncontrolled repo-wide rewrites

Rules:

- When the user asks to "proceed according to the policy", "方針通りに進めて", "進めて", or equivalent, the agent should complete one bounded milestone.
- A bounded milestone is the smallest coherent unit that leaves the repository in a useful reviewable state.
- A bounded milestone is larger than a placeholder, TODO, isolated helper, or doc-only note when implementation work is clearly implied.
- A bounded milestone is smaller than a broad migration, final cleanup, UI integration, or deletion of old paths unless explicitly requested.
- The agent should infer the milestone from `PROGRESS.md` and `docs/ops/ROADMAP.md`, not from chat history.
- The milestone should normally include all directly adjacent work needed for coherence:
  - implementation
  - tests or diagnostics
  - generated / inspection instructions when applicable
  - docs / `PROGRESS.md` updates when status changes
- The agent should stop at the first natural review boundary where the user can inspect, test, run, or decide the next step.
- If the next step requires human confirmation, external software, FEBio Studio inspection, or unavailable runtime execution, stop there and provide the exact confirmation request.
- Do not split one coherent milestone into many tiny changes just because each file can be edited independently.
- Do not combine multiple independent milestones just because they are all part of the same long-term direction.
- Prefer a change size that is large enough to be useful and small enough to review.

## Studio Confirmation Gate Rule

Purpose:

- divide FEBio work between agent-owned code/debug tasks and user-owned FEBio Studio visual confirmation tasks
- prevent agents from guessing through geometry, contact, load direction, or real-run response questions that are faster and safer to verify in Studio
- keep Codex / agent work focused on code, XML, tests, parser, diagnostics, and docs rather than speculative visual validation

Rules:

- Read `docs/ops/STUDIO_CONFIRMATION_GATES.md` before touching FEBio Studio-visible geometry, contact surfaces, pressure/load activation, contact response, or real-run force transfer validation.
- Agents may proceed independently on code-mechanical work: XML wiring, exporter tests, mesh existence validation, parser fixes, provenance, diagnostics, docs, and minimal force-transfer debug models.
- Agents must not assume Studio-visible physical correctness from code inspection alone when the task depends on visual geometry, surface orientation, pressure arrow direction, actual contact formation, or post-run nonzero displacement / contact pressure / reaction force.
- When Studio confirmation is needed, the agent must stop at a confirmation gate, provide the Studio confirmation request template from `docs/ops/STUDIO_CONFIRMATION_GATES.md`, and wait for the user's observation before claiming the issue is fixed or proceeding with physics validation.
- While waiting for Studio confirmation, agents may still complete independent work that does not depend on the visual observation, such as tests, parser hardening, diagnostics, and documentation updates.
- After receiving Studio observations, agents must record material findings in `PROGRESS.md` when they affect blockers, resume point, next actions, or implemented / partial / planned status.

## FEBio-Native Spec First Rule

Purpose:

- keep solver validation independent from UI parameter conversion
- make FEBio geometry / material / contact / load / boundary / output parameters the physics source of truth
- integrate UI only after CLI/backend FEBio-native validation is stable

Rules:

- Read `docs/febio/FEBIO_NATIVE_SPEC.md` before touching FEBio solver parameters, direct FEBio input, UI parameter conversion, or FEBio-native CLI/backend validation.
- When implementing FEBio solver behavior, define required solver parameters first in FEBio-native spec.
- Do not introduce new physics parameters only in UI schema.
- UI parameters are presentation aliases, preset inputs, or compatibility inputs; they are not the physics source of truth.
- Physics validation must use the CLI/backend FEBio-native path until export, run, convert, diagnostics, and Studio confirmation are stable.
- UI integration should happen after FEBio-native spec, CLI export/run, converter/import, diagnostics, and Studio confirmation gates are stable.
- If legacy UI parameters are still supported, route them through an explicit compatibility/preset conversion layer into FEBio-native spec.
- Once FEBio-native spec migration is complete, UI-parameter conversion files must be treated as legacy / compatibility code, not active physics source-of-truth.
- Do not extend legacy conversion files with new solver behavior unless the task is explicitly compatibility migration.
- New solver parameters must be added to FEBio-native spec first, then exposed to UI later.

## Skill Layering Rule

Purpose:

- separate normal implementation work from prompt/skill quality evaluation
- keep empirical evaluation available without turning it into a default token cost

Rules:

- Normal implementation work uses task-specific `SKILL.md` first.
- `empirical-prompt-tuning` is not a default implementation skill; it is for improving AGENT / SKILL quality and instruction clarity.
- Newly created or heavily revised `SKILL.md` files may be validated with `empirical-prompt-tuning` when needed.
- Do not run `empirical-prompt-tuning` on every normal implementation task.
- If a task-specific skill exists, use that skill first and consider empirical tuning only if the agent behavior is not matching intent or the instruction quality itself is in doubt.
- empirical tuning is a supplement to implementation skills, not a replacement for them.

When empirical tuning is used, evaluate not only correctness but also exploration efficiency:

- number of files read
- whether forbidden areas were accessed
- whether the skill's read order was followed
- whether repo-wide exploration happened

## Physics Model Priority

The durable broad policy, roadmap stage structure, and long-term priority live in `docs/ops/ROADMAP.md`.
`AGENT.md` must not duplicate the active priority list, because stale copies cause agents to pick the wrong next task.

Use the layers this way:

- `docs/ops/ROADMAP.md`: broad direction, roadmap stages, current stage purpose, review gates, later/deferred work, auxiliary roadmap positioning.
- `PROGRESS.md`: current operating state, next bounded milestone, target files, fine-grained implementation notes, done conditions, blockers, resume position.
- `AGENT.md`: stable rules for how agents read, edit, and synchronize the repo.

Deferred for now:

- membrane shell
- cell-dish cohesive
- LINC / cytoskeleton

Operational rules:

- Read `PROGRESS.md` for the immediate bounded milestone, then `docs/ops/ROADMAP.md` when the task may change the stage plan or broad priority order.
- Do not make large extensions unrelated to higher-priority items.
- If you touch a lower-priority item, state why it does not block the higher-priority path.
- The rationale is recorded in `docs/DECISIONS.md`.

## Supporting Migration Priority

Supporting migration work is an auxiliary roadmap, not the second item in the physics priority list. Its current stage status and completion criteria live in `docs/ops/ROADMAP.md`.

Operational rules:

- Treat `simulation.js` work as support for the main physics path, not as a competing roadmap.
- When moving code out of `simulation.js`, update the canonical source-of-truth file and the compatibility call site in the same change set.
- Do not add new long-term ownership to `simulation.js` unless a short-term compatibility blocker requires it.

## PROGRESS Sync Rule

Update `PROGRESS.md` in the same change set when changing:

- physics model
- cohesive model
- detachment logic
- main flow
- classification
- export/import main path
- proxy/native dependency structure
- `simulation.js` ownership or compatibility-bridge scope
- current bounded milestone, target files, done condition, blocker, or resume position

Also:

- always reflect `implemented / partial / planned` changes
- record new approximations honestly
- record regressions honestly, including `implemented -> partial`
- update `docs/ops/ROADMAP.md` in the same change set only when broad priority order, main roadmap stage status/scope, later/deferred items, or auxiliary roadmap position changes
- do not put immediate implementation checklists in `docs/ops/ROADMAP.md`; keep them in `PROGRESS.md`
- write `PROGRESS.md` in Japanese unless a specific exception is requested
- keep `README.md`, `docs/CODEBASE_STRUCTURE.md`, and `PROGRESS.md` aligned

## Detachment-Oriented Design

- The main project goal is evaluation of conditions under which the nucleus detaches from the cytoplasm.
- Treat detachment as an explicit event.
- Migrate from proxy-assisted logic toward native cohesive output.
- Judge detachment from both damage and geometry.
- Keep classification aligned with the detachment definition.
- Treat LINC and cytoskeleton as future extensions; prioritize the effective interface for now.

## Anti-Patterns

- giant files with multiple responsibilities
- duplicated logic
- mixing proxy and native logic without recording it
- mixing main-path and experimental code
- bypassing source-of-truth files
- deep imports
- repo-wide exploration that is unrelated to the requested change
- ignoring an available task-specific skill and doing repo-wide exploration anyway
- running empirical tuning as part of every normal implementation flow
- guessing through Studio-visible geometry/contact/load correctness instead of using the Studio confirmation gate
- adding new solver behavior only to UI parameter conversion files instead of defining it in FEBio-native spec first
- treating legacy UI parameter conversion files as active physics source-of-truth after FEBio-native migration
- stopping after a trivial partial edit when a coherent reviewable milestone is available
- treating policy-driven work as permission for an unbounded migration
- mixing independent milestones in one pass without an explicit request
- leaving the repository in a state where the next reviewer cannot run, inspect, or evaluate the change
- putting fine-grained implementation checklists in `docs/ops/ROADMAP.md` instead of `PROGRESS.md`
- putting broad roadmap stage policy only in `PROGRESS.md` without updating `docs/ops/ROADMAP.md` when the broad direction changes
