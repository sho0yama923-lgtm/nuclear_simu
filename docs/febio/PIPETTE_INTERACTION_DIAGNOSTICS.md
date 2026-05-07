# Pipette Interaction Diagnostics

This document stores the durable S7-Q and S8 diagnostic rules for pipette interaction.

## Current interpretation

S7-Q completed the diagnostic split for the remaining pipette interaction gate. S8-M is now the target-geometry reference for the active physical direction.

The target physical model applies suction pressure to a nucleus-side capture surface. S8-G through S8-L outer-cell cases are diagnostic bridges: they prove that force channels, Studio-compatible winding, `.xplt` force extraction, and direct pipette diagnostics can become active, but they are not the intended final suction geometry. S8-M returns to the nucleus-side pressure path and shows that declared pressure load and direct contact-output channels must be interpreted separately.

The active S7-M candidate is warning-free and has cell-dish normal support, but the pipette interaction channels are inactive:

- `pipetteCellPressureActive=false`
- `pipetteMouthPressureActive=false`
- `pipetteRigidReactionActive=false`
- `pipetteSuctionPlotfileForceActive=false`
- `pipetteMouthPlotfileForceActive=false`
- `pipettePlotfileForceActive=false`
- `pipetteInteractionActive=false`

This means the older S7 run is diagnostically explainable, not physically complete for detachment interpretation. S7 ends at diagnostic completion; S8 keeps the target pressure on the nucleus-side capture surface and separates pressure-load evidence from direct contact-output evidence.

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

Interpretation: the direct pipette force channel can be activated by moving suction to the outer right cell surface with Studio-compatible winding. This is diagnostic bridge evidence, not the target physical model. The target remains nucleus-side pressure; future comparisons should use the S8-G evidence to separate output-channel limitations from true force-transfer absence rather than accepting the outer-cell `+x` normal as the final suction convention.

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

## S8-K fine inward timestep comparison

S8-K keeps the S8-H Studio-compatible outer-cell suction surface and direct force-channel geometry, then refines the manipulation timestep schedule without changing pressure, motion amplitude, or pipette-cell penalty.

S8-K fine inward controls:

- case: `febio_cases/native/S8_pipette_outer_cell_surface_fine_inward.native.json`
- motion/pressure/contact penalty: same as S8-H
- `manipulation-1` steps: `360` instead of `90`
- `manipulation-2` steps: `90` instead of `1`
- result: normal termination with seven stiffness-reformation warning blocks
- direct force gates remain active: `pipetteDirectContactOutputActive=true`, `pipetteCellPressureActive=true`, `pipetteRigidReactionActive=true`, `pipettePlotfileForceActive=true`
- cell-dish gates remain active: `cellDishNormalSupportActive=true`, `cellDishGapControlled=true`
- max pipette-cell pressure: `1.41425105523`
- max rigid reaction: about `25.4650692211`
- max pipette plotfile force magnitude: about `25.7914232226`

Interpretation: timestep-only refinement preserves the direct-force path but worsens the warning count. Do not spend the next milestone on more substep-only refinement. The next stabilization comparison should change the inward controller/ramp onset near the warning window while preserving the S8-G/S8-H/S8-K outer-cell force-channel geometry.

## S8-L delayed inward-ramp comparison

S8-L keeps the S8-H/S8-K Studio-compatible outer-cell suction surface and direct force-channel geometry, then delays the inward ramp onset without changing pressure, motion amplitude, or pipette-cell penalty.

S8-L delayed inward controls:

- case: `febio_cases/native/S8_pipette_outer_cell_surface_delayed_inward.native.json`
- motion/pressure/contact penalty: same as S8-H
- inward controller: `[[0,0], [3.2,0], [4.4,1], [5,1]]`
- result: normal termination with four stiffness-reformation warning blocks
- warning times: about `t=3.05559`, `3.06671`, `3.07782`, and `3.08893`
- direct force gates remain active: `pipetteDirectContactOutputActive=true`, `pipetteCellPressureActive=true`, `pipetteRigidReactionActive=true`, `pipettePlotfileForceActive=true`
- cell-dish gates remain active: `cellDishNormalSupportActive=true`, `cellDishGapControlled=true`
- max pipette-cell pressure: `1.41034606676`
- max rigid reaction: about `25.3257569855`
- max pipette plotfile force magnitude: about `25.3281849045`

