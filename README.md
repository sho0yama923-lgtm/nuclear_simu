# nuclear_simu

核が細胞質から脱落する条件を、FEBio を主系にして評価するための研究用フロントエンドです。

## 概要

このリポジトリの現在の main path は、FEBio-native case JSON から直接 FEBio `.feb` と handoff artifacts を生成する native-only 経路です。旧 UI / canonical / direct exporter / browser bridge は legacy / compatibility 扱いです。

1. `febio_cases/native/*.native.json`
2. `src/febio/native/`
3. `scripts/export_febio_native_case.mjs`
4. `febio_exports/<case>/<case>.feb`
5. FEBio CLI / Studio confirmation

現在の主要ファイルは [ACTIVE_FILES.md](ACTIVE_FILES.md) にまとめています。退役済みの docs / historical exports は [legacy/](legacy/) にあります。

## 最初に読むもの

1. [AGENT.md](AGENT.md)
2. [ACTIVE_FILES.md](ACTIVE_FILES.md)
3. [docs/CODEBASE_STRUCTURE.md](docs/CODEBASE_STRUCTURE.md)
4. [docs/febio/FEBIO_PATH_OWNERSHIP.md](docs/febio/FEBIO_PATH_OWNERSHIP.md)
5. [PROGRESS.md](PROGRESS.md)

## 最低限のコマンド

- build: `node scripts/build-dist.mjs`
- native-only tests: `node --test --experimental-test-isolation=none tests/febio-native-pipeline.test.mjs`
- full current regression: `node --test --experimental-test-isolation=none tests/febio-front-end.test.mjs tests/febio-native-pipeline.test.mjs`
- FEBio native export: `node scripts/export_febio_native_case.mjs --case febio_cases/native/S7_baseline.native.json --out-dir febio_exports/S7_native_baseline`

## ドキュメント入口

- 現在状態と再開位置: [PROGRESS.md](PROGRESS.md)
- 現在の主要ファイル: [ACTIVE_FILES.md](ACTIVE_FILES.md)
- AI / Codex 向け運用原則: [AGENT.md](AGENT.md)
- 日常作業の依頼テンプレ: [TASK_REQUEST_TEMPLATE.md](TASK_REQUEST_TEMPLATE.md)
- repo 構造と source-of-truth: [docs/CODEBASE_STRUCTURE.md](docs/CODEBASE_STRUCTURE.md)
- 検証方針: [docs/VALIDATION_MATRIX.md](docs/VALIDATION_MATRIX.md)
- 設計判断: [docs/DECISIONS.md](docs/DECISIONS.md)
- 研究条件: [docs/research/](docs/research/)
- FEBio active path ownership: [docs/febio/FEBIO_PATH_OWNERSHIP.md](docs/febio/FEBIO_PATH_OWNERSHIP.md)
- FEBio 実装仕様: [docs/febio/](docs/febio/)
- 退役済み資料 / historical exports: [legacy/](legacy/)
- 日常運用: [docs/ops/](docs/ops/)

## 大事な前提

- 新しい FEBio solver-facing work は `febio_cases/native/`、`src/febio/native/`、`scripts/export_febio_native_case.mjs` だけを active path として扱います。
- 旧 UI / canonical / public API / browser bridge / historical export artifacts は legacy / compatibility 扱いです。
- `generated/` と `tmp/` は生成物・一時出力です。
- 物理モデル、contact、pressure、export の意味を変える変更では [PROGRESS.md](PROGRESS.md) と関連 docs を同じ変更セットで更新します。
