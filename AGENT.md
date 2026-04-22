# AGENT

## Read First

1. `AGENT.md`
2. `CODEBASE_STRUCTURE.md`
3. relevant `.skills/**/SKILL.md`
4. `PROGRESS.md` when touching physics model, main flow, classification, export/import, or proxy/native dependencies

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

Major files should start with:

```ts
/**
 * Responsibility:
 * Owns:
 * Does NOT own:
 * Primary entrypoints:
 * Depends on:
 */
```

Required:

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
- If a matching skill exists, follow the skill before doing repo-wide exploration.
- Do not read outside the skill's target files unless the skill explicitly allows it or a concrete blocker exists.
- When a repetitive workflow stabilizes, add a new skill.
- When a skill becomes stale, update it in the same change set as the code change.

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
