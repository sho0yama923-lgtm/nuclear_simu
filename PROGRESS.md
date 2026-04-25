# FEBio 精度改善の現在地

最終更新: 2026-04-25

## 現在の状況

- 現在の目標: FEBio solver に渡す simulation condition を物理的に成立させ、核が細胞質から脱落する条件を solver-active に評価できる状態へ進める。
- solver-native load/contact activation と pressure/contact load は S7-B/S7-C で成立範囲を切り分けた。S7-C では pipette default を cell right edge から nucleus right capture surface へ戻し、cyto 吸引ではなく nucleus-side suction を確認した。
- 当面の physics validation は UI parameter path ではなく FEBio-native spec / CLI backend path を主経路にする。
- UI parameter -> canonical spec -> FEBio 変換は compatibility / preset generation 用に残すが、標準実行入口と物理検証の主経路にはしない。
- 最終的な UI は FEBio-native spec を編集する presentation layer として統合する。
- UI parameter -> canonical spec -> FEBio 変換系は、FEBio-native spec / CLI backend path が安定するまでは compatibility / preset generation 用に維持する。
- FEBio-native spec への移行が完了したら、旧 UI parameter conversion files は active path から外し、legacy 扱いにする。
- legacy 化した変換系ファイルは physics source of truth として扱わず、必要な場合のみ preset migration / backwards compatibility 用に限定する。
- FEBio-native spec / CLI backend path が安定した後、旧 UI parameter path / canonical conversion / browser bridge を説明する docs は active guidance から外し、legacy / compatibility docs として扱う。
- legacy / compatibility docs は `legacy/docs/febio/` へ移動済み。historical export artifacts は `legacy/febio_exports/` に退避済み。
- これらの docs は移行完了までは旧経路の照合・互換維持に使うが、新しい FEBio solver parameter や direct validation の source of truth にはしない。
- 現在の標準 `runSimulation` は FEBio-native spec を入力として扱う。旧 UI 入力 -> canonical spec -> FEBio export path は `runCanonicalSimulation` などの明示 compatibility path として残す。
- S7-C の direct run では `legacy/febio_exports/S7_native_migration_check/S7_direct_force_transfer.feb` が read success / normal termination。final pipette-side contact pressure は `0.734967195035`、rigid reaction は final `Fx=12.6000069265`、converter の aspiration length は `5.09470348295 um`。
- S7-D で `febio_cases/native/*.native.json` を source of truth とする native-only FEBio export path を追加した。`.feb` / effective native spec / native model / manifest / README を生成し、旧 UI/canonical/legacy adapter を通らないことを regression test で確認している。
- 今後の FEBio export work では今回作った native-only 経路以外を legacy / compatibility freeze として扱い、新しい solver behavior では触らない。詳細は `docs/febio/FEBIO_PATH_OWNERSHIP.md` に固定した。
- 現在の主要ファイル一覧は `ACTIVE_FILES.md` にまとめた。
- S7-E で coordinate / surface normal / pressure sign / contact pair convention を `docs/febio/GEOMETRY_CONVENTIONS.md` に固定し、active native validator に normal / alignment diagnostics を追加した。Studio/CLI 確認では `pipette_suction_surface` が deformable 側、normal `-x`、negative pressure が `+x` pipette/barrel 側へ作用する想定と整合したため、この milestone は completed とする。
- 現在の最優先: S7-F でモデル高度化の方針を native-only 経路上に限定して詰める。具体的には refined native mesh、cell-dish solver-active 化、nucleus-cytoplasm coupling、pipette-cell contact の役割分担、warning-free CLI run の維持条件を整理する。
- load/contact/output 成立後に cohesive / detachment solver validation を進める方針は維持し、native-only export 経路をその確認入口にする。
- 次の model refinement は S7-F で設計方針と安全な切り分けを定め、S7-G 以降で実装・検証を進める。
- 全体ロードマップ: [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md)
- FEBio-native spec 方針: [docs/febio/FEBIO_NATIVE_SPEC.md](docs/febio/FEBIO_NATIVE_SPEC.md)

## 再開位置

