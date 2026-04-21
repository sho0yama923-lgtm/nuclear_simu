# FEBio UI Bridge

UI から `FEBio実行` を押したときに、

- `.feb` を生成し
- FEBio CLI を実行し
- 結果 JSON を import して
- physical FEBio result を表示する

ためのローカル bridge です。

## 役割

- UI の現在パラメータを受け取る
- `.feb` と companion JSON を統一出力先へ生成する
- FEBio CLI を実行する
- `case_*_result.json` を返す
- UI 本体の静的ファイルも配信する

## 構成

- [scripts/febio_bridge_server.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/febio_bridge_server.mjs)
  ローカル HTTP bridge 本体
- [scripts/start_febio_bridge.ps1](/C:/Users/xiogo/projects/nuclear_simu/scripts/start_febio_bridge.ps1)
  bridge 起動用 PowerShell ラッパ
- [js/simulation-febio.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-febio.js)
  UI から bridge を呼ぶ fetch 導線

## 安定した使い方

推奨:

1. bridge を起動する
2. `http://127.0.0.1:8765/` を開く
3. UI から `FEBio実行` を押す

理由:

- `file://index.html` 直開きより same-origin の方が安定する
- bridge 側で `Cache-Control: no-store` を付けているため、変更後の古い JS キャッシュ問題を減らせる
- UI 配信と API が同じ origin になる

補足:

- `index.html` を直接開いた場合でも、bridge が生きていれば localhost 側へ自動リダイレクトする

## API

bridge は既定で [http://127.0.0.1:8765](http://127.0.0.1:8765) に立ちます。

### `GET /health`
- bridge 稼働状態
- busy 状態
- 最新ケース情報

### `GET /`
- `index.html` を返す
- `js/`, `styles.css`, `simulation.js` なども同じ bridge から配信する

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

## 起動方法

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1 -OpenApp
```

必要なら FEBio 実行ファイルを明示できます。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1 -FebioExe "C:\Program Files\FEBioStudio\bin\febio4.exe" -OpenApp
```

## UI 側の見え方

- 主実行ボタンは `FEBio実行`
- `bridge: ready` なら接続済み
- 実行中は `FEBio実行` 右横の状態欄に進行状態が出る

## 注意点

- browser 単体では CLI を起動できないので、この bridge が必要
- bridge が落ちていると `FEBio実行` は `fail to fetch` になる
- 変更後は `http://127.0.0.1:8765/` から開くと不安定さが出にくい
