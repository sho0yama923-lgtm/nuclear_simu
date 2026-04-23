# FEBio 精度改善の進捗

Last updated: 2026-04-23

## Current Operating Picture

- 現在の目標: FEBio を主経路として、核が細胞質から脱落する条件を評価する。
- 現在の main path: UI 入力 -> canonical spec -> FEBio export -> FEBio CLI -> 正規化 import -> native-first classification / detachment judgment -> 結果描画。
- 現在の最優先: nucleus-cytoplasm cohesive を安定化しつつ、`localNc` / `localCd`、classification、detachment 判定を native-first に寄せる。
- 現在の blocker: sticky cohesive はまだ近似であり、native interface observation は payload 形状ごとのばらつきが残り、explicit detachment event も全 payload で native ではなく、`simulation.js` に互換用途の fallback helper が残っている。
- 直近アクション: `scripts/convert_febio_output.mjs`、`src/febio/import/normalizeFebioResult.ts`、`docs/febio/FEBIO_OUTPUT_MAPPING.md`、`tests/febio-front-end.test.mjs` を開き、外部 face-log の native-first 分岐をもう 1 つ進め、同じ変更セットで `Resume From Here` を更新する。

## Research Goal

- 主目的は、FEBio を主な物理経路として、核が細胞質から脱落する条件を評価すること。
- detachment は明示イベントとして扱う。
- detachment 判定は damage と geometry の両方で行う。
- solver 出力がある場合は native-first を維持し、必要な場合のみ proxy を補助的に使う。
- true cohesive を導入するまでは、sticky cohesive を solver-primary な近似として使う。

## Main Flow

- UI input
- canonical spec
- FEBio template / `.feb` XML
- FEBio CLI execution
- normalized result import
- physical result rendering

### Canonical ownership

- canonical parameter source: `src/model/schema.ts`
- main FEBio export source: `src/febio/export/index.ts`
- normalized import source: `src/febio/import/normalizeFebioResult.ts`
- classification source: `src/results/classification.ts`

### Runtime note

- Browser 互換経路はまだ legacy bundle から起動している。
- source-of-truth の編集先は `src/` へ移っている。
- `simulation.js` は compatibility layer であり、source-of-truth ではない。
- `generated/dist/` は生成物であり、編集対象ではない。

## Priority Stack

### Now

1. nucleus-cytoplasm cohesive の安定化と検証
2. `localNc` native output への移行
3. classification native migration
4. explicit detachment judgment と event emission

### Next

1. `simulation.js` の解体
2. schema / classification / detachment の残り責務を canonical `src/` modules に移す
3. `simulation.js` を browser path 用の thin compatibility bridge まで縮める

### Later

1. true cohesive の導入
2. calibration 後の solver-active nonlinear branch
3. native-first observation path が安定してからの material calibration 拡張

### Do not expand yet

- membrane shell
- cell-dish cohesive
- LINC / cytoskeleton

## Priority 2 Roadmap

- Goal: move `localNc` / `localCd` observation as far toward native-first as the current FEBio path can support, while keeping every remaining proxy branch explicit.
- Done condition: the standard export/bridge path either emits solver-native tangential observation directly or carries enough structured metadata that every remaining proxy fallback is intentional, labeled, and narrow.
- Current position: Stage 6 ready.

### Stage 1: Canonical import preservation

- Status: completed
- Scope: preserve native `localNc` / `localCd` payloads, `contactFraction` / `nativeGap`, and `sourceNormal` / `sourceDamage` / `sourceShear` through final state and `history[]`.
- Done when: converter-side native/proxy decisions survive canonical normalization.

### Stage 2: Converter face-log robustness

- Status: completed
- Scope: let the converter read native face snapshots across multiple row layouts, including leading entity ids, extra metadata columns, and descriptor-driven field order.
- Done when: tangential traction branches stay native-first for the supported external payload shapes.

### Stage 3: Export self-description

- Status: completed
- Scope: make the standard export bundle declare which face-data fields are emitted today and which traction fields are only optional external or plotfile-side extensions.
- Done when: export metadata and tests make the current native coverage explicit.

### Stage 4: Converted result provenance visibility

- Status: completed
- Scope: carry the export-side face-data coverage metadata into converted result mapping/provenance so a saved converted JSON explains both current logfile fields and optional traction extensions.
- Done when: converted output mapping shows logfile field coverage and optional traction extensions per interface region.

### Stage 5: Standard path native shear expansion

- Status: completed
- Scope: expand the standard export/bridge path so tangential traction becomes available without relying only on external enriched payloads.
- Done when: the default FEBio path can produce or bridge a solver-native tangential observation branch for at least one standard interface path.

