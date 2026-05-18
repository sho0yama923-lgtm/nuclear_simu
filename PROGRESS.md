# FEBio Progress

Last updated: 2026-05-18

`PROGRESS.md` は current-state file。run log、scan table、長い比較履歴は置かない。完了済み詳細は `docs/febio/*DIAGNOSTICS.md` または `docs/ops/INCIDENTS_AND_ROOT_CAUSES.md` に退役させる。

## Current summary

- Goal: FEBio solver-native output で、核が細胞質から剥離する条件を評価できる物理・診断経路を作る。
- Active solver path: `febio_cases/native/*.native.json` -> `scripts/export_febio_native_case.mjs` -> `src/febio/native/` -> `.feb`。
- Legacy UI / canonical / bridge paths は compatibility-only。新しい solver behavior には使わない。
- Current phase: S10 local suction patch and NC interface mesh refinement.
- S7 is diagnostic closure. S8 returned to nucleus-side pressure and separated pressure response, direct contact, proxy detachment, shared-node continuity, and native NC failure evidence. S9 closed the native NC failure output / conversion / classification pipeline on the simplified separated-contact comparison.
- Active milestone: S10 parametric rectangular-block Gmsh refinement.
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
- Gmsh refinement は、点番号を直接大量管理する方式ではなく、長方形ブロック / 座標面 / named patch 変数で管理する。現在の正規手編集対象は `generated/gmsh_current/mesh.geo`。旧 `native-parametric-block.geo` / `native-editable-block.geo` は比較・退避用に扱う。
- Gmsh Python API を使う段階では、FEBio surface/domain 名と Physical Group ID を registry で固定する。生成 Python は手編集禁止の成果物として扱い、編集元は native case JSON の `geometry.gmshPythonApi` と `src/febio/native/gmsh.ts` の generator / registry に置く。

## Active milestone: S10 parametric rectangular-block Gmsh refinement

### Current facts

