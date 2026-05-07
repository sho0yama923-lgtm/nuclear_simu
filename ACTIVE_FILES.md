# Active Files

This is the current working surface for FEBio export and validation.

## Active FEBio Export Path

```text
febio_cases/native/S7_baseline.native.json
febio_cases/native/S8_pipette_aligned.native.json
febio_cases/native/S8_pipette_capture_hold.native.json
febio_cases/native/S8_pipette_capture_hold_gentle.native.json
febio_cases/native/S8_pipette_cell_reversed_pair.native.json
febio_cases/native/S8_pipette_outer_cell_surface.native.json
febio_cases/native/S8_pipette_outer_cell_surface_gentle.native.json
febio_cases/native/S8_pipette_outer_cell_surface_soft_contact.native.json
febio_cases/native/S8_pipette_outer_cell_surface_low_pressure.native.json
febio_cases/native/S8_pipette_outer_cell_surface_fine_inward.native.json
febio_cases/native/S8_pipette_outer_cell_surface_delayed_inward.native.json
febio_cases/native/S8_pipette_nucleus_pressure_return.native.json
febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json
febio_cases/native/S8_pipette_nucleus_nc_separated_failure.native.json
febio_cases/native/S8_pipette_nucleus_nc_separated_failure_high_pressure.native.json
febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_1p4.native.json
febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_1p55.native.json
febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_1p7.native.json
febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_1p85.native.json
febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_2p1.native.json
febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_2p8.native.json
febio_cases/native/S10_local_suction_patch.native.json
scripts/export_febio_native_case.mjs
scripts/diagnose_febio_native_run.mjs
src/febio/native/
tests/febio-native-pipeline.test.mjs
febio_exports/S7_native_baseline/
febio_exports/S8_pipette_aligned/
febio_exports/S8_pipette_capture_hold/
febio_exports/S8_pipette_capture_hold_gentle/
febio_exports/S8_pipette_cell_reversed_pair/
febio_exports/S8_pipette_outer_cell_surface/
febio_exports/S8_pipette_outer_cell_surface_gentle/
febio_exports/S8_pipette_outer_cell_surface_soft_contact/
febio_exports/S8_pipette_outer_cell_surface_low_pressure/
febio_exports/S8_pipette_outer_cell_surface_fine_inward/
febio_exports/S8_pipette_outer_cell_surface_delayed_inward/
febio_exports/S8_pipette_nucleus_pressure_return/
febio_exports/S10_local_suction_patch/
```

Use this path for new solver-facing work, pressure/contact changes, `.feb` serialization, output declarations, manifests, and Studio handoff artifacts.

## Active Policy / Resume Files

```text
README.md
AGENT.md
PROGRESS.md
docs/CODEBASE_STRUCTURE.md
docs/febio/FEBIO_PATH_OWNERSHIP.md
docs/febio/FEBIO_NATIVE_SPEC.md
docs/febio/GEOMETRY_CONVENTIONS.md
docs/febio/NATIVE_MODEL_REFINEMENT_STRATEGY.md
docs/febio/MESH_REFINEMENT_PLAN.md
docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md
docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md
docs/ops/STUDIO_CONFIRMATION_GATES.md
```

## Legacy Location

Retired FEBio docs and historical export artifacts live under:

```text
legacy/
```

Do not use files in `legacy/` for new solver behavior. They are historical references only.
