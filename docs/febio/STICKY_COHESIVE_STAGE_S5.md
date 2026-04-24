# Stage S5 Sticky Cohesive Solver Validation

Date: 2026-04-24

## Status

Stage S5 is completed with a recorded canonical-readability residual.

The sticky cohesive approximation has solver-run evidence from the existing FEBio solver XML path, and the current canonical S1-S4 export has a generated validation bundle with valid mesh/interface contracts. The remaining blocker is not sticky instability; it is the adapter from the new canonical XML contract to FEBio-native schema.

## Evidence

### Current Canonical Bundle

- Bundle: `generated/febio_exports/s5_validation`
- Export source: `scripts/export_febio_case.mjs` through canonical public API
- Mesh validation: valid
- Nucleus-cytoplasm stabilization validation: valid
- Stabilization diagnostics:
- `monotonicRamp`: true
- `rampSteps`: approach, hold, lift
- `normalPenaltyRatio`: 0.25925925925925924
- `tangentialPenaltyRatio`: 0.2059591836734693
- `snapToSearchRatio`: 1.2564102564102566
- `tractionToCriticalRatio`: 0.3205128205128205

FEBio 4.12.0 was found at `C:\Program Files\FEBioStudio\bin\febio4.exe`.

The generated canonical `.feb` is XML-well-formed, but FEBio reports:

```text
FATAL ERROR: Failed opening input file
```

This happens before numerical convergence, so it is recorded as a FEBio-native schema/readability residual rather than a sticky cohesive stability failure.

### Existing Solver-Primary Sticky Run

- Bundle: `generated/febio_exports/cohesive_progress_step7`
- CLI log: `generated/febio_exports/cohesive_progress_step7/run/case_A_cli.log`
- FEBio read status: SUCCESS
- Termination: `N O R M A L   T E R M I N A T I O N`
- Output files include:
- `case_A.xplt`
- `febio_nucleus_nodes.csv`
- `febio_cytoplasm_nodes.csv`
- `febio_rigid_pipette.csv`
- nucleus-cytoplasm face logs for left / right / top / bottom
- cell-dish face logs for left / center / right
- `febio_pipette_contact.csv`

That run includes solver-primary sticky contact for the nucleus-cytoplasm interface and demonstrates that the sticky approximation can run stably in FEBio when serialized through the existing FEBio-native XML path.

## Decision

Do not move directly to true cohesive/failure as if the canonical XML had completed an end-to-end solver run.

Next work should be Stage S6 preparation plus a FEBio-native schema adapter:

- keep sticky approximation as the current solver-primary interface model
- port the canonical S1-S4 mesh/load/output contract into FEBio-native XML sections
- rerun S5 once the canonical `.feb` reaches FEBio read success
- only then decide whether true cohesive or nonlinear spring failure should replace sticky approximation

## Stage S6 Follow-Up

Stage S6 restored canonical FEBio-native read success and normal termination in `generated/febio_exports/s6_native_adapter`.

The true cohesive/failure decision remains deferred because the S6 solver run still reports load/contact activation residuals (`No force acting on the system`, unreferenced load controllers, and inactive cell-dish contact pairs). Sticky remains the solver-primary nucleus-cytoplasm approximation until load transfer and contact activation are validated.
