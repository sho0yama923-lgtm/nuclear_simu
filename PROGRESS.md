# FEBio 精度改善の現在地

最終更新: 2026-04-24

## 現在の状況

- 現在の目標: FEBio solver に渡す simulation condition を物理的に成立させ、核が細胞質から脱落する条件を solver-active に評価できる状態へ進める。
- 現在の main path: UI 入力 -> canonical spec -> FEBio export -> FEBio CLI -> 正規化 import -> classification / detachment judgment -> 結果描画。
- FEBio export / convert scripts は `src/public-api.ts` の canonical API を直接 import する。legacy JS simulation files は FEBio script path では読まない。
- 現在の最優先: solver-native load/contact activation を成立させること。S7 の XML wiring pass で pipette-nucleus / pipette-cell contact、step-local suction pressure、rigid motion load controller 参照を追加し、未参照 load controller 警告は解消した。
- pressure/contact load は XML 上では active step から参照されるが、実 run の contact response はまだ 0 のまま。
- 現在の blocker: `febio_exports/S7_active_wiring_run2/run/case_A_cli.log` では read success / normal termination するが、`No force acting on the system` は残る。さらに `cell_dish_interface` は contact pairs を見つけられておらず、face-data contact pressure は 0 のまま。sticky cohesive validation や true cohesive 移行判断は contact/pressure response 確認後に進める。
- 全体ロードマップ: [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md)

## 再開位置

- 最後に完了した節目: Stage S6 completed。canonical FEBio-native XML は FEBio 4.12 で `Reading file ...SUCCESS!` と `N O R M A L   T E R M I N A T I O N` に到達した。
- 現在の未完了項目: contact geometry / pressure transfer residual。exported XML では active step 内の pressure load と rigid motion controller 参照、pipette contact pair が確認済み。run2 で未参照 controller は消えたが、system force warning、cell-dish tied contact no-pair warning、zero contact pressure が残る。
- 次に開くファイル: `src/febio/mesh/index.ts`、`src/febio/export/index.ts`、`scripts/convert_febio_output.mjs`、`tests/febio-front-end.test.mjs`
- 次ステップの完了条件: contact surfaces が solver の search tolerance 内で実際に接触ペアを形成し、face-data contact pressure または rigid/contact response が 0 でないことを確認する。残る場合は mesh geometry / contact type / pressure surface のどれが原因かを `未解決問題 / Blockers` に記録する。

## 優先順位の見方

- 全体優先順位: 研究・物理モデル全体の順序。頻繁には変えない。詳しくは [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md) に置く。
- 主ロードマップ: 現在の大きな作業列。いまは simulation condition advancement。
- 補助ロードマップ: 主ロードマップを支える移行作業。旧「第2優先ロードマップ」は compatibility retirement の補助ロードマップで、Stage 6 completed 済み。主ロードマップの次に自動で戻るものではない。
- 次の3手（現在処理中タスクの3手）: いまのセッションで進める細分化タスク。作業が進んで next action が変わるたびにこのファイルで更新する。

このファイルには「次に何を開いて、何が終われば進んだと言えるか」を置く。`ROADMAP.md` には「その作業がどの主ロードマップ / 補助ロードマップ / 全体優先順位に属するか」を置く。直近タスクだけが変わった場合、`ROADMAP.md` は更新しない。

## 次の3手（現在処理中タスクの3手）

### 1. contact geometry / tied pair residual を潰す

- Target files: `src/febio/mesh/index.ts`、`src/febio/export/index.ts`、`tests/febio-front-end.test.mjs`
- Expected output: cell-dish tied contact と pipette contact surfaces が solver の contact search でペアを形成し、`No contact pairs found for tied interface "cell_dish_interface"` が消える。
- Done condition: run log で tied/contact pair warning が消え、contact pressure/gap face data に 0 以外の応答が出る、または pressure surface / geometry が原因として切り分けられている。

### 2. force transfer / contact response を import まで追う

- Target files: `scripts/convert_febio_output.mjs`、`src/febio/import/normalizeFebioResult.ts`、`tests/febio-front-end.test.mjs`
- Expected output: S7 run / converted result で rigid body reaction、face pressure、contact fraction を列ずれなしに読み、provenance 付きで確認できる。
- Done condition: nonzero response が normalized result に残る、または solver output 欠損が explicit provenance として記録されている。rigid body CSV の id/x/y/z/Fx/Fy/Fz 列解釈は修正済み。

### 3. sticky cohesive validation の入口を再判定する

- Target files: `src/febio/interfaces/nucleusCytoplasm.ts`、`src/febio/export/index.ts`、`docs/febio/STICKY_COHESIVE_STAGE_S5.md`
- Expected output: load/contact activation が成立した後に、sticky cohesive validation を進めるか、先に残差を潰すかを判断する。
- Done condition: sticky cohesive validation の次の確認条件が docs と `再開位置` に反映されている。

## 未解決問題 / Blockers

