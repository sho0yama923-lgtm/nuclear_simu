# FEBio モデル化方針

FEBio 側のモデル化方針をまとめます。研究条件は [../research/](../research/)、出力対応は [FEBIO_OUTPUT_MAPPING.md](FEBIO_OUTPUT_MAPPING.md) を参照してください。

## 基本方針

- FEBio を main physical path とする。
- UI / browser は parameter input、export、bridge 実行補助、import、rendering を担う。
- physical result がないときは、FEBio result を待つ状態として扱う。
- lightweight / compatibility path は比較・互換用途であり、長期 source-of-truth ではない。

## Source-of-Truth

- parameter schema: `src/model/schema.ts`
- mesh: `src/febio/mesh/`
- nucleus-cytoplasm interface: `src/febio/interfaces/nucleusCytoplasm.ts`
- export: `src/febio/export/index.ts`
- import normalization: `src/febio/import/normalizeFebioResult.ts`
- classification: `src/results/classification.ts`

## Mesh

- refined mesh builder が主 export path。
- nucleus と cytoplasm は独立 body とし、interface / surface pair で扱う。
- dish は固定境界に近い support として扱う。
- pipette は rigid body として扱う。
- export 前に invalid element、zero/negative volume、duplicated nodes、disconnected regions、aspect ratio、overlap を確認する。

## Materials

- nucleus / cytoplasm は elastic + single-branch viscoelastic approximation。
- nonlinear term は canonical spec に保持するが、現時点では solver-active ではない。
- membrane / cortex はまだ shell model ではなく proxy / placeholder。

## Interfaces

- nucleus-cytoplasm は sticky cohesive approximation を solver-primary とする。
- cell-dish は tied-elastic-active を現行 main path とし、cohesive-ready metadata を保持する。
- true cohesive、cell-dish cohesive、membrane shell は deferred。

## Output Policy

- native output がある場合は native-first。
- native 欠損時のみ proxy fallback を使う。
- provenance を結果 JSON と docs に残す。
- detachment は explicit event として扱い、damage + geometry の両方に整合させる。
