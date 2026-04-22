---
name: schema-edit
description: canonical parameter schema edits with minimal references and naming discipline
---

## Purpose
parameter schema と default 値を正本側で更新する。

## Read first
- `AGENT.md`
- `src/model/schema.ts`
- `src/model/defaults.ts`
- `src/model/types.ts`

## Allowed references
- `src/febio/export/`
- `src/febio/import/normalizeFebioResult.ts`

## Do not read first
- `legacy/`
- `experiments/`
- `generated/`
- 過去の export データ

## Source of truth
- `src/model/schema.ts`

## Tasks covered
- parameter 追加
- canonical spec 変更
- default 値更新
- 命名統一

## Required checks
- source of truth が schema に一元化されているか
- export / import / result と整合しているか
- 命名揺れが増えていないか

## Update docs when
- canonical parameter が増減する
- naming が変わる
- export/import の対応関係が変わる
