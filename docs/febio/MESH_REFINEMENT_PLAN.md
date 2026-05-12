# Mesh Refinement Plan

This document owns the plan for moving from the current debug / provisional native FEBio model to a more physical suction model. It should be used after the native execution, output, diagnostic, conversion, and classification paths are validated on the simpler model.

## Positioning

S9 closed as pipeline validation, not final pressure-threshold calibration. S10 starts the physical mesh refinement path. The Gmsh-generated mesh path is established; the next S10 increment should use parametric rectangular blocks rather than point-by-point manual editing, so refined meshes remain reproducible and comparable against the current native baseline.

The current coarse / debug mesh can prove that:

- nucleus-side pressure can be declared in the native spec;
- pressure-load response can be observed on the suction surface;
- shared-node NC coupling cannot prove native NC failure;
- separated-contact NC comparisons can emit native NC damage/failure outputs;
- converter / diagnostics / classification can distinguish pressure response, proxy displacement, shared-node continuity, and native NC failure.

The current coarse mesh should not be used to claim final physical detachment pressure. Pressure thresholds from this mesh are provisional pipeline evidence only.

## Gmsh foundation before local refinement

Before adding new local refinement policy, create a baseline Gmsh path that preserves the current native mesh behavior and can be compared against the existing FEBio baseline.

Required sequence:

1. dump the current native mesh to JSON and preserve node ids, element ids, surface names, and surface face membership as the comparison source;
2. add a Gmsh `.geo` generator for the baseline geometry;
3. add a gmsh CLI wrapper that emits `.msh` v2 ASCII and propagates stderr / exit-code diagnostics;
4. add a `.msh` v2 ASCII parser for nodes, elements, element tags, and physical names;
5. map Gmsh Physical Groups exactly to existing native surface names;
6. convert parsed `.msh` data into the native mesh object shape;
7. add an opt-in `buildNativeMesh` `meshMode` branch for the Gmsh path while keeping the current native path as default;
8. pass `validateNativeMesh` and `buildNativeFebioExport`;
9. compare FEBio CLI output against the existing baseline before moving to local refinement.

Initial scope is `.msh` v2 ASCII. `.msh` v4 support, size-field policy, and advanced local refinement remain later work.

## Parametric rectangular-block policy

As refinement grows, point ids should not be the primary editing interface. The preferred editable source is a rectangular block `.geo` that exposes coordinate planes and named edit handles while preserving quad / hex topology.

Current implementation:

- `native-editable-block.geo` remains available as the direct point / line / surface representation.
- `native-parametric-block.geo` is now preferred for manual refinement.
- `native-python-api-block.py` is the next preferred safe-edit surface because it keeps geometry handles and FEBio-facing Physical Group names in one Python API script.
- High-value handles include:
  - `pipetteOuterX`;
  - `pipetteZBottom`;
  - `pipettePatchZBottom`;
  - `pipettePatchZTop`;
  - `pipetteZTop`.
- To make the pipette thinner in the current x-z view, first move `pipetteZBottom` and `pipetteZTop` toward the patch band instead of editing many `Point(...)` rows.
- Physical group names must remain unchanged, especially `pipette_mouth_patch`, `pipette_suction_patch`, `nucleus_interface_right_surface`, and `cytoplasm_interface_right_surface`.
- The first validation target after any parametric edit is: Gmsh `.geo -> .msh`, native round-trip validation, FEBio export, FEBio CLI run, and comparison against S10-I.
- Edited `.msh` files should be exported with `scripts/export_febio_from_gmsh_mesh.mjs` using the matching native case as the template.

## Gmsh Python API registry policy

The safer long-term path is to generate meshes through the Gmsh Python API instead of hand-editing `.geo` text. The Python API script should own:

- rectangular coordinate/edit handles;
- block topology;
- `PHYSICAL_VOLUMES`;
- `PHYSICAL_SURFACES`;
- `PHYSICAL_GROUP_IDS`.

FEBio-facing names should be assigned only through this registry. Adding or renaming a Physical Group must be treated as a FEBio interface change, because the native converter maps Gmsh Physical names directly to FEBio domains and surfaces.

Current bridge:

- `buildGmshPythonApiBlockScript` emits `native-python-api-block.py`.
- `scripts/export_febio_from_gmsh_python_api.mjs` generates the Python API script, runs it to produce `.msh`, validates the native round-trip, and writes FEBio handoff artifacts.
- The current local environment has Gmsh CLI `4.14.0` and a project-local Python `gmsh` package at `.tools/python-gmsh` reporting `4.15.2`. Generated Python API scripts auto-discover this local package from the project tree.
- The unmodified S10-I Python API bridge has been run successfully and writes FEBio handoff artifacts under `febio_exports/S10_pipette_nc_refined_python_api/`.

