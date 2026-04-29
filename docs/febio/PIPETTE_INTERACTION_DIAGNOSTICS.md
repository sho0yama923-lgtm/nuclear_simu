# Pipette Interaction Diagnostics

This document stores the durable S7-Q diagnostic rules for pipette-cell interaction.

## Current interpretation

S7-Q completes the diagnostic split for the remaining pipette interaction gate.

The active S7-M candidate is warning-free and has cell-dish normal support, but the pipette interaction channels are inactive:

- `pipetteCellPressureActive=false`
- `pipetteMouthPressureActive=false`
- `pipetteRigidReactionActive=false`
- `pipetteSuctionPlotfileForceActive=false`
- `pipetteMouthPlotfileForceActive=false`
- `pipettePlotfileForceActive=false`
- `pipetteInteractionActive=false`

This means the current run is diagnostically explainable, not physically complete for detachment interpretation. S7 ends at diagnostic completion; pipette coupling changes move to the next model-side phase.

## Diagnostic gates

Use separate gates instead of one broad pipette interaction verdict.

- `pipetteCellPressureActive`: `febio_pipette_cell_contact.csv` has nonzero pressure.
- `pipetteMouthPressureActive`: `febio_pipette_contact.csv` has nonzero pressure.
- `pipetteRigidReactionActive`: `febio_rigid_pipette.csv` has nonzero `Fx`, `Fy`, or `Fz`.
- `pipetteSuctionPlotfileForceActive`: `.xplt` contact force is nonzero on `pipette_suction_surface`.
- `pipetteMouthPlotfileForceActive`: `.xplt` contact force is nonzero on `pipette_contact_surface`.
- `pipettePlotfileForceActive`: either pipette plotfile force gate is active.
- `pipetteSuctionPressureLoadActive`: native model declares a nonzero pressure load resultant on `pipette_suction_surface`.
- `pipetteDirectContactOutputActive`: any direct pipette pressure or pipette plotfile-force output channel is active.
- `pipetteInteractionActive`: any pressure, rigid-reaction, or pipette plotfile-force channel is active.

## S7 closure rule

S7 is complete when the native path can distinguish:

- warning-free solver termination;
- nucleus/cytoplasm movement;
- cell-dish pressure vs plotfile force vs normal support;
- global vs region-resolved plotfile provenance;
- pipette pressure vs rigid reaction vs plotfile force.

The current S7 closure result is:

- S7-M remains the warning-free cell-dish normal-support candidate.
- The localCd converted result carries real `.xplt` normal traction, explicitly labeled as global fan-out.
- Pipette interaction is inactive across all currently emitted channels and must be treated as the next phase's model-side blocker.

## S8-A pre-run geometry diagnostic

S8-A adds a pre-run coupling-readiness check to mesh validation.

Current S7-M / S8-A geometry:

- `pipette_suction_surface` normal: `-x`
- `pipette_contact_surface` normal: `-x`
- normal gap along suction normal: `0 um`
- tangential centroid offset: `8.5 um`
- readiness threshold: `0.1 um`
- `pressureDiagnostics.couplingReadiness.ready=false`

This means the surfaces can look normal-aligned while still being tangentially separated in the x-z section. Treat this as the first geometry blocker for pipette suction force capture.

## S8-B aligned geometry result

S8-B adds `febio_cases/native/S8_pipette_aligned.native.json` as the smallest comparison case that closes the S8-A tangential-offset blocker.

S8-B geometry:

- pipette puncture/tip `z`: `17`
- suction centroid: `[14, 0, 17]`
- rigid mouth centroid: `[14, 0, 17]`
- normal gap: `0 um`
- tangential centroid offset: `0 um`
- `pressureDiagnostics.couplingReadiness.ready=true`

S8-B FEBio result:

- warning-free normal termination
- `cellDishNormalSupportActive=true`
- `cellDishGapControlled=true`
- `pipetteCellPressureActive=false`
- `pipetteMouthPressureActive=false`
- `pipetteRigidReactionActive=false`
- `pipetteSuctionPlotfileForceActive=false`
- `pipetteMouthPlotfileForceActive=false`
- `pipettePlotfileForceActive=false`
- `pipetteInteractionActive=false`

Interpretation: pre-run colocation is necessary to rule out the S8-A geometry blocker, but it is not sufficient to establish suction force capture. The next pipette milestone should change the active pipette contact definition or load transfer path, not only the surface centroids.

## S8-C capture-hold comparison result

S8-C adds `febio_cases/native/S8_pipette_capture_hold.native.json` as a bounded comparison that starts from S8-B aligned geometry and re-enables `pipette_nucleus_contact`.

