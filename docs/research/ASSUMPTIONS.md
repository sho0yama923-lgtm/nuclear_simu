# 仮定と近似

研究条件のうち、物理仮定・近似・除外事項をまとめます。現在の状態は [../../PROGRESS.md](../../PROGRESS.md)、判断理由は [../DECISIONS.md](../DECISIONS.md) を参照してください。

## 系の仮定

- 対象は孤立単一細胞。
- ディッシュは剛体または剛支持に近い境界として扱う。
- 細胞外液の流体作用は無視するか、ピペット保持力に吸収する。
- 陰圧は核全体の吸い込みではなく、先端保持の有効拘束として扱う。
- 核内部の詳細構造は有効粘弾性へ吸収する。

## 幾何と次元

- 現在の main flow は断面近似を含む。
- nucleus は楕円近似、cytoplasm は cap / dome 近似。
- out-of-plane 自由度は必要に応じて拘束し、断面モデルの意味を保つ。

## 材料モデル

- nucleus と cytoplasm は elastic + single-branch viscoelastic approximation を基本とする。
- nonlinear nucleus term は canonical schema に保持するが、現時点では solver-active ではない。
- viscoelastic calibration は未完了。

## 界面モデル

- nucleus-cytoplasm interface は当面 sticky cohesive approximation。
- true traction-separation law は、main path と native observation が安定してから導入する。
- cell-dish は cohesive-ready metadata を持つが、現 main path では tied-elastic-active。
- LINC / cytoskeleton detail は、有効 nucleus-cytoplasm interface へ吸収する。

## 出力と判定の近似

- detachment は damage と geometry loss の両方で評価する。
- solver-native 出力がある場合は native-first。
- 欠損がある場合だけ proxy fallback を使い、provenance を残す。
- membraneRegions は現時点では FEBio shell output ではなく proxy。

## 除外事項

- 3D full model。
- 流体-構造連成。
- 分子レベルの LINC / cytoskeleton detail。
- calibration 済み材料パラメータとしての解釈。
- `generated/**` や過去 export/log を source-of-truth として扱うこと。
