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

## Entries

### INC-001: FEBioStudio internal `nodesetNN` save failure

Status:

- fixed / guardrail active

Discovered in:

- S7-K Studio handoff cleanup

Symptom:

- FEBio CLI could read and solve the generated `.feb`, but FEBioStudio save/run handoff failed with invalid internal mesh item list references such as `nodesetNN`.
- The failure looked like a Studio-visible file problem, even though CLI normal termination was possible.

Cause:

- Solver-facing `.feb` contained selections that were useful as diagnostics but were not required as active solver mesh items.
- Some logfile node outputs used inline node id lists instead of stable named NodeSets.
- FEBioStudio could import and rewrite these selections into internal `nodesetNN` references, then later emit invalid references on save/run.

Impact:

- CLI success was not sufficient evidence that the file was clean for Studio handoff.
- Studio-visible validation could fail after an apparently successful export/run path.

Fix or mitigation:

- Emit only active solver-facing mesh items into `.feb`.
- Keep diagnostic-only selections in the native model JSON, not in solver-facing XML.
- Use explicit NodeSets and `node_set` references for logfile node output.

Regression guard:

- Treat Studio import/save/run as a separate confirmation gate from CLI normal termination.
- When adding logfile node output, prefer named NodeSets over inline node id lists.
- Do not emit unused diagnostic-only mesh items to the solver-facing mesh section.

References:

- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `src/febio/native/xml.ts`
- `tests/febio-native-pipeline.test.mjs`

### INC-002: FEBio logfile delimiter mismatch

Status:

- fixed / guardrail active

Discovered in:

- S7-K native run diagnostics

Symptom:

- Diagnostics could incorrectly summarize FEBio output as zero or malformed.
- Parser results could disagree with FEBioStudio / `.xplt` observations.

Cause:

- FEBio logfile rows can be whitespace-delimited even when XML requests `delim=","`.
- A comma-only parser can treat an entire whitespace-delimited numeric row as one field, silently corrupting displacement/contact summaries.

Impact:

- Displacement, contact pressure, gap, or reaction summaries could be misread.
- A physics issue could be misclassified as all-zero response when the parser was actually wrong.

Fix or mitigation:

- Parse FEBio logfile numeric rows with comma / whitespace tolerance, for example `/[,\\s]+/`.
- Distinguish missing output, all-zero output, and misparsed output.

Regression guard:

- Any new FEBio logfile parser must tolerate both comma and whitespace separators.
- Before interpreting zeros, check row tokenization, leading id columns, and descriptor-driven field order.

References:

- `src/febio/native/runDiagnostics.ts`
- `scripts/diagnose_febio_native_run.mjs`
- `docs/febio/FEBIO_OUTPUT_MAPPING.md`

### INC-003: Face-data pressure and `.xplt` contact-force mismatch

Status:

- active / under diagnosis

Discovered in:

- S7-K cell-dish diagnostics

Symptom:

- Logfile face-data `contact pressure` remains zero for the cell-dish interface.
- FEBioStudio / `.xplt` show nonzero contact force on the cell-dish pair.
- Gap control improves after increasing cell-dish normal stiffness, but dish-normal support remains weak.

Cause:

- Not fully resolved.
- Current evidence indicates that face-data contact pressure and plotfile contact force are different output channels and cannot be collapsed into a single verdict.
- The pressure output may be inactive, unavailable for the tied-elastic formulation, or not representative of the force component currently observed in `.xplt`.

Impact:

- A zero pressure output can be misread as absence of cell-dish contact force.
- Contact response can be misinterpreted unless pressure, plotfile force, normal support, tangential force, and gap control are separated.

Fix or mitigation:

- Split cell-dish diagnostics into separate gates:
  - `cellDishPressureActive`
  - `cellDishContactForceActive`
  - `cellDishNormalSupportActive`
  - `cellDishTangentialForceActive`
  - `cellDishGapControlled`
- Project `.xplt` contact force into normal and tangential components before choosing the next model-side change.

Regression guard:

- Do not use face-data pressure alone as the final load-bearing verdict.
- Preserve surface item id -> surface name mapping for `.xplt` face data.
- Report pressure-zero / force-nonzero states explicitly.

References:

- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`
- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `src/febio/native/xpltDiagnostics.ts`
- `src/febio/native/runDiagnostics.ts`

### INC-004: Pressure-only `cellDishLoadBearing` interpretation was too narrow

Status:

- active / mitigation planned

Discovered in:

- S7-K diagnostic review

Symptom:

- `cellDishLoadBearing=false` looked like a broad verdict that the cell-dish interface was not supporting load.
- In the implementation, the gate mainly reflected whether face-data contact pressure was nonzero.

Cause:

- The gate name was broader than the measured quantity.
- The boolean collapsed multiple physical and diagnostic concepts: pressure output, plotfile contact force, normal support, tangential force, and gap control.

Impact:

- Reviewers and agents could incorrectly conclude that there was no cell-dish force even when `.xplt` contact force was nonzero.
- Model-side changes could be chosen before diagnosing whether the issue was output-channel mapping, normal support, contact law, or preload.

Fix or mitigation:

- Keep `cellDishLoadBearing` only as a compatibility alias or retire it after downstream references are updated.
- Introduce explicit gates for pressure, plotfile force, normal support, tangential force, and gap control.
- Document that old `cellDishLoadBearing=false` means pressure-output inactive, not necessarily force absent.

Regression guard:

- Boolean gate names must match the measured quantity.
- If a gate is a high-level interpretation, it must be composed from explicit lower-level diagnostics.

References:

- `PROGRESS.md`
- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`
- `src/febio/native/runDiagnostics.ts`

### INC-005: Cell-dish contact variants caused initial negative jacobian

Status:

- mitigated / watch

Discovered in:

- S7-K contact-law scratch exploration

Symptom:

- Some cell-dish contact variants, including sliding-elastic / sticky-style attempts, caused initial negative jacobian or unstable startup behavior.
- The tied-elastic baseline could run warning-free, while the alternative variants were not immediately safe substitutions.

Cause:

- The current coarse/native mesh and initial contact geometry are sensitive to contact formulation changes.
- A formulation that is conceptually attractive can still be numerically unsafe without mesh refinement, preload, or better initialization.

Impact:

- Switching contact law directly is not the safest first response to weak dish-normal support.
- Broad contact-law rewrites can turn a diagnosable output/force problem into a solver-stability problem.

Fix or mitigation:

- Keep the warning-free tied-elastic baseline while diagnostics are split.
- Diagnose pressure, plotfile force, normal support, tangential force, and gap control before changing contact law.
- Treat contact-law changes as the next model-side step only after wiring, geometry, Studio handoff, parser behavior, and output-channel interpretation are checked.

Regression guard:

- Preserve a warning-free baseline for comparison.
- Do not replace the active contact formulation without a bounded comparison run and clear rollback point.
- If an alternative contact law introduces negative jacobian, record it as a stability result rather than continuing to tune blindly.

References:

- `docs/febio/NATIVE_MODEL_REFINEMENT_STRATEGY.md`
- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`
- `PROGRESS.md`