### Stage 6: Compatibility retirement

- Status: pending
- Scope: remove the remaining compatibility-owned proxy-first classification or detachment branches that are only compensating for missing native observation plumbing.
- Done when: `simulation.js` no longer owns behavior that should live in canonical native-first observation or classification code.

## Resume From Here

- Most recent completed work: converted-result provenance now exposes per-region logfile field coverage, optional traction extensions, current coverage, and the actual native/proxy source chosen in `resultProvenance.interfaceObservation`; the standard export/bridge path also declares a plotfile `contact traction` bridge contract via `plotfileSurfaceData.localNc.*` and `plotfileSurfaceData.localCd.*`.
- Current unfinished area: Priority 2 Stage 6 only. The remaining work is compatibility retirement in `simulation.js`, especially any classification or detachment fallback that still survives only because the legacy browser path has not been fully collapsed onto canonical `src/` ownership.
- Next files to open: `simulation.js`, `src/results/classification.ts`, `src/public-api.ts`, `tests/febio-front-end.test.mjs`.
- Next step done condition: one more compatibility-owned classification/detachment helper is rerouted through canonical public API ownership, browser compatibility stays intact, the targeted tests pass, and `Resume From Here` points at the next unresolved compatibility branch.

## Historical Resume From Here

- 最後に完了した節目: converter の face-data parser が descriptor-driven になり、leading entity id の有無だけでなく、extra metadata 列付き row と descriptor-driven field order も解釈できるようになった。加えて export metadata 側でも、標準 logfile `face_data` が現状 `contact gap;contact pressure` までで、tangential traction は optional external/plotfile-side extension であることを bundle から読めるようにした。
- 現在の未完了項目: export 側の標準 face_data はまだ `contact gap;contact pressure` で、native tangential observation は外部 payload か将来の plotfile/bridge 拡張に依存している。また、non-canonical context では classification / detachment の compatibility fallback helper が一部残っている。
- 次に開くファイル: `src/febio/export/index.ts`, `js/simulation-febio.js`, `scripts/convert_febio_output.mjs`, `simulation.js`
- 次ステップの完了条件: face-data export descriptor か compatibility-owned detachment/classification branch のどちらかをもう 1 つ native-first に移行し、browser compatibility を壊さず、対象テストが通り、`Resume From Here` が次の未解決枝を指す状態に更新されていること。

## Open Problems / Blockers

| Problem | Impact | Workaround | Intended fix | Priority |
|---|---|---|---|---|
| sticky cohesive は true traction-separation law ではなく近似のまま | 検証時の物理解釈が揺れやすく、最終的な detachment 条件の確信度を下げる | sticky cohesive を solver-primary に保ち、scope を広げる前に安定化を検証する | 安定化と検証を先に終え、その後で native observation と detachment path が落ち着いてから true cohesive を導入する | high |
| native interface observation がまだ部分的 | import 結果や compatibility 経路では shear / detachment 解釈に proxy 補完が残る | native data がある場合は保持し、欠損だけ明示的に proxy fallback で埋める | native face-data と result normalization を広げ、`localNc` / `localCd` を provenance 付きの native-first regional state にする | high |
| explicit detachment event が全 result payload で native ではない | downstream の classification や解析が solver event ではなく導出 event に依存することがある | import と compatibility path で explicit detachment derivation を維持する | external payload から十分な情報が取れる場合は export / bridge / import 全体で detachment event を native に運ぶ | high |
| `simulation.js` に compatibility-local な schema / classification / detachment ロジックが残っている | 再開時に誤ったファイルから入りやすく、`src/` と重複ロジックがずれやすい | canonical public API bridge を先に使い、`simulation.js` は retirement path に置く | 残り責務を `src/` modules に移し、`simulation.js` には thin browser compatibility call だけを残す | high |
| bridge 側 diagnostics がまだ粗い | FEBio 実行失敗や payload 変換失敗の切り分けに時間がかかる | 現状は manifest と bridge 出力、import 側チェックで追う | 上位 priority が落ち着いた段階で bridge-side execution diagnostics を強化する | medium |

## Implementation Status

