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
- current split gates are `cellDishPressureActive=false`, `cellDishContactForceActive=true`, `cellDishNormalSupportActive=false`, `cellDishTangentialForceActive=true`, and `cellDishGapControlled=true`.

## Diagnostic gates

Use separate gates instead of one `cellDishLoadBearing` verdict.

- `cellDishPressureActive`: logfile face-data contact pressure is nonzero.
- `cellDishContactForceActive`: `.xplt` contact force magnitude is nonzero.
- `cellDishNormalSupportActive`: contact force has sufficient cell-dish normal component.
- `cellDishTangentialForceActive`: contact force has tangential / shear component.
- `cellDishGapControlled`: final cell-dish gap is below the configured threshold.

Current projection convention:

- cell-dish normal uses the `z` component because `+z` is away from dish / apical and `-z` is toward dish / basal.
- tangential force uses `sqrt(x^2 + y^2)`.
- `cellDishNormalSupportActive` currently requires nonzero normal force and `normalToTangentialRatio >= 0.2`.
- On `S7-K_S7_native_baseline`, max normal force is about `1.7637732029`, max tangential force is about `25.5978221893`, and `normalToTangentialRatio=0.0689032524`, so normal support remains weak.
- On `S7-L_S7_normal_preload` with `0.05 kPa` cell-dish normal preload, max normal force rises to about `3.6499471664`, max tangential force is about `25.6380748749`, and `normalToTangentialRatio=0.1423643228`. The run is warning-free and gap-controlled, but `cellDishNormalSupportActive` remains false.
- On `S7-M_S7_normal_preload_high` with `0.10 kPa` cell-dish normal preload, max normal force rises to about `8.8468484879`, max tangential force is about `25.6783313751`, and `normalToTangentialRatio=0.3445258323`. The run is warning-free and gap-controlled, and `cellDishNormalSupportActive=true`.

## Important rule

`cellDishLoadBearing=false` in older diagnostics mostly means face-data pressure is zero. It must not be interpreted as proof that cell-dish force is absent.

## Next diagnostic step

Use S7-M as the current normal-support candidate. Face-data pressure is still zero, but converted localCd can now use real `.xplt` normal contact force. S7-P labels global plotfile fan-out separately from future region-resolved localCd force.

## Downstream mapping

S7-N lets converter/import preserve plotfile normal contact traction as localCd native observation:

- `sourceNormal`: `native-plotfile-contact-traction`
- `sourceDamage`: `native-plotfile-contact-traction`
- `sourceShear`: `native-plotfile-contact-traction` when tangential bridge data is also present

S7-O builds that bridge from real `.xplt` output for `cell_dish_surface`. Because the current plotfile surface is global, not left / center / right, the converter fans the bridge out to localCd regions only as a fallback. Do not interpret that fan-out as region-resolved force until region-split plotfile surfaces exist.

S7-P records the fallback explicitly with `regionScope=global`, `payloadRegion=__global`, `spatialResolution=global-surface`, and `fanoutFallback=true` in result provenance and imported localCd state.
