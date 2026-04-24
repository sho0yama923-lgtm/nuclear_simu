---
name: progress-update
description: `PROGRESS.md` を現行状態に同期し、必要な場合だけ `docs/ops/ROADMAP.md` の大きな優先順位や stage 計画も更新する
---

## Purpose
`PROGRESS.md` をコードと現行状態に合わせて更新する。`PROGRESS.md` は日本語で書く。直近タスクは `PROGRESS.md`、大きな優先順位と stage 計画は `docs/ops/ROADMAP.md` に置く。

## Read first
- `AGENT.md`
- `PROGRESS.md`
- `docs/ops/ROADMAP.md`
- `CODEBASE_STRUCTURE.md`

## Allowed references
- 変更対象の source-of-truth ファイル
- `README.md`
- `docs/ops/ROADMAP.md`

## Do not read first
- `legacy/`
- `experiments/`
- `generated/`
- `tmp/`
- past exports
- past logs
- snapshots

## Source of truth
- 変更対象の source-of-truth ファイル
- `PROGRESS.md`
- broad priority and stage plan: `docs/ops/ROADMAP.md`

## Tasks covered
- `implemented / partial / planned` 更新
- current priority 更新
- rough approximations 更新
- next steps 更新
- 回帰の記録
- 必要な場合だけ roadmap stage / broad priority 更新

## Required checks
- コードと docs の状態が一致しているか
- proxy/native の説明が一致しているか
- priority が現行研究目的と整合しているか
- 全体優先順位、主ロードマップ、補助ロードマップ、次の3手（現在処理中タスクの3手）が混同されていないか
- 直近タスクだけが変わった場合は `PROGRESS.md` の `再開位置` と `次の3手（現在処理中タスクの3手）` だけを更新しているか
- 主ロードマップの current stage、stage status、After Current 候補、補助ロードマップの位置づけが変わる場合は `docs/ops/ROADMAP.md` も更新しているか
- `docs/ops/ROADMAP.md` に直近 next action や今日開くファイルを置いていないか
- compatibility bundle の責務説明と canonical `src/` ownership が一致しているか
- `PROGRESS.md` の追記や修正が日本語で統一されているか
- `Read first` / `Allowed references` / `Do not read first` の不足がないか

## Skill maintenance
- この skill を使った作業で、想定外探索や見落としが出たら、この skill を更新する
- `Read first` / `Allowed references` / `Do not read first` の不足は skill に戻す
- skill の更新は、その不足が見つかった変更セットと同じ変更セットで行う

## Update docs when
- 物理モデルの状態が変わる
- priority が変わる
- main roadmap の stage status / scope が変わる
- auxiliary roadmap の位置づけや完了条件が変わる
- proxy/native の説明が変わる
- main flow の ownership が変わる
- `simulation.js` の責務や compatibility bridge の範囲が変わる
- 直近の作業対象、next action、done condition が変わる