| Item | Status | Current behavior | Known limitation | Next step |
|---|---|---|---|---|
| Canonical parameter schema | implemented | source of truth は `src/model/schema.ts` へ移っている | browser runtime には compatibility scripts が残る | caller を public API 側へさらに移す |
| Source-of-truth split | implemented | `src/` modules と `generated/dist/` build path が存在する | legacy browser bundle と `simulation.js` が compatibility のため残っている | UI internals を段階的に移しつつ compatibility ownership を縮める |
| FEBio run bundle / bridge | implemented | export bundle と browser flow は explicit detachment contract を含む main path を保っている | diagnostics はまだ粗い | bridge-side execution diagnostics を改善する |
| Refined mesh | implemented | mesh の source of truth は `src/febio/mesh/` にある | local interface resolution はまだ粗い | nucleus-cytoplasm interface 近傍を詰める |
| Nucleus bulk material | implemented | viscoelastic export は `src/febio/export/index.ts` で canonical 化されている | calibration は未完了 | パラメータ校正を進める |
| Cytoplasm bulk material | implemented | viscoelastic export は `src/febio/export/index.ts` で canonical 化されている | calibration は未完了 | パラメータ校正を進める |
| Optional nonlinear term | partial | canonical schema は `alpha_nonlinear` を保持している | XML 上では metadata を超えて solver-active ではない | calibration 後に solver-active branch を追加する |
| Nucleus-cytoplasm interface | partial | sticky cohesive 近似は `src/febio/interfaces/nucleusCytoplasm.ts` で soft-start stabilization、augmentation bounds、penalty ramp export、stabilization validation を伴って solver-primary のまま | true traction-separation law ではない | 安定化した sticky 近似を FEBio run で検証しつつ proxy 依存を減らす |
| `localNc` / `localCd` native output | partial | canonical import は partial native `localNc` / `localCd` payload を保持し、`contactFraction` / `nativeGap`、`sourceNormal` / `sourceDamage` / `sourceShear`、`history[]` 内の native regional metric を維持する。converted FEBio face snapshot では leading entity id の有無に加えて、descriptor-driven field order と extra metadata 列付き row layout でも、可能な場合は native tangential traction を shear に再利用し、proxy fallback 前に native regional payload から detachment metric を導出する。export metadata も標準 logfile field と optional traction extension を明示する | compatibility runtime には proxy-assisted shear path が残り、標準 export の face_data 自体はまだ tangential traction を常には出していない | shear と detachment observation を solver-native output へさらに寄せる |
| Classification | partial | `src/results/classification.ts` は native detachment signal を優先し、`applyRunClassification` で共有 classification 適用を担い、legacy browser runtime は canonical public API bridge を compatibility fallback より先に使う | compatibility bundle はまだ module path へ完全移行していない | 残り caller を canonical classifier に寄せて compatibility-local classification を退役させる |
| Detachment event | partial | canonical export は explicit detachment contract を宣言し、canonical import は explicit external detachment event を導出前に保持する。lightweight compatibility runtime は canonical detachment assessment が使える場合に explicit event を出し、`scripts/convert_febio_output.mjs` も converted FEBio history から explicit detachment event と detachment metric を出す | export/runtime path 全体ではまだ全 payload で native event が揃っていない | 残り external FEBio payload shape に対して native explicit event emission を広げ、その後 compatibility-local derivation を減らす |
| True cohesive law | planned | sticky 近似は将来の cohesive-ready metadata を保持している | energy-history-based ではない | 安定化後に solver-primary の true cohesive を導入する |

## Rough Approximations That Still Matter

1. nucleus-cytoplasm はまだ sticky cohesive approximation で、true cohesive ではない
2. `localNc` shear はまだ solver-consistent な native observation が必要
3. detachment は設計上 explicit だが、まだ全 path で native event として揃っていない
4. membrane は proxy-first のまま
5. cell-dish cohesive は deferred
6. LINC / cytoskeleton は将来拡張
7. viscoelastic parameter calibration は未完了

## Next 3 Steps

### Step 1

- Target files: `simulation.js`, `src/results/classification.ts`, `src/public-api.ts`, `tests/febio-front-end.test.mjs`
- Expected output: retire one more compatibility-owned classification or detachment helper by routing it through canonical public API ownership.
- Done condition: the targeted compatibility branch no longer owns behavior, browser compatibility stays intact, tests pass, and `Resume From Here` names the next unresolved compatibility branch.

### Step 2

- Target files: `simulation.js`, `src/febio/import/normalizeFebioResult.ts`, `tests/febio-front-end.test.mjs`
- Expected output: trim any remaining compatibility-local proxy labeling that duplicates the now-completed Stage 4/5 provenance flow.
- Done condition: compatibility code reads canonical provenance instead of rebuilding it locally, and converted/imported payload tests still pass.

### Step 3

- Target files: `src/febio/interfaces/nucleusCytoplasm.ts`, `src/febio/export/index.ts`, `tests/febio-front-end.test.mjs`
- Expected output: after Stage 6 makes room, return to the sticky cohesive validation branch with a cleaner native observation path.
- Done condition: the next solver-validation question is recorded in `Open Problems / Blockers` or `Resume From Here` and the export path remains stable.

