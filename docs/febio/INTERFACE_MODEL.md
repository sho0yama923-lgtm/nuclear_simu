# 界面モデル

nucleus-cytoplasm interface と関連界面の扱いをまとめます。判断理由は [../DECISIONS.md](../DECISIONS.md) を参照してください。

## 核-細胞質界面

役割:

- 核と細胞質の有効機械連結を表す。
- 現在の detachment 評価で最優先の interface。
- LINC / cytoskeleton detail は当面ここへ吸収する。

現在の実装方針:

- solver-primary は sticky cohesive approximation。
- true traction-separation law ではない。
- soft-start stabilization、penalty ramp、validation を伴わせる。
- `localNc` で regional result を保持する。

主な parameter:

- `Kn_nc`
- `Kt_nc`
- `sig_nc_crit`
- `tau_nc_crit`
- `Gc_nc`

## 細胞-ディッシュ界面

役割:

- 細胞底面と dish の接着を表す。
- 核単離成功と「細胞ごと吸着」の分岐に関係する。

現在の実装方針:

- main path は tied-elastic-active。
- cohesive-ready metadata は保持する。
- solver-primary cohesive 化は deferred。
- `localCd` で regional result を保持する。

主な parameter:

- `Kn_cd`
- `Kt_cd`
- `sig_cd_crit`
- `tau_cd_crit`
- `Gc_cd`
- `adhesionPattern`
- `adhesionSeed`

## ピペット接触

- pipette-nucleus は sticky contact / capture-hold approximation。
- pipette-cell は sliding-elastic secondary contact。
- hold / slip / release law はまだ近似であり、future refinement 対象。

## 観測方針

- native face-data / plotfile data があれば優先する。
- 欠損値だけ node displacement などの proxy で補う。
- `sourceNormal` / `sourceDamage` / `sourceShear` を保持する。
- detachment 判定は damage と geometry loss の両方を使う。
