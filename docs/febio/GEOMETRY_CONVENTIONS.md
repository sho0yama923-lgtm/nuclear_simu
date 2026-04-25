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
- `pipette_contact_surface` is the rigid pipette mouth surface.
- The current `pipette_suction_surface` normal is expected to be `-x`.
- Negative suction pressure is intended to pull toward `+x`, into the pipette / barrel side.

## Contact Pair Convention

- `nucleus_cytoplasm_pair`: primary `cytoplasm_interface_surface`, secondary `nucleus_interface_surface`.
- `cell_dish_pair`: primary `cell_dish_surface`, secondary `dish_contact_surface`.
- `pipette_cell_pair`: primary `pipette_suction_surface`, secondary `pipette_contact_surface`.

Local paired surfaces should generally have opposed normals. The active validator records pair alignment through `validateNativeMesh().contactPairDiagnostics`.

`pipette_nucleus_pair` remains solver-active as a capture-hold stabilizer for the coarse debug mesh. The pressure-driven pipette coupling to inspect in Studio remains `pipette_cell_contact` on `pipette_cell_pair`, with pressure on `pipette_suction_surface`.

`cell_dish_pair` is kept with corrected opposed winding and remains available for diagnostics and output surfaces. The current coarse debug mesh omits solver-active `cell_dish_interface`, because activating the corrected tied contact causes negative-jacobian instability during lift. Re-enable it only with a refined cell-dish mesh.

## Diagnostics Policy

`validateNativeMesh()` keeps structural validity separate from convention diagnostics:

- missing required mesh entities still affect `valid`;
- normal, pressure, and contact-pair convention drift is reported in `conventionWarnings`;
- any convention drift should be resolved before Studio / CLI confirmation is treated as stable.