Interpretation: delaying the inward controller reduces S8-K's warning count but does not beat S8-G/H. Because all four warnings occur before the delayed inward ramp begins at `t=3.2`, the warning is not caused by immediate inward displacement amplitude. Since the user clarified that the real physical model applies pressure to the nucleus, do not continue optimizing this outer-cell bridge as the main path. The next comparison should return to nucleus-side pressure and use the S8-G/L bridge results only to interpret output-channel behavior.

## S8-M nucleus-pressure return comparison

S8-M adds `febio_cases/native/S8_pipette_nucleus_pressure_return.native.json` as the bounded return to the intended pressure-on-nucleus model.

S8-M setup:

- `contacts.pipetteCell.suctionSurfaceMode="nucleus-right"`
- `pipette_suction_surface` uses the nucleus-side capture surface with normal `-x`
- `contacts.pipetteNucleus.solverActive=false`
- suction pressure: `-0.7 kPa`
- declared suction resultant: `12.6 nN`
- motion: `liftZ=1`, `inwardX=0.25`, `tangentY=0`
- cell-dish normal preload remains enabled

S8-M FEBio result:

- warning-free normal termination
- `pipetteSuctionPressureLoadActive=true`
- `nucleusCytoplasmMoved=true`
- nucleus max displacement: about `3.148 um`
- cytoplasm max displacement: about `3.361 um`
- `cellDishNormalSupportActive=true`
- `cellDishGapControlled=true`
- `pipetteCellPressureActive=false`
- `pipetteMouthPressureActive=false`
- `pipetteRigidReactionActive=false`
- `pipetteSuctionPlotfileForceActive=false`
- `pipetteMouthPlotfileForceActive=false`
- `pipettePlotfileForceActive=false`
- `pipetteDirectContactOutputActive=false`

Interpretation: S8-M is the current target-geometry evidence point. The nucleus-side pressure load is declared, nonzero, warning-free, and associated with tissue motion. The remaining zero is specific to direct pipette contact / rigid-reaction / plotfile contact-force output channels. Do not read this as a missing suction pressure load, and do not solve it by moving the pressure back to the outer cell surface. The next comparison should instrument or summarize pressure-load response on the nucleus-side `pipette_suction_surface` separately from contact outputs.

## S8-N pressure-load response instrumentation

S8-N adds `pressureLoadResponse` diagnostics to summarize final displacement on nodes belonging to declared pressure-load surfaces.

S8-N diagnostic additions:

- `pressureLoadResponse.loads[]`
- `pressureLoadResponse.pipetteSuction`
- `pipetteSuctionPressureResponseActive`
- `pipetteSuctionNormalDisplacementActive`

Re-diagnosed S8-M result:

- `pressureLoadResponse.pipetteSuction.nodeIds=[46,47,50,51]`
- `observedNodeCount=2`
- `missingNodeIds=[50,51]`
- observed source: `cytoplasm`
- surface normal: `[-1,0,0]`
- max suction-surface displacement: about `3.134 um`
- mean normal displacement along the suction normal: about `3.083 um`
- `pipetteSuctionPressureResponseActive=true`
- `pipetteSuctionNormalDisplacementActive=true`
- direct pipette contact-output gates remain false

Interpretation: this closes the first S8-N instrumentation need. The nucleus-side pressure load has an observable displacement response on available suction-surface nodes even when contact pressure, rigid reaction, and pipette contact-force plotfile outputs are zero.

S8-O update: the dedicated suction-node output is not wrong; FEBio logfile node rows use compact internal node ordinals based on the `<Nodes>` order, not the exported node ids. The rows `38,39,42,43` map back to native node ids `46,47,50,51`.

Re-diagnosed S8-M after S8-O:

- `pressureLoadResponse.pipetteSuction.nodeIds=[46,47,50,51]`
- `observedNodeCount=4`
- `missingNodeIds=[]`
- raw FEBio row ids: `[38,39,42,43]`
- max suction-surface displacement: about `3.148 um`
- mean normal displacement along the suction normal: about `2.482 um`
- `pipetteSuctionPressureResponseActive=true`
- `pipetteSuctionNormalDisplacementActive=true`

Interpretation: the nucleus-side pressure path now has full four-node suction-surface displacement evidence. Direct pipette contact-output gates remain zero and should stay separated from pressure-load response.

## S8-P converted result integration

S8-P carries the S8-O pressure response into converted FEBio result JSON.

Converted S8-M result:

