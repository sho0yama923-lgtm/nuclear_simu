# 条件マトリクス

比較条件とパラメータスタディの入口です。詳細な model spec は [nuclear_isolation_model_spec.md](nuclear_isolation_model_spec.md) を参照してください。

## 基本ケース

| Case | 操作 | 主な評価目的 | 現在の扱い |
|---|---|---|---|
| A | 保持 -> 小引き上げ -> 重心側移動 | 核-細胞質界面への直接せん断評価 | FEBio main run の中心 |
| B | 保持 -> 小引き上げ -> 接線移動 | 回転モーメントによる反対側連結の破断評価 | 構造あり、主実行は今後拡張 |
| C | 保持 -> 小引き上げ -> 重心側微小移動 -> 接線微小移動 | 実験的成功条件に近い複合モード評価 | 構造あり、主実行は今後拡張 |

## 走査対象

| 群 | パラメータ | 見たいこと |
|---|---|---|
| 幾何 | `rp`, `Hn`, `xn`, `yn`, `xp`, `zp` | 先端径、核位置、穿刺位置が detachment に与える影響 |
| 材料 | `En / Ec`, `etan / etac`, `Tm` | 核 / 細胞質剛性比、粘性、膜張力の影響 |
| 核-細胞質界面 | `Kn_nc`, `Kt_nc`, `sig_nc_crit`, `tau_nc_crit`, `Gc_nc` | 核単離のしやすさと detachment timing |
| 細胞-ディッシュ界面 | `Kn_cd`, `Kt_cd`, `sig_cd_crit`, `tau_cd_crit`, `Gc_cd`, `adhesionPattern` | 細胞ごと剥がれる条件 |
| 操作 | `Fhold`, `P_hold`, `dz_lift`, `dx_inward`, `ds_tangent`, `dx_outward`, `mu_p` | 保持、滑脱、引き上げ、横移動の影響 |

## 比較時の優先順

1. default Case A が FEBio main path で安定して走ること。
2. `localNc` / `localCd` の native/proxy provenance が残ること。
3. detachment / classification が [TERMS_AND_METRICS.md](TERMS_AND_METRICS.md) の定義と合うこと。
4. Case B / C は main path の native observation が落ち着いてから拡張すること。

## 記録すべき結果

- first failure site / mode
- detachment start / complete
- `localNc` damage / gap / shear provenance
- `localCd` damage / gap / shear provenance
- capture maintained / tip slip
- final classification
