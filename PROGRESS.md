# FEBio Progress

Last updated: 2026-05-07

`PROGRESS.md` は current-state file。run log、scan table、長い比較履歴は置かない。完了済み詳細は `docs/febio/*DIAGNOSTICS.md` または `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md` に退役させる。

## Current summary

- Goal: FEBio solver-native output で、核が細胞質から剥離する条件を評価できる物理・診断経路を作る。
- Active solver path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`。
- Legacy UI / canonical / bridge paths は compatibility-only。新しい solver behavior には使わない。
- Current phase: S10 local suction patch and NC interface mesh refinement.
- S7 is diagnostic closure. S8 returned to nucleus-side pressure and separated pressure response, direct contact, proxy detachment, shared-node continuity, and native NC failure evidence. S9 closed the native NC failure output / conversion / classification pipeline on the simplified separated-contact comparison.
- Active milestone: S10 Local Suction Patch Mesh Refinement.
- S10 plan source: `docs/febio/MESH_REFINEMENT_PLAN.md`.

## Important retained findings

- Active FEBio export and validation use only the native-only path.
- The current coarse / debug mesh can validate execution, output, diagnostics, conversion, and classification paths, but it must not be used to claim final physical detachment pressure.
- The target physical suction model applies pressure to a local nucleus-side capture patch. Outer-cell suction surfaces are diagnostic bridges only.
- S8-M is the warning-free physical shared-node baseline for nucleus-side pressure response.
- Shared-node NC coupling can prove displacement continuity but cannot prove native NC contact/cohesive failure.
- Native NC failure evidence uses native face-data damage only. Proxy-only top/bottom NC damage can appear in summaries but must not activate `nativeNcInterfaceFailure`.
- Future physical threshold work needs a refined local suction patch, NC interface refinement, and mesh-level diagnostics before pressure thresholds are interpreted physically.
- Pipette interaction must be evaluated as declared suction pressure load, pressure-load response, direct contact pressure, rigid reaction, and pipette `.xplt` force separately.
- Cell-dish load-bearing must be evaluated as pressure, plotfile force, normal support, tangential force, and gap control.
- FEBio logfile rows can be whitespace-delimited even when XML requests comma delimiter. Parsers must be comma / whitespace tolerant.
- FEBioStudio can create unstable internal `nodesetNN` references when logfile node data uses inline node ids. Use explicit NodeSets and `node_set` references.
- Solver-facing `.feb` should emit only active solver mesh items. Diagnostic-only selections stay in native model JSON.

## Active milestone: S10 Local Suction Patch Mesh Refinement

### Current facts

- S8-M remains the physical shared-node nucleus-side pressure-response baseline.
- S9 is closed as pipeline validation, not final pressure calibration.
- The current warning-free native NC failure example is S9-E at `-1.7 kPa`: native NC failure active, damage `0.6155186249313224`, `firstFailureSite="nc:right"`.
- S9-D at `-1.55 kPa` remains a warning-free below-threshold partial-damage point: native right NC damage `0.23435479253090608`, native failure inactive.
- Detailed S9 scan evidence is retained in `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`.
- Physical pressure-threshold calibration is deferred until after local suction patch and NC interface mesh refinement.
- S10-A added `meshMode="s10-local-suction-patch"` and a solver-facing `pipette_suction_patch` surface without changing existing S8/S9 cases.
- S10-A export is ready at `febio_exports/S10_local_suction_patch/`. Static diagnostics report patch area `6.5 um^2`, centroid `[14, 0, 17]`, normal `-x`, nodes `[82,83,86,87]`, face `[24]`, and declared pressure resultant `4.55 nN` at `-0.7 kPa`.
- S10-A Windows FEBio CLI run reached normal termination with no solver warnings, errors, negative jacobian, no-force, or no-contact-pair messages. Artifacts are in `febio_exports/S10_local_suction_patch/febio_runs/S10-A_S10_local_suction_patch/`.
- S10-A pressure-load response is active on `pipette_suction_patch`: observed 4/4 patch nodes, max displacement `1.1628959591041037 um`, max normal displacement `1.1518070494 um`.
- S10-A direct pipette contact channels remain inactive: pipette-cell pressure `0`, pipette mouth pressure `0`, rigid reaction `0`, pipette plotfile force inactive. Cell-dish support is active through plotfile force while face-data pressure remains zero.
- S10-A converted classification is proxy-derived `nucleus_detached`; native NC interface failure remains unavailable/inactive because the S10-A baseline uses conformal shared-node NC coupling.
- S10-B added `febio_cases/native/S10_local_suction_patch_nc_right_refined.native.json`, preserving the local `pipette_suction_patch` while enabling separated solver-active NC comparison and splitting the S10 nucleus left/right contact facets around the patch band.
- S10-B export is ready at `febio_exports/S10_local_suction_patch_nc_right_refined/`. Static diagnostics remain valid/warning-free and keep patch area `6.5 um^2`, centroid `[14, 0, 17]`, normal `-x`, nodes `[82,83,86,87]`, face `[24]`, and declared pressure resultant `4.55 nN`.
- S10-B Windows FEBio CLI run reached normal termination with no solver warnings, errors, negative jacobian, no-force, or no-contact-pair messages. Artifacts are in `febio_exports/S10_local_suction_patch_nc_right_refined/febio_runs/S10-B_S10_local_suction_patch_nc_right_refined/`.
- S10-B pressure-load response is active on `pipette_suction_patch`: observed 4/4 patch nodes, max displacement `1.2597331654442678 um`, max normal displacement `1.24485318688 um`.
- S10-B native NC output is solver-facing and active for left/right separated contact; plotfile contact force is nonzero on both left and right NC surfaces. Native NC failure remains inactive at `-0.7 kPa` with damage `0`, so converted `nucleus_detached` classification remains proxy-derived.

### Current interpretation

The active problem remains physical-model geometry and pressure schedule calibration, not evidence plumbing. The simplified separated-contact comparison proves native NC failure outputs can be emitted, converted, and classified warning-free. S10-A proves the local suction pressure-load response; S10-B proves local-patch plus solver-active left/right NC output can run warning-free at baseline pressure.

### Next bounded task

Start the next S10 mesh increment: pressure / refinement scan on the S10-B local-patch separated-NC geometry.

Next implementation checklist:

- keep S10-A as the warning-free local-patch pressure-response baseline;
- use S10-B as the warning-free local-patch separated-NC baseline;
- add bounded pressure variants or a small scan on S10-B to find where native NC damage starts;
- continue treating direct pipette contact output as separate from declared pressure-load response;
- preserve S8-M/S9 as baselines and keep S10 pressure threshold interpretation explicitly deferred until the refined geometry scan is complete.

### Done condition

- S10 has a solver-facing local suction patch separate from the historical broad `pipette_suction_surface` meaning.
- S10-B has solver-active separated left/right NC outputs around the local patch and runs warning-free in Windows FEBio CLI.
- Exported native model diagnostics report local patch geometry and declared pressure resultant.
- Existing S8-M/S9 pipeline-validation behavior remains available for comparison.
- FEBio CLI confirmation for S10-A and S10-B is complete; Studio visual confirmation remains useful for surface orientation / pressure arrow review.
- `PROGRESS.md` stays compact and points to the next S10 mesh refinement increment.

## Files to open next

- `docs/febio/MESH_REFINEMENT_PLAN.md`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `febio_cases/native/S8_pipette_nucleus_pressure_return.native.json`
- `febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json`
- `febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_1p7.native.json`
- `febio_cases/native/S10_local_suction_patch.native.json`
- `febio_cases/native/S10_local_suction_patch_nc_right_refined.native.json`
- `src/febio/native/caseSpec.ts`
- `src/febio/native/mesh.ts`
- `src/febio/native/outputs.ts`
- `src/febio/native/runDiagnostics.ts`
- `scripts/export_febio_native_case.mjs`
- `scripts/diagnose_febio_native_run.mjs`
- `scripts/convert_febio_output.mjs`
- `src/results/classification.ts`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`