- `suctionPressureResponse.available=true`
- `suctionPressureResponse.active=true`
- `suctionPressureResponse.normalDisplacementActive=true`
- `suctionPressureResponse.surface="pipette_suction_surface"`
- `suctionPressureResponse.nodeIds=[46,47,50,51]`
- `suctionPressureResponse.observedNodeCount=4`
- `suctionPressureResponse.missingNodeIds=[]`
- `suctionPressureResponse.maxDisplacement=3.1480948892317233`
- `suctionPressureResponse.meanNormalDisplacement=2.48161278158`
- `resultProvenance.dataSources.suctionPressureResponse="native-pressure-load-response"`

Manifest-based conversion now hydrates the exported native model, so the converted S8-M result preserves the native spec and `fdig_598cde20` digest. This makes the nucleus-pressure response available to downstream interpretation without pretending that direct contact pressure, rigid reaction, or pipette contact-force plotfile outputs are active.

## S8-Q detachment / capture interpretation

S8-Q updates downstream classification and conversion semantics so nucleus-side pressure response is recognized as pressure-driven capture evidence without renaming it as direct rigid/contact capture.

Interpretation rules:

- `captureEstablished` and `captureMaintained` remain direct contact / rigid reaction evidence in converted results.
- `captureEvidence.directContactCapture` reports the direct contact-force threshold result.
- `captureEvidence.pressureDrivenSuctionResponse` reports whether `suctionPressureResponse.active` or `suctionPressureResponse.normalDisplacementActive` is true.
- Classification must not return `missed_target` or `insufficient_hold` solely because `captureEstablished=false` when pressure-driven suction response is active.
- Direct contact outputs remain separate: contact pressure, rigid reaction, pipette `.xplt` force, and pressure-load displacement response must not be collapsed into one gate.

This keeps S8-M as the target physical model: pressure is applied to the nucleus-side capture surface, and S8-G/L outer-cell cases remain diagnostic bridge evidence only.

## S8-R result artifact review gate

S8-R reviews the S8-M converted-result gate after the S8-Q interpretation change.

Repository artifact status in the current checkout:

- native export bundle is present: `.feb`, effective native spec, native model, manifest, README.
- FEBio run outputs are absent: `.log`, `.xplt`, contact CSVs, node CSVs, suction-node CSV, and converted result JSON.
- The manifest contains absolute paths from the original export machine, so the converter now resolves manifest artifacts by basename next to the manifest before falling back to the stored absolute path.

Verdict:

- No new geometry or pressure convention change is justified by this checkout.
- The S8-M result-level verdict is blocked on obtaining or regenerating the FEBio run artifacts.
- Once artifacts are present, the review should report `captureEvidence.directContactCapture`, `captureEvidence.pressureDrivenSuctionResponse`, `suctionPressureResponse`, direct contact pressure, rigid reaction, pipette plotfile force, and cell-dish support/gap as separate fields.

## S8-S local run artifact acquisition and converted verdict

S8-S regenerated the S8-M run artifacts locally with FEBio 4.12.0 and converted the manifest-backed run output.

Generated artifacts:

- `S8-M_S8_pipette_nucleus_pressure_return.log`
- `S8-M_S8_pipette_nucleus_pressure_return.xplt`
- `febio_interface_cell_dish.csv`
- `febio_pipette_cell_contact.csv`
- `febio_pipette_contact.csv`
- `febio_rigid_pipette.csv`
- `febio_nucleus_nodes.csv`
- `febio_cytoplasm_nodes.csv`
- `febio_pipette_suction_nodes.csv`
- `S8-M_S8_pipette_nucleus_pressure_return_result.json`

Converted verdict:

- classification: `nucleus_detached`
- `captureEvidence.directContactCapture=false`
- `captureEvidence.pressureDrivenSuctionResponse=true`
- `suctionPressureResponse.active=true`
- `suctionPressureResponse.normalDisplacementActive=true`
- observed suction nodes: `4`
- missing suction nodes: `[]`
- max suction-surface displacement: `3.1480948892317233 um`
- mean suction-normal displacement: `2.48161278158 um`
- direct pipette contact outputs remain inactive: contact pressure, rigid reaction, suction plotfile force, mouth plotfile force all zero
- cell-dish support remains active through `.xplt` contact force with controlled gap, but this global fan-out force is not treated as local cell-dish detachment damage for classification

Interpretation: S8-M now has a local run-backed converted result. The result supports pressure-driven nucleus-side capture/response and does not rely on direct pipette contact capture. The `nucleus_detached` classification is currently driven by proxy displacement/detachment interpretation, not by native nucleus-cytoplasm face damage. The next refinement should inspect whether the detachment metric should report pressure-driven response separately from true nucleus-cytoplasm interface failure.