- S8-M remains the physical shared-node nucleus-side pressure-response baseline.
- S9 is closed as pipeline validation, not final pressure calibration.
- The current warning-free native NC failure example is S9-E at `-1.7 kPa`: native NC failure active, damage `0.6155186249313224`, `firstFailureSite="nc:right"`.
- S9-D at `-1.55 kPa` remains a warning-free below-threshold partial-damage point: native right NC damage `0.23435479253090608`, native failure inactive.
- Detailed S9 scan evidence is retained in `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`.
- Physical pressure-threshold calibration is deferred until after local suction patch and NC interface mesh refinement.
- S10-A added `meshMode="s10-local-suction-patch"` and a solver-facing `pipette_suction_patch` surface without changing existing S8/S9 cases.
- S10-A historical export was retired to `legacy/retired_generated_2026-05-18/febio_exports/S10_local_suction_patch/`. Static diagnostics report patch area `6.5 um^2`, centroid `[14, 0, 17]`, normal `-x`, nodes `[82,83,86,87]`, face `[24]`, and declared pressure resultant `4.55 nN` at `-0.7 kPa`.
- S10-A Windows FEBio CLI run reached normal termination with no solver warnings, errors, negative jacobian, no-force, or no-contact-pair messages. Artifacts were retired to `legacy/retired_generated_2026-05-18/febio_exports/S10_local_suction_patch/febio_runs/S10-A_S10_local_suction_patch/`.
- S10-A pressure-load response is active on `pipette_suction_patch`: observed 4/4 patch nodes, max displacement `1.1628959591041037 um`, max normal displacement `1.1518070494 um`.
- S10-A direct pipette contact channels remain inactive: pipette-cell pressure `0`, pipette mouth pressure `0`, rigid reaction `0`, pipette plotfile force inactive. Cell-dish support is active through plotfile force while face-data pressure remains zero.
- S10-A converted classification is proxy-derived `nucleus_detached`; native NC interface failure remains unavailable/inactive because the S10-A baseline uses conformal shared-node NC coupling.
- S10-B added `febio_cases/native/S10_local_suction_patch_nc_right_refined.native.json`, preserving the local `pipette_suction_patch` while enabling separated solver-active NC comparison and splitting the S10 nucleus left/right contact facets around the patch band.
- S10-B historical export was retired to `legacy/retired_generated_2026-05-18/febio_exports/S10_local_suction_patch_nc_right_refined/`. Static diagnostics remain valid/warning-free and keep patch area `6.5 um^2`, centroid `[14, 0, 17]`, normal `-x`, nodes `[82,83,86,87]`, face `[24]`, and declared pressure resultant `4.55 nN`.
- S10-B Windows FEBio CLI run reached normal termination with no solver warnings, errors, negative jacobian, no-force, or no-contact-pair messages. Artifacts were retired to `legacy/retired_generated_2026-05-18/febio_exports/S10_local_suction_patch_nc_right_refined/febio_runs/S10-B_S10_local_suction_patch_nc_right_refined/`.
- S10-B pressure-load response is active on `pipette_suction_patch`: observed 4/4 patch nodes, max displacement `1.2597331654442678 um`, max normal displacement `1.24485318688 um`.
- S10-B native NC output is solver-facing and active for left/right separated contact; plotfile contact force is nonzero on both left and right NC surfaces. Native NC failure remains inactive at `-0.7 kPa` with damage `0`, so converted `nucleus_detached` classification remains proxy-derived.
- S10 Gmsh foundation now has a native mesh -> `.msh` v2 ASCII -> native mesh round-trip path. It preserves Physical Group names for existing native surfaces / domains, including `pipette_suction_patch`, and validates through `validateNativeMesh`.
- `meshMode="s10-gmsh-baseline"` is opt-in and keeps the existing default native mesh path unchanged. The opt-in path builds the S10 local suction patch first, then round-trips it through the Gmsh v2 ASCII converter before FEBio export.
- `scripts/dump_native_gmsh_baseline.mjs` writes the current canonical mesh-edit artifacts under `generated/gmsh_current/`: `mesh.geo`, `mesh.msh`, `mesh.validation.json`, `mesh.roundtrip.json`, `mesh.source.json`, and `mesh.py`. The local dump validation is currently valid, and `--run-gmsh` succeeds with the installed Gmsh CLI.
- External Gmsh 4.14.0 can read the generated `.geo` / `.msh` and emit `.msh` v2 ASCII successfully. Because this baseline has duplicate-coordinate native nodes at material/contact boundaries, external Gmsh renumbers compact ids; the converter now records `nativeIdRecovery="template-preserved-for-duplicate-coordinate-baseline"` and preserves the native ids from the comparison template.
- S10-G added `febio_cases/native/S10_gmsh_baseline.native.json` with `meshMode="s10-gmsh-baseline"`. Historical export and CLI evidence were retired to `legacy/retired_generated_2026-05-18/febio_exports/S10_gmsh_baseline/`.
- S10-G comparison against S10-A is recorded in the retired artifact `legacy/retired_generated_2026-05-18/febio_exports/S10_gmsh_baseline/S10_gmsh_baseline_comparison.json`: node count `72 == 72`, element count `15 == 15`, surface count `21 == 21`, checked surface assignments match, solver source is FEBio CLI for both, classification is `nucleus_detached` for both, final aspiration delta is `0`, pressure response observed nodes are `4 == 4`, and detachment start delta is `0`.
- S10-H added `febio_cases/native/S10_gmsh_nc_right_refined.native.json` with `meshMode="s10-gmsh-baseline"` plus separated-contact NC refinement. Historical export and CLI evidence were retired to `legacy/retired_generated_2026-05-18/febio_exports/S10_gmsh_nc_right_refined/`.
- S10-H comparison against S10-B is recorded in the retired artifact `legacy/retired_generated_2026-05-18/febio_exports/S10_gmsh_nc_right_refined/S10_gmsh_nc_right_refined_comparison.json`: node count `88 == 88`, element count `17 == 17`, surface count `21 == 21`, checked local suction / NC / cell-dish surface assignments match, contact regions are `left/right` for both, classification is `nucleus_detached` for both, final aspiration delta is `0`, pressure response observed nodes are `4 == 4`, detachment start delta is `0`, and native NC failure output is available but inactive with damage `0` for both.
- `validateNativeMesh` now emits `meshLevelDiagnostics`: node / element / total face counts, element counts by material, face counts by named surface, NC region face/node/node-pair diagnostics, duplicate-coordinate groups, and Gmsh native-id recovery notes. S10-H reports `88` nodes, `17` elements, `39` named surface faces, `3` right nucleus NC faces, `3` right cytoplasm NC faces, and `8` right NC node-pair mappings.
- `buildEditableGmshBlockGeo` now emits an editable Gmsh block geometry from a native hex mesh: Points, Lines, transfinite Plane Surfaces, transfinite Volumes, and Physical Volume / Physical Surface groups with native names. `scripts/dump_native_gmsh_baseline.mjs --run-gmsh` writes `native-editable-block.geo`, runs Gmsh on it, round-trips the resulting `.msh`, and validates it.
- S10-H editable block geometry was retired to `legacy/retired_generated_2026-05-18/generated/gmsh_editable_s10h/native-editable-block.geo`; Gmsh 4.14.0 produced `88` nodes and `49` parsed physical quad/hex elements from it, and the native round-trip validation is valid. This is historical block-structured evidence, not the current hand-edit workspace.
- S10-I originally added `febio_cases/native/S10_pipette_nc_refined.native.json` with `meshMode="s10-pipette-nc-refined"` as a side-entry pipette-mouth alignment refinement. That pre-top-suction version split the rigid pipette mouth into bottom / patch / top bands, added `pipette_mouth_patch`, and aligned it with the existing `pipette_suction_patch` z-band.
- S10-I has now been updated to `meshMode="s10-top-pipette-reference"` to match the image-guided top suction setup. The current S10-I mesh places the pipette above the nucleus, applies pressure to a top `pipette_suction_patch` at centroid `[0, 0, 26]`, uses normal `-z`, and defines aspiration into the pipette as `+z`.
- Current S10-I static export is represented by the versionless current handoff at `febio_exports/current_mesh/current_mesh.feb`: `100` nodes, `22` elements, `pipette_suction_patch` area `13 um^2`, pressure resultant `9.1 nN` at `-0.7 kPa`, solver-active NC region `top`, `conventionWarnings=[]`, and `exportReady=true`.
- The earlier S10-I Windows FEBio CLI normal-termination evidence belongs to the pre-top-suction side-entry mesh and remains historical only. The current top-suction S10-I CLI evidence was retired to `legacy/retired_generated_2026-05-18/febio_exports/S10_pipette_nc_refined/febio_runs/S10-I_top_suction_current/`: FEBio 4.12.0 reached `N O R M A L   T E R M I N A T I O N`, completed `212` total time steps with `811` equilibrium iterations, emitted the active `nucleus_cytoplasm_top_surface` record, and the log scan found no errors, warnings, negative/jacobian failure, no-force, or no-contact messages.
- The pre-top-suction S10-I comparison against S10-H remains historical evidence in `legacy/retired_generated_2026-05-18/febio_exports/S10_pipette_nc_refined/S10_pipette_nc_refined_comparison.json`: node count changes `88 -> 96`, element count changes `17 -> 19`, surface count changes `21 -> 23`, checked local suction / NC / cell-dish surface assignments remain unchanged, classification is `nucleus_detached` for both, final aspiration delta is `0`, pressure response observed nodes are `4 == 4`, and native NC failure output remains available but inactive with damage `0`.
- `buildParametricEditableGmshBlockGeo` now emits the canonical `mesh.geo`: the same block topology as S10-I, but with coordinate-plane variables, block readouts such as `cyto_1_width`, and edit handles such as `pipetteOuterX`, `pipetteZBottom`, `pipettePatchZBottom`, `pipettePatchZTop`, and `pipetteZTop`.
- Current rectangular-block geometry can be generated at `generated/gmsh_current/mesh.geo`; after the top-suction update, S10-I native static validation reports `100` nodes and `22` elements. Regenerate `generated/gmsh_current/mesh.*` before using it as the current manual edit workspace.
- `scripts/export_febio_from_gmsh_mesh.mjs` now exports a FEBio handoff from an edited Gmsh `.msh` using a native case as the template. This is the bridge for `mesh.geo` edits: edit variables -> Gmsh save `mesh.msh` -> native validation -> `.feb` export.
- The default edited-mesh FEBio handoff output is now `febio_exports/current_mesh/`, with versionless handoff filenames such as `current_mesh.feb`.
- `buildGmshPythonApiBlockScript` emits `mesh.py` as a generated, do-not-edit Gmsh Python API script. It centralizes `PHYSICAL_VOLUMES`, `PHYSICAL_SURFACES`, and fixed `PHYSICAL_GROUP_IDS`; IDs no longer depend on object-key traversal order. Current fixed IDs include volume groups `cytoplasm=1`, `nucleus=2`, `pipette=3`, `dish=4`, and `pipette_suction_patch=120`.
- The Gmsh Python package was installed project-locally under `.tools/python-gmsh` using `pip --target`; `import gmsh` reports `4.15.2` while the system CLI is `4.14.0`. Generated Python API scripts auto-discover this local package from the project tree.
- `scripts/export_febio_from_gmsh_python_api.mjs` now provides the intended one-command bridge for Python API managed meshes: native case -> generated `mesh.py` -> `mesh.msh` -> native validation -> FEBio export. The default Python API FEBio handoff output is now `febio_exports/current_mesh_api/`, with versionless handoff filenames such as `current_mesh_api.feb`.
- S10 Python API generation now reads editable mesh-generation parameters from native case JSON at `geometry.gmshPythonApi`. `transfiniteCurveDivisions` controls generated `TRANSFINITE_CURVE_DIVISIONS`, while `coordinateAliases` controls readable emitted handles such as `pipetteMouthX`, `pipetteZBottom`, `pipettePatchZBottom`, and `pipettePatchZTop`.
- `src/febio/native/gmsh.ts` now includes a readable geometry editing map with `Box`, `partition`, and `blockFromBox`. `buildProjectGmshBlockLayout` names the current conceptual blocks as `cytoplasmBox`, `nucleusBox`, `pipetteBox`, `dishBox`, and `cytoplasmPartition`, so future generator edits can be reasoned about as physical boxes/partitions instead of point-id lists. Low-level tag emission still preserves the validated native round-trip path.
- Generated Python API scripts now include an edit guide at the top: model size/position changes start in `geometry.nucleus`, `geometry.cytoplasm`, and `geometry.pipette`; generated coordinate handles come from `geometry.gmshPythonApi.coordinateAliases`; global transfinite subdivision comes from `geometry.gmshPythonApi.transfiniteCurveDivisions`; Physical Group compatibility lives in `DEFAULT_PHYSICAL_GROUP_REGISTRY`.
- `scripts/export_febio_from_gmsh_python_api.mjs --gui` forwards to generated Python as `--gui`, writes `.msh` relative to the generated script directory, and lets Gmsh FLTK inspect the generated model after mesh generation. Physical Group registration now checks that every requested entity tag exists before calling `addPhysicalGroup`.

