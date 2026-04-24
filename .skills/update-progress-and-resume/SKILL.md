---
name: update-progress-and-resume
description: keep PROGRESS.md restart-friendly, and update ROADMAP only when broad priority or stage planning changes
---

## Purpose
`PROGRESS.md` を中断後に再開しやすい運転席として更新する。resume 状態と次の具体的アクションを重視し、`PROGRESS.md` は日本語で書く。`docs/ops/ROADMAP.md` は全体優先順位と stage 計画だけを置く。

## Read first
- `AGENT.md`
- `PROGRESS.md`
- `docs/ops/ROADMAP.md`
- `CODEBASE_STRUCTURE.md`

## Allowed references
- the affected source-of-truth file
- the relevant task-specific `SKILL.md`
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
- current operating state: `PROGRESS.md`
- repo-wide priority and stage plan: `docs/ops/ROADMAP.md`
- stable operating rules: `AGENT.md`

## Tasks covered
- reflect changed priority
- update next actionable step
- record blocker / workaround / intended fix
- make interrupted work resumable
- update roadmap stage status only when the broad plan changed

## Required checks
- `現在の状況` が短く読めるか
- `優先順位の見方` が `docs/ops/ROADMAP.md` と一致しているか
- `再開位置` が次に開く実ファイルと具体的な完了条件を示しているか
- `未解決問題 / Blockers` が recurring blocker を見える形で残しているか
- `次の3手（現在処理中タスクの3手）` に target files / expected output / done condition があるか
- 全体優先順位と次の3手（現在処理中タスクの3手）が混同されていないか
- 補助ロードマップを「第二優先」として読ませない表現になっているか
- 作業が進んで next action が変わった場合、次の3手（現在処理中タスクの3手）が更新されているか
- 主ロードマップの current stage、stage status、After Current 候補、補助ロードマップの位置づけが変わる場合は `docs/ops/ROADMAP.md` も更新しているか
- 直近タスクだけが変わった場合、`docs/ops/ROADMAP.md` を不要に更新していないか
- durable な設計判断が変わったときだけ `docs/DECISIONS.md` を増やしているか
- `PROGRESS.md` の記述が日本語で統一されているか
- 単純な status 同期で足りる場合は `progress-update` と役割を混同しない

## Update docs when
- priority が変わる
- next action が変わる
- roadmap stage status / scope が変わる
- blocker / workaround / intended fix が変わる
- restart point が変わる
- compatibility-bridge または canonical ownership の説明が変わる
