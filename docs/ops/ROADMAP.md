# 優先順位とロードマップ

`PROGRESS.md` から外した優先順位と段階計画の置き場です。現在の再開位置は [../../PROGRESS.md](../../PROGRESS.md) を参照してください。

## 優先順位

現在:

1. simulation condition advancement
2. solver-active mesh completeness
3. complete FEBio XML serialization
4. aspiration length output、native interface output、sticky cohesive validation

次:

1. Stage S1 として solver-active mesh validation を強化する
2. Stage S2 として complete FEBio XML serialization の実装方針を固める
3. Stage S4 として aspiration length L(t) と native/interface output を定義する

後で扱う:

1. sticky cohesive solver validation
2. true cohesive または nonlinear spring failure への移行判断
3. real solver outputs が出た後の classification / detachment cleanup 再評価

まだ広げない:

- membrane shell
- cell-dish cohesive の追加物理
- LINC / cytoskeleton の明示モデル

## 第2優先ロードマップ

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

## 更新ルール

- priority が変わったらこのファイルを更新する。
- 各コード変更で next action が変わったら [../../PROGRESS.md](../../PROGRESS.md) の `再開位置` と `次の3手` を更新する。
- physics model、cohesive model、detachment logic、main flow、classification、export / import ownership、proxy / native dependency が変わったら `PROGRESS.md` と関連 docs を同じ変更セットで更新する。
- Stage 6 完了後は compatibility cleanup を次の主課題として戻さず、simulation condition advancement の進捗で優先順位を更新する。