## S8-T detachment evidence source split

S8-T adds `detachmentEvidence` to classified results so the converted result separates the reason for the detachment classification from pressure-response and native interface-failure evidence.

S8-M converted result after S8-T:

- classification: `nucleus_detached`
- `detachmentEvidence.primarySource="proxy-displacement"`
- `detachmentEvidence.pressureDrivenSuctionResponse.active=true`
- `detachmentEvidence.pressureDrivenSuctionResponse.observedNodeCount=4`
- `detachmentEvidence.nativeNcInterfaceFailure.active=false`
- `detachmentEvidence.nativeNcInterfaceFailure.damage=0`
- `detachmentEvidence.proxyDisplacement.active=true`
- `detachmentEvidence.proxyDisplacement.value=2.1886848511725`
- `detachmentEvidence.proxyGeometry.active=false`
- `detachmentEvidence.proxyGeometry.contactAreaRatio=1`

Interpretation: `nucleus_detached` is now explicitly source-qualified. For S8-M it means proxy displacement crossed the detachment threshold while pressure-driven suction response was active. It does not mean native nucleus-cytoplasm interface failure was observed.

## S8-U native NC interface evidence root cause

S8-U resolves why S8-M cannot currently report native nucleus-cytoplasm interface failure evidence.

Root cause:

- The native nucleus-cytoplasm interface is `type="conformal-shared-node"` with `solverActive=false`.
- The generated `.feb` intentionally omits `nucleus_cytoplasm_interface` contact.
- `buildSolverFacingLogOutputs` keeps only `cell_dish_interface_surface`, `pipette_cell_contact_surface`, and `pipette_contact_surface` face-data logs.
- Solver-facing `plotfileSurfaceData` is empty for S8-M.
- Therefore no `febio_interface_nc_*.csv`, `febio_interface_nucleus_cytoplasm.csv`, or localNc `.xplt` contact-traction output can exist for the current S8-M run.

Converted result evidence:

- `nativeNcInterfaceEvidence.available=false`
- reason: conformal shared-node force transfer emits no solver-active NC contact face data
- `detachmentEvidence.nativeNcInterfaceFailure.outputAvailable=false`
- `detachmentEvidence.nativeNcInterfaceFailure.active=false`

Conclusion: existing S8-M artifacts are sufficient for pressure-driven suction response and displacement-based detachment interpretation, but not for native NC interface failure. The next bounded instrumentation should add a native NC evidence channel that is compatible with conformal shared-node coupling, such as node-pair relative displacement / strain across named NC regions or a deliberate solver-active cohesive/contact comparison case. Do not change the S8-M pressure geometry to solve this evidence gap.

## S8-V shared-node NC evidence instrumentation

S8-V adds a shared-node-compatible NC observation channel without changing the S8-M pressure geometry.

Implementation:

- Native solver-facing log outputs now include NC region node data for nucleus and cytoplasm sides:
  - `febio_nc_left_nucleus_nodes.csv`
  - `febio_nc_left_cytoplasm_nodes.csv`
  - `febio_nc_right_nucleus_nodes.csv`
  - `febio_nc_right_cytoplasm_nodes.csv`
  - `febio_nc_top_nucleus_nodes.csv`
  - `febio_nc_top_cytoplasm_nodes.csv`
  - `febio_nc_bottom_nucleus_nodes.csv`
  - `febio_nc_bottom_cytoplasm_nodes.csv`
- The converter reports `sharedNodeNcEvidence` separately from `nativeNcInterfaceEvidence`.
- `detachmentEvidence` now includes `sharedNodeNcObservation` so pressure response, shared-node continuity, proxy displacement, and native NC contact failure are not conflated.

Re-run S8-M result:

- FEBio 4.12.0 reached normal termination.
- The new NC node CSVs were emitted.
- `sharedNodeNcEvidence.available=true`
- `sharedNodeNcEvidence.observedNodeCount=16`
- `sharedNodeNcEvidence.maxSharedDisplacement=3.1480948892317233`
- `sharedNodeNcEvidence.maxRelativeNormalDisplacement=0`
- `sharedNodeNcEvidence.maxRelativeShearDisplacement=0`
- `nativeNcInterfaceEvidence.available=false` remains true because no solver-active NC contact/cohesive output exists.

