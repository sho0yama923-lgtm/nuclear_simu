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
febio_cases/native/S10_local_suction_patch_nc_right_refined.native.json
febio_cases/native/S10_local_suction_patch_nc_right_refined_pressure_1p0.native.json
febio_cases/native/S10_local_suction_patch_nc_right_refined_pressure_1p3.native.json
febio_cases/native/S10_local_suction_patch_nc_right_refined_pressure_1p55.native.json
febio_cases/native/S10_gmsh_baseline.native.json
febio_cases/native/S10_gmsh_nc_right_refined.native.json
febio_cases/native/S10_pipette_nc_refined.native.json
scripts/export_febio_native_case.mjs
scripts/dump_native_gmsh_baseline.mjs
scripts/export_febio_from_gmsh_mesh.mjs
scripts/export_febio_from_gmsh_python_api.mjs
scripts/diagnose_febio_native_run.mjs
src/febio/native/
tests/febio-native-pipeline.test.mjs
febio_exports/current_mesh/
generated/gmsh_current/mesh.geo
generated/gmsh_current/mesh.msh
generated/gmsh_current/mesh.validation.json
legacy/retired_generated_2026-05-18/
```

Use this path for new solver-facing work, pressure/contact changes, `.feb` serialization, output declarations, manifests, Gmsh rectangular-block mesh edits, and Studio handoff artifacts.

The canonical manual mesh-edit path is:

```text
febio_cases/native/S10_pipette_nc_refined.native.json
-> scripts/dump_native_gmsh_baseline.mjs
-> generated/gmsh_current/mesh.geo
-> generated/gmsh_current/mesh.msh
-> scripts/export_febio_from_gmsh_mesh.mjs
-> febio_exports/current_mesh/
```

`generated/gmsh_current/mesh.py` and `febio_exports/current_mesh_api/` are generated Python API artifacts. Keep hand edits in `mesh.geo` or in native case JSON / `src/febio/native/gmsh.ts`, not in generated Python.

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
