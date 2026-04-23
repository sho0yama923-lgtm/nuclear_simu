# 2026-04 Progress History

`PROGRESS.md` から外した historical sections の退避先です。現在状態は [../../PROGRESS.md](../../PROGRESS.md) を参照してください。

## Historical Resume From Here

- 最後に完了した節目: converter の face-data parser が descriptor-driven になり、leading entity id の有無だけでなく、extra metadata 列付き row と descriptor-driven field order も解釈できるようになった。加えて export metadata 側でも、標準 logfile `face_data` が現状 `contact gap;contact pressure` までで、tangential traction は optional external/plotfile-side extension であることを bundle から読めるようにした。
- 当時の未完了項目: export 側の標準 face_data はまだ `contact gap;contact pressure` で、native tangential observation は外部 payload か将来の plotfile/bridge 拡張に依存していた。また、non-canonical context では classification / detachment の compatibility fallback helper が一部残っていた。
- 当時次に開くファイル: `src/febio/export/index.ts`, `js/simulation-febio.js`, `scripts/convert_febio_output.mjs`, `simulation.js`
- 当時の完了条件: face-data export descriptor か compatibility-owned detachment/classification branch のどちらかをもう 1 つ native-first に移行し、browser compatibility を壊さず、対象テストが通り、`Resume From Here` が次の未解決枝を指す状態に更新されていること。

## Historical Next 3 Steps

### Step 1

- Target files: `docs/febio/FEBIO_OUTPUT_MAPPING.md`, `scripts/convert_febio_output.mjs`, `src/febio/import/normalizeFebioResult.ts`, `tests/febio-front-end.test.mjs`
- Expected output: import 結果が `localNc` / `localCd` の shear または detachment provenance を proxy 補完前により多く native 保持し、現行の external payload 仮定が docs に正直に残る。
- Done condition: 対象の `localNc` shear または detachment path で native/proxy provenance が明示され、classification がそれを整合的に消費し、fallback がラベル付きで残り、mapping note に新しい native tangential branch が反映されている。

### Step 2

- Target files: `simulation.js`, `src/results/classification.ts`, `src/public-api.ts`, `tests/febio-front-end.test.mjs`
- Expected output: compatibility-owned な classification または detachment helper が 1 つ、独自 threshold や sequencing を持たず canonical `src/` code 経由へ寄る。
- Done condition: 対象 compatibility branch が振る舞いを所有しなくなり、browser compatibility が維持され、対象テストが通り、`Resume From Here` が次の未解決 branch を指す。

### Step 3

- Target files: `src/febio/interfaces/nucleusCytoplasm.ts`, `src/febio/export/index.ts`, `tests/febio-front-end.test.mjs`
- Expected output: sticky cohesive path が deferred physics へ広げずに、より安定して検証しやすくなる。
- Done condition: 対象 stabilization parameterization が clean に export され、現行 path を壊さず、次の検証論点が `Open Problems / Blockers` または `Resume From Here` に記録されている。
