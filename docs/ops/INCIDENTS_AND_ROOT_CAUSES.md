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

- diagnosed / split-gate mitigation active

Discovered in:

- S7-K cell-dish diagnostics

Symptom:

- Logfile face-data `contact pressure` remains zero for the cell-dish interface.
- FEBioStudio / `.xplt` show nonzero contact force on the cell-dish pair.
- Gap control improves after increasing cell-dish normal stiffness, but dish-normal support remains weak.

Cause:

- Face-data contact pressure and plotfile contact force are different output channels and cannot be collapsed into a single verdict.
- The pressure output may be inactive, unavailable for the tied-elastic formulation, or not representative of the force component currently observed in `.xplt`.

Impact:

- A zero pressure output can be misread as absence of cell-dish contact force.
- Contact response can be misinterpreted unless pressure, plotfile force, normal support, tangential force, and gap control are separated.

Fix or mitigation:

- Cell-dish diagnostics are split into separate gates:
  - `cellDishPressureActive`
  - `cellDishContactForceActive`
  - `cellDishNormalSupportActive`
  - `cellDishTangentialForceActive`
  - `cellDishPressureForceMismatch`
  - `cellDishGapControlled`
- Project `.xplt` contact force into normal and tangential components before choosing the next model-side change.
- For the current S7-K baseline, pressure is inactive, contact force is active, tangential force is active, gap is controlled, and normal support remains below threshold.

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

- fixed / compatibility alias retained

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

- Keep `cellDishLoadBearing` only as a pressure-only compatibility alias or retire it after downstream references are updated.
- Introduced explicit gates for pressure, plotfile force, normal support, tangential force, pressure/force mismatch, and gap control.
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

### INC-006: Cell-dish normal preload reaches normal support before pressure output

Status:

- diagnosed / normal-support candidate active

Discovered in:

- S7-L normal preload comparison

Symptom:

- Adding `0.05 kPa` positive pressure on `cell_dish_surface` increased `.xplt` normal contact force and preserved warning-free termination, but did not close the normal-support gate.
- Increasing preload to `0.10 kPa` preserved warning-free termination and made `cellDishNormalSupportActive=true`.
- Face-data contact pressure remained zero in both preload cases.

Cause:

- Normal preload increases the cell-dish normal component enough to close the `.xplt` support gate at `0.10 kPa`.
- The pressure-output mismatch is not fixed by preload and is likely an output-channel / formulation interpretation issue.

Impact:

- Normal preload is a viable model-side candidate for normal support in the current tied-elastic baseline.
- A pressure-only localCd or load-bearing verdict will still report false even when normal support is present in `.xplt`.

Fix or mitigation:

- Keep the S7-K tied-elastic baseline, S7-L `0.05 kPa`, and S7-M `0.10 kPa` as comparison points.
- Treat S7-M as the current warning-free normal-support candidate.
- Converter/import now preserve `native-plotfile-contact-traction` as a localCd normal/damage source when a standard plotfile bridge payload provides normal traction and face-data pressure is zero.
- Real `.xplt` extraction now feeds that bridge for `cell_dish_surface`; converted result JSON can carry the plotfile normal source.
- The current extraction is explicitly labeled as global cell-dish fan-out, not region-resolved localCd force, until region-split plotfile surfaces exist.

Regression guard:

- Do not call cell-dish absent when `cellDishContactForceActive=true` and `cellDishNormalSupportActive=true`, even if `cellDishPressureActive=false`.
- Keep pressure-output mismatch as a separate gate until the face-data channel is understood or replaced in downstream diagnostics.
- Keep global plotfile bridge provenance distinct from future region-specific plotfile provenance.

References:

