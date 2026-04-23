# 作業依頼テンプレート

Codex / agent に日常作業を頼むときのテンプレです。必要なところだけ埋めて使います。

## 編集対象

- `path/to/file`

## 参照可

- `path/to/reference`
- relevant `.skills/**/SKILL.md`

## 参照禁止

- `generated/**`
- `tmp/**`
- 過去の export 出力やログ
- 変更に無関係な広いコード探索

## 目的

- この変更で達成したいことを書く。

## 非目的

- この変更で触れないことを書く。
- 例: physics model の意味変更、テストロジック変更、広い refactor。

## 更新対象ドキュメント

- [PROGRESS.md](PROGRESS.md)
- [docs/CODEBASE_STRUCTURE.md](docs/CODEBASE_STRUCTURE.md)
- [docs/DECISIONS.md](docs/DECISIONS.md)
- relevant `docs/research/*`
- relevant `docs/febio/*`

## 検証コマンド

- docs only: link / heading / path の確認
- build: `node scripts/build-dist.mjs`
- source parse check: `node --experimental-strip-types -e "import('./src/public-api.ts')"`
- tests: `node --test tests/*.test.mjs`

## 完了条件

- 編集対象が目的を満たしている。
- source-of-truth と重複説明が増えていない。
- 関連 docs のリンクが通っている。
- 必要な検証が実行され、未実行なら理由が説明されている。