### Current interpretation

The active problem remains physical-model geometry and pressure schedule calibration, not evidence plumbing. The simplified separated-contact comparison proves native NC failure outputs can be emitted, converted, and classified warning-free. S10-A proves the local suction pressure-load response; S10-B proves local-patch plus solver-active left/right NC output can run warning-free at baseline pressure. The current S10-I top-suction mesh now imports, solves, and emits the expected NC-top / pipette contact / aspiration channels in FEBio CLI.

The project is now past the Gmsh baseline gate and has a solver-confirmed top-suction mesh/export candidate. The manual editing policy remains `generated/gmsh_current/mesh.geo` or native case JSON / generator options, with generated Python treated as a reproducible artifact. The next useful review boundary is a small rectangular-block mesh change, then comparison against the fresh S10-I top-suction FEBio CLI evidence.

### Next bounded task

Make the next small rectangular-block refinement on top of the solver-confirmed S10-I top-suction export. The immediate target is not a pressure threshold claim; it is preserving import/solve behavior and expected pressure / NC-top / aspiration channels while improving the mesh shape.

Next implementation checklist:

- [x] dump the current native mesh to JSON so node ids, element ids, surface names, and surface face membership are fixed as a comparison artifact;
- [x] add a Gmsh `.geo` generator for the current baseline shape without changing the existing native mesh behavior;
- [x] add a gmsh CLI wrapper that emits `.msh` v2 ASCII and returns useful stderr / exit-code diagnostics to the caller;
- [x] add a `.msh` v2 ASCII parser for nodes, elements, element tags, and physical names;
- [x] map Gmsh Physical Groups to the existing native surface names exactly, including `pipette_suction_patch` and NC region names where present;
- [x] convert parsed `.msh` data into the native mesh object shape consumed by `validateNativeMesh`;
- [x] add a `buildNativeMesh` `meshMode` branch so the current path remains default and Gmsh mode is opt-in;
- [x] run the Gmsh-derived native mesh through `validateNativeMesh`;
- [x] run `buildNativeFebioExport` on the Gmsh-derived native mesh;
- [x] compare the FEBio CLI result against the existing baseline by node count, element count, surface assignment, solver status, and converted result differences;
- [x] after the Gmsh baseline comparison is zero-diff or within the documented tolerance, start local refinement design.
- [x] add a Gmsh-derived separated NC-right refinement case that preserves S10-B surfaces and solver outputs;
- [x] compare the Gmsh-derived separated NC-right refinement against S10-B by node count, element count, surface assignment, solver status, and converted result differences;
- [x] add explicit mesh-level diagnostics needed before the next geometry change: element count, face count by named surface, NC region face counts, NC node-pair mapping count, and basic duplicate-coordinate/native-id recovery notes;
- [x] add the first editable Gmsh block-geometry generator and prove Gmsh can mesh / round-trip / validate it;
- [x] design and validate the next actual geometry refinement level (`s10-pipette-nc-refined`) for pipette mouth / suction patch / NC interface alignment;
- [x] add a parametric rectangular-block `.geo` generator so refinement can be done by editing coordinate variables instead of individual point ids;
- [x] generate and validate canonical `mesh.geo` through Gmsh and native round-trip validation;
- [x] add an edited-Gmsh-mesh export CLI so a saved `.msh` can become a native FEBio handoff;
- [x] add a Gmsh Python API script generator with centralized Physical Group / FEBio name registry;
- [x] add a Python API mesh export bridge that can emit `.msh`, validate it, and write FEBio handoff artifacts when the `gmsh` Python package is available;
- [x] install or expose the Gmsh Python package and run the Python API bridge once on unmodified S10-I;
- [x] fix Physical Group IDs through a registry instead of object key order;
- [x] move Python API edit handles and transfinite subdivision parameters to native case JSON / generator options;
- [x] mark generated Python as do-not-edit and document what source fields affect coordinates, subdivisions, and Physical Groups;
- [x] add a readable `Box` / `partition` / `blockFromBox` geometry map in `gmsh.ts` for future generator edits;
- [x] make the first intentional case-JSON / mesh generator edit for S10-I by switching to a top-suction reference mesh;
- [x] run the current S10-I top-suction export in Windows FEBio CLI and capture static / solver evidence.

