# 変更ワークフロー

## 標準フロー

1. 依頼の編集対象、参照可、参照禁止、非目的を確認する。
2. [../CODEBASE_STRUCTURE.md](../CODEBASE_STRUCTURE.md) で source-of-truth を確認する。
3. relevant `.skills/**/SKILL.md` がある場合は先に読む。
4. 最小 read set で対象を編集する。
5. 変更種別に応じて [../VALIDATION_MATRIX.md](../VALIDATION_MATRIX.md) の最低検証を実行する。
6. `PROGRESS.md`、`docs/ops/ROADMAP.md`、`docs/DECISIONS.md`、research / FEBio docs の同期が必要か確認する。
7. 最後にリンク切れ、古い root path、生成物参照の混入を確認する。

## 文書だけの変更

- root 文書の責務を混ぜない。
- 詳細は docs 配下へ寄せる。
- 同じ説明を 3 箇所以上へ増やさない。
- 歴史は `docs/history/`、判断理由は `docs/DECISIONS.md` に置く。

## コードを伴う変更

- source-of-truth file を先に編集する。
- compatibility layer は caller / bridge として扱う。
- native / proxy / planned / legacy / debug を名前や provenance で明示する。
- `implemented / partial / planned` が変わる場合は `PROGRESS.md` を同じ変更セットで更新する。
- 主ロードマップの stage status / scope、全体優先順位、補助ロードマップの位置づけが変わる場合は `docs/ops/ROADMAP.md` も同じ変更セットで更新する。
- 直近タスクだけが変わる場合は `PROGRESS.md` に留め、`ROADMAP.md` に next action を重複させない。
