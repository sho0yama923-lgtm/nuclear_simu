# FEBio Accuracy Progress

Last updated: 2026-04-22

## Research Goal

- Main goal: 核が細胞質から脱落する条件を評価する。
- Detachment は明示イベントとして扱い、damage + 幾何の両方で判定する。
- proxy 依存は段階的に減らし、native cohesive 出力を優先する。

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

- Browser compatibility still boots through the legacy bundle.
- Source-of-truth editing has moved into `src/`.
- `dist/` is generated and not the edit target.

## Current Priority

1. nucleus-cytoplasm cohesive の安定化
2. `localNc` の native 出力化
3. classification の native 化
4. detachment 判定の明示化
5. true cohesive 導入

### Deferred for now

- membrane shell
- cell-dish cohesive
- LINC / cytoskeleton

## Implementation Status

| Item | Status | Current behavior | Known limitation | Next step |
|---|---|---|---|---|
| Canonical parameter schema | implemented | source of truth moved to `src/model/schema.ts` | browser runtime still uses compatibility scripts | keep migrating callers toward public API |
| Source-of-truth split | implemented | `src/` modules and `dist/` build path exist | legacy browser bundle still remains for compatibility | migrate UI internals gradually |
| FEBio run bundle / bridge | implemented | export bundle and browser flow preserve the main path | diagnostics are still coarse | improve bridge-side execution diagnostics |
| Refined mesh | implemented | mesh source of truth exists in `src/febio/mesh/` | local interface resolution is still coarse | refine near nucleus-cytoplasm interface |
| Nucleus bulk material | implemented | viscoelastic export is canonicalized in `src/febio/export/index.ts` | calibration remains incomplete | calibrate parameters |
| Cytoplasm bulk material | implemented | viscoelastic export is canonicalized in `src/febio/export/index.ts` | calibration remains incomplete | calibrate parameters |
| Optional nonlinear term | partial | canonical schema preserves `alpha_nonlinear` | not solver-active in XML beyond metadata | add a solver-active branch after calibration |
| Nucleus-cytoplasm interface | partial | sticky cohesive approximation remains solver-primary | not a true traction-separation law yet | stabilize cohesive behavior and reduce proxy dependence |
| `localNc` native output | partial | native provenance is the preferred target in canonical classification/import | compatibility runtime still carries proxy-assisted fields | migrate shear and detachment logic fully to native observation |
| Classification | partial | `src/results/classification.ts` prefers native detachment signals | compatibility bundle is not fully migrated to the module path | move remaining callers to the canonical classifier |
| Detachment event | partial | canonical classification treats detachment as an explicit event concept | full event emission is not wired across all paths yet | add `detachmentStart` / `detachmentComplete` everywhere |
| True cohesive law | planned | sticky approximation retains future cohesive-ready metadata | not energy-history-based yet | introduce solver-primary true cohesive after stabilization |

## Rough Approximations That Still Matter

1. nucleus-cytoplasm remains sticky cohesive approximation, not true cohesive
2. `localNc` shear still needs solver-consistent native observation
3. detachment is explicit in design, but not fully emitted across all paths
4. membrane remains proxy-first
5. cell-dish cohesive is deferred
6. LINC / cytoskeleton remain future extensions
7. viscoelastic parameters are not yet calibrated

## Next 3 Steps

### Now

- stabilize nucleus-cytoplasm cohesive behavior further
- reduce `localNc` proxy dependence in normalized import

### Next

- move classification callers onto native-first canonical outputs
- add explicit detachment events and provenance

### After That

- introduce true cohesive traction-separation behavior
- revisit membrane shell and cell-dish cohesive only after higher priorities stop drifting

## Detachment Definition

Detachment should be evaluated from both:

- cohesive damage progression
- geometry loss such as contact area reduction or relative displacement

The direction is:

- proxy-assisted now where needed
- native-first whenever solver output exists

Classification must remain consistent with that definition.

## Update Rules

- When physics model, cohesive model, detachment logic, main flow, classification, export/import ownership, or proxy/native dependency changes, update this file in the same change set.
- Reflect `implemented / partial / planned` changes immediately.
- Record regressions honestly, including `implemented -> partial`.
- Record new approximations honestly as well.
- Keep `README.md`, `CODEBASE_STRUCTURE.md`, and `PROGRESS.md` aligned.
- Always state whether a field or decision is `proxy`, `native`, or `proxy/native`.

## Consistency Check

- Does `AGENT.md` use the same source-of-truth paths?
- Do skills point to the same source-of-truth files?
- Does classification prefer native data and label proxy fallback explicitly?
- Does detachment logic remain aligned with damage + geometry?
- Do runtime docs still distinguish canonical `src/` from compatibility scripts?
