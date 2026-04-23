---
name: sync-agent-skill-boundaries
description: compare AGENT.md and SKILL.md boundaries and align exploration limits, source of truth, priorities, and empirical wording
---

## Purpose
Check whether `AGENT.md` and the relevant `SKILL.md` still agree on exploration limits, source-of-truth routing, priorities, and the role of empirical validation.

## Read first
- `AGENT.md`
- the target task-specific `SKILL.md`
- `.skills/empirical-prompt-tuning/SKILL.md`

## Allowed references
- `PROGRESS.md`
- `CODEBASE_STRUCTURE.md`
- the source-of-truth file named by the skill

## Do not read first
- `legacy/`
- `experiments/`
- `generated/`
- `tmp/`
- past exports
- past logs
- snapshots

## Source of truth
- repo-wide boundaries and priority: `AGENT.md`
- local procedure and bounded read scope: each `SKILL.md`
- current state and active priority picture: `PROGRESS.md`

## Tasks covered
- compare AGENT vs skill boundaries
- detect mismatch in read scope
- detect mismatch in priority or ownership
- align empirical usage wording

## Required checks
- AGENT source-of-truth rules match the skill wording
- AGENT priority matches the skill scope
- AGENT-forbidden exploration is not implicitly allowed by the skill
- task-specific skills remain the first choice for normal implementation work
- `empirical-prompt-tuning` stays a quality-improvement tool, not the default implementation flow
- operational-maintenance skills do not replace task-specific implementation skills

## Update docs when
- AGENT and skill source-of-truth wording drift apart
- read scope or forbidden-area wording drifts apart
- priority or ownership wording drifts apart
- empirical usage wording drifts away from the task-specific flow
- the sync result requires follow-up in `PROGRESS.md` or `CODEBASE_STRUCTURE.md`
