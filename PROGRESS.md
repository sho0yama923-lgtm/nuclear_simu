# FEBio Progress

Last updated: 2026-05-01

`PROGRESS.md` is the current-state file. It must not become a run log. Historical detail is retired when a milestone completes or stops being active. Durable lessons stay here only as short retained findings or move to dedicated docs.

## Current summary

- Goal: make the FEBio solver condition physically meaningful enough to evaluate nucleus detachment from cytoplasm through solver-active outputs.
- Active solver work uses the native-only path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`.
- Legacy UI / canonical / bridge paths are compatibility-only and must not be used for new solver behavior.
- S7 is complete by diagnostic closure. S7-M remains the current cell-dish normal-support candidate, with `0.10 kPa` cell-dish normal preload, warning-free termination, controlled gap, and `.xplt`-backed localCd normal traction.
- S8 is focused on the intended nucleus-pressure pipette model. S8-G/L outer-cell cases are diagnostic bridges that prove output channels can become active, not the target physical model.
- Active milestone: S9 Native NC Failure Calibration.

## Important retained findings

- Active FEBio export and validation use only the native-only path.
- Do not weaken the S7-E pressure / orientation convention to make a single comparison pass.
- Solver-facing `.feb` should emit only active solver mesh items. Diagnostic-only selections stay in native model JSON.
- FEBioStudio can create unstable internal `nodesetNN` references when logfile node data uses inline node ids. Use explicit NodeSets and `node_set` references.
- FEBio logfile rows can be whitespace-delimited even when XML requests comma delimiter. Parsers must be comma / whitespace tolerant.
- `cellDishLoadBearing=false` in older diagnostics mainly means face-data contact pressure is zero. It does not prove that cell-dish force is absent.
- Cell-dish load-bearing must be evaluated as pressure, plotfile force, normal support, tangential force, and gap control.
- `native-plotfile-contact-traction` may currently be a global fan-out source for localCd. Do not read it as region-resolved force unless source-detail metadata says so.
- Pipette interaction must be evaluated as declared suction pressure load, direct pipette contact pressure, rigid reaction, and pipette `.xplt` force separately.
- S8-G/H/I/J/K/L show that amplitude-only changes, contact-penalty softening, pressure reduction, timestep-only refinement, and delayed inward-ramp onset do not remove the stiffness-reformation warning while preserving direct pipette force channels.
- The target physical suction model applies pressure to the nucleus-side capture surface. Outer-cell suction surfaces are diagnostic bridges only and must not become the final convention just because their force channels are easier to activate.
- S8-M returned pressure to the nucleus-side capture surface and reached warning-free normal termination with a declared `12.6 nN` suction pressure resultant and nucleus/cytoplasm movement. Direct pipette contact/rigid-reaction output channels remained zero, so the next axis is output instrumentation and interpretation, not moving pressure back to the outer cell.
- S8-N added pressure-load response diagnostics. S8-M now reports `pipetteSuctionPressureResponseActive=true` and `pipetteSuctionNormalDisplacementActive=true` from observed pressure-surface displacement, while direct contact output remains zero.
- S8-O resolved the apparent `pipette_suction_nodes` mismatch: FEBio logfile node rows use compact internal node ordinals, not exported node ids. Diagnostics now remap logfile row ids back to native mesh node ids.
- S8-P carries the four-node nucleus-pressure response into converted result JSON as `suctionPressureResponse`, preserving `nativeSpec` and the native `fdig_*` digest when converting from the export manifest.
- S8-Q keeps direct contact capture separate from pressure-driven capture evidence. Classification no longer treats active nucleus-side pressure response as `missed_target` or `insufficient_hold` solely because direct contact outputs are zero.
- S8-R found the current checkout has the S8-M export bundle but not the FEBio run outputs or converted result JSON. Converter manifest hydration now tolerates stale absolute paths by resolving adjacent artifact basenames.
- S8-S regenerated S8-M run artifacts locally, converted the result JSON, and confirmed pressure-driven capture/response is active while direct pipette contact outputs remain zero. Classification is now `nucleus_detached` from proxy displacement, not direct contact capture or cell-dish fan-out damage.
- S8-T added `detachmentEvidence` so `nucleus_detached` is source-qualified. S8-M is `primarySource="proxy-displacement"` with pressure response active and native NC interface failure inactive.
- S8-U diagnosed native NC evidence absence: S8-M uses conformal shared-node NC force transfer with no solver-active NC contact, and solver-facing outputs omit NC face/plotfile contact data. Existing artifacts cannot prove native NC interface failure.
- S8-V added shared-node-compatible NC region node-data outputs, reran S8-M, and converted `sharedNodeNcEvidence`. S8-M now observes all 16 NC region nodes with max shared displacement `3.1480948892317233 um` and zero relative NC displacement, confirming shared-node continuity while still not proving solver-active NC contact failure.
- S8-W added a solver-active NC comparison case on the S8-M nucleus-pressure geometry. FEBio 4.12.0 reached warning-free normal termination and emitted NC face/plotfile outputs, but native NC failure remained inactive: NC damage `0`, NC gap `0`, native NC face pressure `0`, and NC plotfile contact forces only numerical noise.
- S8-X/Y added separated-node NC comparison cases. S8-X at `-0.7 kPa` is warning-free after S8-Z cleanup and creates relative NC motion while staying below failure thresholds. S8-Y at `-3.5 kPa` activates native NC failure: damage `1`, `firstFailureSite="nc:right"`, `firstFailureMode="normal"`, and `nativeNcInterfaceFailure.active=true`.
- S8-Z resolved the separated-contact invalid facet warnings by emitting solver-active NC comparison contacts only for valid left/right element faces. Top/bottom NC observations remain node-data/proxy diagnostics, not solver-active contact surfaces.
- S9-A/B/C/D/E/F ran a pressure-boundary scan on the cleaned separated-contact comparison. `-1.55 kPa` produces partial native right NC damage `0.23435479253090608` but remains below the detachment-start threshold; `-1.7 kPa` reaches warning-free native NC failure with right-side normal mode.
- Native NC failure evidence now uses native face-data damage only. Proxy-only top/bottom NC damage can still appear in summaries, but it cannot activate `nativeNcInterfaceFailure`.

## Active milestone: S9 Native NC Failure Calibration

### Current facts

- S7-M cell-dish baseline is preserved as the cell-dish evidence point: `cellDishNormalSupportActive=true`, `cellDishGapControlled=true`, `cellDishPressureActive=false`, and localCd can use real `.xplt` contact traction through global fan-out metadata.
- S8-A found the first pipette geometry blocker: suction and mouth surfaces were normal-aligned but tangentially offset by `8.5 um`.
- S8-B removed the tangential offset and made coupling readiness true, but all pipette force channels remained inactive.
- S8-C/D restored rigid pipette reaction through capture-hold contact; S8-D also recovered cell-dish gap control, but direct pipette pressure / plotfile force remained inactive.
- S8-E ruled out simple `pipette_cell_pair` primary/secondary role ordering as the direct pipette-output blocker.
- S8-F confirmed that `pipette_suction_pressure` is declared and nonzero; S8-D/E have `pipetteSuctionPressureLoadActive=true` with resultant `12.6 nN`, while direct contact outputs remain zero.
- S8-G moved suction to a Studio-compatible outer right cell surface and restored direct pipette force channels: direct pressure, rigid reaction, suction/mouth plotfile force, and overall pipette interaction all become active.
- S8-G residual: normal termination with one stiffness-reformation warning and a mode-specific suction-normal convention exception.
- S8-H gentle motion preserves direct pipette force channels but still has one stiffness-reformation warning.
- S8-I soft contact and S8-J low pressure preserve direct force channels but increase warning count to three. Therefore, more amplitude/penalty/pressure reduction is not the next best step.
- S8-K preserved S8-H geometry, pressure, contact penalty, and motion amplitude while refining `manipulation-1` from 90 to 360 steps and `manipulation-2` from 1 to 90 steps. It reached normal termination and preserved direct force channels, but stiffness-reformation warnings increased to seven.
- S8-L preserved S8-H geometry, pressure, contact penalty, and motion amplitude while delaying the inward ramp to `t=3.2`. It reached normal termination and preserved direct force channels, but warnings remained at `t=3.05559-3.08893`, before the delayed inward ramp began.
- User correction: the intended physical model is pressure applied to the nucleus, not outer-cell suction. S8-G/L should therefore be retained as diagnostic evidence about channel activation and Studio-compatible winding, but the active model direction must pivot back to nucleus-side pressure.
- S8-M created the bounded nucleus-pressure return case: `febio_cases/native/S8_pipette_nucleus_pressure_return.native.json`.
- S8-M uses `contacts.pipetteCell.suctionSurfaceMode="nucleus-right"`, keeps `pipetteNucleus.solverActive=false`, applies `-0.7 kPa` to `pipette_suction_surface`, and uses gentle motion `liftZ=1`, `inwardX=0.25`.
- S8-M reached warning-free normal termination. Diagnostics report `pipetteSuctionPressureLoadActive=true`, declared suction resultant `12.6 nN`, `nucleusCytoplasmMoved=true`, `cellDishNormalSupportActive=true`, and `cellDishGapControlled=true`.
- S8-M direct pipette output channels remain inactive: `pipetteCellPressureActive=false`, `pipetteRigidReactionActive=false`, `pipetteSuctionPlotfileForceActive=false`, `pipettePlotfileForceActive=false`, and `pipetteDirectContactOutputActive=false`.
- S8-N added `pressureLoadResponse` diagnostics and `pipetteSuctionPressureResponseActive` / `pipetteSuctionNormalDisplacementActive` gates.
- Re-diagnosed S8-M: `pressureLoadResponse.pipetteSuction.observedNodeCount=2`, `missingNodeIds=[50,51]`, `maxDisplacement=3.134041581678824`, `meanNormalDisplacement=3.08279598677`, and both pressure-response gates are true.
- S8-N also added an explicit `pipette_suction_nodes` NodeSet and logfile request. The generated `.feb` declares `pipette_suction_nodes=46,47,50,51`, while FEBio writes compact row ids `38,39,42,43` to `febio_pipette_suction_nodes.csv`.
- S8-O resolved that mapping: compact row ids `38,39,42,43` map back to native node ids `46,47,50,51` by the order of `<Nodes>`.
- Re-diagnosed S8-M after S8-O: `pressureLoadResponse.pipetteSuction.observedNodeCount=4`, `missingNodeIds=[]`, `maxDisplacement=3.1480948892317233`, `meanNormalDisplacement=2.48161278158`, and both pressure-response gates remain true.
- S8-P added `suctionPressureResponse` to converted FEBio results, sourced from native run diagnostics.
- Re-converted S8-M result JSON: `suctionPressureResponse.active=true`, `normalDisplacementActive=true`, `observedNodeCount=4`, `missingNodeIds=[]`, `maxDisplacement=3.1480948892317233`, `meanNormalDisplacement=2.48161278158`, and data source `native-pressure-load-response`.
- Manifest-based conversion now hydrates `files.nativeModel`, so the converted S8-M result preserves `nativeSpec=true` and `parameterDigest=fdig_598cde20`.
- S8-Q added capture interpretation separation: `captureEstablished` / `captureMaintained` remain direct contact evidence, while `captureEvidence.pressureDrivenSuctionResponse=true` can prevent `missed_target` / `insufficient_hold` classification when nucleus-side pressure response is active.
- S8-R checked the repository artifact state for `febio_exports/S8_pipette_nucleus_pressure_return`: `.feb`, effective native spec, native model, manifest, and README are present; `.log`, `.xplt`, contact CSVs, node CSVs, suction-node CSV, and converted result JSON are missing in this checkout.
- S8-R also fixed converter portability for stale manifest absolute paths: adjacent native model/artifact basenames are now resolved from the manifest or run directory.
- S8-S ran S8-M locally with FEBio 4.12.0 and generated `.log`, `.xplt`, contact CSVs, node CSVs, suction-node CSV, and converted result JSON.
- S8-S converted result: `classification="nucleus_detached"`, `captureEvidence.directContactCapture=false`, `captureEvidence.pressureDrivenSuctionResponse=true`, `suctionPressureResponse.active=true`, `observedNodeCount=4`, `missingNodeIds=[]`, max suction displacement `3.1480948892317233 um`, mean suction-normal displacement `2.48161278158 um`.
- Direct pipette outputs remain zero: pipette-cell pressure, mouth pressure, rigid reaction, suction plotfile force, and mouth plotfile force are inactive.
- Cell-dish `.xplt` support is active and gap remains controlled, but global fan-out contact force is no longer allowed to drive local cell-dish detachment classification.
- S8-T converted result adds `detachmentEvidence`: `primarySource="proxy-displacement"`, `pressureDrivenSuctionResponse.active=true`, `nativeNcInterfaceFailure.active=false`, native NC damage `0`, proxy displacement `2.1886848511725`, and proxy contact area ratio `1`.
- S8-U added `nativeNcInterfaceEvidence`: `available=false`, reason `conformal shared-node force transfer; no solver-active NC contact face data is emitted`, interface type `conformal-shared-node`, solverActive `false`, faceData outputs `[]`, plotfile outputs `[]`.
- S8-V added solver-facing NC region node logs for the shared-node model: `febio_nc_{left,right,top,bottom}_{nucleus,cytoplasm}_nodes.csv`.
- S8-V reran and reconverted S8-M. The result now has `sharedNodeNcEvidence.available=true`, `observedNodeCount=16`, max shared displacement `3.1480948892317233 um`, and max relative normal/shear displacement `0`.
- S8-V confirms the cause rather than overturning it: shared-node NC output can prove displacement continuity, but cannot be interpreted as native contact/cohesive failure.
- S8-W created `febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json`, preserving S8-M nucleus-side pressure geometry while setting `contacts.nucleusCytoplasm.solverActive=true`.
- S8-W export emits solver-active NC contacts, NC face data (`febio_interface_nc_{left,right,top,bottom}.csv`), and localNc plotfile contact traction surfaces.
- S8-W FEBio run reached warning-free normal termination with no errors, no `No contact pairs found`, and no warnings.
- S8-W conversion reports `nativeNcInterfaceEvidence.available=true`, `detachmentEvidence.nativeNcInterfaceFailure.outputAvailable=true`, but `nativeNcInterfaceFailure.active=false`, native NC damage `0`, and `firstFailureSite="none"`.
- S8-W localNc regions have `provenance="native-face-data-preferred"`, `sourceNormal="native-face-pressure"`, `sourceDamage="native-face-gap-pressure"`, contact fraction `1`, gap `0`, and pressure/damage `0`.
- S8-X added `meshCouplingMode="separated-contact"` and duplicates cytoplasm-side NC interface nodes so native NC comparison has relative motion kinematics.
- S8-X at baseline pressure `-0.7 kPa` now reaches warning-free normal termination after S8-Z limits solver-active separated NC contacts to left/right valid faces. It creates relative NC displacement but native NC failure remains inactive.
- S8-Y raised suction pressure to `-3.5 kPa` on the separated-contact mesh. It reaches normal termination without invalid-facet contact setup warnings, but still has stiffness-reformation warnings under the high-pressure diagnostic load.
- S8-Y converted result after S8-Z cleanup: `classification="nucleus_detached"`, `damage.nc=1`, `detachmentEvidence.primarySource="native-nc-interface"`, `nativeNcInterfaceFailure.active=true`, `firstFailureSite="nc:right"`, `firstFailureMode="normal"`, `events.ncDamageStart.time=0.866684`, and `detachmentComplete` present.
- Native-first classification now ignores proxy-only top/bottom NC regions when choosing the representative first NC failure site for separated-contact comparisons with native face-data evidence.
- S9-A/B/C/D/E/F pressure scan:
  - S9-A `-1.4 kPa`: warning-free, native failure inactive, native failure damage `0`, right peak normal `0.7480285272022499`, primary source `proxy-displacement`.
  - S9-D `-1.55 kPa`: warning-free, native failure inactive, native failure damage `0.23435479253090608`, right peak normal `0.8311830866887499`, primary source `proxy-displacement`.
  - S9-E `-1.7 kPa`: warning-free, native failure active, native failure damage `0.6155186249313224`, `firstFailureSite="nc:right"`, right peak normal `0.9144292676850009`.
  - S9-F `-1.85 kPa`: warning-free, native failure active, native failure damage `0.9966432842754073`, `firstFailureSite="nc:right"`, right peak normal `0.997666893285749`.
  - S9-B `-2.1 kPa`: warning-free, native failure active, native failure damage `1`, `firstFailureSite="nc:right"`, `firstFailureMode="normal"`, `events.ncDamageStart.time=2.00002`.
  - S9-C `-2.8 kPa`: warning-free, native failure active, native failure damage `1`, `firstFailureSite="nc:right"`, `firstFailureMode="normal"`, `events.ncDamageStart.time=2.00002`.
  - S8-Y `-3.5 kPa`: native failure active but retains 152 stiffness-reformation warnings, so it is no longer needed as the primary failure-bound evidence.

### Current interpretation

The main target is not "make any pipette-cell force channel active"; it is to make nucleus-side pressure physically meaningful. S8-M now has local run-backed evidence that nucleus-side pressure can be declared, solved warning-free, and produce normal-direction displacement on all suction-surface nodes while the direct pipette contact and rigid-reaction channels stay zero.

S8-U/V resolved why S8-M could not prove native NC failure: the baseline is conformal shared-node and has no failure-capable NC output. S8-W proved output availability on the same shared-node geometry but no failure activation. S8-X/Y proved the remaining condition: failure-capable relative NC kinematics require separated NC interface nodes, and pressure must be high enough to cross the NC criteria. S8-Z removed the invalid-facet setup issue from the separated-contact comparison. S9 found a warning-free native failure transition between `-1.55 kPa` and `-1.7 kPa`. S8-M remains the warning-free physical shared-node baseline.

### Next bounded task

- S9 next: refine or accept the warning-free native NC failure boundary between `-1.55 kPa` partial damage and `-1.7 kPa` active failure; decide whether the physical target should use pressure calibration, NC threshold calibration, or both.
- Preserve S8-M geometry and pressure load. Do not create a new geometry case just to obtain easier direct contact outputs.
- Keep direct contact outputs as separate diagnostics; do not collapse them into pressure-load response or `captureEstablished`.
- Keep S8-Y as a high-pressure diagnostic bound only. Prefer S9-B/S9-C for warning-free native NC failure evidence.
- Treat S8-G/L outer-cell geometry as a diagnostic bridge only; do not stabilize or conventionalize it as the final model.
- Preserve S7-M cell-dish evidence, S8-G/H direct pipette force activation, and S8-Q pressure-driven capture evidence.
- Do not return to primary/secondary role or simple surface colocation unless new evidence contradicts S8-E/S8-B.
- Keep detailed result-level comparison notes in `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`, not in this file.

### Done condition

- S9 identifies a bounded, reproducible native NC failure transition range using separated-contact comparison outputs.
- The comparison preserves S8-M as the warning-free nucleus-pressure shared-node baseline and S8-X as the warning-free separated-contact no-failure baseline.
- The result-level note continues to distinguish pressure response, shared-node continuity, proxy displacement detachment, native NC output availability, native NC failure activation, and high-pressure solver warnings.

## Files to open next

- `febio_cases/native/S8_pipette_outer_cell_surface.native.json`
- `febio_cases/native/S8_pipette_outer_cell_surface_gentle.native.json`
- `febio_cases/native/S8_pipette_outer_cell_surface_fine_inward.native.json`
- `febio_cases/native/S8_pipette_outer_cell_surface_delayed_inward.native.json`
- `febio_cases/native/S8_pipette_nucleus_pressure_return.native.json`
- `febio_cases/native/S8_pipette_capture_hold_gentle.native.json`
- `src/febio/native/caseSpec.ts`
- `src/febio/native/model.ts`
- `src/febio/native/mesh.ts`
- `src/febio/native/xml.ts`
- `src/febio/native/outputs.ts`
- `src/febio/native/runDiagnostics.ts`
- `scripts/export_febio_native_case.mjs`
- `scripts/diagnose_febio_native_run.mjs`
- `scripts/convert_febio_output.mjs`
- `src/results/classification.ts`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`

