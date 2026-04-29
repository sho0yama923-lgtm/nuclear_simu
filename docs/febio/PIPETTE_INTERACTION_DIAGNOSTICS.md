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
