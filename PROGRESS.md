# FEBio 精度改善の進捗

Last updated: 2026-04-23

## Current Operating Picture

- 現在の目標: FEBio を主経路として、核が細胞質から脱落する条件を評価する。
- 現在の main path: UI 入力 -> canonical spec -> FEBio export -> FEBio CLI -> 正規化 import -> native-first classification / detachment judgment -> 結果描画。
- 現在の最優先: nucleus-cytoplasm cohesive を安定化しつつ、`localNc` / `localCd`、classification、detachment 判定を native-first に寄せる。
- 現在の blocker: sticky cohesive はまだ近似であり、native interface observation は payload 形状ごとのばらつきが残り、explicit detachment event も全 payload で native ではなく、`simulation.js` に互換用途の fallback helper が残っている。

## Research Goal

- FEBio を主な物理経路として、核が細胞質から脱落する条件を評価する。
- detachment は明示イベントとして扱う。
- detachment 判定は damage と geometry の両方で行う。
- solver 出力がある場合は native-first を維持し、必要な場合のみ proxy を補助的に使う。
- true cohesive を導入するまでは、sticky cohesive を solver-primary な近似として使う。

詳細:

- 研究問い: [docs/research/RESEARCH_QUESTION.md](docs/research/RESEARCH_QUESTION.md)
- 仮定: [docs/research/ASSUMPTIONS.md](docs/research/ASSUMPTIONS.md)
- 条件表: [docs/research/CONDITION_MATRIX.md](docs/research/CONDITION_MATRIX.md)
- 用語と指標: [docs/research/TERMS_AND_METRICS.md](docs/research/TERMS_AND_METRICS.md)

## Main Flow

1. UI input
2. canonical spec
3. FEBio template / `.feb` XML
4. FEBio CLI execution
5. normalized result import
6. physical result rendering

Canonical ownership:

- canonical parameter source: `src/model/schema.ts`
- main FEBio export source: `src/febio/export/index.ts`
- normalized import source: `src/febio/import/normalizeFebioResult.ts`
- classification source: `src/results/classification.ts`

Runtime note:

- Browser 互換経路はまだ legacy bundle から起動している。
- source-of-truth の編集先は `src/` へ移っている。
- `simulation.js` は compatibility layer であり、source-of-truth ではない。
- `generated/dist/` は生成物であり、編集対象ではない。

## Priority Stack

Now:

1. nucleus-cytoplasm cohesive の安定化と検証
2. `localNc` native output への移行
3. classification native migration
4. explicit detachment judgment と event emission

Next:

1. `simulation.js` の解体
2. schema / classification / detachment の残り責務を canonical `src/` modules に移す
3. `simulation.js` を browser path 用の thin compatibility bridge まで縮める

Later:

1. true cohesive の導入
2. calibration 後の solver-active nonlinear branch
3. native-first observation path が安定してからの material calibration 拡張

Do not expand yet:

- membrane shell
- cell-dish cohesive
- LINC / cytoskeleton

## Priority 2 Roadmap

- Goal: `localNc` / `localCd` observation を、現在の FEBio path が支えられる範囲で native-first へ寄せる。
- Done condition: standard export/bridge path が solver-native tangential observation を直接出すか、残る proxy fallback が意図的・ラベル付き・狭い範囲だと分かる metadata を持つ。
- Current position: Stage 6 ready.

| Stage | Status | Scope |
|---|---|---|
| Stage 1: Canonical import preservation | completed | native `localNc` / `localCd` payload、`contactFraction` / `nativeGap`、`sourceNormal` / `sourceDamage` / `sourceShear` を final state と `history[]` に保持する |
| Stage 2: Converter face-log robustness | completed | face snapshot の複数 row layout、leading entity id、extra metadata、descriptor-driven field order を読む |
| Stage 3: Export self-description | completed | standard export bundle が現行 face-data fields と optional traction extensions を宣言する |
| Stage 4: Converted result provenance visibility | completed | converted output mapping が interface region ごとの coverage と optional traction extensions を示す |
| Stage 5: Standard path native shear expansion | completed | standard export/bridge path に solver-native tangential observation branch を追加する |
| Stage 6: Compatibility retirement | pending | compatibility-owned proxy-first classification / detachment branch を退役させる |