- `febio_cases/native/S7_normal_preload.native.json`
- `febio_exports/S7_normal_preload/S7-L_S7_normal_preload.feb`
- `febio_cases/native/S7_normal_preload_high.native.json`
- `febio_exports/S7_normal_preload_high/S7-M_S7_normal_preload_high.feb`
- `scripts/convert_febio_output.mjs`
- `src/febio/import/normalizeFebioResult.ts`
- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`
- `docs/febio/NATIVE_MODEL_REFINEMENT_STRATEGY.md`

### INC-007: Pipette interaction inactive across pressure, reaction, and plotfile force

Status:

- diagnosed / carried to next model-side phase

Discovered in:

- S7-Q pipette interaction diagnostic split

Symptom:

- S7-M reaches warning-free normal termination and has cell-dish normal support.
- `febio_pipette_cell_contact.csv` pressure remains zero.
- `febio_pipette_contact.csv` pressure remains zero.
- `febio_rigid_pipette.csv` reaction remains zero.
- `.xplt` contact force remains zero on `pipette_suction_surface` and `pipette_contact_surface`.

Cause:

- Not solved in S7. The current diagnostics show the pipette/cell coupling is inactive across all emitted force channels.
- Nucleus and cytoplasm displacement can be nonzero while pipette force capture is still absent, so movement alone is not proof of pipette interaction.
- S8-A pre-run geometry diagnostics show the suction surface and rigid mouth surface are normal-aligned with zero normal gap, but tangentially offset by `8.5 um` in the x-z section.
- S8-B aligns the surfaces exactly (`pressureDiagnostics.couplingReadiness.ready=true`, zero normal gap, zero tangential offset) and still leaves every pipette force channel inactive.
- S8-C re-enables bounded `pipette_nucleus_contact` and restores rigid pipette reaction, but pipette-cell pressure and pipette plotfile force remain inactive.
- S8-D reduces manipulation amplitude while keeping capture-hold active; rigid reaction remains active and cell-dish gap control returns, but pipette-cell pressure and pipette plotfile force are still inactive.
- S8-E reverses `pipette_cell_pair` primary/secondary role while preserving S8-D conditions; direct pipette-cell pressure and pipette plotfile force remain inactive.
- S8-F computes declared pressure-load resultants from native model JSON; S8-D/S8-E both have active declared suction pressure (`12.6 nN` on `pipette_suction_surface`) while direct pipette contact output remains inactive.
- S8-G separates `pipette_suction_surface` from the duplicated nucleus-right face by moving it to the outer right cytoplasm surface. The first winding `[69,71,72,70]` caused a FEBioStudio incorrect-facet warning; changing it to `[69,70,72,71]` makes the comparison Studio-compatible and activates direct pipette pressure, rigid reaction, and pipette plotfile force.
- S8-H reduces outer-cell pipette motion and preserves direct force channels, but keeps one stiffness-reformation warning.
- S8-I softens pipette-cell penalty and S8-J lowers suction pressure; both preserve direct force channels but increase stiffness-reformation warnings to three.
- S8-K timestep-only refinement preserves direct force channels but increases stiffness-reformation warnings to seven.
- S8-L delayed inward-ramp onset preserves direct force channels but warnings remain before the delayed ramp becomes nonzero.
- S8-M returns to nucleus-side pressure and reaches warning-free normal termination with an active declared suction pressure load (`12.6 nN`) and tissue displacement, while direct pipette contact pressure, rigid reaction, and pipette plotfile contact-force channels remain zero.

Impact:

- Detachment interpretation cannot be considered physically complete until pipette interaction is active or deliberately replaced.
- S7 can close as a diagnostic stage, but the next model-side phase should start from pipette coupling rather than another cell-dish contact-law change.
- Rigid reaction alone is not equivalent to pressure-driven pipette-cell suction; S8-C also regresses cell-dish gap control.
- S8-D shows the S8-C cell-dish gap regression is motion-amplitude dependent, but the direct pipette-cell force-channel issue remains.
- S8-E shows simple `SurfacePair` primary/secondary ordering is not the active direct pipette-cell force-channel blocker.
- S8-F shows missing pressure-load declaration is not the active direct pipette-cell force-channel blocker.
- S8-G shows Studio-compatible facet winding can be decisive for the outer-cell suction comparison: the warning-producing winding kept the interpretation unstable, while the corrected winding activates the direct channel.
- S8-H/S8-I/S8-J show that smaller motion, softer pipette-cell contact, and lower suction pressure reduce force magnitude but do not solve the solver warning. The remaining issue is a stabilization / transition problem, not simple force-amplitude overload.
- User correction after S8-L: the intended physical model applies pressure to the nucleus-side capture surface. Therefore S8-G/L outer-cell activation is diagnostic bridge evidence, not the final suction geometry.
- S8-M shows the nucleus-side pressure path is solver-stable and load-declared, but direct pipette contact-output channels are not the right sole evidence channel for pressure applied directly to a deformable nucleus-side surface.

Fix or mitigation:

- Split `pipetteInteractionActive` into pressure, mouth pressure, rigid reaction, suction plotfile force, and mouth plotfile force gates.
- Add `pressureDiagnostics.couplingReadiness` to report suction/mouth centroid delta, normal gap, and tangential offset before running FEBio.
- Preserve S7-M as the cell-dish normal-support candidate.
- Carry pipette coupling / suction force capture as the next model-side blocker.
- After S8-B, prioritize the active pipette contact definition or load-transfer path over additional centroid-only geometry changes.
- After S8-C, use capture-hold as a diagnostic comparison while isolating direct pipette-cell pressure / plotfile force and cell-dish gap regression.
- After S8-D, use gentle capture-hold as the comparison baseline for direct `pipette_cell_contact` output/channel work.
- After S8-E, prioritize contact law/output semantics or direct surface separation over more pair-role-only comparisons.
- After S8-F, separate declared suction pressure load diagnostics from direct contact output diagnostics; prioritize output/transfer semantics over re-adding the same pressure load.
- After S8-G, preserve the Studio-compatible outer-right winding as diagnostic bridge evidence only; do not treat the outer-cell path as final physics.
- After S8-J, avoid more amplitude-only pressure/penalty reductions as the next move; compare ramp timing, step boundaries, or solver controls around the `t ~= 3.01-3.06` warning window.
- After the nucleus-pressure clarification, pivot the next bounded comparison back to nucleus-side pressure instead of continuing to optimize the outer-cell bridge.
- After S8-M, instrument pressure-load response on the nucleus-side surface separately from contact pressure, rigid reaction, and plotfile contact-force outputs before changing geometry again.

Regression guard:

- Do not infer pipette interaction from nucleus/cytoplasm displacement alone.
- Do not infer pipette readiness from normal alignment or normal gap alone; check tangential offset too.
- Do not infer pipette force capture from pre-run readiness alone; S8-B proves `ready=true` can still produce zero pipette pressure, rigid reaction, and plotfile force.
- Do not infer pressure-driven suction from rigid reaction alone; S8-C proves rigid reaction can return while direct pipette pressure / plotfile force remain zero.
- Do not treat motion tuning as a fix for direct pipette-cell force output; S8-D recovers gap control but leaves direct pipette pressure / plotfile force at zero.
- Do not assume reversing `pipette_cell_pair` primary/secondary will activate direct pipette force; S8-E preserves the zero direct channel.
- Do not call the suction load missing when `pipetteSuctionPressureLoadActive=true`; S8-F proves the declared pressure load can be present while direct contact output stays zero.
- Do not use `[69,71,72,70]` for the S8-G outer-right suction facet; FEBioStudio warns that this winding is incorrect. Use `[69,70,72,71]` for the Studio-compatible comparison.
- Do not promote the S8-G/L outer-cell surface to the final model just because it activates direct force channels. The final target is nucleus-side pressure unless a later explicit model decision changes that.
- Do not treat reduced reaction magnitude as stabilization by itself; S8-I/S8-J reduce magnitude while worsening the warning count.
- Do not require a direct pipette contact pressure, rigid reaction, or contact-force plotfile channel before acknowledging an active declared pressure load. S8-M proves these can diverge for the nucleus-side pressure path.
- Do require a separate pressure-load response diagnostic before treating the nucleus-side suction model as complete for detachment interpretation.

References:

- `src/febio/native/runDiagnostics.ts`
- `src/febio/native/xpltDiagnostics.ts`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `docs/febio/NATIVE_MODEL_REFINEMENT_STRATEGY.md`
- `PROGRESS.md`

### INC-010: Nucleus-side pressure load and direct contact outputs diverge

Status:

- diagnosed / next instrumentation axis active

Discovered in:

- S8-M nucleus-pressure return comparison

Symptom:

- S8-M reaches warning-free normal termination.
- The declared `pipette_suction_pressure` load on `pipette_suction_surface` is active with a `12.6 nN` native surface-area resultant.
- Nucleus and cytoplasm displacement are nonzero.
- Direct pipette channels remain zero: contact pressure, rigid reaction, suction plotfile contact force, mouth plotfile contact force, and aggregate direct-contact output.

Cause:

- The target model applies a pressure load directly to the nucleus-side capture surface, not through an outer-cell contact pair.
- FEBio contact pressure / rigid reaction / contact-force plotfile channels report contact-style force transfer, so they can remain zero while a declared surface pressure load is present and affects the deformable bodies.

Impact:

- A zero direct pipette contact output is not sufficient evidence that the nucleus-side suction pressure is missing.
- Moving pressure back to the outer cell surface would optimize an easier diagnostic channel, not the intended physical model.

Fix or mitigation:

- Keep S8-M as the target-geometry evidence point.
- Add or refine diagnostics that report pressure-load response separately from contact outputs.
- Preserve S8-G/L only as diagnostic bridge evidence proving that direct output channels can activate under different geometry.

Regression guard:

- Before changing physical geometry, classify pipette evidence into declared pressure load, tissue displacement, contact pressure, rigid reaction, and plotfile contact force.
- Do not collapse `pipetteSuctionPressureLoadActive=true` and `pipetteDirectContactOutputActive=false` into a single failure verdict.

References:

- `febio_cases/native/S8_pipette_nucleus_pressure_return.native.json`
- `febio_exports/S8_pipette_nucleus_pressure_return/S8-M_S8_pipette_nucleus_pressure_return.log`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `scripts/diagnose_febio_native_run.mjs`

### INC-011: FEBio logfile node rows use compact internal node ids

Status:

- fixed / guardrail active

Discovered in:

- S8-N pressure-load response instrumentation

Symptom:

- The generated `.feb` declares `<NodeSet name="pipette_suction_nodes">46,47,50,51</NodeSet>`.
- The logfile request uses `node_set="pipette_suction_nodes"`.
- FEBio writes `38,39,42,43` to `febio_pipette_suction_nodes.csv` instead of `46,47,50,51`.

Cause:

- FEBio logfile node rows use compact internal node ordinals based on the order of `<Nodes>`, not the exported node ids.
- The native mesh has missing id ranges, so native node ids `46,47,50,51` become compact logfile row ids `38,39,42,43`.

Impact:

- Any diagnostic that matches logfile node rows directly to native node ids can silently read the wrong nodes when mesh ids have gaps.
- Pressure-load response could be partial or wrong unless row ids are remapped back to native mesh node ids.

Fix or mitigation:

- `pressureLoadResponse` builds a compact-id to native-id map from `geometry.mesh.nodes` order.
- Final node displacement rows are stored with both remapped `id` and raw FEBio `rawId`.
- S8-M now reports all four suction-surface native node ids observed after remapping.

Regression guard:

- When adding a dedicated logfile NodeSet, verify the row ids in the generated CSV against the exported `<NodeSet>`.
- Do not compare logfile node row ids directly to native mesh node ids without compact-id remapping.

References:

- `src/febio/native/outputs.ts`
- `src/febio/native/runDiagnostics.ts`
- `febio_exports/S8_pipette_nucleus_pressure_return/S8-M_S8_pipette_nucleus_pressure_return.feb`
- `febio_exports/S8_pipette_nucleus_pressure_return/febio_pipette_suction_nodes.csv`

### INC-012: Manifest conversion must hydrate native model for native diagnostics

Status:

- fixed / guardrail active

Discovered in:

- S8-P converted result integration

Symptom:

- Converting an S8-M export using the manifest successfully produced `suctionPressureResponse`.
- The converted result initially lost `nativeSpec` and used a canonical `pdig_*` digest instead of the native `fdig_*` digest.

Cause:

- The manifest points to `files.nativeModel`, but `convert_febio_output.mjs` treated the manifest itself as the full input payload.
- Native diagnostics could read `files.nativeModel`, while the main conversion path did not hydrate the native model/spec before building the normalized result.

Impact:

- A physically native FEBio run could look like a canonical parameter conversion in downstream metadata.
- Digest/provenance checks could become misleading even when the solver artifacts were native-only.

Fix or mitigation:

- Manifest-based conversion now loads `files.nativeModel` and hydrates `nativeModel`, `nativeSpec`, `effectiveNativeSpec`, `templateData`, and `parameterDigest`.
- S8-M converted result preserves `nativeSpec=true` and `parameterDigest=fdig_598cde20`.

Regression guard:

- When converting from a manifest, verify that native outputs preserve the native spec and `fdig_*` digest.
- Do not use the manifest alone as a substitute for the native model payload when building normalized results.

References:

- `scripts/convert_febio_output.mjs`
- `febio_exports/S8_pipette_nucleus_pressure_return/S8-M_S8_pipette_nucleus_pressure_return_manifest.json`
- `febio_exports/S8_pipette_nucleus_pressure_return/S8-M_S8_pipette_nucleus_pressure_return_result.json`

### INC-013: Nucleus-pressure response is capture evidence, not direct contact capture

Status:

- fixed / guardrail active

Discovered in:

- S8-Q detachment / capture interpretation

Symptom:

- S8-M can show warning-free nucleus-side suction pressure response while direct pipette contact pressure, rigid reaction, and pipette plotfile contact-force outputs remain zero.
- Classification previously treated `captureEstablished=false` as `missed_target`, which could mislabel a pressure-driven target response as no capture.

Cause:

- The classification gate reused a direct-contact capture flag for all capture evidence.
- Pressure-load displacement response was added later as `suctionPressureResponse`, but the capture classification did not yet consume it.

Impact:

- A valid nucleus-pressure run could be rejected for lacking direct contact output.
- The interpretation could drift back toward the S8-G/L outer-cell bridge because that geometry activates easier direct contact-output channels.

Fix or mitigation:

- Classification now treats active `suctionPressureResponse` / normal displacement response as pressure-driven capture evidence.
- Converted results add `captureEvidence` with separate `directContactCapture` and `pressureDrivenSuctionResponse` fields.
- `captureEstablished` and `captureMaintained` remain direct contact / rigid reaction evidence rather than a blended pressure-response flag.

Regression guard:

- Do not classify nucleus-pressure response as `missed_target` or `insufficient_hold` solely because direct contact reaction is zero.
- Keep pressure response, contact pressure, rigid reaction, pipette plotfile force, and cell-dish support/gap gates separate.

References:

- `src/results/classification.ts`
- `scripts/convert_febio_output.mjs`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`