S8-C contact change:

- `contacts.pipetteNucleus.solverActive=true`
- generated XML includes `pipette_nucleus_contact`
- `pipette_cell_contact` remains solver-active
- S8-B colocated `pipette_suction_surface` / `pipette_contact_surface` geometry is preserved

S8-C FEBio result:

- warning-free normal termination
- `pipetteRigidReactionActive=true`
- final rigid reaction: `Fx=-7.86426683279`, `Fz=33.5857591825`
- `pipetteInteractionActive=true`
- `pipetteCellPressureActive=false`
- `pipetteMouthPressureActive=false`
- `pipetteSuctionPlotfileForceActive=false`
- `pipetteMouthPlotfileForceActive=false`
- `pipettePlotfileForceActive=false`
- `cellDishNormalSupportActive=true`
- `cellDishGapControlled=false`

Interpretation: capture-hold contact can restore a rigid pipette force channel, but it does not prove pressure-driven pipette-cell suction is active. Treat S8-C as a diagnostic comparison point. The next model step should isolate direct pipette-cell force transfer or recover cell-dish gap control before accepting this path as physically sufficient.

## S8-D gentle capture-hold result

S8-D adds `febio_cases/native/S8_pipette_capture_hold_gentle.native.json` to isolate whether S8-C's gap regression is caused by capture-hold itself or by the large manipulation amplitude.

S8-D change:

- `contacts.pipetteNucleus.solverActive=true`
- S8-B/S8-C colocated pipette geometry is preserved
- pipette motion is reduced to `liftZ=2`, `inwardX=1`, `tangentY=0`

S8-D FEBio result:

- warning-free normal termination
- `pipetteRigidReactionActive=true`
- final rigid reaction: `Fx=7.91293679281`, `Fz=10.8173032188`
- `pipetteInteractionActive=true`
- `cellDishGapControlled=true`
- final max cell-dish gap: `0.0690802562265 um`
- `cellDishNormalSupportActive=true`
- `pipetteCellPressureActive=false`
- `pipetteMouthPressureActive=false`
- `pipetteSuctionPlotfileForceActive=false`
- `pipetteMouthPlotfileForceActive=false`
- `pipettePlotfileForceActive=false`

Interpretation: S8-D is the current best diagnostic comparison point for S8. It keeps rigid reaction and cell-dish gap control together, but direct pipette-cell pressure / plotfile force remains absent. The next milestone should inspect or change the direct `pipette_cell_contact` surface/output path rather than only adjusting motion amplitude.

## S8-E reversed pipette-cell pair result

S8-E adds `febio_cases/native/S8_pipette_cell_reversed_pair.native.json` to test whether `pipette_cell_contact` is zero because of the primary/secondary role in the `SurfacePair`.

S8-E change:

- S8-D geometry, motion, preload, and capture-hold contact are preserved
- `contacts.pipetteCell.pairRole="rigid-primary"`
- generated `pipette_cell_pair` uses `primary=pipette_contact_surface`
- generated `pipette_cell_pair` uses `secondary=pipette_suction_surface`
- pressure remains on `pipette_suction_surface`

S8-E FEBio result:

- warning-free normal termination
- `pipetteRigidReactionActive=true`
- `cellDishGapControlled=true`
- `cellDishNormalSupportActive=true`
- final rigid reaction: `Fx=7.91293679281`, `Fz=10.8173032188`
- final max cell-dish gap: `0.0690802562265 um`
- `pipetteCellPressureActive=false`
- `pipetteMouthPressureActive=false`
- `pipetteSuctionPlotfileForceActive=false`
- `pipetteMouthPlotfileForceActive=false`
- `pipettePlotfileForceActive=false`

Interpretation: direct pipette-cell force remains zero after reversing the pair role. Do not treat primary/secondary ordering as the active blocker. The next comparison should inspect contact-law/output semantics or separate the direct pipette-cell contact surface from the duplicated nucleus right surface.

## S8-F declared pressure-load resultants

S8-F updates native run diagnostics so `summarizeNativeFebioRunFiles()` can read the native model JSON and compute declared pressure-load resultants from surface area.

For S8-D and S8-E:

- `pressureLoads.available=true`
- `pipette_suction_pressure` is on `pipette_suction_surface`
- pressure value: `-0.7 kPa`
- suction surface area: `18 um^2`
- declared suction resultant: `12.6 nN`
- `pipetteSuctionPressureLoadActive=true`
- `pipetteDirectContactOutputActive=false`
- `pipetteCellPressureActive=false`
- `pipetteMouthPressureActive=false`
- `pipetteSuctionPlotfileForceActive=false`
- `pipetteMouthPlotfileForceActive=false`
- `pipettePlotfileForceActive=false`