Conclusion: the cause is confirmed. S8-M has pressure-driven nucleus motion and shared-node NC displacement continuity, but it still does not contain native NC contact/cohesive failure evidence. Measuring actual NC failure requires a deliberately separate solver-active NC cohesive/contact comparison or another explicit failure instrumentation path.

## S8-W solver-active NC failure comparison

S8-W creates the deliberate comparison that S8-U/V identified as the missing evidence path.

Implementation:

- Added `febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json`.
- The case preserves S8-M nucleus-side pressure geometry and gentle motion.
- `contacts.nucleusCytoplasm.solverActive=true` enables solver-active NC `tied-elastic` comparison contacts.
- Native export now honors `contacts.nucleusCytoplasm.solverActive` instead of always forcing shared-node-only NC output.
- Solver-facing outputs include NC face data and localNc plotfile traction surfaces.

Run result:

- FEBio 4.12.0 reached normal termination.
- Warning count: `0`.
- `No contact pairs found`: `0`.
- NC face-data CSVs were emitted:
  - `febio_interface_nc_left.csv`
  - `febio_interface_nc_right.csv`
  - `febio_interface_nc_top.csv`
  - `febio_interface_nc_bottom.csv`
- Converted result: `nativeNcInterfaceEvidence.available=true`.
- `detachmentEvidence.nativeNcInterfaceFailure.outputAvailable=true`.
- `detachmentEvidence.nativeNcInterfaceFailure.active=false`.
- Native NC damage: `0`.
- NC region face pressure/gap damage: `0`.
- NC contact fraction: `1`.
- `firstFailureSite="none"`.
- S8-W remains `classification="nucleus_detached"` because proxy displacement still crosses the detachment-start threshold.

Interpretation:

S8-W resolves the evidence ambiguity. Native NC failure output can be emitted for a bounded comparison on this geometry, and the solver accepts it warning-free. The result is inactive NC failure, not missing NC failure evidence. Under the current S8-M load and thresholds, suction produces nucleus/cytoplasm displacement but does not create solver-observed NC interface failure.

## S8-X/Y separated-node NC failure activation

S8-X/Y isolate the remaining reason S8-W did not activate native NC failure.

Implementation:

- Added `contacts.nucleusCytoplasm.meshCouplingMode="separated-contact"`.
- The native mesh now duplicates cytoplasm-side NC interface nodes for separated-contact comparisons:
  - nucleus right nodes stay `[46,47,50,51]`
  - cytoplasm right nodes become `[74,75,78,79]`
- This keeps the same initial coordinates but allows relative NC displacement and solver-active NC contact/failure evidence.

S8-X baseline pressure result:

- Case: `S8_pipette_nucleus_nc_separated_failure`
- Pressure: `-0.7 kPa`
- FEBio reached warning-free normal termination after S8-Z cleanup.
- Solver-active separated NC comparison contacts are emitted only for valid left/right element faces. Top/bottom NC regions remain node-data/proxy observations.
- `sharedNodeNcObservation.source="separated-nc-region-node-data"`
- max relative NC displacement: `0.5375988118200001 um`
- native NC failure remains inactive: damage `0`, `firstFailureSite="none"`

S8-Y high-pressure bound result:

- Case: `S8_pipette_nucleus_nc_separated_failure_high_pressure`
- Pressure: `-3.5 kPa`
- FEBio reached normal termination with stiffness-reformation warnings.
- Invalid facet / no-contact-pair setup warnings are absent after S8-Z cleanup.
- Native NC failure activates:
  - `damage.nc=1`
  - `detachmentEvidence.primarySource="native-nc-interface"`
  - `detachmentEvidence.nativeNcInterfaceFailure.active=true`
  - `firstFailureSite="nc:right"`
  - `firstFailureMode="normal"`
  - `events.ncDamageStart.time=0.866684`
  - `detachmentComplete` is present
- Peak local NC evidence:
  - right peak normal stress `1.8880728951487502`
  - left peak normal stress `0.8908501456260017`
  - bottom remains proxy-only and is not used as the native first-failure site

Conclusion:

The implementation path is now proven end to end. S8-M could not show native NC failure because it was shared-node and failure-output unavailable. S8-W made native NC output available but still had no relative failure-driving kinematics. S8-X introduced separated NC kinematics and is now warning-free at baseline pressure. S8-Y crossed the pressure bound and produced native NC interface failure without the invalid-facet setup warnings. S9 then replaced that high-pressure warning case with a warning-free pressure-boundary scan. Treat the S9 boundary as pipeline evidence only; physical failure-boundary calibration waits for S10 mesh refinement.

