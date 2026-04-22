---
name: progress-update
description: keep progress documentation synchronized with source-of-truth modules and research priorities
---

## Purpose
`PROGRESS.md` をコードと同期させる。

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
- 過去の export データ

## Source of truth
- 変更対象の source-of-truth ファイル

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

## Update docs when
- 物理モデルの状態が変わる
- priority が変わる
- proxy/native の説明が変わる
- main flow の ownership が変わる
