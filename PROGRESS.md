# FEBio 精度改善の現在状態

最終更新: 2026-04-24

## 現在の状況

- 現在の目標: FEBio solver に渡す simulation condition を物理的に成立させ、核が細胞質から脱落する条件を solver-active に評価できる状態へ進める。
- 現在の main path: UI 入力 -> canonical spec -> FEBio export -> FEBio CLI -> 正規化 import -> classification / detachment judgment -> 結果描画。
- Priority 2 Stage 6 は完了済み。
- 現在の最優先: FEBio solver に渡すシミュレーション条件を物理的に成立させること。具体的には、solver-active mesh、完全 FEBio XML、pressure-driven pipette suction、aspiration length output、native interface traction/damage output、unit system clarification を優先する。
- sticky cohesive validation は重要だが、まず実体 mesh・load・output が成立した後に行う。
- compatibility cleanup / classification cleanup は Stage 6 完了済みの前提で深追いせず、real solver outputs が出た段階で再評価する。

## 再開位置

- 直近の完了:
  - Priority 2 Stage 6 completed.
  - `simulation.js` no longer owns the active classification / detachment path.
  - browser runtime and FEBio converter sandbox route classification/detachment helpers through canonical public API when available.
  - `src/febio/mesh/index.ts` now provides non-empty nucleus / cytoplasm / dish / pipette element sets in the refined mesh baseline, and mesh validation rejects missing required domains, required surfaces, and malformed required surface pairs.
  - `serializeFebioTemplateToXml` now emits mesh nodes, elements, ElementSet, Surface, SurfacePair, and canonical nucleus / cytoplasm material `E`, `nu`, `eta` values into XML.
  - XML now also emits dish fixed boundary, pipette prescribed motion, cell-dish contact, proxy hold force / pressure metadata, and load controllers.
  - Stage S3 completed. `P_hold` is now a solver-active suction pressure magnitude in kPa and is exported as negative pressure on `pipette_contact_surface` with `suction_pressure_curve`.
  - Unit system is recorded as `um-s-kPa-nN` in `src/model/types.ts` and `docs/febio/PRESSURE_SUCTION_STAGE_S3.md`.
- 未完了領域:
  - simulation condition advancement.
  - solver-active mesh completeness is still simplified and not yet physically proven.
  - aspiration length L(t) output is not yet established.
  - native interface output remains partial.
- 次に開くファイル:
  - `src/febio/mesh/index.ts`
  - `src/febio/export/index.ts`
  - `src/febio/interfaces/nucleusCytoplasm.ts`
  - `src/model/defaults.ts`
  - `src/model/schema.ts`
  - `src/model/types.ts`
  - `docs/febio/PRESSURE_SUCTION_STAGE_S3.md`
  - `tests/febio-front-end.test.mjs`
- 次ステップの完了条件:
  - mesh validation can fail when required solver-active domains are missing.
  - nucleus element set must be non-empty.
  - required surface pairs must be present and non-empty.
  - PROGRESS.md no longer points to compatibility cleanup as the next major task.

## 未解決問題

| 問題 | 影響 | 暫定対応 | 意図する修正 | 優先度 |
|---|---|---|---|---|
| solver-active mesh completeness is not yet proven | 核・細胞質・ピペット・dish が実体として solver に渡っていない場合、detachment 結果の物理解釈が成立しない | export-ready flow は維持するが、physical claim は控える | nucleus / cytoplasm / dish / pipette の非空 domain、surface pair、contact surface を validation 必須にする | critical |
| aspiration length L(t) output is not yet established | micropipette aspiration 実験の pressure-L(t) 比較ができない | pressure suction is solver-active, but output remains displacement/contact based | aspiration length `L(t)` を出力する | critical |
| sticky cohesive は true traction-separation law ではなく近似のまま | mesh / load / output が未確立のまま検証すると物理解釈が揺れやすい | sticky cohesive は effective coupling proxy として保持し、solver-active mesh / load / output が成立するまで validation scope を広げない | 先に実体 mesh・荷重・出力を成立させ、その後に sticky approximation の安定性と interface geometry を実 FEBio run で検証する | high |
| native interface observation がまだ部分的 | interface traction / damage を native output として比較できず、proxy 補完が残る | native data がある場合は保持し、欠損だけ明示的に proxy fallback で埋める | native face-data と result normalization を広げ、interface traction / damage を provenance 付きで出せるようにする | high |
| explicit detachment event が全 result payload で native ではない | classification / detachment cleanup の優先順位を誤ると、solver event ではなく導出 event を先に整え続けてしまう | import と compatibility path で explicit detachment derivation を維持する | real solver outputs が出た後に、export / bridge / import 全体で detachment event を native に運ぶかを再評価する | medium |
| bridge 側 diagnostics がまだ粗い | FEBio 実行失敗や payload 変換失敗の切り分けに時間がかかる | 現状は manifest と bridge 出力、import 側チェックで追う | solver-condition work をブロックする場合に限って bridge-side execution diagnostics を強化する | medium |

