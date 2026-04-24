# FEBio 精度改善の現在地

最終更新: 2026-04-24

## 現在の状況

- 現在の目標: FEBio solver に渡す simulation condition を物理的に成立させ、核が細胞質から脱落する条件を solver-active に評価できる状態へ進める。
- 当面の physics validation は UI parameter path ではなく FEBio-native spec / CLI backend path を主経路にする。
- UI parameter -> canonical spec -> FEBio 変換は compatibility / preset generation 用に残すが、solver-native contact / pressure / force response が成立するまで物理検証の主経路にしない。
- 最終的な UI は FEBio-native spec を編集する presentation layer として統合する。
- UI parameter -> canonical spec -> FEBio 変換系は、FEBio-native spec / CLI backend path が安定するまでは compatibility / preset generation 用に維持する。
- FEBio-native spec への移行が完了したら、旧 UI parameter conversion files は active path から外し、legacy 扱いにする。
- legacy 化した変換系ファイルは physics source of truth として扱わず、必要な場合のみ preset migration / backwards compatibility 用に限定する。
- FEBio-native spec / CLI backend path が安定した後、旧 UI parameter path / canonical conversion / browser bridge を説明する docs は active guidance から外し、legacy / compatibility docs として扱う。
- 移行後に legacy / compatibility docs へ後退させる予定のファイルは `docs/febio/PARAMETER_MAPPING.md`、`docs/febio/FEBIO_UI_BRIDGE.md`、`docs/febio/FEBIO_FRONTEND_ARCHITECTURE.md`、`docs/febio/FEBIO_HANDOFF.md`、`docs/febio/BRIDGE_CONTRACT.md`。
- これらの docs は移行完了までは旧経路の照合・互換維持に使うが、新しい FEBio solver parameter や direct validation の source of truth にはしない。
- 現在の main path はまだ UI 入力 -> canonical spec -> FEBio export -> FEBio CLI -> 正規化 import -> classification / detachment judgment -> 結果描画を含むが、S7 以降の solver validation は FEBio-native direct path へ切り替える。
- FEBio export / convert scripts は `src/public-api.ts` の canonical API を直接 import する。legacy JS simulation files は FEBio script path では読まない。
- 現在の最優先: UI parameter conversion を solver validation から切り離し、FEBio-native parameter spec から直接 export / run / convert / diagnostics / Studio confirmation できる path を作ること。
- 既存 S7 residual: pressure/contact load は XML 上では active step から参照されるが、実 run の contact response はまだ 0 のまま。
- 現在の blocker: `febio_exports/S7_active_wiring_run2/run/case_A_cli.log` では read success / normal termination するが、`No force acting on the system` は残る。さらに `cell_dish_interface` は contact pairs を見つけられておらず、face-data contact pressure は 0 のまま。次はこの問題を UI parameter conversion から切り離して direct path で再検証する。
- 全体ロードマップ: [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md)
- FEBio-native spec 方針: [docs/febio/FEBIO_NATIVE_SPEC.md](docs/febio/FEBIO_NATIVE_SPEC.md)

## 再開位置

- 最後に完了した節目: Stage S6 completed。canonical FEBio-native XML は FEBio 4.12 で `Reading file ...SUCCESS!` と `N O R M A L   T E R M I N A T I O N` に到達した。
- 現在の未完了項目: UI parameter conversion を経由しない FEBio-native direct parameter path の確立。既存 run では active step 内の pressure load と rigid motion controller 参照、pipette contact pair が確認済みだが、system force warning、cell-dish tied contact no-pair warning、zero contact pressure が残る。
- 次に開くファイル:
  - `docs/febio/FEBIO_NATIVE_SPEC.md`
  - `src/febio/export/index.ts`
  - `src/febio/mesh/index.ts`
  - `scripts/export_febio_direct_case.mjs` または新規 equivalent
  - `scripts/convert_febio_output.mjs`
  - `tests/febio-front-end.test.mjs` または direct path 用の新規 test
- 次ステップの完了条件: FEBio-native spec JSON から UI parameter -> canonical spec 変換を通らず `.feb` を生成でき、direct path で contact / pressure / force transfer を検証できる状態にする。残る場合は mesh geometry / contact type / pressure surface / parser / Studio確認待ち のどれが原因かを `未解決問題 / Blockers` に記録する。

## 優先順位の見方

- 全体優先順位: 研究・物理モデル全体の順序。頻繁には変えない。詳しくは [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md) に置く。
- 主ロードマップ: 現在の大きな作業列。いまは simulation condition advancement。
- 補助ロードマップ: 主ロードマップを支える移行作業。旧「第2優先ロードマップ」は compatibility retirement の補助ロードマップで、Stage 6 completed 済み。主ロードマップの次に自動で戻るものではない。
- 次の bounded milestone: いまのセッションで進めるレビュー可能な成果単位。細かい bullet は作業ガイドであり、単独の停止点ではない。作業が進んで milestone / done condition / blocker が変わるたびにこのファイルで更新する。