- 最後に完了した節目: Milestone S7-E completed。coordinate / normal / pressure sign / contact-pair convention を規定し、`pipette_suction_surface` の向きと pressure direction が想定と一致することを Studio/CLI/validator で確認した。
- 現在の未完了項目: モデル詳細の高度化。cell-dish solver-active 化、debug mesh から refined native mesh への移行、nucleus-cytoplasm coupling の物理化、pipette-cell / pipette-nucleus contact の役割整理は S7-F 以降に残す。
- S7-A で生成済みの direct handoff:
  - `legacy/febio_exports/S7_direct_entry/S7_direct_force_transfer.feb`
  - `legacy/febio_exports/S7_direct_entry/febio_S7_direct_force_transfer_native_spec.json`
  - `legacy/febio_exports/S7_direct_entry/febio_S7_direct_force_transfer_manifest.json`
- S7-B で確認済みの direct run:
  - `legacy/febio_exports/S7_direct_suction_surface/S7_direct_force_transfer.feb`
  - `legacy/febio_exports/S7_direct_suction_surface/S7_direct_force_transfer.log`
  - `legacy/febio_exports/S7_direct_suction_surface/S7_direct_force_transfer_result.json`
  - `legacy/febio_exports/S7_direct_suction_surface/febio_pipette_cell_contact.csv`
- S7-C で確認済みの native migration check:
  - `legacy/febio_exports/S7_native_migration_check/S7_direct_force_transfer.feb`
  - `legacy/febio_exports/S7_native_migration_check/S7_direct_force_transfer.log`
  - `legacy/febio_exports/S7_native_migration_check/S7_direct_force_transfer_result.json`
  - `legacy/febio_exports/S7_native_migration_check/febio_S7_direct_force_transfer_native_spec.json`
- S7-D で生成確認済みの native-only baseline:
  - `febio_exports/S7_native_baseline/S7_native_baseline.feb`
  - `febio_exports/S7_native_baseline/S7_native_baseline_effective_native_spec.json`
  - `febio_exports/S7_native_baseline/S7_native_baseline_native_model.json`
  - `febio_exports/S7_native_baseline/S7_native_baseline_manifest.json`
- 次に開くファイル:
  - `febio_exports/S7_native_baseline/S7_native_baseline.feb`
  - `febio_exports/S7_native_baseline/jobs/S7_native_baseline.feb`
  - `febio_exports/S7_native_baseline/jobs/S7_native_baseline.log`
  - `febio_exports/S7_native_baseline/S7_native_baseline_native_model.json`
  - `febio_exports/S7_native_baseline/S7_native_baseline_manifest.json`
  - `src/febio/native/mesh.ts`
  - `src/febio/native/interfaces.ts`
  - `src/febio/native/model.ts`
  - `src/febio/native/xml.ts`
  - `docs/febio/GEOMETRY_CONVENTIONS.md`
  - `docs/ops/STUDIO_CONFIRMATION_GATES.md`
- 次ステップの完了条件: S7-F のモデル高度化方針を、native-only active path の範囲、確認順序、warning-free run を壊さない rollback point、次に実装する最小単位まで具体化する。

## ROADMAP.md との使い分け

- 大方針、stage 計画、current stage、review gates、later / deferred、補助ロードマップの位置づけは [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md) に置く。
- 実際の作業 milestone、細かい修正内容、target files、done condition、blocker、再開位置は `PROGRESS.md` に置く。
- `PROGRESS.md` の milestone が進んだだけなら `ROADMAP.md` は更新しない。
- `ROADMAP.md` の stage 方針が変わった場合は、`PROGRESS.md` の現在位置と次の milestone も同じ変更セットで合わせる。
- このファイルには「次に何を開いて、何が終われば進んだと言えるか」を置く。`ROADMAP.md` には「その作業がどの大きな方針 / stage に属するか」を置く。

## 優先順位の見方

- 全体優先順位: 研究・物理モデル全体の順序。頻繁には変えない。詳しくは [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md) に置く。
- 主ロードマップ: 現在の大きな作業列。いまは simulation condition advancement。
- 補助ロードマップ: 主ロードマップを支える移行作業。旧「第2優先ロードマップ」は compatibility retirement の補助ロードマップで、Stage S6 completed / Stage 6 completed 済み。主ロードマップの次に自動で戻るものではない。
- 次の bounded milestone: いまのセッションで進めるレビュー可能な成果単位。細かい bullet は作業ガイドであり、単独の停止点ではない。作業が進んで milestone / done condition / blocker が変わるたびにこのファイルで更新する。

## 作業粒度ルール