### Done condition

- The current native mesh can be dumped as JSON for regression comparison.
- Gmsh can generate a `.msh` v2 ASCII baseline from a repo-owned `.geo` generator through a wrapper.
- `.msh` v2 Physical Groups are parsed and preserved as existing native surface names.
- `buildNativeMesh` can select the legacy native mesh path or the opt-in Gmsh path via `meshMode`.
- Gmsh-derived native mesh passes `validateNativeMesh`.
- `buildNativeFebioExport` can export the Gmsh-derived mesh without breaking the existing default path.
- FEBio CLI comparison against the current baseline records node count, element count, surface assignment, solver status, and converted result differences.
- S10-I top-suction static export aligns the rigid pipette mouth patch with the top local suction patch and has `conventionWarnings=[]`.
- The preferred manual edit source is `generated/gmsh_current/mesh.geo`, not direct point-by-point editing of old `native-editable-block.geo`.
- The generated Python API file is not the safe-edit source. It is a regenerated artifact under `febio_exports/current_mesh_api/mesh.py`.
- The preferred safe-edit source is the native case JSON (`geometry.gmshPythonApi`) plus the generator/registry in `src/febio/native/gmsh.ts`. FEBio-facing names and IDs are centralized in `DEFAULT_PHYSICAL_GROUP_REGISTRY`, `PHYSICAL_SURFACES`, and `PHYSICAL_VOLUMES`.
- The next refinement must start from the canonical rectangular-block path (`generated/gmsh_current/mesh.geo` or native case JSON / generator options) and compare against the captured top-suction S10-I solver run.