## Historical Next 3 Steps

### Step 1

- Target files: `docs/febio/FEBIO_OUTPUT_MAPPING.md`、`scripts/convert_febio_output.mjs`、`src/febio/import/normalizeFebioResult.ts`、`tests/febio-front-end.test.mjs`
- Expected output: import 結果が `localNc` / `localCd` の shear または detachment provenance を proxy 補完前により多く native 保持し、現行の external payload 仮定が docs に正直に残る
- Done condition: 対象の `localNc` shear または detachment path で native/proxy provenance が明示され、classification がそれを整合的に消費し、fallback がラベル付きで残り、mapping note に新しい native tangential branch が反映されている

### Step 2

- Target files: `simulation.js`、`src/results/classification.ts`、`src/public-api.ts`、`tests/febio-front-end.test.mjs`
- Expected output: compatibility-owned な classification または detachment helper が 1 つ、独自 threshold や sequencing を持たず canonical `src/` code 経由へ寄る
- Done condition: 対象 compatibility branch が振る舞いを所有しなくなり、browser compatibility が維持され、対象テストが通り、`Resume From Here` が次の未解決 branch を指す

### Step 3

- Target files: `src/febio/interfaces/nucleusCytoplasm.ts`、`src/febio/export/index.ts`、`tests/febio-front-end.test.mjs`
- Expected output: sticky cohesive path が deferred physics へ広げずに、より安定して検証しやすくなる
- Done condition: 対象 stabilization parameterization が clean に export され、現行 path を壊さず、次の検証論点が `Open Problems / Blockers` または `Resume From Here` に記録されている

## Decision Log

| Chosen direction | Reason | Explicitly deferred alternative |
|---|---|---|
| 通常運用では task-specific skill を優先する | 探索範囲を小さく保ち、再現性と token 効率を上げるため | ad hoc な repo-wide exploration を通常フローにすること |
| empirical prompt tuning は評価と workflow 改善にだけ使う | 実装作業と instruction 品質評価を分離するため | empirical workflow を通常実装フローにすること |
| まず effective な nucleus-cytoplasm interface を優先する | 現在の研究目的に直結し、detachment 条件評価へ集中できるため | main interface path が安定する前に LINC や cytoskeleton detail を入れること |
| true cohesive は現 main path が安定した次段階として扱う | sticky cohesive と native observation の安定化前に law を変えると解釈がぶれるため | `localNc`、classification、detachment path が落ち着く前に true cohesive へ飛ぶこと |
| `simulation.js` は retiring compatibility layer として扱う | canonical source-of-truth ownership はすでに `src/` にあるため、compatibility は縮小していくべきだから | `simulation.js` に長期的な schema / classification / detachment ownership を追加すること |

## Detachment Definition

detachment は次の両方で評価する:

- cohesive damage progression
- contact area reduction や relative displacement のような geometry loss

運用方針:

- 必要なところだけ proxy-assisted
- solver 出力があるなら native-first

classification はこの定義と整合していなければならない。

## Operating Principles

- interrupt-resume friendly
- priority-visible
- blocker-visible
- next-action concrete

## Update Rules

- physics model、cohesive model、detachment logic、main flow、classification、export/import ownership、proxy/native dependency が変わったら、このファイルを同じ変更セットで更新する
- `simulation.js` の ownership や compatibility-bridge scope が変わったら、このファイルを同じ変更セットで更新する
- 各コード変更で next action が変わったら `Resume From Here` を更新する
- priority が変わったら `Priority Stack` を更新する
- 新しく見つかった recurring blocker は `Open Problems / Blockers` に追加する
- `PROGRESS.md` は status 報告だけでなく、中断後の再開を支えること
- `implemented / partial / planned` の変更はすぐ反映する
- `implemented -> partial` を含む回帰は正直に記録する
- 新しく増えた近似も正直に記録する
- `README.md`、`CODEBASE_STRUCTURE.md`、`PROGRESS.md` の整合を保つ
- field や判断が `proxy` / `native` / `proxy/native` のどれかを明示する

## Consistency Check

- `AGENT.md` は同じ source-of-truth path を使っているか
- skills は同じ source-of-truth file を指しているか
- `Resume From Here` は次に開く実ファイルを指しているか
- `Priority Stack` は現在の研究方向と一致しているか
- current blocker は status 文に埋もれず `Open Problems / Blockers` に見えているか
- classification は native data を優先し、proxy fallback を明示しているか
- detachment logic は damage + geometry と整合しているか
- runtime docs は canonical `src/` と compatibility scripts を区別しているか
