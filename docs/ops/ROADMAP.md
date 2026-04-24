# 優先順位とロードマップ

`PROGRESS.md` は現在位置と直近タスクの運転席です。このファイルは、頻繁には変えない全体優先順位と stage 計画を置きます。

直近で処理する3 priority は `PROGRESS.md` の `次の3手（現在処理中タスクの3手）` だけを見ます。このファイルには直近タスクの番号付きリストを置きません。

## ロードマップの階層

- 全体優先順位: 研究・物理モデル全体の順序。大きな方針が変わったときだけ更新する。
- 主ロードマップ: 現在の大きな作業列。いまは simulation condition advancement。
- 補助ロードマップ: 主ロードマップを支える並行・移行作業。旧「第2優先ロードマップ」はここに属する。全体優先順位の2番目でも、主ロードマップ完了後に自動で戻る次順位でもない。
- 次の3手（現在処理中タスクの3手）: `PROGRESS.md` に置く直近 priority。作業が進むたびに更新する。

## PROGRESS.md との使い分け

| 見たいもの | 見る場所 | 更新タイミング |
|---|---|---|
| 今日・次セッションで開くファイル、完了条件、blocker | `PROGRESS.md` | 直近作業、next action、done condition、blocker が変わったとき |
| 研究・物理モデル全体の順序 | このファイル | 大きな優先順位が変わったとき |
| 主ロードマップの stage と current/completed 状態 | このファイル | stage の追加、完了、延期、scope 変更が起きたとき |
| 補助ロードマップの位置づけ | このファイル | 主ロードマップとの関係、完了条件、並行扱いが変わったとき |
| 実装状態の細かい partial / implemented / planned | `PROGRESS.md` | コードや docs の実態が変わったとき |

原則として、コード変更のたびにまず `PROGRESS.md` を更新対象として確認します。ROADMAP は「直近の手順」ではなく「現在の手順がどの大きな流れに属するか」を確認するために使います。

## 現在のロードマップ位置

現在の主ロードマップは `Simulation Condition Advancement`、current stage は `Stage S7: Load/contact activation validation` です。

S7 の目的は、pressure/contact load が active solver step に参照され、FEBio run で nonzero force transfer を確認できる状態にすることです。S7 内の具体的な3 priority は `PROGRESS.md` に一本化します。

### Completed Foundation

現在の主ロードマップで土台として完了済み、または residual 付きで完了済みの範囲です。直近 priority ではありません。

1. solver-active mesh completeness
2. complete FEBio XML serialization
3. pressure-driven pipette suction
4. aspiration length output
5. native interface traction / damage output contract
6. unit system clarification
7. sticky cohesive / true cohesive preparation up to canonical read success and normal termination

### After S7 Review Gates

S7 が完了してから、どの順で扱うかを再判定する検討枠です。ここは次タスク一覧ではありません。

- sticky cohesive solver validation に入れるだけの force transfer と output provenance があるか。
- native interface traction / damage output の real-run coverage を先に確認すべきか。
- real solver outputs に基づく classification / detachment cleanup を再評価できる段階か。

### Later

1. true cohesive または nonlinear spring failure への移行判断
2. broader material calibration
3. bridge diagnostics の強化

### Do not expand yet

- membrane shell
- cell-dish cohesive の追加物理
- LINC / cytoskeleton の明示モデル

## 主ロードマップ: Simulation Condition Advancement

現在の主ロードマップは S7 です。S1-S4 は contract と serialization の土台として completed、S5-S6 は canonical FEBio-native read success / normal termination まで completed-with-residual です。残っている blocker は、pressure/contact load が active step に参照されず、FEBio run で inactive contact pair、未参照 load controller、`No force acting on the system` が出ることです。

| Stage | Status | Scope |
|---|---|---|
| Stage S1: Solver-active mesh completeness | completed | nucleus / cytoplasm / dish / pipette domains, required node sets, required surfaces, and surface pairs are emitted and validated |
| Stage S2: Complete FEBio XML serialization | completed | nodes / elements / ElementSet / Surface / SurfacePair / material / boundary / contact / load を solver input として完全に出力する |
| Stage S3: Pressure-driven pipette suction | completed | `P_hold` / `DeltaP(t)` を pressure load curve として実装し、prescribed motion と suction を区別する |
| Stage S4: Aspiration and interface output | completed | aspiration length `L(t)`, displacement logs, contact pressure/gap face logs, plotfile contact traction bridge, and provenance paths are declared in export/XML/converter/import |
| Stage S5: Sticky cohesive solver validation | completed-with-residual | existing FEBio-native sticky run reaches normal termination; canonical readability residual was carried into S6 |
| Stage S6: True cohesive/failure preparation | completed-with-residual | canonical FEBio-native read success and normal termination restored; true cohesive/failure deferred until load/contact activation is validated |
| Stage S7: Load/contact activation validation | current | pressure/contact loads must be referenced by active solver steps and produce nonzero force transfer; inactive contact pair, unreferenced load controller, and zero system force residuals are the current blocker |

## 補助ロードマップ: Compatibility Retirement

- 位置づけ: 主ロードマップを支える移行作業。全体優先順位の「第二優先」ではなく、直近3 priority でもない。
- 進め方: 主ロードマップの実装を妨げる compatibility debt が出たときだけ参照する。通常は `PROGRESS.md` の現在処理中タスクを優先する。
- 目的: compatibility retirement を完了し、classification / detachment の active path を canonical public API へ寄せる。
- 完了条件: FEBio export / conversion scripts が canonical public API を直接 import し、legacy JS simulation files を読まない。browser runtime の compatibility scripts は UI bridge に限定する。
- 現在位置: Stage 6 completed。

| Stage | 状態 | 範囲 |
|---|---|---|
| Stage 1: Canonical import preservation | completed | native `localNc` / `localCd` payload、`contactFraction` / `nativeGap`、`sourceNormal` / `sourceDamage` / `sourceShear` を final state と `history[]` に保持する |
| Stage 2: Converter face-log robustness | completed | face snapshot の複数 row layout、leading entity id、extra metadata、descriptor-driven field order を読む |
| Stage 3: Export self-description | completed | standard export bundle が現行 face-data fields と optional traction extensions を宣言する |
| Stage 4: Converted result provenance visibility | completed | converted output mapping が interface region ごとの coverage と optional traction extensions を示す |
| Stage 5: Standard path native shear expansion | completed | standard export / bridge path に solver-native tangential observation branch を追加する |
| Stage 6: Compatibility retirement | completed | compatibility-owned proxy-first classification / detachment branch を退役させ、FEBio scripts から legacy JS simulation file 読み込みを外す |

## 更新ルール

- 全体優先順位、主ロードマップ、補助ロードマップの位置づけが変わったらこのファイルを更新する。
- 直近タスクだけが変わった場合は `PROGRESS.md` の `再開位置` と `次の3手（現在処理中タスクの3手）` を更新し、このファイルは変えなくてよい。
- 補助ロードマップを追加するときは、主ロードマップとの関係と完了条件を明記する。
- `Next` や `Now` に番号付きタスクリストを置かない。直近3 priority は `PROGRESS.md` に一本化する。
- Stage 完了後は、次の主課題へ自動で戻すのではなく、`PROGRESS.md` の現在位置で次に扱うべき task を明示する。
- `AGENT.md` や skill に具体的な優先順位リストを重複して置かない。手順側からはこのファイルを参照する。
