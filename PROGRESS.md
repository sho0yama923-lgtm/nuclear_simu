# FEBio Progress

Last updated: 2026-04-29

`PROGRESS.md` is the current-state file. Historical detail is retired when a milestone completes or when the active milestone changes. Durable lessons stay here or move to dedicated docs.

## Current summary

- Goal: make the FEBio solver condition physically meaningful enough to evaluate nucleus detachment from cytoplasm through solver-active outputs.
- Active solver work uses the native-only path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`.
- Legacy UI / canonical / bridge paths are compatibility-only and must not be used for new solver behavior.
- S7-E geometry convention is fixed. `pipette_suction_surface` is deformable-side, normal `-x`, and negative pressure pulls toward `+x`.
- S7-J changed nucleus-cytoplasm force transfer from solver contact to shared-node coupling.
- Active milestone: S8-A. S7 is complete by diagnostic closure. S8 starts with pipette coupling / suction force capture, beginning from pre-run geometry diagnostics rather than a contact-law rewrite.
- Current roadmap context: simulation condition advancement / solver-native load/contact activation / pressure/contact load / solver-native pipette coupling. Stage S6 completed, S7 began with Milestone S7-A to make FEBio-native spec JSON the active handoff and completed with diagnostic residuals, and S8 starts from the inactive pipette force channels.

## Important retained findings

- Active FEBio export and validation use only the native-only path.
- Do not weaken the S7-E pressure / orientation convention to make cell-dish pass.
- Solver-facing `.feb` should emit only active solver mesh items. Diagnostic-only selections stay in native model JSON.
- FEBioStudio can create unstable internal `nodesetNN` references when logfile node data uses inline node ids. Use explicit NodeSets and `node_set` references.
- FEBio logfile rows can be whitespace-delimited even when XML requests comma delimiter. Parsers must be comma / whitespace tolerant.
- `cellDishLoadBearing=false` in older diagnostics mainly means face-data contact pressure is zero. It does not prove that cell-dish force is absent.
- S7-K shows nonzero `.xplt` contact force on the cell-dish pair and improved gap control, but weak dish-normal support and zero face-data pressure.
- Cell-dish load-bearing must be evaluated as pressure, plotfile force, normal support, tangential force, and gap control.

## Active milestone: S8-A Pipette Coupling Geometry Diagnostic

### Current facts

- `cell_dish_interface` is solver-active.
- Initial cell-dish normal gap is 0 and left / center / right normals are opposed.
- S7-K baseline FEBio CLI run is warning-free normal termination.
- `normalStiffness=15.5` reduced final max cell-dish gap to about `0.0566542533992 um`.
- Logfile face-data contact pressure remains 0.
- Studio / `.xplt` contact force is nonzero on the cell-dish pair.
- `.xplt` surface item map identifies `itemId=1` as `cell_dish_surface` and `itemId=2` as `dish_contact_surface`.
- Current split gates on `S7-K_S7_native_baseline`: `warningFree=true`, `cellDishPressureActive=false`, `cellDishContactForceActive=true`, `cellDishNormalSupportActive=false`, `cellDishTangentialForceActive=true`, `cellDishPressureForceMismatch=true`, `cellDishGapControlled=true`, `nucleusCytoplasmMoved=true`.
- Contact force is mostly horizontal / shear; `.xplt` max tangential force is about `25.5978221893`, max normal force is about `1.7637732029`, and `normalToTangentialRatio=0.0689032524`, below the current `0.2` normal-support threshold.
- S7-L adds optional `loads.cellDishNormalPreload` and a comparison case at `febio_cases/native/S7_normal_preload.native.json`.
- S7-L normal preload uses `0.05 kPa` positive pressure on `cell_dish_surface`, with active output under `febio_exports/S7_normal_preload/`.
- S7-L FEBio CLI run reaches normal termination with no solver warnings, errors, negative jacobian, no-force, or no-contact-pair diagnostics.
- S7-L split gates: `warningFree=true`, `cellDishPressureActive=false`, `cellDishContactForceActive=true`, `cellDishNormalSupportActive=false`, `cellDishTangentialForceActive=true`, `cellDishPressureForceMismatch=true`, `cellDishGapControlled=true`, `nucleusCytoplasmMoved=true`.
- S7-L max cell-dish normal force rises to about `3.6499471664`, max tangential force is about `25.6380748749`, and `normalToTangentialRatio=0.1423643228`. This improves normal support relative to S7-K but remains below the `0.2` threshold.
- S7-L final max cell-dish gap is about `0.0596412458 um`, still controlled but slightly worse than S7-K.
- S7-M adds `febio_cases/native/S7_normal_preload_high.native.json` with `0.10 kPa` positive pressure on `cell_dish_surface`, with active output under `febio_exports/S7_normal_preload_high/`.
- S7-M FEBio CLI run reaches normal termination with no solver warnings, errors, negative jacobian, no-force, or no-contact-pair diagnostics.
- S7-M split gates: `warningFree=true`, `cellDishPressureActive=false`, `cellDishContactForceActive=true`, `cellDishNormalSupportActive=true`, `cellDishTangentialForceActive=true`, `cellDishPressureForceMismatch=true`, `cellDishGapControlled=true`, `nucleusCytoplasmMoved=true`.
- S7-M max normal force is about `8.8468484879`, max tangential force is about `25.6783313751`, and `normalToTangentialRatio=0.3445258323`, above the `0.2` normal-support threshold.
- S7-M final max cell-dish gap is about `0.0641880121 um`, still controlled.
- S7-N extends `scripts/convert_febio_output.mjs` so localCd face pressure `0` can fall back to standard plotfile bridge normal traction.
- S7-N preserves `sourceNormal=sourceDamage=native-plotfile-contact-traction` in localCd when plotfile normal traction supplies the normal observation.
- S7-N updates `normalizeFebioResult()` so `native-plotfile-contact-traction` remains a native observation source instead of being treated as proxy / unavailable.
- Tests now cover plotfile normal bridge reading, localCd pressure-zero fallback, and import preservation of plotfile normal source.
- S7-O adds a minimal real `.xplt` bridge inside `scripts/convert_febio_output.mjs`.
- The converter now reads `cell_dish_surface` contact-force rows from `S7-M_S7_normal_preload_high.xplt`, maps them into a global `localCd.__global` bridge, and fans that bridge out to localCd left / center / right when region-split plotfile force is unavailable.
- The converted S7-M result at `febio_exports/S7_normal_preload_high/S7-M_S7_normal_preload_high_result.json` carries `sourceNormal=sourceDamage=sourceShear=native-plotfile-contact-traction` for all localCd regions.
- The converted S7-M result reports `peakCdNormal=8.846848487854004` and `peakCdShear=25.67833137512207`.
- S7-P adds source-detail metadata for plotfile contact traction: `regionScope=global`, `payloadRegion=__global`, `spatialResolution=global-surface`, and `fanoutFallback=true`.
- S7-P preserves that source-detail metadata in final localCd state, history localCd entries, `interfaceObservation`, `resultProvenance.interfaceObservation`, and import-normalized localCd state.
- S7-Q splits the pipette interaction gate into pressure, rigid reaction, and plotfile force channels.
- On S7-M, pipette split gates are all inactive: `pipetteCellPressureActive=false`, `pipetteMouthPressureActive=false`, `pipetteRigidReactionActive=false`, `pipetteSuctionPlotfileForceActive=false`, `pipetteMouthPlotfileForceActive=false`, `pipettePlotfileForceActive=false`, `pipetteInteractionActive=false`.
- S8-A adds pre-run pipette coupling readiness diagnostics to mesh validation.
- On S7-M/S8-A geometry, `pipette_suction_surface` and `pipette_contact_surface` have matching `-x` normals and `normalGapMagnitude=0`, but their centroids are tangentially offset by `8.5 um` in `z`.
- `pressureDiagnostics.couplingReadiness.ready=false` because `tangentialOffsetMagnitude=8.5` exceeds the current `0.1 um` readiness threshold.

### Current interpretation

Cell-dish is no longer simply missing. Contact force, gap control, and dish-normal support are present at `0.10 kPa` preload. Downstream localCd now carries plotfile normal traction from the real `.xplt` output, even though face-data pressure remains zero. The current bridge is explicitly marked as global fan-out, so it cannot be mistaken for region-resolved localCd force.

S7 is complete as a diagnostic stage. It does not claim the physical detachment model is complete. S8-A identifies a concrete pre-run geometry blocker for pipette/cell force capture: the pressure surface and rigid mouth surface are normal-aligned but not tangentially colocated, so declared suction pressure can coexist with zero contact/reaction output.

### Next bounded task

- S8-B: choose the smallest geometry/coupling change that reduces the pipette suction-to-mouth tangential offset while preserving S7-M cell-dish evidence.
- Keep the current S7-M converted result as the cell-dish evidence baseline.
- Preserve S7-M `0.10 kPa` as the current normal-support candidate.
- Do not change cell-dish contact law until pipette interaction is active or deliberately deferred.

### Done condition

- Current run is explainable through the split gates above.
- warning-free CLI run is preserved.
- Studio handoff assumptions are preserved.
- The next model-side change is selected from the diagnosed evidence.

## Files to open next

- `src/febio/native/runDiagnostics.ts`
- `src/febio/native/xpltDiagnostics.ts`
- `src/febio/native/caseSpec.ts`
- `src/febio/native/model.ts`
- `scripts/convert_febio_output.mjs`
- `src/febio/import/normalizeFebioResult.ts`
- `scripts/diagnose_febio_native_run.mjs`
- `febio_cases/native/S7_normal_preload.native.json`
- `febio_cases/native/S7_normal_preload_high.native.json`
- `febio_exports/S7_native_baseline/S7-K_S7_native_baseline_native_model.json`
- `febio_exports/S7_native_baseline/jobs/S7-K_S7_native_baseline.log`
- `febio_exports/S7_native_baseline/jobs/S7-K_S7_native_baseline.xplt`
- `febio_exports/S7_normal_preload/S7-L_S7_normal_preload.log`
- `febio_exports/S7_normal_preload/S7-L_S7_normal_preload.xplt`
- `febio_exports/S7_normal_preload_high/S7-M_S7_normal_preload_high.log`
- `febio_exports/S7_normal_preload_high/S7-M_S7_normal_preload_high.xplt`
- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`
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
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`
- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`

