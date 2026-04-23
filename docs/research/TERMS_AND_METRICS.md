# 用語と指標

研究側で使う用語と、結果 JSON / classification の対応をまとめます。

## 主要用語

| 用語 | 意味 |
|---|---|
| detachment | 核が細胞質から機械的に遊離すること。damage と geometry loss の両方から評価する。 |
| native | solver output または FEBio payload から直接・準直接に得た情報。 |
| proxy | native 欠損を補う縮約推定。使用時は provenance を残す。 |
| `localNc` | nucleus-cytoplasm interface の normalized regional result。 |
| `localCd` | cell-dish interface の normalized regional result。 |
| membraneRegions | 現時点では membrane / cortex の proxy 指標。 |

## Detachment 指標

detachment は次を組み合わせて見る。

- cohesive damage progression
- contact area reduction
- relative displacement
- explicit detachment event

運用方針:

- native signal がある場合は native-first。
- proxy fallback は欠損部分だけに使う。
- classification は detachment 定義と整合させる。

## Failure / Event

| Event | 意味 |
|---|---|
| `ncDamageStart` | nucleus-cytoplasm interface の damage 開始 |
| `cdDamageStart` | cell-dish interface の damage 開始 |
| `membraneDamageStart` | membrane proxy damage の開始 |
| `detachmentStart` | detachment 判定の開始 |
| `detachmentComplete` | detachment 判定の完了 |
| `tipSlip` | pipette holding が失われる兆候 |

## Classification

| Label | 意味 |
|---|---|
| `nucleus_detached` | 核のみが遊離したと見なす成功側 |
| `cell_attached_to_tip` | 細胞全体または大きな細胞質がピペット側へ吸着 |
| `deformation_only` | 大変形はあるが遊離しない |
| `no_capture` | 保持が成立しない、または早期滑脱 |

## Provenance

結果を読むときは、値だけでなく出所を見る。

- `sourceNormal`
- `sourceDamage`
- `sourceShear`
- `resultProvenance.interfaceObservation`
- `outputMapping`

これらが `native` / `proxy` / optional extension のどれを示すかで、結果の解釈強度を分ける。