`PROGRESS.md` には細かい作業 bullet を書いてよいが、agent は各 bullet を単独の終了単位として扱わない。

同じ milestone に属する隣接作業は、レビュー可能な境界までまとめて進める。

agent は次のいずれかに到達するまで進める。

- Done condition を満たした
- 明確な blocker が出た
- FEBio Studio など人間確認が必要な confirmation gate に到達した
- 実行環境や外部ツール不足でそれ以上進められない

逆に、次の状態では原則として止まらない。

- 空ファイルだけ作った
- TODO だけ追加した
- helper だけ追加した
- docs だけ更新したが、同じ milestone の実装 / test が明らかに残っている

## 次の bounded milestone

### Milestone S7-F: Native Model Refinement Strategy

状態: active。

この milestone の目的は、S7-E で固定した向きの規約を前提に、native-only 経路上でモデルを高度化する順序と安全な確認境界を決めること。ここでは旧 UI / canonical / template compatibility path は触らない。

#### 方針

モデル高度化は、一度に全 contact / material / mesh を変えず、warning-free baseline を rollback point として段階的に進める。

```text
S7-E warning-free orientation baseline
-> refined native mesh design
-> cell-dish contact reactivation
-> nucleus-cytoplasm coupling refinement
-> pipette-cell / pipette-nucleus role separation
-> cohesive / detachment validation
```

#### 切り分け対象

- refined native mesh:
  - 現 debug mesh は向き確認用として維持する。
  - cell-dish solver-active contact を戻す前に、cell bottom / dish top の共有 geometry、gap、厚み、element aspect ratio を改善する。
  - cell-dish の normal は `cell_dish_surface = -z`、`dish_contact_surface = +z` を維持する。
- cell-dish:
  - 現状は surface diagnostics / output only。
  - solver-active 化は refined mesh で negative jacobian が出ないことを確認してから行う。
  - tied contact / sliding / adhesive proxy のどれを使うかは、mesh 安定後に比較する。
- nucleus-cytoplasm:
  - 現状の sticky approximation は warning-free baseline の安定化要素として扱う。
  - true cohesive / traction-separation は、contact pair と face-data output が安定してから入れる。
  - augmentation / penalty / snap tolerance は、警告ゼロと反力・contact pressure の非ゼロ性を見ながら段階的に戻す。
- pipette-cell / pipette-nucleus:
  - pressure-driven suction の確認対象は `pipette_suction_surface` / `pipette_cell_pair`。
  - `pipette_nucleus_contact` は現 coarse mesh の capture-hold stabilizer として残すが、物理的な吸引面とは区別する。
  - refined mesh 後に stabilizer を弱める、または contact role を再設計する。
- output validation:
  - warning-free CLI run を維持する。
  - `febio_pipette_cell_contact.csv`、`febio_rigid_pipette.csv`、nucleus/cytoplasm displacement の非ゼロ性を次の確認指標にする。
  - result converter / classification は S7-F では主対象にしない。

#### Done condition

- pending: refined native mesh の最小設計案を `PROGRESS.md` または dedicated doc に固定する。
- pending: cell-dish solver-active 化の前提条件と失敗時 rollback point を書く。
- pending: nucleus-cytoplasm / pipette-cell / pipette-nucleus の役割分担を active native model 上で明文化する。
- pending: 次に実装する最小変更単位を 1 つ選ぶ。

### Milestone S7-E: Coordinate / Surface / Pressure Convention Diagnostics

状態: completed。

この milestone の目的は、native-only FEBio export path の座標・法線・pressure・contact pair convention を明文化し、mesh validation の中で向きと alignment を可視化できるようにすること。

#### 規約

```text
x: aspiration / manipulation axis
+x: cell center -> pipette / barrel side
-x: pipette mouth -> cell interior
y: section thickness / out-of-plane axis
z: dish-to-apical vertical axis
+z: away from dish / apical
-z: toward dish / basal
```

`pipette_suction_surface` は deformable 側 capture surface、`pipette_contact_surface` は rigid pipette mouth surface とする。現在の `pipette_suction_surface` normal は `-x` で、negative pressure は `+x`、つまり pipette / barrel 側へ引く意図として扱う。

#### Done condition

