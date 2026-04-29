# Native Model Refinement Strategy

This document defines the next model-refinement path after the S7-E orientation baseline.

## Baseline

S7-E is the reference state for native-only FEBio work:

- `pipette_suction_surface` is deformable-side.
- `pipette_suction_surface` normal is `-x`.
- negative suction pressure is intended to pull toward `+x`.
- `conventionWarnings` is empty.
- the regenerated CLI run terminates normally with no FEBio warnings or errors.

New model work should evolve the current native path in place. Do not create a parallel refined export path or a second refined case just to avoid touching the active model. Use git history, generated artifacts, and the S7-E notes as the rollback/reference point.

## Refinement Order

Proceed in this order:

```text
S7-E warning-free orientation baseline
-> refine the current native mesh/model in place
-> cell-dish solver-active contact
-> nucleus-cytoplasm coupling refinement
-> pipette-cell / pipette-nucleus role separation
-> cohesive / detachment validation
```

Do not change all contact systems at once. Each step must regenerate `.feb`, run FEBio CLI, and compare warnings, displacement, contact output, and rigid reaction against the previous baseline.

## Current Mesh Refinement Design

The first refinement target is the current `S7_native_baseline` path.

Do not add `S7_refined_cell_dish.native.json`, a parallel export directory, or a second mesh path for this step. Improve the active native mesh/model directly, while keeping each change small enough to regenerate and verify.

Minimum requirements:

- keep the S7-E coordinate convention unchanged;
- keep `pipette_suction_surface = -x`;
- keep `pipette_contact_surface` in FEBioStudio-compatible element-face winding;
- keep `cell_dish_surface = -z`;
- keep `dish_contact_surface = +z`;
- split the cell bottom into left / center / right contact bands with stable quad winding;
- make the dish top contact band geometrically compatible with the cell bottom bands;
- avoid zero-thickness or highly skewed hexahedra around the cell bottom;
- keep `conventionWarnings = []` before enabling cell-dish contact.

The initial implementation should modify the existing active files:

```text
febio_cases/native/S7_baseline.native.json
src/febio/native/mesh.ts
src/febio/native/interfaces.ts
src/febio/native/model.ts
src/febio/native/xml.ts
febio_exports/S7_native_baseline/
```

S7-G implementation result:

- the current `S7_native_baseline` mesh now refines the dish top in place;
- `dish` is split into three elements: left / center / right;
- `dish_contact_surface` is split into three compatible quad facets;
- `cellDishBands.mode` is `in-place-current-native`;
- `conventionWarnings` remains empty;
- regenerated FEBio CLI run terminates normally with no `Warning:`, `ERROR`, `Negative jacobian`, or `No force acting` entries in the FEBio log.

This is still the same active path. It is not a separate refined case.

## Studio Handoff Warning Root Cause

The S7-K handoff cleanup fixed a FEBioStudio-specific warning/export failure that was not a FEBio CLI solver failure.

Root causes:

- The active `.feb` was serializing diagnostic-only NodeSets, Surfaces, and SurfacePairs into the `<Mesh>` section.
- FEBioStudio imported those diagnostic mesh items as named selections, then reported them as unused model selections.
- On Studio re-export/save, those unused selections could be rewritten as internal `nodesetNN` references; this produced the observed `Invalid reference to mesh item list when exporting: nodeset24` failure.
- Several diagnostic surfaces for the retired nucleus-cytoplasm contact path were still serialized even after the active solver path moved to conformal/shared-node coupling.
- `pipette_contact_surface` used a face order that FEBio CLI accepted, but FEBioStudio flagged as incorrect winding for the rigid mouth element.

Current guardrail:

- Solver-facing XML must serialize only mesh items referenced by active boundary conditions, loads, contacts, and active logfile outputs.
- Diagnostic-only selections may remain in `S7_native_baseline_native_model.json`, but should not be emitted into the `.feb` `<Mesh>` section unless they are active solver inputs.
- When adding a new surface, check both native `conventionWarnings=[]` and FEBioStudio import. CLI normal termination alone is not enough to prove Studio handoff cleanliness.
- If a contact is omitted from solver XML, remove its SurfacePair and contact-only diagnostic outputs from the solver-facing `.feb`.
- Re-run both checks after changing `src/febio/native/mesh.ts`, `src/febio/native/model.ts`, or `src/febio/native/xml.ts`: `npm test`, then FEBio CLI log grep for `Warning:` / `WARNING` / `ERROR` / `Negative jacobian` / `No force acting` / `No contact pairs`.

## Cell-Dish Contact Reactivation

Current status:

- surfaces and diagnostics are active;
- `cell_dish_interface` is solver-active again in the current baseline;
- the S7-H regenerated run terminates normally without `Warning:`, `ERROR`, `Negative jacobian`, or `No force acting` entries;
- `febio_interface_cell_dish.csv` is emitted, but final cell-dish contact pressure is still near zero.

Reactivation prerequisites:

- current active mesh validates structurally after the refinement;
- cell / dish normals are opposed;
- FEBio read succeeds;
- pressure-driven suction still runs without warning;
- displacement is nonzero;
- enabling `cell_dish_interface` does not introduce negative jacobian.

S7-H result:

- `cell_dish_interface` was reactivated as `tied-elastic` on the current native path;
- `conventionWarnings` stayed empty;
- final rigid pipette reaction stayed nonzero;
- final pipette-cell contact pressure stayed nonzero;
- the next question is no longer whether the contact can run, but whether the cell-dish output is physically useful or needs contact/geometry tuning.

S7-I output validation result:

- `febio_interface_cell_dish.csv` and localCd CSVs are generated;
- localCd left / center / right final contact pressure is 0;
- final rigid pipette reaction is nonzero (`Fx=12.6032884237`);
- final pipette-cell contact pressure is nonzero (`0.734806068177`);
- nucleus displacement is nonzero (`ux ~= -5.095 um` on the right-side output nodes);
- cytoplasm displacement is near zero.

The next refinement target is force-transfer coupling, not a new export path. The active hypothesis is that the current model drives nucleus-side suction and pipette reaction, but does not yet transfer enough load through nucleus-cytoplasm / cytoplasm / dish to make cell-dish output physically useful.

S7-J force-transfer result:

- `nucleus_cytoplasm_interface` is no longer emitted as a solver contact in the active native XML;
- nucleus and cytoplasm are coupled through shared interface nodes in the current active mesh;
- the conformal/shared-node coupling avoids FEBio tied-contact `No contact pairs found` warnings;
- regenerated FEBio CLI run terminates normally with no `Warning:`, `ERROR`, `Negative jacobian`, or `No force acting` entries;
- final max nucleus displacement is `7.316857217329245 um`;
- final max cytoplasm displacement is `7.316857217329245 um`;
- final pipette-cell contact pressure is `0.146713403788`;
- final rigid reaction is `Fx=1.25657369944`, `Fz=44.8382906929`;
- cell-dish pressure remains 0, with positive contact gaps.

S7-K handoff-cleanup result:

- the active `.feb` mesh section now exports only solver-facing NodeSets, Surfaces, and SurfacePairs;
- diagnostic-only selections remain available in `S7_native_baseline_native_model.json`, but are not serialized as Studio named selections;
- `pipette_contact_surface` winding follows FEBioStudio's element-face order;
- `pipette_nucleus_contact` is omitted after shared-node nucleus-cytoplasm coupling because the stabilizer is no longer required;
- regenerated FEBio CLI run terminates normally with no `Warning:`, `ERROR`, `Negative jacobian`, `No force acting`, or `No contact pairs` entries;
- FEBioStudio import shows no warning dialog, and Studio save succeeds as `S7_native_baseline.fsm`.