## 実装状態

| 項目 | 状態 | 現在の挙動 | 既知の制約 | 次の手 |
|---|---|---|---|---|
| Canonical parameter schema | implemented | source of truth は `src/model/schema.ts` にある。unit system は `um-s-kPa-nN` として `src/model/types.ts` に記録済み | calibration はまだ暫定値 | aspiration / output metrics の単位を同じ系で揃える |
| Source-of-truth split | implemented | `src/` modules と `generated/dist/` build path が分離されている | browser runtime には compatibility layer が残る | source-of-truth は `src/` と PROGRESS.md に固定する |
| FEBio run bundle / bridge | implemented-infrastructure / partial-physics | export / import infrastructure と bridge contract は main path を保っている。XML は mesh nodes / elements / ElementSet / Surface / SurfacePair、material values、boundary、contact、negative suction pressure load curve を出す | aspiration length output と FEBio CLI での実読込検証はまだ未完成 | aspiration length `L(t)` と native interface output を整理し、end-to-end 成立を検証する |
| Refined mesh | partial | mesh source exists。required domain / surface / surface-pair validation も入り、nucleus / cytoplasm / dish / pipette の非空 domain を baseline mesh が持つ | mesh はまだ box-like approximation で、physical contact geometry と XML serialization は未完成 | mesh section を XML に出し、physical contact geometry を詰める |
| Nucleus bulk material | partial | canonical material parameters exist | full solver-active XML serialization と calibration が未完了 | `E`, `nu`, `eta` が FEBio XML に明示反映されることを検証する |
| Cytoplasm bulk material | partial | canonical material parameters exist | full solver-active XML serialization と calibration が未完了 | `E`, `nu`, `eta` が FEBio XML に明示反映されることを検証する |
| Optional nonlinear term | partial | canonical schema は `alpha_nonlinear` を保持している | XML 上では metadata を超えて solver-active ではない | simulation condition advancement 後に solver-active branch を追加する |
| Nucleus-cytoplasm interface | partial | sticky cohesive approximation は `src/febio/interfaces/nucleusCytoplasm.ts` にあり、現時点では nucleus-cytoplasm effective coupling proxy であって LINC / cytoskeleton の明示モデルではない | true traction-separation law ではなく、solver-active output も未完成 | mesh / load / output が成立した後に sticky cohesive solver validation を進める |
| Native interface traction / damage output | partial | canonical import は partial native payload と provenance を保持する | standard export / bridge path では native traction / damage coverage がまだ不完全 | native interface output を solver-active output として取得できるようにする |
| Classification | partial | canonical classifier は public API から利用できる | cleanup を続けても real solver output が未成立だと評価軸が弱い | real solver outputs に基づいて後で整理する。今は優先度を下げる |
| Detachment event | partial | explicit detachment contract と導出 path は存在する | 全 payload で native event emission が揃っていない | native event 化は solver-active output が成立してから進める |
| True cohesive law | planned | sticky approximation は将来移行できる metadata を保持している | solver-active mesh / load / output の成立前に進める段階ではない | sticky approximation の検証後に true cohesive または nonlinear spring failure の移行方針を固める |

## Priority 2 Roadmap

- 目的: compatibility retirement を完了し、classification / detachment の active path を canonical public API へ寄せる。
- 完了条件: browser runtime と FEBio converter sandbox が、classification / detachment helper を canonical public API 経由で使う。
- 現在位置: Stage 6 completed。

| Stage | 状態 | 範囲 |
|---|---|---|
| Stage 1: Canonical import preservation | completed | native `localNc` / `localCd` payload、`contactFraction` / `nativeGap`、`sourceNormal` / `sourceDamage` / `sourceShear` を final state と `history[]` に保持する |
| Stage 2: Converter face-log robustness | completed | face snapshot の複数 row layout、leading entity id、extra metadata、descriptor-driven field order を読む |
| Stage 3: Export self-description | completed | standard export bundle が現行 face-data fields と optional traction extensions を宣言する |
| Stage 4: Converted result provenance visibility | completed | converted output mapping が interface region ごとの coverage と optional traction extensions を示す |
| Stage 5: Standard path native shear expansion | completed | standard export / bridge path に solver-native tangential observation branch を追加する |
| Stage 6: Compatibility retirement | completed | compatibility-owned proxy-first classification / detachment branch を退役させる |