- done: `docs/febio/GEOMETRY_CONVENTIONS.md` に x/y/z、+/- axis、FEBio quad winding、negative pressure、suction surface ownership、primary/secondary convention を記録した。
- done: `src/febio/native/mesh.ts` の `validateNativeMesh()` が `coordinateConvention`、`surfaceNormalDiagnostics`、`contactPairDiagnostics`、`pressureDiagnostics`、`conventionWarnings` を返す。
- done: `pipette_suction_surface` が deformable 側で normal `-x`、`pipette_contact_surface` が rigid mouth 側で normal `+x` であることを test で確認した。
- done: `pipette_cell` と local nucleus-cytoplasm pairs は opposed alignment として診断される。
- done: `cell_dish_surface` / local cell-dish surfaces は native-only mesh overlay で `-z` winding に直し、dish `+z` と opposed alignment になる。
- done: `pipette_nucleus_contact` は lift step の negative-jacobian 回避に必要な capture-hold stabilizer として solver-active に残す。pressure-driven inspection target は引き続き `pipette_cell_contact` on `pipette_cell_pair`。
- done: `nucleus_cytoplasm_interface` は coarse debug mesh で zero-force augmentation warning を出すため、native-only XML では non-augmented sticky として出力する。
- done: corrected cell-dish tied contact は lift 中に negative jacobian を起こすため、現 debug mesh では `cell_dish_interface` を solver-active から外し、surface diagnostics/output only とする。
- done: hold / final plateau の余分な static substep を圧縮し、lift controller を lift step 内で ramp するよう修正した。
- done: regenerated CLI run は normal termination。`WARNING` / `No force acting on the system` / `ERROR` は 0 件。
- done: Studio で `pipette_suction_surface` が pressure load target であり、deformable 側に表示されることを確認した。座標・法線・pressure sign の一致確認をもって S7-E は completed。
- deferred-to-S7-F: cell-dish solver-active 化、nucleus-cytoplasm coupling、pipette contact role の詳細設計。

### Milestone S7-D: Native-only FEBio pipeline simplification

状態: completed。

この milestone の目的は、旧 UI parameter / canonical conversion / template adapter に依存しない、FEBio-native 条件記述を source of truth とする単純な主経路を確立すること。

S7-A/B/C で native spec から `.feb` を生成し、FEBio CLI normal termination、pressure/contact response、rigid reaction、converter digest preservation までは確認済み。ただし現経路はまだ `toLegacyTemplateShape()` や既存 template/export 経路を経由しており、native-first の主経路としては複雑である。

S7-D では、旧 UI 系換算を主経路から完全に外し、次の一本化された経路を作る。

```text
FEBio-native 条件記述
-> native model 展開
-> FEBio XML / .feb 生成
-> FEBio CLI 実行準備
-> run artifacts / result artifacts の出力先提示
```

#### 新しい主経路

```text
febio_cases/native/*.native.json
  -> scripts/export_febio_native_case.mjs
  -> src/febio/native/caseSpec.ts
  -> src/febio/native/model.ts
  -> src/febio/native/xml.ts
  -> febio_exports/<case>/<case>.feb
```

必要に応じて以下を分割する。

```text
src/febio/native/mesh.ts
src/febio/native/surfaces.ts
src/febio/native/interfaces.ts
src/febio/native/outputs.ts
src/febio/native/exportCase.ts
src/febio/native/index.ts
```

#### 必須ルール

- 条件値は `febio_cases/native/*.native.json` に置く。
- `model builder` 側に実験条件値を持たせない。
- `model builder` は native case spec を `mesh / surfaces / contacts / loads / boundary / outputs` に展開するだけにする。
- XML writer は native model object を FEBio XML に書くだけにする。
- `.feb` 出力までの主経路では、UI/canonical/result/classification を呼ばない。
- preset / UI / convenience input は、将来的に使う場合でも effective native case spec へ明示変換してから `.feb` に進む。
- `.feb` 出力時には必ず effective native spec と native model JSON を保存する。
- 既存の S7-A/B/C direct path は移行経路として残すが、今後の physics validation 主経路にはしない。

#### 新経路で使わないもの

S7-D の native-only export path では、以下を import / call しない。

```text
toLegacyTemplateShape
buildSimulationInput
buildFebioInputSpec
buildFebioNativeRunBundle
runSimulation
src/public-api.ts
generated/dist fallback
normalizeFebioResult
classification
UI/canonical bridge
```

#### 移植元

既存コードは捨てず、以下から必要部分だけ移す。

