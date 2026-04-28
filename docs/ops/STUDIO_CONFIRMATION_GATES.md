# Studio 確認ゲート

## 目的

この文書は、FEBio / FEBio Studio を使う作業で、agent が実装・デバッグ・確認をすべて推測で進めず、Studio で人間が確認した方がよい項目では確認待ちにするための運用ルールです。

現在の主な対象は solver-native load/contact activation、contact geometry、pressure transfer、face-data / reaction output の検証です。

## 基本方針

agent はコード・XML・テスト・ログから機械的に確認できる項目を進める。

ただし、以下のような Studio の可視確認が物理的判断に直結する項目では、agent は推測で修正を重ねず、確認依頼を出してユーザーの観察結果を待つ。

- 接触面が実際に向かい合っているか
- pipette / nucleus / cytoplasm / dish の位置関係が妥当か
- pressure load の矢印方向が期待どおりか
- run 後に displacement、contact pressure、reaction force が非ゼロに見えるか
- contact pair warning が幾何由来か、設定由来か

## agent が自力で進めてよい項目

### XML / export wiring

agent は次を自力で確認・修正してよい。

- active step 内で load / boundary / rigid controller が参照されているか
- load controller id が未参照になっていないか
- Surface / SurfacePair / contact 名が一致しているか
- required ElementSet / Surface / NodeSet が XML に出ているか
- output request が XML に出ているか
- generated XML の snapshot / regex test を追加すること

### FEBioStudio Run 前保存エラー

FEBioStudio で Run を押した直後に次のような dialog が出る場合、FEBio solver の計算失敗ではなく、Studio が `.feb` を保存し直す段階で mesh item reference を壊している可能性が高い。

```text
Failed saving FEBio file:
Invalid reference to mesh item list when exporting:
nodesetNN
```

S7-K では、logfile `<node_data>` に node id を直接列挙していたため、FEBioStudio が内部 `nodesetNN` selection へ変換し、Run 前 save で `nodeset04` 参照を壊した。

対応方針:

- solver-facing XML の `<Mesh>` に、logfile で使う NodeSet を明示的に出す。
- `<node_data>` は node id 直書きではなく `node_set="nucleus_nodes"` のような明示 NodeSet 参照にする。
- FEBioStudio 内で古いタブを使い回さず、regenerated `.feb` を開き直して Run する。
- 再発防止 test では、generated XML に `<NodeSet name="nucleus_nodes">...` と `<node_data ... node_set="nucleus_nodes" />` があることを確認する。

S7-K での実装例:

- `src/febio/native/xml.ts` の `serializeLogfileToXml` は `node_set` 属性を出す。
- `buildFebioMeshView` は `nucleus_nodes` / `cytoplasm_nodes` / `pipette_contact_nodes` を solver-facing `<Mesh>` に残す。
- regenerated `febio_exports/S7_native_baseline/S7-K_S7_native_baseline.feb` は FEBioStudio Run に成功し、post view で `S7-K_S7_native_baseline.xplt` を表示できた。

### mesh / surface の機械的 validation

agent は次を自力で実装・修正してよい。

- required domain が空でないこと
- required surface が空でないこと
- surface facet が存在する node id を参照していること
- SurfacePair が required surface を参照していること
- surface centroid distance / bounding box distance / area ratio の診断値を出すこと
- 明らかに離れた paired surfaces を warning / error にすること

ただし、surface normal の物理的な向きや Studio 上での見た目の妥当性は、必要に応じて Studio 確認ゲートに回す。

### converter / import / provenance

agent は次を自力で確認・修正してよい。

- CSV / log / result の header-based parsing
- rigid body output の列ずれ修正
- face pressure、contact gap、reaction force、displacement の読み取り
- output が missing なのか、存在するが all-zero なのかの区別
- native / proxy / unavailable provenance の明示
- diagnostics JSON の追加

### 最小再現ケース

agent は full model とは別に、最小 force-transfer debug model を追加してよい。

例:

- deformable block
- rigid plate or pipette
- one contact pair
- one pressure or prescribed displacement
- one reaction / contact pressure output

目的は、full model の geometry 問題か、FEBio XML / load / contact syntax 問題かを切り分けること。

## Studio 確認を待つべき項目

以下は agent が推測で進めず、ユーザーに FEBio Studio での確認を依頼する。

### 幾何の見た目

- pipette が nucleus / cytoplasm に接触しているか
- pipette が離れているか、めり込みすぎているか
- cell と dish が接しているか、浮いているか、めり込んでいるか
- nucleus が cytoplasm 内にあるか
- nucleus-cytoplasm interface surface が物理的に近いか

### contact surface の対応

- cell-dish の primary / secondary surface が向かい合っているか
- pipette-nucleus / pipette-cell contact surface が正しい相手を向いているか
- surface normal が明らかに逆向きでないか
- contact search tolerance 内に見えるか

### load / boundary の可視確認