Interpretation: the suction pressure load is present in the model and nonzero by native surface-area accounting. The remaining zero is specific to direct contact output/transfer channels. Do not diagnose S8-D/S8-E as missing a declared suction pressure load.

## S8-G outer-cell suction surface comparison

S8-G adds `febio_cases/native/S8_pipette_outer_cell_surface.native.json` to test whether the zero direct pipette channel is caused by `pipette_suction_surface` sharing the exact nucleus-right face used by the capture-hold / nucleus interface surfaces.

S8-G change:

- pipette puncture/tip `x`: `26`
- `contacts.pipetteCell.suctionSurfaceMode="cell-outer-right"`
- `pipette_suction_surface` uses outer cytoplasm-right nodes `[69, 70, 72, 71]`
- `pipetteNucleus.solverActive=false`
- `surfaceOverlapDiagnostics.pipetteSuctionSeparatedFromNucleusRight=true`
- coupling readiness remains true: `normalGapMagnitude=0`, `tangentialOffsetMagnitude=0`
- the first Studio import showed incorrect winding for `[69,71,72,70]`; `[69,70,72,71]` is the Studio-compatible winding for this comparison

S8-G FEBio result:

- normal termination
- one solver warning block: `Problem is diverging. Stiffness matrix will now be reformed`
- converted result JSON generated
- `cellDishNormalSupportActive=true`
- `cellDishGapControlled=true`
- `pipetteSuctionPressureLoadActive=true`
- declared suction resultant: `12.6 nN`
- `pipetteDirectContactOutputActive=true`
- `pipetteCellPressureActive=true`
- `pipetteMouthPressureActive=false`
- `pipetteRigidReactionActive=true`
- `pipetteSuctionPlotfileForceActive=true`
- `pipetteMouthPlotfileForceActive=true`
- `pipettePlotfileForceActive=true`
- `pipetteInteractionActive=true`
- max pipette-cell pressure: `1.7858176725`
- max rigid reaction: `32.2976727433`
- max pipette plotfile force magnitude: about `32.3410415232`

Interpretation: the direct pipette force channel can be activated by moving suction to the outer right cell surface with Studio-compatible winding. The remaining issue is not force-channel absence; it is stabilization and convention cleanup. S8-H should reduce or explain the stiffness-reformation warning and decide whether this outer-cell `+x` normal comparison becomes the final suction convention or remains a diagnostic bridge.

## S8-H/I/J outer-cell stabilization comparisons

S8-H, S8-I, and S8-J keep the S8-G Studio-compatible outer-cell suction surface and test small stabilization changes without changing the direct force-channel geometry.

S8-H gentle motion:

- case: `febio_cases/native/S8_pipette_outer_cell_surface_gentle.native.json`
- motion: `liftZ=1`, `inwardX=0.25`
- pressure: `-0.7 kPa`
- result: normal termination with one solver warning block
- direct force gates remain active: `pipetteDirectContactOutputActive=true`, `pipetteCellPressureActive=true`, `pipetteRigidReactionActive=true`, `pipettePlotfileForceActive=true`
- max pipette-cell pressure: `1.42607752858`
- max rigid reaction: about `25.6249355634`

S8-I soft contact:

- case: `febio_cases/native/S8_pipette_outer_cell_surface_soft_contact.native.json`
- motion/pressure: same as S8-H
- pipette-cell penalty scale: `0.25`
- result: normal termination with three solver warning blocks
- direct force gates remain active
- max pipette-cell pressure: `1.1880290985`
- max rigid reaction: about `21.1120721884`

S8-J low pressure:

- case: `febio_cases/native/S8_pipette_outer_cell_surface_low_pressure.native.json`
- motion: same as S8-H
- pressure: `-0.35 kPa`
- declared suction resultant: `6.3 nN`
- result: normal termination with three solver warning blocks at about `t=3.01115`, `t=3.03337`, and `t=3.05559`
- direct force gates remain active
- max pipette-cell pressure: `0.772434447697`
- max rigid reaction: about `13.9167377089`

Interpretation: reducing motion, softening pipette-cell penalty, and lowering suction pressure reduce force magnitude but do not remove the stiffness-reformation warning. Do not spend the next milestone on more amplitude-only reductions. The next stabilization comparison should target ramp timing, step boundaries, or solver controls near the warning window while preserving the S8-G/S8-H outer-cell force-channel geometry.