```text
src/febio/spec/nativeSpec.ts
  - normalize / validate / digest helper を再利用
  - physical default は case JSON へ移す
  - toLegacyTemplateShape は新経路では使わない

src/febio/spec/index.ts
  - material builder / output builder / model assembly の考え方を再利用
  - templateData / runBundle 前提は新経路へ持ち込まない

src/febio/mesh/index.ts
  - mesh / surface / nodeSet / surfacePair / validation ロジックを再利用
  - input は legacy-shaped geometry ではなく native case spec から直接読む

src/febio/interfaces/nucleusCytoplasm.ts
  - sticky nucleus-cytoplasm interface construction / validation の考え方を再利用
  - true cohesive 実装はこの milestone では行わない

src/febio/export/index.ts
  - XML writing helper / serializer pattern を再利用
  - canonical input assembly は移さない

scripts/export_febio_direct_case.mjs
  - CLI args / file output / manifest / README pattern を再利用
  - generated/dist fallback は新経路に持ち込まない

tests/febio-front-end.test.mjs
  - direct path regression の考え方を再利用
  - native pipeline 専用 test へ分離する
```

#### 新規 / 更新対象

```text
febio_cases/native/S7_baseline.native.json
src/febio/native/caseSpec.ts
src/febio/native/model.ts
src/febio/native/xml.ts
src/febio/native/exportCase.ts
src/febio/native/index.ts
scripts/export_febio_native_case.mjs
tests/febio-native-pipeline.test.mjs
PROGRESS.md
```

必要に応じて追加。

```text
src/febio/native/mesh.ts
src/febio/native/surfaces.ts
src/febio/native/interfaces.ts
src/febio/native/outputs.ts
```

#### 出力 artifacts

`export_febio_native_case.mjs` は、少なくとも以下を出力する。

```text
<case>.feb
<case>_effective_native_spec.json
<case>_native_model.json
<case>_manifest.json
<case>_README.txt
```

manifest には以下を含める。

```text
- generated .feb path
- effective native spec path
- native model JSON path
- expected log path
- expected xplt path
- expected CSV output paths
- expected result JSON path
- FEBio CLI 実行コマンド
- Studio 確認対象 path
```

#### Done condition

- done: `febio_cases/native/S7_baseline.native.json` が source of truth として追加されている。
- done: `node scripts/export_febio_native_case.mjs --case febio_cases/native/S7_baseline.native.json --out-dir febio_exports/S7_native_baseline` で `.feb` が生成できる。
- done: generated `.feb` に material / mesh / surface / surfacePair / contact / pressure load / boundary / output が入る。
- done: effective native spec JSON が保存される。
- done: native model JSON が保存される。
- done: manifest に FEBio CLI 実行コマンドと expected artifacts が出る。
- done: 新経路が `toLegacyTemplateShape`, `buildSimulationInput`, `buildFebioInputSpec`, `runSimulation`, `src/public-api.ts`, `generated/dist` を使わないことを regression test で確認する。
- done: 条件値は case JSON に置き、model builder / XML writer は model 展開と serialization に限定した。
- done: 既存 S7-A/B/C direct path は残っているが、新しい主経路は native-only pipeline として明示されている。
- done: `PROGRESS.md` が S7-D の現在位置、done condition、残 blocker を反映している。
- resolved/deferred: FEBio CLI / Studio の向き確認と surface orientation convention は S7-E で completed。cell-dish は no-pair 警告ではなく、refined mesh 後の solver-active 化として S7-F/S7-G に送る。

#### S7-D ではやらないこと

```text
- refined mesh の大規模実装
- cell-dish solver-active contact の本修正
- surface orientation convention の全面改修
- true cohesive law
- UI 統合
- 旧 canonical path の削除
- classification cleanup
- detachment event cleanup
```

これらは native-only 主経路が成立した後の milestone に送る。

#### S7-D 完了後の次段階

```text
S7-E:
  coordinate / surface normal / pressure sign / contact pair convention の厳密化

S7-F:
  native model refinement strategy and refined mesh design

S7-G:
  refined mesh implementation / cell-dish solver-active validation

S7-H:
  UI を native case spec editor として接続
```

### Milestone S7-A: FEBio-native direct parameter path の入口を作る

状態: completed。

この milestone の目的は、UI parameter -> canonical spec 変換を通らず、FEBio-native spec JSON から `.feb` 生成へ到達できる最初の reviewable path を作ること。

