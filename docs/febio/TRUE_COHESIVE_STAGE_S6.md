# Stage S6 True Cohesive / Failure Preparation

Date: 2026-04-24

## Status

Stage S6 is completed as a preparation and decision stage.

The canonical exporter now emits a FEBio-native XML shape closely enough for FEBio 4.12 to read and solve the generated bundle. This restores the missing bridge between the S1-S4 canonical contract and the solver-native path.

## Evidence

- Bundle: `generated/febio_exports/s6_native_adapter`
- FEBio executable: `C:\Program Files\FEBioStudio\bin\febio4.exe`
- FEBio version: 4.12.0
- Read status: `Reading file ...SUCCESS!`
- Termination: `N O R M A L   T E R M I N A T I O N`
- Solver output includes `case_A.xplt`, node logs, rigid-body logs, pipette contact logs, and nucleus-cytoplasm / cell-dish face logs.
- Regression check: `node --test --experimental-test-isolation=none tests\febio-front-end.test.mjs` passes 36/36 tests after the native adapter changes.

## Residuals

- FEBio warns that `cell_dish_interface` has no contact pairs, so the cell-dish tied interface is not yet physically active.
- FEBio warns about 4 unreferenced load controllers.
- FEBio repeatedly reports `No force acting on the system`, so suction/load activation still needs a solver-native step/load wiring pass before pressure-L(t) physics can be trusted.
- The run is therefore a canonical readability and normal-termination milestone, not a validated aspiration physics result.

## Decision

Do not replace sticky approximation with true cohesive or nonlinear spring failure yet.

Keep sticky as the current solver-primary nucleus-cytoplasm coupling until the next pass verifies solver-active loads/contact pairs and nonzero force transfer. True cohesive/failure should be introduced only after the canonical run has active pressure, active relevant contact pairs, and trustworthy output provenance.

