# Parameter Mapping

この文書は、現在の UI パラメータが

- `lightweight` 簡易シミュレーション
- `febio` bridge / `.feb` XML export

でどう対応しているかを整理したものです。

基準となる実装箇所:
- [simulation.js](/C:/Users/xiogo/projects/nuclear_simu/simulation.js)
- [js/simulation-febio.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-febio.js)

## 先に押さえること

- 共通入力は `buildSimulationInput()` で作られます。
- `lightweight` はこの共通入力をそのまま縮約力学モデルへ入れます。
- `febio` はさらに `buildFebioTemplateData()` で FEBio 用の中間表現へ変換します。
- ただし、現在の `.feb` XML は最小 runnable 構成なので、template data に保持していても XML にまだ出していない項目があります。

そのため、各パラメータは次の 4 種類に分けて見るのが分かりやすいです。

- `両方で直接使う`
- `lightweight では直接使い、FEBio では換算して使う`
- `FEBio template / handoff には入るが、現行 .feb XML には未反映`
- `現状は lightweight のみで使う`

## 座標系

- 上面図は `xy` 平面
- 断面図は `xz` 平面
- 高さは `z`
- ディッシュ面は `z = 0`

内部実装では歴史的理由で section point の高さを `.y` に保持している箇所がありますが、意味としては `world z` です。  
そのラップは `getWorldZ()` / `setWorldZ()` / `makeSectionPoint()` に集約されています。

## 共通入力スキーマ

`buildSimulationInput()` はパラメータを次の束へ分けます。

- `geometry`
- `material`
- `interfaces`
- `membrane`
- `operation`
- `adhesionPattern`
- `adhesionSeed`
- `schedule`

注意:
- UI 上では `adhesionPattern` / `adhesionSeed` は interface 群に見えますが、共通入力ではトップレベルへ出されます。
- 膜パラメータは `material` 群として入力されますが、共通入力では `membrane` 束へ分離されます。

## Geometry

| UI key | 意味 | lightweight | FEBio template | `.feb` XML |
|---|---|---|---|---|
| `Ln` | 核幅 x | 核形状、応力正規化、剛性スケールに直接使用 | 核メッシュ幅、核 shape metadata | 反映される |
| `Hn` | 核高さ z | 核形状、応力正規化、剛性スケールに直接使用 | 核メッシュ高さ、核 shape metadata | 反映される |
| `Lc` | 細胞幅 x | 細胞形状、膜/接着の正規化に使用 | 細胞質メッシュ幅 | 反映される |
| `Hc` | 細胞高さ z | 細胞形状、膜/接着の正規化に使用 | 細胞質メッシュ高さ | 反映される |
| `xn` | 核中心 x | 核中心位置に直接使用 | メッシュ配置、shape metadata | 反映される |
| `yn` | 核中心 z | 軽量 solver では「核中心 z」として使用 | `geometry.nucleus.center.z` に写像 | 反映される |
| `rp` | ピペット半径 | 接触許容、保持面積 proxy、滑脱条件 | ピペット形状、search radius、snap tolerance | 反映される |
| `xp` | 穿刺位置 x | hold 点と接触点の x に直接反映 | puncture metadata、初期接触位置、rigid target | 反映される |
| `zp` | 穿刺高さ z | hold 点と接触点の z に直接反映 | puncture metadata、初期接触位置、rigid target | 反映される |

補足:
- `xp` / `zp` は現在、表示と内部 solver が一致するように修正済みです。
- `yn` というキー名は残っていますが、意味は `nucleus center z` です。

## Material

