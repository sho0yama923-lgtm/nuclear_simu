# 設計判断

このファイルは判断理由の単一ファイルです。`docs/decisions/` ディレクトリには分けません。現在状態は [../PROGRESS.md](../PROGRESS.md) に置きます。

## Native-First Policy

背景:

- FEBio を主な物理経路にするには、結果解釈を proxy ではなく solver output に寄せる必要がある。
- ただし現時点では `localNc` / `localCd` の native observation が部分的で、payload 形状にもばらつきがある。

採用方針:

- solver 出力がある場合は native-first で保持する。
- 欠損部分だけ proxy fallback で補い、`sourceNormal` / `sourceDamage` / `sourceShear` などで出所を明示する。

理由:

- 結果の物理解釈と再現性を保ちながら、現行 path を止めずに改善できるため。

先送りした案 / 採用しなかった案:

- proxy を完全に禁止する案は、現行 payload では main path を壊すため先送り。
- native / proxy の出所を曖昧に混ぜる案は、classification の解釈が崩れるため採用しない。

## `simulation.js` Retirement Path

背景:

- `simulation.js` は legacy browser compatibility layer として残っている。
- schema / classification / detachment の source-of-truth は canonical `src/` modules へ移りつつある。

採用方針:

- `simulation.js` は退役対象の compatibility layer として扱う。
- 新しい長期責務は `src/` に置き、compatibility 側は public API を呼ぶ thin bridge へ縮める。

理由:

- source-of-truth を分散させると、再開時に誤ったファイルから入りやすく、判断がずれるため。

先送りした案 / 採用しなかった案:

- `simulation.js` に新しい schema / classification / detachment ownership を追加する案は採用しない。
- 一気に削除する案は browser compatibility への影響が大きいため、段階的に退役する。

## Sticky Cohesive Approximation

背景:

- nucleus-cytoplasm interface は研究目的の中心だが、true traction-separation law はまだ安定運用できていない。
- 以前は inward 操作の初期 increment で solver failure が起こりやすかった。

採用方針:

- 当面は solver-primary な sticky cohesive approximation を使う。
- soft-start stabilization、penalty ramp、validation を伴わせ、true cohesive 導入前に main path を安定させる。

理由:

- law 自体を早く変えるより、現在の FEBio main path を通し、native observation と detachment path を整える方が研究目的に近い。

先送りした案 / 採用しなかった案:

- true cohesive を今すぐ solver-primary にする案は、解釈がぶれやすいため先送り。
- LINC / cytoskeleton detail を先に入れる案は、現在の detachment 条件評価から遠いため先送り。

## Detachment Definition

背景:

- 成功条件の中心は、核が細胞質から脱落するかどうかである。
- 単一の damage 指標だけでは、幾何的な遊離や接触面積低下を見落とす可能性がある。

採用方針:

- detachment は明示イベントとして扱う。
- cohesive damage progression と geometry loss の両方から評価する。
- classification はこの定義と整合させる。

理由:

- solver output、converted result、UI 表示、classification の意味をそろえやすくなるため。

先送りした案 / 採用しなかった案:

- damage のみで detachment とみなす案は、geometry loss を取り逃がすため採用しない。
- proxy-derived event のみを最終形にする案は採用せず、native event へ移行する。

## Task-Specific Skill Priority

背景:

- 長い自然言語依頼だけに頼ると、repo-wide exploration が増えやすい。

採用方針:

- 通常運用では task-specific skill を優先する。
- 反復する作業は `.skills/**/SKILL.md` や `docs/ops/` に codify する。

理由:

- 探索範囲を小さく保ち、再現性と token 効率を上げるため。

先送りした案 / 採用しなかった案:

- ad hoc な repo-wide exploration を通常フローにすることは採用しない。

## Empirical Prompt Tuning Scope

背景:

- instruction 品質評価は有用だが、通常実装に毎回入れると重くなる。

採用方針:

- empirical prompt tuning は評価と workflow 改善にだけ使う。

理由:

- 実装作業と instruction 品質評価を分離するため。

先送りした案 / 採用しなかった案:

- empirical workflow を通常実装フローにすることは採用しない。