## S9 native NC pressure-boundary scan

S9 keeps the cleaned S8-Z separated-contact comparison geometry and changes only the nucleus-side suction pressure.

| Case | Pressure | FEBio warnings | Native NC failure | Native failure damage | First native/proxy site | Right peak normal | Interpretation |
| --- | ---: | ---: | --- | ---: | --- | ---: | --- |
| S8-X | `-0.7 kPa` | `0` | inactive | `0` | `none` | `0.3647674993207499` | warning-free no-failure baseline |
| S9-A | `-1.4 kPa` | `0` | inactive | `0` | `nc:bottom` proxy | `0.7480285272022499` | proxy displacement/damage only; not native NC failure |
| S9-D | `-1.55 kPa` | `0` | inactive | `0.23435479253090608` | `nc:right` | `0.8311830866887499` | warning-free partial native damage below active threshold |
| S9-E | `-1.7 kPa` | `0` | active | `0.6155186249313224` | `nc:right` | `0.9144292676850009` | warning-free native NC failure onset |
| S9-F | `-1.85 kPa` | `0` | active | `0.9966432842754073` | `nc:right` | `0.997666893285749` | warning-free near-complete native NC failure |
| S9-B | `-2.1 kPa` | `0` | active | `1` | `nc:right` | `1.136099188581751` | warning-free native NC failure bound |
| S9-C | `-2.8 kPa` | `0` | active | `1` | `nc:right` | `1.5186565906312497` | warning-free stronger native NC failure |
| S8-Y | `-3.5 kPa` | `152` | active | `1` | `nc:right` | `1.8880728951487502` | high-pressure diagnostic, no longer needed as the clean activation bound |

S9 also fixed a classification interpretation issue exposed by S9-A: proxy-only top/bottom NC damage can appear in the normalized `damage.nc` summary, but it must not activate `detachmentEvidence.nativeNcInterfaceFailure`. Native NC failure now uses native face-data regions only for the native damage gate.

Conclusion:

The useful warning-free native NC failure transition is now bounded between S9-D `-1.55 kPa` and S9-E `-1.7 kPa`. S9-D has partial right-side native damage but stays below the detachment-start threshold; S9-E crosses into active right-side normal native failure. This makes S8-Y a high-pressure stress test rather than the primary evidence case.

## S10 local suction patch export

S10-A starts the physical mesh-refinement path. It changes the pressure-load surface from the historical broad `pipette_suction_surface` to a local nucleus-side `pipette_suction_patch`, while keeping S8-M and S9 as comparison baselines.

S10-A static export diagnostics:

- case: `febio_cases/native/S10_local_suction_patch.native.json`
- export: `febio_exports/S10_local_suction_patch/`
- mesh mode: `s10-local-suction-patch`
- pressure surface: `pipette_suction_patch`
- legacy / comparison surface: `pipette_suction_surface`
- patch area: `6.5 um^2`
- patch centroid: `[14, 0, 17]`
- patch normal: `-x`
- patch node ids: `[82, 83, 86, 87]`
- patch face id: `[24]`
- declared pressure: `-0.7 kPa`
- declared pressure resultant: `4.55 nN`

Windows FEBio CLI result:

- run directory: `febio_exports/S10_local_suction_patch/febio_runs/S10-A_S10_local_suction_patch/`
- termination: normal
- solver warnings / errors / negative jacobian / no-force / no-contact-pair messages: `0`
- pressure-load response: active on `pipette_suction_patch`
- observed patch nodes: `4 / 4`
- max patch displacement: `1.1628959591041037 um`
- max patch normal displacement: `1.1518070494 um`
- direct pipette contact output: inactive
  - pipette-cell pressure `0`
  - pipette mouth pressure `0`
  - rigid reaction `0`
  - pipette plotfile force inactive
- cell-dish support: active through plotfile contact force
  - max normal force `10.198174476623535 nN`
  - max tangential force `9.159760475158691 nN`
  - face-data pressure remains `0`
- converted classification: proxy-derived `nucleus_detached`
- native NC interface failure: unavailable / inactive because S10-A keeps conformal shared-node NC coupling

Interpretation:

S10-A is now the warning-free local-patch pressure-response baseline. It proves that the local nucleus-side pressure patch is solver-facing and produces nonzero patch displacement response. It still does not prove native NC failure or direct pipette contact capture. The next S10 increment should refine the NC right-region interface around the local suction patch while preserving S10-A as the pressure-response baseline.
