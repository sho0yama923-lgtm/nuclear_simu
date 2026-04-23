# AGENT

## Read First

1. `AGENT.md`
2. `CODEBASE_STRUCTURE.md`
3. relevant `.skills/**/SKILL.md`
4. `PROGRESS.md` when touching physics model, main flow, classification, export/import, or proxy/native dependencies

## Codex Prompt Protocol

Purpose:

- reduce ambiguity in change requests
- reduce unnecessary repo-wide exploration
- keep task-specific skills effective by fixing the allowed read set up front

When requesting a change from Codex / an agent, specify as much of the following as possible:

- edit target files
- files that may be referenced
- directories that should not be read by default
- main purpose of the change
- docs that must be updated in the same change set

Do not rely on ambiguous instructions such as:

- "必要なら関連箇所も見てよい"
- "適宜必要なファイルを見て"
- "関連ファイルを探索して"

Prefer bounded requests such as:

```text
編集対象:
- src/febio/interfaces/nucleusCytoplasm.ts

参照可:
- src/model/schema.ts
- src/febio/import/normalizeFebioResult.ts

参照禁止:
- legacy/*
- experiments/*
- generated/*
- src/surrogate/*

目的:
- localNc の native 出力寄り整理

更新対象:
- PROGRESS.md
```

If the request does not specify scope, Codex should still stay within the minimum read set defined below rather than expanding to repo-wide exploration by default.

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
  - `CODEBASE_STRUCTURE.md`
  - relevant `.skills/**/SKILL.md`
  - `PROGRESS.md`
- Token discipline is part of correctness.
  - If a task can be completed with minimal exploration, keep it minimal.
  - Do not expand from a local task into repo-wide search unless a concrete blocker appears.
  - Repeated edit workflows should be codified into `SKILL.md` instead of re-explained in long natural-language prompts every time.

## Source Of Truth Rules

- parameter schema: `src/model/schema.ts`
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

## Skill Usage Rule

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
  - local procedures and bounded read-set rules belong in the relevant `SKILL.md`
  - current state recognition and implemented / partial / planned status belong in `PROGRESS.md`
- If more than one layer is affected, update all affected layers together rather than only one of them.

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

`empirical-prompt-tuning` is appropriate when:

- validating a newly created `SKILL.md`
- validating a heavily revised `SKILL.md`
- checking whether ambiguity in `AGENT.md` or a task prompt is causing bad agent behavior
- checking whether the instruction layer is causing unnecessary exploration

`empirical-prompt-tuning` is not appropriate when:

- making a one-off small fix
- doing a normal local code change
- a task-specific skill already provides enough guidance to finish the work

When empirical tuning is used, evaluate not only correctness but also exploration efficiency:

- number of files read
- whether forbidden areas were accessed
- whether the skill's read order was followed
- whether repo-wide exploration happened

This keeps skill quality tied to both answer quality and token-efficient execution. Detailed evaluation procedure belongs in the empirical skill itself, not here.

## Physics Model Priority

Priority is fixed as:

1. nucleus-cytoplasm cohesive stabilization
2. `localNc` native output
3. classification native migration
4. explicit detachment judgment
5. true cohesive introduction

Deferred for now:

- membrane shell
- cell-dish cohesive
- LINC / cytoskeleton

Operational rules:

- Do not make large extensions unrelated to higher-priority items.
- If you touch a lower-priority item, state why it does not block the higher-priority path.

## Supporting Migration Priority

The physics priority above stays fixed. In parallel, keep the compatibility runtime on a retirement path:

1. decompose `simulation.js`
2. migrate remaining ownership into canonical `src/` modules
3. reduce `simulation.js` to a thin compatibility bridge
4. retire compatibility-local schema, classification, and detachment logic once canonical callers are complete

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

Also:

- always reflect `implemented / partial / planned` changes
- record new approximations honestly
- record regressions honestly, including `implemented -> partial`
- write `PROGRESS.md` in Japanese unless a specific exception is requested
- keep `README.md`, `CODEBASE_STRUCTURE.md`, and `PROGRESS.md` aligned

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