## Resume From Here

- Most recent completed work: converted-result provenance now exposes per-region logfile field coverage, optional traction extensions, current coverage, and the actual native/proxy source chosen in `resultProvenance.interfaceObservation`; the standard export/bridge path also declares a plotfile `contact traction` bridge contract via `plotfileSurfaceData.localNc.*` and `plotfileSurfaceData.localCd.*`.
- Current unfinished area: Priority 2 Stage 6 only. The remaining work is compatibility retirement in `simulation.js`, especially any classification or detachment fallback that still survives only because the legacy browser path has not been fully collapsed onto canonical `src/` ownership.
- Next files to open: `simulation.js`, `src/results/classification.ts`, `src/public-api.ts`, `tests/febio-front-end.test.mjs`.
- Next step done condition: one more compatibility-owned classification/detachment helper is rerouted through canonical public API ownership, browser compatibility stays intact, the targeted tests pass, and `Resume From Here` points at the next unresolved compatibility branch.

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
| `localNc` / `localCd` native output | partial | canonical import は partial native payload、regional metric、source label、history 内 metric を保持する。converter は supported payload で native tangential traction を shear に再利用し、proxy fallback 前に native regional payload から detachment metric を導出する | compatibility runtime には proxy-assisted shear path が残り、standard export の face_data 自体はまだ tangential traction を常には出していない | shear と detachment observation を solver-native output へさらに寄せる |
| Classification | partial | `src/results/classification.ts` は native detachment signal を優先し、legacy browser runtime は canonical public API bridge を compatibility fallback より先に使う | compatibility bundle はまだ module path へ完全移行していない | 残り caller を canonical classifier に寄せて compatibility-local classification を退役させる |
| Detachment event | partial | canonical export は explicit detachment contract を宣言し、canonical import は explicit external detachment event を導出前に保持する。compatibility runtime と converter も explicit event / metric を補う | export/runtime path 全体ではまだ全 payload で native event が揃っていない | native explicit event emission を広げ、その後 compatibility-local derivation を減らす |
| True cohesive law | planned | sticky 近似は将来の cohesive-ready metadata を保持している | energy-history-based ではない | 安定化後に solver-primary の true cohesive を導入する |

## Rough Approximations That Still Matter

1. nucleus-cytoplasm はまだ sticky cohesive approximation で、true cohesive ではない。
2. `localNc` shear はまだ solver-consistent な native observation が必要。
3. detachment は設計上 explicit だが、まだ全 path で native event として揃っていない。
4. membrane は proxy-first のまま。
5. cell-dish cohesive は deferred。
6. LINC / cytoskeleton は将来拡張。
7. viscoelastic parameter calibration は未完了。

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

## Update Rules

- physics model、cohesive model、detachment logic、main flow、classification、export/import ownership、proxy/native dependency が変わったら、このファイルを同じ変更セットで更新する。
- `simulation.js` の ownership や compatibility-bridge scope が変わったら、このファイルを同じ変更セットで更新する。
- 各コード変更で next action が変わったら `Resume From Here` を更新する。
- priority が変わったら `Priority Stack` を更新する。
- 新しく見つかった recurring blocker は `Open Problems / Blockers` に追加する。
- `implemented / partial / planned` の変更、回帰、新しい近似は正直に記録する。
- 履歴は [docs/history/2026-04-progress-history.md](docs/history/2026-04-progress-history.md)、判断理由は [docs/DECISIONS.md](docs/DECISIONS.md) に逃がし、ここには現在状態を置く。
