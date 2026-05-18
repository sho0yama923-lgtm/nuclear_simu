# FEBio Path Ownership

## Active Path

The only active FEBio export path for new solver-facing work is:

```text
febio_cases/native/*.native.json
  -> scripts/export_febio_native_case.mjs
  -> src/febio/native/caseSpec.ts
  -> src/febio/native/mesh.ts
  -> src/febio/native/interfaces.ts
  -> src/febio/native/outputs.ts
  -> src/febio/native/model.ts
  -> src/febio/native/xml.ts
  -> src/febio/native/exportCase.ts
  -> febio_exports/<case>/<case>.feb
```

This path owns new FEBio `.feb` generation, effective native spec output, native model output, manifest output, and README handoff output.

## Active Gmsh Mesh Refinement Path

The active mesh-edit bridge for current S10 rectangular-block refinement is:

```text
febio_cases/native/S10_pipette_nc_refined.native.json
  -> scripts/dump_native_gmsh_baseline.mjs
  -> generated/gmsh_current/mesh.geo
  -> generated/gmsh_current/mesh.msh
  -> scripts/export_febio_from_gmsh_mesh.mjs
  -> src/febio/native/gmsh.ts
  -> src/febio/native/exportCase.ts
  -> febio_exports/current_mesh/current_mesh.feb
```

The generated Python API bridge is:

```text
febio_cases/native/*.native.json
  -> scripts/export_febio_from_gmsh_python_api.mjs
  -> febio_exports/current_mesh_api/mesh.py
  -> febio_exports/current_mesh_api/mesh.msh
  -> febio_exports/current_mesh_api/current_mesh_api.feb
```

`mesh.geo` is the canonical hand-edit file. `mesh.py` is generated and should not become the hand-edit source of truth. Current handoff filenames intentionally avoid version tags such as `S10-I`; versioned case exports remain historical / comparison artifacts.

## Legacy Freeze

Everything outside the active path above is legacy / compatibility for FEBio export work. Do not edit these paths for new solver behavior, force-transfer validation, pressure/contact behavior, output mapping, or physics source-of-truth changes unless the user explicitly asks for compatibility maintenance:

```text
src/model/
src/public-api.ts
src/febio/spec/
src/febio/export/
src/febio/import/
src/results/
src/browser/
scripts/export_febio_case.mjs
scripts/export_febio_direct_case.mjs
scripts/convert_febio_output.mjs
simulation.js
js/simulation-febio.js
js/simulation-ui.js
legacy/docs/febio/PARAMETER_MAPPING.md
legacy/docs/febio/FEBIO_UI_BRIDGE.md
legacy/docs/febio/FEBIO_FRONTEND_ARCHITECTURE.md
legacy/docs/febio/FEBIO_HANDOFF.md
legacy/docs/febio/BRIDGE_CONTRACT.md
legacy/febio_exports/
```

Legacy paths may still be read for historical context, existing regression tests, or compatibility bug fixes. They should not receive new active FEBio behavior.

## Allowed Exceptions

Edit legacy paths only when one of these is true:

- The user explicitly asks for a legacy / compatibility fix.
- A regression test proves the active native-only path is broken because of a shared dependency, and the smallest safe fix must be made there.
- A documentation update is needed to mark a legacy path as legacy or to point readers to the active path.

When an exception is used, record the reason in `PROGRESS.md`.