| UI key | 意味 | lightweight | FEBio template | `.feb` XML |
|---|---|---|---|---|
| `En` | 核ヤング率 | 核 bulk 応答に直接使用 | nucleus material `E` | 反映される |
| `nun` | 核ポアソン比 | 現 lightweight では実質未使用 | nucleus material `v` | 反映される |
| `etan` | 核粘性 | 核/界面の減衰に直接使用 | nucleus material metadata `eta` | まだ未反映 |
| `alpha_nonlinear` | 核非線形係数 | `En_eff = En * (1 + alpha * strain^2)` に直接使用 | nucleus material metadata `alphaNonlinear` | まだ未反映 |
| `Ec` | 細胞質ヤング率 | 細胞 bulk 応答に直接使用 | cytoplasm material `E` | 反映される |
| `nuc` | 細胞質ポアソン比 | 現 lightweight では実質未使用 | cytoplasm material `v` | 反映される |
| `etac` | 細胞質粘性 | 細胞 bulk / 接着の減衰に直接使用 | cytoplasm material metadata `eta` | まだ未反映 |
| `Tm` | 膜張力 | 膜応力 proxy に直接使用 | membrane placeholder metadata `tension` | まだ未反映 |
| `sig_m_crit` | 膜破断閾値 global | 膜損傷判定に直接使用 | membrane thresholds metadata | まだ未反映 |
| `sig_m_crit_top` | 膜破断閾値 top_neck | top_neck 膜損傷に直接使用 | membrane thresholds metadata | まだ未反映 |
| `sig_m_crit_side` | 膜破断閾値 side | side 膜損傷に直接使用 | membrane thresholds metadata | まだ未反映 |
| `sig_m_crit_basal` | 膜破断閾値 basal | basal 膜損傷に直接使用 | membrane thresholds metadata | まだ未反映 |

補足:
- 現在の `.feb` XML serializer は `E` と `v` を主に出力しており、`eta` と `alphaNonlinear` は handoff 用 metadata に留まります。
- 膜は現段階では FEBio 一次解析の本体には入れておらず、placeholder 扱いです。

## Interfaces / Adhesion

| UI key | 意味 | lightweight | FEBio template | `.feb` XML |
|---|---|---|---|---|
| `Kn_nc` | 核-細胞質 法線剛性 | 直接使用 | `nucleusCytoplasm.Kn = max(Kn_nc * 0.18, 0.08)` | penalty として反映 |
| `Kt_nc` | 核-細胞質 せん断剛性 | 直接使用 | `nucleusCytoplasm.Kt = max(Kt_nc * 0.18, 0.06)` | 現 serializer では未使用 |
| `sig_nc_crit` | 核-細胞質 法線閾値 | 直接使用 | template metadata `sigCrit` | まだ未反映 |
| `tau_nc_crit` | 核-細胞質 せん断閾値 | 直接使用 | template metadata `tauCrit` | まだ未反映 |
| `Gc_nc` | 核-細胞質 破壊エネルギー | 直接使用 | template metadata `gc` | まだ未反映 |
| `Kn_cd` | 細胞-ディッシュ 法線剛性 | 直接使用 | `cellDish.Kn = max(Kn_cd * 0.12, 0.12)` | penalty として反映 |
| `Kt_cd` | 細胞-ディッシュ せん断剛性 | 直接使用 | `cellDish.Kt = max(Kt_cd * 0.12, 0.08)` | 現 serializer では未使用 |
| `sig_cd_crit` | 細胞-ディッシュ 法線閾値 | 直接使用 | template metadata `sigCrit` | まだ未反映 |
| `tau_cd_crit` | 細胞-ディッシュ せん断閾値 | 直接使用 | template metadata `tauCrit` | まだ未反映 |
| `Gc_cd` | 細胞-ディッシュ 破壊エネルギー | 直接使用 | template metadata `gc` | まだ未反映 |
| `adhesionPattern` | 接着分布 | left/center/right 重みづけに直接使用 | template metadata に保持 | まだ未反映 |
| `adhesionSeed` | 接着 seed | `random_patchy` の再現性に使用 | template metadata に保持 | まだ未反映 |

補足:
- 現在の FEBio 側 interface は `tied-elastic` 最小構成です。
- そのため template には `Kt`, `sigCrit`, `tauCrit`, `gc` を持っていますが、現 serializer は主に `penalty` と `tolerance` だけを書いています。
- 本来の cohesive/traction-separation に寄せる次段階で、ここが `.feb` XML へ本格的に出る想定です。

## Operation / Capture