### INC-014: Export manifests must survive cross-machine path changes

Status:

- fixed / guardrail active

Discovered in:

- S8-R converted-result review gate

Symptom:

- The S8-M export manifest was present in the repository, but its `files.nativeModel` and expected artifact paths pointed to an absolute path from the original export machine.
- On a different checkout, manifest hydration could miss the adjacent native model even when the file existed next to the manifest.

Cause:

- The converter trusted manifest absolute paths before considering the manifest/run directory as the portable artifact root.

Impact:

- Converted-result review could lose the native model/spec/digest or fail to locate adjacent artifacts after a clone, pull, or machine transfer.
- A missing result artifact could be confused with a native-model hydration failure.

Fix or mitigation:

- `convert_febio_output.mjs` now resolves manifest artifact paths by checking the stored path first, then checking for the same basename next to the manifest or run directory.
- Native run diagnostics can reuse the hydrated native model object when the manifest path is stale.

Regression guard:

- Treat manifest paths as hints, not portable truth.
- When reviewing exported artifacts, distinguish missing solver outputs from stale absolute metadata paths.

References:

- `scripts/convert_febio_output.mjs`
- `febio_exports/S8_pipette_nucleus_pressure_return/S8-M_S8_pipette_nucleus_pressure_return_manifest.json`

