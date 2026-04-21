# Codebase Structure

## Split Rules
- `simulation.js` は core レイヤーとして残し、共通定数、入力 schema、canonical spec、座標系 helper、分類ロジックを持つ
- `js/simulation-febio.js` は FEBio 主経路を持ち、template data、refined mesh、mesh validation、`.feb` XML serializer、bridge 実行導線、FEBio import/export を持つ
- `js/simulation-ui.js` は UI 層で、フォーム初期化、ボタン動作、状態表示、可視化、結果描画を持つ
- `js/simulation-legacy.js` は legacy / debug 用で、主経路からは呼ばない
- 依存方向は `core -> febio -> ui` に固定する
- DOM に直接触る関数は `js/simulation-ui.js` に寄せる
- 生成物はリポジトリに入れず、`.gitignore` に追加する

## Main Runtime Path

推奨実行経路:

1. `scripts/start_febio_bridge.ps1` で bridge を起動
2. `http://127.0.0.1:8765/` から UI を開く
3. UI で canonical spec を作る
4. FEBio bundle / `.feb` を生成
5. bridge が FEBio CLI を実行
6. result JSON を import して physical result を描画

補足:

- `file://index.html` は fallback 扱い
- bridge が動いていれば `index.html` 直開き時も localhost 側へ自動リダイレクトする

## File Guide

### Browser App
- [simulation.js](/C:/Users/xiogo/projects/nuclear_simu/simulation.js)
  Core。field/schema、canonical parameter layer、パラメータ正規化、digest、座標系 helper を置く
- [js/simulation-febio.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-febio.js)
  FEBio bridge。template data、refined mesh、mesh validation、XML serializer、run bundle、FEBio import/export を置く
- [js/simulation-ui.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-ui.js)
  UI 層。フォーム、状態表示、可視化、再生、physical result / awaiting 表示、button binding、`initialize()` を置く
- [js/simulation-legacy.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-legacy.js)
  旧 lightweight / debug 補助。主 UI では使わない
- [index.html](/C:/Users/xiogo/projects/nuclear_simu/index.html)
  読み込み順の起点。`simulation.js -> js/simulation-febio.js -> js/simulation-ui.js` の順で読む
- [styles.css](/C:/Users/xiogo/projects/nuclear_simu/styles.css)
  画面レイアウトと状態表示スタイル

### FEBio / CLI Support
- [scripts/export_febio_case.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/export_febio_case.mjs)
  ケース条件から `.feb` と companion JSON を出力する
- [scripts/run_febio_case.ps1](/C:/Users/xiogo/projects/nuclear_simu/scripts/run_febio_case.ps1)
  FEBio CLI 実行と postprocess 呼び出しを行う
- [scripts/convert_febio_output.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/convert_febio_output.mjs)
  FEBio logfile を app 互換の result JSON へ変換する
- [scripts/export_and_run_febio_case.ps1](/C:/Users/xiogo/projects/nuclear_simu/scripts/export_and_run_febio_case.ps1)
  export と run をまとめて呼ぶ
- [scripts/febio_bridge_server.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/febio_bridge_server.mjs)
  UI 配信と API を兼ねる localhost bridge
- [scripts/start_febio_bridge.ps1](/C:/Users/xiogo/projects/nuclear_simu/scripts/start_febio_bridge.ps1)
  bridge 起動用ラッパ。`-OpenApp` で localhost UI を開ける
- [scripts/febio_scan_case_a.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/febio_scan_case_a.mjs)
  Case A の FEBio 条件探索を自動実行し、順位付き JSON / CSV を出力する

### Docs
- [README.md](/C:/Users/xiogo/projects/nuclear_simu/README.md)
  使い方の入口
- [PARAMETER_MAPPING.md](/C:/Users/xiogo/projects/nuclear_simu/PARAMETER_MAPPING.md)
  UI パラメータと FEBio への対応表
- [FEBIO_OUTPUT_MAPPING.md](/C:/Users/xiogo/projects/nuclear_simu/FEBIO_OUTPUT_MAPPING.md)
  FEBio 出力と app result schema の対応表
- [FEBIO_UI_BRIDGE.md](/C:/Users/xiogo/projects/nuclear_simu/FEBIO_UI_BRIDGE.md)
  bridge の役割と安定した起動経路
- [FEBIO_HANDOFF.md](/C:/Users/xiogo/projects/nuclear_simu/FEBIO_HANDOFF.md)
  外部 FEBio 環境へ渡すときの手順
- [FEBIO_FRONTEND_ARCHITECTURE.md](/C:/Users/xiogo/projects/nuclear_simu/FEBIO_FRONTEND_ARCHITECTURE.md)
  FEBio-first UI / canonical schema / export-import / physical result rendering design note
- [nuclear_isolation_model_spec.md](/C:/Users/xiogo/projects/nuclear_simu/nuclear_isolation_model_spec.md)
  元仕様

## Generated Files
- `febio_exports/`
- `*.xplt`
- `*.log`
- `*_result.json`
- `febio_*.csv`
- `case_*.feb`

これらは再生成可能な出力なので、追跡対象にしない。

## Maintenance Rules
- 構成変更や新要素の追加を行ったときは、関連する md ファイルも同じ変更セットで更新する。
- `README.md` と `CODEBASE_STRUCTURE.md` は最低限更新し、必要に応じて `FEBIO_UI_BRIDGE.md`、`FEBIO_FRONTEND_ARCHITECTURE.md`、対応表も更新する。
- ファイル分割、責務変更、実行フロー変更を行ったときは、少なくとも `CODEBASE_STRUCTURE.md` に現在の分割ルールと各ファイルの役割を反映する。
- 新しい要素、パラメータ、出力、UI、solver 経路を追加したときは、既存要素と矛盾していないかを確認する。
- 変更後は、古い説明、古い export/import 経路、使われなくなった helper、未参照の UI 要素など、不要になったものが残っていないか確認する。
- 主経路と legacy/debug 経路の区別を、コード、UI、md のすべてで一致させる。
- 使われなくなった生成物、暫定ファイル、旧構造の名残は `.gitignore` とコードベースの両方から整理し、現行構成を誤解しない状態を保つ。

## Tests
- [tests/febio-front-end.test.mjs](/C:/Users/xiogo/projects/nuclear_simu/tests/febio-front-end.test.mjs)
  Canonical mapping、digest、XML serialization、mesh validation、UI gate tests
