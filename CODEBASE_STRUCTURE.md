# Codebase Structure

## Split Rules
- `simulation.js` は core レイヤーとして残し、共通定数、入力 schema、座標系 helper、軽量 solver、分類ロジックを持つ
- `js/simulation-febio.js` は FEBio 専用に寄せ、粗メッシュ生成、`.feb` XML 生成、JSON export/import、CLI handoff 前提の bridge を持つ
- `js/simulation-ui.js` は描画、再生、比較表示、フォーム初期化、ボタン動作を持つ
- 依存方向は `core -> febio -> ui` に固定する
- 新しい共通 utility は、UI だけで使うのでなければ `simulation.js` 側へ置く
- 新しい FEBio serializer / output parser は `js/simulation-febio.js` へ追加する
- DOM に直接触る関数は `js/simulation-ui.js` に寄せる
- 生成物はリポジトリに入れず、`.gitignore` に追加する

## File Guide

### Browser App
- [simulation.js](/C:/Users/xiogo/projects/nuclear_simu/simulation.js)
  Core。field/schema、パラメータ正規化、Case A/B/C schedule、軽量 JS solver、分類ロジックを置く
- [js/simulation-febio.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-febio.js)
  FEBio bridge。粗メッシュ、surface pair、template data、XML serializer、FEBio import/export を置く
- [js/simulation-ui.js](/C:/Users/xiogo/projects/nuclear_simu/js/simulation-ui.js)
  UI 層。summary/rendering、top view、playback、comparison、button binding、`initialize()` を置く
- [index.html](/C:/Users/xiogo/projects/nuclear_simu/index.html)
  読み込み順の起点。`simulation.js -> js/simulation-febio.js -> js/simulation-ui.js` の順で読む
- [styles.css](/C:/Users/xiogo/projects/nuclear_simu/styles.css)
  画面レイアウトと可視化スタイル

### FEBio / CLI Support
- [scripts/export_febio_case.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/export_febio_case.mjs)
  ケース条件から `.feb` と handoff 一式を出力する
- [scripts/run_febio_case.ps1](/C:/Users/xiogo/projects/nuclear_simu/scripts/run_febio_case.ps1)
  FEBio CLI 実行と postprocess 呼び出しを行う
- [scripts/convert_febio_output.mjs](/C:/Users/xiogo/projects/nuclear_simu/scripts/convert_febio_output.mjs)
  FEBio logfile を app 互換の result JSON へ変換する
- [scripts/export_and_run_febio_case.ps1](/C:/Users/xiogo/projects/nuclear_simu/scripts/export_and_run_febio_case.ps1)
  export と run をまとめて呼ぶ

### Docs
- [README.md](/C:/Users/xiogo/projects/nuclear_simu/README.md)
  使い方の入口
- [FEBIO_HANDOFF.md](/C:/Users/xiogo/projects/nuclear_simu/FEBIO_HANDOFF.md)
  外部 FEBio 環境へ渡すときの手順
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