- suction pressure の矢印が表示されるか
- pressure がどの surface にかかっているか
- pressure の向きが吸引方向か、逆向きに押していないか
- rigid / deformable のどちらに load が作用しているように見えるか
- dish fixed boundary が意図どおりか

### run 後の物理応答

- displacement が全体で 0 か
- pipette だけが動いているか、cell / nucleus も動いているか
- contact pressure contour が非ゼロか
- contact gap が変化しているか
- reaction force が出ているか
- Studio 上の warning が log と一致するか

## Studio に読み込ませるファイルパスの提示ルール

Studio 確認を依頼する場合、agent はユーザーが FEBio Studio で開くべきファイルパスを必ず提示する。

提示するパスは、可能な限り repo root からの相対パスで書く。複数候補がある場合は、優先順を明記する。

最低限、次を含める。

- Studio で開く `.feb` ファイル
- 対応する run log
- 変換済み result JSON がある場合はその path
- Studio で見るべき output file / CSV がある場合はその path
- どの case / run directory 由来か

agent は「Studio で確認してください」だけで終わらせない。必ず、どの `.feb` を開き、どの log / output と照合するかを指定する。

パスがまだ生成されていない、または現在の会話から特定できない場合は、推測で書かず、生成コマンドまたは確認すべき expected path を明記する。

例:

```text
Studio確認対象ファイル:

開くFEB:
- generated/febio_exports/S7_active_wiring_run2/run/case_A.feb

照合するlog:
- generated/febio_exports/S7_active_wiring_run2/run/case_A_cli.log

照合するresult:
- generated/febio_exports/S7_active_wiring_run2/run/case_A_result.json

見るべき出力:
- generated/febio_exports/S7_active_wiring_run2/run/febio_pipette_contact.csv
- generated/febio_exports/S7_active_wiring_run2/run/febio_interface_cell_dish.csv

確認対象:
- pipette contact surface
- cell_dish_interface
- suction pressure load direction
- displacement / contact pressure / reaction force
```

## Studio 確認依頼テンプレ

agent は Studio 確認が必要な場合、次の形式で依頼する。

```text
Studio確認依頼:

対象run / feb:
- feb path:
- run directory:
- log path:
- result path:
- case:

見てほしい項目:
1. pipette と cell/nucleus は接触しているか、離れているか、めり込んでいるか
2. cell と dish は接触しているか、離れているか、めり込んでいるか
3. contact surface の primary / secondary は向かい合っているか
4. pressure load の矢印はどの surface に出て、どちら向きか
5. run 後 displacement / contact pressure / reaction force は非ゼロか

報告フォーマット:
- pipette-cell/nucleus:
- cell-dish:
- contact surface の向き:
- pressure load 矢印:
- run後 displacement:
- run後 contact pressure:
- run後 reaction force:
- warning/log:
```

## 判断ルール

- Studio 確認対象を agent が推測で「正しい」とみなして先へ進めない。
- Studio 確認が必要な場合、agent は確認依頼を出し、ユーザーの観察結果を待つ。
- ただし、確認待ちの間でも、agent は独立して進められる XML test、parser test、diagnostics 整備、docs 更新を行ってよい。
- Studio 観察結果を受け取ったら、agent はその結果を `PROGRESS.md` の blocker / 再開位置 / 次の3手に反映する。
- 観察結果がモデルの `implemented / partial / planned` 状態を変える場合は、関連 docs も同じ変更セットで更新する。

## 現在の優先適用範囲

このルールは特に次に適用する。

- `No force acting on the system`
- `No contact pairs found for tied interface`
- face-data contact pressure が all-zero
- pressure load は XML 上 active だが反力が出ない
- contact / pressure / force transfer の原因切り分け

## 重要ミスの再発防止ログ

### FEBio CSV delimiter 誤読

S7-K で、FEBio logfile CSV の `node_data` / `face_data` を parser が誤読した。

原因:

- XML では `<node_data ... delim=",">` / `<face_data ... delim=",">` と指定していた。
- しかし FEBio / FEBioStudio が生成した実ファイルは、少なくとも一部で comma ではなく whitespace 区切りだった。
- 既存 parser は `line.split(",")` だけを使っていたため、`37 -1.86 0 -0.54` のような行全体を 1 列として扱い、変位や contact summary を 0 と誤読した。

対策:

- FEBio logfile CSV reader は comma / whitespace tolerant にする。
- 具体的には `/[,\s]+/` 相当で split し、空 token を捨てる。
- `delim=","` は出力仕様の希望として扱い、実ファイルの検証なしに parser 前提へ固定しない。
- Studio の contour 表示と parser summary が食い違う場合は、まず delimiter / column parsing / leading id column を疑う。

## 関連ファイル

- `AGENT.md`
- `PROGRESS.md`
- `docs/ops/ROADMAP.md`
- `src/febio/mesh/index.ts`
- `src/febio/export/index.ts`
- `scripts/convert_febio_output.mjs`
- `tests/febio-front-end.test.mjs`
