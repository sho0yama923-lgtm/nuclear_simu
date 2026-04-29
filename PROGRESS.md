# FEBio Progress

Last updated: 2026-04-29

`PROGRESS.md` is the current-state file. It must not become a run log. Historical detail is retired when a milestone completes or stops being active. Durable lessons stay here only as short retained findings or move to dedicated docs.

## Current summary

- Goal: make the FEBio solver condition physically meaningful enough to evaluate nucleus detachment from cytoplasm through solver-active outputs.
- Active solver work uses the native-only path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`.
- Legacy UI / canonical / bridge paths are compatibility-only and must not be used for new solver behavior.
- S7 is complete by diagnostic closure. S7-M remains the current cell-dish normal-support candidate, with `0.10 kPa` cell-dish normal preload, warning-free termination, controlled gap, and `.xplt`-backed localCd normal traction.
- S8 is focused on pipette coupling / suction force capture. S8-G restored direct pipette-cell force channels with a Studio-compatible outer-cell suction surface, but S8-G/H/I/J still have solver stiffness-reformation warnings.
- Active milestone: S8-K Direct Pipette Stabilization / Convention Cleanup.

## Important retained findings

- Active FEBio export and validation use only the native-only path.
- Do not weaken the S7-E pressure / orientation convention to make a single comparison pass.
- Solver-facing `.feb` should emit only active solver mesh items. Diagnostic-only selections stay in native model JSON.
- FEBioStudio can create unstable internal `nodesetNN` references when logfile node data uses inline node ids. Use explicit NodeSets and `node_set` references.
- FEBio logfile rows can be whitespace-delimited even when XML requests comma delimiter. Parsers must be comma / whitespace tolerant.
- `cellDishLoadBearing=false` in older diagnostics mainly means face-data contact pressure is zero. It does not prove that cell-dish force is absent.
- Cell-dish load-bearing must be evaluated as pressure, plotfile force, normal support, tangential force, and gap control.
- `native-plotfile-contact-traction` may currently be a global fan-out source for localCd. Do not read it as region-resolved force unless source-detail metadata says so.
- Pipette interaction must be evaluated as declared suction pressure load, direct pipette contact pressure, rigid reaction, and pipette `.xplt` force separately.
- S8-G/H/I/J show that amplitude-only changes, contact-penalty softening, and pressure reduction do not remove the stiffness-reformation warning while preserving direct pipette force channels.

## Active milestone: S8-K Direct Pipette Stabilization / Convention Cleanup

### Current facts

- S7-M cell-dish baseline is preserved as the cell-dish evidence point: `cellDishNormalSupportActive=true`, `cellDishGapControlled=true`, `cellDishPressureActive=false`, and localCd can use real `.xplt` contact traction through global fan-out metadata.
- S8-A found the first pipette geometry blocker: suction and mouth surfaces were normal-aligned but tangentially offset by `8.5 um`.
- S8-B removed the tangential offset and made coupling readiness true, but all pipette force channels remained inactive.
- S8-C/D restored rigid pipette reaction through capture-hold contact; S8-D also recovered cell-dish gap control, but direct pipette pressure / plotfile force remained inactive.
- S8-E ruled out simple `pipette_cell_pair` primary/secondary role ordering as the direct pipette-output blocker.
- S8-F confirmed that `pipette_suction_pressure` is declared and nonzero; S8-D/E have `pipetteSuctionPressureLoadActive=true` with resultant `12.6 nN`, while direct contact outputs remain zero.
- S8-G moved suction to a Studio-compatible outer right cell surface and restored direct pipette force channels: direct pressure, rigid reaction, suction/mouth plotfile force, and overall pipette interaction all become active.
- S8-G residual: normal termination with one stiffness-reformation warning and a mode-specific suction-normal convention exception.
- S8-H gentle motion preserves direct pipette force channels but still has one stiffness-reformation warning.
- S8-I soft contact and S8-J low pressure preserve direct force channels but increase warning count to three. Therefore, more amplitude/penalty/pressure reduction is not the next best step.

### Current interpretation

The main pipette blocker is no longer force-channel absence. S8-G/H provide a working direct pipette-force path. The current blocker is stabilization and convention cleanup: keep the outer-cell direct-force geometry, then test ramp timing / step boundaries / solver controls around the `t ~= 3.01-3.06` warning window. Also decide whether the outer-cell `+x` winding/sign exception is a diagnostic bridge or a final convention change.

### Next bounded task

- S8-K: create one bounded stabilization comparison from the S8-G/H outer-cell force-channel geometry.
- Prefer ramp/step/control changes around the warning window over more pressure, motion, or penalty reductions.
- Preserve S7-M cell-dish evidence and S8-G/H direct pipette force activation.
- Do not return to primary/secondary role or simple surface colocation unless new evidence contradicts S8-E/S8-B.
- Record any confirmed stabilization cause or convention decision in `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`; keep detailed comparison notes in `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`, not in this file.

### Done condition

- A new S8-K comparison case is exported and diagnosed, or a concrete blocker prevents that.
- The result explicitly reports warning status, direct pipette force channels, cell-dish support/gap gates, and whether the S8-G/H direct-force path is preserved.
- If warning-free is achieved, update the current baseline and document the cause/guardrail.
- If warning persists, identify the next smallest stabilization axis from evidence rather than trying another amplitude-only reduction.

## Files to open next

- `febio_cases/native/S8_pipette_outer_cell_surface.native.json`
- `febio_cases/native/S8_pipette_outer_cell_surface_gentle.native.json`
- `src/febio/native/caseSpec.ts`
- `src/febio/native/model.ts`
- `src/febio/native/mesh.ts`
- `src/febio/native/runDiagnostics.ts`
- `scripts/export_febio_native_case.mjs`
- `scripts/diagnose_febio_native_run.mjs`
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

- S7-A/B/C: established direct native-spec handoff and pressure/contact response scope; old artifacts live under `legacy/febio_exports/`.
- S7-D: added native-only FEBio export path and regression tests against UI/canonical/legacy adapter usage.
- S7-E: fixed coordinate, surface normal, pressure sign, and contact pair convention.
- S7-F: fixed refinement strategy: evolve the active native baseline, not a parallel refined case.
- S7-G/H: split dish top into left / center / right bands and restored warning-free solver-active cell-dish contact.
- S7-I/J: confirmed weak cell-dish pressure output and switched nucleus-cytoplasm force transfer to shared-node coupling.
- S7-K-M: split cell-dish diagnostics and found `0.10 kPa` normal preload reaches cell-dish normal support with warning-free run and controlled gap, while face-data pressure remains zero.
- S7-N-P: bridged real `.xplt` cell-dish contact force into localCd as `native-plotfile-contact-traction` with global fan-out metadata.
- S7-Q: split pipette diagnostics into pressure, rigid reaction, declared load, and plotfile force channels; S7 closed as diagnostic-complete.
- S8-A/B: found and removed the pipette suction/mouth tangential-offset geometry blocker; force channels remained inactive after colocation.
- S8-C-F: capture-hold restored rigid reaction and declared suction pressure was verified, but direct pipette pressure / plotfile force stayed inactive.
- S8-G: outer-cell suction surface with Studio-compatible winding restored direct pipette pressure, rigid reaction, and pipette plotfile force while preserving cell-dish support; residual warning remained.
- S8-H/I/J: gentle motion, soft contact, and low pressure all preserved direct force channels but did not remove the stiffness-reformation warning.

## PROGRESS.md log retirement rule

When a milestone completes or stops being active:

1. Extract durable lessons into `Important retained findings`.
2. Stock every understood major problem cause, prevention rule, or misleading diagnostic pattern in `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md`.
3. Move specialized diagnostic rules and comparison details to dedicated `docs/febio/` documents.
4. Delete transient run logs and scratch observations from `PROGRESS.md`; git history remains the raw archive.
5. Keep completed milestones to 1-3 line summaries.

Major causes must not live only in `PROGRESS.md`. If a failure had a non-obvious cause, could recur, silently corrupted interpretation, or produced a reusable prevention rule, it gets an incident/root-cause entry.

Only the active milestone should keep detailed current facts, interpretation, next task, and done condition. Completed milestone summaries must be compressed; do not append long comparison logs to this file.

## Work granularity rule

Do not stop after only adding a placeholder, TODO, helper, or docs note when implementation and tests for the same milestone are clearly still pending. Continue until a done condition, blocker, human confirmation gate, or environment limit is reached.

A normal implementation pass should end at a reviewable boundary: code/spec change plus export/diagnostic/test/docs updates where applicable. Do not split one coherent stabilization comparison into separate micro-commits unless a tool or human confirmation gate blocks completion.
