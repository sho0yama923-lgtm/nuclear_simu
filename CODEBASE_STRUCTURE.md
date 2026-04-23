# Codebase Structure

## Primary Navigation

Read files in this order for most changes:

1. `AGENT.md`
2. `CODEBASE_STRUCTURE.md`
3. relevant `.skills/**/SKILL.md`
4. `PROGRESS.md` when touching physics model, main flow, export/import, or classification

## Canonical Source Layout

- `src/model/schema.ts`
  Canonical parameter schema, validation, digesting, schedule metadata, and normalized input spec.
- `src/model/defaults.ts`
  Editable field groups and default values.
- `src/model/types.ts`
  Shared region names, schema constants, and coordinate metadata.
- `src/febio/mesh/index.ts`
  Mesh and surface-pair source of truth.
- `src/febio/interfaces/nucleusCytoplasm.ts`
  Nucleus-cytoplasm interface source of truth, including sticky cohesive stabilization, stabilization validation, and proxy/native observation ownership.
- `src/febio/export/index.ts`
  FEBio template assembly, XML serialization, export bundle entrypoint, explicit detachment event contract metadata, standard face-data coverage metadata, and the standard plotfile `contact traction` bridge contract for native tangential observation.
- `src/febio/import/normalizeFebioResult.ts`
  Canonical FEBio result normalization entrypoint, including native-first `localNc` / `localCd` merge, native face-data fallback, preservation of native regional metrics such as `contactFraction` / `nativeGap`, retention of native source labels such as `sourceNormal` / `sourceDamage` / `sourceShear`, explicit external detachment event normalization, and detachment event supplementation for imports and history.
- `src/results/classification.ts`
  Native-first classification and detachment interpretation with explicit proxy fallback labeling and shared classification application.
- `src/public-api.ts`
  Public API for tests and compatibility integration, including canonical classification application and detachment assessment bridges.
- `src/browser/main.ts`
  Browser entry that exposes the public API and boots the legacy compatibility scripts.

## Generated / Derived

- `generated/dist/`
  Generated from `src/` by `node scripts/build-dist.mjs`. Do not edit by hand.
- `generated/febio_exports/`
  Default location for FEBio export bundles, bridge output, scans, and historical run artifacts.
- `tmp/logs/`
  Disposable local logs such as bridge output logs.

## Compatibility Bundle

- `simulation.js`
  Legacy compatibility layer for the browser app. No longer the source of truth for schema or classification; classification callers, shared classification application, and explicit detachment events prefer the canonical public API bridge.
- `js/simulation-febio.js`
  Legacy FEBio compatibility layer for the browser app.
- `js/simulation-ui.js`
  Legacy UI runtime.

## Docs

- `README.md`
  Short orientation and command reference.
- `PROGRESS.md`
  Physics status, priorities, proxy/native status, and update rules.
- `AGENT.md`
  Exploration constraints, file ownership rules, and physics priorities.
- `docs/febio/`
  FEBio architecture notes, handoff docs, bridge notes, and mapping references.
- `docs/research/`
  Research-side model notes and calculation-condition references.

## Tests

- `tests/febio-front-end.test.mjs`
  Public API, FEBio export/import, classification, and governance checks.
- `tests/load-app.mjs`
  Dynamic import helper for `generated/dist/public-api.js`.

## Build / Entry

- `scripts/build-dist.mjs`
  Copies `src/**/*.ts` into `generated/dist/**/*.js` and rewrites relative import extensions.
- `scripts/convert_febio_output.mjs`
  Converts FEBio logfile output into app-result JSON, including explicit detachment events, detachment metrics, converted-result provenance visibility, native face tangential traction reuse for shear when the external face snapshots provide it, and standard plotfile contact-traction bridge reuse when that payload is present.
- `index.html`
  Loads `generated/dist/browser/main.js`, which then boots the legacy browser scripts in order.

## Exploration Reminder

- Prefer source-of-truth files in `src/`.
- Avoid repo-wide exploration when a skill or AGENT rule already names the target files.
- Do not use deep imports into internal files when a public `index.ts` exists.
- Treat content under `generated/` and `tmp/` as disposable output rather than durable source.
