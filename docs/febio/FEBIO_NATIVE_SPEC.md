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

## Related files

- `AGENT.md`
- `PROGRESS.md`
- `docs/ops/ROADMAP.md`
- `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- `docs/febio/PARAMETER_MAPPING.md`
- `src/febio/export/`
- `src/febio/mesh/`
- `scripts/convert_febio_output.mjs`