## Refinement goals

The first physical-model refinement target is a local nucleus-side suction patch and a more useful NC interface mesh. New refinement should be built on top of the Gmsh baseline path after the baseline comparison is accepted.

Priority order:

1. local pipette suction patch;
2. NC interface local refinement and failure-capable pairing;
3. pipette mouth / suction / capture vocabulary cleanup;
4. cell-dish support refinement and region-resolved output;
5. staged mesh levels for later convergence checks.

## 1. Local pipette suction patch

The target suction model is local pressure on a small nucleus-side patch, not pressure over a broad cell or NC face.

Current implementation status:

- S10-A (`febio_cases/native/S10_local_suction_patch.native.json`) adds `meshMode="s10-local-suction-patch"`.
- The exported solver pressure surface is `pipette_suction_patch`.
- The historical broad `pipette_suction_surface` remains available as a legacy / comparison surface.
- Static export diagnostics for `febio_exports/S10_local_suction_patch/` report:
  - area `6.5 um^2`;
  - centroid `[14, 0, 17]`;
  - normal `-x`;
  - node ids `[82, 83, 86, 87]`;
  - face id `[24]`;
  - pressure resultant `4.55 nN` for `-0.7 kPa`.
- Windows FEBio CLI solver confirmation is complete for S10-A: normal termination, warning-free, active `pipette_suction_patch` pressure-load response. Studio visual confirmation remains useful for pressure-arrow and surface-orientation review.
- S10-B (`febio_cases/native/S10_local_suction_patch_nc_right_refined.native.json`) combines the local patch with separated solver-active left/right NC comparison.
- S10-B splits active nucleus-side left/right NC facets into bottom / patch / top bands and splits the cytoplasm right NC surface around the patch band.
- Static export diagnostics for `febio_exports/S10_local_suction_patch_nc_right_refined/` are valid with no convention warnings and preserve the same patch area, centroid, normal, node ids, face id, and pressure resultant as S10-A.
- Windows FEBio CLI solver confirmation is complete for S10-B: normal termination, warning-free, active local suction pressure-load response, and active left/right NC plotfile contact force. Native NC failure output is available but inactive at baseline `-0.7 kPa` pressure.
- S10-C/D/E add a bounded pressure-only scan on the S10-B geometry at `-1.0`, `-1.3`, and `-1.55 kPa`. These cases preserve the same local patch and separated left/right NC surfaces and are intended to bracket native NC damage onset before any physical threshold interpretation.
- S10-G (`febio_cases/native/S10_gmsh_baseline.native.json`) validates that the S10-A local suction patch can round-trip through the Gmsh v2 ASCII baseline path and reproduce the S10-A FEBio CLI result.
- S10-H (`febio_cases/native/S10_gmsh_nc_right_refined.native.json`) validates that the S10-B separated left/right NC refinement can round-trip through the Gmsh v2 ASCII baseline path and reproduce the S10-B FEBio CLI result.
- `meshLevelDiagnostics` is now emitted by native mesh validation and reports element counts, face counts by surface, NC region face counts, NC node-pair mapping counts, duplicate-coordinate groups, and Gmsh native-id recovery notes.
- `buildEditableGmshBlockGeo` emits the first hand-editable Gmsh block geometry from the native hex mesh. It writes Points, Lines, transfinite Plane Surfaces, transfinite Volumes, and Physical Groups using existing native names. This establishes an editable `.geo` bridge, but it is still a block-structured representation of the current mesh rather than the final curved / size-field refinement policy.
- S10-I (`febio_cases/native/S10_pipette_nc_refined.native.json`) adds the first actual pipette-mouth alignment refinement. It splits the rigid pipette mouth into bottom / patch / top bands, adds `pipette_mouth_patch`, keeps `pipette_suction_patch` unchanged, and preserves the S10-H FEBio CLI result on tracked converted metrics: final aspiration delta `0`, pressure response observed nodes `4 == 4`, detachment start delta `0`, and warning-free normal termination.
- S10-I now also emits `generated/gmsh_editable_s10i/native-parametric-block.geo`, a rectangular-block `.geo` with coordinate variables and pipette edit handles. Gmsh 4.14.0 can mesh it, parse `96` nodes and `57` physical quad/hex elements, and round-trip it through native validation.
- `scripts/export_febio_from_gmsh_mesh.mjs` provides the handoff from a saved edited `.msh` into FEBio export artifacts.
- S10-I now also emits `generated/gmsh_editable_s10i/native-python-api-block.py`, a Gmsh Python API script with centralized Physical Group registries. It is the intended next safe-edit surface once Python `gmsh` is available.

