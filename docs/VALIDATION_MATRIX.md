# 検証マトリクス

変更種別ごとの最低検証です。詳細な source-of-truth は [CODEBASE_STRUCTURE.md](CODEBASE_STRUCTURE.md)、運用フローは [ops/CHANGE_WORKFLOW.md](ops/CHANGE_WORKFLOW.md) を参照してください。

## Docs Only

対象:

- README / AGENT / PROGRESS / docs 配下の md のみ

最低確認:

- root 入口から新しい文書へ辿れること。
- 削った内容が必要なら移設先に残っていること。
- `generated/**`、`tmp/**`、過去 export/log への不要参照を増やしていないこと。
- `README.md`、`AGENT.md`、`PROGRESS.md` の責務が混ざっていないこと。

## Schema 変更

対象:

- `src/model/schema.ts`
- `src/model/defaults.ts`
- `src/model/types.ts`

最低確認:

- `node --experimental-strip-types -e "import('./src/public-api.ts')"`
- `node --test tests/*.test.mjs`
- [docs/CODEBASE_STRUCTURE.md](CODEBASE_STRUCTURE.md) と relevant FEBio / research docs の更新。
- `PROGRESS.md` の status / Resume From Here 更新。

## Classification 変更

対象:

- `src/results/classification.ts`
- detachment 判定を消費する public API / compatibility caller

最低確認:

- `node --test tests/*.test.mjs`
- native / proxy fallback label が維持されていること。
- [docs/DECISIONS.md](DECISIONS.md) の detachment 定義と矛盾しないこと。
- `PROGRESS.md` の Classification / Detachment status 更新。

## Export / Import 変更

対象:

- `src/febio/export/`
- `src/febio/import/`
- `scripts/convert_febio_output.mjs`

最低確認:

- `node --experimental-strip-types -e "import('./src/public-api.ts')"`
- `node --test tests/*.test.mjs`
- [febio/BRIDGE_CONTRACT.md](febio/BRIDGE_CONTRACT.md)、[febio/FEBIO_OUTPUT_MAPPING.md](febio/FEBIO_OUTPUT_MAPPING.md)、必要なら [research/CONDITION_MATRIX.md](research/CONDITION_MATRIX.md) の更新。
- native / proxy provenance が消えていないこと。

## Compatibility Bridge 変更

対象:

- `simulation.js`
- `js/simulation-febio.js`
- `js/simulation-ui.js`
- `src/browser/main.ts`
- bridge scripts

最低確認:

- `node scripts/build-dist.mjs`
- `node --test tests/*.test.mjs`
- canonical public API を優先し、compatibility-local ownership を増やしていないこと。
- [ops/RESTART_CHECKLIST.md](ops/RESTART_CHECKLIST.md) と `PROGRESS.md` の次アクションが実態に合っていること。
