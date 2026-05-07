# FEBio Progress

Last updated: 2026-05-01

`PROGRESS.md` は current-state file。run log、scan table、長い比較履歴は置かない。完了済み詳細は `docs/febio/*DIAGNOSTICS.md` または `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md` に退役させる。

## Current summary

- Goal: FEBio solver-native output で、核が細胞質から剥離する条件を評価できる物理・診断経路を作る。
- Active solver path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`。
- Legacy UI / canonical / bridge paths は compatibility-only。新しい solver behavior には使わない。
- S7 は diagnostic closure 済み。S7-M は cell-dish support の現在 baseline。
- S8 は nucleus-side pressure model へ戻した。outer-cell suction cases は force-channel activation を確認する diagnostic bridge であり、本命 geometry ではない。
- Active milestone: S9 Native NC Failure Calibration。

## Important retained findings

- Active FEBio export and validation use only the native-only path.
- Do not weaken the S7-E pressure / orientation convention to make a single comparison pass.
- Solver-facing `.feb` should emit only active solver mesh items. Diagnostic-only selections stay in native model JSON.
- FEBioStudio can create unstable internal `nodesetNN` references when logfile node data uses inline node ids. Use explicit NodeSets and `node_set` references.
- FEBio logfile rows can be whitespace-delimited even when XML requests comma delimiter. Parsers must be comma / whitespace tolerant.
- Cell-dish load-bearing must be evaluated as pressure, plotfile force, normal support, tangential force, and gap control.
- `native-plotfile-contact-traction` may currently be a global fan-out source for localCd. Do not read it as region-resolved force unless source-detail metadata says so.
- Pipette interaction must be evaluated as declared suction pressure load, pressure-load response, direct contact pressure, rigid reaction, and pipette `.xplt` force separately.
- The target physical suction model applies pressure to the nucleus-side capture surface. Outer-cell suction surfaces are diagnostic bridges only.
- S8-M is the warning-free physical shared-node baseline for nucleus-side pressure response.
- Shared-node NC coupling can prove displacement continuity but cannot prove native NC contact/cohesive failure.
- Native NC failure evidence uses native face-data damage only. Proxy-only top/bottom NC damage can appear in summaries but must not activate `nativeNcInterfaceFailure`.

## Active milestone: S9 Native NC Failure Calibration

### Current facts

- S8-M: warning-free nucleus-side pressure baseline. Pressure load is declared and active, suction-surface displacement response is observed on all four suction nodes, cell-dish support remains controlled, and direct pipette contact/rigid channels remain separate diagnostics.
- S8-W: solver-active NC comparison can emit NC face/plotfile outputs warning-free, but native NC failure remains inactive under baseline pressure.
- S8-X: separated-contact NC comparison at `-0.7 kPa` is warning-free and creates relative NC kinematics while staying below failure thresholds.
- S8-Z: invalid separated-contact facet warnings were fixed by emitting solver-active NC comparison contacts only for valid left/right element faces. Top/bottom NC observations remain node-data/proxy diagnostics.
- S9 pressure boundary so far:
  - `-1.55 kPa`: warning-free, partial native right NC damage `0.23435479253090608`, native failure inactive.
  - `-1.7 kPa`: warning-free, native NC failure active, damage `0.6155186249313224`, `firstFailureSite="nc:right"`.
  - `-1.85 kPa`: warning-free, near-complete native damage `0.9966432842754073`, `firstFailureSite="nc:right"`.
- Useful warning-free native NC failure transition is currently bounded between `-1.55 kPa` and `-1.7 kPa`.

### Current interpretation

The active problem is no longer whether nucleus-side pressure can move the tissue. It can. The active problem is how to calibrate or accept the native NC failure boundary in the separated-contact comparison while keeping S8-M as the physical shared-node baseline.

S9 should resolve one coherent decision: whether the current `-1.55` to `-1.7 kPa` native failure transition is good enough for the next model stage, or whether a smaller pressure refinement / threshold calibration is needed.

### Next bounded task

Complete one S9 decision unit; do not stop after a single small edit.

Acceptable completion paths:

1. Boundary refinement path:
   - add one or more targeted pressure cases inside `[-1.55, -1.7] kPa`;
   - export / run / diagnose / convert when tooling is available;
   - update `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md` with the result details;
   - update this file with only the new accepted boundary.

2. Boundary acceptance path:
   - accept `-1.55` to `-1.7 kPa` as the current warning-free native NC failure transition;
   - document that the next stage should tune pressure calibration, NC threshold calibration, or both;
   - record the reusable lesson in `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md` if it is not already covered.

Constraints:

- Preserve S8-M geometry and pressure-load interpretation. Do not create easier outer-cell geometry to obtain contact outputs.
- Keep direct pipette outputs separate from pressure-load response and native NC failure evidence.
- Keep S8-Y as high-pressure diagnostic evidence only because it has many stiffness-reformation warnings.
- Do not add long scan tables to `PROGRESS.md`; detailed scan evidence belongs in the diagnostic doc.

### Done condition

- S9 has a reviewable decision boundary: either a refined warning-free failure transition or an explicit accepted transition range.
- The result distinguishes pressure response, shared-node continuity, proxy displacement, native NC output availability, native NC failure activation, and high-pressure solver warnings.
- `PROGRESS.md` remains compact after the update.

## Files to open next

- `febio_cases/native/S8_pipette_nucleus_pressure_return.native.json`
- `febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json`
- `febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_1p55.native.json`
- `febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_1p7.native.json`
- `src/febio/native/caseSpec.ts`
- `src/febio/native/mesh.ts`
- `src/febio/native/outputs.ts`
- `src/febio/native/runDiagnostics.ts`
- `scripts/export_febio_native_case.mjs`
- `scripts/diagnose_febio_native_run.mjs`
- `scripts/convert_febio_output.mjs`
- `src/results/classification.ts`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`

## Reference docs

- `docs/ops/ROADMAP.md`
- `ACTIVE_FILES.md`
- `docs/febio/FEBIO_PATH_OWNERSHIP.md`
- `docs/febio/FEBIO_NATIVE_SPEC.md`
- `docs/febio/GEOMETRY_CONVENTIONS.md`
- `docs/febio/NATIVE_MODEL_REFINEMENT_STRATEGY.md`
- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`

## Completed milestone summary

- S7: native-only export path, geometry convention, cell-dish split diagnostics, cell-dish support baseline, and plotfile-backed localCd bridge are established.
- S8-A-L: pipette force-channel diagnostics identified outer-cell cases as useful diagnostic bridges but not the target physical model.
- S8-M-Q: returned to nucleus-side pressure, added pressure-load response evidence, and separated pressure-driven capture from direct contact capture.
- S8-R-U: regenerated / interpreted S8-M artifacts and confirmed shared-node NC coupling cannot prove native NC failure.
- S8-V-Z: added shared-node NC observation, then solver-active / separated-contact NC comparisons; separated-contact left/right valid faces are the current native NC failure comparison path.
- S9-A-F: pressure scan bounded warning-free native NC failure between `-1.55 kPa` partial damage and `-1.7 kPa` active right-side normal failure.

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
