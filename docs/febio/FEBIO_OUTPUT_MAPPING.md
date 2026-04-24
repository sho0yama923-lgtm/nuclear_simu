# FEBio 出力対応

この文書は、FEBio 実行後の出力が現在のアプリ結果スキーマへどう対応づけられるかを整理したものです。

対象コード:
- converter: `../../scripts/convert_febio_output.mjs`
- canonical import: `../../src/febio/import/normalizeFebioResult.ts`
- compatibility bridge: `../../js/simulation-febio.js`, `../../simulation.js`

## いまの基本フロー

1. FEBio を `.feb` で実行する
2. FEBio が `.log` / `.xplt` と、ノード集合ごとの `.csv` を出す
3. `scripts/convert_febio_output.mjs` が `.csv` 群を読み、正規化済み app result JSON を作る
4. アプリ側は `loadExternalResult()` でその JSON を読み込む
5. `normalizeSimulationResult()` を通して、lightweight と同じ UI スキーマで表示する

## 出力ファイルと結果項目の対応

### 1. 全体変位

| FEBio 出力 | 使い方 | app result |
|---|---|---|
| `febio_nucleus_nodes.csv` | 核 node set の平均変位を取る | `history[].nucleus`, `displacements.nucleus` |
| `febio_cytoplasm_nodes.csv` | 細胞質 node set の平均変位を取る | `history[].cell`, `displacements.cell` |
| `febio_rigid_pipette.csv` | rigid body の重心位置と反力を取り、先端位置へ換算する | `history[].pipette`, `history[].holdForce`, `peaks.peakContactForce`, `peaks.peakHoldForce`, `captureEstablished`, `captureMaintained` |

補足:
- `history[].pipette` は `febio_rigid_pipette.csv` の rigid body 重心 `x, z` と、ピペット幾何から求めた重心-先端オフセットを使って先端位置へ換算しています。
- `history[].pipetteCenter` には rigid body 重心位置を保持しています。
- `displacements.tangentCell` と `displacements.tangentNucleus` は現在 0 固定です。

### 2. 核-細胞質界面 `localNc`

`templateData.interfaceRegions.localNc` に定義された node set の組を使います。

| region | face log | nucleus 側ログ | cytoplasm 側ログ | app result |
|---|---|---|---|---|
| `left` | `febio_interface_nc_left.csv` | `febio_nc_left_nucleus.csv` | `febio_nc_left_cytoplasm.csv` | `localNc.left.*` |
| `right` | `febio_interface_nc_right.csv` | `febio_nc_right_nucleus.csv` | `febio_nc_right_cytoplasm.csv` | `localNc.right.*` |
| `top` | `febio_interface_nc_top.csv` | `febio_nc_top_nucleus.csv` | `febio_nc_top_cytoplasm.csv` | `localNc.top.*` |
| `bottom` | `febio_interface_nc_bottom.csv` | `febio_nc_bottom_nucleus.csv` | `febio_nc_bottom_cytoplasm.csv` | `localNc.bottom.*` |

各 region では、まず face log から

- `normalStress`
- `damage`

を優先的に推定し、さらに node set 差から

- `shearStress`
- `peakNormal`
- `peakShear`
- `firstFailureTime`
- `firstFailureMode`

を補完します。

計算方法:
- face log の `contact pressure` を normal stress として優先使用
- face log の `contact gap` と `sig_nc_crit`, `Gc_nc` を使って damage を再構成
- shear は引き続き node set 差から推定
- 左右面では `x` 差を normal proxy、`z` 差を shear proxy とみなす
- 上下面では `z` 差を normal proxy、`x` 差を shear proxy とみなす

## 3. 細胞-ディッシュ界面 `localCd`

`templateData.interfaceRegions.localCd` に定義された node set を使います。

| region | face log | cell 側ログ | app result |
|---|---|---|---|
| `left` | `febio_interface_cd_left.csv` | `febio_cd_left_cell.csv` | `localCd.left.*` |
| `center` | `febio_interface_cd_center.csv` | `febio_cd_center_cell.csv` | `localCd.center.*` |
| `right` | `febio_interface_cd_right.csv` | `febio_cd_right_cell.csv` | `localCd.right.*` |

各 region では、平均変位から

- `normalStress`
- `shearStress`
- `damage`
- `peakNormal`
- `peakShear`
- `firstFailureTime`
- `firstFailureMode`

を推定します。

計算方法:
- face log の `contact pressure` を normal stress として優先使用
- face log の `contact gap` と `sig_cd_crit`, `Gc_cd` を使って damage を再構成
- `x` 変位を shear proxy として補う

## 4. 膜 `membraneRegions`

現在は FEBio から直接 shell 応力を読んでいません。  
そのため、膜は `localNc` からの proxy です。

| region | 由来 | app result |
|---|---|---|
| `top_neck` | `localNc.top.peakNormal + 0.35 * localNc.top.peakShear` | `membraneRegions.top_neck.*` |
| `side` | `max(localNc.left.peakShear, localNc.right.peakShear) * 0.8` | `membraneRegions.side.*` |
| `basal` | `localNc.bottom.peakNormal * 0.6` | `membraneRegions.basal.*` |

