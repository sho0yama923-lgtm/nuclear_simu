# Geometry Conventions

This file defines the active native-only FEBio geometry conventions.

## Coordinate Axes

- `x`: aspiration / manipulation axis.
- `+x`: from cell center toward the pipette / barrel side.
- `-x`: from pipette mouth toward cell interior.
- `y`: section thickness / out-of-plane axis.
- `+y` / `-y`: the two sides of the thin 3D section.
- `z`: dish-to-apical vertical axis.
- `+z`: away from dish / apical.
- `-z`: toward dish / basal.

## FEBio Quad Winding

FEBio quad surface normals are treated as the right-hand-rule normal from the first three node ids:

```text
normal = normalize(cross(node2 - node1, node3 - node1))
```

The active native path reports this direction through `validateNativeMesh().surfaceNormalDiagnostics`.

## Pressure Convention

- `pipette_suction_surface` is the deformable-side capture surface.
- `pipette_suction_patch` is the S10 local nucleus-side pressure-load patch. It is solver-facing only for cases that explicitly set `loads.suctionPressure.surface` to `pipette_suction_patch`.
- `pipette_contact_surface` is the rigid pipette mouth surface.
- The target physical `pipette_suction_surface` is the nucleus-side capture face, with normal expected to be `-x`.
- In S10-A, the broad `pipette_suction_surface` remains as a legacy / comparison surface, while pressure is applied to `pipette_suction_patch`.
- Negative suction pressure is intended to pull toward `+x`, into the pipette / barrel side.
- S10-I top-suction meshes set `meshMode="s10-top-pipette-reference"`. In that mode, `pipette_suction_patch` and `pipette_contact_surface` are top surfaces with normal expected to be `-z`, and negative suction pressure is intended to pull toward `+z` into the pipette above the cell.
- S10-I top-suction aspiration uses `mouthPlaneZ` and `inwardAxis="+z"` instead of the older side-entry `mouthPlaneX` / `-x` convention.
- S8-G and later outer-cell suction surfaces are diagnostic bridges for force-channel activation and Studio winding checks. They must not be promoted to the final suction convention without an explicit model decision.

## Contact Pair Convention

- `nucleus_cytoplasm_pair`: primary `cytoplasm_interface_surface`, secondary `nucleus_interface_surface`.
- `cell_dish_pair`: primary `cell_dish_surface`, secondary `dish_contact_surface`.
- `pipette_cell_pair`: primary `pipette_suction_surface`, secondary `pipette_contact_surface`.

Local paired surfaces should generally have opposed normals. The active validator records pair alignment through `validateNativeMesh().contactPairDiagnostics`.

`pipette_nucleus_pair` remains a model-side reference path for capture-hold comparisons in the coarse debug mesh. The pressure-driven pipette coupling to inspect in Studio remains `pipette_cell_contact` on `pipette_cell_pair`, with pressure on the nucleus-side `pipette_suction_surface` for the target physical model.

For S10-I top-suction, the active NC comparison region is `top`; side-entry S10-B/H comparisons remain `left/right` evidence and should not be conflated with top-suction solver behavior.

`cell_dish_pair` is kept with corrected opposed winding and remains available for diagnostics and output surfaces. The current coarse debug mesh omits solver-active `cell_dish_interface`, because activating the corrected tied contact causes negative-jacobian instability during lift. Re-enable it only with a refined cell-dish mesh.

## Diagnostics Policy

`validateNativeMesh()` keeps structural validity separate from convention diagnostics:

- missing required mesh entities still affect `valid`;
- normal, pressure, and contact-pair convention drift is reported in `conventionWarnings`;
- any convention drift should be resolved before Studio / CLI confirmation is treated as stable.