| UI key | 意味 | lightweight | FEBio template | `.feb` XML |
|---|---|---|---|---|
| `Fhold` | 保持力 | 保持限界、滑脱判定、保持力 proxy に直接使用 | `pipetteNucleus.maxTraction = max(Fhold * 0.08, 0.3)` | 間接反映 |
| `P_hold` | 保持圧 | 保持剛性有効値に直接使用 | handoff manifest に保持 | まだ未反映 |
| `dz_lift` | 引き上げ量 z | schedule と力学応答に直接使用 | rigid step target の z 変位 | 反映される |
| `dx_inward` | 重心側移動 x | schedule と力学応答に直接使用 | Case A / C の rigid step target | 反映される |
| `ds_tangent` | 接線移動 y | schedule と面外自由度に直接使用 | Case B / C の rigid step metadata | 現 Case A solve では実質未使用 |
| `dx_outward` | 外向き移動 x | release-test に直接使用 | rigid release target | 反映される |
| `mu_p` | ピペット摩擦 | 保持限界と滑脱 proxy に直接使用 | `pipetteNucleus.friction` / `pipetteCell.friction` | 反映される |
| `contact_tol` | 捕捉許容距離 | capture 判定に直接使用 | search tolerance / search radius に反映 | 反映される |

補足:
- 現在の FEBio 実解析の主対象は Case A です。
- そのため `ds_tangent` は lightweight では有効でも、FEBio 実働ケースではまだ主役ではありません。
- `P_hold` は lightweight で有効ですが、FEBio 側ではまだ sticky/tied パラメータへ落とし込めていません。

## Case / Schedule 対応

`buildSchedule()` の操作は、`lightweight` と `FEBio` で次の対応です。

| フェーズ | lightweight | FEBio |
|---|---|---|
| `approach` | 目標位置へ補間 | rigid pipette step |
| `hold` | capture / hold | rigid pipette step |
| `lift` | `dz_lift` | rigid `z` displacement |
| `manipulation` | Case A/B/C で分岐 | Case A は `dx_inward`、B/C は構造のみ |
| `release-test` | outward / release | rigid release step |

## 今の実務上の読み方

### 1. lightweight と FEBio でほぼ同義に使えるもの
- `Ln`, `Hn`, `Lc`, `Hc`, `xn`, `yn`, `rp`, `xp`, `zp`
- `En`, `Ec`, `nun`, `nuc`
- `dz_lift`, `dx_inward`, `dx_outward`, `mu_p`, `contact_tol`

### 2. FEBio では縮約・換算されて入るもの
- `Kn_nc`, `Kt_nc`, `Kn_cd`, `Kt_cd`
- `Fhold`

### 3. 現在は FEBio template には残るが `.feb` にまだ十分出ていないもの
- `etan`, `etac`
- `alpha_nonlinear`
- `Tm`
- `sig_m_crit`, `sig_m_crit_top`, `sig_m_crit_side`, `sig_m_crit_basal`
- `sig_nc_crit`, `tau_nc_crit`, `Gc_nc`
- `sig_cd_crit`, `tau_cd_crit`, `Gc_cd`
- `adhesionPattern`, `adhesionSeed`
- `P_hold`

### 4. 解釈上の注意
- lightweight の界面破壊は、局所 region ごとの reduced-order traction/damage です。
- FEBio 側はまだ最小 runnable 構成なので、同じ UI パラメータでも「物理的に同値」ではなく「近い役割へ写像」している部分があります。
- したがって、現時点では `lightweight` と `FEBio` の結果を数値一致させるのではなく、「同じ操作条件を与えたときに同じ傾向を示すか」で見るのが自然です。

## 次に XML へ反映すべき優先項目

優先度が高いのは次です。

1. `sig_nc_crit`, `tau_nc_crit`, `Gc_nc`
   - 核-細胞質界面の cohesive 化
2. `sig_cd_crit`, `tau_cd_crit`, `Gc_cd`, `adhesionPattern`
   - 細胞-ディッシュ側の剥離可能化
3. `P_hold`, `Fhold`
   - pipette-nucleus 保持条件の明示化
4. `etan`, `etac`, `alpha_nonlinear`
   - 粘弾性 / 非線形材料化
5. `Tm`, `sig_m_crit*`
   - 膜 shell または post-process との接続
