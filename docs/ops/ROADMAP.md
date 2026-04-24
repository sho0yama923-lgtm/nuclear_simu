# 優先順位とロードマップ

`PROGRESS.md` から外した優先順位と段階計画の置き場です。現在の再開位置は [../../PROGRESS.md](../../PROGRESS.md) を参照してください。

## 優先順位

現在:

1. nucleus-cytoplasm cohesive の安定化と検証
2. `localNc` native output への移行
3. classification native migration
4. explicit detachment judgment と event emission

次:

1. `simulation.js` の解体
2. schema / classification / detachment の残り責務を canonical `src/` modules に移す
3. `simulation.js` を browser path 用の thin compatibility bridge まで縮める

後で扱う:

1. true cohesive の導入
2. calibration 後の solver-active nonlinear branch
3. native-first observation path が安定してからの material calibration 拡張

まだ広げない:

- membrane shell
- cell-dish cohesive
- LINC / cytoskeleton

## 第2優先ロードマップ

- 目的: `localNc` / `localCd` observation を、現在の FEBio path が支えられる範囲で native-first へ寄せる。
- 完了条件: standard export/bridge path が solver-native tangential observation を直接出すか、残る proxy fallback が意図的・ラベル付き・狭い範囲だと分かる metadata を持つ。
- 現在位置: Stage 6 ready。

| Stage | 状態 | 範囲 |
|---|---|---|
| Stage 1: Canonical import preservation | completed | native `localNc` / `localCd` payload、`contactFraction` / `nativeGap`、`sourceNormal` / `sourceDamage` / `sourceShear` を final state と `history[]` に保持する |
| Stage 2: Converter face-log robustness | completed | face snapshot の複数 row layout、leading entity id、extra metadata、descriptor-driven field order を読む |
| Stage 3: Export self-description | completed | standard export bundle が現行 face-data fields と optional traction extensions を宣言する |
| Stage 4: Converted result provenance visibility | completed | converted output mapping が interface region ごとの coverage と optional traction extensions を示す |
| Stage 5: Standard path native shear expansion | completed | standard export/bridge path に solver-native tangential observation branch を追加する |
| Stage 6: Compatibility retirement | pending | compatibility-owned proxy-first classification / detachment branch を退役させる |

## 更新ルール

- priority が変わったらこのファイルを更新する。
- 各コード変更で next action が変わったら [../../PROGRESS.md](../../PROGRESS.md) の `再開位置` と `次の3手` を更新する。
- physics model、cohesive model、detachment logic、main flow、classification、export/import ownership、proxy/native dependency が変わったら `PROGRESS.md` と関連 docs を同じ変更セットで更新する。
- `simulation.js` の ownership や compatibility-bridge scope が変わったら、`PROGRESS.md` とこのファイルの compatibility retirement 記述を確認する。
