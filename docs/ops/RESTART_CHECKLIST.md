# 再開チェックリスト

中断後に再開するときの読み順です。

## 最短再開

1. [../../PROGRESS.md](../../PROGRESS.md)
2. [ROADMAP.md](ROADMAP.md): 全体優先順位、current stage、補助ロードマップの位置づけが曖昧なときだけ読む
3. [../CODEBASE_STRUCTURE.md](../CODEBASE_STRUCTURE.md)
4. relevant `.skills/**/SKILL.md`
5. 依頼で指定された編集対象

## 物理モデルを触るとき

1. [../../PROGRESS.md](../../PROGRESS.md)
2. [../research/RESEARCH_QUESTION.md](../research/RESEARCH_QUESTION.md)
3. [../research/ASSUMPTIONS.md](../research/ASSUMPTIONS.md)
4. [../febio/FEBIO_MODELING_POLICY.md](../febio/FEBIO_MODELING_POLICY.md)
5. [../febio/INTERFACE_MODEL.md](../febio/INTERFACE_MODEL.md)

## FEBio 実行経路を触るとき

1. [../febio/RUNBOOK.md](../febio/RUNBOOK.md)
2. [../../legacy/docs/febio/BRIDGE_CONTRACT.md](../../legacy/docs/febio/BRIDGE_CONTRACT.md)
3. [../febio/FEBIO_OUTPUT_MAPPING.md](../febio/FEBIO_OUTPUT_MAPPING.md)
4. [../VALIDATION_MATRIX.md](../VALIDATION_MATRIX.md)

## 互換層退役を触るとき

1. [../../AGENT.md](../../AGENT.md)
2. [../DECISIONS.md](../DECISIONS.md)
3. [../CODEBASE_STRUCTURE.md](../CODEBASE_STRUCTURE.md)
4. `src/public-api.ts`
5. `src/results/classification.ts`
6. `scripts/export_febio_case.mjs`
7. `scripts/convert_febio_output.mjs`
8. `tests/febio-front-end.test.mjs`

Legacy JS simulation files are read only when the task explicitly targets browser compatibility behavior.
