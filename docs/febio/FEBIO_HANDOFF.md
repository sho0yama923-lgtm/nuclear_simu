# FEBio Handoff

## いま何ができるか

- ブラウザから `.feb` を保存できる
- handoff 用 JSON / manifest / README をまとめて保存できる
- CLI からも `.feb` を生成できる
- `febio4.exe` を使って外部実行できる

## 推奨フロー

### ブラウザから渡す

1. 条件を決める
2. `FEBio引き渡し一式` を押す
3. 生成された `.feb` と JSON 群を FEBio 実行側へ渡す

### CLI から渡す

```powershell
node scripts/export_febio_case.mjs --case A --out-dir febio_exports\A
```

## 実行

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile febio_exports\A\case_A.feb
```

または

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export_and_run_febio_case.ps1 -CaseName A
```

## 生成される主なファイル

- `case_A.feb`
- `case_A.log`
- `case_A.xplt`
- `case_A_cli.log`
- `febio_case_A_input.json`
- `febio_case_A_manifest.json`

## 注意

現在の FEBio 実行モデルは「FEBio で実際に読んで回せる最小構成」を優先しています。

- parser / solver は通る
- `.log` と `.xplt` は出る
- ただし接触・cohesive を本格的に反映した高忠実度版ではまだない

つまり現段階では、

- 環境整備と CLI 実行は完了
- 高忠実度な FEBio 物理モデル化は次段階

です。

## 今後の実装先

- `buildFebioTemplateData`
- `serializeFebioTemplateToXml`
- `runFebioSimulation`
- `importFebioResult`