閾値には

- `sig_m_crit_top`
- `sig_m_crit_side`
- `sig_m_crit_basal`

を使います。

## 5. イベント / failure / 分類

### イベント

| app result event | 判定元 |
|---|---|
| `ncDamageStart` | `localNc` のどこかで `firstFailureTime != null` |
| `cdDamageStart` | `localCd` のどこかで `firstFailureTime != null` |
| `membraneDamageStart` | `membraneRegions` の damage > 0 |
| `tipSlip` | `peakContactForce <= 0.05` |

### 最初の failure

`findEarliestLocalFailure(result)` を使って

- `firstFailureSite`
- `firstFailureMode`

を決めます。

候補は:
- `nc:left/right/top/bottom`
- `cd:left/center/right`
- `membrane:top_neck/side/basal`

### 支配的メカニズム / 分類

変換スクリプトは最終的に

- `determineDominantMechanism(result)`
- `classifyRun(result)`

を使います。

つまり最終分類は lightweight と同じ結果スキーマへ寄せています。

## 6. 履歴の対応

`history[]` は FEBio の raw 時系列そのままではなく、表示用に再構成したものです。

| history key | 出所 |
|---|---|
| `time` | ログの snapshot time |
| `phase` | 入力 schedule を time に当てはめたもの |
| `pipette` | rigid body 重心から換算した先端位置 |
| `pipetteCenter` | `febio_rigid_pipette.csv` の rigid body 重心位置 |
| `nucleus` | `febio_nucleus_nodes.csv` の平均変位を rest position に足したもの |
| `cell` | `febio_cytoplasm_nodes.csv` の平均変位を rest position に足したもの |
| `localNc` | 各 region timeline を最も近い時刻でサンプリング |
| `localCd` | 各 region timeline を最も近い時刻でサンプリング |
| `tangentNucleus` | 現在 0 |
| `tangentCell` | 現在 0 |
| `membraneDamage` | 現在 0 |

## 7. 現在の限界

いまは次の点に注意が必要です。

- `.xplt` はまだ直接読んでいない
- `nucleus-cytoplasm` は face_data を使って normal / gap を native 寄りに読んでいるが、true cohesive damage / tangential traction はまだ未読込
- `localNc` / `localCd` は node set 変位差から再構成した reduced-order 指標
- 膜は proxy であり、FEBio の membrane/shell 解析結果ではない
- rigid body 出力の列解釈は現在 `id, x, z, Fx, Fz` を前提にしている
- `holdForce` は rigid body 反力 `sqrt(Fx^2 + Fz^2)` で近似している
- tangential DOF は FEBio output からまだ復元していない

## 8. 今後の優先順

1. `.xplt` もしくは FEBio logfile から rigid body の実位置を読んで `history[].pipette` に入れる
2. cohesive/contact の native output を読んで `localNc` / `localCd` を変位差 proxy から置き換える
3. membrane/shell を導入して `membraneRegions` を proxy から置き換える
4. tangential DOF を FEBio 出力から復元する
5. lightweight と FEBio の対応を、入力だけでなく出力も同じ schema で比較しやすくする

## 9. JSON 側の付加情報

`scripts/convert_febio_output.mjs` が生成する結果 JSON には、`outputMapping` も含めています。

主な場所:
- top-level `outputMapping`
- `normalizedResult.externalResult.outputMapping`

## 10. native 接線成分の更新

- `scripts/convert_febio_output.mjs` now reuses native face tangential traction for `localNc.*.shearStress` and `localCd.*.shearStress` when those face snapshots expose extra traction columns.
- The converter now supports both face snapshot rows with a leading entity id and rows that start directly with face values.
- The converter also uses the face-data descriptor to handle rows with extra leading metadata columns and descriptor-driven field order, as long as the payload still declares which columns are `gap` / `pressure` / tangential traction.
- When tangential traction columns are absent, shear still falls back explicitly to the existing node-displacement proxy path and keeps that provenance in `sourceShear`.
- `src/febio/import/normalizeFebioResult.ts` now also normalizes native `localCd` payloads from `localCdNative`, `nativeLocalCd`, and `faceData/nativeFaceData.cellDishRegions`, preserving those source labels in both final state and `history[]`.
- `src/febio/export/index.ts` and the compatibility export metadata now explicitly declare that the standard logfile `face_data` descriptor is still `contact gap;contact pressure`, and they also declare the standard plotfile `contact traction` bridge payload path (`plotfileSurfaceData.localNc.*` / `plotfileSurfaceData.localCd.*`) that the converter can prefer before proxy fallback.
- Converted result JSON now carries that coverage in both `outputMapping` and `resultProvenance.interfaceObservation`, so saved converted payloads show both the declared coverage and the actual native/proxy source picked per region.

これにより、変換済み JSON だけ見ても

- どの `.csv` が
- どの `localNc/localCd/displacements/peaks` に入ったか

を追えるようになっています。
