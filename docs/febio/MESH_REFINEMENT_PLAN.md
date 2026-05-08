# Mesh Refinement Plan

This document owns the plan for moving from the current debug / provisional native FEBio model to a more physical suction model. It should be used after the native execution, output, diagnostic, conversion, and classification paths are validated on the simpler model.

## Positioning

S9 closed as pipeline validation, not final pressure-threshold calibration. S10 starts the physical mesh refinement path.

The current coarse / debug mesh can prove that:

- nucleus-side pressure can be declared in the native spec;
- pressure-load response can be observed on the suction surface;
- shared-node NC coupling cannot prove native NC failure;
- separated-contact NC comparisons can emit native NC damage/failure outputs;
- converter / diagnostics / classification can distinguish pressure response, proxy displacement, shared-node continuity, and native NC failure.

The current coarse mesh should not be used to claim final physical detachment pressure. Pressure thresholds from this mesh are provisional pipeline evidence only.

## Refinement goals

The first physical-model refinement target is a local nucleus-side suction patch and a more useful NC interface mesh.

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

S9 is closed as native NC failure pipeline validation. S10 begins mesh refinement for the physical suction model.

Suggested next stages:

- S9: native NC failure pipeline validation;
- S10: local suction patch and NC interface mesh refinement;
- S11: refined NC failure-capable interface comparison;
- S12: mesh convergence and pressure-threshold calibration.
