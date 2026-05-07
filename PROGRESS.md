# FEBio Progress

Last updated: 2026-05-01

`PROGRESS.md` は current-state file。run log、scan table、長い比較履歴は置かない。完了済み詳細は `docs/febio/*DIAGNOSTICS.md` または `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md` に退役させる。

## Current summary

- Goal: FEBio solver-native output で、核が細胞質から剥離する条件を評価できる物理・診断経路を作る。
- Active solver path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`。
- Legacy UI / canonical / bridge paths は compatibility-only。新しい solver behavior には使わない。
- Current phase: simplified native model pipeline validation first, then mesh / suction patch / NC interface refinement.
- S7 is diagnostic closure. S8 returned to nucleus-side pressure and separated pressure response, direct contact, proxy detachment, shared-node continuity, and native NC failure evidence.
- Active milestone: S9 Native NC Failure Pipeline Validation.
- Next model-refinement direction after S9: S10 local suction patch and NC interface mesh refinement. See `docs/febio/MESH_REFINEMENT_PLAN.md`.

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

## Active milestone: S9 Native NC Failure Pipeline Validation

### Current facts

- S8-M: warning-free nucleus-side pressure baseline. Pressure load is declared and active, suction-surface displacement response is observed on all four suction nodes, cell-dish support remains controlled, and direct pipette contact/rigid channels remain separate diagnostics.
- S8-W: solver-active NC comparison can emit NC face/plotfile outputs warning-free, but native NC failure remains inactive under baseline pressure.
- S8-X: separated-contact NC comparison at `-0.7 kPa` is warning-free and creates relative NC kinematics while staying below failure thresholds.
- S8-Z: invalid separated-contact facet warnings were fixed by emitting solver-active NC comparison contacts only for valid left/right element faces. Top/bottom NC observations remain node-data/proxy diagnostics.
- S9 pressure scan currently proves pipeline behavior, not final physical threshold:
  - `-1.55 kPa`: warning-free, partial native right NC damage `0.23435479253090608`, native failure inactive.
  - `-1.7 kPa`: warning-free, native NC failure active, damage `0.6155186249313224`, `firstFailureSite="nc:right"`.
  - `-1.85 kPa`: warning-free, near-complete native damage `0.9966432842754073`, `firstFailureSite="nc:right"`.
- Useful warning-free native NC failure transition in the current simplified separated-contact comparison is bounded between `-1.55 kPa` and `-1.7 kPa`.

### Current interpretation

The active problem is not final pressure calibration. The mesh, suction patch, and NC interface geometry are still provisional. Therefore S9 should close as pipeline validation: the simplified model demonstrates that native NC failure outputs can be emitted, converted, and classified warning-free when the interface is failure-capable and the pressure is high enough.

The pressure range `-1.55` to `-1.7 kPa` is provisional evidence for this debug comparison only. It is useful for validating the native failure path, but it is not a final physical detachment threshold.

### Next bounded task

Close S9 as a pipeline-validation milestone, then move to S10 mesh refinement planning / implementation.

Required S9 closure content:

- state that current pressure boundary is provisional pipeline evidence;
- preserve the current warning-free native failure example;
- keep S8-M as the physical shared-node pressure-response baseline;
- record that physical pressure-threshold calibration is deferred until after mesh refinement;
- ensure detailed scan evidence lives in `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`, not in `PROGRESS.md`.

Next stage after S9:

- S10: local nucleus-side suction patch and NC interface mesh refinement.
- Use `docs/febio/MESH_REFINEMENT_PLAN.md` as the plan source.
- Priority: local suction patch -> NC interface local refinement -> pipette mouth / suction / capture vocabulary cleanup -> cell-dish support refinement -> staged mesh levels.

### Done condition

- S9 is explicitly closed as native NC failure pipeline validation, not final pressure calibration.
- The next milestone is S10 mesh refinement with local suction patch / NC interface refinement as the first physical-model improvement.
- `PROGRESS.md` remains compact after the update.

## Files to open next

- `docs/febio/MESH_REFINEMENT_PLAN.md`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `febio_cases/native/S8_pipette_nucleus_pressure_return.native.json`
- `febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json`
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
- S9-A-F: simplified separated-contact pressure scan validated warning-free native NC failure activation between `-1.55 kPa` partial damage and `-1.7 kPa` active right-side normal failure; this is pipeline evidence, not final physical threshold calibration.

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