#### Done condition

- done: `src/febio/spec/index.ts` に FEBio-native spec の normalize / validate / direct template mapping を追加した。
- done: `scripts/export_febio_direct_case.mjs` で UI parameter -> canonical spec 変換を通らず `.feb` / native spec JSON / manifest / README を生成できる。
- done: generated XML に material / contact / pressure / boundary / output が direct spec 由来で入る。
- done: Studio 確認で pipette が見えない問題に対し、pipette contact face を口元の `pipetteLeft / pipetteContactX` に置き、solid は外側 +x へ伸びるよう mesh を修正した。
- done: Studio 確認で核が見えない問題に対し、cytoplasm を単一の不透明 hex から nucleus 周囲の 4 要素 ring に変更し、核が外部から見える cavity を作った。再生成後の FEBio CLI run は normal termination。
- done: `tests/febio-front-end.test.mjs` に direct path regression test を追加し、direct export script が `buildSimulationInput` / `buildFebioInputSpec` / `public-api.ts` を読まないことを確認する。
- done: `src/public-api.ts` の標準 `runSimulation` を FEBio-native spec first に切り替え、旧 canonical flow は `runCanonicalSimulation` として明示 compatibility path に退避した。
- done: Studio 確認対象として `legacy/febio_exports/S7_direct_entry/S7_direct_force_transfer.feb` と manifest 内の expected log / result / output CSV path を生成した。
- done: force-transfer / contact response は direct path で partial 成立。pressure target を剛体 `pipette_contact_surface` から変形体側 `pipette_suction_surface` へ移し、surface orientation を `[34,38,39,35]` に修正した。FEBio CLI は normal termination、`pipette_cell_contact_surface` は final contact pressure `1.40000000005`、rigid reaction は final `Fx=47.6006741033`。

### Milestone S7-B: direct handoff の FEBio / Studio 確認

状態: completed。

この milestone の目的は、S7-A の direct `.feb` を実際の FEBio / FEBio Studio 確認に渡し、direct path が read / run / output でどこまで成立するかを判定すること。

#### Done condition

- done: FEBio CLI で `legacy/febio_exports/S7_direct_suction_surface/S7_direct_force_transfer.feb` が read success / normal termination。
- done: active step pressure は `pipette_suction_surface` に載り、`No force acting on the system` は解消した。
- done: `pipette_cell_pair` は primary=`pipette_suction_surface` / secondary=`pipette_contact_surface`。`febio_pipette_cell_contact.csv` は final `gap=2.38313723902`, `contact pressure=1.40000000005`。
- done: rigid body output は final `Fx=47.6006741033`、peak contact/hold force は converter 上 `47.7970986656`。
- done: converter は native direct input の `fdig_07cf952d` を保持し、`digestMatch=true`、`isPhysicalFebioResult=true`、aspiration length `1.595775613543774 um` の result JSON を生成した。
- residual: `cell_dish_interface` は no-pair warning が残る。次 milestone で cell-dish geometry/contact pair を直す。

### Milestone S7-C: native geometry migration check と確認用 FEB 再生成

状態: completed。

この milestone の目的は、UI 時代に見えていた位置関係が native default で崩れていないかを確認し、ピペットが cell right edge の cytoplasm を吸う暫定状態から、nucleus-side suction の確認用 `.feb` へ戻すこと。

#### Done condition

- done: `DEFAULT_NATIVE_SPEC.geometry.pipette` を `puncture: {x: 4.5, z: 8.5}` と `tip: {x: 14, z: 8.5}` に分離した。旧 UI の `xp` 相当は native の実行接触位置に混ぜず、穿刺 metadata として残す。
- done: native mesh mode を `s7-debug-local-nucleus` として明示し、現 mesh が refined ではなく粗い debug mesh であることを spec / template に出すようにした。
- done: `pipette_suction_surface` を cell right cytoplasm face から nucleus right-side capture face へ移した。FEBio pressure solve で negative jacobian を起こさない向きは `[10,14,15,11]`。
- done: Studio warning に出ていた nucleus / cytoplasm interface の facet winding を修正した。CLI read では surface winding warning は再発していない。
- done: 確認用 FEB bundle を `legacy/febio_exports/S7_native_migration_check/` に移動した。
- done: FEBio 4.12 CLI で `Reading file ...SUCCESS!` と `N O R M A L   T E R M I N A T I O N` を確認した。
- done: converter で `S7_direct_force_transfer_result.json` を生成し、`isPhysicalFebioResult=true`、aspiration length `5.09470348295 um`、final rigid `Fx=12.6000069265` を確認した。
- residual: `cell_dish_interface` no-pair warning は残る。後半 step で `No force acting on the system` warning が出るため、full force-transfer 解釈はまだ debug-run 限定。

