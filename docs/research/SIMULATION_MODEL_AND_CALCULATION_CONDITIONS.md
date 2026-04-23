# シミュレーションモデルと計算条件

最終更新: 2026-04-22

## 1. この文書の目的

この文書は、このプロジェクトで現在 main flow に使っている

- 力学モデル
- FEBio へ出している計算条件
- 出力・import の前提
- 未実装 / 部分実装の箇所

を一か所で確認できるようにまとめたものです。

対象の主経路は次です。

1. UI input
2. canonical spec
3. FEBio templateData
4. `.feb` XML
5. FEBio CLI execution
6. result import
7. physical FEBio result rendering

主な実装位置:

- [simulation.js](/C:/Users/xiogo/projects/nuclear_simu/simulation.js)
- [js/simulation-febio.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-febio.js)
- [scripts/convert_febio_output.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/convert_febio_output.mjs)

## 2. 座標系と単位

### 座標系

- 鳥瞰図: `xy` 平面
- 断面図: `xz` 平面
- 高さ方向: `z`
- ディッシュ面: `z = 0`

内部の断面表現では一部で `y` スロットに world `z` を載せる helper を使っていますが、物理的な意味は `z` です。

### UI での基本単位

- 長さ: `um`
- 弾性率・応力: `kPa`
- 粘性: `kPa*s`
- 張力・破壊エネルギー: `N/m`
- ポアソン比・摩擦係数: 無次元

注意:

- `Fhold`, `P_hold` は現在も solver 内部 proxy 的な使い方を含みます
- UI に書かれている単位と、FEBio XML へそのまま 1:1 で物理換算されていない項目があります
- 詳細は [PARAMETER_MAPPING.md](/C:/Users/xiogo/projects/nuclear_simu/PARAMETER_MAPPING.md) を参照してください

## 3. 幾何モデル

現在の main flow は refined mesh builder を主経路に使います。

対象:

- nucleus
- cytoplasm
- membrane/cortex proxy
- dish
- pipette

### nucleus

- 断面形状: 楕円近似
- 幅: `Ln`
- 高さ: `Hn`
- 中心: `(xn, yn)` in section coordinates

### cytoplasm

- 断面形状: cap/dome 近似
- 幅: `Lc`
- 高さ: `Hc`
- 下端はディッシュ `z = 0`

### dish

- 剛支持に近い底面ブロック
- `dish_fixed_nodes` に対して固定境界を設定

### pipette

- 剛体
- 断面では縦方向 shaft
- 穿刺位置:
  - `xp`: 上面図の `x`
  - `zp`: 断面図の `z`

## 4. メッシュ

### main path

main export path は refined mesh です。

実装:

- `buildRefinedFebioGeometry(...)`
- `validateFebioMesh(...)`

### 現在の考え方

- nucleus と cytoplasm は独立ボディ
- nucleus-cytoplasm は shared node ではなく interface/surface pair ベース
- cell-dish も interface ベース
- pipette は独立剛体

### mesh validation

export 前に少なくとも次を確認します。

- invalid element
- zero/negative volume proxy
- duplicated nodes within body
- disconnected regions
- aspect ratio warning
- overlapping nodes across bodies

現在の扱い:

- blocker
  - invalid element
  - zero/negative volume
  - duplicated nodes within same body
  - disconnected regions
- warning
  - aspect ratio warning
  - overlapping nodes across bodies

## 5. バルク材料モデル

## 5.1 nucleus

現在 active な material は

- base elastic: `neo-Hookean`
- plus: single-branch viscoelastic approximation

入力元:

- `En`
- `nun`
- `etan`
- `alpha_nonlinear`

現状:

- `En`, `nun`, `etan` は XML に反映
- `alpha_nonlinear` は metadata のみで、solver-active ではない

status:

- elastic: implemented
- viscoelastic serialization: implemented
- nonlinear term: planned

## 5.2 cytoplasm

現在 active な material は

- base elastic: `neo-Hookean`
- plus: single-branch viscoelastic approximation

入力元:

- `Ec`
- `nuc`
- `etac`

status:

- elastic: implemented
- viscoelastic serialization: implemented
- calibrated viscoelastic: planned

## 5.3 membrane / cortex

現在は 2 モードを区別しています。

1. `cortex_proxy`
2. `shell_membrane_placeholder`

main flow で active なのは `cortex_proxy` です。

現状:

- `Tm`, `sig_m_crit`, `sig_m_crit_top`, `sig_m_crit_side`, `sig_m_crit_basal` は canonical spec に保持
- shell としての要素・材料はまだ未実装
- membrane 関連の failure は補助指標であり、本物の shell 出力ではない

status:

- cortex proxy: partial / active
- shell membrane: planned / placeholder

## 6. 界面モデル

## 6.1 nucleus-cytoplasm interface

この界面が現在の最優先改修対象です。

保持している物理量:

- `normalStiffness` = `Kn_nc`
- `tangentialStiffness` = `Kt_nc`
- `criticalNormalStress` = `sig_nc_crit`
- `criticalShearStress` = `tau_nc_crit`
- `fractureEnergy` = `Gc_nc`
- `tolerance`

現在の main flow:

- solver-primary は **sticky cohesive approximation**
- true traction-separation ではない
- inward 操作は `manipulation-1` と `manipulation-2` に分割

理由:

- 以前は最初の inward increment で `Negative jacobian` が出やすかった
- staged manipulation と soft-start penalty により、default Case A main flow は `NORMAL TERMINATION` まで到達

status:

- partial

## 6.2 cell-dish interface

保持している物理量:

