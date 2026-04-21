# 核単離シミュレータ

FEBio を実計算本体とし、ブラウザ UI を

- パラメータ入力
- FEBio 入力生成
- 実行補助
- 結果表示

に特化させたフロントエンドです。

## 現在の構成

- 主経路
  - UI 入力
  - canonical spec 正規化
  - FEBio template / `.feb` XML 生成
  - bridge 経由で FEBio 実行
  - 結果 import
  - physical FEBio result 表示
- 旧 lightweight / mock
  - 互換用途の legacy 扱い
  - 主 UI / 主結果には使いません

重要:

- 主表示は physical FEBio result 前提です
- `isPhysicalFebioResult = true` でない結果は main result に採用しません
- 推奨実行経路は `file://index.html` 直開きではなく `http://127.0.0.1:8765/` です

## 起動

まず bridge を起動します。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1 -OpenApp
```

その後、ブラウザでは次を開きます。

- [http://127.0.0.1:8765/](http://127.0.0.1:8765/)

補足:

- `index.html` を直接開いた場合でも、bridge が起動済みなら localhost 側へ自動リダイレクトします
- bridge が止まっていると `FEBio実行` は動きません

## ブラウザ側でできること

### ケース選択
- `ケースA`
- `ケースB`
- `ケースC`

### 実行
- `FEBio実行`
  - `.feb` 生成
  - bridge 経由の FEBio 実行
  - result JSON import
  - physical result 表示
- `結果JSON読込`
- `既定値に戻す`

### 出力
- `FEBio入力(.feb)保存`
- `入力JSON保存`

### 状態
- `bridge` 状態
- `FEBio実行` の進行状態

主 UI から外したもの:

- `全ケース実行`
- `パラメータスイープ`
- `FEBio引き渡し一式`
- `FEBio View`

## 単位

パラメータ欄の単位表記は内部 solver / FEBio 前提に合わせています。

- 幾何・移動量: `um`
- 応力・弾性率: `kPa`
- 粘性: `kPa·s`
- 張力・破壊エネルギー: `N/m`
- ポアソン比・摩擦係数など: 無次元
- `Fhold`, `P_hold`: 現在は内部 proxy 単位

## FEBio 実行フロー

1. UI 値を canonical spec に正規化
2. `buildFebioTemplateData()` で templateData を生成
3. `serializeFebioTemplateToXml()` で `.feb` XML を生成
4. `buildFebioRunBundle()` で export bundle を生成
5. bridge が FEBio CLI を呼ぶ
6. `convert_febio_output.mjs` が result JSON を作る
7. UI が imported physical result を表示する

## CLI からの出力 / 実行

### `.feb` を作る

```powershell
node scripts/export_febio_case.mjs --case A --out-dir febio_exports\A
```

### 既存 `.feb` を実行する

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile febio_exports\A\case_A.feb
```

### 出力から実行までまとめる

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export_and_run_febio_case.ps1 -CaseName A
```

## 追加スクリプト

- `scripts/export_febio_case.mjs`
  - ケース条件から `.feb` と companion input JSON を生成
- `scripts/run_febio_case.ps1`
  - FEBio CLI 実行と postprocess 呼び出し
- `scripts/export_and_run_febio_case.ps1`
  - export と run をまとめて実行
- `scripts/convert_febio_output.mjs`
  - FEBio 出力を app result JSON へ変換
- `scripts/febio_bridge_server.mjs`
  - UI 配信と API を兼ねる localhost bridge
- `scripts/start_febio_bridge.ps1`
  - bridge 起動用ラッパ
- `scripts/febio_scan_case_a.mjs`
  - Case A の FEBio 条件探索

## 実行確認

この環境では次を確認済みです。

- `C:\Program Files\FEBioStudio\bin\febio4.exe` を検出
- bridge 起動後に `http://127.0.0.1:8765/health` が 200
- `http://127.0.0.1:8765/` から UI 配信
- `.feb` 生成
- FEBio CLI 実行
- result JSON 生成と UI 表示

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
- `js/simulation-febio.js`
- `js/simulation-ui.js`
- `scripts/febio_bridge_server.mjs`
- `scripts/start_febio_bridge.ps1`

## ドキュメント

- コード分割と責務: [CODEBASE_STRUCTURE.md](./CODEBASE_STRUCTURE.md)
- パラメータ対応表: [PARAMETER_MAPPING.md](./PARAMETER_MAPPING.md)
- FEBio 出力対応表: [FEBIO_OUTPUT_MAPPING.md](./FEBIO_OUTPUT_MAPPING.md)
- bridge 説明: [FEBIO_UI_BRIDGE.md](./FEBIO_UI_BRIDGE.md)
- FEBio-first 設計メモ: [FEBIO_FRONTEND_ARCHITECTURE.md](./FEBIO_FRONTEND_ARCHITECTURE.md)

## Maintenance Rules

- 構成、実行フロー、UI、export/import、bridge、物理モデルを変更したときは、関連する md ファイルも同じ変更セットで更新します。
- `README.md` と `CODEBASE_STRUCTURE.md` は最低限の更新対象とし、必要に応じて `FEBIO_UI_BRIDGE.md`、`FEBIO_FRONTEND_ARCHITECTURE.md`、対応表も更新します。
- 新しい要素を追加したときは、既存要素と矛盾していないか、古い説明や使われなくなった UI・helper・export/import 経路が残っていないかを確認します。
- 「今の主経路」が何かを、コード、UI、md の 3 つで一致させます。

## テスト

```powershell
node --test tests\febio-front-end.test.mjs
```