### INC-015: Global cell-dish plotfile fan-out must not become local detachment classification

Status:

- fixed / guardrail active

Discovered in:

- S8-S local converted-result review

Symptom:

- The regenerated S8-M result initially classified as direct cell-dish failure after conversion because global `.xplt` cell-dish contact force was fanned out to all localCd regions.
- The same data is valid support/gap evidence, but it is not region-resolved local damage evidence.

Cause:

- `native-plotfile-contact-traction` global fan-out populated localCd damage and first-failure fields.
- Classification treated those localCd damage and first-failure fields like region-resolved detachment evidence.

Impact:

- S8-M could be reported as `cell_attached_to_tip` even though the meaningful S8 signal is nucleus-side pressure response with direct pipette contact outputs zero.
- A global support-force bridge could override the pressure-response interpretation.

Fix or mitigation:

- Classification now ignores localCd first-failure and damage evidence whose source detail is global fan-out.
- Converter no longer emits `cdDamageStart` from fan-out localCd failures.
- Converted detachment area metrics ignore unobserved proxy `contactFraction=0` defaults.

Regression guard:

- Use global fan-out `.xplt` contact force for support/force evidence, not for region-resolved detachment classification.
- If region-resolved localCd damage is needed, require non-fan-out source details or native face/contact data that identifies the region.

