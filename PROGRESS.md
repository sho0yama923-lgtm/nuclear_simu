# FEBio 精度改善の現在地

最終更新: 2026-04-24

## 現在の状況

- 現在の目標: FEBio solver に渡す simulation condition を物理的に成立させ、核が細胞質から脱落する条件を solver-active に評価できる状態へ進める。
- 現在の main path: UI 入力 -> canonical spec -> FEBio export -> FEBio CLI -> 正規化 import -> classification / detachment judgment -> 結果描画。
- 現在の最優先: solver-native load/contact activation を成立させること。S6 XML は read success / normal termination まで到達したが、FEBio 側で inactive contact pair、未参照 load controller、`No force acting on the system` が残っている。
- 現在の blocker: pressure/contact load が active solver step に効いていないため、sticky cohesive validation や true cohesive 移行判断を物理的に評価できない。
- 全体ロードマップ: [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md)

## 再開位置

- 最後に完了した節目: Stage S6 completed。canonical FEBio-native XML は FEBio 4.12 で `Reading file ...SUCCESS!` と `N O R M A L   T E R M I N A T I O N` に到達した。
- 現在の未完了項目: load/contact activation residual。S6 run では cell-dish contact pair が inactive、load controller が未参照、system force が 0 と警告される。
- 次に開くファイル: `src/febio/export/index.ts`、`src/febio/mesh/index.ts`、`src/model/schema.ts`、`tests/febio-front-end.test.mjs`
- 次ステップの完了条件: pressure/contact load が active step に参照され、FEBio run の force transfer が 0 でないことを確認でき、`再開位置` と `次の3手（現在処理中タスクの3手）` が次の未完了項目を指すこと。

## 優先順位の見方

- 全体優先順位: 研究・物理モデル全体の順序。頻繁には変えない。詳しくは [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md) に置く。
- 主ロードマップ: 現在の大きな作業列。いまは simulation condition advancement。
- 補助ロードマップ: 主ロードマップを支える移行作業。旧「第2優先ロードマップ」は compatibility retirement の補助ロードマップで、Stage 6 completed 済み。主ロードマップの次に自動で戻るものではない。
- 次の3手（現在処理中タスクの3手）: いまのセッションで進める細分化タスク。作業が進んで next action が変わるたびにこのファイルで更新する。

このファイルには「次に何を開いて、何が終われば進んだと言えるか」を置く。`ROADMAP.md` には「その作業がどの主ロードマップ / 補助ロードマップ / 全体優先順位に属するか」を置く。直近タスクだけが変わった場合、`ROADMAP.md` は更新しない。

## 次の3手（現在処理中タスクの3手）

### 1. load/contact activation residual を潰す

- Target files: `src/febio/export/index.ts`、`src/febio/mesh/index.ts`、`tests/febio-front-end.test.mjs`
- Expected output: pressure load、prescribed motion、contact pair、load controller が active step から参照される。
- Done condition: exported FEBio XML の active step 内で load/contact が参照され、既存テストまたは新規テストで未参照 load controller を検出できる。

### 2. S6 run の force transfer を確認する

- Target files: `scripts/export_febio_case.mjs`、`scripts/convert_febio_output.mjs`、`src/febio/import/normalizeFebioResult.ts`、`tests/febio-front-end.test.mjs`
- Expected output: S6 相当の run / converted result で force または pressure/contact response が 0 でないことを provenance 付きで確認できる。
- Done condition: `No force acting on the system` が解消、または残る場合は原因と次の修正先が `未解決問題 / Blockers` に記録されている。

### 3. sticky cohesive validation の入口を再判定する

- Target files: `src/febio/interfaces/nucleusCytoplasm.ts`、`src/febio/export/index.ts`、`docs/febio/STICKY_COHESIVE_STAGE_S5.md`
- Expected output: load/contact activation が成立した後に、sticky cohesive validation を進めるか、先に残差を潰すかを判断する。
- Done condition: sticky cohesive validation の次の確認条件が docs と `再開位置` に反映されている。

## 未解決問題 / Blockers

| 問題 | 影響 | 暫定対応 | 意図する修正 | 優先度 |
|---|---|---|---|---|
| solver-native load/contact activation が未完了 | XML は読めて normal termination するが、inactive contact pair、未参照 load controller、`No force acting on the system` が残る | sticky cohesive は solver-primary のまま保持し、物理 validation は保留する | pressure/contact load を active solver step に接続し、非ゼロ force transfer を確認する | critical |
| native interface output は real-run validation が必要 | interface traction / damage の output contract はあるが、実 run payload での coverage がまだ確定していない | converter/import で native/proxy/unavailable provenance を明示する | active load/contact 成立後に declared output path を real solver output で検証する | high |
| sticky cohesive は true traction-separation law ではない | mesh / load / output が未確立のまま validation すると物理解釈がぶれる | effective coupling proxy として扱い、validation scope を広げすぎない | load/contact/output 成立後に sticky approximation の安定性と interface geometry を実 FEBio run で検証する | high |
| explicit detachment event が全 result payload で native ではない | solver event ではなく導出 event を先に整え続けるリスクがある | import と compatibility path で explicit detachment derivation を維持する | real solver output が出た後に native event 化の優先度を再評価する | medium |
| bridge diagnostics が粗い | FEBio 実行失敗や payload 変換失敗の切り分けに時間がかかる | manifest、bridge 出力、import 側チェックで追う | solver-condition work を妨げる場合に限って bridge-side diagnostics を強化する | medium |

## 実装状態

| 項目 | 状態 | 現在の挙動 | 既知の制約 | 次の手 |
|---|---|---|---|---|
| Canonical parameter schema | implemented | source of truth は `src/model/schema.ts`。unit system は `um-s-kPa-nN` として `src/model/types.ts` に記録済み | calibration はまだ暫定値 | aspiration / output metrics の単位を同じ系で揃える |
| Source-of-truth split | implemented | `src/` modules と `generated/dist/` build path は分離済み | browser runtime には compatibility layer が残る | source-of-truth は `src/` と `PROGRESS.md` に固定する |
| FEBio run bundle / bridge | implemented-infrastructure / output-contract-complete / native-read-restored | export / import infrastructure は main path を保持し、FEBio-native mesh、material、boundary、contact、suction pressure、logfile output、plotfile contact traction、derived `L(t)` metadata を出力する | S6 は normal termination するが load/contact activation residual が残る | physical aspiration validation を主張する前に active pressure/contact force transfer を確認する |
| Refined mesh | completed-contract / simplified-geometry | nucleus / cytoplasm / dish / pipette domains、required node sets、contact surfaces、surface-pair validation がある | geometry はまだ単純化されており、物理的 validation は未完了 | load/contact activation とあわせて numerical stability を見る |
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
