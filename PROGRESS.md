# FEBio 精度改善の現在状態

最終更新: 2026-04-23

## 現在の状況

- 現在の目標: FEBio を主経路として、核が細胞質から脱落する条件を評価する。
- 現在の main path: UI 入力 -> canonical spec -> FEBio export -> FEBio CLI -> 正規化 import -> native-first classification / detachment judgment -> 結果描画。
- 現在の最優先: nucleus-cytoplasm cohesive を安定化しつつ、`localNc` / `localCd`、classification、detachment 判定を native-first に寄せる。
- 現在の blocker: sticky cohesive はまだ近似であり、native interface observation は payload 形状ごとのばらつきが残り、explicit detachment event も全 payload で native ではなく、`simulation.js` に互換用途の fallback helper が残っている。

## 再開位置

- 直近の完了: converted-result provenance は region ごとの logfile field coverage、optional traction extensions、current coverage、`resultProvenance.interfaceObservation` で実際に選ばれた native/proxy source を示す。standard export/bridge path も `plotfileSurfaceData.localNc.*` と `plotfileSurfaceData.localCd.*` 経由の plotfile `contact traction` bridge contract を宣言する。
- 未完了領域: Priority 2 Stage 6 のみ。残り作業は `simulation.js` の compatibility retirement、とくに legacy browser path が canonical `src/` ownership へ畳み切れていないために残る classification / detachment fallback。
- 次に開くファイル: `simulation.js`, `src/results/classification.ts`, `src/public-api.ts`, `tests/febio-front-end.test.mjs`
- 次ステップの完了条件: compatibility-owned classification / detachment helper をもう 1 つ canonical public API ownership へ寄せ、browser compatibility を保ち、対象テストを通し、次の未解決 branch をこの節へ反映する。

## 未解決問題

| 問題 | 影響 | 暫定対応 | 意図する修正 | 優先度 |
|---|---|---|---|---|
| sticky cohesive は true traction-separation law ではなく近似のまま | 検証時の物理解釈が揺れやすく、最終的な detachment 条件の確信度を下げる | sticky cohesive を solver-primary に保ち、scope を広げる前に安定化を検証する | 安定化と検証を先に終え、その後で native observation と detachment path が落ち着いてから true cohesive を導入する | high |
| native interface observation がまだ部分的 | import 結果や compatibility 経路では shear / detachment 解釈に proxy 補完が残る | native data がある場合は保持し、欠損だけ明示的に proxy fallback で埋める | native face-data と result normalization を広げ、`localNc` / `localCd` を provenance 付きの native-first regional state にする | high |
| explicit detachment event が全 result payload で native ではない | downstream の classification や解析が solver event ではなく導出 event に依存することがある | import と compatibility path で explicit detachment derivation を維持する | external payload から十分な情報が取れる場合は export / bridge / import 全体で detachment event を native に運ぶ | high |
| `simulation.js` に compatibility-local な schema / classification / detachment ロジックが残っている | 再開時に誤ったファイルから入りやすく、`src/` と重複ロジックがずれやすい | canonical public API bridge を先に使い、`simulation.js` は retirement path に置く | 残り責務を `src/` modules に移し、`simulation.js` には thin browser compatibility call だけを残す | high |
| bridge 側 diagnostics がまだ粗い | FEBio 実行失敗や payload 変換失敗の切り分けに時間がかかる | 現状は manifest と bridge 出力、import 側チェックで追う | 上位 priority が落ち着いた段階で bridge-side execution diagnostics を強化する | medium |

## 実装状態

| 項目 | 状態 | 現在の挙動 | 既知の制約 | 次の手 |
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

## 次の3手

### 1. 互換ヘルパーを退役させる

- Target files: `simulation.js`, `src/results/classification.ts`, `src/public-api.ts`, `tests/febio-front-end.test.mjs`
- Expected output: compatibility-owned classification または detachment helper をもう 1 つ canonical public API ownership へ寄せる。
- Done condition: 対象 branch が振る舞いを所有しなくなり、browser compatibility が維持され、対象テストが通り、`再開位置` が次の未解決 branch を指す。

### 2. proxy 由来情報の重複を削る

- Target files: `simulation.js`, `src/febio/import/normalizeFebioResult.ts`, `tests/febio-front-end.test.mjs`
- Expected output: Stage 4/5 の provenance flow と重複する compatibility-local proxy labeling を削る。
- Done condition: compatibility code が local rebuild ではなく canonical provenance を読む。

### 3. sticky cohesive 検証へ戻る

- Target files: `src/febio/interfaces/nucleusCytoplasm.ts`, `src/febio/export/index.ts`, `tests/febio-front-end.test.mjs`
- Expected output: Stage 6 の後、より clean な native observation path で sticky cohesive validation branch へ戻る。
- Done condition: 次の solver-validation question が `未解決問題` または `再開位置` に記録され、export path が安定している。

## 関連ファイル

- 研究問い: [docs/research/RESEARCH_QUESTION.md](docs/research/RESEARCH_QUESTION.md)
- 仮定と近似: [docs/research/ASSUMPTIONS.md](docs/research/ASSUMPTIONS.md)
- 条件表: [docs/research/CONDITION_MATRIX.md](docs/research/CONDITION_MATRIX.md)
- 用語と指標: [docs/research/TERMS_AND_METRICS.md](docs/research/TERMS_AND_METRICS.md)
- repo 構造: [docs/CODEBASE_STRUCTURE.md](docs/CODEBASE_STRUCTURE.md)
- 優先順位とロードマップ: [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md)
- 判断理由: [docs/DECISIONS.md](docs/DECISIONS.md)
- 履歴: [docs/history/2026-04-progress-history.md](docs/history/2026-04-progress-history.md)