References:

- `src/results/classification.ts`
- `scripts/convert_febio_output.mjs`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`

### INC-016: Shared-node NC coupling has no native contact failure output

Status:

- diagnosed / instrumentation target identified

Discovered in:

- S8-U native NC interface evidence review

Symptom:

- S8-M can report pressure-driven suction response and proxy-displacement detachment, but `detachmentEvidence.nativeNcInterfaceFailure.active=false`.
- No `febio_interface_nc_*.csv` or localNc plotfile contact-traction artifact exists in the S8-M run output.

Cause:

- The native nucleus-cytoplasm interface is modeled as `conformal-shared-node` force transfer with `solverActive=false`.
- The generated `.feb` omits the `nucleus_cytoplasm_interface` contact.
- `buildSolverFacingLogOutputs` intentionally filters solver-facing face-data logs to cell-dish and pipette surfaces, and clears `plotfileSurfaceData`.

Impact:

- Existing S8-M artifacts cannot prove native nucleus-cytoplasm interface failure.
- A `nucleus_detached` classification must be source-qualified as proxy displacement unless a new native NC evidence channel is added.

Fix or mitigation:

- Converted results now include `nativeNcInterfaceEvidence` and `detachmentEvidence.nativeNcInterfaceFailure.unavailableReason`.
- The next instrumentation should use a channel compatible with shared-node coupling, such as named NC region node-pair relative displacement / strain, or an explicit solver-active cohesive/contact comparison case.

Regression guard:

- Do not interpret missing native NC failure as a pressure-geometry failure.
- Do not move suction back to the outer-cell diagnostic bridge to obtain easier contact outputs.
- Always report whether native NC interface failure evidence is unavailable by output contract or inactive by measured solver result.

References:

- `src/febio/native/model.ts`
- `src/febio/native/xml.ts`
- `scripts/convert_febio_output.mjs`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`

