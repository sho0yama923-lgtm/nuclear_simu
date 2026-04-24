# 文書同期チェックリスト

変更後に同期対象を確認するためのチェックリストです。

## 常に確認

- [../README.md](../../README.md): 入口リンクや最低コマンドが変わったか。
- [../AGENT.md](../../AGENT.md): AI / Codex の不変運用ルールが変わったか。
- [../PROGRESS.md](../../PROGRESS.md): 現在状態、blocker、next action が変わったか。
- [../CODEBASE_STRUCTURE.md](../CODEBASE_STRUCTURE.md): source-of-truth や repo 構造が変わったか。
- [../VALIDATION_MATRIX.md](../VALIDATION_MATRIX.md): 最低検証が変わったか。
- [ROADMAP.md](ROADMAP.md): 全体優先順位、主ロードマップの stage status / scope、補助ロードマップの位置づけが変わったか。

## PROGRESS と ROADMAP の判定

- 直近の作業対象、次に開くファイル、done condition、blocker が変わっただけなら `PROGRESS.md` を更新する。
- 主ロードマップの current stage、completed/current/deferred、After Current 候補、補助ロードマップの位置づけが変わったら `ROADMAP.md` も更新する。
- `ROADMAP.md` に今日の next action を置かない。`PROGRESS.md` に大きな stage 計画を重複させない。

## 研究条件が変わるとき

- [../research/RESEARCH_QUESTION.md](../research/RESEARCH_QUESTION.md)
- [../research/ASSUMPTIONS.md](../research/ASSUMPTIONS.md)
- [../research/CONDITION_MATRIX.md](../research/CONDITION_MATRIX.md)
- [../research/TERMS_AND_METRICS.md](../research/TERMS_AND_METRICS.md)
- [../research/SIMULATION_MODEL_AND_CALCULATION_CONDITIONS.md](../research/SIMULATION_MODEL_AND_CALCULATION_CONDITIONS.md)

## FEBio 実装が変わるとき

- [../febio/FEBIO_MODELING_POLICY.md](../febio/FEBIO_MODELING_POLICY.md)
- [../febio/INTERFACE_MODEL.md](../febio/INTERFACE_MODEL.md)
- [../febio/BRIDGE_CONTRACT.md](../febio/BRIDGE_CONTRACT.md)
- [../febio/RUNBOOK.md](../febio/RUNBOOK.md)
- [../febio/FEBIO_OUTPUT_MAPPING.md](../febio/FEBIO_OUTPUT_MAPPING.md)
- [../febio/PARAMETER_MAPPING.md](../febio/PARAMETER_MAPPING.md)

## 判断理由が増えるとき

- [../DECISIONS.md](../DECISIONS.md) に背景、採用方針、理由、先送りした案を書く。
- `PROGRESS.md` には現在状態だけを残す。