## Reference docs

- `docs/ops/ROADMAP.md`
- `ACTIVE_FILES.md`
- `docs/febio/FEBIO_PATH_OWNERSHIP.md`
- `docs/febio/FEBIO_NATIVE_SPEC.md`
- `docs/febio/GEOMETRY_CONVENTIONS.md`
- `docs/febio/NATIVE_MODEL_REFINEMENT_STRATEGY.md`
- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`

## Completed milestone summary

- S7-A/B/C: established direct native-spec handoff and pressure/contact response scope; old artifacts live under `legacy/febio_exports/`.
- S7-D: added native-only FEBio export path and regression tests against UI/canonical/legacy adapter usage.
- S7-E: fixed coordinate, surface normal, pressure sign, and contact pair convention.
- S7-F: fixed refinement strategy: evolve the active native baseline, not a parallel refined case.
- S7-G/H: split dish top into left / center / right bands and restored warning-free solver-active cell-dish contact.
- S7-I/J: confirmed weak cell-dish pressure output and switched nucleus-cytoplasm force transfer to shared-node coupling.
- S7-K-M: split cell-dish diagnostics and found `0.10 kPa` normal preload reaches cell-dish normal support with warning-free run and controlled gap, while face-data pressure remains zero.
- S7-N-P: bridged real `.xplt` cell-dish contact force into localCd as `native-plotfile-contact-traction` with global fan-out metadata.
- S7-Q: split pipette diagnostics into pressure, rigid reaction, declared load, and plotfile force channels; S7 closed as diagnostic-complete.
- S8-A/B: found and removed the pipette suction/mouth tangential-offset geometry blocker; force channels remained inactive after colocation.
- S8-C-F: capture-hold restored rigid reaction and declared suction pressure was verified, but direct pipette pressure / plotfile force stayed inactive.
- S8-G: outer-cell suction surface with Studio-compatible winding restored direct pipette pressure, rigid reaction, and pipette plotfile force while preserving cell-dish support; this is diagnostic bridge evidence, not the target physical model.
- S8-H/I/J/K/L: gentle motion, soft contact, low pressure, timestep-only refinement, and delayed inward-ramp onset all preserved outer-cell bridge force channels but did not remove the stiffness-reformation warning.
- S8-M: returned to nucleus-side pressure, reached warning-free normal termination, confirmed declared `12.6 nN` suction pressure and tissue movement, and exposed the remaining direct pipette output zero as an instrumentation/interpretation issue.
- S8-N: added pressure-load response diagnostics and confirmed observed nucleus-side suction normal displacement, while identifying a dedicated NodeSet logfile mapping blocker for the full four-node suction surface.
- S8-O: resolved FEBio logfile compact node-id mapping and confirmed all four suction-surface nodes are observed in `pressureLoadResponse`.
- S8-P: propagated nucleus-pressure response into converted result JSON as `suctionPressureResponse` while preserving native digest/spec from manifest conversion.
- S8-Q: made detachment/capture interpretation pressure-response aware while keeping direct contact capture and pressure-driven capture evidence separate.
- S8-R: reviewed S8-M artifact availability, fixed stale manifest path hydration, and identified missing run outputs/result JSON as the current blocker.
- S8-S: regenerated local S8-M run artifacts, converted the result, kept global cell-dish fan-out out of detachment classification, and confirmed the current converted verdict is pressure-response-backed `nucleus_detached` from proxy displacement.
- S8-T: added `detachmentEvidence` to source-qualify detachment classification; S8-M is proxy-displacement detached with active pressure response and no native NC interface failure evidence.
- S8-U: diagnosed that current S8-M cannot emit native NC contact failure evidence because NC coupling is conformal shared-node and solver-facing outputs exclude NC face/plotfile contact data.

## PROGRESS.md log retirement rule

When a milestone completes or stops being active:

1. Extract durable lessons into `Important retained findings`.
2. Stock every understood major problem cause, prevention rule, or misleading diagnostic pattern in `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`.
3. Move specialized diagnostic rules and comparison details to dedicated `docs/febio/` documents.
4. Delete transient run logs and scratch observations from `PROGRESS.md`; git history remains the raw archive.
5. Keep completed milestones to 1-3 line summaries.

Major causes must not live only in `PROGRESS.md`. If a failure had a non-obvious cause, could recur, silently corrupted interpretation, or produced a reusable prevention rule, it gets an incident/root-cause entry.

Only the active milestone should keep detailed current facts, interpretation, next task, and done condition. Completed milestone summaries must be compressed; do not append long comparison logs to this file.

## Work granularity rule

Do not stop after only adding a placeholder, TODO, helper, or docs note when implementation and tests for the same milestone are clearly still pending. Continue until a done condition, blocker, human confirmation gate, or environment limit is reached.

A normal implementation pass should end at a reviewable boundary: code/spec change plus export/diagnostic/test/docs updates where applicable. Do not split one coherent stabilization comparison into separate micro-commits unless a tool or human confirmation gate blocks completion.
