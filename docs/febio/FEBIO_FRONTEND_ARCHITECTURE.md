# FEBio フロントエンド構成

## UI の役割
- UI は parameter input、validation、export、bridge 実行補助、import、rendering のみを担う
- 主表示は imported physical FEBio result のみ
- physical result が無いときは `export ready / awaiting FEBio result`
- 推奨実行経路は `http://127.0.0.1:8765/` の same-origin UI

## 正規パラメータスキーマ
- 定義は `../../src/model/schema.ts`
- compatibility caller は `../../simulation.js` と `../../js/simulation-febio.js`
- 各パラメータは canonical spec に正規化され、次を持つ
  - `uiKey`
  - `internalKey`
  - `category`
  - `unit`
  - `defaultValue`
  - `min`
  - `max`
  - `required`
  - `validation`
  - `febioPath`
  - `transformIn`
  - `transformOut`
  - `description`
- `parameterDigest` は canonical FEBio-facing input から生成する

## FEBio export / import の流れ
1. UI values
2. `buildSimulationInput()` canonical spec
3. `buildFebioTemplateData()`
4. `serializeFebioTemplateToXml()`
5. `buildFebioRunBundle()`
6. bridge / FEBio CLI execution
7. `convert_febio_output.mjs`
8. imported normalized physical result rendering

## 結果描画の流れ
- main result 採用条件は `isPhysicalFebioResult === true`
- `parameterDigest` mismatch の結果は main result に採用しない
- solver source 文字列は provenance 表示用であり、main result 採用判定の基準にはしない
- Provenance 表示:
  - solver source
  - parameter digest
  - export time
  - import time
  - result provenance

## 実行時 / bridge 方針
- bridge は API だけでなく UI の静的ファイルも配信する
- 推奨起動:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1 -OpenApp
```

- `file://index.html` は fallback 扱い
- bridge が生きていれば localhost UI へ自動リダイレクトする

## メッシュ方針
- refined mesh builder が主 export path
- coarse mesh builder は fallback / legacy 参照
- Validation report には少なくとも次を含める
  - invalid element
  - zero or negative volume proxy
  - duplicated nodes
  - disconnected regions
  - aspect ratio warnings
  - overlapping interface nodes across independent bodies

## 追加済みテスト
- UI input -> canonical spec mapping
- canonical spec -> FEBio template mapping
- template -> XML serialization consistency
- digest consistency
- export/import digest match
- mesh validation report
- UI gate for non-physical result rejection
- awaiting result display
- default flow excludes legacy lightweight path

Run:

```powershell
node --test tests\febio-front-end.test.mjs
```

## 未完了の物理モデル領域
- full viscoelastic calibration
- shell membrane / cortex element model
- true cohesive traction-separation as solver-primary interface
- further local mesh refinement and adaptive meshing
- direct `.xplt` parsing without intermediate JSON conversion

## 文書更新ルール
- UI、bridge、export/import、physical model、main flow を変更したときは、関連する md も同じ変更セットで更新する
- 少なくとも `README.md`、`docs/CODEBASE_STRUCTURE.md`、`PROGRESS.md` は更新対象とし、必要に応じて bridge / architecture / mapping docs も更新する