## Simulation Condition Advancement Roadmap

| Stage | Status | Scope |
|---|---|---|
| Stage S1: Solver-active mesh completeness | in progress | nucleus / cytoplasm / dish / pipette を実体メッシュとして出力し、nucleus element set が空でないことを保証する |
| Stage S2: Complete FEBio XML serialization | completed | nodes / elements / ElementSet / Surface / SurfacePair / material / boundary / contact / load を solver input として完全に出力する |
| Stage S3: Pressure-driven pipette suction | completed | `P_hold` / `ΔP(t)` を pressure load curve として実装し、prescribed motion と suction を区別する |
| Stage S4: Aspiration and interface output | next | aspiration length `L(t)`、displacement、contact pressure、interface traction / damage を native または明示的な後処理で取得する |
| Stage S5: Sticky cohesive solver validation | planned | 実 FEBio run で sticky approximation の安定性、interface geometry、native outputs を検証する |
| Stage S6: True cohesive/failure preparation | planned | sticky approximation の検証後、true cohesive または nonlinear spring failure への移行方針を固める |

## 次の3手

### 1. aspiration length L(t) と interface output を定義する

- Target files:
  - `src/febio/export/index.ts`
  - `tests/febio-front-end.test.mjs`
  - `scripts/convert_febio_output.mjs`
  - `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- Expected output:
  - aspiration length `L(t)` を output contract に追加する。
  - displacement / contact pressure / interface traction / damage の native または後処理 payload path を明示する。
  - pressure-driven suction と `L(t)` を比較できる形にする。
- Done condition:
  - 既存テストが通る。
  - `L(t)` output contract が bundle / XML / converter expectation に残る。
  - native interface output の不足が provenance 付きで分かる。

### 2. FEBio XML completeness の実装方針を固める

- Target files:
  - `src/febio/export/index.ts`
  - `src/febio/mesh/index.ts`
  - `tests/febio-front-end.test.mjs`
- Expected output:
  - nodes / elements / ElementSet / Surface / SurfacePair を XML へ出す方針が明確になる。
  - nucleus / cytoplasm material の `E`, `nu`, `eta` を XML に明示反映する。
  - FEBio Studio / CLI で読み込み可能な `.feb` を目標にする。
- Done condition:
  - XML に必要な section が出る。
  - material parameters がテンプレートデータだけでなく XML にも反映される。
  - まだ完全実行できない場合は、未対応 section を明示する。

### 3. native interface output の不足を provenance 付きで整理する

- Target files:
  - `src/febio/export/index.ts`
  - `scripts/convert_febio_output.mjs`
  - `src/febio/import/normalizeFebioResult.ts`
  - `tests/febio-front-end.test.mjs`
- Expected output:
  - native traction / damage / aspiration length の payload path を明示する。
  - 欠損している output は proxy fallback ではなく unavailable / planned として分離する。
  - Stage S5 の sticky cohesive validation に入る前の output blocker を見える化する。
- Done condition:
  - output mapping と import result provenance が同じ source label を使う。
  - S4 の残差が PROGRESS.md に記録される。

## 関連ファイル

- 研究問い: [docs/research/RESEARCH_QUESTION.md](docs/research/RESEARCH_QUESTION.md)
- 仮定と近似: [docs/research/ASSUMPTIONS.md](docs/research/ASSUMPTIONS.md)
- 条件表: [docs/research/CONDITION_MATRIX.md](docs/research/CONDITION_MATRIX.md)
- 用語と指標: [docs/research/TERMS_AND_METRICS.md](docs/research/TERMS_AND_METRICS.md)
- repo 構造: [docs/CODEBASE_STRUCTURE.md](docs/CODEBASE_STRUCTURE.md)
- 優先順位とロードマップ: [docs/ops/ROADMAP.md](docs/ops/ROADMAP.md)
- 判断理由: [docs/DECISIONS.md](docs/DECISIONS.md)
- 履歴: [docs/history/2026-04-progress-history.md](docs/history/2026-04-progress-history.md)
- 2026-04-24 update: Priority 2 Stage 6 completed. `simulation.js` no longer owns the active classification / detachment path; both the browser runtime and the FEBio converter sandbox now route those helpers through the canonical public API when available.
- Next focus after Stage 6: simulation condition advancement.
- Prioritize solver-active mesh, FEBio XML completeness, pressure-driven suction, aspiration length output, native interface output, and unit-system clarification.
- Sticky cohesive validation comes after mesh / load / output are physically established.
- Stage S3 pressure suction note: [docs/febio/PRESSURE_SUCTION_STAGE_S3.md](docs/febio/PRESSURE_SUCTION_STAGE_S3.md)
