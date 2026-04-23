---
name: refresh-skill-after-blocker
description: tighten a task-specific skill after a blocker so the next run explores less and reaches the source of truth faster
---

## Purpose
After a blocker appears while following a task-specific `SKILL.md`, update that skill so the next run reaches the right files faster with less exploration.

## Read first
- `AGENT.md`
- the blocked task-specific `SKILL.md`
- the affected source-of-truth file

## Allowed references
- `PROGRESS.md`
- `CODEBASE_STRUCTURE.md`
- the minimal set of files needed to explain the blocker

## Do not read first
- `legacy/`
- `experiments/`
- `generated/`
- `tmp/`
- past exports
- past logs
- snapshots

## Source of truth
- repo-wide exploration constraints: `AGENT.md`
- local task boundary: the blocked `SKILL.md`
- domain ownership: the affected source-of-truth file

## Tasks covered
- tighten or widen allowed references minimally
- fix read order
- reduce future exploration
- update stale skill boundaries

## Required checks
- was `Read first` missing something necessary
- was `Allowed references` too narrow or too broad
- was `Do not read first` easy to violate in practice
- was `Update docs when` incomplete
- was the source-of-truth path too hard to reach
- keep the fix minimal and avoid turning the skill into a repo-wide search permit
- make sure the next run reads fewer unnecessary files, not more

## Update docs when
- the blocker came from a missing or misleading skill boundary
- read order needs correction
- allowed references need minimal tightening or widening
- source-of-truth routing needs a stronger pointer
- stale skill wording caused repeated drift