### INC-017: Shared-node NC evidence is continuity, not failure

Status:

- diagnosed / guardrail active

Discovered in:

- S8-V shared-node NC evidence instrumentation

Symptom:

- After adding NC region node-data logs and rerunning S8-M, `sharedNodeNcEvidence.available=true`.
- The converted result reports `observedNodeCount=16`, max shared displacement `3.1480948892317233 um`, and max relative normal/shear displacement `0`.
- `nativeNcInterfaceEvidence.available=false` still remains true.

Cause:

- The NC interface is conformal shared-node coupling. The nucleus and cytoplasm region node sets reference the same physical nodes at the interface.
- Node-data output can observe shared displacement continuity, but it cannot create a contact gap, contact pressure, cohesive damage, or solver-active interface failure signal.

Impact:

- S8-M now has a useful shared-node-compatible NC observation channel.
- That channel confirms the model is moving through shared NC nodes; it does not prove native NC detachment/failure.
- A solver-active cohesive/contact comparison remains the required path if native NC failure evidence is needed.

Fix or mitigation:

- Keep `sharedNodeNcEvidence` separate from `nativeNcInterfaceEvidence`.
- Keep `detachmentEvidence.sharedNodeNcObservation` separate from `detachmentEvidence.nativeNcInterfaceFailure`.
- Preserve S8-M as the warning-free nucleus-pressure shared-node baseline.

Regression guard:

- Do not promote shared-node displacement continuity to native NC failure.
- Do not use zero relative displacement across shared nodes to deny pressure-driven motion; use it only to describe the NC coupling mode.
- Any future native NC failure claim must come from an explicit failure-capable output channel.

References:

- `src/febio/native/outputs.ts`
- `scripts/convert_febio_output.mjs`
- `src/results/classification.ts`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`

### INC-018: Solver-active NC comparison shows inactive failure under current load

Status:

- diagnosed / next isolation axis identified

Discovered in:

- S8-W solver-active NC failure comparison

Symptom:

- S8-M could only report shared-node continuity and proxy-displacement detachment.
- S8-W enabled solver-active NC comparison outputs on the same nucleus-pressure geometry.
- The run emitted NC face-data CSVs and localNc plotfile surfaces, but native NC failure stayed inactive.

Cause:

- Missing native NC failure evidence in S8-M was an output-contract issue.
- Once S8-W makes NC output available, the measured solver result is still intact NC contact: NC damage `0`, native gap `0`, contact fraction `1`, first NC failure absent.
- The current `-0.7 kPa` nucleus-side suction and S8-M thresholds move the nucleus/cytoplasm but do not exceed the NC failure criteria.

Impact:

- `nucleus_detached` in S8-W remains proxy-displacement derived, not native NC failure derived.
- The next useful work is load/threshold isolation, not more output plumbing for this evidence path.

Fix or mitigation:

- Keep S8-M as the warning-free shared-node baseline.
- Keep S8-W as the solver-active NC evidence comparison.
- Run bounded S8-X comparisons on pressure magnitude or NC failure thresholds to identify the activation boundary.

Regression guard:

- Do not treat `nativeNcInterfaceEvidence.available=true` as failure by itself.
- A native NC failure claim requires `nativeNcInterfaceFailure.active=true`, nonzero NC damage, or a first failure site in `nc:*`.
- Continue reporting proxy displacement separately from native NC failure.

References:

- `febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json`
- `src/febio/native/interfaces.ts`
- `src/febio/native/model.ts`
- `src/febio/native/xml.ts`
- `scripts/convert_febio_output.mjs`

### INC-019: Shared-node NC contact has no relative failure kinematics

Status:

- resolved / activation path proven

Discovered in:

- S8-X/Y separated-node NC comparison

Symptom:

- S8-W emitted native NC face/plotfile outputs but native NC failure remained inactive.
- NC pressure/gap damage was zero and NC plotfile forces were numerical noise.

Cause:

- S8-W still used conformal/shared NC node ids at the nucleus-cytoplasm interface.
- Solver-active contact output can exist on that geometry, but the coincident shared nodes do not provide meaningful relative NC opening/shear kinematics.
- A separated-contact comparison needs duplicated cytoplasm-side NC nodes.

Impact:

- S8-M remains the physical shared-node baseline.
- A failure-capable NC comparison must use separated NC interface nodes or another explicit relative-kinematics mechanism.

Fix or mitigation:

- S8-X added `meshCouplingMode="separated-contact"` and duplicated cytoplasm-side NC nodes.
- S8-X at `-0.7 kPa` created relative NC motion but stayed below failure thresholds.
- S8-Y at `-3.5 kPa` activated native NC failure: `damage.nc=1`, `firstFailureSite="nc:right"`, and `nativeNcInterfaceFailure.active=true`.
- S8-Z limited solver-active separated NC comparison contacts to valid left/right element faces. Top/bottom NC regions remain node-data/proxy observations.
- After S8-Z, S8-X reaches warning-free normal termination, and S8-Y preserves native NC failure activation without invalid-facet or no-contact-pair setup warnings.

Regression guard:

- Do not interpret solver-active NC output on shared-node geometry as failure-capable unless relative interface kinematics are present.
- Keep S8-Y as a high-pressure diagnostic bound, not a replacement for S8-M.
- Do not re-enable top/bottom solver-active separated NC contacts unless the mesh exposes valid top/bottom element faces.
- Native-first failure ordering must prefer native face-data NC sites over earlier proxy-only top/bottom displacement thresholds.

References:

- `febio_cases/native/S8_pipette_nucleus_nc_separated_failure.native.json`
- `febio_cases/native/S8_pipette_nucleus_nc_separated_failure_high_pressure.native.json`
- `src/febio/native/mesh.ts`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`

### INC-020: Proxy-only NC damage must not activate native NC failure

Status:

- fixed / regression-covered

Discovered in:

- S9-A pressure-boundary scan

Symptom:

- S9-A at `-1.4 kPa` reached warning-free normal termination.
- Native left/right face-data damage was zero, but proxy-only bottom NC damage reached the normalized `damage.nc` summary.
- `detachmentEvidence.nativeNcInterfaceFailure.active` was incorrectly true before the fix because the native failure gate read the global NC damage summary.

Cause:

- `buildDetachmentEvidence` used max NC damage across all local NC regions.
- That summary included proxy-only top/bottom displacement-derived damage from regions that are not solver-active NC contact faces after S8-Z cleanup.
- Native output availability and native failure activation were therefore conflated.

Impact:

- S9-A could be misread as native NC interface failure even though the native face-data regions were below the failure gate.
- The pressure boundary would be reported too low if proxy-only damage were allowed to activate native failure.

Fix or mitigation:

- Native NC failure activation now uses only NC regions with native provenance or native source labels.
- Proxy-only NC damage can remain in normalized summaries and first-failure diagnostics, but `nativeNcInterfaceFailure.damage` and `.active` ignore it.
- Added a regression test for proxy-only NC damage with native output availability.

Regression guard:

- Do not use `result.damage.nc` alone as proof of native NC failure.
- A native NC failure claim requires native face-data/source-labeled damage crossing the detachment-start threshold.
- Keep S9-A and S9-D as below-threshold/partial-damage boundary points, not as native detachment evidence.

References:

- `src/results/classification.ts`
- `tests/febio-front-end.test.mjs`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`

### INC-008: Pipette stiffness warning is not fixed by timestep-only refinement

Status:

- diagnosed / guardrail active

Discovered in:

- S8-K direct pipette stabilization comparison

Symptom:

- S8-G/H restored direct pipette-cell pressure, rigid reaction, and pipette plotfile-force channels, but retained stiffness-reformation warning blocks.
- S8-K refined `manipulation-1` from 90 to 360 steps and `manipulation-2` from 1 to 90 steps while preserving S8-H geometry, pressure, motion amplitude, and pipette-cell penalty.
- The run still reached normal termination and preserved direct force channels, but stiffness-reformation warnings increased to seven.

Cause:

- The warning is not explained by the coarse manipulation timestep size alone.
- The warning remains tied to the inward manipulation onset / controller behavior around the `t ~= 3.01-3.06` window, or to contact state changes triggered there, rather than to simple output geometry or pressure-channel absence.

Impact:

- More substep-only refinement can increase runtime and warning count without improving physical interpretability.
- A warning-free direct pipette baseline should not be pursued by repeatedly increasing `time_steps` while leaving the same controller onset intact.

Fix or mitigation:

- Keep the S8-G/H/K outer-cell direct-force geometry when testing stabilization.
- Prefer the next bounded comparison on inward controller/ramp onset shape, step boundary placement, or a solver-control setting with a concrete warning-window hypothesis.
- Superseded by the later nucleus-pressure clarification for mainline planning: outer-cell stabilization remains diagnostic only.

Regression guard:

- Do not treat `time_steps` increases as a default stabilization fix for the S8 outer-cell pipette case.
- Every stabilization comparison must report warning count, direct pipette force gates, cell-dish support/gap gates, and whether the outer-cell direct-force path is preserved.

References:

- `febio_cases/native/S8_pipette_outer_cell_surface_fine_inward.native.json`
- `febio_exports/S8_pipette_outer_cell_surface_fine_inward/S8-K_S8_pipette_outer_cell_surface_fine_inward.log`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `scripts/diagnose_febio_native_run.mjs`

### INC-009: Delayed inward ramp does not remove pipette stiffness warning

Status:

- diagnosed / next isolation axis identified

Discovered in:

- S8-L inward ramp onset comparison

Symptom:

- S8-L delayed the inward controller from `t=3.0` to `t=3.2` while preserving S8-H geometry, pressure, motion amplitude, and pipette-cell penalty.
- The run reached normal termination and preserved direct pipette force channels.
- Stiffness-reformation warnings remained, with four warning blocks at about `t=3.05559`, `3.06671`, `3.07782`, and `3.08893`.

Cause:

- The warning starts before the delayed inward ramp begins.
- Immediate inward displacement amplitude is therefore not the direct cause.
- The remaining trigger is more likely the `manipulation-1` step boundary itself, such as activating the x-prescribed rigid boundary with a zero controller value or re-declaring step loads/contact state at the transition.

Impact:

- Delaying or reshaping the inward load curve alone can preserve force channels but does not solve stabilization.
- The next comparison should isolate the step-boundary activation path instead of continuing to move the inward-ramp onset.
- Because the target physical model is nucleus-side pressure, this outer-cell step-boundary result should guide diagnostics but not remain the mainline physical path.

Fix or mitigation:

- Keep the S8-G/H/K/L outer-cell direct-force geometry.
- Compare a boundary-activation case that enters `manipulation-1` without adding the x-prescribed rigid boundary, or with an explicit zero-motion transition step, before changing force amplitude again.
- For mainline model work, return to nucleus-side pressure first and use this result only to interpret transition warnings if they recur.

Regression guard:

- When a controller is delayed, compare warning times against the controller's first nonzero point before attributing warnings to the ramp value.
- Every stabilization comparison must report whether warnings occur before, during, or after the changed controller interval.

References:

- `febio_cases/native/S8_pipette_outer_cell_surface_delayed_inward.native.json`
- `febio_exports/S8_pipette_outer_cell_surface_delayed_inward/S8-L_S8_pipette_outer_cell_surface_delayed_inward.log`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `scripts/diagnose_febio_native_run.mjs`