このファイルには「次に何を開いて、何が終われば進んだと言えるか」を置く。`ROADMAP.md` には「その作業がどの主ロードマップ / 補助ロードマップ / 全体優先順位に属するか」を置く。直近タスクだけが変わった場合、`ROADMAP.md` は更新しない。

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

### Milestone S7-A: FEBio-native direct parameter path の入口を作る

この milestone の目的は、UI parameter -> canonical spec 変換を通らず、FEBio-native spec JSON から `.feb` 生成へ到達できる最初の reviewable path を作ること。

この節の bullet は作業ガイドであり、単独の停止点ではない。agent は、下記の Done condition または明確な blocker / Studio 確認ゲートまで、隣接作業をまとめて進める。

#### 含める作業

- `docs/febio/FEBIO_NATIVE_SPEC.md` を source of truth として、実装側の FEBio-native spec entrypoint を用意する。
- `src/febio/spec/` または既存の `src/febio/export/` に、FEBio-native spec の type / validation skeleton を追加する。
- 最小 force-transfer debug case に必要な geometry / material / contact / load / boundary / output parameter を FEBio-native 名で扱えるようにする。
- UI parameter -> canonical spec 変換を通らない direct export CLI を追加する。
- direct spec JSON から FEBio template / `.feb` XML を生成する経路を作る。
- direct path が `buildSimulationInput` などの UI/canonical path に依存しないことを regression test で確認する。
- `.feb` が生成できる場合は、Studio confirmation request に `.feb` / log / result / output CSV path を出す。
- 状態、blocker、次 action が変わった場合は `PROGRESS.md` を更新する。

#### Target files

- `docs/febio/FEBIO_NATIVE_SPEC.md`
- `src/febio/spec/` または既存の `src/febio/export/`
- `src/febio/mesh/index.ts`
- `scripts/export_febio_direct_case.mjs`
- `scripts/convert_febio_output.mjs`
- `tests/febio-front-end.test.mjs` または direct path 用の新規 test

#### Done condition

- FEBio-native spec JSON から UI parameter -> canonical spec 変換を通らず `.feb` が生成できる。
- generated XML に material / contact / pressure / boundary / output が direct spec 由来で入る。
- direct path が既存 UI parameter path に依存しない regression test がある。
- Studio 確認が必要な場合、開く `.feb` path と照合する log / result / output path が明示されている。
- force-transfer / contact response の検証が未完の場合は、原因候補が geometry / contact type / pressure target / output parser / Studio確認待ち のどれかに切り分けられている。

## 未解決問題 / Blockers

| 問題 | 影響 | 暫定対応 | 意図する修正 | 優先度 |
|---|---|---|---|---|
| UI parameter conversion が solver validation を複雑化している | UI convenience parameter -> canonical spec -> FEBio template -> XML の変換を毎回通すと、force-transfer 問題が UI mapping 由来か FEBio model 由来か切り分けにくい | UI parameter path は compatibility / preset generation 用に残し、physics validation は FEBio-native direct spec で行う | FEBio-native spec / CLI direct export path を作り、contact / pressure / force transfer を UI 変換から切り離して検証する。移行完了後、旧変換系ファイルは active path から外して legacy 扱いにする | critical |
| 旧 UI/canonical docs が active guidance と混在している | agent が旧 UI parameter mapping / browser bridge / handoff docs を current FEBio-native source of truth と誤認するリスクがある | 移行完了までは互換照合用として残すが、新しい solver parameter の根拠にはしない | FEBio-native spec / CLI backend path が安定したら、`PARAMETER_MAPPING.md`、`FEBIO_UI_BRIDGE.md`、`FEBIO_FRONTEND_ARCHITECTURE.md`、`FEBIO_HANDOFF.md`、`BRIDGE_CONTRACT.md` を legacy / compatibility docs へ後退させる | medium |
| solver-native load/contact activation が未完了 | XML wiring は進み、active step pressure / rigid controller / pipette contact pair は出力される。run2 で未参照 controller は解消したが、`No force acting on the system` と cell-dish tied no-pair warning が残る | sticky cohesive は solver-primary のまま保持し、物理 validation は保留する | direct path で contact surfaces / pressure target geometry を直し、非ゼロ contact pressure または force transfer を確認する | critical |
| rigid body output parsing は列ずれしやすい | FEBio rigid body CSV は `id,x,y,z,Fx,Fy,Fz` の形で出るため、id 列を除いた後も z と Fx/Fz の index を誤ると force を誤読する | `scripts/convert_febio_output.mjs` で z=`values[2]`、Fx=`values[3]`、Fz=`values[5]` として修正済み | 今後 force validation test では face pressure と rigid reaction を分けて見る | medium |
| native interface output は real-run validation が必要 | interface traction / damage の output contract はあるが、実 run payload での coverage がまだ確定していない | converter/import で native/proxy/unavailable provenance を明示する | active load/contact 成立後に declared output path を real solver output で検証する | high |
| sticky cohesive は true traction-separation law ではない | mesh / load / output が未確立のまま validation すると物理解釈がぶれる | effective coupling proxy として扱い、validation scope を広げすぎない | load/contact/output 成立後に sticky approximation の安定性と interface geometry を実 FEBio run で検証する | high |
| explicit detachment event が全 result payload で native ではない | solver event ではなく導出 event を先に整え続けるリスクがある | import と compatibility path で explicit detachment derivation を維持する | real solver output が出た後に native event 化の優先度を再評価する | medium |
| bridge diagnostics が粗い | FEBio 実行失敗や payload 変換失敗の切り分けに時間がかかる | manifest、bridge 出力、import 側チェックで追う | solver-condition work を妨げる場合に限って bridge-side diagnostics を強化する | medium |