The next refinement target is cell-dish load-bearing. The current model now transfers force into the cell body, but the basal surface is not yet producing load-bearing cell-dish pressure.

S7-K baseline diagnostics result:

- contact pair diagnostics now include primary/secondary centroids, centroid delta, signed normal gap, and normal gap magnitude;
- the regenerated native model reports `normalGapMagnitude=0` and normal dot `-1` for cell-dish left / center / right, so initial basal separation is not the current blocker;
- regenerated FEBio CLI run remains warning-free and reaches normal termination;
- final cell-dish pressure remains 0 with final gaps `[0.0466542077989, 0.0429836539341, 0.0566542533992]` after the current `normalStiffness=15.5` baseline;
- final pipette-cell pressure and rigid reaction are also 0 after `pipette_nucleus_contact` was omitted, so pipette interaction needs Studio confirmation before another solver-facing redesign;
- scratch `sliding-elastic` / `sticky` cell-dish contact variants fail immediately with negative jacobian, while a basal settling pressure variant runs but still produces zero cell-dish pressure.
- `scripts/diagnose_febio_native_run.mjs --run-dir febio_exports/S7_native_baseline/jobs --base-name S7-K_S7_native_baseline` summarizes the active CLI run gates. The current state is `warningFree=true`, `cellDishPressureActive=false`, `cellDishContactForceActive=true`, `cellDishNormalSupportActive=false`, `cellDishTangentialForceActive=true`, `cellDishPressureForceMismatch=true`, `cellDishGapControlled=true`, `pipetteInteractionActive=false`, and `nucleusCytoplasmMoved=true`.
- S7-K active artifacts use the `S7-K_S7_native_baseline` base name so Studio/CLI outputs can be distinguished from earlier S7 handoffs.
- FEBioStudio can create unstable internal `nodesetNN` references when logfile `node_data` records contain inline node id lists. The active XML now emits explicit logfile NodeSets and references them through `node_set` attributes to avoid Run-before-save failures such as `Invalid reference to mesh item list ... nodeset04`.
- Studio post view shows `contact force Magnitude` as 0 at Time 0 and nonzero along the cell bottom / dish-adjacent band at Time 5. This means plotfile contact force may contain load-bearing information even while logfile face-data `contact pressure` remains all-zero; do not treat face-data pressure alone as the final load-bearing verdict.
- A minimal native `.xplt` diagnostic now reads plotfile face `contact force` directly and projects it into cell-dish normal/tangential components. For `S7-K_S7_native_baseline.xplt`, max tangential force is `25.5978221893`, max normal force is `1.7637732029`, and `normalToTangentialRatio=0.0689032524`. The current basal contact response is therefore real but mostly horizontal / shear, with comparatively weak dish-normal support.
- The `.xplt` diagnostic also maps plotfile face item ids back to surface names. The active contact force rows are `itemId=1 -> cell_dish_surface` and `itemId=2 -> dish_contact_surface`; `pipette_suction_surface` and `pipette_contact_surface` remain zero in the current run.
- Raising cell-dish `normalStiffness` from `1.55` to `15.5` keeps the CLI run warning-free and reduces final cell-dish max gap from about `0.57` to `0.0566542533992`. This creates a useful intermediate gate, `cellDishGapControlled=true`, but face-data `contact pressure` remains zero and the plotfile contact-force Z/X ratio remains low (`0.0689032524`).
- S7-L adds optional `loads.cellDishNormalPreload` without changing the S7-K baseline. The comparison case `S7-L_S7_normal_preload` applies `0.05 kPa` positive pressure on `cell_dish_surface`, runs warning-free, keeps `cellDishGapControlled=true`, and improves `normalToTangentialRatio` from about `0.0689` to `0.1424`.
- The S7-L preload is helpful but insufficient: face-data contact pressure remains zero, `cellDishPressureForceMismatch=true`, and `cellDishNormalSupportActive=false` because the ratio is still below `0.2`. Prefer a bounded preload amplitude sweep before replacing the tied-elastic contact law.
- S7-M applies `0.10 kPa` preload in `S7-M_S7_normal_preload_high`, runs warning-free, keeps `cellDishGapControlled=true`, and reaches `cellDishNormalSupportActive=true` with `normalToTangentialRatio=0.3445258323`.
- S7-M still has `cellDishPressureActive=false` and `cellDishPressureForceMismatch=true`, so the remaining issue is output-channel interpretation rather than absence of cell-dish normal support.
- S7-N updates converter/import semantics so `native-plotfile-contact-traction` can populate localCd normal stress when face-data pressure is zero and a plotfile bridge payload is available.
- S7-O automatically extracts `cell_dish_surface` contact-force rows from real `.xplt` into a global localCd bridge. The converted S7-M result now carries `native-plotfile-contact-traction` for localCd normal/damage/shear with `peakCdNormal=8.846848487854004`.
- S7-P records that bridge as global fan-out, not region-resolved localCd force, with `regionScope=global`, `payloadRegion=__global`, `spatialResolution=global-surface`, and `fanoutFallback=true` in result metadata and import state.
- Prefer region-specific plotfile surfaces if they become available. Until then, keep S7-M as the cell-dish normal-support candidate and return to the inactive pipette interaction gate.
- S7-Q splits pipette diagnostics into pressure, rigid reaction, and plotfile force channels. On S7-M all pipette channels are inactive, so S7 closes as diagnostic-complete and carries pipette coupling forward as the next model-side blocker.
- S8-A adds pre-run pipette coupling readiness diagnostics. The current suction and rigid mouth surfaces have matching `-x` normals and zero normal gap, but are tangentially offset by `8.5 um`; this explains why declared pressure can still fail to reach contact/reaction channels.