### Deferred until after Gmsh baseline

- `.msh` v4 support.
- Advanced Gmsh size fields and local refinement policy.
- Physical pressure-threshold interpretation from refined meshes.
- Mesh convergence and final pressure-threshold calibration.

## Files to open next

- `docs/febio/MESH_REFINEMENT_PLAN.md`
- `docs/febio/PIPETTE_INTERACTION_DIAGNOSTICS.md`
- `febio_cases/native/S8_pipette_nucleus_pressure_return.native.json`
- `febio_cases/native/S8_pipette_nucleus_nc_failure_compare.native.json`
- `febio_cases/native/S9_pipette_nucleus_nc_separated_pressure_1p7.native.json`
- `febio_cases/native/S10_local_suction_patch.native.json`
- `febio_cases/native/S10_local_suction_patch_nc_right_refined.native.json`
- `febio_cases/native/S10_gmsh_baseline.native.json`
- `febio_cases/native/S10_gmsh_nc_right_refined.native.json`
- `febio_cases/native/S10_pipette_nc_refined.native.json`
- `src/febio/native/caseSpec.ts`
- `src/febio/native/gmsh.ts`
- `src/febio/native/mesh.ts`
- `src/febio/native/outputs.ts`
- `src/febio/native/runDiagnostics.ts`
- `scripts/export_febio_native_case.mjs`
- `scripts/dump_native_gmsh_baseline.mjs`
- `scripts/export_febio_from_gmsh_mesh.mjs`
- `scripts/export_febio_from_gmsh_python_api.mjs`
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