## 未解決問題 / Blockers

| 問題 | 影響 | 暫定対応 | 意図する修正 | 優先度 |
|---|---|---|---|---|
| native direct path がまだ legacy adapter を経由している | S7-A/B/C の旧 direct path は残るが、主検証経路にはしない | S7-D の native-only path を主経路に固定済み | 旧 direct path は legacy / compatibility reference としてだけ読む | low |
| UI parameter conversion が solver validation を複雑化している | UI convenience parameter -> canonical spec -> FEBio template -> XML の変換を毎回通すと、force-transfer 問題が UI mapping 由来か FEBio model 由来か切り分けにくい | 標準 `runSimulation` は FEBio-native spec first に変更済み。UI parameter path は compatibility / preset generation 用に残す | 残る scripts / browser bridge の旧経路を順次 legacy 扱いへ寄せ、contact / pressure / force transfer は direct spec path だけで検証する | high |
| 旧 UI/canonical docs が active guidance と混在している | agent が旧 UI parameter mapping / browser bridge / handoff docs を current FEBio-native source of truth と誤認するリスクがあった | `legacy/docs/febio/` へ移動済み。新しい solver parameter の根拠にはしない | 必要な場合のみ historical reference / compatibility maintenance として読む | low |
| cell-dish solver-active contact が未復帰 | S7-E で surface orientation は `cell_dish=-z` / `dish=+z` に揃ったが、現 coarse debug mesh で tied contact を有効化すると lift 中に negative jacobian が出る | 現 baseline では cell-dish を surface diagnostics / output only とし、warning-free CLI run を維持する | S7-F/S7-G で refined native mesh を設計し、cell-dish solver-active contact を段階的に戻す | high |
| native mesh が粗い debug mesh のまま | Studio 上で blocky に見え、旧 UI 時代の見た目・局所吸引・接触面の期待とずれる | `meshMode=s7-debug-local-nucleus` として明示し、確認用 FEB は debug-run 限定で扱う | native-only pipeline 成立後、nucleus/cytoplasm/pipette 周りの refined native mesh を実装し、local suction aperture と cell-dish 接触を同時に成立させる | high |
| rigid body output parsing は列ずれしやすい | FEBio rigid body CSV は `id,x,y,z,Fx,Fy,Fz` の形で出るため、id 列を除いた後も z と Fx/Fz の index を誤ると force を誤読する | `scripts/convert_febio_output.mjs` で z=`values[2]`、Fx=`values[3]`、Fz=`values[5]` として修正済み | 今後 force validation test では face pressure と rigid reaction を分けて見る | medium |
| native interface output は real-run validation が必要 | interface traction / damage の output contract はあるが、実 run payload での coverage がまだ確定していない | converter/import で native/proxy/unavailable provenance を明示する | active load/contact 成立後に declared output path を real solver output で検証する | high |
| sticky cohesive は true traction-separation law ではない | mesh / load / output が未確立のまま validation すると物理解釈がぶれる | effective coupling proxy として扱い、validation scope を広げすぎない | load/contact/output 成立後に sticky approximation の安定性と interface geometry を実 FEBio run で検証する | high |
| explicit detachment event が全 result payload で native ではない | solver event ではなく導出 event を先に整え続けるリスクがある | import と compatibility path で explicit detachment derivation を維持する | real solver output が出た後に native event 化の優先度を再評価する | medium |
| bridge diagnostics が粗い | FEBio 実行失敗や payload 変換失敗の切り分けに時間がかかる | manifest、bridge 出力、import 側チェックで追う | solver-condition work を妨げる場合に限って bridge-side diagnostics を強化する | medium |

## 実装状態

