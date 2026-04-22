---
name: classification-native
description: native-first classification updates with explicit detachment alignment and proxy fallback labeling
---

## Purpose
classification を native-first に寄せる。

## Read first
- `AGENT.md`
- `PROGRESS.md`
- `src/results/classification.ts`
- `src/febio/import/normalizeFebioResult.ts`

## Allowed references
- `src/model/schema.ts`
- `src/febio/interfaces/nucleusCytoplasm.ts`

## Do not read first
- `legacy/`
- `experiments/`
- `generated/`
- `src/surrogate/*`

## Source of truth
- `src/results/classification.ts`

## Tasks covered
- classification の native 化
- detachment ラベル追加
- proxy 依存の削減
- provenance 反映

## Required checks
- classification が native データを優先しているか
- proxy fallback が明示されているか
- detachment 定義と矛盾しないか

## Update docs when
- classification 条件が変わる
- detachment 定義が変わる
- proxy/native の優先順位が変わる
