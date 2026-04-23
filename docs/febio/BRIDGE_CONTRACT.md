# Bridge 契約

FEBio export / bridge / import の契約をまとめます。実行手順は [RUNBOOK.md](RUNBOOK.md)、詳細な出力対応は [FEBIO_OUTPUT_MAPPING.md](FEBIO_OUTPUT_MAPPING.md) を参照してください。

## Export Contract

export bundle は次を含む。

- `.feb` XML
- canonical input / companion JSON
- parameter digest
- export metadata
- interface region metadata
- detachment event / metric ownership metadata
- face-data coverage metadata
- optional plotfile `contact traction` bridge contract

source-of-truth:

- `src/febio/export/index.ts`

## Bridge Contract

bridge は次を行う。

1. UI の current params を受け取る。
2. case ごとの出力先を準備する。
3. export script で `.feb` と input JSON を生成する。
4. FEBio CLI を実行する。
5. converter で result JSON を生成する。
6. UI へ normalized physical result を返す。

既定の bridge:

- `scripts/febio_bridge_server.mjs`
- `scripts/start_febio_bridge.ps1`
- `http://127.0.0.1:8765/`

## Import Contract

import / normalization は次を守る。

- explicit external detachment event は導出前に保持する。
- native `localNc` / `localCd` payload は proxy fallback 前に保持する。
- `contactFraction` / `nativeGap` などの native regional metrics を残す。
- `sourceNormal` / `sourceDamage` / `sourceShear` を final state と `history[]` に残す。
- 欠損部分だけ proxy fallback で補う。

source-of-truth:

- `src/febio/import/normalizeFebioResult.ts`
- `scripts/convert_febio_output.mjs`

## Output Path Contract

生成物の既定位置:

- `generated/febio_exports/`
- bridge UI run: `generated/febio_exports/ui_bridge/case_A/` など

生成物は source-of-truth ではない。過去 export や log を通常探索の対象にしない。

## Result Adoption Contract

UI が main result として採用する条件:

- physical FEBio result であること。
- parameter digest が現在入力と整合すること。
- provenance が読めること。

solver source 文字列は表示用であり、採用判定の唯一基準にはしない。