## Completed milestone summary

- S7-A/B/C: established direct native-spec handoff and pressure/contact response scope; old artifacts live under `legacy/febio_exports/`.
- S7-D: added native-only FEBio export path and regression tests against UI/canonical/legacy adapter usage.
- S7-E: fixed coordinate, surface normal, pressure sign, and contact pair convention.
- S7-F: fixed refinement strategy: evolve the active native baseline, not a parallel refined case.
- S7-G/H: split dish top into left / center / right bands and restored warning-free solver-active cell-dish contact.
- S7-I: found cell-dish pressure output remained zero and force transfer to cell body was weak.
- S7-J: switched nucleus-cytoplasm to shared-node coupling and made cytoplasm displacement nonzero.
- S7-K: cleaned Studio handoff, added explicit NodeSet logfile output, `.xplt` contact-force parsing with normal/tangential projection, delimiter-tolerant CSV parsing, and split cell-dish gates.
- S7-L so far: added optional `cellDishNormalPreload`, exported and ran `S7-L_S7_normal_preload`, and found normal/tangential ratio improved from about `0.0689` to `0.1424` while pressure remained zero and normal support stayed below threshold.
- S7-M so far: exported and ran `S7-M_S7_normal_preload_high`; `0.10 kPa` preload reaches `cellDishNormalSupportActive=true` with warning-free termination and controlled gap, while pressure remains zero.
- S7-N: converter/import preserve `native-plotfile-contact-traction` as localCd normal/damage source when face pressure is zero and a plotfile bridge entry supplies normal traction.
- S7-O: converter reads real `.xplt` cell-dish contact force into a global localCd bridge; the converted S7-M result now carries `native-plotfile-contact-traction` for localCd normal/damage/shear.
- S7-P: converted result and import state now preserve plotfile source details that distinguish global cell-dish fan-out from future region-resolved localCd force.
- S7-Q: pipette diagnostics now split pressure, rigid reaction, and plotfile force. S7 ends here as diagnostic-complete, with pipette coupling carried forward as the next model-side blocker.
- S8-A so far: mesh validation now reports pipette coupling readiness; current suction surface and rigid mouth are normal-aligned but tangentially offset by `8.5 um`.
- Historical governance anchors retained for regression tests: implemented-infrastructure / output-contract-complete; unit system `um-nN-s`; old blocker `cell-dish solver-active contact が未復帰` is resolved; load/contact/output 成立後に cohesive / detachment solver validation.

## PROGRESS.md log retirement rule

When a milestone completes or stops being active:

1. Extract durable lessons into `Important retained findings`.
2. Stock every understood major problem cause, prevention rule, or misleading diagnostic pattern in `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`.
3. Move specialized diagnostic rules to dedicated `docs/febio/` documents.
4. Delete transient run logs and scratch observations from `PROGRESS.md`; git history remains the raw archive.
5. Keep completed milestones to 1-3 line summaries.

Major causes must not live only in `PROGRESS.md`. If a failure had a non-obvious cause, could recur, silently corrupted interpretation, or produced a reusable prevention rule, it gets an incident/root-cause entry.

Only the active milestone should keep detailed current facts, interpretation, next task, and done condition.

## Work granularity rule

Do not stop after only adding a placeholder, TODO, helper, or docs note when implementation and tests for the same milestone are clearly still pending. Continue until a done condition, blocker, human confirmation gate, or environment limit is reached.
