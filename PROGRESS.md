# FEBio Progress

Last updated: 2026-04-29

`PROGRESS.md` is the current-state file. Historical detail is retired when a milestone completes or when the active milestone changes. Durable lessons stay here or move to dedicated docs.

## Current summary

- Goal: make the FEBio solver condition physically meaningful enough to evaluate nucleus detachment from cytoplasm through solver-active outputs.
- Active solver work uses the native-only path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`.
- Legacy UI / canonical / bridge paths are compatibility-only and must not be used for new solver behavior.
- S7-E geometry convention is fixed. `pipette_suction_surface` is deformable-side, normal `-x`, and negative pressure pulls toward `+x`.
- S7-J changed nucleus-cytoplasm force transfer from solver contact to shared-node coupling.
- Active milestone: S8-K. S7 is complete by diagnostic closure. S8 starts with pipette coupling / suction force capture; S8-G restored direct pipette-cell force channels with a Studio-compatible outer-cell suction surface, but S8-H/S8-I/S8-J show that motion, penalty, and pressure amplitude changes alone do not remove the solver stiffness-reformation warning.
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

## Active milestone: S8-K Direct Pipette Stabilization / Convention Cleanup

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
- S8-B adds `febio_cases/native/S8_pipette_aligned.native.json`, keeping S7-M `0.10 kPa` cell-dish preload while moving the pipette puncture/tip `z` from `8.5` to `17`.
- S8-B exported and ran `S8-B_S8_pipette_aligned` under `febio_exports/S8_pipette_aligned/` with warning-free normal termination.
- In the S8-B native model, `pressureDiagnostics.couplingReadiness.ready=true`, suction and rigid mouth centroids are both `[14, 0, 17]`, `normalGapMagnitude=0`, and `tangentialOffsetMagnitude=0`.
- S8-B preserves the S7-M cell-dish evidence: `cellDishContactForceActive=true`, `cellDishNormalSupportActive=true`, `cellDishGapControlled=true`, max normal force about `8.8468484879`, max tangential force about `25.6783313751`, and `normalToTangentialRatio=0.3445258323`.
- S8-B does not activate pipette force capture: `pipetteCellPressureActive=false`, `pipetteMouthPressureActive=false`, `pipetteRigidReactionActive=false`, `pipetteSuctionPlotfileForceActive=false`, `pipetteMouthPlotfileForceActive=false`, `pipettePlotfileForceActive=false`, and `pipetteInteractionActive=false`.
- S8-C adds `febio_cases/native/S8_pipette_capture_hold.native.json`, starting from S8-B geometry and explicitly setting `contacts.pipetteNucleus.solverActive=true` as a bounded capture-hold comparison.
- S8-C exported and ran `S8-C_S8_pipette_capture_hold` under `febio_exports/S8_pipette_capture_hold/` with warning-free normal termination.
- S8-C restores one pipette interaction channel: `pipetteRigidReactionActive=true`, final rigid reaction is approximately `Fx=-7.8642668328`, `Fz=33.5857591825`, and `maxRigidReaction=33.5857591825`.
- S8-C still does not restore direct pipette pressure or pipette plotfile force: `pipetteCellPressureActive=false`, `pipetteMouthPressureActive=false`, `pipetteSuctionPlotfileForceActive=false`, `pipetteMouthPlotfileForceActive=false`, and `pipettePlotfileForceActive=false`.
- S8-C preserves `cellDishContactForceActive=true` and `cellDishNormalSupportActive=true`, but `cellDishGapControlled=false`; final max cell-dish gap rises to about `0.14864903867 um`.
- S8-D adds `febio_cases/native/S8_pipette_capture_hold_gentle.native.json`, preserving S8-C capture-hold contact and S8-B geometry while reducing pipette motion to `liftZ=2`, `inwardX=1`, and `tangentY=0`.
- S8-D exported and ran `S8-D_S8_pipette_capture_hold_gentle` under `febio_exports/S8_pipette_capture_hold_gentle/` with warning-free normal termination.
- S8-D keeps `pipetteRigidReactionActive=true`, with final rigid reaction approximately `Fx=7.9129367928`, `Fz=10.8173032188`, and `maxRigidReaction=10.8173032188`.
- S8-D recovers `cellDishGapControlled=true`; final max cell-dish gap is about `0.0690802562 um`, with `cellDishNormalSupportActive=true` and `normalToTangentialRatio=1.2048908280`.
- S8-D still does not activate direct pipette pressure or pipette plotfile force: `pipetteCellPressureActive=false`, `pipetteMouthPressureActive=false`, `pipetteSuctionPlotfileForceActive=false`, `pipetteMouthPlotfileForceActive=false`, and `pipettePlotfileForceActive=false`.
- S8-E adds `febio_cases/native/S8_pipette_cell_reversed_pair.native.json`, preserving S8-D motion/capture-hold while setting `contacts.pipetteCell.pairRole="rigid-primary"` so `pipette_cell_pair` serializes as `primary=pipette_contact_surface`, `secondary=pipette_suction_surface`.
- S8-E exported and ran `S8-E_S8_pipette_cell_reversed_pair` under `febio_exports/S8_pipette_cell_reversed_pair/` with warning-free normal termination.
- S8-E matches S8-D diagnostics: `pipetteRigidReactionActive=true`, `cellDishGapControlled=true`, `cellDishNormalSupportActive=true`, and direct pipette pressure / plotfile force remains inactive.
- S8-E result: final rigid reaction is approximately `Fx=7.9129367928`, `Fz=10.8173032188`; final max cell-dish gap is about `0.0690802562 um`; `pipetteCellPressureActive=false` and `pipettePlotfileForceActive=false`.
- S8-F extends native run diagnostics with declared pressure-load resultants from the native model JSON.
- S8-F re-diagnosed S8-D and S8-E with `pressureLoads.available=true`: `pipette_suction_pressure` is declared on `pipette_suction_surface`, value `-0.7 kPa`, surface area `18 um^2`, resultant `12.6 nN`, and `pipetteSuctionPressureLoadActive=true`.
- In the same S8-D/S8-E runs, direct pipette outputs remain inactive: `pipetteDirectContactOutputActive=false`, `pipetteCellPressureActive=false`, `pipetteMouthPressureActive=false`, `pipetteSuctionPlotfileForceActive=false`, `pipetteMouthPlotfileForceActive=false`, and `pipettePlotfileForceActive=false`.
- S8-F keeps `pipetteInteractionActive=true` for S8-D/S8-E because rigid reaction is active, not because direct suction-contact output is active.
- S8-G adds `febio_cases/native/S8_pipette_outer_cell_surface.native.json`, moving the pipette mouth/tip to `x=26` and setting `contacts.pipetteCell.suctionSurfaceMode="cell-outer-right"` so `pipette_suction_surface` uses nodes `[69, 70, 72, 71]` on the outer right cytoplasm surface instead of the duplicated nucleus-right face.
- S8-G adds `surfaceOverlapDiagnostics`; S8-D reports `pipette_suction_surface` overlapping `nucleus_interface_right_surface`, while S8-G reports `pipetteSuctionSeparatedFromNucleusRight=true`.
- The first S8-G Studio import warned that `[69,71,72,70]` had incorrect winding. S8-G now uses Studio-compatible facet winding `[69,70,72,71]`.
- S8-G exported and ran `S8-G_S8_pipette_outer_cell_surface` under `febio_exports/S8_pipette_outer_cell_surface/` with normal termination and converted result JSON.
- S8-G has one solver warning block: `Problem is diverging. Stiffness matrix will now be reformed` at about `t=3.01115`; diagnostics now count this as `warning=1`, so `warningFree=false` even though `normalTermination=1`.
- S8-G preserves declared suction pressure load (`pipetteSuctionPressureLoadActive=true`, resultant `12.6 nN`) and cell-dish support (`cellDishNormalSupportActive=true`, `cellDishGapControlled=true`, final max gap about `0.0211104848 um`).
- S8-G restores direct pipette outputs: `pipetteDirectContactOutputActive=true`, `pipetteCellPressureActive=true`, `pipetteRigidReactionActive=true`, `pipetteSuctionPlotfileForceActive=true`, `pipetteMouthPlotfileForceActive=true`, `pipettePlotfileForceActive=true`, and `pipetteInteractionActive=true`.
- S8-G final pipette values: `maxPressure=1.7858176725`, rigid reaction approximately `Fx=-32.2976727433`, `Fz=-1.67431556344`, and pipette plotfile max force magnitude about `32.3410415232`.
- S8-H adds `febio_cases/native/S8_pipette_outer_cell_surface_gentle.native.json`, keeping the S8-G Studio-compatible outer-cell surface while reducing pipette motion to `liftZ=1` and `inwardX=0.25`.
- S8-H exported and ran `S8-H_S8_pipette_outer_cell_surface_gentle` under `febio_exports/S8_pipette_outer_cell_surface_gentle/` with normal termination and one solver warning block at about `t=3.03337`.
- S8-H preserves direct pipette outputs: `pipetteDirectContactOutputActive=true`, `pipetteCellPressureActive=true`, `pipetteRigidReactionActive=true`, `pipetteSuctionPlotfileForceActive=true`, `pipetteMouthPlotfileForceActive=true`, and `pipettePlotfileForceActive=true`.
- S8-H lowers response magnitude relative to S8-G: `maxPressure=1.42607752858`, max rigid reaction about `25.6249355634`, final max cell-dish gap about `0.0127162355 um`, and `cellDishNormalSupportActive=true`.
- S8-I adds `febio_cases/native/S8_pipette_outer_cell_surface_soft_contact.native.json`, preserving S8-H geometry/motion/pressure but setting `contacts.pipetteCell.penaltyScale=0.25`.
- S8-I exported and ran `S8-I_S8_pipette_outer_cell_surface_soft_contact` under `febio_exports/S8_pipette_outer_cell_surface_soft_contact/` with normal termination but three solver warning blocks.
- S8-I preserves direct pipette outputs while lowering magnitude: `maxPressure=1.1880290985`, max rigid reaction about `21.1120721884`, final max cell-dish gap about `0.0181850985 um`, and `cellDishNormalSupportActive=true`. Penalty softening is therefore not the stabilization fix.
- S8-J adds `febio_cases/native/S8_pipette_outer_cell_surface_low_pressure.native.json`, preserving S8-H geometry/motion/default penalty while lowering suction pressure to `-0.35 kPa`.
- S8-J exported and ran `S8-J_S8_pipette_outer_cell_surface_low_pressure` under `febio_exports/S8_pipette_outer_cell_surface_low_pressure/` with normal termination but three solver warning blocks at about `t=3.01115`, `t=3.03337`, and `t=3.05559`.
- S8-J preserves direct pipette outputs: `pipetteDirectContactOutputActive=true`, `pipetteCellPressureActive=true`, `pipetteRigidReactionActive=true`, `pipetteSuctionPlotfileForceActive=true`, `pipetteMouthPlotfileForceActive=true`, and `pipettePlotfileForceActive=true`.
- S8-J values: declared suction resultant `6.3 nN`, `maxPressure=0.772434447697`, max rigid reaction about `13.9167377089`, pipette plotfile max force magnitude about `13.9219446045`, final max cell-dish gap about `0.0128907751 um`, and `cellDishNormalSupportActive=true`.

### Current interpretation

Cell-dish is no longer simply missing. Contact force, gap control, and dish-normal support are present at `0.10 kPa` preload. Downstream localCd now carries plotfile normal traction from the real `.xplt` output, even though face-data pressure remains zero. The current bridge is explicitly marked as global fan-out, so it cannot be mistaken for region-resolved localCd force.

S7 is complete as a diagnostic stage. It does not claim the physical detachment model is complete. S8-A identified a concrete pre-run geometry blocker for pipette/cell force capture. S8-B removed that blocker and proved the next blocker is not simple surface colocation. S8-C proves the rigid pipette can receive force again through the capture-hold contact path. S8-D shows the cell-dish gap regression is motion-amplitude dependent, not an unavoidable consequence of capture-hold itself. S8-E shows the direct pipette-cell zero channel is not caused by `pipette_cell_pair` primary/secondary role. S8-F shows the declared suction pressure load is present and nonzero as a model load. S8-G shows direct pipette-cell force capture can be restored with a Studio-compatible outer-cell suction surface. S8-H/S8-I/S8-J show the remaining stiffness-reformation warning is not solved by smaller motion, softer pipette-cell penalty, or lower pressure amplitude alone. The next blocker is stabilization / convention cleanup: test ramp/step/control changes around the `t ~= 3.01-3.06` transition and reconcile the outer-cell comparison's `+x` Studio winding with the final S7-E suction sign convention.

### Next bounded task

- S8-K: stabilize the S8-G/H outer-cell suction path by changing load/motion ramp timing or solver step controls around the warning window, rather than further reducing pressure or contact penalty.
- Keep the current S7-M converted result as the cell-dish evidence baseline.
- Preserve S7-M `0.10 kPa` as the current normal-support candidate.
- Start from `S8_pipette_capture_hold_gentle`; do not spend more time on primary/secondary role unless a later Studio check contradicts S8-E.

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
- `src/febio/native/mesh.ts`
- `scripts/convert_febio_output.mjs`
- `src/febio/import/normalizeFebioResult.ts`
- `scripts/diagnose_febio_native_run.mjs`
- `febio_cases/native/S7_normal_preload.native.json`
- `febio_cases/native/S7_normal_preload_high.native.json`
- `febio_cases/native/S8_pipette_aligned.native.json`
- `febio_cases/native/S8_pipette_capture_hold.native.json`
- `febio_cases/native/S8_pipette_capture_hold_gentle.native.json`
- `febio_cases/native/S8_pipette_cell_reversed_pair.native.json`
- `febio_cases/native/S8_pipette_outer_cell_surface.native.json`
- `febio_cases/native/S8_pipette_outer_cell_surface_gentle.native.json`
- `febio_cases/native/S8_pipette_outer_cell_surface_soft_contact.native.json`
- `febio_cases/native/S8_pipette_outer_cell_surface_low_pressure.native.json`
- `febio_exports/S7_native_baseline/S7-K_S7_native_baseline_native_model.json`
- `febio_exports/S7_native_baseline/jobs/S7-K_S7_native_baseline.log`
- `febio_exports/S7_native_baseline/jobs/S7-K_S7_native_baseline.xplt`
- `febio_exports/S7_normal_preload/S7-L_S7_normal_preload.log`
- `febio_exports/S7_normal_preload/S7-L_S7_normal_preload.xplt`
- `febio_exports/S7_normal_preload_high/S7-M_S7_normal_preload_high.log`
- `febio_exports/S7_normal_preload_high/S7-M_S7_normal_preload_high.xplt`
- `febio_exports/S8_pipette_aligned/S8-B_S8_pipette_aligned_native_model.json`
- `febio_exports/S8_pipette_aligned/S8-B_S8_pipette_aligned.log`
- `febio_exports/S8_pipette_aligned/S8-B_S8_pipette_aligned.xplt`
- `febio_exports/S8_pipette_aligned/S8-B_S8_pipette_aligned_result.json`
- `febio_exports/S8_pipette_capture_hold/S8-C_S8_pipette_capture_hold_native_model.json`
- `febio_exports/S8_pipette_capture_hold/S8-C_S8_pipette_capture_hold.log`
- `febio_exports/S8_pipette_capture_hold/S8-C_S8_pipette_capture_hold.xplt`
- `febio_exports/S8_pipette_capture_hold/S8-C_S8_pipette_capture_hold_result.json`
- `febio_exports/S8_pipette_capture_hold_gentle/S8-D_S8_pipette_capture_hold_gentle_native_model.json`
- `febio_exports/S8_pipette_capture_hold_gentle/S8-D_S8_pipette_capture_hold_gentle.log`
- `febio_exports/S8_pipette_capture_hold_gentle/S8-D_S8_pipette_capture_hold_gentle.xplt`
- `febio_exports/S8_pipette_capture_hold_gentle/S8-D_S8_pipette_capture_hold_gentle_result.json`
- `febio_exports/S8_pipette_cell_reversed_pair/S8-E_S8_pipette_cell_reversed_pair_native_model.json`
- `febio_exports/S8_pipette_cell_reversed_pair/S8-E_S8_pipette_cell_reversed_pair.log`
- `febio_exports/S8_pipette_cell_reversed_pair/S8-E_S8_pipette_cell_reversed_pair.xplt`
- `febio_exports/S8_pipette_cell_reversed_pair/S8-E_S8_pipette_cell_reversed_pair_result.json`
- `febio_exports/S8_pipette_outer_cell_surface/S8-G_S8_pipette_outer_cell_surface_native_model.json`
- `febio_exports/S8_pipette_outer_cell_surface/S8-G_S8_pipette_outer_cell_surface.log`
- `febio_exports/S8_pipette_outer_cell_surface/S8-G_S8_pipette_outer_cell_surface.xplt`
- `febio_exports/S8_pipette_outer_cell_surface/S8-G_S8_pipette_outer_cell_surface_result.json`
- `febio_exports/S8_pipette_outer_cell_surface_gentle/S8-H_S8_pipette_outer_cell_surface_gentle.log`
- `febio_exports/S8_pipette_outer_cell_surface_gentle/S8-H_S8_pipette_outer_cell_surface_gentle.xplt`
- `febio_exports/S8_pipette_outer_cell_surface_gentle/S8-H_S8_pipette_outer_cell_surface_gentle_result.json`
- `febio_exports/S8_pipette_outer_cell_surface_soft_contact/S8-I_S8_pipette_outer_cell_surface_soft_contact.log`
- `febio_exports/S8_pipette_outer_cell_surface_soft_contact/S8-I_S8_pipette_outer_cell_surface_soft_contact.xplt`
- `febio_exports/S8_pipette_outer_cell_surface_soft_contact/S8-I_S8_pipette_outer_cell_surface_soft_contact_result.json`
- `febio_exports/S8_pipette_outer_cell_surface_low_pressure/S8-J_S8_pipette_outer_cell_surface_low_pressure.log`
- `febio_exports/S8_pipette_outer_cell_surface_low_pressure/S8-J_S8_pipette_outer_cell_surface_low_pressure.xplt`
- `febio_exports/S8_pipette_outer_cell_surface_low_pressure/S8-J_S8_pipette_outer_cell_surface_low_pressure_result.json`
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
- S8-A: mesh validation now reports pipette coupling readiness; current suction surface and rigid mouth are normal-aligned but tangentially offset by `8.5 um`.
- S8-B: added and ran a pipette-aligned comparison case. It closes pre-run coupling readiness (`ready=true`, zero tangential offset) and preserves cell-dish normal support, but pipette pressure / rigid reaction / plotfile force channels remain inactive.
- S8-C: added and ran a capture-hold comparison case. It restores rigid pipette reaction (`pipetteRigidReactionActive=true`) with warning-free termination, but direct pipette pressure / plotfile force remains inactive and cell-dish gap control regresses.
- S8-D: added and ran a gentle capture-hold comparison case. It keeps rigid pipette reaction active and recovers cell-dish gap control, but direct pipette pressure / plotfile force remains inactive.
- S8-E: added and ran a reversed pipette-cell pair-role comparison. Reversing primary/secondary preserves S8-D behavior and does not activate direct pipette pressure / plotfile force.
- S8-F: native run diagnostics now compute declared pressure-load resultants from native model JSON. S8-D/S8-E both show active declared suction pressure (`12.6 nN`) while direct pipette pressure / plotfile force outputs remain zero, narrowing the blocker to contact-output/transfer semantics.
- S8-G: added and ran an outer-cell suction-surface comparison. After fixing Studio facet winding to `[69,70,72,71]`, direct pipette pressure, rigid reaction, and pipette plotfile force all become active while cell-dish support remains controlled. Residual: one solver stiffness-reformation warning and a mode-specific `+x` suction-normal convention exception.
- S8-H/S8-I/S8-J: added and ran gentle-motion, soft-contact, and low-pressure outer-cell comparisons. All preserve direct pipette force channels and cell-dish support, but none removes the stiffness-reformation warning; soft contact and low pressure increase warning count to three.
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
