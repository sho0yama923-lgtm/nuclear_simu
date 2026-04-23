---
name: progress-update
description: `PROGRESS.md` を source-of-truth と現行優先順位に合わせて同期する
---

## Purpose
`PROGRESS.md` をコードと現行優先順位に合わせて更新する。`PROGRESS.md` は日本語で書く。

## Read first
- `AGENT.md`
- `PROGRESS.md`
- `CODEBASE_STRUCTURE.md`

## Allowed references
- 変更対象の source-of-truth ファイル
- `README.md`

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

## Tasks covered
- `implemented / partial / planned` 更新
- current priority 更新
- rough approximations 更新
- next steps 更新
- 回帰の記録

## Required checks
- コードと docs の状態が一致しているか
- proxy/native の説明が一致しているか
- priority が現行研究目的と整合しているか
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
- proxy/native の説明が変わる
- main flow の ownership が変わる
- `simulation.js` の責務や compatibility bridge の範囲が変わる
