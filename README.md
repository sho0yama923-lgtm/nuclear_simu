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

パラメータ欄の単位表記は内部 solver と揃えてあります。
- 幾何・移動量: `um`
- 応力・弾性率: `kPa`
- 粘性: `kPa·s`
- 張力・破壊エネルギー: `N/m`
- ポアソン比・摩擦係数など: 無次元
- `Fhold`, `P_hold`: 現在は内部 proxy 単位

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

- `scripts/febio_scan_case_a.mjs`
  - Case A の FEBio 条件探索をまとめて実行し、上位条件を JSON / CSV で残します

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

## FEBio UI Bridge

- UI から `FEBio Run` / `FEBio View` を使うときは、先に localhost bridge を起動します。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1
```

- bridge は `febio_exports\ui_bridge\case_A` のような固定出力先へ export / run / result import をまとめます。
- 詳細は [FEBIO_UI_BRIDGE.md](./FEBIO_UI_BRIDGE.md) を参照してください。

## Code Structure

- 繧ｳ繝ｼ繝峨・蛻晄悄繝ｫ繝ｼ繝ｫ縺ｨ蜷榊燕隱ｬ譏弱・ [CODEBASE_STRUCTURE.md](./CODEBASE_STRUCTURE.md)
- パラメータと `lightweight` / `FEBio` の対応整理: [PARAMETER_MAPPING.md](./PARAMETER_MAPPING.md)
- FEBio 出力と app result の対応整理: [FEBIO_OUTPUT_MAPPING.md](./FEBIO_OUTPUT_MAPPING.md)
- UI から FEBio を実行する bridge: [FEBIO_UI_BRIDGE.md](./FEBIO_UI_BRIDGE.md)

## Maintenance Rules

- 構成や責務を変えたときは、必要に応じて `README.md` と `CODEBASE_STRUCTURE.md` も一緒に更新します。
- 新しい要素を追加したときは、既存要素と矛盾がないか、古い説明や使われなくなったコード・UI・出力が残っていないかを確認します。
## FEBio-first Notes

- Main UI path: FEBio only
- Main result requirement: `isPhysicalFebioResult = true`
- Architecture note: [FEBIO_FRONTEND_ARCHITECTURE.md](/C:/Users/xiogo/projects/nuclear_simu/FEBIO_FRONTEND_ARCHITECTURE.md)
- Test command:

```powershell
node --test tests\febio-front-end.test.mjs
```
