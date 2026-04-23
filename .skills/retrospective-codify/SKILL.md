---
name: retrospective-codify
description: classify recurring operational issues and codify the smallest durable fix into the right doc or skill
---

## Purpose
Turn a recurring operational issue discovered during work into the smallest durable update in `AGENT.md`, a `SKILL.md`, `PROGRESS.md`, or `CODEBASE_STRUCTURE.md`.

## Read first
- `AGENT.md`
- the relevant task-specific `SKILL.md`
- `PROGRESS.md`

## Allowed references
- `CODEBASE_STRUCTURE.md`
- the affected source-of-truth file
- the candidate `SKILL.md` to update

## Do not read first
- `legacy/`
- `experiments/`
- `generated/`
- `tmp/`
- past exports
- past logs
- snapshots

## Source of truth
- repo-wide operating rules: `AGENT.md`
- local procedures and bounded read sets: the relevant `SKILL.md`
- current state recognition: `PROGRESS.md`
- source layout and navigation: `CODEBASE_STRUCTURE.md`

## Tasks covered
- unexpected exploration happened
- source-of-truth was unclear
- read order was insufficient
- a repeated natural-language explanation should become a skill/doc rule
- a recurring blocker should be codified

## Required checks
- confirm the issue is recurring rather than one-off
- identify the correct codification target
- keep the fix minimal and durable
- list every doc that must change in the same change set
- if the issue spans more than one layer, update all affected layers together
- keep empirical as a quality-improvement path, not a default implementation path

## Update docs when
- the same exploration mistake happens more than once
- source-of-truth routing was unclear
- read order caused avoidable exploration
- a repeated chat explanation should become a rule
- a recurring blocker should be reflected in both rule and state docs
