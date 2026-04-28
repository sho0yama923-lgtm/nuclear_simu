# Problem-Solving Playbook

This document is the entry point for troubleshooting FEBio native-path problems.

Use this when a run, Studio handoff, parser result, or diagnostic gate looks wrong. Keep detailed root causes in `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`; keep active milestone state in `PROGRESS.md`.

## First rule: stay on the active path

For new FEBio solver behavior, use only the native-only path:

```text
febio_cases/native/*.native.json
-> scripts/export_febio_native_case.mjs
-> src/febio/native/
-> .feb
```

Legacy UI / canonical / browser bridge paths are compatibility-only. Do not use them to explain or fix new solver behavior.

## Triage order

When a problem appears, check in this order.

### 1. Is it an export / XML wiring problem?

Check:

- active step references the intended load / boundary / controller;
- load controller ids are used;
- Surface / SurfacePair / Contact names match;
- required NodeSet / Surface / ElementSet are present;
- output requests are present;
- generated XML snapshot tests cover the path.

Main references:

- `src/febio/native/xml.ts`
- `tests/febio-native-pipeline.test.mjs`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`

### 2. Is it a geometry / orientation problem?

Check:

- paired surfaces are close enough;
- surface normals match `docs/febio/GEOMETRY_CONVENTIONS.md`;
- pressure sign convention is preserved;
- contact pair primary / secondary roles are explicit;
- Studio view agrees with mechanical diagnostics.

Do not weaken the S7-E convention just to make one contact pass.

Main references:

- `docs/febio/GEOMETRY_CONVENTIONS.md`
- `src/febio/native/mesh.ts`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`

### 3. Is it a solver / Studio handoff problem?

If FEBio CLI works but Studio import/save/run fails, suspect Studio handoff rather than physics first.

Known pattern:

- Studio can create unstable internal `nodesetNN` references when logfile node data uses inline node ids.
- Use explicit NodeSets and `node_set` references for logfile node output.
- Do not emit diagnostic-only selections into solver-facing `.feb`.

Main references:

- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`

### 4. Is it an output parser problem?

Before interpreting zeros, check parsing.

Known pattern:

- FEBio logfile rows can be whitespace-delimited even if XML requests comma delimiter.
- Parsers must split with comma / whitespace tolerance.
- Distinguish missing output, all-zero output, and misparsed output.
- Check leading id columns and descriptor-driven field order.

Main references:

- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `src/febio/native/runDiagnostics.ts`
- `scripts/diagnose_febio_native_run.mjs`

### 5. Is it an output-channel mismatch?

Do not assume one output channel tells the whole truth.

S7-K example:

- logfile face-data contact pressure is zero;
- Studio / `.xplt` contact force is nonzero;
- gap control improved;
- dish-normal support remains weak.

This means contact response must be split into separate diagnostics.

Main references:

- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`
- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `src/febio/native/xpltDiagnostics.ts`

### 6. Is it a model-side physical problem?

Only after wiring, geometry, Studio handoff, and parsing are checked, change the physical model.

For cell-dish, choose the smallest next change from:

- normal preload;
- contact law;
- basal constraint;
- lift / manipulation balance.

Record any non-obvious root cause in `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`.

## When to ask for Studio confirmation

Ask for Studio confirmation when the problem depends on visible geometry, load direction, surface pairing, or post-view contour interpretation.

Always provide:

- the `.feb` path;
- run directory;
- log path;
- `.xplt` or relevant output path;
- exact items to inspect.

Reference:

- `docs/ops/STUDIO_CONFIRMATION_GATES.md`

## Root-cause stocking rule

If a problem has a non-obvious cause, can recur, silently corrupts interpretation, or creates a reusable guardrail, add or update an entry in:

```text
docs/ops/INCIDENTS_AND_ROOT_CAUSES.md
```

Do not leave such causes only in `PROGRESS.md`.

## Current S7-K diagnostic focus

Current cell-dish diagnostics should be split into:

- `cellDishPressureActive`
- `cellDishContactForceActive`
- `cellDishNormalSupportActive`
- `cellDishTangentialForceActive`
- `cellDishGapControlled`

Then project `.xplt` contact force into normal and tangential components and report pressure-zero / force-nonzero mismatch explicitly.