Rollback point:

- if cell-dish contact causes divergence or negative jacobian, revert only the cell-dish contact activation for that case;
- if a mesh refinement validates but contact activation fails, keep the mesh only when the generated active baseline still runs cleanly without active cell-dish contact;
- do not weaken the S7-E pressure / orientation convention to make cell-dish pass.

## Contact Roles

The active meaning of each contact path is:

- `pipette_cell_contact`: the pressure-driven suction inspection contact. It uses `pipette_cell_pair`, with pressure on `pipette_suction_surface`.
- `pipette_nucleus_contact`: omitted in the active XML after shared-node nucleus-cytoplasm coupling. It remains a model-side reference path, not the primary physical suction surface.
- `nucleus_cytoplasm_interface`: currently conformal/shared-node force-transfer coupling. It is not emitted as a FEBio contact; cohesive law is deferred until the mesh/load path is stable.
- `cell_dish_interface`: solver-active, warning-free, but not yet load-bearing in pressure output.

After the current mesh is stable, reduce or redesign stabilizer roles in this order:

```text
cell-dish load-bearing output
-> pipette-cell contact stable
-> weaken pipette-nucleus stabilizer
-> restore or replace nucleus-cytoplasm cohesive law
-> introduce true traction-separation law
```

## Validation Gates

Each refinement step must report:

- generated `.feb` path;
- FEBio log path;
- warning count;
- error count;
- `conventionWarnings`;
- whether `febio_pipette_cell_contact.csv` is nonzero;
- whether `febio_rigid_pipette.csv` reaction is nonzero;
- whether `.xplt` contact force is nonzero on `pipette_suction_surface` or `pipette_contact_surface`;
- whether `pressureDiagnostics.couplingReadiness.ready` is true before expecting nonzero pipette force channels;
- whether nucleus and cytoplasm displacement outputs are nonzero.

The next implementation unit is:

```text
Refine the existing S7_native_baseline mesh/model in place,
starting with cell-dish load-bearing after S7-J shared-node force transfer.
```
