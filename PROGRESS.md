# FEBio Progress

Last updated: 2026-04-28

`PROGRESS.md` is the current-state file. Historical detail is retired when a milestone completes or when the active milestone changes. Durable lessons stay here or move to dedicated docs.

## Current summary

- Goal: make the FEBio solver condition physically meaningful enough to evaluate nucleus detachment from cytoplasm through solver-active outputs.
- Active solver work uses the native-only path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`.
- Legacy UI / canonical / bridge paths are compatibility-only and must not be used for new solver behavior.
- S7-E geometry convention is fixed. `pipette_suction_surface` is deformable-side, normal `-x`, and negative pressure pulls toward `+x`.
- S7-J changed nucleus-cytoplasm force transfer from solver contact to shared-node coupling.
- Active milestone: S7-K. Cell-dish contact is solver-active and warning-free, but pressure / force / normal support diagnostics need to be split.

## Important retained findings

- Active FEBio export and validation use only the native-only path.
- Do not weaken the S7-E pressure / orientation convention to make cell-dish pass.
- Solver-facing `.feb` should emit only active solver mesh items. Diagnostic-only selections stay in native model JSON.
- FEBioStudio can create unstable internal `nodesetNN` references when logfile node data uses inline node ids. Use explicit NodeSets and `node_set` references.
- FEBio logfile rows can be whitespace-delimited even when XML requests comma delimiter. Parsers must be comma / whitespace tolerant.
- `cellDishLoadBearing=false` in older diagnostics mainly means face-data contact pressure is zero. It does not prove that cell-dish force is absent.
- S7-K shows nonzero `.xplt` contact force on the cell-dish pair and improved gap control, but weak dish-normal support and zero face-data pressure.
- Cell-dish load-bearing must be evaluated as pressure, plotfile force, normal support, tangential force, and gap control.

## Active milestone: S7-K Cell-Dish Load-Bearing Diagnostic Split

### Current facts

- `cell_dish_interface` is solver-active.
- Initial cell-dish normal gap is 0 and left / center / right normals are opposed.
- FEBio CLI run is warning-free normal termination.
- `normalStiffness=15.5` reduced final max cell-dish gap to about `0.0566542533992 um`.
- Logfile face-data contact pressure remains 0.
- Studio / `.xplt` contact force is nonzero on the cell-dish pair.
- `.xplt` surface item map identifies `itemId=1` as `cell_dish_surface` and `itemId=2` as `dish_contact_surface`.
- Contact force is mostly horizontal / shear; dish-normal support is weak.

### Current interpretation

Cell-dish is no longer simply missing. Contact force and gap control are present, while face-data pressure and dish-normal support remain insufficient. The next step is diagnostic separation, not broad contact-law rewrites.

### Next bounded task

- Split run diagnostic gates into:
  - `cellDishPressureActive`
  - `cellDishContactForceActive`
  - `cellDishNormalSupportActive`
  - `cellDishTangentialForceActive`
  - `cellDishGapControlled`
- Project `.xplt` contact force into normal and tangential components.
- Report the pressure-zero / force-nonzero mismatch explicitly.
- Then choose the next smallest model change from normal preload, contact law, basal constraint, or lift balance.

### Done condition

- Current run is explainable through the split gates above.
- warning-free CLI run is preserved.
- Studio handoff assumptions are preserved.
- The next model-side change can be selected from the diagnosed evidence.

## Files to open next

- `src/febio/native/runDiagnostics.ts`
- `src/febio/native/xpltDiagnostics.ts`
- `scripts/diagnose_febio_native_run.mjs`
- `febio_exports/S7_native_baseline/S7-K_S7_native_baseline_native_model.json`
- `febio_exports/S7_native_baseline/jobs/S7-K_S7_native_baseline.log`
- `febio_exports/S7_native_baseline/jobs/S7-K_S7_native_baseline.xplt`
- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`

## Reference docs

- `docs/ops/ROADMAP.md`
- `ACTIVE_FILES.md`
- `docs/febio/FEBIO_PATH_OWNERSHIP.md`
- `docs/febio/FEBIO_NATIVE_SPEC.md`
- `docs/febio/GEOMETRY_CONVENTIONS.md`
- `docs/febio/NATIVE_MODEL_REFINEMENT_STRATEGY.md`
- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`
- `docs/febio/CELL_DISH_LOAD_BEARING_DIAGNOSTICS.md`

## Completed milestone summary

- S7-A/B/C: established direct native-spec handoff and pressure/contact response scope; old artifacts live under `legacy/febio_exports/`.
- S7-D: added native-only FEBio export path and regression tests against UI/canonical/legacy adapter usage.
- S7-E: fixed coordinate, surface normal, pressure sign, and contact pair convention.
- S7-F: fixed refinement strategy: evolve the active native baseline, not a parallel refined case.
- S7-G/H: split dish top into left / center / right bands and restored warning-free solver-active cell-dish contact.
- S7-I: found cell-dish pressure output remained zero and force transfer to cell body was weak.
- S7-J: switched nucleus-cytoplasm to shared-node coupling and made cytoplasm displacement nonzero.
- S7-K so far: cleaned Studio handoff, added explicit NodeSet logfile output, `.xplt` contact-force parsing, delimiter-tolerant CSV parsing, and gap-control diagnostics.

## PROGRESS.md log retirement rule

When a milestone completes or stops being active:

1. Extract durable lessons into `Important retained findings`.
2. Move incident causes to `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`.
3. Move specialized diagnostic rules to dedicated `docs/febio/` documents.
4. Delete transient run logs and scratch observations from `PROGRESS.md`; git history remains the archive.
5. Keep completed milestones to 1-3 line summaries.

Only the active milestone should keep detailed current facts, interpretation, next task, and done condition.

## Work granularity rule

Do not stop after only adding a placeholder, TODO, helper, or docs note when implementation and tests for the same milestone are clearly still pending. Continue until a done condition, blocker, human confirmation gate, or environment limit is reached.
