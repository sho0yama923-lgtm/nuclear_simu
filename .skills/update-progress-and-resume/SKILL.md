---
name: update-progress-and-resume
description: keep PROGRESS.md restart-friendly by updating the operating picture, resume point, blockers, and next concrete step
---

## Purpose
`PROGRESS.md` を中断後に再開しやすい運転席として更新する。resume 状態と次の具体的アクションを重視し、`PROGRESS.md` は日本語で書く。

## Read first
- `AGENT.md`
- `PROGRESS.md`
- `CODEBASE_STRUCTURE.md`

## Allowed references
- the affected source-of-truth file
- the relevant task-specific `SKILL.md`
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
- current operating state: `PROGRESS.md`
- repo-wide priority and operating rules: `AGENT.md`

## Tasks covered
- reflect changed priority
- update next actionable step
- record blocker / workaround / intended fix
- make interrupted work resumable

## Required checks
- `Current Operating Picture` が短く読めるか
- `Priority Stack` が `AGENT.md` と一致しているか
- `Resume From Here` が次に開く実ファイルと具体的な完了条件を示しているか
- `Open Problems / Blockers` が recurring blocker を見える形で残しているか
- `Next 3 Steps` に target files / expected output / done condition があるか
- durable な設計判断が変わったときだけ `Decision Log` を増やしているか
- `PROGRESS.md` の記述が日本語で統一されているか
- 単純な status 同期で足りる場合は `progress-update` と役割を混同しない

## Update docs when
- priority が変わる
- next action が変わる
- blocker / workaround / intended fix が変わる
- restart point が変わる
- compatibility-bridge または canonical ownership の説明が変わる