- `Kn_cd`
- `Kt_cd`
- `sig_cd_crit`
- `tau_cd_crit`
- `Gc_cd`
- `adhesionPattern`
- `adhesionSeed`

現在の main flow:

- `tied-elastic-active`
- cohesive-ready metadata は持っている
- solver-primary cohesive にはまだしていない

status:

- partial

## 7. 接触モデル

## 7.1 pipette-nucleus

現在の active model:

- sticky contact
- capture-hold 近似

保持している主な量:

- `mu_p`
- `Fhold`
- `contact_tol`
- `maxTraction`
- `snapTolerance`
- `releaseCondition.tractionLimit`
- `releaseCondition.slipDistance`

現在の main flow:

- `release-test` は debug 用
- default main path では無効
- hold/release law はまだ近似

status:

- partial

## 7.2 pipette-cell

現在の active model:

- sliding-elastic secondary contact

status:

- implemented

## 8. 剛体運動スケジュール

main flow の default Case A は現在次の 5 stage です。

1. `approach`
2. `hold`
3. `lift`
4. `manipulation-1`
5. `manipulation-2`

`release-test` は main flow から外し、debug/validation 用に限定しています。

### 目的

- `approach`: 接触開始
- `hold`: 保持確立
- `lift`: 垂直引き上げ
- `manipulation-1`: inward を小さく導入
- `manipulation-2`: inward を本量まで増やす

### 安定化の意図

- 一発で inward を入れない
- 各 step ごとに `time_steps` と `step_size` を分ける
- 初手での jacobian collapse を避ける

## 9. 境界条件

現在の主要 boundary conditions:

- `fix_dish`
  - `dish_fixed_nodes`
  - `x, y, z` 固定
- `support_cell_base_z`
  - `cell_base_nodes`
  - `z` 固定
- `section_plane_lock`
  - `deformable_nodes_set`
  - `y` 固定

断面近似を維持するため、deformable 側の out-of-plane 自由度は拘束しています。

## 10. 出力要求と import

## 10.1 現在 export している主なもの

- nodal displacement
- reaction force
- rigid body motion / reaction
- pipette contact surface data
- nucleus-cytoplasm interface face data
- cell-dish interface face data

## 10.2 現在の import の考え方

result import は [scripts/convert_febio_output.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/convert_febio_output.mjs) が担当します。

現在の扱い:

- `history`
  - nucleus, cell, pipette は physical FEBio output ベース
- `localNc`
  - normal / gap は face-data-assisted
  - shear / damage は still partial/proxy
- `localCd`
  - まだ proxy 寄り
- `membraneRegions`
  - proxy

status:

- native import: partial

## 11. 現在の default main run の確認済み到達点

確認済み:

- `Case A`
- staged inward manipulation
- `release-test` disabled

結果:

- `.feb` export 成功
- FEBio CLI run 成功
- `case_A_cli.log` で `NORMAL TERMINATION`
- result JSON import 成功

実行例:

- export path:
  - `generated/febio_exports/cohesive_progress_step7`
- log:
  - `generated/febio_exports/cohesive_progress_step7/run/case_A_cli.log`
- result:
  - `generated/febio_exports/cohesive_progress_step7/run/case_A_result.json`

注意:

- 「最後まで通る」ことは確認済み
- ただし物理モデルの成熟度はまだ partial が多く、分類結果の物理解釈は今後改善余地があります

## 12. 現在の partial / planned 項目

### implemented

- refined mesh main path
- mesh validation gate
- nucleus/cytoplasm elastic material
- nucleus/cytoplasm viscoelastic serialization
- pipette rigid motion
- pipette-cell secondary contact
- FEBio export / CLI run / import / physical render main flow

### partial

- nucleus-cytoplasm solver-primary cohesive approximation
- cell-dish tied-elastic-active
- membrane cortex proxy
- pipette-nucleus hold / release approximation
- native FEBio output import for local interface metrics
- classification based on physical result

### planned

- true traction-separation cohesive for nucleus-cytoplasm
- cohesive migration for cell-dish
- fully native `localNc` / `localCd`
- shell membrane export
- nonlinear nucleus material term
- viscoelastic calibration
- richer hold/slip/release law
- higher quality local mesh refinement

## 13. いまの精度を一番支配しているもの

1. `nucleus-cytoplasm` がまだ true cohesive ではない
2. `cell-dish` がまだ tied-elastic
3. membrane が proxy
4. `localNc` / `localCd` / membrane import に proxy が残る
5. viscoelastic の較正が未完了
6. hold / release law が簡略化されている
7. contact / interface 近傍メッシュがまだ荒い

## 14. 関連文書

- 進捗管理: [PROGRESS.md](/C:/Users/xiogo/projects/nuclear_simu/PROGRESS.md)
- パラメータ対応: [PARAMETER_MAPPING.md](/C:/Users/xiogo/projects/nuclear_simu/PARAMETER_MAPPING.md)
- 出力対応: [FEBIO_OUTPUT_MAPPING.md](/C:/Users/xiogo/projects/nuclear_simu/FEBIO_OUTPUT_MAPPING.md)
- 全体設計: [FEBIO_FRONTEND_ARCHITECTURE.md](/C:/Users/xiogo/projects/nuclear_simu/FEBIO_FRONTEND_ARCHITECTURE.md)

## 15. 更新ルール

- 物理モデルを変えたらこの文書も更新する
- `implemented / partial / planned` が変わったら必ず更新する
- `PROGRESS.md` と矛盾した状態を残さない
- `README.md` と `CODEBASE_STRUCTURE.md` から辿れる状態を保つ
