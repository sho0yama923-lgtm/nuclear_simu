# nuclear_simu

核が細胞質から脱落する条件を、FEBio を主系にして評価するための研究用フロントエンドです。

## 概要

このリポジトリは、UI 入力から canonical spec を作り、FEBio 用 `.feb` を export し、FEBio CLI の結果を正規化して表示する流れを扱います。現在の main path は次です。

1. UI input
2. canonical spec
3. FEBio template / `.feb` XML
4. FEBio CLI execution
5. normalized result import
6. physical result rendering

## Read First

1. [AGENT.md](AGENT.md)
2. [docs/CODEBASE_STRUCTURE.md](docs/CODEBASE_STRUCTURE.md)
3. relevant `.skills/**/SKILL.md`
4. [PROGRESS.md](PROGRESS.md)

## 最低限のコマンド

- build: `node scripts/build-dist.mjs`
- source parse check: `node --experimental-strip-types -e "import('./src/public-api.ts')"`
- tests: `node --test tests/*.test.mjs`
- npm wrapper: `cmd /c npm.cmd test`

## ドキュメント入口

- 現在状態と再開位置: [PROGRESS.md](PROGRESS.md)
- AI / Codex 向け運用原則: [AGENT.md](AGENT.md)
- 日常作業の依頼テンプレ: [TASK_REQUEST_TEMPLATE.md](TASK_REQUEST_TEMPLATE.md)
- repo 構造と source-of-truth: [docs/CODEBASE_STRUCTURE.md](docs/CODEBASE_STRUCTURE.md)
- 検証方針: [docs/VALIDATION_MATRIX.md](docs/VALIDATION_MATRIX.md)
- 設計判断: [docs/DECISIONS.md](docs/DECISIONS.md)
- 研究条件: [docs/research/](docs/research/)
- FEBio 実装仕様: [docs/febio/](docs/febio/)
- 日常運用: [docs/ops/](docs/ops/)

## 大事な前提

- canonical logic は `src/` を編集します。
- `generated/` と `tmp/` は生成物・一時出力です。
- 物理モデル、detachment、classification、export/import の意味を変える変更では [PROGRESS.md](PROGRESS.md) と関連 docs を同じ変更セットで更新します。