| 項目 | 状態 | 現在の挙動 | 既知の制約 | 次の手 |
|---|---|---|---|---|
| FEBio-native spec path | implemented / native-only-main-path | `febio_cases/native/*.native.json` -> `src/febio/native/` -> `.feb` の主経路がある。S7-E baseline は warning-free CLI run と orientation confirmation まで成立 | 旧 `src/febio/spec/` direct path は compatibility / historical reference。モデル物理の source of truth にはしない | S7-F で native-only path 上の model refinement 方針を固定する |
| Canonical parameter schema | implemented / explicit-compatibility | source of truth は `src/model/schema.ts`。unit system は `um-s-kPa-nN` として `src/model/types.ts` に記録済み。public API では `runCanonicalSimulation` で明示的に呼ぶ | 今後の solver validation では主経路にしない。FEBio-native 移行完了後は legacy / compatibility 扱いへ移す | compatibility / preset generation 用に限定して残す |
| Source-of-truth split | implemented / needs-new-native-entrypoint | `src/` modules と `generated/dist/` build path は分離済み。既存 FEBio export / convert scripts は `src/public-api.ts` を直接 import するものがある | S7-D の新 export path では `src/public-api.ts`、`generated/dist`、UI/canonical bridge を読まない必要がある | `scripts/export_febio_native_case.mjs` は `src/febio/native/index.ts` だけを読むようにする |
| FEBio run bundle / bridge | implemented-infrastructure / native-only-handoff | native-only exporter は `.feb` / effective spec / native model / manifest / README を出す。CLI run は `febio_exports/S7_native_baseline/jobs/` で normal termination / warnings 0 を確認済み | result normalization / classification は S7-F の主対象にしない。output CSV の物理解釈は refined model 後に詰める | S7-F では model refinement の確認指標として CSV / rigid reaction / displacement を使う |
| Refined mesh | debug-geometry / next-refinement-target | nucleus / cytoplasm / dish / pipette domains、required node sets、contact surfaces、surface-pair diagnostics、pipette-nucleus / pipette-cell contact pair がある。現 baseline は `s7-debug-local-nucleus` として粗い mesh を明示する | cell-dish solver-active contact と true cohesive validation には粗すぎる | S7-F で refined native mesh の最小設計案と rollback point を決める |
| Nucleus-cytoplasm interface | partial | sticky cohesive approximation は `src/febio/interfaces/nucleusCytoplasm.ts` にあり、現時点では effective coupling proxy | true traction-separation law ではなく、solver-active output も validation 待ち | S7-D では interface construction / validation の考え方だけ新 native model に移し、true cohesive は扱わない |
| Native interface traction / damage output | completed-contract / pending-real-run | export は face-data と plotfile contact traction path を宣言し、converter/import は native/proxy/unavailable provenance を保持する | real solver output coverage は未検証 | native-only pipeline 成立後、active load/contact 成立と declared output path を real solver output で検証する |
| Classification | partial / deferred | canonical classifier は public API から利用可能 | real solver output が未成立だと cleanup の評価軸が弱い。S7-D の export path では呼ばない | real solver outputs に基づいて後で整理する。今は優先度を下げる |
| Detachment event | partial / deferred | explicit detachment contract と導出 path は存在する | 全 payload で native event emission が揃っていない。S7-D の export path では呼ばない | solver-active output 成立後に native event 化を進める |
| True cohesive law | planned / deferred | sticky approximation は将来移行できる metadata を保持している | solver-active mesh / load / output 成立前に進める段階ではない | sticky approximation 検証後に true cohesive または nonlinear spring failure への移行方針を決める |

## 更新ルール

- `PROGRESS.md` は日本語で書く。
- 大方針、stage 計画、current stage、review gates、later / deferred、補助ロードマップの位置づけは [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md) に置く。
- 実際の作業 milestone、細かい修正内容、target files、done condition、blocker、再開位置は `PROGRESS.md` に置く。
- 直近の作業対象、next action、done condition、bounded milestone、blocker が変わったら、このファイルの `再開位置` と `次の bounded milestone` を更新する。
- `PROGRESS.md` の milestone が進んだだけなら `ROADMAP.md` は更新しない。
- `ROADMAP.md` の stage 方針が変わった場合は、`PROGRESS.md` の現在位置と次の milestone も同じ変更セットで合わせる。
- 新しく見つかった recurring blocker は `未解決問題 / Blockers` に追加する。
- physics model、cohesive model、detachment logic、main flow、classification、export/import ownership、proxy/native dependency が変わったら、このファイルと関連 docs を同じ変更セットで更新する。
- `implemented / partial / planned` の変更と、`implemented -> partial` の回帰は正直に記録する。