Add a mesh construct with explicit diagnostics:

- `pipette_suction_patch` or equivalent named local surface;
- patch on the nucleus-side capture region;
- patch centered on the pipette axis;
- patch area corresponding to the intended pipette opening;
- stable patch node ids and face ids;
- explicit normal direction;
- exported patch centroid;
- exported pressure resultant: `pressure * patch area`.

Required diagnostics:

- area;
- centroid;
- normal;
- node count;
- face count;
- node ids;
- face ids;
- pressure resultant;
- relation to pipette mouth / capture target.

The current coarse `pipette_suction_surface` can remain as a compatibility name, but refined work should clarify whether it means the full historical surface or the local patch.

## 2. NC interface local refinement

The NC interface should support both baseline continuity and failure-capable comparison.

Required features:

- region split: `nc:left`, `nc:right`, `nc:top`, `nc:bottom`;
- local refinement near the suction patch, especially `nc:right`;
- stable nucleus-side and cytoplasm-side node mapping;
- explicit support for:
  - `conformal-shared-node` baseline;
  - `separated-contact` comparison;
  - future cohesive / failure interface candidate;
- valid solver-active faces only for regions that have actual element faces;
- node-data/proxy observations separated from native face-data failure evidence.

Known rule:

- shared-node NC output can prove displacement continuity;
- it cannot prove native NC contact/cohesive failure;
- native NC failure requires a failure-capable interface output path.

## 3. Pipette surface vocabulary cleanup

Avoid overloading `pipette_contact_surface`.

Preferred vocabulary for refined models:

- `pipette_mouth_surface`
  - rigid pipette mouth / device-side left face;
- `pipette_mouth_patch`
  - the rigid pipette-mouth band aligned with the deformable suction patch;
- `pipette_suction_patch`
  - deformable nucleus-side pressure-load patch;
- `pipette_capture_patch`
  - nucleus-side capture / coupling target when a separate target is needed;
- `pipette_contact_surface`
  - legacy / compatibility alias only, unless explicitly redefined.

The model should not rely on easier outer-cell contact outputs as the final physical convention. Outer-cell suction cases remain diagnostic bridges.

## 4. Cell-dish support refinement

Cell-dish support should remain controlled while suction and NC failure are refined.

Required features:

- preserve center / left / right dish-top region split;
- refine the cell bottom / dish contact region if it becomes a limiting support artifact;
- keep gap, normal support, tangential force, and pressure diagnostics separate;
- avoid interpreting global fan-out plotfile contact traction as region-resolved damage.

## 5. Mesh levels

Use staged mesh levels instead of one large unreviewable rewrite.

Suggested levels:

- `s7-debug-local-nucleus`
  - current pipeline-validation mesh;
- `s10-local-suction-patch`
  - adds local nucleus-side suction patch only;
- `s10-nc-refined`
  - refines NC interface and pairing around the suction side;
- `s10-pipette-nc-refined`
  - aligns pipette mouth / suction patch / NC interface refinement;
  - S10-I implements this as a behavior-preserving transition from S10-H: `88 -> 96` nodes, `17 -> 19` elements, `21 -> 23` named surfaces, with `pipette_mouth_patch` aligned to `pipette_suction_patch`;
- `s11-convergence-candidate`
  - candidate mesh family for pressure-threshold re-evaluation.

Each new level should have explicit mesh diagnostics and should preserve the native execution path.

## Mesh diagnostics required before physical threshold claims

Before pressure thresholds are interpreted physically, the model should report:

- element count;
- face count by named surface;
- suction patch area / centroid / normal;
- NC region face counts;
- NC node-pair mapping count;
- invalid or missing solver-active faces;
- min jacobian or available quality proxy;
- inverted element count if available;
- suspicious aspect-ratio or degeneracy warnings if available;
- cell-dish region contact area summaries;
- pressure resultant by pressure-loaded surface.

## Roadmap implication

S9 is closed as native NC failure pipeline validation. S10 begins mesh refinement for the physical suction model. The immediate S10 gate is the Gmsh baseline path: native mesh JSON dump -> `.geo` generation -> gmsh `.msh` v2 ASCII -> parser -> Physical Group surface mapping -> native mesh object -> `validateNativeMesh` -> `buildNativeFebioExport` -> FEBio CLI baseline comparison.

Suggested next stages:

- S9: native NC failure pipeline validation;
- S10: local suction patch and NC interface mesh refinement;
- S11: refined NC failure-capable interface comparison;
- S12: mesh convergence and pressure-threshold calibration.