| 問題 | 影響 | 暫定対応 | 意図する修正 | 優先度 |
|---|---|---|---|---|
| solver-native load/contact activation が未完了 | XML wiring は進み、active step pressure / rigid controller / pipette contact pair は出力される。run2 で未参照 controller は解消したが、`No force acting on the system` と cell-dish tied no-pair warning が残る | sticky cohesive は solver-primary のまま保持し、物理 validation は保留する | contact surfaces / pressure target geometry を直し、非ゼロ contact pressure または force transfer を確認する | critical |
| rigid body output parsing は列ずれしやすい | FEBio rigid body CSV は `id,x,y,z,Fx,Fy,Fz` の形で出るため、id 列を除いた後も z と Fx/Fz の index を誤ると force を誤読する | `scripts/convert_febio_output.mjs` で z=`values[2]`、Fx=`values[3]`、Fz=`values[5]` として修正済み | 今後 force validation test では face pressure と rigid reaction を分けて見る | medium |
| native interface output は real-run validation が必要 | interface traction / damage の output contract はあるが、実 run payload での coverage がまだ確定していない | converter/import で native/proxy/unavailable provenance を明示する | active load/contact 成立後に declared output path を real solver output で検証する | high |
| sticky cohesive は true traction-separation law ではない | mesh / load / output が未確立のまま validation すると物理解釈がぶれる | effective coupling proxy として扱い、validation scope を広げすぎない | load/contact/output 成立後に sticky approximation の安定性と interface geometry を実 FEBio run で検証する | high |
| explicit detachment event が全 result payload で native ではない | solver event ではなく導出 event を先に整え続けるリスクがある | import と compatibility path で explicit detachment derivation を維持する | real solver output が出た後に native event 化の優先度を再評価する | medium |
| bridge diagnostics が粗い | FEBio 実行失敗や payload 変換失敗の切り分けに時間がかかる | manifest、bridge 出力、import 側チェックで追う | solver-condition work を妨げる場合に限って bridge-side diagnostics を強化する | medium |

## 実装状態

| 項目 | 状態 | 現在の挙動 | 既知の制約 | 次の手 |
|---|---|---|---|---|
| Canonical parameter schema | implemented | source of truth は `src/model/schema.ts`。unit system は `um-s-kPa-nN` として `src/model/types.ts` に記録済み | calibration はまだ暫定値 | aspiration / output metrics の単位を同じ系で揃える |
| Source-of-truth split | implemented | `src/` modules と `generated/dist/` build path は分離済み。FEBio export / convert scripts は `src/public-api.ts` を直接 import し、legacy JS simulation files を読まない | browser runtime には compatibility layer が残る | source-of-truth は `src/` と `PROGRESS.md` に固定する |
| FEBio run bundle / bridge | implemented-infrastructure / output-contract-complete / native-read-restored / active-wiring-xml | export / import infrastructure は main path を保持し、FEBio-native mesh、material、boundary、contact、suction pressure、step-local pressure load、rigid controller 参照、logfile output、plotfile contact traction、derived `L(t)` metadata を出力する | S7 run2 は normal termination するが contact pressure は 0 で `No force acting on the system` が残る | physical aspiration validation を主張する前に active pressure/contact force transfer を確認する |
| Refined mesh | completed-contract / simplified-geometry / pipette-contact-pairs | nucleus / cytoplasm / dish / pipette domains、required node sets、contact surfaces、surface-pair validation、pipette-nucleus / pipette-cell contact pair がある | geometry はまだ単純化されており、物理的 validation は未完了 | load/contact activation とあわせて numerical stability を見る |
| Nucleus-cytoplasm interface | partial | sticky cohesive approximation は `src/febio/interfaces/nucleusCytoplasm.ts` にあり、現時点では effective coupling proxy | true traction-separation law ではなく、solver-active output も validation 待ち | load/contact/output 成立後に sticky cohesive solver validation を進める |
| Native interface traction / damage output | completed-contract / pending-real-run | export は face-data と plotfile contact traction path を宣言し、converter/import は native/proxy/unavailable provenance を保持する | real solver output coverage は未検証 | active load/contact 成立後に declared output path を検証する |
| Classification | partial | canonical classifier は public API から利用可能 | real solver output が未成立だと cleanup の評価軸が弱い | real solver outputs に基づいて後で整理する。今は優先度を下げる |
| Detachment event | partial | explicit detachment contract と導出 path は存在する | 全 payload で native event emission が揃っていない | solver-active output 成立後に native event 化を進める |
| True cohesive law | planned | sticky approximation は将来移行できる metadata を保持している | solver-active mesh / load / output 成立前に進める段階ではない | sticky approximation 検証後に true cohesive または nonlinear spring failure への移行方針を決める |

## 更新ルール

- `PROGRESS.md` は日本語で書く。
- 全体優先順位や stage 計画が変わったら [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md) を更新する。
- 直近の作業対象、next action、done condition が変わったら、このファイルの `再開位置` と `次の3手（現在処理中タスクの3手）` を更新する。
- 主ロードマップの current stage、stage status、After Current 候補、補助ロードマップの位置づけが変わる場合だけ、`ROADMAP.md` も同じ変更セットで更新する。
- 新しく見つかった recurring blocker は `未解決問題 / Blockers` に追加する。
- physics model、cohesive model、detachment logic、main flow、classification、export/import ownership、proxy/native dependency が変わったら、このファイルと関連 docs を同じ変更セットで更新する。
- `implemented / partial / planned` の変更と、`implemented -> partial` の回帰は正直に記録する。
