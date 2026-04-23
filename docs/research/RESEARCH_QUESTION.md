# 研究問い

この文書は、この repo で評価したい問いをまとめる入口です。詳細な力学モデル仕様は [nuclear_isolation_model_spec.md](nuclear_isolation_model_spec.md)、現在の計算条件は [SIMULATION_MODEL_AND_CALCULATION_CONDITIONS.md](SIMULATION_MODEL_AND_CALCULATION_CONDITIONS.md) を参照してください。

## 主目的

FEBio を主な物理経路として、培養細胞へのピペット局所操作で核が細胞質から脱落する条件を評価する。

## 答えたい問い

1. 核-細胞質界面破断と細胞-ディッシュ剥離のどちらが先に起こるか。
2. 重心側移動と接線移動のどちらが核遊離に有利か。
3. 引き上げ量が小さすぎる / 大きすぎる場合に何が破綻するか。
4. ピペット作用点が核中心寄りか核縁寄りかで何が変わるか。
5. 成功条件に必要な界面強度比 `tau_nc_crit / tau_cd_crit` の範囲はどこか。
6. 先端径と保持力が「核のみ遊離」「細胞ごと吸着」にどう影響するか。

## 成功側の評価対象

- 核-細胞質界面の破断が細胞-ディッシュ接着の破断より先に起こる。
- 核を局所保持して持ち上げた際に、核上部の膜 / 皮質または周辺細胞質に局所破断が起こる。
- ピペット保持点で核が先端から滑脱しない。

## 失敗側の分類

- `cell_attached_to_tip`: 細胞全体または大きな細胞質領域がピペット側に移動する。
- `deformation_only`: 大変形はあるが detachment しない。
- `no_capture`: 保持が成立しない、または早期滑脱する。

## 現在の実装上の制約

- `nucleus-cytoplasm` は sticky cohesive approximation であり、true cohesive ではない。
- `localNc` / `localCd` の native observation はまだ partial。
- membrane は proxy-first。
- LINC / cytoskeleton は有効界面へ吸収しており、詳細モデル化は将来拡張。
