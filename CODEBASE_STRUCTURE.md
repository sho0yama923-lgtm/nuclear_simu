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
  Nucleus-cytoplasm interface source of truth.
- `src/febio/export/index.ts`
  FEBio template assembly, XML serialization, export bundle entrypoint.
- `src/febio/import/normalizeFebioResult.ts`
  Canonical FEBio result normalization entrypoint.
- `src/results/classification.ts`
  Native-first classification and detachment interpretation.
- `src/public-api.ts`
  Public API for tests and compatibility integration.
- `src/browser/main.ts`
  Browser entry that exposes the public API and boots the legacy compatibility scripts.

## Generated / Derived

- `dist/`
  Generated from `src/` by `node scripts/build-dist.mjs`. Do not edit by hand.

## Compatibility Bundle

- `simulation.js`
  Legacy compatibility layer for the browser app. No longer the source of truth for schema or classification.
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

## Tests

- `tests/febio-front-end.test.mjs`
  Public API, FEBio export/import, classification, and governance checks.
- `tests/load-app.mjs`
  Dynamic import helper for `dist/public-api.js`.

## Build / Entry

- `scripts/build-dist.mjs`
  Copies `src/**/*.ts` into `dist/**/*.js` and rewrites relative import extensions.
- `index.html`
  Loads `dist/browser/main.js`, which then boots the legacy browser scripts in order.

## Exploration Reminder

- Prefer source-of-truth files in `src/`.
- Avoid repo-wide exploration when a skill or AGENT rule already names the target files.
- Do not use deep imports into internal files when a public `index.ts` exists.
