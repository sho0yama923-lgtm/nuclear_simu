# Incidents and Root Causes

This document is the permanent stock of solved problems, major problem causes, prevention rules, reusable failure patterns, and the troubleshooting flow for FEBio native-path problems.

`PROGRESS.md` should stay focused on the active milestone. When a problem is solved, the durable cause, fix, guardrail, and problem-solving method must be recorded here instead of being left only in a transient progress log.

## Purpose

- Keep `PROGRESS.md` focused on the active milestone.
- Stock solved problems and their causes so they are not lost when old progress logs are retired.
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

## Recording rule for solved problems

When a problem is solved, add or update an entry here by default.

This applies even if the problem was not catastrophic. The deciding question is whether the solution contains reusable knowledge.

Record the solution here when any of the following is true:

- The cause was non-obvious.
- The same failure could recur.
- The problem affected solver, Studio, parser, output mapping, diagnostics, or active-path ownership.
- The fix introduced a guardrail, convention, or ordering rule.
- The issue silently corrupted interpretation or diagnostics.
- A misleading metric, boolean gate, or output channel was discovered.
- A workaround became part of normal operation.
- The solution explains why a previous approach should not be repeated.

Minor typos, formatting-only changes, and one-off scratch attempts do not need entries unless they reveal a reusable rule.

Do not rely on git history alone for solved problems. Git history is the raw archive; this document is the curated problem-solving stock.

## What must be recorded here

Record an entry when any of the following becomes clear:

- A failure had a non-obvious root cause.
- A bug could silently corrupt interpretation or diagnostics.
- A solver / Studio / parser behavior can recur later.
- A workaround becomes a rule that future work must preserve.
- A misleading metric or gate was discovered.
- A compatibility or handoff issue affected the active FEBio path.

## What should not be recorded here

- One-off scratch attempts without reusable lessons.
- Raw run logs that are already captured in artifacts.
- Long chronological milestone history.
- Temporary hypotheses that were not confirmed.
- Pure formatting changes without operational or diagnostic implications.

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
