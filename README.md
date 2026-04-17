# 核単離シミュレータ

ブラウザで条件設定と可視化を行い、FEBio へ渡す `.feb` を出力できるシミュレータです。

## 現在の構成

- `lightweight`
  - アプリ内の JS 縮約モデルをその場で実行します
- `febio`
  - UI / schema / export は FEBio bridge を通ります
  - ただしアプリ内 solver はまだ mock です

重要:

- `.feb` XML の生成は実装済みです
- 外部の `febio4.exe` に渡して CLI 実行するスクリプトも入っています
- ただしアプリの `febio` ボタン自体がブラウザ内から FEBio を直接起動するわけではありません

## 起動

```powershell
Start-Process 'C:\Users\xiogo\projects\nuclear_simu\index.html'
```

## ブラウザ側でできること

- Case A / B / C 実行
- 全ケース比較
- パラメータスイープ
- 断面図 / 上面図の表示
- `FEBio JSON保存`
- `FEBio XML保存`
- `FEBio引き渡し一式`

## FEBio 実行フロー

### 1. ブラウザから出力

次のいずれかを使います。

- `FEBio XML保存`
  - `.feb` だけ保存
- `FEBio引き渡し一式`
  - `.feb` / input JSON / manifest / README をまとめて保存

### 2. CLI から出力

ブラウザを開かずに `.feb` を作るなら次です。

```powershell
node scripts/export_febio_case.mjs --case A --out-dir febio_exports\A
```

一式を出力します。

- `case_A.feb`
- `febio_case_A_input.json`
- `febio_case_A_manifest.json`
- `febio_case_A_README.txt`

### 3. FEBio を実行

既存の `.feb` を実行するなら次です。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile febio_exports\A\case_A.feb
```

`.feb` 生成から実行までまとめてやるなら次です。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export_and_run_febio_case.ps1 -CaseName A
```

## 追加したスクリプト

- `scripts/export_febio_case.mjs`
  - `simulation.js` を Node VM で読み、Case A/B/C の `.feb` と handoff 一式を出力します
- `scripts/run_febio_case.ps1`
  - `febio4.exe` を探して `.feb` を実行します
- `scripts/export_and_run_febio_case.ps1`
  - 出力と実行を 1 回で行います

## 実行確認

この環境では次を確認済みです。

- `C:\Program Files\FEBioStudio\bin\febio4.exe` を検出
- `node scripts/export_febio_case.mjs --case A --out-dir febio_exports\A`
- `powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile febio_exports\A\case_A.feb`
- `case_A.log` と `case_A.xplt` の生成

現状の `.feb` は「まず FEBio で読めて回る」ことを優先した最小構成です。接触や cohesive を本格反映した高忠実度版は次段階です。

## 出力物

実行後は例えば次ができます。

- `febio_exports\A\run\case_A.log`
- `febio_exports\A\run\case_A.xplt`
- `febio_exports\A\run\case_A_cli.log`

## 今後の差し込み位置

- `buildFebioTemplateData`
  - FEBio 用中間表現
- `serializeFebioTemplateToXml`
  - `.feb` 直列化
- `runFebioSimulation`
  - 将来の CLI 自動実行差し込み口
- `importFebioResult`
  - FEBio 出力の app schema 化

## 関連ファイル

- `simulation.js`
- `index.html`
- `styles.css`
- `FEBIO_HANDOFF.md`
- `scripts/export_febio_case.mjs`
- `scripts/run_febio_case.ps1`
- `scripts/export_and_run_febio_case.ps1`

## Code Structure

- 繧ｳ繝ｼ繝峨・蛻晄悄繝ｫ繝ｼ繝ｫ縺ｨ蜷榊燕隱ｬ譏弱・ [CODEBASE_STRUCTURE.md](./CODEBASE_STRUCTURE.md)
