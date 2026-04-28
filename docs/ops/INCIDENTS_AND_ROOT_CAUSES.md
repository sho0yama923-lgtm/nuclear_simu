# Incidents and Root Causes

This document is the permanent stock of major problem causes, prevention rules, reusable failure patterns, and the troubleshooting flow for FEBio native-path problems.

`PROGRESS.md` should stay focused on the active milestone. When a major issue is understood, the durable cause, guardrail, and problem-solving method must be moved here instead of being left only in a transient progress log.

## Purpose

- Keep `PROGRESS.md` focused on the active milestone.
- Stock major problem causes so they are not lost when old progress logs are retired.
- Preserve reusable prevention rules and diagnostic lessons.
- Provide the first troubleshooting checklist before changing model physics.
- Keep transient run logs out of this file unless they explain a reusable failure mode.

## First rule: stay on the active path

For new FEBio solver behavior, use only the native-only path:

```text
febio_cases/native/*.native.json
-> scripts/export_febio_native_case.mjs
-> src/febio/native/
-> .feb
```

Legacy UI / canonical / browser bridge paths are compatibility-only. Do not use them to explain or fix new solver behavior.

## Troubleshooting order

When a run, Studio handoff, parser result, or diagnostic gate looks wrong, check in this order before changing model physics.

### 1. Export / XML wiring

Check:

- active step references the intended load / boundary / controller;
- load controller ids are actually used;
- Surface / SurfacePair / Contact names match;
- required NodeSet / Surface / ElementSet are present;
- output requests are present;
- generated XML snapshot tests cover the path.

References:

- `src/febio/native/xml.ts`
- `tests/febio-native-pipeline.test.mjs`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`

### 2. Geometry / orientation

Check:

- paired surfaces are close enough;
- surface normals match `docs/febio/GEOMETRY_CONVENTIONS.md`;
- pressure sign convention is preserved;
- contact pair primary / secondary roles are explicit;
- Studio view agrees with mechanical diagnostics.

Do not weaken the S7-E convention just to make one contact pass.

References:

- `docs/febio/GEOMETRY_CONVENTIONS.md`
- `src/febio/native/mesh.ts`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`

### 3. Solver / Studio handoff

If FEBio CLI works but Studio import/save/run fails, suspect Studio handoff before physics.

Known guardrails:

- Studio can create unstable internal `nodesetNN` references when logfile node data uses inline node ids.
- Use explicit NodeSets and `node_set` references for logfile node output.
- Do not emit diagnostic-only selections into solver-facing `.feb`.

References:

- `docs/ops/STUDIO_CONFIRMATION_GATES.md`

### 4. Output parser

Before interpreting zeros, check parsing.

Known guardrails:

- FEBio logfile rows can be whitespace-delimited even if XML requests comma delimiter.
- Parsers must split with comma / whitespace tolerance.
- Distinguish missing output, all-zero output, and misparsed output.
- Check leading id columns and descriptor-driven field order.

References:

- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `src/febio/native/runDiagnostics.ts`
- `scripts/diagnose_febio_native_run.mjs`

### 5. Output-channel mismatch

Do not assume one output channel tells the whole truth.

S7-K example:

- logfile face-data contact pressure is zero;
- Studio / `.xplt` contact force is nonzero;
- gap control improved;
- dish-normal support remains weak.

This means contact response must be split into separate diagnostics.

References:

- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`
- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `src/febio/native/xpltDiagnostics.ts`

### 6. Model-side physical change

Only after wiring, geometry, Studio handoff, parsing, and output-channel interpretation are checked, change the physical model.

For cell-dish, choose the smallest next change from:

- normal preload;
- contact law;
- basal constraint;
- lift / manipulation balance.

## What must be recorded here

Record an entry when any of the following becomes clear:

- A failure had a non-obvious root cause.
- A bug could silently corrupt interpretation or diagnostics.
- A solver / Studio / parser behavior can recur later.
- A workaround becomes a rule that future work must preserve.
- A misleading metric or gate was discovered.
- A compatibility or handoff issue affected the active FEBio path.

Do not rely on git history alone for these cases. Git history is the raw archive; this document is the curated cause log.

## What should not be recorded here

- One-off scratch attempts without reusable lessons.
- Raw run logs that are already captured in artifacts.
- Long chronological milestone history.
- Temporary hypotheses that were not confirmed.

## Entry format

Each entry should include:

- Status
- Discovered in
- Symptom
- Cause
- Impact
- Fix or mitigation
- Regression guard
- References

## Current entries to expand

- Studio save failures caused by unstable internal named selections.
- FEBio logfile delimiter mismatches.
- Output-channel mismatches between logfile face data and plotfile vectors.
- Pressure-only `cellDishLoadBearing` interpretation being too narrow.
- Contact variants that cause initial negative jacobian.
