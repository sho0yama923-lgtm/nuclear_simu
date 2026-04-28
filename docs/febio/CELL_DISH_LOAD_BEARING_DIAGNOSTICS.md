# Cell-Dish Load-Bearing Diagnostics

This document stores the durable S7-K diagnostic rules for cell-dish contact.

## Current interpretation

S7-K shows that cell-dish contact should not be judged by a single pressure-only boolean.

Observed state:

- cell-dish contact is solver-active.
- initial normal gap is 0.
- cell and dish normals are opposed.
- FEBio CLI run is warning-free.
- final gap is controlled after increasing cell-dish normal stiffness.
- logfile face-data contact pressure remains 0.
- Studio / `.xplt` contact force is nonzero on the cell-dish pair.
- the force is mostly horizontal / shear, with weak dish-normal support.

## Diagnostic gates

Use separate gates instead of one `cellDishLoadBearing` verdict.

- `cellDishPressureActive`: logfile face-data contact pressure is nonzero.
- `cellDishContactForceActive`: `.xplt` contact force magnitude is nonzero.
- `cellDishNormalSupportActive`: contact force has sufficient cell-dish normal component.
- `cellDishTangentialForceActive`: contact force has tangential / shear component.
- `cellDishGapControlled`: final cell-dish gap is below the configured threshold.

## Important rule

`cellDishLoadBearing=false` in older diagnostics mostly means face-data pressure is zero. It must not be interpreted as proof that cell-dish force is absent.

## Next diagnostic step

Project `.xplt` contact force into normal and tangential components, then report pressure/force mismatch explicitly.
