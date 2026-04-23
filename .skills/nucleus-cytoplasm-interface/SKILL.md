---
name: nucleus-cytoplasm-interface
description: nucleus-cytoplasm interface changes with minimal exploration and explicit proxy/native tracking
---

## Purpose
核-細胞質 interface の変更を、探索範囲を絞って進める。

## Read first
- `AGENT.md`
- `PROGRESS.md`
- `src/febio/interfaces/nucleusCytoplasm.ts`

## Allowed references
- `src/model/schema.ts`
- `src/febio/export/index.ts`
- `src/febio/import/normalizeFebioResult.ts`

## Do not read first
- `legacy/`
- `experiments/`
- `generated/`
- `src/surrogate/*`

## Source of truth
- `src/febio/interfaces/nucleusCytoplasm.ts`

## Tasks covered
- sticky cohesive tuning
- true cohesive preparation
- `localNc` native/proxy 整理
- detachment 関連 interface 出力整理

## Required checks
- proxy/native の区別が明示されているか
- detachment 判定に必要な damage + geometry の情報を壊していないか
- export/import/classification との整合が崩れていないか
- この skill を使った作業で想定外探索や見落としが出ていないか
- `Read first` / `Allowed references` / `Do not read first` に不足があれば、この skill 自体を更新するか

## Skill maintenance
- この skill を使った作業で、想定外探索や見落としが出たら、この skill を更新する
- `Read first` / `Allowed references` / `Do not read first` の不足は会話で済ませず skill に戻す
- skill の更新は、その不足が見つかった変更セットと同じ変更セットで行う

## Update docs when
- cohesive model が変わる
- proxy/native 依存が変わる
- detachment 判定に影響する
