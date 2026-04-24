# コードベース構造

この文書は repo 構造と source-of-truth の地図です。入口は [README.md](../README.md)、AI / Codex の運用原則は [AGENT.md](../AGENT.md)、現在状態は [PROGRESS.md](../PROGRESS.md) を参照してください。

## 読む順番

多くの変更では、次の順に読む。

1. [AGENT.md](../AGENT.md)
2. [docs/CODEBASE_STRUCTURE.md](CODEBASE_STRUCTURE.md)
3. relevant `.skills/**/SKILL.md`
4. [PROGRESS.md](../PROGRESS.md) when touching physics model, main flow, export/import, classification, or proxy/native dependencies

## 正規情報源の配置

- `src/model/schema.ts`
  - parameter schema、validation、digest、schedule metadata、normalized input spec の source-of-truth。
- `src/model/defaults.ts`
  - editable field groups と default values。
- `src/model/types.ts`
  - shared region names、schema constants、coordinate metadata。
- `src/febio/mesh/index.ts`
  - mesh と surface-pair の source-of-truth。
- `src/febio/interfaces/nucleusCytoplasm.ts`
  - nucleus-cytoplasm interface の source-of-truth。sticky cohesive stabilization、stabilization validation、proxy/native observation ownership を含む。
- `src/febio/export/index.ts`
  - FEBio template assembly、XML serialization、export bundle entrypoint、detachment event contract metadata、face-data coverage metadata、plotfile `contact traction` bridge contract。
- `src/febio/import/normalizeFebioResult.ts`
  - FEBio result normalization entrypoint。native-first `localNc` / `localCd` merge、native face-data fallback、native regional metrics、source labels、explicit external detachment event normalization、history backfill を担う。
- `src/results/classification.ts`
  - native-first classification と detachment interpretation。proxy fallback labeling と shared classification application を含む。
- `src/public-api.ts`
  - tests と compatibility integration 用 public API。canonical classification application と detachment assessment bridge を公開する。
- `src/browser/main.ts`
  - browser entry。public API を公開し、legacy compatibility scripts を起動する。

## 生成物と派生物

- `generated/dist/`
  - `src/` から `node scripts/build-dist.mjs` で生成される。手で編集しない。
- `generated/febio_exports/`
  - FEBio export bundle、bridge output、scan、historical run artifacts の既定出力先。
- `tmp/logs/`
  - bridge output logs などの disposable local logs。

## 互換バンドル

- `simulation.js`
  - browser app 用 legacy compatibility layer。schema / classification / detachment の長期 source-of-truth ではない。
- `js/simulation-febio.js`
  - legacy FEBio compatibility layer。
- `js/simulation-ui.js`
  - legacy UI runtime。

Compatibility は退役経路に置く。新しい長期責務は canonical `src/` module に置き、compatibility 側は bridge/caller として薄くする。

## 文書

- [README.md](../README.md)
  - 人間向け入口、概要、最短導線、最低限のコマンド。
- [AGENT.md](../AGENT.md)
  - AI / Codex 向けの不変運用ルール。
- [PROGRESS.md](../PROGRESS.md)
  - 現在状態と中断再開の単一ソース。
- [TASK_REQUEST_TEMPLATE.md](../TASK_REQUEST_TEMPLATE.md)
  - 日常作業依頼のテンプレ。
- [docs/DECISIONS.md](DECISIONS.md)
  - 設計判断の単一ファイル。
- [docs/VALIDATION_MATRIX.md](VALIDATION_MATRIX.md)
  - 変更種別ごとの最低検証。
- [docs/ops/](ops/)
  - 変更フロー、doc 同期、再開手順。
- [docs/research/](research/)
  - 研究問い、仮定、条件表、用語・指標。
- [docs/febio/](febio/)
  - FEBio modeling、interface、bridge、runbook、output mapping。

## テスト

- `tests/febio-front-end.test.mjs`
  - public API、FEBio export/import、classification、governance checks。
- `tests/load-app.mjs`
  - `generated/dist/public-api.js` の dynamic import helper。

## ビルドと入口

- `scripts/build-dist.mjs`
  - `src/**/*.ts` を `generated/dist/**/*.js` へコピーし、relative import extensions を書き換える。
- `scripts/convert_febio_output.mjs`
  - FEBio logfile output を app-result JSON へ変換する。explicit detachment events、detachment metrics、provenance、native face tangential traction reuse、plotfile contact-traction bridge reuse を扱う。
- `index.html`
  - `generated/dist/browser/main.js` を読み、legacy browser scripts を順に起動する。

## 探索時の注意

- source-of-truth は `src/` を優先する。
- skill や AGENT rule が対象ファイルを示している場合、repo-wide exploration は避ける。
- public `index.ts` がある場合、internal file への deep import は避ける。
- `generated/` と `tmp/` は durable source ではない。
- 2026-04-24 note: `simulation.js` classification / detachment helpers are now thin canonical public API callers in the active browser path, and `scripts/convert_febio_output.mjs` injects that same public API into its compatibility sandbox so the converter no longer owns a separate active classification branch.