## Reference docs

- `docs/ops/ROADMAP.md`
- `ACTIVE_FILES.md`
- `docs/febio/FEBIO_PATH_OWNERSHIP.md`
- `docs/febio/FEBIO_NATIVE_SPEC.md`
- `docs/febio/GEOMETRY_CONVENTIONS.md`
- `docs/febio/NATIVE_MODEL_REFINEMENT_STRATEGY.md`
- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `docs/febio/MESH_REFINEMENT_PLAN.md`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`

## Completed milestone summary

- S7: native-only export path, geometry convention, cell-dish split diagnostics, cell-dish support baseline, and plotfile-backed localCd bridge are established.
- S8-A-L: pipette force-channel diagnostics identified outer-cell cases as useful diagnostic bridges but not the target physical model.
- S8-M-Q: returned to nucleus-side pressure, added pressure-load response evidence, and separated pressure-driven capture from direct contact capture.
- S8-R-U: regenerated / interpreted S8-M artifacts and confirmed shared-node NC coupling cannot prove native NC failure.
- S8-V-Z: added shared-node NC observation, then solver-active / separated-contact NC comparisons; separated-contact left/right valid faces are the current native NC failure comparison path.
- S9-A-F: closed native NC failure pipeline validation. The simplified separated-contact pressure scan validated warning-free native NC failure activation between `-1.55 kPa` partial damage and `-1.7 kPa` active right-side normal failure; this is pipeline evidence, not final physical threshold calibration.

## PROGRESS.md retirement rule

When a milestone completes or stops being active:

1. Extract durable lessons into `Important retained findings`.
2. Stock understood major problem causes, prevention rules, or misleading diagnostic patterns in `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`.
3. Move specialized diagnostic rules and comparison details to dedicated `docs/febio/` documents.
4. Delete transient run logs and scratch observations from `PROGRESS.md`; git history remains the raw archive.
5. Keep completed milestones to 1-3 line summaries.

Only the active milestone may keep detailed current facts, interpretation, next task, and done condition. A `PROGRESS.md` update that advances the milestone must also retire stale inactive details.

## Work granularity rule

Do not stop after only adding a placeholder, helper, case JSON, or docs note when export / run / diagnosis / interpretation for the same milestone is still pending and tooling is available.

A normal implementation pass should end at a reviewable boundary: code/spec/case change plus export/diagnostic/test/docs updates where applicable. Stop earlier only for a concrete blocker, unavailable runtime/tooling, or human confirmation gate.
