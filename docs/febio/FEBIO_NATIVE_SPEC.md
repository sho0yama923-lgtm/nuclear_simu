# FEBio Native Spec

## 目的

この文書は、FEBio solver に渡す geometry / material / contact / load / boundary / output / diagnostics を直接表す **FEBio-native spec** の方針を定義します。

今後の physics validation では、UI convenience parameter を FEBio 用に変換する経路を主経路にせず、FEBio-native spec を solver-facing source of truth とします。

## 基本方針

- FEBio solver behavior は FEBio-native spec で定義する。
- UI parameter は presentation alias、preset input、または compatibility input として扱う。
- UI parameter は physics source of truth ではない。
- UI 統合は、CLI/backend の FEBio-native export / run / convert / diagnostics / Studio confirmation が安定した後に行う。
- 旧 UI parameter conversion files は、移行完了後に active path から外し、legacy / compatibility 扱いにする。

## Scope

FEBio-native spec が直接表す対象:

- geometry
- materials
- contacts
- loads
- boundary conditions
- solver steps
- output requests
- diagnostics
- Studio confirmation paths

## Not Scope

FEBio-native spec が直接所有しないもの:

- browser UI state
- rendering-only metadata
- legacy lightweight simulation parameters
- UI form layout
- final result visualization details
- old UI parameter conversion behavior except through explicit compatibility / preset conversion

## CLI/backend flow

```text
FEBio-native spec JSON
-> FEBio template
-> .feb XML
-> FEBio CLI
-> converter
-> normalized result
-> diagnostics
-> Studio confirmation request
```

この flow が安定するまで、UI parameter -> canonical spec -> FEBio 変換は physics validation の主経路にしない。

## Minimal JSON shape

```json
{
  "caseName": "S8_force_transfer_minimal",
  "unitSystem": "um-nN-s",
  "geometry": {},
  "materials": {},
  "contacts": {},
  "loads": {},
  "boundary": {},
  "steps": [],
  "outputs": {},
  "diagnostics": {}
}
```

## Required sections

### geometry

Solver geometry に直結する値を持つ。

例:

- nucleus dimensions and placement
- cytoplasm dimensions and placement
- dish geometry
- pipette geometry
- contact target surfaces
- mesh mode / refinement mode

### materials

FEBio material に直接必要な値を持つ。

例:

- material type
- Young's modulus `E`
- Poisson ratio `nu`
- viscosity `eta` when solver-active
- nonlinear terms only when solver-active or explicitly marked planned

### contacts

FEBio contact / interface に直接必要な値を持つ。

例:

- contact type
- primary surface
- secondary surface
- penalty
- search tolerance
- friction
- sticky / tied / sliding / cohesive settings
- provenance of proxy / native / planned behavior

### loads

Solver-active load に直接必要な値を持つ。

例:

- pressure surface
- pressure value
- pressure load curve
- prescribed motion
- rigid controller reference

S7-C 以降、micropipette suction pressure は剛体ピペット面ではなく、変形体側の `pipette_suction_surface` に載せる。native default では `geometry.pipette.puncture` と `geometry.pipette.tip` を分離し、旧 UI の `xp` 相当は実行接触位置ではなく穿刺 metadata として保持する。確認用 direct case の `pipette_suction_surface` は nucleus right-side capture face を指し、surface orientation は FEBio pressure solve で negative jacobian を起こさない `[10,14,15,11]` に固定する。

現時点の native direct mesh は `meshMode=s7-debug-local-nucleus` の粗い debug mesh であり、refined native mesh ではない。これは Studio / CLI 確認用の過渡状態として扱い、次段階で local suction aperture と cell-dish contact を持つ refined mesh へ置き換える。

### boundary

Solver boundary condition に直接必要な値を持つ。

例:

- fixed node sets
- prescribed dofs
- rigid body constraints
- section-plane locks if used

### outputs

Validation と import に必要な output request を持つ。

例:

- displacement
- reaction force
- contact pressure
- contact gap
- contact traction
- aspiration length `L(t)`
- output path expectations

### diagnostics

Solver validation に必要な diagnostic target を持つ。

例:

- pressure load declared
- pressure load step-active
- contact pair declared
- contact pair formed in log
- contact pressure nonzero
- reaction force nonzero
- displacement nonzero
- Studio confirmation request path

## Unit system

既定の方針は `um-nN-s` とする。

この場合:

- length: `um`
- force: `nN`
- time: `s`
- stress / pressure / traction: `nN/um^2 = kPa`
- viscosity: `kPa*s`
- fracture energy: `nN/um = kPa*um`

FEBio XML / Studio / converter / diagnostics は、この単位系と矛盾しないようにする。

## UI integration policy

最終的な UI は FEBio-native spec を編集する presentation layer とする。

UI は次を行ってよい:

- FEBio-native spec fields を入力・編集する
- presets を読み込む
- advanced fields を折りたたんで表示する
- result / diagnostics / Studio confirmation request を表示する

UI は次を行わない:

- new solver behavior の source of truth になる
- UI-only parameter を solver behavior として直接増やす
- FEBio-native spec に存在しない physics parameter を暗黙に生成する
- force-transfer / contact activation validation の主経路になる

## Public API policy

アプリ標準の `runSimulation` は FEBio-native spec を入力として扱う。

- `runSimulation(nativeSpec)` は native spec から export-ready result を返す。
- `runSimulation(caseName, nativeOverrides)` は `caseName` 付き native spec shorthand として扱う。
- 旧 UI / canonical parameter flow は `runCanonicalSimulation(caseName, params)` のように明示名で呼ぶ。

この分離により、標準実行入口では UI parameter を FEBio-native spec へ暗黙変換しない。

## Legacy conversion policy

UI parameter -> canonical spec -> FEBio conversion は、FEBio-native spec / CLI backend path が安定するまで compatibility / preset generation 用に維持する。

移行完了後:

- 旧変換系ファイルは active physics path から外す。
- legacy / compatibility code として明示する。
- 新しい solver parameter を旧変換系ファイルだけに追加しない。
- 必要な場合だけ preset migration / backwards compatibility 用に限定して使う。

## Initial validation target

最初の validation target は force-transfer / contact activation の切り分けとする。

最低限確認するもの:

- `.feb` が FEBio / FEBio Studio で読める
- pressure load が active solver step で参照される
- contact pair が solver に認識される
- displacement が非ゼロになる
- contact pressure または reaction force が非ゼロになる
- output parser が missing / all-zero / nonzero を区別できる
- Studio confirmation request に `.feb`, log, result, output CSV path が出る

## Current implementation entrypoint

S7-C 時点の実装入口:

- `src/febio/spec/index.ts`
  - FEBio-native spec JSON の normalize / validate / direct template mapping を行う。
  - UI parameter -> canonical spec 変換と `buildSimulationInput` を通らない。
- `src/public-api.ts`
  - 標準 `runSimulation` は FEBio-native spec first。
  - 旧 canonical flow は `runCanonicalSimulation` として明示的に残す。
- `scripts/export_febio_direct_case.mjs`
  - FEBio-native spec JSON から `.feb` / native spec JSON / manifest / README を生成する。
  - 既定出力例: `legacy/febio_exports/S7_native_migration_check/S7_direct_force_transfer.feb`
- `scripts/convert_febio_output.mjs`
  - FEBio-native direct input の `nativeSpec` / `templateData` / `fdig_*` を保持して result JSON を生成する。

`legacy/febio_exports/S7_native_migration_check/` の確認 run では FEBio 4.12 で read success / normal termination し、nucleus-side suction surface、rigid reaction、native digest preserving conversion が成立した。final contact pressure は `0.734967195035`、final rigid `Fx=12.6000069265`、converted aspiration length は `5.09470348295 um`。残る residual は `cell_dish_interface` の no-pair warning、後半 step の `No force acting on the system` warning、debug mesh の粗さ。

## Related files

- `AGENT.md`
- `PROGRESS.md`
- `docs/ops/ROADMAP.md`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `legacy/docs/febio/PARAMETER_MAPPING.md`
- `src/febio/spec/`
- `src/febio/export/`
- `src/febio/mesh/`
- `scripts/export_febio_direct_case.mjs`
- `scripts/convert_febio_output.mjs`