## 実装状態

| 項目 | 状態 | 現在の挙動 | 既知の制約 | 次の手 |
|---|---|---|---|---|
| FEBio-native spec path | planned / policy-adopted | solver に必要な geometry / material / contact / load / boundary / output を直接表す spec を source of truth にする方針 | まだ schema / CLI は未実装 | `docs/febio/FEBIO_NATIVE_SPEC.md` を起点に CLI/backend-first flow を実装する |
| Canonical parameter schema | implemented / future-compatibility | source of truth は `src/model/schema.ts`。unit system は `um-s-kPa-nN` として `src/model/types.ts` に記録済み | 今後の solver validation では主経路にしない。FEBio-native 移行完了後は legacy / compatibility 扱いへ移す | compatibility / preset generation layer として残し、direct path へ変換する |
| Source-of-truth split | implemented | `src/` modules と `generated/dist/` build path は分離済み。FEBio export / convert scripts は `src/public-api.ts` を直接 import し、legacy JS simulation files を読まない | browser runtime には compatibility layer が残る | source-of-truth は FEBio-native spec と `src/` に寄せ、旧 UI conversion は移行後 legacy にする |
| FEBio run bundle / bridge | implemented-infrastructure / output-contract-complete / native-read-restored / active-wiring-xml | export / import infrastructure は main path を保持し、FEBio-native mesh、material、boundary、contact、suction pressure、step-local pressure load、rigid controller 参照、logfile output、plotfile contact traction、derived `L(t)` metadata を出力する | S7 run2 は normal termination するが contact pressure は 0 で `No force acting on the system` が残る。現状は UI/canonical path 由来の複雑性も残る | direct spec path で physical aspiration validation を再検証する |
| Refined mesh | completed-contract / simplified-geometry / pipette-contact-pairs | nucleus / cytoplasm / dish / pipette domains、required node sets、contact surfaces、surface-pair validation、pipette-nucleus / pipette-cell contact pair がある | geometry はまだ単純化されており、物理的 validation は未完了 | direct path の load/contact activation とあわせて numerical stability を見る |
| Nucleus-cytoplasm interface | partial | sticky cohesive approximation は `src/febio/interfaces/nucleusCytoplasm.ts` にあり、現時点では effective coupling proxy | true traction-separation law ではなく、solver-active output も validation 待ち | load/contact/output 成立後に sticky cohesive solver validation を進める |
| Native interface traction / damage output | completed-contract / pending-real-run | export は face-data と plotfile contact traction path を宣言し、converter/import は native/proxy/unavailable provenance を保持する | real solver output coverage は未検証 | active load/contact 成立後に declared output path を検証する |
| Classification | partial | canonical classifier は public API から利用可能 | real solver output が未成立だと cleanup の評価軸が弱い | real solver outputs に基づいて後で整理する。今は優先度を下げる |
| Detachment event | partial | explicit detachment contract と導出 path は存在する | 全 payload で native event emission が揃っていない | solver-active output 成立後に native event 化を進める |
| True cohesive law | planned | sticky approximation は将来移行できる metadata を保持している | solver-active mesh / load / output 成立前に進める段階ではない | sticky approximation 検証後に true cohesive または nonlinear spring failure への移行方針を決める |

## 更新ルール

- `PROGRESS.md` は日本語で書く。
- 全体優先順位や stage 計画が変わったら [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md) を更新する。
- 直近の作業対象、next action、done condition、bounded milestone、blocker が変わったら、このファイルの `再開位置` と `次の bounded milestone` を更新する。
- 主ロードマップの current stage、stage status、After Current 候補、補助ロードマップの位置づけが変わる場合だけ、`ROADMAP.md` も同じ変更セットで更新する。
- 新しく見つかった recurring blocker は `未解決問題 / Blockers` に追加する。
- physics model、cohesive model、detachment logic、main flow、classification、export/import ownership、proxy/native dependency が変わったら、このファイルと関連 docs を同じ変更セットで更新する。
- `implemented / partial / planned` の変更と、`implemented -> partial` の回帰は正直に記録する。
