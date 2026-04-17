# FEBio UI Bridge

ブラウザ UI から `FEBio Run` / `FEBio View` を押して実行するためのローカル bridge です。

## 役割

- UI の現在パラメータを受け取る
- `.feb` と companion JSON を統一出力先へ生成する
- FEBio CLI を実行する
- `case_*_result.json` を返す
- `FEBio View` 用に最新結果を同じ場所から読み戻す

## 構成

- [scripts/febio_bridge_server.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/febio_bridge_server.mjs)
  ローカル HTTP bridge 本体
- [scripts/start_febio_bridge.ps1](/C:/Users/xiogo/projects/nuclear_simu/scripts/start_febio_bridge.ps1)
  bridge 起動用 PowerShell ラッパ
- [js/simulation-febio.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-febio.js)
  UI から bridge を呼ぶ `FEBio Run` / `FEBio View` の fetch 導線

## API

bridge は既定で `http://127.0.0.1:8765` に立ちます。

### `GET /health`
- bridge 稼働状態
- busy 状態
- 最新ケース情報

### `POST /run`
入力:
```json
{
  "caseName": "A",
  "params": {
    "...": "current ui params"
  }
}
```

処理:
1. `febio_exports/ui_bridge/case_A/` を作り直す
2. `export_febio_case.mjs` で `.feb` と input JSON を生成
3. `run_febio_case.ps1` で FEBio を実行
4. `convert_febio_output.mjs` で result JSON を生成
5. 生成済み JSON を UI に返す

### `GET /latest?caseName=A`
- 統一出力先の最新 `case_A_result.json` を返す

## 統一出力先

出力先は固定で:

- `febio_exports/ui_bridge/case_A/`
- `febio_exports/ui_bridge/case_B/`
- `febio_exports/ui_bridge/case_C/`

各ケースの下に:

- `case_A.feb`
- `febio_case_A_input.json`
- `run/case_A_result.json`
- `run/febio_*.csv`
- `run/case_A_cli.log`

がまとまります。

## UI 側の使い方

1. bridge を起動する
2. ブラウザでアプリを開く
3. `FEBio Run` を押す
4. 実行済み結果だけ見たいときは `FEBio View` を押す

`bridge: ready` と出ていれば UI から実行できます。

## 起動方法

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1
```

必要なら FEBio 実行ファイルを明示できます。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1 -FebioExe "C:\Program Files\FEBioStudio\bin\febio4.exe"
```

## 注意点

- UI から直接 OS コマンドを叩いているのではなく、localhost bridge を経由しています。
- browser 単体では CLI を起動できないので、この bridge が必要です。
- `FEBio View` は最新の保存済み結果を読むだけで、再計算はしません。
